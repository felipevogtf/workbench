import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '@core/api/api-error';
import { formatDay, formatHours } from '@shared/util/date';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Select, SelectOption } from '@shared/ui/select/select';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { Spinner } from '@shared/ui/spinner/spinner';
import { Tag } from '@shared/ui/tag/tag';
import { PriorityBadge } from '../../components/priority-badge/priority-badge';
import { HoursPanel } from '../../components/hours-panel/hours-panel';
import { PlanPanel } from '../../components/plan-panel/plan-panel';
import { PlansStore } from '../../data-access/plans.store';
import { IssueFormDialog } from '../../components/issue-form-dialog/issue-form-dialog';
import { TransferIssueDialog } from '../../components/transfer-issue-dialog/transfer-issue-dialog';
import { IssuesStore } from '../../data-access/issues.store';
import { LabelsStore } from '../../data-access/labels.store';
import { ProjectsStore } from '../../data-access/projects.store';
import { StatesStore } from '../../data-access/states.store';
import { TimeEntriesStore } from '../../data-access/time-entries.store';
import { Issue, issueCode, issuePlaneUrl } from '../../models/issue';

/** Detalle de una tarea (`/tasks/issues/:id`): datos, estado, etiquetas y horas registradas. */
@Component({
  selector: 'app-issue-detail-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeader,
    Button,
    Icon,
    IconButton,
    Alert,
    Badge,
    Card,
    Tag,
    Select,
    Skeleton,
    MarkdownViewer,
    PriorityBadge,
    IssueFormDialog,
    TransferIssueDialog,
    PlanPanel,
    HoursPanel,
    Spinner,
  ],
  providers: [TimeEntriesStore, PlansStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './issue-detail-page.html',
  styleUrl: './issue-detail-page.scss',
})
export class IssueDetailPage {
  /** Viene de la ruta (`withComponentInputBinding`). */
  readonly id = input.required<string>();
  /** Ruta de origen (`?volver=/kanban/<id>`): a dónde lleva el botón de volver. Solo se aceptan tableros. */
  readonly volver = input<string>();

  protected readonly store = inject(IssuesStore);
  protected readonly hours = inject(TimeEntriesStore);
  protected readonly plansStore = inject(PlansStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly projectsStore = inject(ProjectsStore);
  private readonly statesStore = inject(StatesStore);
  private readonly labelsStore = inject(LabelsStore);
  private readonly confirm = inject(ConfirmDialog);
  private readonly router = inject(Router);

  /** Dónde vuelve el botón «volver» y cómo se llama ese lugar. */
  protected readonly back = computed(() => {
    const from = this.volver();
    return from && /^\/kanban\/[\w-]+$/.test(from)
      ? { path: from, label: 'Tablero' }
      : { path: '/tasks/issues', label: 'Tareas' };
  });

  /** Enlace a la misma tarea en Plane (solo las que vienen de Plane). */
  protected readonly planeUrl = computed(() => {
    const issue = this.issue();
    return issue ? issuePlaneUrl(issue, this.project()) : null;
  });

  protected readonly formatDay = formatDay;
  protected readonly formatHours = formatHours;

  private readonly fetched = signal<Issue | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly editOpen = signal(false);
  protected readonly transferOpen = signal(false);

  protected readonly issue = computed(
    () => this.store.issueById().get(this.id()) ?? this.fetched(),
  );
  protected readonly project = computed(() =>
    this.projectsStore.projectById().get(this.issue()?.projectId ?? ''),
  );
  protected readonly state = computed(() =>
    this.statesStore.stateById().get(this.issue()?.stateId ?? ''),
  );
  protected readonly labels = computed(() =>
    (this.issue()?.labelIds ?? []).flatMap((id) => this.labelsStore.labelById().get(id) ?? []),
  );
  protected readonly code = computed(() => {
    const issue = this.issue();
    return issue ? issueCode(issue, this.project()?.identifier) : '';
  });

  protected readonly stateOptions = computed<SelectOption[]>(() =>
    this.statesStore.states().map((state) => ({ value: state.id, label: state.name })),
  );
  protected readonly stateControl = new FormControl('', { nonNullable: true });

  constructor() {
    void this.projectsStore.load();
    void this.statesStore.load();
    void this.labelsStore.load();

    effect(() => {
      const id = this.id();
      untracked(() => void this.open(id));
    });

    // El selector de estado refleja el de la tarea (también cuando cambia desde otra pantalla).
    effect(() => {
      const stateId = this.issue()?.stateId ?? '';
      untracked(() => this.stateControl.setValue(stateId, { emitEvent: false }));
    });
  }

  /** Pidiendo o generando un plan: el botón de IA espera. */
  protected readonly generating = computed(
    () => this.plansStore.requesting() || !!this.plansStore.active(),
  );

  /** Pide un plan con el agente por defecto del planificador y lleva la vista hasta él. */
  protected async generatePlan(): Promise<void> {
    await this.plansStore.generate();
    // El panel aparece al final en cuanto hay un plan; se espera a que se pinte para llegar a él.
    setTimeout(
      () => document.getElementById('plan-panel')?.scrollIntoView({ behavior: 'smooth' }),
      50,
    );
  }

  protected async changeState(stateId: string): Promise<void> {
    const issue = this.issue();
    if (!issue) return;
    const ok = await this.store.setState(issue.id, stateId || null);
    // Si falló, el selector vuelve al estado real de la tarea.
    if (!ok) this.stateControl.setValue(issue.stateId ?? '', { emitEvent: false });
  }

  protected toggleClosed(): void {
    const issue = this.issue();
    if (!issue) return;
    if (issue.closedAt) void this.store.reopen([issue.id]);
    else void this.store.close([issue.id]);
  }

  protected async transfer(targetId: string): Promise<void> {
    const issue = this.issue();
    if (!issue) return;
    const target = await this.store.transfer(issue.id, targetId);
    if (target) await this.router.navigate(['/tasks/issues', target.id]);
  }

  protected async remove(): Promise<void> {
    const issue = this.issue();
    if (!issue) return;
    const confirmed = await this.confirm.ask({
      title: 'Eliminar tarea',
      message: `¿Eliminar «${issue.name}»? También se borran sus horas registradas.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (confirmed && (await this.store.remove(issue.id))) {
      await this.router.navigateByUrl(this.back().path);
    }
  }

  private async open(id: string): Promise<void> {
    this.loadError.set(null);
    this.fetched.set(null);
    void this.hours.load(id);
    void this.plansStore.load(id, this.destroyRef);

    await this.store.load();
    if (this.store.issueById().has(id)) return;
    try {
      this.fetched.set(await this.store.find(id));
    } catch (error) {
      this.loadError.set(errorMessage(error));
    }
  }
}
