import { DomainError } from '@core/domain/domain.error';
import type {
  AttachmentRef,
  StagedAttachment,
} from '@core/attachments/attachments';
import { Plan } from '@planner/domain/entities/plan.entity';
import { PlanStatus } from '@planner/domain/entities/plan.props';
import { PlanRepositoryPort } from '@planner/domain/ports/plan-repository.port';
import { TaskContext } from '@planner/domain/ports/tasks-gateway.port';
import {
  PlanRunRequest,
  PlanRunResult,
} from '@planner/domain/ports/agents-gateway.port';
import { MAX_REPOS_PER_PLAN, PlansService } from './plans.service';

const task: TaskContext = {
  id: 'i1',
  name: 'Tarea MEL-1',
  description: 'Hacer algo',
  projectName: 'Melón',
  stateName: null,
  priority: null,
  startDate: null,
  dueDate: null,
  estimatedHours: null,
  isLocal: true,
  members: [],
  groupId: null,
  labels: [
    { name: 'b-web', repoUrl: 'https://github.com/o/web' },
    { name: 'a-api', repoUrl: 'https://github.com/o/api' },
    { name: 'sin-repo', repoUrl: null },
  ],
};

function build(
  options: { task?: TaskContext | null; runFails?: boolean } = {},
) {
  const store: Plan[] = [];
  const repo: PlanRepositoryPort = {
    findById: (id) => Promise.resolve(store.find((p) => p.id === id) ?? null),
    // Como el repositorio real: del más nuevo al más antiguo.
    findByIssueId: (issueId) =>
      Promise.resolve(store.filter((p) => p.issueId === issueId).reverse()),
    findByStatus: (status: PlanStatus) =>
      Promise.resolve(store.filter((p) => p.status === status)),
    findActiveByIssueId: (issueId) =>
      Promise.resolve(
        store.find((p) => p.issueId === issueId && p.isActive) ?? null,
      ),
    save: (plan) => {
      if (!store.includes(plan)) store.push(plan);
      return Promise.resolve(plan);
    },
    delete: (id) => {
      store.splice(
        store.findIndex((p) => p.id === id),
        1,
      );
      return Promise.resolve();
    },
    claimNextPending: () => {
      const next = store.find((p) => p.status === 'pending');
      next?.markGenerating();
      return Promise.resolve(next ?? null);
    },
  };

  const dispose = jest.fn().mockResolvedValue(undefined);
  const checkout = jest.fn((urls: string[]) =>
    Promise.resolve({
      path: '/tmp/plan-x',
      repos: urls.map((url) => ({
        url,
        name: url.split('/').pop() ?? '',
        used: true,
        note: null,
      })),
      dispose,
    }),
  );
  const runPlan = jest.fn<Promise<PlanRunResult>, [PlanRunRequest]>(() =>
    options.runFails
      ? Promise.reject(new Error('cli exploded'))
      : Promise.resolve({
          markdown: '## Objetivo\nok',
          agentId: 'a1',
          agentName: 'default-planner',
          model: 'm',
        }),
  );

  const getTicket = jest.fn((key: string) =>
    Promise.resolve({
      key,
      title: 'Ticket',
      stateName: null,
      labels: [],
      priority: null,
      descriptionText: null,
    }),
  );

  const stage = jest.fn<
    Promise<ReadonlyMap<string, StagedAttachment>>,
    [readonly AttachmentRef[], string]
  >(() => Promise.resolve(new Map<string, StagedAttachment>()));

  const service = new PlansService(
    repo,
    {
      getTask: () =>
        Promise.resolve(options.task === undefined ? task : options.task),
    },
    { runPlan, runTaskChat: jest.fn() },
    { checkout },
    {
      getProjectIdentifiers: () => Promise.resolve(['MEL']),
      getTicket,
    },
    1,
    { stage },
  );
  return { service, store, checkout, runPlan, dispose, getTicket, stage };
}

/** Espera a que el worker en segundo plano deje la cola vacía. */
async function settle(store: Plan[]): Promise<void> {
  for (let i = 0; i < 50 && store.some((p) => p.isActive); i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('PlansService', () => {
  it('generates a plan in the background and keeps the history', async () => {
    const { service, store, runPlan } = build();

    const plan = await service.create('i1');
    // Queda en cola; un worker puede tomarlo de inmediato.
    expect(['pending', 'generating']).toContain(plan.status);

    await settle(store);
    const done = await service.get(plan.id);
    expect(done.status).toBe('ready');
    expect(done.content).toContain('## Objetivo');
    expect(done.agentName).toBe('default-planner');
    expect(runPlan).toHaveBeenCalledTimes(1);
    expect(await service.listByIssue('i1')).toHaveLength(1);
  });

  it('clones the repos of the labels (ordered by label name, deduplicated) and always cleans up', async () => {
    const { service, store, checkout, dispose } = build();

    await service.create('i1');
    await settle(store);

    expect(checkout).toHaveBeenCalledWith([
      'https://github.com/o/api',
      'https://github.com/o/web',
    ]);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('limits the number of repositories per plan', async () => {
    const labels = Array.from({ length: MAX_REPOS_PER_PLAN + 2 }, (_, n) => ({
      name: `l${n}`,
      repoUrl: `https://github.com/o/r${n}`,
    }));
    const { service, store, checkout } = build({ task: { ...task, labels } });

    await service.create('i1');
    await settle(store);

    expect(checkout.mock.calls[0][0]).toHaveLength(MAX_REPOS_PER_PLAN);
  });

  it('plans without code when the task has no repositories', async () => {
    const { service, store, checkout } = build({
      task: { ...task, labels: [{ name: 'x', repoUrl: null }] },
    });

    await service.create('i1');
    await settle(store);

    expect(checkout).toHaveBeenCalledWith([]);
    expect(store[0].status).toBe('ready');
  });

  it('records the failure and still cleans up when the agent fails', async () => {
    const { service, store, dispose } = build({ runFails: true });

    await service.create('i1');
    await settle(store);

    expect(store[0].status).toBe('failed');
    expect(store[0].error).toBe('cli exploded');
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown task', async () => {
    const { service } = build({ task: null });
    await expect(service.create('nope')).rejects.toThrow(DomainError);
  });

  it('does not plan a task that belongs to a group: the plan is for the group', async () => {
    const { service, store } = build({ task: { ...task, groupId: 'group-1' } });

    await expect(service.create('i1')).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(store).toHaveLength(0);
  });

  it('refuses a second plan while one is being generated, but allows it afterwards', async () => {
    const { service, store } = build();
    store.push(Plan.create({ issueId: 'i1' }));

    await expect(service.create('i1')).rejects.toThrow(DomainError);

    service.kick();
    await settle(store);
    await expect(service.create('i1')).resolves.toBeDefined();
  });

  it('does not delete a plan in progress but deletes a finished one', async () => {
    const { service, store } = build();
    const active = Plan.create({ issueId: 'i1' });
    store.push(active);
    await expect(service.delete(active.id)).rejects.toThrow(DomainError);

    service.kick();
    await settle(store);
    await service.delete(active.id);
    expect(store).toHaveLength(0);
  });

  it('marks the plans left generating by a restart as failed', async () => {
    const { service, store } = build();
    const orphan = Plan.create({ issueId: 'i1' });
    orphan.markGenerating();
    store.push(orphan);

    expect(await service.recoverInterrupted()).toBe(1);
    expect(orphan.status).toBe('failed');
    expect(orphan.error).toContain('restart');
  });
});

describe('PlansService replanning', () => {
  const conversation = [
    {
      role: 'user' as const,
      content: 'Revisa también MEL-9, que dejé afuera.',
    },
    { role: 'assistant' as const, content: 'Lo reviso.' },
    { role: 'user' as const, content: 'Y no hace falta tocar el controlador.' },
  ];

  const promptOf = (runPlan: jest.Mock<unknown, [PlanRunRequest]>, call = 0) =>
    runPlan.mock.calls[call][0].prompt;

  it('updates the last ready plan with the conversation, and stores both on the new plan', async () => {
    const { service, store, runPlan } = build();
    const first = await service.create('i1');
    await settle(store);

    const revised = await service.create('i1', {}, { messages: conversation });
    await settle(store);

    expect(revised.conversation).toEqual(conversation);
    expect(revised.basedOnPlanId).toBe(first.id);
    expect(first.conversation).toBeNull();
    const prompt = promptOf(runPlan, 1);
    expect(prompt).toContain('## Plan anterior');
    expect(prompt).toContain('## Objetivo\nok');
    expect(prompt).toContain('Y no hace falta tocar el controlador.');
    // El historial queda: el plan anterior y el nuevo.
    expect(await service.listByIssue('i1')).toHaveLength(2);
  });

  it('only gives the agent the last plan, not the whole history', async () => {
    const { service, store, runPlan } = build();
    runPlan
      .mockResolvedValueOnce({
        markdown: 'PLAN-UNO',
        agentId: 'a',
        agentName: 'n',
        model: 'm',
      })
      .mockResolvedValueOnce({
        markdown: 'PLAN-DOS',
        agentId: 'a',
        agentName: 'n',
        model: 'm',
      });
    await service.create('i1');
    await settle(store);
    await service.create('i1');
    await settle(store);

    const revised = await service.create('i1', {}, { messages: conversation });
    await settle(store);

    const prompt = promptOf(runPlan, 2);
    expect(prompt).toContain('PLAN-DOS');
    expect(prompt).not.toContain('PLAN-UNO');
    expect(revised.basedOnPlanId).toBe((await service.listByIssue('i1'))[1].id);
  });

  it('ignores plans that failed when choosing the plan to start from', async () => {
    const { service, store, runPlan } = build();
    runPlan.mockResolvedValueOnce({
      markdown: 'PLAN-BUENO',
      agentId: 'a',
      agentName: 'n',
      model: 'm',
    });
    const good = await service.create('i1');
    await settle(store);
    runPlan.mockRejectedValueOnce(new Error('cli exploded'));
    await service.create('i1');
    await settle(store);

    const revised = await service.create('i1', {}, { messages: conversation });
    await settle(store);

    expect(revised.basedOnPlanId).toBe(good.id);
    expect(promptOf(runPlan, 2)).toContain('PLAN-BUENO');
  });

  it('plans from scratch with the conversation when there is no ready plan yet', async () => {
    const { service, store, runPlan } = build();

    const revised = await service.create('i1', {}, { messages: conversation });
    await settle(store);

    expect(revised.basedOnPlanId).toBeNull();
    expect(promptOf(runPlan)).toContain('No hay un plan anterior');
    expect(promptOf(runPlan)).toContain(
      'Y no hace falta tocar el controlador.',
    );
  });

  it('reads the tickets the user mentioned in the conversation', async () => {
    const { service, store, getTicket } = build();

    await service.create('i1', {}, { messages: conversation });
    await settle(store);

    expect(getTicket).toHaveBeenCalledWith('MEL-9');
  });

  it('replans without the previous plan if it was deleted while the replan was waiting', async () => {
    const { service, store, runPlan } = build();
    // Un plan en cola cuyo plan base ya no existe.
    store.push(
      Plan.create({
        issueId: 'i1',
        conversation,
        basedOnPlanId: crypto.randomUUID(),
      }),
    );

    service.kick();
    await settle(store);

    expect(store[0].status).toBe('ready');
    expect(promptOf(runPlan)).toContain('No hay un plan anterior');
    expect(promptOf(runPlan)).toContain(
      'Y no hace falta tocar el controlador.',
    );
  });

  it('needs something the user said to replan', async () => {
    const { service } = build();

    await expect(
      service.create('i1', {}, { messages: [] }),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      service.create(
        'i1',
        {},
        { messages: [{ role: 'assistant', content: 'hola' }] },
      ),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      service.create(
        'i1',
        {},
        { messages: [{ role: 'user', content: '   ' }] },
      ),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('still refuses to replan while a plan is being generated', async () => {
    const { service } = build();
    await service.create('i1');

    await expect(
      service.create('i1', {}, { messages: conversation }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe('PlansService replanning with attachments', () => {
  const ref = { id: 'a1', name: 'requisitos.pdf' };
  const conversation = [
    {
      role: 'user' as const,
      content: 'Usa este documento',
      attachments: [ref],
    },
  ];
  const promptOf = (runPlan: jest.Mock<unknown, [PlanRunRequest]>) =>
    runPlan.mock.calls[0][0].prompt;

  it('leaves the attachments in the directory of the plan, so the agent can read them', async () => {
    const { service, store, stage, runPlan } = build();
    stage.mockResolvedValueOnce(
      new Map([
        [
          'a1',
          {
            id: 'a1',
            name: 'requisitos.pdf',
            path: '.attachments/a1-requisitos.pdf',
            kind: 'pdf' as const,
            size: 4096,
          },
        ],
      ]),
    );

    await service.create('i1', {}, { messages: conversation });
    await settle(store);

    expect(stage).toHaveBeenCalledWith([ref], '/tmp/plan-x');
    expect(promptOf(runPlan)).toContain('`.attachments/a1-requisitos.pdf`');
  });

  it('does not stage anything for a normal plan', async () => {
    const { service, store, stage } = build();

    await service.create('i1');
    await settle(store);

    expect(stage).not.toHaveBeenCalled();
  });

  it('still generates the plan, saying the files are gone, when they could not be left in reach', async () => {
    const { service, store, stage, runPlan } = build();
    stage.mockRejectedValueOnce(new Error('disk full'));

    const plan = await service.create('i1', {}, { messages: conversation });
    await settle(store);

    expect((await service.get(plan.id)).status).toBe('ready');
    expect(promptOf(runPlan)).toContain(
      'requisitos.pdf: ya no está disponible',
    );
  });
});
