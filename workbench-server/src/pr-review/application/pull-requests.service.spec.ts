import { NotFoundException } from '@nestjs/common';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import {
  PullRequestSourcePort,
  PullRequestSourceResult,
} from '@pr-review/domain/ports/pull-request-source.port';
import { TicketsGatewayPort } from '@pr-review/domain/ports/tickets-gateway.port';
import { PullRequestsService } from './pull-requests.service';
import { ReviewsService } from './reviews.service';
import {
  fakeTickets,
  InMemoryPullRequestRepository,
  InMemoryReviewRepository,
  remotePullRequest,
} from './testing/fakes';

function build(
  results: Array<PullRequestSourceResult | Error>,
  ticketsOverrides: Partial<TicketsGatewayPort> = {},
) {
  const prs = new InMemoryPullRequestRepository();
  const reviews = new InMemoryReviewRepository();
  const queue = [...results];
  const source: PullRequestSourcePort = {
    provider: 'bitbucket',
    getReviewRequestedPullRequests: () => {
      const next = queue.shift();
      if (!next) throw new Error('no more results');
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next);
    },
  };
  const kick = jest.fn();
  const reviewsService = { kick } as unknown as ReviewsService;
  const tickets = fakeTickets(ticketsOverrides);
  const service = new PullRequestsService(
    prs,
    reviews,
    [source],
    tickets,
    reviewsService,
  );
  return { service, prs, kick, tickets };
}

const listing = (
  ids: string[],
  unreachableRepos: string[] = [],
): PullRequestSourceResult => ({
  pullRequests: ids.map((id) => remotePullRequest(id)),
  unreachableRepos,
});

describe('PullRequestsService.sync', () => {
  it('creates new pull requests as pending and wakes the queue', async () => {
    const { service, prs, kick } = build([listing(['1', '2'])]);

    const result = await service.sync();

    expect(result).toEqual({ created: 2, updated: 0, closed: 0 });
    expect([...prs.items.values()].map((pr) => pr.status)).toEqual([
      'pending',
      'pending',
    ]);
    expect(kick).toHaveBeenCalled();
  });

  it('does not duplicate a pull request that already exists', async () => {
    const { service, prs } = build([listing(['1']), listing(['1'])]);

    await service.sync();
    const second = await service.sync();

    expect(second).toEqual({ created: 0, updated: 1, closed: 0 });
    expect(prs.items.size).toBe(1);
  });

  it('flags a reviewed pull request as stale instead of re-reviewing it', async () => {
    const { service, prs } = build([listing(['1']), listing(['1'])]);
    await service.sync();
    const pr = [...prs.items.values()][0];
    pr.markReviewing();
    pr.markReviewed({ commit: pr.headCommit, docPath: 'a.md' });

    // Llega un commit nuevo.
    (service as unknown as { sources: PullRequestSourcePort[] }).sources = [
      {
        provider: 'bitbucket',
        getReviewRequestedPullRequests: () =>
          Promise.resolve({
            pullRequests: [
              { ...remotePullRequest('1'), headCommit: 'new-commit' },
            ],
            unreachableRepos: [],
          }),
      },
    ];
    await service.sync();

    expect(pr.status).toBe('reviewed');
    expect(pr.isStale).toBe(true);
  });

  it('closes open pull requests that are no longer listed', async () => {
    const { service, prs } = build([listing(['1', '2']), listing(['1'])]);
    await service.sync();

    const result = await service.sync();

    expect(result.closed).toBe(1);
    const byId = new Map([...prs.items.values()].map((p) => [p.externalId, p]));
    expect(byId.get('1')?.state).toBe('open');
    expect(byId.get('2')?.state).toBe('closed');
  });

  it('does not close pull requests of repos that could not be queried', async () => {
    const { service, prs } = build([listing(['1']), listing([], ['ws/app'])]);
    await service.sync();

    const result = await service.sync();

    expect(result.closed).toBe(0);
    expect([...prs.items.values()][0].state).toBe('open');
  });

  it('keeps everything untouched when the provider fails', async () => {
    const { service, prs } = build([
      listing(['1']),
      new Error('bitbucket down'),
    ]);
    await service.sync();

    const result = await service.sync();

    expect(result).toEqual({ created: 0, updated: 0, closed: 0 });
    expect([...prs.items.values()][0].state).toBe('open');
  });

  it('shares a sync that is already in flight', async () => {
    const { service } = build([listing(['1'])]);

    const [a, b] = await Promise.all([service.sync(), service.sync()]);

    expect(a).toBe(b);
  });
});

describe('PullRequestsService.sync with skipped pull requests', () => {
  it('does not queue a skipped pull request when it shows up again (it only reopens)', async () => {
    const { service, prs, kick } = build([listing(['1'])]);
    const now = new Date();
    const skipped = PullRequest.reconstruct({
      ...remotePullRequest('1'),
      ticketKeys: [],
      id: 'skipped-1',
      state: 'closed',
      status: 'skipped',
      queuedAt: now,
      requestedAgentId: null,
      requestedModel: null,
      lastReviewedAt: null,
      reviewDocUrl: null,
      reviewedCommit: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
    await prs.save(skipped);

    const result = await service.sync();

    expect(result).toEqual({ created: 0, updated: 1, closed: 0 });
    expect(skipped.state).toBe('open');
    expect(skipped.status).toBe('skipped');
    expect(await prs.claimNextPending()).toBeNull();
    expect(kick).toHaveBeenCalled();
  });
});

describe('PullRequestsService.findById', () => {
  it('throws NotFound when it does not exist', async () => {
    const { service } = build([]);

    await expect(service.findById('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PullRequestsService.sync with tickets', () => {
  const listingOf = (overrides: Parameters<typeof remotePullRequest>[2]) => ({
    pullRequests: [remotePullRequest('1', 'ws/app', overrides)],
    unreachableRepos: [],
  });

  it('detects the tickets of the branch and the description of a new pull request', async () => {
    const { service, prs } = build([
      listingOf({
        sourceBranch: 'feature/MEL-1/x',
        description: 'Tickets: SER-2',
      }),
    ]);

    await service.sync();

    expect([...prs.items.values()][0].ticketKeys).toEqual(['MEL-1', 'SER-2']);
  });

  it('updates the tickets when the description changes', async () => {
    const { service, prs } = build([
      listingOf({ description: 'MEL-1' }),
      listingOf({ description: 'MEL-1 y MEL-2' }),
    ]);

    await service.sync();
    await service.sync();

    expect([...prs.items.values()][0].ticketKeys).toEqual(['MEL-1', 'MEL-2']);
  });

  it('keeps the detected tickets when Plane does not answer', async () => {
    const getProjectIdentifiers = jest
      .fn()
      .mockResolvedValueOnce(['MEL'])
      .mockRejectedValueOnce(new Error('Plane down'));
    const { service, prs } = build(
      [
        listingOf({ description: 'MEL-1' }),
        listingOf({ description: 'MEL-1' }),
      ],
      { getProjectIdentifiers },
    );

    await service.sync();
    await service.sync();

    expect([...prs.items.values()][0].ticketKeys).toEqual(['MEL-1']);
  });

  it('stores the pull request without tickets when it has none', async () => {
    const { service, prs } = build([
      listingOf({ sourceBranch: 'fix/log-email' }),
    ]);

    await service.sync();

    expect([...prs.items.values()][0].ticketKeys).toEqual([]);
  });

  it('builds the link to a ticket through the gateway', () => {
    const { service } = build([]);

    expect(service.ticketUrl('MEL-253')).toBe(
      'https://plane.test/ws/browse/MEL-253/',
    );
  });
});
