import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { FormGroup } from '@angular/forms';
import { errorMessage } from '@shared/util/error-message';
import { Alert } from '../alert/alert';
import { Button } from '../button/button';
import { Dialog } from '../dialog/dialog';

/**
 * Diálogo de formulario: cabecera, alerta de error, Cancelar/Guardar y estado «guardando».
 * Quien lo usa le pasa su `FormGroup` en `[form]` y pone los campos dentro de un `<div [formGroup]>`;
 * `save` hace la llamada y, si falla, el mensaje se muestra aquí y el diálogo queda abierto.
 * `(opened)` avisa cada vez que se abre, para que el formulario parta de sus valores iniciales.
 */
@Component({
  selector: 'app-save-dialog',
  imports: [Dialog, Button, Alert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [heading]="heading()" [(open)]="open">
      <form [id]="formId" class="stack" (submit)="submit()" novalidate>
        @if (error(); as message) {
          <app-alert tone="danger" heading="No se pudo guardar">{{ message }}</app-alert>
        }
        <ng-content />
      </form>

      <ng-container dialog-footer>
        <button app-button variant="secondary" type="button" (click)="open.set(false)">
          Cancelar
        </button>
        <button app-button type="submit" [attr.form]="formId" [loading]="saving()">Guardar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class SaveDialog {
  private static nextId = 0;

  readonly open = model(false);
  readonly heading = input.required<string>();
  /** El formulario de los campos: se valida antes de guardar. */
  readonly form = input.required<FormGroup>();
  readonly save = input.required<() => Promise<unknown>>();
  readonly opened = output();

  protected readonly formId = `save-dialog-form-${SaveDialog.nextId++}`;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.error.set(null);
        this.opened.emit();
      });
    });
  }

  protected async submit(): Promise<void> {
    const form = this.form();
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.save()();
      this.open.set(false);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
