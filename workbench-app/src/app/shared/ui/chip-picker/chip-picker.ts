import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface ChipOption {
  value: string;
  label: string;
  color?: string | null;
}

/** Elige varias opciones como chips que se activan y desactivan. `[(selected)]` es la lista de ids. */
@Component({
  selector: 'app-chip-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        class="chip"
        [attr.aria-pressed]="isSelected(option.value)"
        (click)="toggle(option.value)"
      >
        <span
          class="dot"
          aria-hidden="true"
          [style.background]="option.color ?? 'var(--text-color)'"
        ></span>
        {{ option.label }}
      </button>
    } @empty {
      <span class="none">{{ emptyText() }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 36px;
      padding: 0 var(--space-3);
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      background: transparent;
      color: var(--text-color);
      font: inherit;
      font-size: 0.875rem;
      cursor: pointer;
      transition:
        background-color 0.15s ease,
        color 0.15s ease,
        border-color 0.15s ease;
    }

    .chip:hover {
      border-color: var(--text-color);
    }

    .chip[aria-pressed='true'] {
      border-color: var(--primary);
      background: var(--primary);
      color: var(--background);
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      box-shadow: 0 0 0 1px var(--background);
    }

    .none {
      color: var(--text-color);
      font-size: 0.875rem;
    }
  `,
})
export class ChipPicker {
  readonly options = input.required<readonly ChipOption[]>();
  readonly label = input.required<string>();
  readonly emptyText = input('No hay opciones');
  readonly selected = model.required<string[]>();

  protected isSelected(value: string): boolean {
    return this.selected().includes(value);
  }

  protected toggle(value: string): void {
    this.selected.update((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }
}
