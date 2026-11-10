import { PlanRepoInfo } from '@planner/domain/entities/plan.props';

/** Claves de ticket (`MEL-466`) que la tarea menciona: sus ramas, si existen, se clonan aparte junto a cada repo. */
export interface ReposOptions {
  relatedKeys?: readonly string[];
}

export interface CachedRepos {
  /** Directorio de trabajo del agente; cada repo usado está en una subcarpeta (`PlanRepoInfo.name`). */
  path: string;
  /** Un registro por repo pedido, usado o no. */
  repos: PlanRepoInfo[];
}

/**
 * Copias de los repos de una tarea que se conservan entre usos (las usan el plan y el chat de la tarea). Cada vez que se piden se actualizan con lo último de su rama principal.
 */
export interface ReposCachePort {
  ensure(
    issueId: string,
    repoUrls: string[],
    options?: ReposOptions,
  ): Promise<CachedRepos>;
}

export const REPOS_CACHE_PORT = Symbol('REPOS_CACHE_PORT');
