import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
}

/** Grupo de botones excluyentes (filtro). Con scroll horizontal cuando no cabe en móvil. */
@Component({
  selector: 'app-segmented-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        [attr.aria-pressed]="option.value === value()"
        (click)="value.set(option.value)"
      >
        {{ option.label }}
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      gap: var(--space-1);
      padding: var(--space-1);
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      overflow-x: auto;
      scrollbar-width: none;
      max-width: 100%;
    }

    :host::-webkit-scrollbar {
      display: none;
    }

    button {
      flex: none;
      min-height: 36px;
      padding: 0 16px;
      border: none;
      border-radius: var(--radius-pill);
      background: transparent;
      color: var(--text-color);
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color 0.2s ease,
        color 0.2s ease;
    }

    button:hover {
      color: var(--primary);
    }

    button[aria-pressed='true'] {
      background: var(--primary);
      color: var(--background);
    }

    @media (pointer: coarse) {
      button {
        min-height: 40px;
      }
    }
  `,
})
export class SegmentedControl {
  readonly options = input.required<readonly SegmentOption[]>();
  readonly label = input.required<string>();
  readonly value = model.required<string>();
}
