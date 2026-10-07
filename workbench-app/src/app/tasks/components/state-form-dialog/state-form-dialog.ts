import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { ColorInput } from '@shared/ui/color-input/color-input';
import { FormField } from '@shared/ui/form-field/form-field';
import { SaveDialog } from '@shared/ui/save-dialog/save-dialog';
import { TextInput } from '@shared/ui/text-input/text-input';

export interface StateFormValue {
  name: string;
  color: string | null;
  isFinal: boolean;
}

/** Crea o edita un estado: nombre, color y si cuenta como finalizado. */
@Component({
  selector: 'app-state-form-dialog',
  imports: [ReactiveFormsModule, SaveDialog, FormField, TextInput, ColorInput, Checkbox],
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
          for="state-name"
          required
          [error]="nameInvalid() ? 'Escribe un nombre' : null"
        >
          <app-text-input
            inputId="state-name"
            formControlName="name"
            [invalid]="nameInvalid()"
            [describedBy]="'state-name-msg'"
          />
        </app-form-field>
        <app-checkbox formControlName="isFinal">
          Cuenta como finalizado
          <span class="hint"
            >Sale de la lista de pendientes, pero puedes verlo cuando quieras.</span
          >
        </app-checkbox>
        <app-form-field label="Color" for="state-color">
          <app-color-input inputId="state-color" formControlName="color" />
        </app-form-field>
      </div>
    </app-save-dialog>
  `,
  styles: `
    .hint {
      display: block;
      font-size: 0.8125rem;
      color: var(--text-color);
    }
  `,
})
export class StateFormDialog {
  readonly open = model(false);
  readonly heading = input.required<string>();
  /** Valores iniciales al editar; `null` al crear. */
  readonly initial = input<{ name: string; color?: string | null; isFinal?: boolean } | null>(null);
  readonly save = input.required<(value: StateFormValue) => Promise<unknown>>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    color: [null as string | null],
    isFinal: [false],
  });

  protected readonly submit = (): Promise<unknown> => {
    const { name, color, isFinal } = this.form.getRawValue();
    return this.save()({ name: name.trim(), color, isFinal });
  };

  protected reset(): void {
    const initial = this.initial();
    this.form.reset({
      name: initial?.name ?? '',
      color: initial?.color ?? null,
      isFinal: initial?.isFinal ?? false,
    });
  }

  protected nameInvalid(): boolean {
    const control = this.form.controls.name;
    return control.touched && control.invalid;
  }
}
