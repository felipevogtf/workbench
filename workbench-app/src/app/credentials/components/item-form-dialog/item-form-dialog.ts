import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from '@shared/ui/button/button';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { FormField } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { SaveDialog } from '@shared/ui/save-dialog/save-dialog';
import { TextInput } from '@shared/ui/text-input/text-input';
import { Toast } from '@shared/ui/toast/toast';
import { DEFAULT_OPTIONS, generatePassword } from '../../domain/password-generator';
import { CredentialItem } from '../../models/credential';

export interface ItemFormValue {
  key: string;
  /** Vacío al editar un campo sensible: se conserva el valor actual. */
  value: string;
  sensitive: boolean;
}

/** Agrega o edita un campo (clave y valor) de un grupo. */
@Component({
  selector: 'app-item-form-dialog',
  imports: [ReactiveFormsModule, SaveDialog, FormField, TextInput, Checkbox, Button, Icon],
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
          label="Clave"
          for="item-key"
          required
          [error]="invalid('key') ? 'Escribe una clave' : null"
        >
          <app-text-input
            inputId="item-key"
            formControlName="key"
            placeholder="usuario"
            [invalid]="invalid('key')"
            [describedBy]="'item-key-msg'"
          />
        </app-form-field>
        <app-form-field
          label="Valor"
          for="item-value"
          [required]="!keepsCurrentValue()"
          [hint]="keepsCurrentValue() ? 'Déjalo vacío para conservar el valor actual.' : undefined"
          [error]="invalid('value') ? 'Escribe un valor' : null"
        >
          <app-text-input
            inputId="item-value"
            formControlName="value"
            autocomplete="new-password"
            [type]="form.controls.sensitive.value ? 'password' : 'text'"
            [invalid]="invalid('value')"
            [describedBy]="'item-value-msg'"
          />
        </app-form-field>
        <div>
          <button app-button variant="secondary" size="sm" type="button" (click)="generate()">
            <app-icon name="sparkles" size="1em" /> Generar contraseña
          </button>
        </div>
        <app-checkbox formControlName="sensitive">
          Sensible (se oculta hasta que lo muestres)
        </app-checkbox>
      </div>
    </app-save-dialog>
  `,
})
export class ItemFormDialog {
  private readonly toast = inject(Toast);

  readonly open = model(false);
  readonly heading = input.required<string>();
  /** El campo que se edita; `null` al agregar. */
  readonly initial = input<CredentialItem | null>(null);
  readonly save = input.required<(value: ItemFormValue) => Promise<unknown>>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    key: ['', [Validators.required, Validators.maxLength(100)]],
    value: ['', Validators.required],
    sensitive: [false],
  });

  protected readonly submit = (): Promise<unknown> => {
    const { key, value, sensitive } = this.form.getRawValue();
    return this.save()({ key: key.trim(), value, sensitive });
  };

  /** Al editar un campo sensible el servidor no entrega su valor, así que escribirlo es opcional. */
  protected keepsCurrentValue(): boolean {
    const initial = this.initial();
    return !!initial && initial.value === null;
  }

  /** Pone una contraseña nueva en el valor y marca el campo como sensible (queda oculta). */
  protected generate(): void {
    this.form.patchValue({ value: generatePassword(DEFAULT_OPTIONS), sensitive: true });
    this.toast.info(`Contraseña de ${DEFAULT_OPTIONS.length} caracteres generada`);
  }

  protected reset(): void {
    const initial = this.initial();
    this.form.controls.value.setValidators(this.keepsCurrentValue() ? [] : [Validators.required]);
    this.form.reset({
      key: initial?.key ?? '',
      value: initial?.value ?? '',
      sensitive: initial?.sensitive ?? false,
    });
  }

  protected invalid(name: 'key' | 'value'): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }
}
