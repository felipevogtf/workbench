import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StateRepositoryPort } from '@tasks/domain/ports/state-repository.port';
import { State } from '@tasks/domain/entities/state.entity';
import { StateOrmEntity } from '@tasks/infrastructure/persistence/state.orm-entity';

@Injectable()
export class TypeOrmStateRepository implements StateRepositoryPort {
  constructor(
    @InjectRepository(StateOrmEntity)
    private readonly ormRepo: Repository<StateOrmEntity>,
  ) {}

  async findById(id: string): Promise<State | null> {
    const orm = await this.ormRepo.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findAll(): Promise<State[]> {
    const rows = await this.ormRepo.find({ order: { position: 'ASC' } });
    return rows.map((r) => this.toDomain(r));
  }

  async save(state: State): Promise<State> {
    const savedState = await this.ormRepo.save({
      id: state.id,
      name: state.name,
      color: state.color,
      position: state.position,
      is_final: state.isFinal,
    });

    return this.toDomain(savedState);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepo.delete(id);
  }

  private toDomain(orm: StateOrmEntity): State {
    return State.reconstruct({
      id: orm.id,
      name: orm.name,
      color: orm.color,
      position: orm.position,
      isFinal: orm.is_final,
    });
  }
}
