import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Icon } from '../icon/icon';

export interface SelectOption {
  value: string;
  label: string;
}

/** `<select>` nativo con el estilo de los demás controles. `placeholder` agrega una opción vacía. */
@Component({
  selector: 'app-select',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Select), multi: true }],
  template: `
    <select
      class="app-control"
      [id]="inputId()"
      [disabled]="disabled()"
      [attr.aria-invalid]="invalid() ? 'true' : null"
      [attr.aria-describedby]="describedBy()"
      (change)="onChangeEvent($event)"
      (blur)="onTouched()"
    >
      @if (placeholder() !== null) {
        <option value="" [selected]="value() === ''">{{ placeholder() }}</option>
      }
      @for (option of options(); track option.value) {
        <option [value]="option.value" [selected]="option.value === value()">
          {{ option.label }}
        </option>
      }
    </select>
    <app-icon name="chevron-down" size="1.1rem" />
  `,
  styles: `
    :host {
      position: relative;
      display: block;
    }

    select {
      appearance: none;
      padding-right: 40px;
      cursor: pointer;
    }

    app-icon {
      position: absolute;
      top: 50%;
      right: 14px;
      transform: translateY(-50%);
      pointer-events: none;
    }
  `,
})
export class Select implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly placeholder = input<string | null>(null);
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly describedBy = input<string | null>(null);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onChangeEvent(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.value.set(value);
    this.onChange(value);
  }
}
