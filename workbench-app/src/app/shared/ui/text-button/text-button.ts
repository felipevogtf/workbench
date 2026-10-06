import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { Icon } from '../icon/icon';

/** Enlace con flecha del portfolio. Con `external` abre en otra pestaña. */
@Component({
  selector: 'a[app-text-button]',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.target]': 'external() ? "_blank" : null',
    '[attr.rel]': 'external() ? "noopener noreferrer" : null',
  },
  template: `
    <ng-content />
    <app-icon name="arrow-outward" size="1.2rem" />
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 5px 0;
      font-weight: 500;
      text-decoration: none;
      color: var(--primary);
    }

    app-icon {
      transition: transform 0.3s ease;
    }

    :host(:hover) app-icon {
      transform: translate(2px, -2px);
    }
  `,
})
export class TextButton {
  readonly external = input(true, { transform: booleanAttribute });
}
