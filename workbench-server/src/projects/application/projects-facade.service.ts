import { Injectable } from '@nestjs/common';
import {
  normalizeRepoName,
  Project,
} from '@projects/domain/entities/project.entity';
import { ProjectsService } from './projects.service';

/**
 * La puerta pública del módulo: los otros módulos no conocen su servicio ni sus repositorios, solo estas consultas.
 */
@Injectable()
export class ProjectsFacade {
  constructor(private readonly projects: ProjectsService) {}

  list(): Promise<Project[]> {
    return this.projects.list();
  }

  /** El proyecto de un repositorio (`organización/repo`), o `null` si no hay uno. */
  findByRepo(repo: string): Promise<Project | null> {
    return this.projects.findByRepo(repo);
  }

  /**
   * Los repositorios de estos proyectos (`org/repo`) con su nombre y enlace, en el mismo orden. Un repositorio sin
   * proyecto, o con un proyecto sin enlace, se omite: no hay de dónde clonarlo.
   */
  async linksFor(
    repos: readonly string[],
  ): Promise<{ repo: string; name: string; repoUrl: string }[]> {
    const projects = await this.projects.list();
    const byRepo = new Map(projects.map((project) => [project.repo, project]));
    return repos.flatMap((repo) => {
      const project = byRepo.get(normalizeRepoName(repo));
      return project?.repoUrl
        ? [{ repo: project.repo, name: project.name, repoUrl: project.repoUrl }]
        : [];
    });
  }

  /** Lo que se le muestra a un agente de los proyectos de estos repositorios (y de los que dependen), o `null`. */
  contextFor(repos: readonly string[]): Promise<string | null> {
    return this.projects.contextFor(repos);
  }
}
