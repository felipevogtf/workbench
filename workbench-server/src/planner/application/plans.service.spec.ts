import { ConflictException, NotFoundException } from '@nestjs/common';
import { Plan } from '@planner/domain/entities/plan.entity';
import { PlanStatus } from '@planner/domain/entities/plan.props';
import { PlanRepositoryPort } from '@planner/domain/ports/plan-repository.port';
import { TaskContext } from '@planner/domain/ports/tasks-gateway.port';
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
    findByIssueId: (issueId) =>
      Promise.resolve(store.filter((p) => p.issueId === issueId)),
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
  const runPlan = jest.fn(() =>
    options.runFails
      ? Promise.reject(new Error('cli exploded'))
      : Promise.resolve({
          markdown: '## Objetivo\nok',
          agentId: 'a1',
          agentName: 'default-planner',
          model: 'm',
        }),
  );

  const service = new PlansService(
    repo,
    {
      getTask: () =>
        Promise.resolve(options.task === undefined ? task : options.task),
    },
    { runPlan },
    { checkout },
    {
      getProjectIdentifiers: () => Promise.resolve(['MEL']),
      getTicket: (key) =>
        Promise.resolve({
          key,
          title: 'Ticket',
          stateName: null,
          labels: [],
          priority: null,
          descriptionText: null,
        }),
    },
    1,
  );
  return { service, store, checkout, runPlan, dispose };
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
    await expect(service.create('nope')).rejects.toThrow(NotFoundException);
  });

  it('refuses a second plan while one is being generated, but allows it afterwards', async () => {
    const { service, store } = build();
    store.push(Plan.create({ issueId: 'i1' }));

    await expect(service.create('i1')).rejects.toThrow(ConflictException);

    service.kick();
    await settle(store);
    await expect(service.create('i1')).resolves.toBeDefined();
  });

  it('does not delete a plan in progress but deletes a finished one', async () => {
    const { service, store } = build();
    const active = Plan.create({ issueId: 'i1' });
    store.push(active);
    await expect(service.delete(active.id)).rejects.toThrow(ConflictException);

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
