import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';

export interface RepositoryCheckout {
  /** Directorio con la rama de la PR en checkout. */
  path: string;
  /** Commit que quedó en checkout (el último de la rama de la PR). */
  commit: string;
  /** Borra el directorio temporal. */
  dispose(): Promise<void>;
}

export interface RepositoryCheckoutPort {
  checkout(pullRequest: PullRequest): Promise<RepositoryCheckout>;
}

export const REPOSITORY_CHECKOUT_PORT = Symbol('REPOSITORY_CHECKOUT_PORT');
