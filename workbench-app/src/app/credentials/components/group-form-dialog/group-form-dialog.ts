import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Button } from '@shared/ui/button/button';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { FormField } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { SaveDialog } from '@shared/ui/save-dialog/save-dialog';
import { TextInput } from '@shared/ui/text-input/text-input';
import { GroupInput } from '../../models/credential';

/** Una fila a medias (solo la clave o solo el valor) es un error; una vacía se ignora. */
function completeRow(row: AbstractControl): ValidationErrors | null {
  const { key, value } = row.value as { key: string; value: string };
  const hasKey = key.trim() !== '';
  const hasValue = value !== '';
  return hasKey === hasValue ? null : { incomplete: true };
}

/**
 * Crea un grupo (con sus primeros campos) o edita su nombre y categoría. Al editar no se muestran
 * los campos: se administran uno a uno desde la tarjeta del grupo.
 */
@Component({
  selector: 'app-group-form-dialog',
  imports: [
    ReactiveFormsModule,
    SaveDialog,
    FormField,
    TextInput,
    Checkbox,
    Button,
    Icon,
    IconButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .rows {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-2) var(--space-3);
      align-items: center;
      padding-bottom: var(--space-3);
      border-bottom: 1px solid var(--border);
    }

    .row__fields {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-2);
    }

    .row__sensitive {
      grid-column: 1;
    }

    .section-title {
      margin: 0;
      font-weight: 500;
    }

    .error {
      margin: 0;
      font-size: 0.875rem;
      color: var(--tone-danger-fg);
    }

    @media (min-width: 600px) {
      .row__fields {
        grid-template-columns: 1fr 1.4fr;
      }
    }
  `,
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
          for="group-name"
          required
          [error]="invalid('name') ? 'Escribe un nombre' : null"
        >
          <app-text-input
            inputId="group-name"
            formControlName="name"
            placeholder="aws"
            [invalid]="invalid('name')"
            [describedBy]="'group-name-msg'"
          />
        </app-form-field>
        <app-form-field label="Categoría (opcional)" for="group-category">
          <app-text-input
            inputId="group-category"
            formControlName="category"
            placeholder="Nube"
            [suggestions]="categories()"
          />
        </app-form-field>

        @if (!initial()) {
          <p class="section-title">Campos</p>
          <ul class="rows" formArrayName="items">
            @for (row of form.controls.items.controls; track row; let i = $index) {
              <li class="row" [formGroupName]="i">
                <div class="row__fields">
                  <app-text-input
                    [inputId]="'group-item-key-' + i"
                    formControlName="key"
                    placeholder="usuario"
                    [ariaLabel]="'Clave del campo ' + (i + 1)"
                  />
                  <app-text-input
                    [inputId]="'group-item-value-' + i"
                    formControlName="value"
                    placeholder="valor"
                    autocomplete="new-password"
                    [type]="row.controls.sensitive.value ? 'password' : 'text'"
                    [ariaLabel]="'Valor del campo ' + (i + 1)"
                  />
                </div>
                <button
                  app-icon-button
                  type="button"
                  tone="danger"
                  [label]="'Quitar el campo ' + (i + 1)"
                  (click)="removeRow(i)"
                >
                  <app-icon name="trash" size="1.1rem" />
                </button>
                <app-checkbox class="row__sensitive" formControlName="sensitive">
                  Sensible
                </app-checkbox>
              </li>
            }
          </ul>
          @if (incomplete()) {
            <p class="error" role="alert">Completa la clave y el valor de cada campo.</p>
          }
          <div>
            <button app-button variant="secondary" size="sm" type="button" (click)="addRow()">
              <app-icon name="plus" size="1em" /> Agregar campo
            </button>
          </div>
        }
      </div>
    </app-save-dialog>
  `,
})
export class GroupFormDialog {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly open = model(false);
  readonly heading = input.required<string>();
  /** El grupo que se edita; `null` al crear. */
  readonly initial = input<{ name: string; category: string | null } | null>(null);
  /** Categorías ya usadas, para sugerirlas. */
  readonly categories = input<readonly string[]>([]);
  readonly save = input.required<(value: GroupInput) => Promise<unknown>>();

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    category: ['', Validators.maxLength(50)],
    items: this.fb.array([this.newRow()]),
  });

  protected readonly submit = (): Promise<unknown> => {
    const { name, category, items } = this.form.getRawValue();
    const value: GroupInput = { name: name.trim(), category: category.trim() || null };
    if (!this.initial()) {
      value.items = items
        .filter((row) => row.key.trim() !== '')
        .map((row) => ({ key: row.key.trim(), value: row.value, sensitive: row.sensitive }));
    }
    return this.save()(value);
  };

  protected reset(): void {
    const initial = this.initial();
    this.form.controls.items.clear();
    // Al editar solo se tocan el nombre y la categoría: los campos no forman parte del formulario.
    if (!initial) this.addRow();
    this.form.controls.name.reset(initial?.name ?? '');
    this.form.controls.category.reset(initial?.category ?? '');
  }

  protected addRow(): void {
    this.form.controls.items.push(this.newRow());
  }

  protected removeRow(index: number): void {
    this.form.controls.items.removeAt(index);
  }

  protected invalid(name: 'name'): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  protected incomplete(): boolean {
    return this.form.controls.items.controls.some(
      (row) => row.touched && row.hasError('incomplete'),
    );
  }

  private newRow() {
    return this.fb.group(
      { key: [''], value: [''], sensitive: [false] },
      { validators: completeRow },
    );
  }
}
