import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Badge } from '@shared/ui/badge/badge';
import { Card } from '@shared/ui/card/card';
import { PullRequest, QueueSnapshot } from '../../models/pull-request';

interface QueueRow {
  pr: PullRequest;
  /** 0 = en curso; 1..n = lugar en la cola de espera. */
  position: number;
}

/** Quién se está revisando ahora y quién espera, en orden. */
@Component({
  selector: 'app-queue-panel',
  imports: [RouterLink, Card, Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card>
      <div card-header class="queue__head">
        <strong>Cola de revisión</strong>
        <app-badge>{{ queue().activeWorkers }} de {{ queue().concurrency }} en paralelo</app-badge>
      </div>

      <ol class="queue__list">
        @for (row of rows(); track row.pr.id) {
          <li>
            @if (row.position === 0) {
              <app-badge tone="info" loading>Revisando</app-badge>
            } @else {
              <app-badge tone="warning">Turno {{ row.position }}</app-badge>
            }
            <a [routerLink]="['/pull-requests', row.pr.id]" class="break-anywhere">
              {{ row.pr.title }}
            </a>
            <span class="queue__repo break-anywhere"
              >{{ row.pr.repo }} #{{ row.pr.externalId }}</span
            >
          </li>
        }
      </ol>
    </app-card>
  `,
  styles: `
    .queue__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      color: var(--primary);
    }

    .queue__list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-3);
      padding: 0;
    }

    a {
      font-weight: 500;
      color: var(--primary);
    }

    .queue__repo {
      color: var(--text-color);
      font-size: 0.875rem;
    }
  `,
})
export class QueuePanel {
  readonly queue = input.required<QueueSnapshot>();

  protected readonly rows = computed<QueueRow[]>(() => [
    ...this.queue().reviewing.map((pr) => ({ pr, position: 0 })),
    ...this.queue().pending.map((pr, index) => ({ pr, position: index + 1 })),
  ]);
}
