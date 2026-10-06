import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-text-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TextInput), multi: true },
  ],
  template: `
    <input
      class="app-control"
      [id]="inputId()"
      [type]="type()"
      [value]="value()"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      [attr.min]="min()"
      [attr.step]="step()"
      [attr.autocomplete]="autocomplete()"
      [attr.list]="suggestions().length ? inputId() + '-list' : null"
      [attr.aria-invalid]="invalid() ? 'true' : null"
      [attr.aria-describedby]="describedBy()"
      (input)="onInput($event)"
      (blur)="onTouched()"
    />
    @if (suggestions().length) {
      <datalist [id]="inputId() + '-list'">
        @for (suggestion of suggestions(); track suggestion) {
          <option [value]="suggestion"></option>
        }
      </datalist>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class TextInput implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  readonly type = input<'text' | 'search' | 'url' | 'date' | 'number'>('text');
  /** Solo para los tipos `number` y `date`. */
  readonly min = input<string | number | null>(null);
  readonly step = input<string | number | null>(null);
  readonly placeholder = input('');
  readonly autocomplete = input<string>('off');
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly describedBy = input<string | null>(null);
  /** Sugerencias de autocompletado (`<datalist>`); el valor sigue siendo libre. */
  readonly suggestions = input<readonly string[]>([]);

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

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
  }
}
