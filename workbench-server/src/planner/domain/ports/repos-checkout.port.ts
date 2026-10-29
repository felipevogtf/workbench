import { PlanRepoInfo } from '@planner/domain/entities/plan.props';

/** Claves de ticket (`MEL-466`) que la tarea menciona: sus ramas, si existen, se clonan aparte junto a cada repo. */
export interface ReposOptions {
  relatedKeys?: readonly string[];
}

export interface ReposCheckout {
  /** Directorio de trabajo del agente; cada repo usado está en una subcarpeta (`PlanRepoInfo.name`). */
  path: string;
  /** Un registro por repo pedido, usado o no. */
  repos: PlanRepoInfo[];
  /** Borra el directorio temporal. */
  dispose(): Promise<void>;
}

export interface ReposCheckoutPort {
  /**
   * Clona (de solo lectura, superficial, rama `main` o si no `master`) los repos pedidos. Un repo que
   * no se pueda clonar no falla el conjunto: queda como no usado con su motivo. Sin repos devuelve
   * un directorio vacío.
   */
  checkout(repoUrls: string[], options?: ReposOptions): Promise<ReposCheckout>;
}

export const REPOS_CHECKOUT_PORT = Symbol('REPOS_CHECKOUT_PORT');
