import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { Project, ProjectInput, RepositoryOption } from '../models/project';
import { ProjectsApi } from './projects.api';

/** Los proyectos, uno por repositorio, cada uno con su receta. */
@Injectable()
export class ProjectsStore {
  private readonly api = inject(ProjectsApi);
  private readonly toast = inject(Toast);

  private readonly items = signal<Project[]>([]);
  private readonly optionItems = signal<RepositoryOption[]>([]);
  private readonly loadingState = signal(false);
  private readonly loadedState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly projects = this.items.asReadonly();
  /** Los repositorios a los que apuntan las etiquetas, con los nombres de las etiquetas. */
  readonly options = this.optionItems.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Los repositorios que ya tienen proyecto. */
  readonly repos = computed(() => this.items().map((project) => project.repo));

  async load(): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const [projects, options] = await Promise.all([
        firstValueFrom(this.api.list()),
        // Sin las etiquetas se puede seguir: solo se pierde la ayuda para elegir el repositorio.
        firstValueFrom(this.api.repositories()).catch(() => [] as RepositoryOption[]),
      ]);
      this.items.set(projects);
      this.optionItems.set(options);
      this.loadedState.set(true);
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
  }

  /** Los nombres de las etiquetas que apuntan a ese repositorio; vacío si ninguna. */
  labelsOf(repo: string): string[] {
    return this.optionItems().find((option) => option.repo === repo.toLowerCase())?.labels ?? [];
  }

  /**
   * Crea el proyecto, o cambia el que ya tiene el repositorio. Si falla lanza el error, para que el diálogo de
   * edición lo muestre y siga abierto con lo que el usuario escribió.
   */
  async save(input: ProjectInput, existing: Project | null): Promise<Project> {
    const saved = existing
      ? await firstValueFrom(
          this.api.update(existing.id, {
            content: input.content,
            dependsOn: input.dependsOn,
            name: input.name,
            repoUrl: input.repoUrl,
            mainBranch: input.mainBranch,
            runnerEnvironment: input.runnerEnvironment,
            architectureRules: input.architectureRules,
            verifyCommand: input.verifyCommand,
          }),
        )
      : await firstValueFrom(this.api.create(input));
    this.items.update((list) =>
      existing
        ? list.map((project) => (project.id === saved.id ? saved : project))
        : [...list, saved].sort((a, b) => a.repo.localeCompare(b.repo)),
    );
    return saved;
  }

  async remove(project: Project): Promise<boolean> {
    try {
      await firstValueFrom(this.api.remove(project.id));
      this.items.update((list) => list.filter((item) => item.id !== project.id));
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }
}
