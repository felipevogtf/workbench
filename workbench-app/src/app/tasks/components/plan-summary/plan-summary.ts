import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Alert } from '@shared/ui/alert/alert';
import { Badge, BadgeTone } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { Dialog } from '@shared/ui/dialog/dialog';
import { Icon } from '@shared/ui/icon/icon';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { Spinner } from '@shared/ui/spinner/spinner';
import { PlansStore } from '../../data-access/plans.store';
import { PLAN_STATUS_LABEL, PlanStatus } from '../../models/plan';

const TONES: Record<PlanStatus, BadgeTone> = {
  pending: 'neutral',
  generating: 'info',
  ready: 'success',
  failed: 'danger',
};

/**
 * El plan de una tarea en el detalle, sin mostrarlo: solo que hay uno (y su estado) y un botón para previsualizarlo en una ventana.
 * El plan se crea y se edita desde el organizador. El estado vive en `PlansStore`, que provee la página.
 */
@Component({
  selector: 'app-plan-summary',
  imports: [TimeAgoPipe, Alert, Badge, Button, Card, Dialog, Icon, MarkdownViewer, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.viewed(); as plan) {
      <app-card>
        <div class="summary">
          <app-icon name="file-text" size="1.4rem" />
          <div class="summary__text">
            <strong>Plan de ejecución</strong>
            <span class="summary__muted"
              >{{ plan.agentName }} · {{ plan.createdAt | timeAgo }}</span
            >
          </div>
          <app-badge [tone]="tone(plan.status)" dot>{{ statusLabel[plan.status] }}</app-badge>
          <button
            app-button
            variant="secondary"
            size="sm"
            type="button"
            [disabled]="!store.viewedContent()"
            (click)="open.set(true)"
          >
            Ver plan
          </button>
        </div>
        @if (store.active()) {
          <p class="summary__muted summary__progress" role="status">
            <app-spinner size="1em" /> Actualizando el plan…
          </p>
        }
      </app-card>

      <app-dialog heading="Plan de ejecución" [wide]="true" [(open)]="open">
        @if (store.viewedContent(); as content) {
          <app-markdown-viewer [content]="content" />
        }
      </app-dialog>
    } @else if (store.active() || store.requesting()) {
      <app-card>
        <p class="summary__progress" role="status">
          <app-spinner size="1em" /> Generando el plan… puede tardar unos minutos.
        </p>
      </app-card>
    }

    @if (store.latestFailed(); as failed) {
      <app-alert tone="danger" heading="El último plan falló">{{ failed.error }}</app-alert>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
    }

    .summary__text {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }

    .summary__muted {
      font-size: 0.875rem;
      color: var(--text-color);
    }

    .summary__progress {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
    }
  `,
})
export class PlanSummary {
  protected readonly store = inject(PlansStore);
  protected readonly open = signal(false);
  protected readonly statusLabel = PLAN_STATUS_LABEL;

  protected tone(status: PlanStatus): BadgeTone {
    return TONES[status];
  }
}
