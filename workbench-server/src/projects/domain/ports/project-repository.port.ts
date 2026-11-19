import { Project } from '../entities/project.entity';

export interface ProjectRepositoryPort {
  /** Todos los proyectos. Son pocos: uno por repositorio. */
  findAll(): Promise<Project[]>;
  findById(id: string): Promise<Project | null>;
  findByRepo(repo: string): Promise<Project | null>;
  save(project: Project): Promise<Project>;
  delete(id: string): Promise<void>;
}

export const PROJECT_REPOSITORY_PORT = Symbol('PROJECT_REPOSITORY_PORT');
