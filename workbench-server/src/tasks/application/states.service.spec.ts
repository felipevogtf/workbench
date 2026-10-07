import { NotFoundException } from '@nestjs/common';
import { State } from '@tasks/domain/entities/state.entity';
import { StateRepositoryPort } from '@tasks/domain/ports/state-repository.port';
import { StatesService } from './states.service';

describe('StatesService', () => {
  const build = (states: State[]) => {
    const repository: StateRepositoryPort = {
      findById: (id) =>
        Promise.resolve(states.find((state) => state.id === id) ?? null),
      findAll: () => Promise.resolve(states),
      save: (state) => Promise.resolve(state),
      delete: () => Promise.resolve(),
    };
    return new StatesService(repository);
  };
  const make = (name: string, position: number) =>
    State.create({ name, position });

  it('puts a new state at the end when no position is given', async () => {
    const service = build([make('Todo', 0), make('Doing', 1)]);
    const state = await service.create({ name: 'Done' });
    expect(state.position).toBe(2);
  });

  it('reorders the states in the requested order', async () => {
    const [a, b, c] = [make('A', 0), make('B', 1), make('C', 2)];
    const service = build([a, b, c]);

    const result = await service.reorder([c.id, a.id, b.id]);

    expect(result.map((state) => state.name)).toEqual(['C', 'A', 'B']);
    expect([c.position, a.position, b.position]).toEqual([0, 1, 2]);
  });

  it('rejects an unknown state when reordering', async () => {
    const service = build([make('A', 0)]);
    await expect(service.reorder(['nope'])).rejects.toThrow(NotFoundException);
  });

  it('creates states as not final by default and lets them be marked final', async () => {
    const created = await build([]).create({ name: 'Hecho' });
    expect(created.isFinal).toBe(false);

    const service = build([created]);
    const updated = await service.update(created.id, { isFinal: true });
    expect(updated.isFinal).toBe(true);
  });
});
