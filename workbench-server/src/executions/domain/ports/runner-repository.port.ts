import { Runner } from '../entities/runner.entity';

export interface RunnerRepositoryPort {
  findById(id: string): Promise<Runner | null>;
  findByTokenHash(tokenHash: string): Promise<Runner | null>;
  findAll(): Promise<Runner[]>;
  save(runner: Runner): Promise<Runner>;
  delete(id: string): Promise<void>;
}

export const RUNNER_REPOSITORY_PORT = Symbol('RUNNER_REPOSITORY_PORT');
