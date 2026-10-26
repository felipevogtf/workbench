import { ConfigService } from '@nestjs/config';
import { DomainError } from '@core/domain/domain.error';
import { Job } from '@executions/domain/entities/job.entity';
import { JobResult } from '@executions/domain/entities/job.props';
import { Runner } from '@executions/domain/entities/runner.entity';
import { ExecutionsService } from './executions.service';
import { RunnerJobsService, STALE_JOB_MS } from './runner-jobs.service';
import { RunnersService } from './runners.service';
import {
  FakeAgents,
  FakePlans,
  FakePullRequests,
  FakeTasks,
  InMemoryExecutions,
  InMemoryJobs,
  InMemoryRunners,
} from './testing/fakes';

const TICKETS_OUTPUT =
  'Aquí están:\n```json\n' +
  JSON.stringify({
    tickets: [
      { title: 'API de órdenes', description: 'Endpoint', criteria: ['200'] },
      { title: 'Vista', description: 'Pantalla', criteria: [] },
    ],
  }) +
  '\n```';
const APPROVED = JSON.stringify({
  approved: true,
  summary: 'Bien',
  issues: [],
});
const REJECTED = JSON.stringify({
  approved: false,
  summary: 'Falta algo',
  issues: ['Maneja el error 404'],
});

describe('ExecutionsService', () => {
  let executions: InMemoryExecutions;
  let jobs: InMemoryJobs;
  let tasks: FakeTasks;
  let plans: FakePlans;
  let agents: FakeAgents;
  let pullRequests: FakePullRequests;
  let runners: InMemoryRunners;
  let settings: Record<string, string>;
  let service: ExecutionsService;
  let runnerJobs: RunnerJobsService;
  let runner: Runner;

  beforeEach(async () => {
    settings = {};
    executions = new InMemoryExecutions();
    jobs = new InMemoryJobs();
    tasks = new FakeTasks();
    plans = new FakePlans();
    agents = new FakeAgents();
    pullRequests = new FakePullRequests();
    runners = new InMemoryRunners();
    service = new ExecutionsService(
      executions,
      jobs,
      tasks,
      plans,
      agents,
      pullRequests,
      { get: (key: string) => settings[key] } as unknown as ConfigService,
    );
    runnerJobs = new RunnerJobsService(
      jobs,
      runners,
      new RunnersService(runners),
      service,
    );
    runner = await runners.save(Runner.create({ name: 'pc', tokenHash: 'x' }));
  });

  /** El runner toma el siguiente trabajo y lo entrega con este resultado. */
  async function answer(result: JobResult, ok = true, error?: string) {
    const job = (await runnerJobs.claim(runner, 0)) as Job;
    expect(job).not.toBeNull();
    await runnerJobs.finish(runner, job.id, {
      ok,
      result,
      error,
      costUsd: 0.1,
    });
    return job;
  }

  const developed = (before: string, after: string) => ({
    output: 'Hecho',
    headBefore: before,
    headAfter: after,
  });

  describe('the history of all the tasks', () => {
    it('lists the most recent executions first, each with the name of its task', async () => {
      const first = await service.start('issue-1');
      await service.cancel(first.id);
      tasks.task = { ...tasks.task!, id: 'issue-2', name: 'Otra tarea' };
      const second = await service.start('issue-2');

      const items = await service.listRecent();

      expect(items.map((i) => i.execution.id)).toEqual([second.id, first.id]);
      expect(items.map((i) => i.issueName)).toEqual([
        'Otra tarea',
        'Otra tarea',
      ]);
    });

    it('caps how many it returns', async () => {
      for (let i = 0; i < 3; i++) {
        const started = await service.start('issue-1');
        await service.cancel(started.id);
      }

      expect(await service.listRecent(2)).toHaveLength(2);
    });

    it('leaves the name empty when the task no longer exists', async () => {
      const started = await service.start('issue-1');
      await service.cancel(started.id);
      tasks.task = null;

      expect((await service.listRecent())[0].issueName).toBeNull();
    });
  });

  describe('start', () => {
    it('queues the tickets job with the plan, the repo and a branch of its own', async () => {
      const execution = await service.start('issue-1');

      expect(execution.status).toBe('running');
      expect(execution.branch).toMatch(
        /^workbench\/vista-de-ordenes-de-carga-[0-9a-f]{8}$/,
      );
      expect(execution.repo).toMatchObject({
        fullName: 'acme/web',
        sshUrl: 'git@bitbucket.org:acme/web.git',
      });
      expect(execution.stages.map((s) => [s.key, s.status])).toEqual([
        ['tickets', 'running'],
        ['develop', 'pending'],
        ['review', 'pending'],
        ['publish', 'pending'],
      ]);

      expect(jobs.items).toHaveLength(1);
      const [job] = jobs.items;
      expect(job.kind).toBe('tickets');
      expect(job.payload.prompt).toContain('Hacer todo');
      expect(job.payload.prompt).toContain('Vista de órdenes de carga');
      expect(job.payload.agent?.name).toBe('default-task-tickets');
      expect(job.payload.repo.sshUrl).toBe('git@bitbucket.org:acme/web.git');
    });

    it('rejects a task that does not exist', async () => {
      tasks.task = null;
      await expect(service.start('issue-1')).rejects.toMatchObject({
        kind: 'not-found',
      });
    });

    it('rejects a second execution while one is running', async () => {
      await service.start('issue-1');
      await expect(service.start('issue-1')).rejects.toMatchObject({
        kind: 'conflict',
      });
    });

    it('needs a ready plan', async () => {
      plans.plan = null;
      await expect(service.start('issue-1')).rejects.toThrow('ready plan');
    });

    it('needs at least one repository, and no more than three', async () => {
      tasks.task!.repoUrls = [];
      await expect(service.start('issue-1')).rejects.toThrow('no repository');

      tasks.task!.repoUrls = [
        'https://bitbucket.org/acme/a',
        'https://bitbucket.org/acme/b',
        'https://bitbucket.org/acme/c',
        'https://bitbucket.org/acme/d',
      ];
      await expect(service.start('issue-1')).rejects.toThrow('up to 3');
    });

    it('only supports Bitbucket for now', async () => {
      tasks.task!.repoUrls = ['https://github.com/acme/web'];
      await expect(service.start('issue-1')).rejects.toThrow('Bitbucket');
    });

    it('refuses agents that the runner cannot run', async () => {
      agents.provider = 'copilot';
      const error = await service.start('issue-1').catch((e: unknown) => e);
      // El agente se resuelve al armar el primer trabajo, antes de guardar nada.
      expect(error).toBeInstanceOf(DomainError);
      expect(executions.items.size).toBe(0);
      expect(jobs.items).toHaveLength(0);
    });
  });

  describe('the full flow', () => {
    it('creates tickets, develops and reviews each one on the same branch and opens the pull request', async () => {
      const execution = await service.start('issue-1');

      await answer({ output: TICKETS_OUTPUT });
      await service.begin(execution.id);
      let current = (await service.get(execution.id)).execution;
      expect(current.tickets.map((t) => [t.title, t.status])).toEqual([
        ['API de órdenes', 'developing'],
        ['Vista', 'pending'],
      ]);
      expect(jobs.items.at(-1)).toMatchObject({
        kind: 'develop',
        ticketId: current.tickets[0].id,
      });
      expect(jobs.items.at(-1)!.payload.prompt).toContain('API de órdenes');
      expect(jobs.items.at(-1)!.payload.commitMessage).toContain(
        'API de órdenes',
      );

      await answer(developed('aaa', 'bbb'));
      const review = jobs.items.at(-1)!;
      expect(review.kind).toBe('review');
      expect(review.payload.reviewFrom).toBe('aaa');
      expect(review.payload.prompt).toContain('git diff aaa HEAD');

      await answer({ output: APPROVED });
      current = (await service.get(execution.id)).execution;
      expect(current.tickets.map((t) => t.status)).toEqual([
        'done',
        'developing',
      ]);

      await answer(developed('bbb', 'ccc'));
      await answer({ output: APPROVED });

      const publish = jobs.items.at(-1)!;
      expect(publish.kind).toBe('publish');
      expect(publish.payload.agent).toBeNull();
      current = (await service.get(execution.id)).execution;
      expect(current.status).toBe('running');

      await answer({ baseBranch: 'main' });
      current = (await service.get(execution.id)).execution;

      expect(current.status).toBe('completed');
      expect(current.pullRequestUrl).toBe(
        'https://bitbucket.org/acme/web/pull/7',
      );
      expect(current.stages.every((s) => s.status === 'done')).toBe(true);
      expect(pullRequests.created).toEqual([
        expect.objectContaining({
          host: 'bitbucket.org',
          repo: 'acme/web',
          sourceBranch: execution.branch,
          destBranch: 'main',
          title: 'Vista de órdenes de carga',
        }),
      ]);
      expect(pullRequests.created[0].description).toContain('API de órdenes');
    });

    it('reports the total cost of the jobs', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: TICKETS_OUTPUT });
      await service.begin(execution.id);

      const { jobs: summary } = await service.get(execution.id);
      expect(summary.reduce((sum, job) => sum + (job.costUsd ?? 0), 0)).toBe(
        0.1,
      );
    });
  });

  describe('when the developer makes no changes', () => {
    it('fails the execution and lets the user retry the same job', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: TICKETS_OUTPUT });
      await service.begin(execution.id);
      await answer(developed('aaa', 'aaa'));

      let current = (await service.get(execution.id)).execution;
      expect(current.status).toBe('failed');
      expect(current.error).toContain('no changes');
      expect(current.stages.find((s) => s.key === 'develop')!.status).toBe(
        'failed',
      );

      await service.retry(execution.id);
      current = (await service.get(execution.id)).execution;
      expect(current.status).toBe('running');
      expect(jobs.items.at(-1)).toMatchObject({
        kind: 'develop',
        status: 'pending',
        attempt: 2,
      });
    });
  });

  describe('retrying after the agents were fixed', () => {
    it('uses the agents as they are now, not as they were when the job failed', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: TICKETS_OUTPUT });
      await service.begin(execution.id);
      const before = jobs.items.at(-1)!;
      expect(before.payload.agent?.allowedTools).toEqual(['Read']);
      await answer({}, false, 'permiso denegado');

      // Se le dio a los agentes lo que faltaba y se reintenta.
      agents.tools = ['Read', 'Bash(npm install:*)'];
      await service.retry(execution.id);

      const retried = jobs.items.at(-1)!;
      expect(retried).toMatchObject({
        kind: 'develop',
        status: 'pending',
        attempt: 2,
      });
      expect(retried.id).not.toBe(before.id);
      expect(retried.payload.agent?.allowedTools).toEqual([
        'Read',
        'Bash(npm install:*)',
      ]);
      expect(retried.ticketId).toBe(before.ticketId);
    });
  });

  describe('when the developer cannot do what the reviewer asked', () => {
    it('fails with the explanation of the developer, and leaves no stage spinning', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: TICKETS_OUTPUT });
      await service.begin(execution.id);
      await answer(developed('aaa', 'bbb'));
      await answer({ output: REJECTED }); // el revisor pide correcciones: otra vuelta de desarrollo
      await answer({
        output:
          'No pude instalar el paquete: el permiso para npm i fue denegado.',
        headBefore: 'bbb',
        headAfter: 'bbb',
      });

      const current = (await service.get(execution.id)).execution;
      expect(current.status).toBe('failed');
      expect(current.error).toContain('made no changes');
      expect(current.error).toContain('No pude instalar el paquete');
      expect(current.tickets[0].summary).toContain(
        'No pude instalar el paquete',
      );
      // La ejecución ya no está en marcha: ninguna etapa debe seguir «corriendo».
      expect(current.stages.map((s) => s.status)).not.toContain('running');
      expect(current.stages.find((s) => s.key === 'develop')!.status).toBe(
        'failed',
      );
    });
  });

  describe('which stage is running', () => {
    const states = async (id: string) =>
      Object.fromEntries(
        (await service.get(id)).execution.stages.map((s) => [s.key, s.status]),
      );

    async function twoTickets() {
      const execution = await service.start('issue-1');
      await answer({ output: TICKETS_OUTPUT }); // 2 tickets; el primero pasa a desarrollo
      await service.begin(execution.id);
      return execution;
    }

    it('only development runs while a ticket is being developed', async () => {
      const execution = await twoTickets();

      expect(await states(execution.id)).toMatchObject({
        tickets: 'done',
        develop: 'running',
        review: 'pending',
      });
    });

    it('only review runs while a ticket is being reviewed, even with others waiting', async () => {
      const execution = await twoTickets();
      await answer(developed('aaa', 'bbb'));

      expect(await states(execution.id)).toMatchObject({
        develop: 'pending',
        review: 'running',
      });
    });

    it('goes back to development alone when the reviewer asks for changes', async () => {
      const execution = await twoTickets();
      await answer(developed('aaa', 'bbb'));
      await answer({ output: REJECTED });

      expect(await states(execution.id)).toMatchObject({
        develop: 'running',
        review: 'pending',
      });
    });

    it('finishes both when every ticket is done', async () => {
      const execution = await twoTickets();
      await answer(developed('aaa', 'bbb'));
      await answer({ output: APPROVED });
      await answer(developed('bbb', 'ccc'));
      await answer({ output: APPROVED });

      expect(await states(execution.id)).toMatchObject({
        develop: 'done',
        review: 'done',
        publish: 'running',
      });
    });
  });

  describe('a task that touches several repositories', () => {
    const MULTI = JSON.stringify({
      tickets: [
        {
          title: 'API',
          description: 'Backend',
          repo: 'acme/web',
          criteria: [],
        },
        {
          title: 'Pantalla',
          description: 'App',
          repo: 'acme/app',
          criteria: [],
        },
        { title: 'Sin repo', description: 'Nada', criteria: [] },
        {
          title: 'Repo raro',
          description: 'Otro',
          repo: 'otro/x',
          criteria: [],
        },
      ],
    });

    beforeEach(() => {
      tasks.task!.repoUrls = [
        'https://bitbucket.org/acme/web',
        'https://bitbucket.org/acme/app',
      ];
    });

    it('opens a branch with the same name in each repository, and lets Lucy read them all', async () => {
      const execution = await service.start('issue-1');

      const targets = execution.targets();
      expect(targets).toHaveLength(2);
      expect(targets.map((t) => t.repo.fullName)).toEqual([
        'acme/web',
        'acme/app',
      ]);
      expect(targets[1].branch).toBe(targets[0].branch);

      const job = jobs.items.at(-1)!;
      expect(job.payload.repo.fullName).toBe('acme/web');
      expect(job.payload.context).toEqual([
        {
          sshUrl: 'git@bitbucket.org:acme/app.git',
          fullName: 'acme/app',
          branch: targets[0].branch,
        },
      ]);
      expect(job.payload.prompt).toContain('{{dir:acme/app}}');
      expect(job.payload.prompt).toContain('"repo"');
    });

    it('puts each ticket in the repository it names, and in the first one when it names none or an unknown one', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: MULTI });

      const tickets = (await service.get(execution.id)).execution.tickets;
      expect(tickets.map((t) => t.repo)).toEqual([
        'acme/web',
        'acme/app',
        'acme/web',
        'acme/web',
      ]);
    });

    it('develops and reviews each ticket in its repository, with the other one to read', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: MULTI });
      await service.begin(execution.id);
      await answer(developed('aaa', 'bbb'));
      await answer({ output: APPROVED });

      const develop = jobs.items.at(-1)!;
      expect(develop.kind).toBe('develop');
      expect(develop.payload.repo.fullName).toBe('acme/app');
      expect(develop.payload.context?.map((c) => c.fullName)).toEqual([
        'acme/web',
      ]);
      expect(develop.payload.prompt).toContain('{{dir:acme/web}}');
      expect(develop.payload.prompt).toContain('NO modifiques');
    });

    it('pushes each repository and opens one pull request for each, then completes', async () => {
      tasks.task!.repoUrls = [
        'https://bitbucket.org/acme/web',
        'https://bitbucket.org/acme/app',
      ];
      const execution = await service.start('issue-1');
      await answer({
        output: JSON.stringify({
          tickets: [
            { title: 'API', description: 'Backend', repo: 'acme/web' },
            { title: 'Pantalla', description: 'App', repo: 'acme/app' },
          ],
        }),
      });
      await service.begin(execution.id);
      await answer(developed('a1', 'a2'));
      await answer({ output: APPROVED });
      await answer(developed('b1', 'b2'));
      await answer({ output: APPROVED });

      const first = jobs.items.at(-1)!;
      expect([first.kind, first.payload.repo.fullName]).toEqual([
        'publish',
        'acme/web',
      ]);
      expect(first.payload.context).toBeUndefined();
      await answer({ baseBranch: 'main' });

      const second = jobs.items.at(-1)!;
      expect([second.kind, second.payload.repo.fullName]).toEqual([
        'publish',
        'acme/app',
      ]);
      expect((await service.get(execution.id)).execution.status).toBe(
        'running',
      );
      await answer({ baseBranch: 'develop' });

      const done = (await service.get(execution.id)).execution;
      expect(done.status).toBe('completed');
      expect(
        done.targets().map((t) => [t.repo.fullName, t.baseBranch]),
      ).toEqual([
        ['acme/web', 'main'],
        ['acme/app', 'develop'],
      ]);
      expect(
        pullRequests.created.map((pr) => [pr.repo, pr.destBranch]),
      ).toEqual([
        ['acme/web', 'main'],
        ['acme/app', 'develop'],
      ]);
      // Cada PR cuenta solo sus tickets y avisa de la otra.
      expect(pullRequests.created[0].description).toContain('API');
      expect(pullRequests.created[0].description).not.toContain('Pantalla');
      expect(pullRequests.created[0].description).toContain('acme/app');
      expect(done.targets().every((t) => t.pullRequestUrl)).toBe(true);
    });

    it('does not give context to a task with a single repository', async () => {
      tasks.task!.repoUrls = ['https://bitbucket.org/acme/web'];
      await service.start('issue-1');

      expect(jobs.items.at(-1)!.payload.context).toBeUndefined();
    });
  });

  describe('when the developer cannot go on without an answer', () => {
    const ONE = JSON.stringify({
      tickets: [
        { title: 'Banner', description: 'Mostrar el banner', criteria: [] },
      ],
    });
    const ASK = {
      output:
        'No hice cambios.\nPREGUNTA: ¿El banner va en todas las pantallas del AST o solo en el formulario?',
      headBefore: 'aaa',
      headAfter: 'aaa',
    };
    /** Deja pasar el trabajo en segundo plano de Lucy. */
    const flush = async () => {
      for (let i = 0; i < 20; i++)
        await new Promise((resolve) => setImmediate(resolve));
    };

    async function asked() {
      const execution = await service.start('issue-1');
      await answer({ output: ONE });
      await service.begin(execution.id);
      await answer(ASK);
      await flush();
      return execution.id;
    }
    const ticketOf = async (id: string) =>
      (await service.get(id)).execution.tickets[0];

    it('waits on that ticket with the question, instead of failing, and queues nothing meanwhile', async () => {
      agents.chatReply = 'ESCALAR: Recomiendo todas las pantallas del AST.';
      const id = await asked();

      const { execution } = await service.get(id);
      const ticket = execution.tickets[0];
      expect(execution.status).toBe('running');
      expect(ticket.status).toBe('waiting');
      expect(ticket.questionsAsked).toBe(1);
      expect(ticket.question?.text).toContain(
        '¿El banner va en todas las pantallas',
      );
      expect(jobs.items.filter((job) => job.isOpen)).toHaveLength(0);
    });

    it('lets Lucy read the question with the plan and leave her recommendation for the user', async () => {
      agents.chatReply = 'ESCALAR: Recomiendo todas las pantallas del AST.';
      const id = await asked();

      expect((await ticketOf(id)).question?.recommendation).toBe(
        'Recomiendo todas las pantallas del AST.',
      );
      expect(agents.chats.at(-1)).toContain(
        '¿El banner va en todas las pantallas',
      );
      expect(agents.chats.at(-1)).toContain('## Pasos'); // el plan
    });

    it('keeps waiting for the user, with her answer as a recommendation, unless Lucy may answer', async () => {
      agents.chatReply =
        'RESPUESTA: El plan dice que va en todas las pantallas.';
      const id = await asked();

      const ticket = await ticketOf(id);
      expect(ticket.status).toBe('waiting');
      expect(ticket.question?.recommendation).toBe(
        'El plan dice que va en todas las pantallas.',
      );
    });

    it('answers by herself when the plan says so and she is allowed to', async () => {
      settings.EXECUTIONS_LUCY_ANSWERS = 'true';
      agents.chatReply =
        'RESPUESTA: El plan dice que va en todas las pantallas.';
      const id = await asked();

      const ticket = await ticketOf(id);
      expect(ticket.status).toBe('developing');
      expect(ticket.question).toBeNull();
      expect(ticket.decisions).toMatchObject([
        { from: 'lucy', text: 'El plan dice que va en todas las pantallas.' },
      ]);
      const develop = jobs.items.at(-1)!;
      expect(develop.kind).toBe('develop');
      expect(develop.payload.prompt).toContain(
        'Decisiones tomadas para este ticket',
      );
      expect(develop.payload.prompt).toContain(
        'El plan dice que va en todas las pantallas.',
      );
    });

    it('still escalates when she is allowed to answer but is not sure', async () => {
      settings.EXECUTIONS_LUCY_ANSWERS = 'true';
      agents.chatReply = 'ESCALAR: El plan no lo dice.';
      const id = await asked();

      expect((await ticketOf(id)).status).toBe('waiting');
    });

    it('waits for the user when Lucy fails or answers in no format', async () => {
      agents.chatReply = 'No sé qué hacer.';
      const id = await asked();

      const ticket = await ticketOf(id);
      expect(ticket.status).toBe('waiting');
      expect(ticket.question?.recommendation).toBeNull();
    });

    it('resumes the developer with the answer of the user, and keeps it as a decision', async () => {
      const id = await asked();
      const ticket = await ticketOf(id);

      await service.answer(id, ticket.id, 'Solo en el formulario del AST.');

      const after = await ticketOf(id);
      expect(after.status).toBe('developing');
      expect(after.question).toBeNull();
      expect(after.decisions).toHaveLength(1);
      expect(after.decisions[0]).toMatchObject({
        from: 'user',
        text: 'Solo en el formulario del AST.',
      });
      expect(after.decisions[0].question).toContain(
        '¿El banner va en todas las pantallas',
      );
      const develop = jobs.items.at(-1)!;
      expect(develop.kind).toBe('develop');
      expect(develop.payload.prompt).toContain(
        'Solo en el formulario del AST.',
      );
    });

    it('does not take an answer for a ticket that is not waiting, or an empty one', async () => {
      const id = await asked();
      const ticket = await ticketOf(id);

      await expect(service.answer(id, ticket.id, '   ')).rejects.toThrow(
        'empty',
      );
      await service.answer(id, ticket.id, 'Solo en el formulario.');
      await expect(
        service.answer(id, ticket.id, 'Otra vez'),
      ).rejects.toMatchObject({
        kind: 'conflict',
      });
    });

    it('fails with what happened once the developer has asked twice', async () => {
      const id = await asked();
      const first = await ticketOf(id);
      await service.answer(id, first.id, 'Solo en el formulario.');
      await answer(ASK); // vuelve a preguntar (2.ª)
      await flush();
      const second = await ticketOf(id);
      expect(second.status).toBe('waiting');
      await service.answer(id, second.id, 'Sí, solo ahí.');

      await answer(ASK); // la 3.ª ya no se permite

      const { execution } = await service.get(id);
      expect(execution.status).toBe('failed');
      expect(execution.error).toContain('made no changes');
    });

    it('lets Lucy and the user cancel the execution while the ticket waits', async () => {
      const id = await asked();

      expect((await service.cancel(id)).status).toBe('cancelled');
    });

    it('does not count it as a question when the developer made changes', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: ONE });
      await service.begin(execution.id);

      await answer({
        ...developed('aaa', 'bbb'),
        output: 'Hecho.\nPREGUNTA: ¿algo más?',
      });

      expect((await ticketOf(execution.id)).status).toBe('reviewing');
    });
  });

  describe('what the agents leave in doubt', () => {
    const ONE = JSON.stringify({
      tickets: [
        { title: 'Banner', description: 'Mostrar el banner', criteria: [] },
      ],
    });
    const ticketOf = async (id: string) =>
      (await service.get(id)).execution.tickets[0];

    async function developing() {
      const execution = await service.start('issue-1');
      await answer({ output: ONE });
      await service.begin(execution.id);
      return execution.id;
    }

    it('keeps the developer doubt on the ticket without stopping the execution', async () => {
      const id = await developing();

      await answer({
        ...developed('aaa', 'bbb'),
        output:
          'Agregué el banner.\nDUDAS: Supuse que va solo en el formulario.',
      });

      const { execution } = await service.get(id);
      expect(execution.status).toBe('running');
      expect(execution.tickets[0].status).toBe('reviewing');
      expect(execution.tickets[0].doubts).toEqual([
        {
          id: expect.any(String) as string,
          at: expect.any(String) as string,
          from: expect.any(String) as string,
          text: 'Supuse que va solo en el formulario.',
        },
      ]);
    });

    it('keeps the reviewer doubt too', async () => {
      const id = await developing();
      await answer(developed('aaa', 'bbb'));

      await answer({
        output:
          '{"approved":true,"summary":"ok","issues":[],"doubts":"No pude probar el modo oscuro"}',
      });

      const ticket = await ticketOf(id);
      expect(ticket.status).toBe('done');
      expect(ticket.doubts?.map((doubt) => doubt.text)).toEqual([
        'No pude probar el modo oscuro',
      ]);
    });

    it('leaves nothing when nobody doubted', async () => {
      const id = await developing();
      await answer(developed('aaa', 'bbb'));

      expect((await ticketOf(id)).doubts).toBeUndefined();
    });

    it('gives the developer the instruction to report doubts', async () => {
      await developing();

      expect(jobs.items.at(-1)!.payload.prompt).toContain('DUDAS:');
    });
  });

  describe('notes for the agents', () => {
    const ONE = JSON.stringify({
      tickets: [
        { title: 'Banner', description: 'Mostrar el banner', criteria: [] },
      ],
    });
    const NOTE = 'No toques los submódulos: todo cambio ahí se descarta.';

    /** Los tickets ya están creados y se espera el visto bueno. */
    async function awaiting() {
      const execution = await service.start('issue-1');
      await answer({ output: ONE });
      return execution.id;
    }
    const ticketOf = async (id: string) =>
      (await service.get(id)).execution.tickets[0];

    it('keeps the note on the ticket', async () => {
      const id = await awaiting();
      const ticket = await ticketOf(id);

      await service.addNote(id, ticket.id, `  ${NOTE}  `);

      expect((await ticketOf(id)).notes).toEqual([
        { at: expect.any(String) as string, from: 'user', text: NOTE },
      ]);
    });

    it('gives the developer the note when the ticket is worked on', async () => {
      const id = await awaiting();
      const ticket = await ticketOf(id);
      await service.addNote(id, ticket.id, NOTE);

      await service.begin(id);

      const develop = jobs.items.at(-1)!;
      expect(develop.kind).toBe('develop');
      expect(develop.payload.prompt).toContain('# Notas para este ticket');
      expect(develop.payload.prompt).toContain(`(del usuario) ${NOTE}`);
    });

    it('gives the note to the reviewer too', async () => {
      const id = await awaiting();
      const ticket = await ticketOf(id);
      await service.addNote(id, ticket.id, NOTE);
      await service.begin(id);

      await answer(developed('aaa', 'bbb'));

      const review = jobs.items.at(-1)!;
      expect(review.kind).toBe('review');
      expect(review.payload.prompt).toContain(NOTE);
    });

    it('does not take an empty note, one for a ticket that is done, or one for an unknown ticket', async () => {
      const id = await awaiting();
      const ticket = await ticketOf(id);

      await expect(service.addNote(id, ticket.id, '   ')).rejects.toThrow(
        'empty',
      );
      await expect(
        service.addNote(id, 'no-existe', NOTE),
      ).rejects.toMatchObject({ kind: 'not-found' });
      await expect(
        service.addNote('no-existe', ticket.id, NOTE),
      ).rejects.toMatchObject({ kind: 'not-found' });

      await service.begin(id);
      await answer(developed('aaa', 'bbb'));
      await answer({ output: '{"approved":true,"summary":"ok","issues":[]}' });
      expect((await ticketOf(id)).status).toBe('done');
      await expect(service.addNote(id, ticket.id, NOTE)).rejects.toMatchObject({
        kind: 'conflict',
      });
    });
  });

  describe('assigning the tickets to workers', () => {
    const worker = (
      id: string,
      data: Partial<{ level: string; effort: string; model: string }>,
    ) => ({
      id,
      name: id,
      displayName: null,
      provider: 'claude',
      model: data.model ?? 'claude-haiku-4-5-20251001',
      systemPrompt: 'prompt',
      allowedTools: ['Read'],
      effort: data.effort ?? null,
      level: data.level ?? null,
      isDefault: false,
    });
    const LEVELED = JSON.stringify({
      tickets: [
        { title: 'Texto', description: 'd', level: 'simple', criteria: [] },
        { title: 'Lógica', description: 'd', level: 'medium', criteria: [] },
        { title: 'Sin nivel', description: 'd', criteria: [] },
      ],
    });

    beforeEach(() => {
      agents.extra = [
        worker('agent-task-developer-simple', {
          level: 'simple',
          effort: 'low',
        }),
        worker('agent-task-reviewer-2', {}),
      ];
    });

    it('waits for the go-ahead once the tickets exist, without developing anything yet', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: LEVELED });

      const { execution: current } = await service.get(execution.id);
      expect(current.status).toBe('awaiting');
      expect(current.isActive).toBe(true);
      expect(current.stages.map((s) => [s.key, s.status])).toEqual([
        ['tickets', 'done'],
        ['develop', 'pending'],
        ['review', 'pending'],
        ['publish', 'pending'],
      ]);
      expect(jobs.items.filter((job) => job.isOpen)).toHaveLength(0);
      await expect(service.start('issue-1')).rejects.toMatchObject({
        kind: 'conflict',
      });
    });

    it('gives each ticket the developer of its level, and the default developer when there is none', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: LEVELED });

      const tickets = (await service.get(execution.id)).execution.tickets;
      expect(tickets.map((t) => t.level)).toEqual([
        'simple',
        'medium',
        'medium',
      ]);
      expect(tickets.map((t) => t.developerId)).toEqual([
        'agent-task-developer-simple',
        'agent-task-developer',
        'agent-task-developer',
      ]);
    });

    it('takes turns among the reviewers, starting with the default one', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: LEVELED });

      const tickets = (await service.get(execution.id)).execution.tickets;
      expect(tickets.map((t) => t.reviewerId)).toEqual([
        'agent-task-reviewer',
        'agent-task-reviewer-2',
        'agent-task-reviewer',
      ]);
    });

    it('lets the user change who works on a ticket before it starts', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: LEVELED });
      const [first] = (await service.get(execution.id)).execution.tickets;

      await service.assign(execution.id, first.id, {
        developerId: 'agent-task-developer',
        reviewerId: 'agent-task-reviewer-2',
      });

      const [changed] = (await service.get(execution.id)).execution.tickets;
      expect(changed.developerId).toBe('agent-task-developer');
      expect(changed.reviewerId).toBe('agent-task-reviewer-2');
    });

    it('refuses an agent that is not a developer or a reviewer as asked', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: LEVELED });
      const [first] = (await service.get(execution.id)).execution.tickets;

      await expect(
        service.assign(execution.id, first.id, {
          developerId: 'agent-task-reviewer',
        }),
      ).rejects.toThrow('cannot work as');
      await expect(
        service.assign(execution.id, first.id, { developerId: 'no-existe' }),
      ).rejects.toThrow('cannot work as');
    });

    it('does not change the assignment once the development has started', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: LEVELED });
      await service.begin(execution.id);
      const [first] = (await service.get(execution.id)).execution.tickets;

      await expect(
        service.assign(execution.id, first.id, {
          developerId: 'agent-task-developer',
        }),
      ).rejects.toMatchObject({ kind: 'conflict' });
      await expect(service.begin(execution.id)).rejects.toMatchObject({
        kind: 'conflict',
      });
    });

    it('develops with the assigned worker and its effort, and reviews with the assigned reviewer', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: LEVELED });
      await service.begin(execution.id);

      const develop = jobs.items.at(-1)!;
      expect(develop.kind).toBe('develop');
      expect(develop.payload.agent).toMatchObject({
        id: 'agent-task-developer-simple',
        model: 'claude-haiku-4-5-20251001',
        effort: 'low',
      });

      await answer(developed('aaa', 'bbb'));
      const review = jobs.items.at(-1)!;
      expect(review.kind).toBe('review');
      expect(review.payload.agent?.id).toBe('agent-task-reviewer');
    });

    it('can be cancelled while it waits for the go-ahead', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: LEVELED });

      const cancelled = await service.cancel(execution.id);

      expect(cancelled.status).toBe('cancelled');
    });

    it('asks the reviewer to read the review rules of the repository', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: LEVELED });
      await service.begin(execution.id);
      await answer(developed('aaa', 'bbb'));

      expect(jobs.items.at(-1)!.payload.prompt).toContain('REVIEW_RULES.md');
    });
  });

  describe('the review loop', () => {
    async function reachFirstReview() {
      const execution = await service.start('issue-1');
      await answer({ output: TICKETS_OUTPUT });
      await service.begin(execution.id);
      await answer(developed('aaa', 'bbb'));
      return execution;
    }

    it('tells the reviewer to ask only for what the developer can do', async () => {
      await reachFirstReview();
      const review = jobs.items.at(-1)!;

      expect(review.payload.prompt).toContain('comprobaciones manuales');
    });

    it('tells the developer to install the dependencies and not to stop on a denied command', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: TICKETS_OUTPUT });
      await service.begin(execution.id);
      const develop = jobs.items.at(-1)!;

      expect(develop.payload.prompt).toContain('npm install');
      expect(develop.payload.prompt).toContain('no te detengas');
      // El lockfile no debe quedar con cambios ajenos al ticket tras instalar.
      expect(develop.payload.prompt).toContain('git restore package-lock.json');
    });

    it('sends the reviewer feedback back to the developer', async () => {
      const execution = await reachFirstReview();
      await answer({ output: REJECTED });

      const next = jobs.items.at(-1)!;
      expect(next.kind).toBe('develop');
      expect(next.payload.prompt).toContain('Maneja el error 404');
      expect(
        (await service.get(execution.id)).execution.tickets[0],
      ).toMatchObject({ status: 'developing', rounds: 1 });
    });

    it('fails when the reviewer still asks for changes after the second review', async () => {
      const execution = await reachFirstReview();
      await answer({ output: REJECTED });
      await answer(developed('bbb', 'ccc'));
      await answer({ output: REJECTED });

      const current = (await service.get(execution.id)).execution;
      expect(current.status).toBe('failed');
      expect(current.error).toContain('Maneja el error 404');
      expect(current.tickets[0].status).toBe('failed');
    });

    it('gives one more round when the user retries after that failure', async () => {
      const execution = await reachFirstReview();
      await answer({ output: REJECTED });
      await answer(developed('bbb', 'ccc'));
      await answer({ output: REJECTED });

      await service.retry(execution.id);

      expect(jobs.items.at(-1)).toMatchObject({
        kind: 'develop',
        status: 'pending',
      });
      const current = (await service.get(execution.id)).execution;
      expect(current.status).toBe('running');
      expect(current.tickets[0]).toMatchObject({
        status: 'developing',
        rounds: 1,
      });
    });

    it('fails when the reviewer does not answer with a verdict', async () => {
      const execution = await reachFirstReview();
      await answer({ output: 'Se ve bien' });

      const current = (await service.get(execution.id)).execution;
      expect(current.status).toBe('failed');
      expect(current.error).toContain('JSON');
    });
  });

  describe('bad answers from the tickets agent', () => {
    it('fails when there is no valid JSON', async () => {
      const execution = await service.start('issue-1');
      await answer({ output: 'No sé qué hacer' });

      const current = (await service.get(execution.id)).execution;
      expect(current.status).toBe('failed');
      expect(current.stages.find((s) => s.key === 'tickets')!.status).toBe(
        'failed',
      );
    });

    it('caps the number of tickets', async () => {
      const execution = await service.start('issue-1');
      const many = Array.from({ length: 9 }, (_, i) => ({
        title: `T${i}`,
        description: 'd',
        criteria: [],
      }));
      await answer({ output: JSON.stringify({ tickets: many }) });

      expect((await service.get(execution.id)).execution.tickets).toHaveLength(
        5,
      );
    });
  });

  describe('when the pull request cannot be opened', () => {
    it('keeps the pushed branch and retries only the pull request', async () => {
      const execution = await service.start('issue-1');
      await answer({
        output: JSON.stringify({
          tickets: [{ title: 'Único', description: 'd', criteria: [] }],
        }),
      });
      await service.begin(execution.id);
      await answer(developed('aaa', 'bbb'));
      await answer({ output: APPROVED });

      pullRequests.failWith = 'token sin permiso';
      await answer({ baseBranch: 'main' });

      let current = (await service.get(execution.id)).execution;
      expect(current.status).toBe('failed');
      expect(current.error).toContain('token sin permiso');
      expect(current.error).toContain('pushed');
      const jobsBefore = jobs.items.length;

      pullRequests.failWith = null;
      await service.retry(execution.id);

      current = (await service.get(execution.id)).execution;
      expect(current.status).toBe('completed');
      expect(jobs.items).toHaveLength(jobsBefore);
      expect(pullRequests.created).toHaveLength(1);
    });
  });

  describe('failures reported by the runner', () => {
    it('fail the execution with its message', async () => {
      const execution = await service.start('issue-1');
      await answer({}, false, 'git clone failed');

      const current = (await service.get(execution.id)).execution;
      expect(current.status).toBe('failed');
      expect(current.error).toBe('git clone failed');
    });

    it('only a failed execution can be retried', async () => {
      const execution = await service.start('issue-1');
      await expect(service.retry(execution.id)).rejects.toMatchObject({
        kind: 'conflict',
      });
    });
  });

  describe('cancel', () => {
    it('stops the execution, drops the open jobs and ignores late results', async () => {
      const execution = await service.start('issue-1');
      const job = (await runnerJobs.claim(runner, 0)) as Job;

      await service.cancel(execution.id);
      expect((await service.get(execution.id)).execution.status).toBe(
        'cancelled',
      );
      expect(job.status).toBe('cancelled');

      // El runner no se entera hasta su próxima señal de vida y entrega igual.
      await runnerJobs.finish(runner, job.id, {
        ok: true,
        result: { output: TICKETS_OUTPUT },
      });
      expect(jobs.items).toHaveLength(1);
      expect(await runnerJobs.heartbeat(runner, [job.id])).toEqual([job.id]);
    });

    it('cannot cancel what is not running', async () => {
      const execution = await service.start('issue-1');
      await service.cancel(execution.id);
      await expect(service.cancel(execution.id)).rejects.toMatchObject({
        kind: 'conflict',
      });
    });
  });

  describe('several runners', () => {
    /** `runner` (el de siempre) es el predeterminado; `other` es un segundo PC. */
    async function twoRunners() {
      await runners.save(
        Runner.reconstruct({ ...runner.toProps(), isDefault: true }),
      );
      const other = await runners.save(
        Runner.create({ name: 'Portátil', tokenHash: 'y' }),
      );
      return { other };
    }

    it('give the work to the default one while it is connected', async () => {
      const { other } = await twoRunners();
      await new RunnersService(runners).touch(runner); // el predeterminado está conectado
      await service.start('issue-1');

      expect(await runnerJobs.claim(other, 0)).toBeNull();
      expect(jobs.items[0].status).toBe('pending');

      expect(await runnerJobs.claim(runner, 0)).not.toBeNull();
    });

    it('let another one take the work when the default is not connected', async () => {
      const { other } = await twoRunners();
      await service.start('issue-1');

      expect(await runnerJobs.claim(other, 0)).not.toBeNull();
    });
  });

  describe('a revoked runner', () => {
    it('gets no more work from a poll that was still waiting', async () => {
      await service.start('issue-1');
      await runners.delete(runner.id);

      expect(await runnerJobs.claim(runner, 0)).toBeNull();
      expect(jobs.items[0].status).toBe('pending');
    });

    it('is told to stop everything it was doing', async () => {
      await service.start('issue-1');
      const job = (await runnerJobs.claim(runner, 0)) as Job;
      await runners.delete(runner.id);

      expect(await runnerJobs.heartbeat(runner, [job.id])).toEqual([job.id]);
    });
  });

  describe('lost runners', () => {
    it('fails the jobs of a runner that stopped answering', async () => {
      const execution = await service.start('issue-1');
      await runnerJobs.claim(runner, 0);

      const later = new Date(Date.now() + STALE_JOB_MS + 1000);
      expect(await runnerJobs.failStaleJobs(later)).toBe(1);

      const current = (await service.get(execution.id)).execution;
      expect(current.status).toBe('failed');
      expect(current.error).toContain('stopped answering');
    });

    it('leaves alone the jobs of a runner that is still alive', async () => {
      await service.start('issue-1');
      await runnerJobs.claim(runner, 0);

      expect(await runnerJobs.failStaleJobs()).toBe(0);
    });
  });
});
