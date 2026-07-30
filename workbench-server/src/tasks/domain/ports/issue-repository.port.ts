import { Issue } from '@tasks/domain/entities/issue.entity';

export interface IssueRepositoryPort {
  findById(id: string): Promise<Issue | null>;
  findByExternalId(externalId: string): Promise<Issue | null>;
  findByProjectId(projectId: string): Promise<Issue[]>;
  findAll(): Promise<Issue[]>;
  save(issue: Issue): Promise<void>;
  delete(id: string): Promise<void>;
  nextLocalId(): Promise<number>;
}

export const ISSUE_REPOSITORY_PORT = Symbol('ISSUE_REPOSITORY_PORT');
