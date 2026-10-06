import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '../icon/icon';
import type { IconName } from '../icon/icons';

export type AlertTone = 'danger' | 'warning' | 'info' | 'success';

const ICON_BY_TONE: Record<AlertTone, IconName> = {
  danger: 'alert',
  warning: 'alert',
  info: 'info',
  success: 'check',
};

/** Mensaje en línea. Slot `[alert-action]` para un botón (ej. "Reintentar"). */
@Component({
  selector: 'app-alert',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'tone() === "danger" ? "alert" : "status"',
    '[attr.data-tone]': 'tone()',
  },
  template: `
    <app-icon [name]="icon()" size="1.25rem" />
    <div class="alert__text">
      @if (heading()) {
        <strong>{{ heading() }}</strong>
      }
      <div class="alert__body"><ng-content /></div>
    </div>
    <div class="alert__action"><ng-content select="[alert-action]" /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: var(--tone-info-bg);
      color: var(--tone-info-fg);
    }

    :host([data-tone='danger']) {
      background: var(--tone-danger-bg);
      color: var(--tone-danger-fg);
    }

    :host([data-tone='warning']) {
      background: var(--tone-warning-bg);
      color: var(--tone-warning-fg);
    }

    :host([data-tone='success']) {
      background: var(--tone-success-bg);
      color: var(--tone-success-fg);
    }

    .alert__text {
      flex: 1 1 200px;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .alert__body {
      color: inherit;
    }

    .alert__action:empty {
      display: none;
    }
  `,
})
export class Alert {
  readonly tone = input<AlertTone>('info');
  readonly heading = input<string>();

  protected readonly icon = computed(() => ICON_BY_TONE[this.tone()]);
}
