import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { FormField } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { ChipOption, ChipPicker } from '@shared/ui/chip-picker/chip-picker';
import { SegmentedControl, SegmentOption } from '@shared/ui/segmented-control/segmented-control';
import { Select, SelectOption } from '@shared/ui/select/select';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { TextInput } from '@shared/ui/text-input/text-input';
import { IssueFormDialog } from '../../components/issue-form-dialog/issue-form-dialog';
import { IssueTable } from '../../components/issue-table/issue-table';
import { IssuesStore } from '../../data-access/issues.store';
import { LabelsStore } from '../../data-access/labels.store';
import { ProjectsStore } from '../../data-access/projects.store';
import { StatesStore } from '../../data-access/states.store';
import { Issue, IssueFilters } from '../../models/issue';

const PAGE_SIZE = 50;

const ORIGIN_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Todas las tareas' },
  { value: 'plane', label: 'De Plane' },
  { value: 'local', label: 'Locales' },
];

@Component({
  selector: 'app-issue-list-page',
  imports: [
    ReactiveFormsModule,
    PageHeader,
    Button,
    Icon,
    Alert,
    EmptyState,
    Skeleton,
    FormField,
    TextInput,
    Select,
    ChipPicker,
    SegmentedControl,
    IssueTable,
    IssueFormDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './issue-list-page.html',
  styleUrl: './issue-list-page.scss',
})
export class IssueListPage {
  protected readonly store = inject(IssuesStore);
  private readonly projectsStore = inject(ProjectsStore);
  private readonly statesStore = inject(StatesStore);
  private readonly labelsStore = inject(LabelsStore);
  private readonly confirm = inject(ConfirmDialog);

  protected readonly originOptions = ORIGIN_OPTIONS;
  protected readonly projectOptions = computed<SelectOption[]>(() => [
    { value: 'all', label: 'Todos los proyectos' },
    ...this.projectsStore.projects().map((project) => ({ value: project.id, label: project.name })),
  ]);
  /** Un botón por estado (más «Sin estado»), con el color del estado. */
  protected readonly stateChips = computed<ChipOption[]>(() => [
    ...this.statesStore
      .states()
      .map((state) => ({ value: state.id, label: state.name, color: state.color })),
    { value: 'none', label: 'Sin estado', color: null },
  ]);
  protected readonly viewOptions: SegmentOption[] = [
    { value: 'open', label: 'Abiertas' },
    { value: 'closed', label: 'Cerradas' },
  ];
  protected readonly labelOptions = computed<SelectOption[]>(() => [
    { value: 'all', label: 'Todas las etiquetas' },
    ...this.labelsStore.labels().map((label) => ({ value: label.id, label: label.name })),
  ]);

  protected readonly filterForm = inject(NonNullableFormBuilder).group({
    search: this.store.filters().search,
    projectId: this.store.filters().projectId,
    labelId: this.store.filters().labelId,
    origin: this.store.filters().origin,
  });

  protected readonly limit = signal(PAGE_SIZE);
  protected readonly visible = computed(() => this.store.filtered().slice(0, this.limit()));
  protected readonly hiddenCount = computed(
    () => this.store.filtered().length - this.visible().length,
  );

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Issue | null>(null);

  constructor() {
    void this.store.load();
    void this.projectsStore.load();
    void this.statesStore.load();
    void this.labelsStore.load();

    this.filterForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.store.setFilters(value as Partial<IssueFilters>);
      this.limit.set(PAGE_SIZE);
    });
  }

  protected setView(view: string): void {
    this.store.setFilters({ view: view as 'open' | 'closed' });
    this.limit.set(PAGE_SIZE);
  }

  protected setStateKeys(keys: string[]): void {
    this.store.setStateKeys(keys);
    this.limit.set(PAGE_SIZE);
  }

  /** Cierra (o reabre, en el historial) todas las tareas que se ven con los filtros actuales. */
  protected async bulkToggle(): Promise<void> {
    const issues = this.store.filtered();
    const closing = this.store.filters().view === 'open';
    const count = issues.length;
    const confirmed = await this.confirm.ask({
      title: closing ? 'Cerrar tareas' : 'Reabrir tareas',
      message: closing
        ? `Se cerrarán las ${count} tareas que ves ahora (pasan al historial; puedes reabrirlas desde «Cerradas»).`
        : `Se reabrirán las ${count} tareas que ves ahora, con el estado que tenían.`,
      confirmLabel: closing ? 'Cerrar' : 'Reabrir',
    });
    if (!confirmed) return;
    const ids = issues.map((issue) => issue.id);
    if (closing) await this.store.close(ids);
    else await this.store.reopen(ids);
  }

  protected toggleClosed(issue: Issue): void {
    if (issue.closedAt) void this.store.reopen([issue.id]);
    else void this.store.close([issue.id]);
  }

  protected clearFilters(): void {
    this.store.clearFilters();
    this.filterForm.reset(this.store.filters());
  }

  protected reload(): void {
    void this.store.load(true);
  }

  protected sync(): void {
    void this.store.sync();
  }

  protected showMore(): void {
    this.limit.update((limit) => limit + PAGE_SIZE);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(issue: Issue): void {
    this.editing.set(issue);
    this.formOpen.set(true);
  }

  protected async remove(issue: Issue): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Eliminar tarea',
      message: `¿Eliminar «${issue.name}»? También se borran sus horas registradas.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (confirmed) await this.store.remove(issue.id);
  }
}
