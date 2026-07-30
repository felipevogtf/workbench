import { State } from '@tasks/domain/entities/state.entity';

export interface StateRepositoryPort {
  findById(id: string): Promise<State | null>;
  findAll(): Promise<State[]>;
  save(state: State): Promise<State>;
  delete(id: string): Promise<void>;
}

export const STATE_REPOSITORY_PORT = Symbol('STATE_REPOSITORY_PORT');
