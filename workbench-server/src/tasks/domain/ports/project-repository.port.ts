import { Project } from '@tasks/domain/entities/project.entity';

export interface ProjectRepositoryPort {
  findById(id: string): Promise<Project | null>;
  findByExternalId(externalId: string): Promise<Project | null>;
  findAll(): Promise<Project[]>;
  save(project: Project): Promise<void>;
  delete(id: string): Promise<void>;
}

export const PROJECT_REPOSITORY_PORT = Symbol('PROJECT_REPOSITORY_PORT');
