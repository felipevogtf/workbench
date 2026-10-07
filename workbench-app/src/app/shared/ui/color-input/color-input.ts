import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export const COLOR_PRESETS: readonly string[] = [
  '#9ca3af',
  '#64748b',
  '#3b82f6',
  '#0ea5e9',
  '#06b6d4',
  '#14b8a6',
  '#06d6a0',
  '#84cc16',
  '#ffc43d',
  '#f97316',
  '#ef4444',
  '#ef476f',
  '#ec4899',
  '#a855f7',
  '#6366f1',
  '#8b5e3c',
];

/**
 * Elige un color: muestras predefinidas más un selector libre. El valor es `#rrggbb` o `null`
 * (sin color). Se usa con Reactive Forms.
 */
@Component({
  selector: 'app-color-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ColorInput), multi: true },
  ],
  template: `
    <div class="swatches" role="group" [attr.aria-label]="label()">
      @for (color of presets; track color) {
        <button
          type="button"
          class="swatch"
          [style.background]="color"
          [attr.aria-pressed]="value() === color"
          [attr.aria-label]="color"
          [disabled]="disabled()"
          (click)="pick(color)"
        ></button>
      }
      <label class="custom" [class.is-selected]="isCustom()">
        <input
          type="color"
          [id]="inputId()"
          [value]="value() ?? '#9ca3af'"
          [disabled]="disabled()"
          [attr.aria-label]="'Otro color'"
          (input)="pickFrom($event)"
          (blur)="onTouched()"
        />
        <span>Otro</span>
      </label>
      @if (value()) {
        <button type="button" class="clear" [disabled]="disabled()" (click)="pick(null)">
          Sin color
        </button>
      }
    </div>
  `,
  styles: `
    .swatches {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }

    .swatch {
      width: 32px;
      height: 32px;
      padding: 0;
      border: 2px solid var(--background);
      border-radius: 50%;
      box-shadow: 0 0 0 1px var(--border);
      cursor: pointer;
    }

    .swatch[aria-pressed='true'] {
      box-shadow: 0 0 0 2px var(--primary);
    }

    .custom {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 32px;
      padding: 0 var(--space-3) 0 var(--space-1);
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      font-size: 0.875rem;
      cursor: pointer;
    }

    .custom.is-selected {
      border-color: var(--primary);
    }

    input[type='color'] {
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: none;
      cursor: pointer;
    }

    .clear {
      padding: 0 var(--space-2);
      border: none;
      background: none;
      color: var(--text-color);
      font: inherit;
      font-size: 0.875rem;
      text-decoration: underline;
      cursor: pointer;
    }
  `,
})
export class ColorInput implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  readonly label = input('Color');

  protected readonly presets = COLOR_PRESETS;
  protected readonly value = signal<string | null>(null);
  protected readonly disabled = signal(false);

  private onChange: (value: string | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected isCustom(): boolean {
    const current = this.value();
    return !!current && !this.presets.includes(current);
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected pickFrom(event: Event): void {
    this.pick((event.target as HTMLInputElement).value);
  }

  protected pick(color: string | null): void {
    this.value.set(color);
    this.onChange(color);
  }
}
