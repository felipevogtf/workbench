import { ConfigService } from '@nestjs/config';
import { DomainError } from '@core/domain/domain.error';
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
  diffs: string[] = [],
  files: Record<string, string> = {},
  settings: Record<string, string> = {},
) {
  const prs = new InMemoryPullRequestRepository();
  const reviews = new InMemoryReviewRepository();
  const queue = [...results];
  const source: PullRequestSourcePort = {
    provider: 'bitbucket',
    getPullRequest: () => Promise.resolve(null),
    getDiff: () => Promise.resolve(diffs.shift() ?? null),
    getFile: (_repo, _externalId, path) => Promise.resolve(files[path] ?? null),
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
    { get: (key: string) => settings[key] } as unknown as ConfigService,
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

  describe('the pull requests I opened', () => {
    const mixed = (): PullRequestSourceResult => ({
      pullRequests: [
        remotePullRequest('1'),
        remotePullRequest('2', 'ws/app', { authoredByMe: true }),
      ],
      unreachableRepos: [],
    });
    const statuses = (prs: InMemoryPullRequestRepository) =>
      [...prs.items.values()].map((pr) => [pr.externalId, pr.status]);

    it('are reviewed like any other by default', async () => {
      const { service, prs } = build([mixed()]);

      await service.sync();

      expect(statuses(prs)).toEqual([
        ['1', 'pending'],
        ['2', 'pending'],
      ]);
    });

    it('come in skipped, and are shown but not reviewed, when PR_REVIEW_OWN_PRS is skip', async () => {
      const { service, prs } = build(
        [mixed()],
        {},
        [],
        {},
        { PR_REVIEW_OWN_PRS: 'skip' },
      );

      await service.sync();

      expect(statuses(prs)).toEqual([
        ['1', 'pending'],
        ['2', 'skipped'],
      ]);
    });
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
        getPullRequest: () => Promise.resolve(null),
        getDiff: () => Promise.resolve(null),
        getFile: () => Promise.resolve(null),
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

  it('does not list closed pull requests', async () => {
    const { service } = build([listing(['1', '2']), listing(['1'])]);
    await service.sync();
    await service.sync();

    const listed = await service.findAll();

    expect(listed.map((p) => p.externalId)).toEqual(['1']);
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

    await expect(service.findById('nope')).rejects.toBeInstanceOf(DomainError);
  });
});

describe('PullRequestsService.getDiff', () => {
  it('returns the diff the provider gives for the pull request', async () => {
    const { service, prs } = build([listing(['1'])], {}, ['diff --git a b']);
    await service.sync();
    const [pr] = [...prs.items.values()];

    await expect(service.getDiff(pr.id)).resolves.toBe('diff --git a b');
  });

  it('throws NotFound when the provider no longer knows the pull request', async () => {
    const { service, prs } = build([listing(['1'])]);
    await service.sync();
    const [pr] = [...prs.items.values()];

    await expect(service.getDiff(pr.id)).rejects.toBeInstanceOf(DomainError);
  });

  it('throws NotFound when the pull request does not exist', async () => {
    const { service } = build([]);

    await expect(service.getDiff('nope')).rejects.toBeInstanceOf(DomainError);
  });
});

describe('PullRequestsService.getFile', () => {
  async function ready(files: Record<string, string>) {
    const harness = build([listing(['1'])], {}, [], files);
    await harness.service.sync();
    const [pr] = [...harness.prs.items.values()];
    return { ...harness, id: pr.id };
  }

  it('returns the file as the provider has it in the branch of the pull request', async () => {
    const { service, id } = await ready({ 'src/a.ts': 'const a = 1;\n' });

    await expect(service.getFile(id, 'src/a.ts')).resolves.toBe(
      'const a = 1;\n',
    );
  });

  it('throws NotFound when the file or the pull request does not exist', async () => {
    const { service, id } = await ready({});

    await expect(service.getFile(id, 'src/a.ts')).rejects.toBeInstanceOf(
      DomainError,
    );
    await expect(service.getFile('nope', 'src/a.ts')).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it.each([
    '',
    '/etc/passwd',
    '../secret',
    'src/../../x',
    'src//a.ts',
    './a.ts',
  ])('rejects the path %j, which could leave the repository', async (path) => {
    const { service, id } = await ready({ [path]: 'secret' });

    await expect(service.getFile(id, path)).rejects.toBeInstanceOf(DomainError);
  });

  it('does not show a file that is too large', async () => {
    const { service, id } = await ready({ 'big.sql': 'x'.repeat(2_000_001) });

    await expect(service.getFile(id, 'big.sql')).rejects.toBeInstanceOf(
      DomainError,
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
