import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Título (`h3`), subtítulo (`h4`) y acciones (`[actions]`). Las acciones bajan de línea en móvil. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header__text">
      <ng-content select="[back]" />
      <h3>{{ heading() }}</h3>
      @if (subtitle()) {
        <h4>{{ subtitle() }}</h4>
      }
    </div>
    <div class="header__actions"><ng-content select="[actions]" /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      margin-bottom: var(--space-5);
    }

    h3 {
      font-size: clamp(1.5rem, 1.2rem + 1.5vw, 2rem);
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .header__text {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      min-width: 0;
    }

    // El botón "volver" no debe estirarse a todo el ancho de la columna.
    .header__text ::ng-deep [back] {
      align-self: flex-start;
    }

    .header__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .header__actions:empty {
      display: none;
    }

    .header__actions ::ng-deep > * {
      flex: 1 1 auto;
    }

    @media (min-width: 768px) {
      :host {
        flex-direction: row;
        align-items: flex-end;
        justify-content: space-between;
      }

      // Las acciones van en una sola fila, a la derecha del título (que es el que se acorta).
      .header__actions {
        flex: none;
        flex-wrap: nowrap;
        align-items: center;
      }

      .header__actions ::ng-deep > * {
        flex: 0 0 auto;
      }
    }
  `,
})
export class PageHeader {
  readonly heading = input.required<string>();
  readonly subtitle = input<string>();
}
