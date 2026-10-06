import { Issue } from '@tasks/domain/entities/issue.entity';

export interface IssueRepositoryPort {
  findById(id: string): Promise<Issue | null>;
  findByIds(ids: string[]): Promise<Issue[]>;
  findByExternalId(externalId: string): Promise<Issue | null>;
  findByProjectId(projectId: string): Promise<Issue[]>;
  findAll(): Promise<Issue[]>;
  save(issue: Issue): Promise<void>;
  delete(id: string): Promise<void>;
  // Asigna el siguiente número visible dentro de un proyecto (empieza en 1 por
  // proyecto). A diferencia del id (uuid, autogenerado por la entidad sin
  // tocar la base), este valor depende de leer el estado actual de la tabla
  // con control de concurrencia — por eso vive en el puerto, no en `Issue`.
  nextLocalSequence(projectId: string): Promise<number>;
}

export const ISSUE_REPOSITORY_PORT = Symbol('ISSUE_REPOSITORY_PORT');
