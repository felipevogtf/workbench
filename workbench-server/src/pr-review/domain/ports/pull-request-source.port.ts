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
  /** La abrió el usuario del token (no es una que le pidieron revisar). */
  authoredByMe?: boolean;
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
  /** PRs abiertas donde el usuario es reviewer o autor. */
  getReviewRequestedPullRequests(): Promise<PullRequestSourceResult>;
  /**
   * Datos actuales de una PR concreta (título, descripción, commit…). Sirve para revisar con lo vigente
   * y no con lo que había en el último sync. null si el provider ya no la conoce.
   */
  getPullRequest(
    repo: string,
    externalId: string,
  ): Promise<RemotePullRequestData | null>;
  /** Diff unificado de la PR tal como lo entrega el provider. null si el provider ya no la conoce. */
  getDiff(repo: string, externalId: string): Promise<string | null>;
  /**
   * Contenido de un archivo en el último commit de la rama de la PR. null si el archivo (o la PR) ya
   * no existe en el provider.
   */
  getFile(
    repo: string,
    externalId: string,
    path: string,
  ): Promise<string | null>;
}

export const PULL_REQUEST_SOURCE_PORTS = Symbol('PULL_REQUEST_SOURCE_PORTS');
