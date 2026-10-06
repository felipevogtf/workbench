import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';
import type { IconName } from '../icon/icons';

/** Estado vacío: ícono, título, texto (contenido) y una acción opcional (`[empty-action]`). */
@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-icon [name]="icon()" size="2.5rem" />
    <h3>{{ heading() }}</h3>
    <p><ng-content /></p>
    <div class="empty__action"><ng-content select="[empty-action]" /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-7) var(--space-4);
      border: 1px dashed var(--border);
      border-radius: var(--border-radius);
      text-align: center;
      color: var(--text-color);
    }

    p {
      margin: 0;
      max-width: 44ch;
    }

    .empty__action {
      margin-top: var(--space-3);
    }

    .empty__action:empty {
      display: none;
    }
  `,
})
export class EmptyState {
  readonly icon = input<IconName>('inbox');
  readonly heading = input.required<string>();
}
