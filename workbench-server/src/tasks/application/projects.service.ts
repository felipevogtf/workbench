import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../domain/ports/project-repository.port';
import { Project } from '../domain/entities/project.entity';
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

  async syncProjects(): Promise<{ created: number; updated: number }> {
    const remoteProjects = await this.projectSource.getProjects();

    let created = 0;
    let updated = 0;

    for (const raw of remoteProjects) {
      const existing = await this.projectRepository.findByExternalId(
        raw.externalId,
      );

      if (existing) {
        existing.rename(raw.name);
        existing.markAsSynced();
        await this.projectRepository.save(existing);
        updated++;
      } else {
        const project = Project.createFromExternal({
          name: raw.name,
          externalId: raw.externalId,
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
}
