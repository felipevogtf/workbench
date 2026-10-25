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
  let service: ExecutionsService;
  let runnerJobs: RunnerJobsService;
  let runner: Runner;

  beforeEach(async () => {
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

    it('needs exactly one repository', async () => {
      tasks.task!.repoUrls = [];
      await expect(service.start('issue-1')).rejects.toThrow('no repository');

      tasks.task!.repoUrls = [
        'https://bitbucket.org/acme/web',
        'https://bitbucket.org/acme/api',
      ];
      await expect(service.start('issue-1')).rejects.toThrow('several');
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

  describe('assigning the tickets to workers', () => {
    const worker = (
      id: string,
      data: Partial<{ level: string; effort: string; model: string }>,
    ) => ({
      id,
      name: id,
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
