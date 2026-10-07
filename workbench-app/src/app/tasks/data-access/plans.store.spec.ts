import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Toast } from '@shared/ui/toast/toast';
import { Plan, PlanStatus } from '../models/plan';
import { PlansStore } from './plans.store';
import { TasksApi } from './tasks.api';

function plan(id: string, status: PlanStatus, extra: Partial<Plan> = {}): Plan {
  return {
    id,
    issueId: 'i1',
    status,
    agentName: 'default-planner',
    model: 'm',
    repos: [],
    error: null,
    createdAt: '2026-10-06T12:00:00Z',
    updatedAt: '2026-10-06T12:00:00Z',
    ...extra,
  };
}

describe('PlansStore', () => {
  let api: Record<'listPlans' | 'getPlan' | 'createPlan' | 'deletePlan', ReturnType<typeof vi.fn>>;
  let store: PlansStore;
  let toast: Toast;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      listPlans: vi.fn(() => of([plan('b', 'ready'), plan('a', 'ready')])),
      getPlan: vi.fn((id: string) => of(plan(id, 'ready', { content: `# plan ${id}` }))),
      createPlan: vi.fn(),
      deletePlan: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [PlansStore, { provide: TasksApi, useValue: api }],
    });
    store = TestBed.inject(PlansStore);
    toast = TestBed.inject(Toast);
  });

  afterEach(() => {
    store.stopPolling();
    vi.useRealTimers();
  });

  it('shows the latest ready plan with its content', async () => {
    await store.load('i1');

    expect(store.viewed()?.id).toBe('b');
    expect(store.viewedContent()).toBe('# plan b');
    expect(api.getPlan).toHaveBeenCalledTimes(1);
  });

  it('shows another plan from the history and keeps the content it already fetched', async () => {
    await store.load('i1');

    await store.view('a');
    expect(store.viewedContent()).toBe('# plan a');

    await store.view('b');
    expect(store.viewedContent()).toBe('# plan b');
    expect(api.getPlan).toHaveBeenCalledTimes(2);
  });

  it('adds a requested plan to the top and follows it while it is active', async () => {
    await store.load('i1');
    api.createPlan.mockReturnValue(of(plan('c', 'pending')));

    await store.generate();

    expect(store.plans()[0].id).toBe('c');
    expect(store.active()?.id).toBe('c');
  });

  it('polls while a plan is active and shows it when it finishes', async () => {
    api.listPlans.mockReturnValue(of([plan('c', 'generating')]));
    await store.load('i1');
    expect(store.active()?.id).toBe('c');

    api.listPlans.mockReturnValue(of([plan('c', 'ready')]));
    api.getPlan.mockReturnValue(of(plan('c', 'ready', { content: '# listo' })));
    await vi.advanceTimersByTimeAsync(3100);

    expect(store.active()).toBeNull();
    expect(store.viewed()?.id).toBe('c');
    expect(store.viewedContent()).toBe('# listo');
  });

  it('reports a failed plan and stops polling', async () => {
    api.listPlans.mockReturnValue(of([plan('c', 'generating')]));
    await store.load('i1');

    api.listPlans.mockReturnValue(of([plan('c', 'failed', { error: 'cli exploded' })]));
    await vi.advanceTimersByTimeAsync(3100);
    const calls = api.listPlans.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000);

    expect(store.latestFailed()?.error).toBe('cli exploded');
    expect(api.listPlans.mock.calls.length).toBe(calls);
  });

  it('shows the backend message when it cannot create the plan', async () => {
    await store.load('i1');
    api.createPlan.mockReturnValue(
      throwError(() => new Error('Esta tarea ya tiene un plan en generación')),
    );

    await store.generate();

    expect(toast.messages()[0]).toMatchObject({
      tone: 'danger',
      message: 'Esta tarea ya tiene un plan en generación',
    });
  });

  it('removes a plan from the history', async () => {
    await store.load('i1');

    await store.remove('b');

    expect(store.plans().map((p) => p.id)).toEqual(['a']);
    expect(store.viewed()?.id).toBe('a');
  });
});
