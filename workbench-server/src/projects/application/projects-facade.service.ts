import { Injectable } from '@nestjs/common';
import { Project } from '@projects/domain/entities/project.entity';
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

  /** Lo que se le muestra a un agente de los proyectos de estos repositorios (y de los que dependen), o `null`. */
  contextFor(repos: readonly string[]): Promise<string | null> {
    return this.projects.contextFor(repos);
  }
}
