import {
  ChangeDetectionStrategy,
  Component,
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
import { Dialog } from '@shared/ui/dialog/dialog';
import { FormField } from '@shared/ui/form-field/form-field';
import { TextInput } from '@shared/ui/text-input/text-input';
import { Textarea } from '@shared/ui/textarea/textarea';
import { BoardInput } from '../../models/board';

/** Crea o edita un tablero. `save` hace la llamada; si falla, el mensaje se muestra aquí. */
@Component({
  selector: 'app-board-form-dialog',
  imports: [ReactiveFormsModule, Dialog, FormField, TextInput, Textarea, Button, Alert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [heading]="heading()" [(open)]="open">
      <form id="board-form" class="stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error(); as message) {
          <app-alert tone="danger" heading="No se pudo guardar">{{ message }}</app-alert>
        }
        <app-form-field
          label="Nombre"
          for="board-name"
          required
          [error]="nameInvalid() ? 'Escribe un nombre' : null"
        >
          <app-text-input
            inputId="board-name"
            formControlName="name"
            placeholder="Sprint actual"
            [invalid]="nameInvalid()"
            [describedBy]="'board-name-msg'"
          />
        </app-form-field>
        <app-form-field label="Descripción" for="board-description">
          <app-textarea inputId="board-description" formControlName="description" [rows]="3" />
        </app-form-field>
      </form>

      <ng-container dialog-footer>
        <button app-button variant="secondary" type="button" (click)="open.set(false)">
          Cancelar
        </button>
        <button app-button type="submit" form="board-form" [loading]="saving()">Guardar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class BoardFormDialog {
  readonly open = model(false);
  readonly heading = input.required<string>();
  /** Valores iniciales al editar; `null` al crear. */
  readonly initial = input<{ name: string; description: string | null } | null>(null);
  readonly save = input.required<(value: BoardInput) => Promise<unknown>>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const initial = this.initial();
      untracked(() => {
        this.form.reset({ name: initial?.name ?? '', description: initial?.description ?? '' });
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

    const { name, description } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.save()({ name: name.trim(), description: description.trim() || null });
      this.open.set(false);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
