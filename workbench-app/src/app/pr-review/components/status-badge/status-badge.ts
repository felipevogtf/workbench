import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Badge, BadgeTone } from '@shared/ui/badge/badge';
import { PullRequestStatus, STATUS_LABEL } from '../../models/pull-request';

const TONE: Record<PullRequestStatus, BadgeTone> = {
  pending: 'warning',
  reviewing: 'info',
  reviewed: 'success',
  failed: 'danger',
  skipped: 'neutral',
};

/** Estado de una PR (+ "Desactualizada" y "Cerrada" cuando corresponde). */
@Component({
  selector: 'app-status-badge',
  imports: [Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-badge
      [tone]="tone()"
      [loading]="status() === 'reviewing'"
      [dot]="status() !== 'reviewing'"
    >
      {{ label() }}
    </app-badge>
    @if (stale()) {
      <app-badge dashed title="Llegaron commits después de la última revisión"
        >Desactualizada</app-badge
      >
    }
    @if (closed()) {
      <app-badge>Cerrada</app-badge>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }
  `,
})
export class StatusBadge {
  readonly status = input.required<PullRequestStatus>();
  readonly stale = input(false);
  readonly closed = input(false);

  protected readonly tone = computed(() => TONE[this.status()]);
  protected readonly label = computed(() => STATUS_LABEL[this.status()]);
}
