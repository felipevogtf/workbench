import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '@core/api/api-error';
import { formatDay, formatHours, todayIso } from '@shared/util/date';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { FormField } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Select, SelectOption } from '@shared/ui/select/select';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { Tag } from '@shared/ui/tag/tag';
import { TextInput } from '@shared/ui/text-input/text-input';
import { PriorityBadge } from '../../components/priority-badge/priority-badge';
import { IssueFormDialog } from '../../components/issue-form-dialog/issue-form-dialog';
import { IssuesStore } from '../../data-access/issues.store';
import { LabelsStore } from '../../data-access/labels.store';
import { ProjectsStore } from '../../data-access/projects.store';
import { StatesStore } from '../../data-access/states.store';
import { TimeEntriesStore } from '../../data-access/time-entries.store';
import { Issue, issueNumber } from '../../models/issue';

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
    FormField,
    TextInput,
    Skeleton,
    MarkdownViewer,
    PriorityBadge,
    IssueFormDialog,
  ],
  providers: [TimeEntriesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './issue-detail-page.html',
  styleUrl: './issue-detail-page.scss',
})
export class IssueDetailPage {
  /** Viene de la ruta (`withComponentInputBinding`). */
  readonly id = input.required<string>();

  protected readonly store = inject(IssuesStore);
  protected readonly hours = inject(TimeEntriesStore);
  private readonly projectsStore = inject(ProjectsStore);
  private readonly statesStore = inject(StatesStore);
  private readonly labelsStore = inject(LabelsStore);
  private readonly confirm = inject(ConfirmDialog);
  private readonly router = inject(Router);

  protected readonly formatDay = formatDay;
  protected readonly formatHours = formatHours;

  private readonly fetched = signal<Issue | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly editOpen = signal(false);

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
  protected readonly number = computed(() => {
    const issue = this.issue();
    return issue ? issueNumber(issue) : 0;
  });

  protected readonly stateOptions = computed<SelectOption[]>(() =>
    this.statesStore.states().map((state) => ({ value: state.id, label: state.name })),
  );
  protected readonly stateControl = new FormControl('', { nonNullable: true });

  protected readonly hoursForm = inject(NonNullableFormBuilder).group({
    date: [todayIso(), Validators.required],
    hours: ['', [Validators.required, Validators.min(0.25), Validators.max(24)]],
  });
  protected readonly addingHours = signal(false);
  protected readonly hoursError = signal<string | null>(null);

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

  protected hoursInvalid(name: 'date' | 'hours'): boolean {
    const control = this.hoursForm.controls[name];
    return control.touched && control.invalid;
  }

  protected async changeState(stateId: string): Promise<void> {
    const issue = this.issue();
    if (!issue) return;
    const ok = await this.store.setState(issue.id, stateId || null);
    // Si falló, el selector vuelve al estado real de la tarea.
    if (!ok) this.stateControl.setValue(issue.stateId ?? '', { emitEvent: false });
  }

  protected async addHours(): Promise<void> {
    this.hoursError.set(null);
    if (this.hoursForm.invalid) {
      this.hoursForm.markAllAsTouched();
      return;
    }

    const { date, hours } = this.hoursForm.getRawValue();
    this.addingHours.set(true);
    try {
      await this.hours.add(Number(hours), date);
      this.hoursForm.patchValue({ hours: '' });
      this.hoursForm.controls.hours.markAsUntouched();
    } catch (error) {
      this.hoursError.set(errorMessage(error));
    } finally {
      this.addingHours.set(false);
    }
  }

  protected removeHours(id: string): void {
    void this.hours.remove(id);
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
      await this.router.navigate(['/tasks/issues']);
    }
  }

  private async open(id: string): Promise<void> {
    this.loadError.set(null);
    this.fetched.set(null);
    void this.hours.load(id);

    await this.store.load();
    if (this.store.issueById().has(id)) return;
    try {
      this.fetched.set(await this.store.find(id));
    } catch (error) {
      this.loadError.set(errorMessage(error));
    }
  }
}
