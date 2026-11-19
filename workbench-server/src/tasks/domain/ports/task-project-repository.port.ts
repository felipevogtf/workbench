import { TaskProject } from '@tasks/domain/entities/task-project.entity';

export interface TaskProjectRepositoryPort {
  findById(id: string): Promise<TaskProject | null>;
  findByExternalId(externalId: string): Promise<TaskProject | null>;
  findAll(): Promise<TaskProject[]>;
  save(project: TaskProject): Promise<void>;
  delete(id: string): Promise<void>;
}

export const TASK_PROJECT_REPOSITORY_PORT = Symbol(
  'TASK_PROJECT_REPOSITORY_PORT',
);
