import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskProjectRepositoryPort } from '@tasks/domain/ports/task-project-repository.port';
import { TaskProject } from '@tasks/domain/entities/task-project.entity';
import { TaskProjectOrmEntity } from '@tasks/infrastructure/persistence/task-project.orm-entity';

@Injectable()
export class TypeOrmTaskProjectRepository implements TaskProjectRepositoryPort {
  constructor(
    @InjectRepository(TaskProjectOrmEntity)
    private readonly ormRepo: Repository<TaskProjectOrmEntity>,
  ) {}

  async findById(id: string): Promise<TaskProject | null> {
    const orm = await this.ormRepo.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findByExternalId(externalId: string): Promise<TaskProject | null> {
    const orm = await this.ormRepo.findOne({
      where: { external_id: externalId },
    });
    return orm ? this.toDomain(orm) : null;
  }

  async findAll(): Promise<TaskProject[]> {
    const ormEntities = await this.ormRepo.find();
    return ormEntities.map((orm) => this.toDomain(orm));
  }

  async save(project: TaskProject): Promise<void> {
    await this.ormRepo.save({
      id: project.id,
      name: project.name,
      external_id: project.externalId,
      source: project.source,
      identifier: project.identifier,
      sync_enabled: project.syncEnabled,
      visible: project.visible,
      default_project_repos: project.defaultProjectRepos,
      synced_at: project.syncedAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.ormRepo.delete(id);
  }

  private toDomain(orm: TaskProjectOrmEntity): TaskProject {
    return TaskProject.reconstruct({
      id: orm.id,
      name: orm.name,
      externalId: orm.external_id,
      source: orm.source,
      identifier: orm.identifier,
      syncEnabled: orm.sync_enabled,
      visible: orm.visible,
      defaultProjectRepos: orm.default_project_repos ?? [],
      syncedAt: orm.synced_at,
      createdAt: orm.created_at,
    });
  }
}
