import { DomainError } from '@core/domain/domain.error';
import { Inject, Injectable } from '@nestjs/common';
import {
  TASK_PROJECT_REPOSITORY_PORT,
  type TaskProjectRepositoryPort,
} from '@tasks/domain/ports/task-project-repository.port';
import { TaskProject } from '@tasks/domain/entities/task-project.entity';
import {
  PROJECT_SOURCE_PORT,
  type ProjectSourcePort,
} from '@tasks/domain/ports/project-source.port';

@Injectable()
export class TaskProjectsService {
  constructor(
    @Inject(PROJECT_SOURCE_PORT)
    private readonly projectSource: ProjectSourcePort,
    @Inject(TASK_PROJECT_REPOSITORY_PORT)
    private readonly projectRepository: TaskProjectRepositoryPort,
  ) {}

  async createProject(data: { name: string }): Promise<TaskProject> {
    const project = TaskProject.createLocal({ name: data.name });
    await this.projectRepository.save(project);
    return project;
  }

  async updateProject(
    id: string,
    data: { name?: string; syncEnabled?: boolean; visible?: boolean },
  ): Promise<TaskProject> {
    const project = await this.getProject(id);
    if (data.name !== undefined) {
      project.rename(data.name);
    }
    project.configure({
      syncEnabled: data.syncEnabled,
      visible: data.visible,
    });
    await this.projectRepository.save(project);
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    const project = await this.getProject(id);
    project.assertDeletable();
    await this.projectRepository.delete(id);
  }

  async syncProjects(): Promise<{ created: number; updated: number }> {
    const remoteProjects = await this.projectSource.getProjects();

    let created = 0;
    let updated = 0;

    for (const raw of remoteProjects) {
      const existing = await this.projectRepository.findByExternalId(
        raw.externalId,
      );

      if (existing) {
        existing.syncFromRemote(raw.name, raw.identifier);
        await this.projectRepository.save(existing);
        updated++;
      } else {
        // 'plane' hardcodeado a propósito: hoy es la única fuente. El día que
        // se agregue un segundo IssueSourcePort/ProjectSourcePort (ej. Jira),
        // este es el punto exacto que necesita saber cuál de los dos llamó
        // a syncProjects() — ese dato hoy no existe en ningún lado.
        const project = TaskProject.createFromExternal({
          name: raw.name,
          externalId: raw.externalId,
          source: 'plane',
          identifier: raw.identifier,
        });
        await this.projectRepository.save(project);
        created++;
      }
    }

    return { created, updated };
  }

  async getAllProjects(): Promise<TaskProject[]> {
    return this.projectRepository.findAll();
  }

  private async getProject(id: string): Promise<TaskProject> {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw DomainError.notFound(`Project with id ${id} not found`);
    }
    return project;
  }
}
