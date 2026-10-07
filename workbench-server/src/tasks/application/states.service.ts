import { DomainError } from '@core/domain/domain.error';
import { Inject, Injectable } from '@nestjs/common';
import { State } from '@tasks/domain/entities/state.entity';
import {
  STATE_REPOSITORY_PORT,
  type StateRepositoryPort,
} from '@tasks/domain/ports/state-repository.port';

export interface CreateStateData {
  name: string;
  color?: string | null;
  // Sin posición, el estado queda al final.
  position?: number;
  isFinal?: boolean;
}

export type UpdateStateData = Partial<CreateStateData>;

@Injectable()
export class StatesService {
  constructor(
    @Inject(STATE_REPOSITORY_PORT)
    private readonly stateRepository: StateRepositoryPort,
  ) {}

  async findAll(): Promise<State[]> {
    const states = await this.stateRepository.findAll();
    return states.sort((a, b) => a.position - b.position);
  }

  async create(data: CreateStateData): Promise<State> {
    const position = data.position ?? (await this.nextPosition());
    const state = State.create({ ...data, position });
    await this.stateRepository.save(state);
    return state;
  }

  async update(id: string, data: UpdateStateData): Promise<State> {
    const existingState = await this.stateRepository.findById(id);
    if (!existingState) {
      throw DomainError.notFound(`State with id ${id} not found`);
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
    if (data.isFinal !== undefined) {
      existingState.markFinal(data.isFinal);
    }

    await this.stateRepository.save(existingState);
    return existingState;
  }

  // Deja los estados en el orden recibido (el orden de las columnas del
  // kanban). Los que no vengan en la lista conservan su posición relativa
  // al final.
  async reorder(ids: string[]): Promise<State[]> {
    const states = await this.findAll();
    const byId = new Map(states.map((state) => [state.id, state]));
    const unknown = ids.find((id) => !byId.has(id));
    if (unknown) {
      throw DomainError.notFound(`State with id ${unknown} not found`);
    }

    const requested = [...new Set(ids)].map((id) => byId.get(id) as State);
    const rest = states.filter((state) => !ids.includes(state.id));
    const ordered = [...requested, ...rest];

    for (const [index, state] of ordered.entries()) {
      if (state.position !== index) {
        state.moveTo(index);
        await this.stateRepository.save(state);
      }
    }
    return ordered;
  }

  async delete(id: string): Promise<void> {
    const state = await this.stateRepository.findById(id);
    if (!state) {
      throw DomainError.notFound(`State with id ${id} not found`);
    }
    return this.stateRepository.delete(id);
  }

  private async nextPosition(): Promise<number> {
    const states = await this.stateRepository.findAll();
    return states.reduce((max, state) => Math.max(max, state.position), -1) + 1;
  }
}
