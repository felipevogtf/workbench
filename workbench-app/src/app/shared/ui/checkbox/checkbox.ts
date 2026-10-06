import { ChangeDetectionStrategy, Component, forwardRef, model, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Casilla con etiqueta (el contenido proyectado). Se usa con Reactive Forms (`formControlName`)
 * o con `[(value)]="signal"`.
 */
@Component({
  selector: 'app-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Checkbox), multi: true }],
  template: `
    <label>
      <input
        type="checkbox"
        [checked]="value()"
        [disabled]="disabled()"
        (change)="onToggle($event)"
        (blur)="onTouched()"
      />
      <span class="box" aria-hidden="true"></span>
      <span class="label"><ng-content /></span>
    </label>
  `,
  styles: `
    :host {
      display: block;
    }

    label {
      display: inline-flex;
      align-items: center;
      gap: var(--space-3);
      min-height: var(--touch-target);
      cursor: pointer;
      position: relative;
    }

    input {
      position: absolute;
      opacity: 0;
      width: 20px;
      height: 20px;
      margin: 0;
    }

    .box {
      flex: none;
      width: 20px;
      height: 20px;
      border: 1px solid var(--text-color);
      border-radius: 6px;
      background: var(--background);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition:
        background-color 0.15s ease,
        border-color 0.15s ease;
    }

    input:checked + .box {
      background: var(--primary);
      border-color: var(--primary);
    }

    input:checked + .box::after {
      content: '';
      width: 5px;
      height: 10px;
      border: solid var(--background);
      border-width: 0 2px 2px 0;
      transform: translateY(-1px) rotate(45deg);
    }

    input:focus-visible + .box {
      outline: var(--focus-ring);
      outline-offset: 2px;
    }

    input:disabled + .box {
      opacity: 0.5;
    }
  `,
})
export class Checkbox implements ControlValueAccessor {
  readonly value = model(false);

  protected readonly disabled = signal(false);

  private onChange: (value: boolean) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: boolean | null): void {
    this.value.set(!!value);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.value.set(checked);
    this.onChange(checked);
  }
}
