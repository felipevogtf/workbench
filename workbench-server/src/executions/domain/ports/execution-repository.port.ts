import { Execution } from '../entities/execution.entity';

export interface ExecutionRepositoryPort {
  findById(id: string): Promise<Execution | null>;
  /** Historial de una tarea, del más nuevo al más antiguo. */
  findByIssueId(issueId: string): Promise<Execution[]>;
  /** La ejecución en curso de una tarea, si la hay. */
  findActiveByIssueId(issueId: string): Promise<Execution | null>;
  save(execution: Execution): Promise<Execution>;
}

export const EXECUTION_REPOSITORY_PORT = Symbol('EXECUTION_REPOSITORY_PORT');
