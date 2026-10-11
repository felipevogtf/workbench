import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';

export interface RepositoryCheckout {
  /** Directorio con la rama de la PR en checkout. */
  path: string;
  /** Commit que quedó en checkout (el último de la rama de la PR). */
  commit: string;
  /** Contenido de REVIEW_RULES.md (raíz del repo), o null si no existe: entonces se revisa sin reglas. */
  rules: string | null;
  /** Borra el directorio temporal. */
  dispose(): Promise<void>;
}

export interface RepositoryCheckoutPort {
  checkout(pullRequest: PullRequest): Promise<RepositoryCheckout>;
}

export const REPOSITORY_CHECKOUT_PORT = Symbol('REPOSITORY_CHECKOUT_PORT');
