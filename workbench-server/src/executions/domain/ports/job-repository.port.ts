import { Job } from '../entities/job.entity';

export interface JobRepositoryPort {
  findById(id: string): Promise<Job | null>;
  /** Todos los trabajos de una ejecución, del más viejo al más nuevo. */
  findByExecutionId(executionId: string): Promise<Job[]>;
  /** Los trabajos que algún runner tiene en curso. */
  findRunning(): Promise<Job[]>;
  save(job: Job): Promise<Job>;
  /**
   * Toma el trabajo `pending` más antiguo y lo deja `running` a nombre del runner en un solo paso, de
   * modo que dos runners nunca tomen el mismo. `null` si no hay ninguno.
   */
  claimNext(runnerId: string): Promise<Job | null>;
}

export const JOB_REPOSITORY_PORT = Symbol('JOB_REPOSITORY_PORT');
