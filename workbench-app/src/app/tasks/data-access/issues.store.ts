import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { SyncResult } from '../models/catalogs';
import {
  DEFAULT_ISSUE_FILTERS,
  Issue,
  IssueFilters,
  IssueInput,
  issueCode,
  issueNumber,
  stateKey,
} from '../models/issue';
import { ProjectsStore } from './projects.store';
import { StatesStore } from './states.store';
import { ResourceStore } from '@shared/util/resource-store';
import { TasksApi } from './tasks.api';

/**
 * `true` si la tarea cumple todos los filtros activos. En la vista `open` se ocultan las cerradas y
 * se aplican los estados elegidos; en `closed` solo se ven las cerradas (los estados no aplican).
 */
export function matchesFilters(
  issue: Issue,
  filters: IssueFilters,
  projectName: string,
  code = '',
  activeStates: ReadonlySet<string> = new Set(),
): boolean {
  if (filters.view === 'closed') {
    if (issue.closedAt === null) return false;
  } else if (issue.closedAt !== null || !activeStates.has(stateKey(issue))) {
    return false;
  }

  if (filters.projectId !== 'all' && issue.projectId !== filters.projectId) return false;
  if (filters.labelId !== 'all' && !issue.labelIds.includes(filters.labelId)) return false;
  if (filters.origin !== 'all' && issue.isLocal !== (filters.origin === 'local')) return false;

  const search = filters.search.trim().toLowerCase();
  if (!search) return true;
  return `${issue.name} ${projectName} ${code} #${issueNumber(issue)}`
    .toLowerCase()
    .includes(search);
}

/** Tareas del workbench (locales y traídas de Plane) y sus filtros. */
@Injectable({ providedIn: 'root' })
export class IssuesStore extends ResourceStore<Issue> {
  private readonly api = inject(TasksApi);
  private readonly toast = inject(Toast);
  private readonly projectsStore = inject(ProjectsStore);
  private readonly statesStore = inject(StatesStore);

  private readonly filtersState = signal<IssueFilters>(DEFAULT_ISSUE_FILTERS);
  private readonly syncingState = signal(false);

  readonly filters = this.filtersState.asReadonly();
  readonly syncing = this.syncingState.asReadonly();
  /** Todas las tareas, también las de proyectos ocultos (para contarlas o resolverlas por id). */
  readonly allIssues = this.items.asReadonly();
  /** Las de proyectos visibles: lo que muestran los listados y los selectores de tareas. */
  readonly issues = computed(() => {
    const hidden = this.projectsStore.hiddenIds();
    return this.items().filter((issue) => !hidden.has(issue.projectId));
  });
  readonly issueById = computed(() => new Map(this.items().map((issue) => [issue.id, issue])));
  /** Por id, solo las de proyectos visibles (el tablero de Kanban no muestra las ocultas). */
  readonly visibleIssueById = computed(
    () => new Map(this.issues().map((issue) => [issue.id, issue])),
  );

  /** Estados que se muestran: los elegidos o, por defecto, todos menos los finalizados. */
  readonly activeStateKeys = computed<ReadonlySet<string>>(() => {
    const chosen = this.filtersState().stateKeys;
    if (chosen) return new Set(chosen);
    return new Set([
      'none',
      ...this.statesStore
        .states()
        .filter((state) => !state.isFinal)
        .map((state) => state.id),
    ]);
  });

  /** Las que cumplen los filtros, por proyecto y de la más nueva a la más antigua. */
  readonly filtered = computed(() => {
    const filters = this.filtersState();
    const active = this.activeStateKeys();
    const projects = this.projectsStore.projectById();
    const nameOf = (issue: Issue) => projects.get(issue.projectId)?.name ?? '';

    return this.issues()
      .filter((issue) =>
        matchesFilters(
          issue,
          filters,
          nameOf(issue),
          issueCode(issue, projects.get(issue.projectId)?.identifier),
          active,
        ),
      )
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'es') || issueNumber(b) - issueNumber(a));
  });

  readonly hasFilters = computed(() => {
    const filters = this.filtersState();
    return (Object.keys(DEFAULT_ISSUE_FILTERS) as (keyof IssueFilters)[]).some(
      (key) => filters[key] !== DEFAULT_ISSUE_FILTERS[key],
    );
  });

  protected fetchAll() {
    return this.api.listIssues();
  }

  setFilters(patch: Partial<IssueFilters>): void {
    this.filtersState.update((filters) => ({ ...filters, ...patch }));
  }

  setStateKeys(keys: string[]): void {
    this.setFilters({ stateKeys: keys });
  }

  /** Cierra tareas (pasan al historial) y refleja el cambio en la lista. */
  async close(ids: string[]): Promise<number> {
    return this.changeClosed(ids, true);
  }

  /** Reabre tareas cerradas; vuelven con el estado que tenían. */
  async reopen(ids: string[]): Promise<number> {
    return this.changeClosed(ids, false);
  }

  private async changeClosed(ids: string[], closed: boolean): Promise<number> {
    if (ids.length === 0) return 0;
    try {
      const { updated } = await firstValueFrom(
        closed ? this.api.closeIssues(ids) : this.api.reopenIssues(ids),
      );
      const closedAt = closed ? new Date().toISOString() : null;
      const changed = new Set(ids);
      this.items.update((list) =>
        list.map((issue) => (changed.has(issue.id) ? { ...issue, closedAt } : issue)),
      );
      this.toast.success(
        `${updated} ${updated === 1 ? 'tarea' : 'tareas'} ${closed ? 'cerrada' : 'reabierta'}${updated === 1 ? '' : 's'}`,
      );
      return updated;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return 0;
    }
  }

  clearFilters(): void {
    this.filtersState.set(DEFAULT_ISSUE_FILTERS);
  }

  /** La de la lista si ya está cargada; si no, la pide (enlace directo al detalle). */
  async find(id: string): Promise<Issue> {
    return this.issueById().get(id) ?? firstValueFrom(this.api.getIssue(id));
  }

  /** Lanzan el error al llamador: el formulario lo muestra junto a los campos. */
  async create(input: IssueInput): Promise<Issue> {
    const created = await firstValueFrom(this.api.createIssue(input));
    this.add(created);
    return created;
  }

  async update(id: string, patch: Partial<IssueInput>): Promise<Issue> {
    const updated = await firstValueFrom(this.api.updateIssue(id, patch));
    this.replaceOrAdd(updated);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.deleteIssue(id));
      this.drop(id);
      this.toast.success('Tarea eliminada');
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }

  /** Cambia el estado desde una lista o el detalle; avisa si falla. */
  async setState(id: string, stateId: string | null): Promise<boolean> {
    try {
      await this.update(id, { stateId });
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }

  /**
   * Refleja un cambio de estado que el servidor ya hizo por otro camino (mover una tarjeta del
   * kanban cambia el estado de la tarea) sin volver a pedir la lista.
   */
  applyState(id: string, stateId: string | null): void {
    const issue = this.issueById().get(id);
    if (issue) this.replace({ ...issue, stateId });
  }

  /** Trae de Plane los proyectos y las tareas, y refresca las listas. */
  async sync(): Promise<SyncResult | null> {
    this.syncingState.set(true);
    try {
      const result = await firstValueFrom(this.api.sync());
      await Promise.all([this.load(true), this.projectsStore.load(true)]);
      this.toast.success(syncSummary(result));
      return result;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return null;
    } finally {
      this.syncingState.set(false);
    }
  }

  private replaceOrAdd(issue: Issue): void {
    if (this.issueById().has(issue.id)) this.replace(issue);
    else this.add(issue);
  }
}

export function syncSummary(result: SyncResult): string {
  const { projects, issues, failedProjects } = result;
  const base = `Plane sincronizado: ${issues.created} tareas nuevas, ${issues.updated} actualizadas, ${projects.created} proyectos nuevos`;
  return failedProjects.length > 0
    ? `${base}. Fallaron ${failedProjects.length} proyecto(s)`
    : base;
}
