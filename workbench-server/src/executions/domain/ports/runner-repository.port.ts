import { Runner } from '../entities/runner.entity';

export interface RunnerRepositoryPort {
  findById(id: string): Promise<Runner | null>;
  findByTokenHash(tokenHash: string): Promise<Runner | null>;
  findAll(): Promise<Runner[]>;
  save(runner: Runner): Promise<Runner>;
  /**
   * Anota que el runner dio señales (y, si se indica, quién dice ser). Solo actualiza: si el runner ya
   * no existe (lo revocaron) no lo vuelve a crear. Devuelve si existía.
   */
  markSeen(
    id: string,
    info?: { version?: string; host?: string },
  ): Promise<boolean>;
  /** Deja a este runner como el predeterminado y quita la marca a los demás. */
  makeDefault(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export const RUNNER_REPOSITORY_PORT = Symbol('RUNNER_REPOSITORY_PORT');
