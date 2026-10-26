import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Toast } from '@shared/ui/toast/toast';
import { execution } from '../testing/factories';
import { ExecutionsApi } from './executions.api';
import { IssueExecutionsStore } from './issue-executions.store';

describe('IssueExecutionsStore', () => {
  let api: Record<'listByIssue' | 'start', ReturnType<typeof vi.fn>>;
  let store: IssueExecutionsStore;
  let toast: Toast;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      listByIssue: vi.fn(() => of([execution('b', 'completed'), execution('a', 'failed')])),
      start: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [IssueExecutionsStore, { provide: ExecutionsApi, useValue: api }],
    });
    store = TestBed.inject(IssueExecutionsStore);
    toast = TestBed.inject(Toast);
  });

  afterEach(() => {
    store.stopPolling();
    vi.useRealTimers();
  });

  it('lists the executions of the task, newest first, with the latest on top', async () => {
    await store.load('i1');

    expect(api.listByIssue).toHaveBeenCalledWith('i1');
    expect(store.executions().map((e) => e.id)).toEqual(['b', 'a']);
    expect(store.latest()?.id).toBe('b');
    expect(store.active()).toBeNull();
  });

  it('does not poll when nothing is running', async () => {
    await store.load('i1');
    api.listByIssue.mockClear();

    await vi.advanceTimersByTimeAsync(10_000);

    expect(api.listByIssue).not.toHaveBeenCalled();
  });

  it('adds a started execution to the top and follows it', async () => {
    await store.load('i1');
    api.start.mockReturnValue(of(execution('c', 'running')));

    const started = await store.start();

    expect(started?.id).toBe('c');
    expect(store.executions()[0].id).toBe('c');
    expect(store.active()?.id).toBe('c');
    expect(store.starting()).toBe(false);
  });

  it('polls while one is running and stops when it finishes', async () => {
    api.listByIssue.mockReturnValue(of([execution('c', 'running')]));
    await store.load('i1');
    expect(store.active()?.id).toBe('c');

    api.listByIssue.mockReturnValue(of([execution('c', 'completed')]));
    await vi.advanceTimersByTimeAsync(3100);
    expect(store.active()).toBeNull();

    api.listByIssue.mockClear();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.listByIssue).not.toHaveBeenCalled();
  });

  it('keeps what it had when a poll fails', async () => {
    api.listByIssue.mockReturnValue(of([execution('c', 'running')]));
    await store.load('i1');

    api.listByIssue.mockReturnValue(throwError(() => new Error('sin red')));
    await vi.advanceTimersByTimeAsync(3100);

    expect(store.active()?.id).toBe('c');
  });

  it('says why the server refused to start and returns null', async () => {
    await store.load('i1');
    const error = vi.spyOn(toast, 'error');
    api.start.mockReturnValue(throwError(() => new Error('The task has no repository')));

    expect(await store.start()).toBeNull();
    expect(error).toHaveBeenCalled();
    expect(store.executions()).toHaveLength(2);
    expect(store.starting()).toBe(false);
  });

  it('does nothing when it was never loaded for a task', async () => {
    expect(await store.start()).toBeNull();
    expect(api.start).not.toHaveBeenCalled();
  });
});
