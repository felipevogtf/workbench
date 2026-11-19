import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ProjectsApi, type Project } from '@projects/index';
import { TaskProjectsStore } from '@tasks/index';
import { Button } from '@shared/ui/button/button';
import { ChipOption, ChipPicker } from '@shared/ui/chip-picker/chip-picker';
import { Dialog } from '@shared/ui/dialog/dialog';
import { FormField } from '@shared/ui/form-field/form-field';
import { Select, SelectOption } from '@shared/ui/select/select';
import { TextInput } from '@shared/ui/text-input/text-input';
import { OrganizerStore } from '../../data-access/organizer.store';
import { MAX_SESSION_PROJECTS, OrganizerSession } from '../../models/organizer';

/**
 * Crea una sesión del organizador: un título y dónde se trabaja. Una sesión libre (sin ticket de Plane) elige los proyectos
 * (repositorios); una sesión que reúne tickets de Plane elige además el proyecto de tareas donde vive el grupo. Las tareas que
 * reúne se eligen después, en la pantalla de la sesión.
 */
@Component({
  selector: 'app-session-form-dialog',
  imports: [ReactiveFormsModule, Dialog, FormField, TextInput, Select, ChipPicker, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-form-dialog.html',
})
export class SessionFormDialog {
  readonly open = model(false);
  readonly created = output<OrganizerSession>();

  protected readonly store = inject(OrganizerStore);
  private readonly taskProjects = inject(TaskProjectsStore);
  private readonly projectsApi = inject(ProjectsApi);

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    projectId: [''],
  });

  protected readonly selectedRepos = signal<string[]>([]);
  private readonly repoProjects = signal<Project[]>([]);
  /** Se intentó crear: recién ahí se muestra lo que falta. */
  private readonly submitted = signal(false);

  protected readonly repoOptions = computed<ChipOption[]>(() =>
    this.repoProjects().map((project) => ({ value: project.repo, label: project.name })),
  );

  protected readonly projectOptions = computed<SelectOption[]>(() =>
    this.taskProjects.projects().map((project) => ({ value: project.id, label: project.name })),
  );

  /** Lo que falta para poder crear la sesión; `null` si está completa. */
  protected readonly projectsError = computed(() => {
    if (!this.submitted()) return null;
    if (this.selectedRepos().length > MAX_SESSION_PROJECTS) {
      return `Elige hasta ${MAX_SESSION_PROJECTS} proyectos`;
    }
    return this.hasPlace() ? null : 'Elige al menos un proyecto, o un proyecto de tareas';
  });

  private readonly projectIdValue = signal('');

  constructor() {
    void this.taskProjects.load();
    void this.loadRepoProjects();
    this.form.controls.projectId.valueChanges.subscribe((value) => this.projectIdValue.set(value));
    // Cada vez que se abre, el formulario parte limpio.
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.form.reset({ title: '', projectId: '' });
        this.projectIdValue.set('');
        this.selectedRepos.set([]);
        this.submitted.set(false);
      });
    });
  }

  protected invalid(name: 'title'): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    if (
      this.form.invalid ||
      !this.hasPlace() ||
      this.selectedRepos().length > MAX_SESSION_PROJECTS
    ) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, projectId } = this.form.getRawValue();
    const session = await this.store.create({
      title: title.trim(),
      ...(projectId ? { projectId } : {}),
      ...(this.selectedRepos().length > 0 ? { projectRepos: this.selectedRepos() } : {}),
    });
    if (!session) return;
    this.created.emit(session);
    this.open.set(false);
  }

  /** Una sesión necesita al menos un proyecto (repositorio) o un proyecto de tareas donde vivir. */
  private hasPlace(): boolean {
    return this.selectedRepos().length > 0 || this.projectIdValue() !== '';
  }

  private async loadRepoProjects(): Promise<void> {
    try {
      this.repoProjects.set(await firstValueFrom(this.projectsApi.list()));
    } catch {
      // Sin la lista se puede seguir eligiendo un proyecto de tareas.
    }
  }
}
