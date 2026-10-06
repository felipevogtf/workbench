import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PullRequest, QueueSnapshot } from '../models/pull-request';
import { PullRequestsApi } from './pull-requests.api';
import { POLL_INTERVAL_MS, PullRequestsStore } from './pull-requests.store';

function pr(id: string, status: PullRequest['status']): PullRequest {
  return {
    id,
    provider: 'bitbucket',
    repo: 'ws/app',
    externalId: id,
    url: `https://example.test/${id}`,
    title: `PR ${id}`,
    author: 'Ana',
    sourceBranch: 'feature/x',
    destBranch: 'main',
    headCommit: 'abc12345',
    tickets: [],
    state: 'open',
    status,
    isStale: false,
    queuedAt: '2026-10-06T12:00:00Z',
    lastReviewedAt: null,
    reviewDocUrl: null,
    reviewedCommit: null,
    lastError: null,
    createdAt: '2026-10-06T12:00:00Z',
    updatedAt: '2026-10-06T12:00:00Z',
  };
}

const emptyQueue: QueueSnapshot = { concurrency: 1, activeWorkers: 0, reviewing: [], pending: [] };

describe('PullRequestsStore', () => {
  let api: {
    list: ReturnType<typeof vi.fn>;
    queue: ReturnType<typeof vi.fn>;
    sync: ReturnType<typeof vi.fn>;
    reReview: ReturnType<typeof vi.fn>;
  };
  let store: PullRequestsStore;

  beforeEach(() => {
    api = {
      list: vi.fn(() => of([pr('1', 'reviewed')])),
      queue: vi.fn(() => of(emptyQueue)),
      sync: vi.fn(() => of({ created: 2, updated: 1, closed: 0 })),
      reReview: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [{ provide: PullRequestsApi, useValue: api }] });
    store = TestBed.inject(PullRequestsStore);
  });

  it('loads the list and the queue together', async () => {
    await store.load();

    expect(store.pullRequests()).toHaveLength(1);
    expect(store.queue()).toEqual(emptyQueue);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('keeps the error message when loading fails', async () => {
    api.list.mockReturnValue(throwError(() => new Error('boom')));

    await store.load();

    expect(store.error()).toBe('boom');
    expect(store.loaded()).toBe(false);
  });

  it('reports active work only while something is pending or being reviewed', async () => {
    await store.load();
    expect(store.hasActiveWork()).toBe(false);

    api.list.mockReturnValue(of([pr('1', 'reviewed'), pr('2', 'pending')]));
    await store.load();
    expect(store.hasActiveWork()).toBe(true);

    api.list.mockReturnValue(of([pr('2', 'reviewed')]));
    await store.load();
    expect(store.hasActiveWork()).toBe(false);
  });

  it('sends the selected filters to the api', () => {
    store.setFilters({ status: 'failed', staleOnly: true });

    expect(api.list).toHaveBeenLastCalledWith({
      status: 'failed',
      provider: 'all',
      staleOnly: true,
    });
  });

  it('puts the pull request back as pending after a re-review request', async () => {
    await store.load();
    const queued = { ...pr('1', 'pending') };
    api.reReview.mockReturnValue(of(queued));
    api.list.mockReturnValue(of([queued]));

    const ok = await store.reReview(store.pullRequests()[0], { model: 'opus' });

    expect(ok).toBe(true);
    expect(api.reReview).toHaveBeenCalledWith('1', { model: 'opus' });
    expect(store.pullRequests()[0].status).toBe('pending');
  });

  it('hides skipped pull requests except in their own tab', async () => {
    const all = [pr('1', 'reviewed'), pr('2', 'skipped'), pr('3', 'pending')];
    api.list.mockImplementation((filters: { status: string }) =>
      of(filters.status === 'skipped' ? all.filter((p) => p.status === 'skipped') : all),
    );

    await store.load();
    expect(store.pullRequests().map((p) => p.id)).toEqual(['1', '3']);

    store.setFilters({ status: 'skipped' });
    await vi.waitFor(() => expect(store.pullRequests().map((p) => p.id)).toEqual(['2']));
  });

  describe('polling', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    function start(): () => void {
      let teardown: () => void = () => undefined;
      store.startPolling({
        onDestroy: (fn: () => void) => (teardown = fn),
      } as unknown as DestroyRef);
      return () => teardown();
    }

    it('refreshes while there is active work and stops when it ends', async () => {
      api.list.mockReturnValue(of([pr('1', 'reviewing')]));
      await store.load();
      const calls = api.list.mock.calls.length;
      const stop = start();

      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(api.list.mock.calls.length).toBe(calls + 1);

      api.list.mockReturnValue(of([pr('1', 'reviewed')]));
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(store.hasActiveWork()).toBe(false);

      const idleCalls = api.list.mock.calls.length;
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
      expect(api.list.mock.calls.length).toBe(idleCalls);
      stop();
    });

    it('does not poll when everything is finished', async () => {
      await store.load();
      const calls = api.list.mock.calls.length;
      const stop = start();

      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);

      expect(api.list.mock.calls.length).toBe(calls);
      stop();
    });
  });
});
