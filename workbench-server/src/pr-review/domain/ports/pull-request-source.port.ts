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
  /**
   * Datos actuales de una PR concreta (título, descripción, commit…). Sirve para revisar con lo vigente
   * y no con lo que había en el último sync. null si el provider ya no la conoce.
   */
  getPullRequest(
    repo: string,
    externalId: string,
  ): Promise<RemotePullRequestData | null>;
}

export const PULL_REQUEST_SOURCE_PORTS = Symbol('PULL_REQUEST_SOURCE_PORTS');
