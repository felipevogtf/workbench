import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Etiqueta con un punto de color (estados, etiquetas, proyectos). El color es cualquier color CSS;
 * sin color, el punto es gris. El texto del contenido siempre es neutro: el color solo acompaña.
 */
@Component({
  selector: 'app-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="dot" [style.background]="color() ?? 'var(--text-color)'" aria-hidden="true"></span>
    <ng-content />
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      padding: 2px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      font-size: 0.8125rem;
      font-weight: 500;
      line-height: 1.5;
      white-space: nowrap;
      color: var(--primary);
    }

    .dot {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
  `,
})
export class Tag {
  readonly color = input<string | null>(null);
}
