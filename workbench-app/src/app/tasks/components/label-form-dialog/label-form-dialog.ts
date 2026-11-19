import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { type Project, ProjectsApi } from '@projects/index';
import { ColorInput } from '@shared/ui/color-input/color-input';
import { FormField } from '@shared/ui/form-field/form-field';
import { SaveDialog } from '@shared/ui/save-dialog/save-dialog';
import { Select, SelectOption } from '@shared/ui/select/select';
import { TextInput } from '@shared/ui/text-input/text-input';

export interface LabelFormValue {
  name: string;
  color: string | null;
  projectRepo: string | null;
}

/** Crea o edita una etiqueta: nombre, proyecto opcional (de él salen el repositorio y la receta) y color. */
@Component({
  selector: 'app-label-form-dialog',
  imports: [ReactiveFormsModule, SaveDialog, FormField, TextInput, ColorInput, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-save-dialog
      [(open)]="open"
      [heading]="heading()"
      [form]="form"
      [save]="submit"
      (opened)="reset()"
    >
      <div class="stack" [formGroup]="form">
        <app-form-field
          label="Nombre"
          for="label-name"
          required
          [error]="nameInvalid() ? 'Escribe un nombre' : null"
        >
          <app-text-input
            inputId="label-name"
            formControlName="name"
            [invalid]="nameInvalid()"
            [describedBy]="'label-name-msg'"
          />
        </app-form-field>
        <app-form-field
          label="Proyecto (opcional)"
          for="label-project"
          hint="Las tareas con esta etiqueta usan el repositorio y la receta de ese proyecto (rama principal). El enlace se cambia solo en el proyecto."
        >
          <app-select
            inputId="label-project"
            formControlName="projectRepo"
            placeholder="Sin proyecto"
            [options]="projectOptions()"
          />
        </app-form-field>
        <app-form-field
          label="Color"
          for="label-color"
          [hint]="initial() ? undefined : 'Si no eliges uno, se asigna un color al azar.'"
        >
          <app-color-input inputId="label-color" formControlName="color" />
        </app-form-field>
      </div>
    </app-save-dialog>
  `,
})
export class LabelFormDialog {
  private readonly projectsApi = inject(ProjectsApi);

  readonly open = model(false);
  readonly heading = input.required<string>();
  /** Valores iniciales al editar; `null` al crear. */
  readonly initial = input<{
    name: string;
    color?: string | null;
    projectRepo?: string | null;
  } | null>(null);
  readonly save = input.required<(value: LabelFormValue) => Promise<unknown>>();

  private readonly projects = signal<Project[]>([]);

  protected readonly projectOptions = computed<SelectOption[]>(() => {
    const options = this.projects().map((project) => ({
      value: project.repo,
      label: project.name === project.repo ? project.repo : `${project.name} (${project.repo})`,
    }));
    // Si el proyecto de la etiqueta ya no existe se sigue mostrando, para que no se pierda sin querer.
    const current = this.initial()?.projectRepo;
    return current && !options.some((option) => option.value === current)
      ? [...options, { value: current, label: `${current} (sin proyecto creado)` }]
      : options;
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    color: [null as string | null],
    projectRepo: [''],
  });

  protected readonly submit = (): Promise<unknown> => {
    const { name, color, projectRepo } = this.form.getRawValue();
    return this.save()({ name: name.trim(), color, projectRepo: projectRepo || null });
  };

  protected reset(): void {
    const initial = this.initial();
    this.form.reset({
      name: initial?.name ?? '',
      color: initial?.color ?? null,
      projectRepo: initial?.projectRepo ?? '',
    });
    // Sin la lista se puede seguir: solo no habrá proyectos que elegir.
    void firstValueFrom(this.projectsApi.list())
      .then((projects) => this.projects.set(projects))
      .catch(() => undefined);
  }

  protected nameInvalid(): boolean {
    const control = this.form.controls.name;
    return control.touched && control.invalid;
  }
}
