import { PlanRepoInfo } from '@planner/domain/entities/plan.props';

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
  checkout(repoUrls: string[]): Promise<ReposCheckout>;
}

export const REPOS_CHECKOUT_PORT = Symbol('REPOS_CHECKOUT_PORT');
