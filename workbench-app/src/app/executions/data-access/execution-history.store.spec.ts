import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { listItem } from '../testing/factories';
import { ExecutionHistoryStore } from './execution-history.store';
import { ExecutionsApi } from './executions.api';

describe('ExecutionHistoryStore', () => {
  let api: { listAll: ReturnType<typeof vi.fn> };
  let store: ExecutionHistoryStore;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      listAll: vi.fn(() =>
        of([listItem('c', 'running'), listItem('b', 'completed'), listItem('a', 'failed')]),
      ),
    };
    TestBed.configureTestingModule({
      providers: [ExecutionHistoryStore, { provide: ExecutionsApi, useValue: api }],
    });
    store = TestBed.inject(ExecutionHistoryStore);
  });

  afterEach(() => {
    store.stopPolling();
    vi.useRealTimers();
  });

  it('separates what is running from what already finished, keeping the order', async () => {
    await store.load();

    expect(store.running().map((e) => e.id)).toEqual(['c']);
    expect(store.finished().map((e) => e.id)).toEqual(['b', 'a']);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('keeps refreshing, so a running execution is seen finishing', async () => {
    await store.load();

    api.listAll.mockReturnValue(
      of([listItem('c', 'completed'), listItem('b', 'completed'), listItem('a', 'failed')]),
    );
    await vi.advanceTimersByTimeAsync(5100);

    expect(store.running()).toEqual([]);
    expect(store.finished().map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('sees an execution started from somewhere else', async () => {
    api.listAll.mockReturnValue(of([]));
    await store.load();

    api.listAll.mockReturnValue(of([listItem('n', 'running')]));
    await vi.advanceTimersByTimeAsync(5100);

    expect(store.running().map((e) => e.id)).toEqual(['n']);
  });

  it('keeps what it had when a refresh fails', async () => {
    await store.load();

    api.listAll.mockReturnValue(throwError(() => new Error('sin red')));
    await vi.advanceTimersByTimeAsync(5100);

    expect(store.executions()).toHaveLength(3);
    expect(store.error()).toBeNull();
  });

  it('says why it could not load', async () => {
    api.listAll.mockReturnValue(throwError(() => new Error('sin red')));

    await store.load();

    expect(store.error()).toContain('sin red');
    expect(store.loaded()).toBe(false);
  });

  it('stops refreshing when asked', async () => {
    await store.load();
    store.stopPolling();
    api.listAll.mockClear();

    await vi.advanceTimersByTimeAsync(20_000);

    expect(api.listAll).not.toHaveBeenCalled();
  });
});
