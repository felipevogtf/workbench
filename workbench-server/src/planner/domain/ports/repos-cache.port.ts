import { PlanRepoInfo } from '@planner/domain/entities/plan.props';

export interface CachedRepos {
  /** Directorio de trabajo del agente; cada repo usado está en una subcarpeta (`PlanRepoInfo.name`). */
  path: string;
  /** Un registro por repo pedido, usado o no. */
  repos: PlanRepoInfo[];
}

/**
 * Copias de los repos de una tarea que se conservan entre usos (a diferencia de `ReposCheckoutPort`,
 * que es desechable). Cada vez que se piden se actualizan con lo último de su rama principal.
 */
export interface ReposCachePort {
  ensure(issueId: string, repoUrls: string[]): Promise<CachedRepos>;
}

export const REPOS_CACHE_PORT = Symbol('REPOS_CACHE_PORT');
