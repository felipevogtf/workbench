import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@core/domain/domain.error';
import {
  normalizeRepoName,
  Project,
  type ProjectInput,
} from '@projects/domain/entities/project.entity';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '@projects/domain/ports/project-repository.port';
import {
  REPOSITORY_OPTIONS_PORT,
  type RepositoryOption,
  type RepositoryOptionsPort,
} from '@projects/domain/ports/repository-options.port';
import {
  REPOSITORY_MIRROR_PORT,
  type RepositoryMirrorPort,
} from '@projects/domain/ports/repository-mirror.port';
import { buildRecipeContext } from '@projects/domain/recipe-context';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    @Inject(REPOSITORY_OPTIONS_PORT)
    private readonly options: RepositoryOptionsPort,
    @Inject(REPOSITORY_MIRROR_PORT)
    private readonly mirrors: RepositoryMirrorPort,
  ) {}

  async list(): Promise<Project[]> {
    const all = await this.projects.findAll();
    // Por nombre (el que ve el usuario); el repositorio desempata.
    return all.sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'es') || a.repo.localeCompare(b.repo),
    );
  }

  /** Los repositorios a los que apuntan las etiquetas: de ahí se elige de qué repositorio es el proyecto. */
  repositories(): Promise<RepositoryOption[]> {
    return this.options.list();
  }

  /** El proyecto de un repositorio (`organización/repo`), o `null`. */
  findByRepo(repo: string): Promise<Project | null> {
    return this.projects.findByRepo(normalizeRepoName(repo));
  }

  async get(id: string): Promise<Project> {
    const project = await this.projects.findById(id);
    if (!project) {
      throw DomainError.notFound(`Project with id ${id} not found`);
    }
    return project;
  }

  async create(input: ProjectInput): Promise<Project> {
    const project = Project.create(input);
    if (await this.projects.findByRepo(project.repo)) {
      throw DomainError.conflict(
        `There is already a project for ${project.repo}`,
      );
    }
    return this.projects.save(project);
  }

  async update(
    id: string,
    changes: Partial<Omit<ProjectInput, 'repo'>>,
  ): Promise<Project> {
    const project = await this.get(id);
    const before = project.repoUrl;
    project.update(changes);
    const saved = await this.projects.save(project);
    if (saved.repoUrl !== before) {
      // El proyecto pasó a otro enlace (por ejemplo, de Bitbucket a GitHub): se prepara la copia nueva y se borra la vieja.
      if (saved.repoUrl) void this.mirrors.prepare(saved.repoUrl);
      if (before) await this.discardUnused(before);
    }
    return saved;
  }

  async remove(id: string): Promise<void> {
    const project = await this.get(id);
    await this.projects.delete(id);
    if (project.repoUrl) await this.discardUnused(project.repoUrl);
  }

  /** Borra la copia de un enlace que ningún proyecto usa ya. */
  private async discardUnused(repoUrl: string): Promise<void> {
    const inUse = (await this.projects.findAll()).some(
      (other) => other.repoUrl?.toLowerCase() === repoUrl.toLowerCase(),
    );
    if (!inUse) await this.mirrors.discard(repoUrl);
  }

  /**
   * Lo que se le muestra a un agente de las recetas de estos repositorios (y de los que dependen), o `null`
   * si ninguno tiene proyecto.
   */
  async contextFor(repos: readonly string[]): Promise<string | null> {
    if (repos.length === 0) return null;
    return buildRecipeContext(repos, await this.projects.findAll());
  }
}
