import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { errorMessage } from '@core/api/api-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { ColorInput } from '@shared/ui/color-input/color-input';
import { Dialog } from '@shared/ui/dialog/dialog';
import { FormField } from '@shared/ui/form-field/form-field';
import { TextInput } from '@shared/ui/text-input/text-input';

export interface NamedItemValue {
  name: string;
  color: string | null;
  /** Solo en las etiquetas (`withRepo`). */
  repoUrl?: string | null;
}

/**
 * Diálogo de nombre (y color) para crear o editar proyectos, estados y etiquetas. `save` hace la
 * llamada; si falla, el mensaje se muestra en el diálogo y este queda abierto.
 */
@Component({
  selector: 'app-named-item-dialog',
  imports: [ReactiveFormsModule, Dialog, FormField, TextInput, ColorInput, Button, Alert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [heading]="heading()" [(open)]="open">
      <form id="named-item-form" class="stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error(); as message) {
          <app-alert tone="danger" heading="No se pudo guardar">{{ message }}</app-alert>
        }
        <app-form-field
          label="Nombre"
          for="named-item-name"
          required
          [error]="nameInvalid() ? 'Escribe un nombre' : null"
        >
          <app-text-input
            inputId="named-item-name"
            formControlName="name"
            [invalid]="nameInvalid()"
            [describedBy]="'named-item-name-msg'"
          />
        </app-form-field>
        @if (withRepo()) {
          <app-form-field
            label="Repositorio (opcional)"
            for="named-item-repo"
            hint="https://github.com/organizacion/repo o https://bitbucket.org/workspace/repo. El planificador lo lee (rama main o master) para las tareas con esta etiqueta."
          >
            <app-text-input
              inputId="named-item-repo"
              type="url"
              formControlName="repoUrl"
              placeholder="https://github.com/organizacion/repo"
              [describedBy]="'named-item-repo-msg'"
            />
          </app-form-field>
        }
        @if (withColor()) {
          <app-form-field
            label="Color"
            for="named-item-color"
            [hint]="
              withRepo() && !initial() ? 'Si no eliges uno, se asigna un color al azar.' : undefined
            "
          >
            <app-color-input inputId="named-item-color" formControlName="color" />
          </app-form-field>
        }
      </form>

      <ng-container dialog-footer>
        <button app-button variant="secondary" type="button" (click)="open.set(false)">
          Cancelar
        </button>
        <button app-button type="submit" form="named-item-form" [loading]="saving()">
          Guardar
        </button>
      </ng-container>
    </app-dialog>
  `,
})
export class NamedItemDialog {
  readonly open = model(false);
  readonly heading = input.required<string>();
  /** Valores iniciales al editar; `null` al crear. */
  readonly initial = input<{
    name: string;
    color?: string | null;
    repoUrl?: string | null;
  } | null>(null);
  readonly withColor = input(true, { transform: booleanAttribute });
  /** Campo opcional de repositorio (etiquetas). */
  readonly withRepo = input(false, { transform: booleanAttribute });
  readonly save = input.required<(value: NamedItemValue) => Promise<unknown>>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    color: [null as string | null],
    repoUrl: [''],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Cada vez que se abre, el formulario parte de los valores iniciales.
    effect(() => {
      if (!this.open()) return;
      const initial = this.initial();
      untracked(() => {
        this.form.reset({
          name: initial?.name ?? '',
          color: initial?.color ?? null,
          repoUrl: initial?.repoUrl ?? '',
        });
        this.error.set(null);
      });
    });
  }

  protected nameInvalid(): boolean {
    const control = this.form.controls.name;
    return control.touched && control.invalid;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, color, repoUrl } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.save()({
        name: name.trim(),
        color: this.withColor() ? color : null,
        ...(this.withRepo() ? { repoUrl: repoUrl.trim() || null } : {}),
      });
      this.open.set(false);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
