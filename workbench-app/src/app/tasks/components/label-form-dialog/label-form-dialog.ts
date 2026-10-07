import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ColorInput } from '@shared/ui/color-input/color-input';
import { FormField } from '@shared/ui/form-field/form-field';
import { SaveDialog } from '@shared/ui/save-dialog/save-dialog';
import { TextInput } from '@shared/ui/text-input/text-input';

export interface LabelFormValue {
  name: string;
  color: string | null;
  repoUrl: string | null;
}

/** Crea o edita una etiqueta: nombre, repositorio opcional (lo lee el planificador) y color. */
@Component({
  selector: 'app-label-form-dialog',
  imports: [ReactiveFormsModule, SaveDialog, FormField, TextInput, ColorInput],
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
          label="Repositorio (opcional)"
          for="label-repo"
          hint="https://github.com/organizacion/repo o https://bitbucket.org/workspace/repo. El planificador lo lee (rama main o master) para las tareas con esta etiqueta."
        >
          <app-text-input
            inputId="label-repo"
            type="url"
            formControlName="repoUrl"
            placeholder="https://github.com/organizacion/repo"
            [describedBy]="'label-repo-msg'"
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
  readonly open = model(false);
  readonly heading = input.required<string>();
  /** Valores iniciales al editar; `null` al crear. */
  readonly initial = input<{
    name: string;
    color?: string | null;
    repoUrl?: string | null;
  } | null>(null);
  readonly save = input.required<(value: LabelFormValue) => Promise<unknown>>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    color: [null as string | null],
    repoUrl: [''],
  });

  protected readonly submit = (): Promise<unknown> => {
    const { name, color, repoUrl } = this.form.getRawValue();
    return this.save()({ name: name.trim(), color, repoUrl: repoUrl.trim() || null });
  };

  protected reset(): void {
    const initial = this.initial();
    this.form.reset({
      name: initial?.name ?? '',
      color: initial?.color ?? null,
      repoUrl: initial?.repoUrl ?? '',
    });
  }

  protected nameInvalid(): boolean {
    const control = this.form.controls.name;
    return control.touched && control.invalid;
  }
}
