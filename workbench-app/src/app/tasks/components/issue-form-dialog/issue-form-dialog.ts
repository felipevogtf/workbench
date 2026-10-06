import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { errorMessage } from '@core/api/api-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { ChipPicker, ChipOption } from '@shared/ui/chip-picker/chip-picker';
import { Dialog } from '@shared/ui/dialog/dialog';
import { FormField } from '@shared/ui/form-field/form-field';
import { Select, SelectOption } from '@shared/ui/select/select';
import { TextInput } from '@shared/ui/text-input/text-input';
import { Textarea } from '@shared/ui/textarea/textarea';
import { IssuesStore } from '../../data-access/issues.store';
import { LabelsStore } from '../../data-access/labels.store';
import { ProjectsStore } from '../../data-access/projects.store';
import { StatesStore } from '../../data-access/states.store';
import { Issue, IssueInput, PRIORITY_OPTIONS } from '../../models/issue';

/**
 * Crea o edita una tarea. En las de Plane el nombre, la descripción, la prioridad, las fechas y el
 * proyecto están bloqueados (los pisa el sync); el estado, las etiquetas y las horas estimadas sí
 * se editan aquí.
 */
@Component({
  selector: 'app-issue-form-dialog',
  imports: [
    ReactiveFormsModule,
    Dialog,
    FormField,
    TextInput,
    Textarea,
    Select,
    ChipPicker,
    Button,
    Alert,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './issue-form-dialog.html',
  styleUrl: './issue-form-dialog.scss',
})
export class IssueFormDialog {
  readonly open = model(false);
  /** La tarea a editar; `null` para crear una. */
  readonly issue = input<Issue | null>(null);
  /** Proyecto preseleccionado al crear. */
  readonly defaultProjectId = input<string | null>(null);

  readonly saved = output<Issue>();

  private readonly issues = inject(IssuesStore);
  private readonly projectsStore = inject(ProjectsStore);
  private readonly statesStore = inject(StatesStore);
  private readonly labelsStore = inject(LabelsStore);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    projectId: ['', Validators.required],
    description: [''],
    stateId: [''],
    priority: [''],
    startDate: [''],
    dueDate: [''],
    estimatedHours: [''],
  });
  protected readonly labelIds = signal<string[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly isEdit = computed(() => !!this.issue());
  /** Solo las tareas locales permiten editar lo que el sync de Plane sobrescribiría. */
  protected readonly remoteLocked = computed(() => this.issue()?.isLocal === false);

  protected readonly priorityOptions: SelectOption[] = [...PRIORITY_OPTIONS];
  protected readonly projectOptions = computed<SelectOption[]>(() =>
    this.projectsStore.projects().map((project) => ({ value: project.id, label: project.name })),
  );
  protected readonly stateOptions = computed<SelectOption[]>(() =>
    this.statesStore.states().map((state) => ({ value: state.id, label: state.name })),
  );
  protected readonly labelOptions = computed<ChipOption[]>(() =>
    this.labelsStore
      .labels()
      .map((label) => ({ value: label.id, label: label.name, color: label.color })),
  );

  constructor() {
    // Cada vez que se abre, el formulario parte de la tarea (o de valores vacíos al crear).
    effect(() => {
      if (!this.open()) return;
      const issue = this.issue();
      const projectId = this.defaultProjectId();
      untracked(() => this.fill(issue, projectId));
    });
  }

  protected invalid(name: 'name' | 'projectId'): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      const issue = this.issue();
      const saved = issue
        ? await this.issues.update(issue.id, this.patch(issue))
        : await this.issues.create(this.input());
      this.saved.emit(saved);
      this.open.set(false);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private fill(issue: Issue | null, defaultProjectId: string | null): void {
    this.form.reset({
      name: issue?.name ?? '',
      projectId: issue?.projectId ?? defaultProjectId ?? '',
      description: issue?.description ?? '',
      stateId: issue?.stateId ?? '',
      priority: issue?.priority ?? '',
      startDate: issue?.startDate ?? '',
      dueDate: issue?.dueDate ?? '',
      estimatedHours: issue?.estimatedHours?.toString() ?? '',
    });
    this.labelIds.set(issue ? [...issue.labelIds] : []);
    this.error.set(null);

    for (const name of [
      'name',
      'projectId',
      'description',
      'priority',
      'startDate',
      'dueDate',
    ] as const) {
      const control = this.form.controls[name];
      if (this.remoteLocked()) control.disable();
      else control.enable();
    }
  }

  /** Valores del formulario con los campos vacíos como `null`. */
  private input(): IssueInput {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      projectId: value.projectId,
      description: value.description.trim() || null,
      stateId: value.stateId || null,
      priority: value.priority || null,
      startDate: value.startDate || null,
      dueDate: value.dueDate || null,
      estimatedHours: value.estimatedHours === '' ? null : Number(value.estimatedHours),
      labelIds: this.labelIds(),
    };
  }

  /** Al editar solo se envía lo permitido (las de Plane rechazan el resto). */
  private patch(issue: Issue): Partial<IssueInput> {
    const { stateId, estimatedHours, labelIds } = this.input();
    return issue.isLocal ? this.input() : { stateId, estimatedHours, labelIds };
  }
}
