import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  output,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectsStore } from '@tasks/index';
import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';
import { FormField } from '@shared/ui/form-field/form-field';
import { Select, SelectOption } from '@shared/ui/select/select';
import { TextInput } from '@shared/ui/text-input/text-input';
import { OrganizerStore } from '../../data-access/organizer.store';
import { OrganizerSession } from '../../models/organizer';

/**
 * Crea una sesión del organizador: un título y el proyecto donde vivirá la tarea del grupo. Las tareas que reúne se eligen
 * después, en la pantalla de la sesión.
 */
@Component({
  selector: 'app-session-form-dialog',
  imports: [ReactiveFormsModule, Dialog, FormField, TextInput, Select, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-form-dialog.html',
})
export class SessionFormDialog {
  readonly open = model(false);
  readonly created = output<OrganizerSession>();

  protected readonly store = inject(OrganizerStore);
  private readonly projects = inject(ProjectsStore);

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    projectId: ['', Validators.required],
  });

  protected readonly projectOptions = computed<SelectOption[]>(() =>
    this.projects.projects().map((project) => ({ value: project.id, label: project.name })),
  );

  constructor() {
    void this.projects.load();
    // Cada vez que se abre, el formulario parte limpio y con el primer proyecto elegido.
    effect(() => {
      if (!this.open()) return;
      untracked(() =>
        this.form.reset({ title: '', projectId: this.projects.projects()[0]?.id ?? '' }),
      );
    });
  }

  protected invalid(name: 'title' | 'projectId'): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, projectId } = this.form.getRawValue();
    const session = await this.store.create({ title: title.trim(), projectId });
    if (!session) return;
    this.created.emit(session);
    this.open.set(false);
  }
}
