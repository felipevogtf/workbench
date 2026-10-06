import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import {
  GitProvider,
  PullRequestStatus,
} from '@pr-review/domain/entities/pull-request.props';

export interface PullRequestFilters {
  status?: PullRequestStatus;
  provider?: GitProvider;
  /** true = solo desactualizadas, false = solo al día. */
  stale?: boolean;
}

export interface PullRequestRepositoryPort {
  findById(id: string): Promise<PullRequest | null>;
  findByExternalKey(
    provider: GitProvider,
    repo: string,
    externalId: string,
  ): Promise<PullRequest | null>;
  findAll(filters: PullRequestFilters): Promise<PullRequest[]>;
  findOpenByProvider(provider: GitProvider): Promise<PullRequest[]>;
  /** PRs en un estado, de la más antigua a la más reciente en la cola. */
  findByStatus(status: PullRequestStatus): Promise<PullRequest[]>;
  /**
   * Toma la PR abierta más antigua en `pending` y la pasa a `reviewing` en una
   * sola operación atómica, de modo que dos workers nunca reciban la misma.
   */
  claimNextPending(): Promise<PullRequest | null>;
  save(pullRequest: PullRequest): Promise<PullRequest>;
}

export const PULL_REQUEST_REPOSITORY_PORT = Symbol(
  'PULL_REQUEST_REPOSITORY_PORT',
);
