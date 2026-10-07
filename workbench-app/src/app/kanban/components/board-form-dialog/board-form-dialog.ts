import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormField } from '@shared/ui/form-field/form-field';
import { SaveDialog } from '@shared/ui/save-dialog/save-dialog';
import { TextInput } from '@shared/ui/text-input/text-input';
import { Textarea } from '@shared/ui/textarea/textarea';
import { BoardInput } from '../../models/board';

/** Crea o edita un tablero. `save` hace la llamada; si falla, el mensaje se muestra en el diálogo. */
@Component({
  selector: 'app-board-form-dialog',
  imports: [ReactiveFormsModule, SaveDialog, FormField, TextInput, Textarea],
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
      </div>
    </app-save-dialog>
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

  protected readonly submit = (): Promise<unknown> => {
    const { name, description } = this.form.getRawValue();
    return this.save()({ name: name.trim(), description: description.trim() || null });
  };

  protected reset(): void {
    const initial = this.initial();
    this.form.reset({ name: initial?.name ?? '', description: initial?.description ?? '' });
  }

  protected nameInvalid(): boolean {
    const control = this.form.controls.name;
    return control.touched && control.invalid;
  }
}
