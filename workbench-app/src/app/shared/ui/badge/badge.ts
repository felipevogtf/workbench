import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { Spinner } from '../spinner/spinner';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

@Component({
  selector: 'app-badge',
  imports: [Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-tone]': 'tone()',
    '[attr.data-dashed]': 'dashed() ? "" : null',
  },
  template: `
    @if (loading()) {
      <app-spinner size="0.8em" />
    } @else if (dot()) {
      <span class="dot"></span>
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 10px;
      border: 1px solid transparent;
      border-radius: var(--radius-pill);
      font-size: 0.8125rem;
      font-weight: 500;
      line-height: 1.5;
      white-space: nowrap;
      background: var(--tone-neutral-bg);
      color: var(--tone-neutral-fg);
    }

    :host([data-tone='success']) {
      background: var(--tone-success-bg);
      color: var(--tone-success-fg);
    }

    :host([data-tone='warning']) {
      background: var(--tone-warning-bg);
      color: var(--tone-warning-fg);
    }

    :host([data-tone='danger']) {
      background: var(--tone-danger-bg);
      color: var(--tone-danger-fg);
    }

    :host([data-tone='info']) {
      background: var(--tone-info-bg);
      color: var(--tone-info-fg);
    }

    :host([data-dashed]) {
      background: transparent;
      border: 1px dashed currentColor;
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
  `,
})
export class Badge {
  readonly tone = input<BadgeTone>('neutral');
  readonly dot = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  /** Estilo punteado (ej. "desactualizada"). */
  readonly dashed = input(false, { transform: booleanAttribute });
}
