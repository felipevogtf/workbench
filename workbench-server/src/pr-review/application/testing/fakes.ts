import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import { Review } from '@pr-review/domain/entities/review.entity';
import {
  PullRequestFilters,
  PullRequestRepositoryPort,
} from '@pr-review/domain/ports/pull-request-repository.port';
import { ReviewRepositoryPort } from '@pr-review/domain/ports/review-repository.port';
import { RemotePullRequestData } from '@pr-review/domain/ports/pull-request-source.port';
import { TicketsGatewayPort } from '@pr-review/domain/ports/tickets-gateway.port';
import {
  GitProvider,
  PullRequestStatus,
} from '@pr-review/domain/entities/pull-request.props';

/** Fakes en memoria de los puertos, para probar los casos de uso sin infraestructura. */

export class InMemoryPullRequestRepository implements PullRequestRepositoryPort {
  readonly items = new Map<string, PullRequest>();

  findById(id: string) {
    return Promise.resolve(this.items.get(id) ?? null);
  }

  findByExternalKey(provider: GitProvider, repo: string, externalId: string) {
    const found = [...this.items.values()].find(
      (pr) =>
        pr.provider === provider &&
        pr.repo === repo &&
        pr.externalId === externalId,
    );
    return Promise.resolve(found ?? null);
  }

  findAll(filters: PullRequestFilters) {
    return Promise.resolve(
      [...this.items.values()].filter(
        (pr) =>
          (!filters.status || pr.status === filters.status) &&
          (!filters.provider || pr.provider === filters.provider) &&
          (filters.stale === undefined || pr.isStale === filters.stale),
      ),
    );
  }

  findOpenByProvider(provider: GitProvider) {
    return Promise.resolve(
      [...this.items.values()].filter(
        (pr) => pr.provider === provider && pr.state === 'open',
      ),
    );
  }

  findByStatus(status: PullRequestStatus) {
    return Promise.resolve(
      [...this.items.values()]
        .filter((pr) => pr.status === status)
        .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime()),
    );
  }

  claimNextPending() {
    const next = [...this.items.values()]
      .filter((pr) => pr.status === 'pending' && pr.state === 'open')
      .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime())[0];

    if (!next) return Promise.resolve(null);
    next.markReviewing();
    return Promise.resolve(next);
  }

  save(pullRequest: PullRequest) {
    this.items.set(pullRequest.id, pullRequest);
    return Promise.resolve(pullRequest);
  }
}

export class InMemoryReviewRepository implements ReviewRepositoryPort {
  readonly items: Review[] = [];

  findById(id: string) {
    return Promise.resolve(this.items.find((r) => r.id === id) ?? null);
  }

  findByPullRequestId(pullRequestId: string) {
    return Promise.resolve(
      this.items.filter((r) => r.pullRequestId === pullRequestId),
    );
  }

  findLatestSuccessfulByPullRequestId(pullRequestId: string) {
    const ok = this.items.filter(
      (r) => r.pullRequestId === pullRequestId && r.status === 'ok',
    );
    return Promise.resolve(ok[ok.length - 1] ?? null);
  }

  save(review: Review) {
    if (!this.items.includes(review)) this.items.push(review);
    return Promise.resolve(review);
  }

  delete(id: string) {
    const index = this.items.findIndex((r) => r.id === id);
    if (index !== -1) this.items.splice(index, 1);
    return Promise.resolve();
  }
}

export function remotePullRequest(
  externalId: string,
  repo = 'ws/app',
  overrides: Partial<RemotePullRequestData> = {},
) {
  return {
    provider: 'bitbucket' as const,
    repo,
    externalId,
    url: `https://example.test/${externalId}`,
    title: `PR ${externalId}`,
    author: 'Ana',
    sourceBranch: `feature/${externalId}`,
    destBranch: 'main',
    headCommit: `commit-${externalId}`,
    description: null as string | null,
    ...overrides,
  };
}

/** Pasarela de tickets falsa: por defecto conoce los proyectos MEL y SER y no encuentra ningún ticket. */
export function fakeTickets(
  overrides: Partial<TicketsGatewayPort> = {},
): jest.Mocked<TicketsGatewayPort> {
  return {
    getProjectIdentifiers: jest.fn().mockResolvedValue(['MEL', 'SER']),
    getTicket: jest.fn().mockResolvedValue(null),
    ticketUrl: jest.fn((key: string) => `https://plane.test/ws/browse/${key}/`),
    ...overrides,
  } as jest.Mocked<TicketsGatewayPort>;
}

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitFor(
  condition: () => boolean,
  timeoutMs = 2000,
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timed out');
    }
    await sleep(2);
  }
}
