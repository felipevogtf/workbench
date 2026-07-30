import { Inject, Injectable } from '@nestjs/common';
import { State } from '@tasks/domain/entities/state.entity';
import {
  STATE_REPOSITORY_PORT,
  type StateRepositoryPort,
} from '@tasks/domain/ports/state-repository.port';

export interface CreateStateData {
  name: string;
  color?: string | null;
  position: number;
}

export type UpdateStateData = Partial<CreateStateData>;

@Injectable()
export class StatesService {
  constructor(
    @Inject(STATE_REPOSITORY_PORT)
    private readonly stateRepository: StateRepositoryPort,
  ) {}

  async findAll(): Promise<State[]> {
    return this.stateRepository.findAll();
  }

  async create(data: CreateStateData): Promise<State> {
    const state = State.create(data);
    await this.stateRepository.save(state);
    return state;
  }

  async update(id: string, data: UpdateStateData): Promise<State> {
    const existingState = await this.stateRepository.findById(id);
    if (!existingState) {
      throw new Error(`State with id ${id} not found`);
    }

    if (data.name !== undefined) {
      existingState.rename(data.name);
    }
    if (data.color !== undefined) {
      existingState.recolor(data.color);
    }
    if (data.position !== undefined) {
      existingState.moveTo(data.position);
    }

    await this.stateRepository.save(existingState);
    return existingState;
  }

  async delete(id: string): Promise<void> {
    return this.stateRepository.delete(id);
  }
}
