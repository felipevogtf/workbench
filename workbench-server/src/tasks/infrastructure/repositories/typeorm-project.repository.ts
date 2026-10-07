import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectRepositoryPort } from '@tasks/domain/ports/project-repository.port';
import { Project } from '@tasks/domain/entities/project.entity';
import { ProjectOrmEntity } from '@tasks/infrastructure/persistence/project.orm-entity';

@Injectable()
export class TypeOrmProjectRepository implements ProjectRepositoryPort {
  constructor(
    @InjectRepository(ProjectOrmEntity)
    private readonly ormRepo: Repository<ProjectOrmEntity>,
  ) {}

  async findById(id: string): Promise<Project | null> {
    const orm = await this.ormRepo.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findByExternalId(externalId: string): Promise<Project | null> {
    const orm = await this.ormRepo.findOne({
      where: { external_id: externalId },
    });
    return orm ? this.toDomain(orm) : null;
  }

  async findAll(): Promise<Project[]> {
    const ormEntities = await this.ormRepo.find();
    return ormEntities.map((orm) => this.toDomain(orm));
  }

  async save(project: Project): Promise<void> {
    await this.ormRepo.save({
      id: project.id,
      name: project.name,
      external_id: project.externalId,
      source: project.source,
      identifier: project.identifier,
      synced_at: project.syncedAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.ormRepo.delete(id);
  }

  private toDomain(orm: ProjectOrmEntity): Project {
    return Project.reconstruct({
      id: orm.id,
      name: orm.name,
      externalId: orm.external_id,
      source: orm.source,
      identifier: orm.identifier,
      syncedAt: orm.synced_at,
      createdAt: orm.created_at,
    });
  }
}
