import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';

export interface CachedRepository {
  /** Directorio con la rama de la PR en checkout. No se borra al terminar: se reutiliza. */
  path: string;
  /** Commit en que quedó (el último de la rama de la PR al momento de pedirlo). */
  commit: string;
}

/**
 * Copia local del repo de una PR que se conserva entre usos (a diferencia de `RepositoryCheckoutPort`,
 * que es desechable). Cada vez que se pide se actualiza con lo último que haya en el proveedor.
 */
export interface RepositoryCachePort {
  ensure(pullRequest: PullRequest): Promise<CachedRepository>;
}

export const REPOSITORY_CACHE_PORT = Symbol('REPOSITORY_CACHE_PORT');
