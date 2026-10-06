import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Botón de solo ícono (como el del portfolio). El `label` es obligatorio: es su nombre accesible. */
@Component({
  selector: 'button[app-icon-button], a[app-icon-button]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.aria-label]': 'label()',
    '[attr.title]': 'label()',
    '[attr.data-tone]': 'tone()',
  },
  template: `<ng-content />`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 40px;
      min-height: 40px;
      padding: 5px;
      border: none;
      border-radius: var(--border-radius);
      background: transparent;
      color: inherit;
      text-decoration: none;
      cursor: pointer;
      transition: transform 0.2s ease;
      -webkit-tap-highlight-color: transparent;
      font-size: 1.125rem;

      &:hover {
        transform: scale(1.2);
      }
    }

    :host([data-tone='danger']) {
      color: var(--tone-danger-fg);
    }

    :host([disabled]) {
      opacity: 0.5;
      pointer-events: none;
    }

    @media (pointer: coarse) {
      :host {
        min-width: var(--touch-target);
        min-height: var(--touch-target);
      }
    }
  `,
})
export class IconButton {
  readonly label = input.required<string>();
  readonly tone = input<'default' | 'danger'>('default');
}
