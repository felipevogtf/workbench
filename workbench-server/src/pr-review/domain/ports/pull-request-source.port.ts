import { GitProvider } from '@pr-review/domain/entities/pull-request.props';

export interface RemotePullRequestData {
  provider: GitProvider;
  /** `workspace/slug` (Bitbucket) u `owner/repo` (GitHub). */
  repo: string;
  externalId: string;
  url: string;
  title: string;
  author: string;
  sourceBranch: string;
  destBranch: string;
  headCommit: string;
  /** Descripción de la PR en el provider (texto/markdown). */
  description: string | null;
}

export interface PullRequestSourceResult {
  pullRequests: RemotePullRequestData[];
  /**
   * Repos que no se pudieron consultar. Sus PRs no deben darse por cerradas
   * solo porque no aparecieron en esta consulta.
   */
  unreachableRepos: string[];
}

export interface PullRequestSourcePort {
  readonly provider: GitProvider;
  /** PRs abiertas donde el usuario es reviewer. */
  getReviewRequestedPullRequests(): Promise<PullRequestSourceResult>;
}

export const PULL_REQUEST_SOURCE_PORTS = Symbol('PULL_REQUEST_SOURCE_PORTS');
