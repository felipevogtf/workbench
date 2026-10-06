import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/**
 * Card del portfolio. Slots: `[card-header]`, contenido y `[card-footer]`.
 * Con `interactive` reacciona al hover (borde, escala y sombra).
 */
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-interactive]': 'interactive() ? "" : null' },
  template: `
    <div class="card__header"><ng-content select="[card-header]" /></div>
    <div class="card__body"><ng-content /></div>
    <div class="card__footer"><ng-content select="[card-footer]" /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: var(--border-radius);
      background-color: var(--background);
      transition:
        border-color 0.1s ease-in,
        box-shadow 0.1s ease-in,
        transform 0.1s ease-in;
    }

    :host([data-interactive]:hover) {
      border-color: var(--primary);
      transform: scale(1.01);
      box-shadow: var(--shadow-hover);
    }

    .card__header:empty,
    .card__footer:empty {
      display: none;
    }

    .card__body {
      flex: 1;
      min-width: 0;
    }

    .card__header {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      color: var(--text-color);
    }

    .card__footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 5px;
    }
  `,
})
export class Card {
  readonly interactive = input(false, { transform: booleanAttribute });
}
