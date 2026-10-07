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
      repo_url: label.repoUrl,
    });
    return this.toDomain(savedLabel);
  }

  async delete(id: string): Promise<void> {
    // La FK de issue_labels hacia labels no tiene cascade: sin esto, borrar una
    // etiqueta en uso falla. Se quita primero de las tareas.
    await this.ormRepo.manager.query(
      'DELETE FROM "issue_labels" WHERE "label_id" = $1',
      [id],
    );
    await this.ormRepo.delete(id);
  }

  private toDomain(orm: LabelOrmEntity): Label {
    return Label.reconstruct({
      id: orm.id,
      name: orm.name,
      color: orm.color,
      repoUrl: orm.repo_url,
    });
  }
}
