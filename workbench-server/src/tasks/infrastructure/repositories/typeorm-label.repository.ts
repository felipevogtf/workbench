// tasks/infrastructure/repositories/typeorm-label.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LabelRepositoryPort } from '@tasks/domain/ports/label-repository.port';
import { Label } from '@tasks/domain/entities/label.entity';
import { LabelOrmEntity } from '@tasks/infrastructure/persistence/label.orm-entity';

@Injectable()
export class TypeOrmLabelRepository implements LabelRepositoryPort {
  constructor(
    @InjectRepository(LabelOrmEntity)
    private readonly ormRepo: Repository<LabelOrmEntity>,
  ) {}

  async findById(id: string): Promise<Label | null> {
    const orm = await this.ormRepo.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findByIds(ids: string[]): Promise<Label[]> {
    if (ids.length === 0) return [];
    const rows = await this.ormRepo.find({ where: { id: In(ids) } });
    return rows.map((r) => this.toDomain(r));
  }

  async findAll(): Promise<Label[]> {
    const rows = await this.ormRepo.find();
    return rows.map((r) => this.toDomain(r));
  }

  async save(label: Label): Promise<Label> {
    const savedLabel = await this.ormRepo.save({
      id: label.id,
      name: label.name,
      color: label.color,
    });
    return this.toDomain(savedLabel);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepo.delete(id);
  }

  private toDomain(orm: LabelOrmEntity): Label {
    return Label.reconstruct({
      id: orm.id,
      name: orm.name,
      color: orm.color,
    });
  }
}
