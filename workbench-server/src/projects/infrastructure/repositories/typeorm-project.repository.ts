import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '@projects/domain/entities/project.entity';
import { ProjectRepositoryPort } from '@projects/domain/ports/project-repository.port';
import { ProjectOrmEntity } from '@projects/infrastructure/persistence/project.orm-entity';

@Injectable()
export class TypeOrmProjectRepository implements ProjectRepositoryPort {
  constructor(
    @InjectRepository(ProjectOrmEntity)
    private readonly repository: Repository<ProjectOrmEntity>,
  ) {}

  async findAll(): Promise<Project[]> {
    return (await this.repository.find()).map((orm) => this.toDomain(orm));
  }

  async findById(id: string): Promise<Project | null> {
    const orm = await this.repository.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findByRepo(repo: string): Promise<Project | null> {
    const orm = await this.repository.findOne({ where: { repo } });
    return orm ? this.toDomain(orm) : null;
  }

  async save(project: Project): Promise<Project> {
    const saved = await this.repository.save({
      id: project.id,
      repo: project.repo,
      name: project.name,
      content: project.content,
      depends_on: [...project.dependsOn],
      main_branch: project.mainBranch,
      runner_environment: project.runnerEnvironment,
      architecture_rules: project.architectureRules,
      verify_command: project.verifyCommand,
    });
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  private toDomain(orm: ProjectOrmEntity): Project {
    return Project.reconstruct({
      id: orm.id,
      repo: orm.repo,
      name: orm.name || orm.repo.split('/')[1],
      content: orm.content,
      dependsOn: orm.depends_on ?? [],
      mainBranch: orm.main_branch,
      runnerEnvironment: orm.runner_environment,
      architectureRules: orm.architecture_rules,
      verifyCommand: orm.verify_command,
      createdAt: orm.created_at,
      updatedAt: orm.updated_at,
    });
  }
}
