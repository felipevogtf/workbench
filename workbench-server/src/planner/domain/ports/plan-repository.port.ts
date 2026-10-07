import { Plan } from '@planner/domain/entities/plan.entity';
import { PlanStatus } from '@planner/domain/entities/plan.props';

export interface PlanRepositoryPort {
  findById(id: string): Promise<Plan | null>;
  /** Historial de una tarea, del más nuevo al más antiguo. */
  findByIssueId(issueId: string): Promise<Plan[]>;
  findByStatus(status: PlanStatus): Promise<Plan[]>;
  /** El plan en cola o generándose de una tarea, si lo hay. */
  findActiveByIssueId(issueId: string): Promise<Plan | null>;
  save(plan: Plan): Promise<Plan>;
  delete(id: string): Promise<void>;
  /**
   * Toma el siguiente plan `pending` y lo deja en `generating` en un solo paso, de modo que dos
   * workers nunca tomen el mismo. `null` si no hay ninguno.
   */
  claimNextPending(): Promise<Plan | null>;
}

export const PLAN_REPOSITORY_PORT = Symbol('PLAN_REPOSITORY_PORT');
