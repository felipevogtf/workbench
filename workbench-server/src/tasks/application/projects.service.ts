import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '@tasks/domain/ports/project-repository.port';
import { Project } from '@tasks/domain/entities/project.entity';
import {
  PROJECT_SOURCE_PORT,
  type ProjectSourcePort,
} from '@tasks/domain/ports/project-source.port';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PROJECT_SOURCE_PORT)
    private readonly projectSource: ProjectSourcePort,
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projectRepository: ProjectRepositoryPort,
  ) {}

  async createProject(data: { name: string }): Promise<Project> {
    const project = Project.createLocal({ name: data.name });
    await this.projectRepository.save(project);
    return project;
  }

  async updateProject(id: string, data: { name?: string }): Promise<Project> {
    const project = await this.getProject(id);
    if (data.name !== undefined) {
      project.rename(data.name);
    }
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
        existing.syncFromRemote(raw.name);
        await this.projectRepository.save(existing);
        updated++;
      } else {
        // 'plane' hardcodeado a propósito: hoy es la única fuente. El día que
        // se agregue un segundo IssueSourcePort/ProjectSourcePort (ej. Jira),
        // este es el punto exacto que necesita saber cuál de los dos llamó
        // a syncProjects() — ese dato hoy no existe en ningún lado.
        const project = Project.createFromExternal({
          name: raw.name,
          externalId: raw.externalId,
          source: 'plane',
        });
        await this.projectRepository.save(project);
        created++;
      }
    }

    return { created, updated };
  }

  async getAllProjects(): Promise<Project[]> {
    return this.projectRepository.findAll();
  }

  private async getProject(id: string): Promise<Project> {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new NotFoundException(`Project with id ${id} not found`);
    }
    return project;
  }
}
