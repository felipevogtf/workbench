import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Toast } from '@shared/ui/toast/toast';
import { detail, execution, job } from '../testing/factories';
import { ExecutionStore } from './execution.store';
import { ExecutionsApi } from './executions.api';

describe('ExecutionStore', () => {
  let api: Record<'get' | 'logs' | 'cancel' | 'retry', ReturnType<typeof vi.fn>>;
  let store: ExecutionStore;
  let toast: Toast;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      get: vi.fn(() => of(detail('e1', 'completed', { jobs: [job('j1'), job('j2')] }))),
      logs: vi.fn((id: string) => of({ logs: `registro de ${id}`, status: 'done' })),
      cancel: vi.fn(() => of(execution('e1', 'cancelled'))),
      retry: vi.fn(() => of(execution('e1', 'running'))),
    };
    TestBed.configureTestingModule({
      providers: [ExecutionStore, { provide: ExecutionsApi, useValue: api }],
    });
    store = TestBed.inject(ExecutionStore);
    toast = TestBed.inject(Toast);
  });

  afterEach(() => {
    store.stopPolling();
    vi.useRealTimers();
  });

  it('loads the execution and shows the log of the last job', async () => {
    await store.load('e1');

    expect(api.get).toHaveBeenCalledWith('e1');
    expect(store.detail()?.id).toBe('e1');
    expect(store.selectedJob()?.id).toBe('j2');
    expect(store.logs()).toBe('registro de j2');
    expect(store.error()).toBeNull();
  });

  it('shows the log of another job when it is picked', async () => {
    await store.load('e1');

    await store.selectJob('j1');

    expect(store.selectedJob()?.id).toBe('j1');
    expect(store.logs()).toBe('registro de j1');
  });

  it('keeps showing what was picked while new jobs arrive', async () => {
    api.get.mockReturnValue(of(detail('e1', 'running', { jobs: [job('j1')] })));
    await store.load('e1');
    await store.selectJob('j1');

    api.get.mockReturnValue(of(detail('e1', 'running', { jobs: [job('j1'), job('j2')] })));
    await vi.advanceTimersByTimeAsync(3100);

    expect(store.selectedJob()?.id).toBe('j1');
  });

  it('polls while it runs, refreshing the log, and stops when it finishes', async () => {
    api.get.mockReturnValue(
      of(detail('e1', 'running', { jobs: [job('j1', { status: 'running' })] })),
    );
    await store.load('e1');
    expect(store.active()).toBe(true);

    api.logs.mockReturnValue(of({ logs: 'más registro', status: 'running' }));
    await vi.advanceTimersByTimeAsync(3100);
    expect(store.logs()).toBe('más registro');

    api.get.mockReturnValue(of(detail('e1', 'completed', { jobs: [job('j1')] })));
    await vi.advanceTimersByTimeAsync(3100);
    expect(store.active()).toBe(false);

    api.get.mockClear();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('shows why it could not load', async () => {
    api.get.mockReturnValue(throwError(() => new Error('Execution not found')));

    await store.load('e1');

    expect(store.error()).toContain('Execution not found');
    expect(store.detail()).toBeNull();
  });

  it('works without log when the log cannot be read', async () => {
    api.logs.mockReturnValue(throwError(() => new Error('boom')));

    await store.load('e1');

    expect(store.detail()?.id).toBe('e1');
    expect(store.logs()).toBe('');
  });

  it('cancels and shows the new state', async () => {
    api.get.mockReturnValue(of(detail('e1', 'running')));
    await store.load('e1');
    api.get.mockReturnValue(of(detail('e1', 'cancelled')));

    expect(await store.cancel()).toBe(true);

    expect(api.cancel).toHaveBeenCalledWith('e1');
    expect(store.detail()?.status).toBe('cancelled');
    expect(store.active()).toBe(false);
  });

  it('retries and starts following it again', async () => {
    api.get.mockReturnValue(of(detail('e1', 'failed')));
    await store.load('e1');
    api.get.mockReturnValue(of(detail('e1', 'running')));

    expect(await store.retry()).toBe(true);

    expect(api.retry).toHaveBeenCalledWith('e1');
    expect(store.active()).toBe(true);
  });

  it('tells the user when an action is refused', async () => {
    await store.load('e1');
    const error = vi.spyOn(toast, 'error');
    api.retry.mockReturnValue(
      throwError(() => new Error('Only a failed execution can be retried')),
    );

    expect(await store.retry()).toBe(false);

    expect(error).toHaveBeenCalled();
    expect(store.acting()).toBe(false);
  });
});
