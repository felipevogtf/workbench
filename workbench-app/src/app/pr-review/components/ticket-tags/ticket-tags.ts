import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Badge } from '@shared/ui/badge/badge';
import { TicketLink } from '../../models/pull-request';

/** Tickets de Plane de una PR, como enlaces. Sin ninguno, muestra "Sin ticket". */
@Component({
  selector: 'app-ticket-tags',
  imports: [Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (ticket of tickets(); track ticket.key) {
      <a
        class="tag"
        [href]="ticket.url"
        target="_blank"
        rel="noopener noreferrer"
        [attr.aria-label]="'Abrir el ticket ' + ticket.key + ' en Plane'"
        >{{ ticket.key }}</a
      >
    } @empty {
      <app-badge dashed title="La rama y la descripción no referencian ningún ticket de Plane">
        Sin ticket
      </app-badge>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-1);
    }

    .tag {
      padding: 2px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      font-size: 0.8125rem;
      font-weight: 500;
      line-height: 1.5;
      text-decoration: none;
      color: var(--primary);
      transition: border-color 0.15s ease;

      &:hover {
        border-color: var(--primary);
      }
    }
  `,
})
export class TicketTags {
  readonly tickets = input.required<readonly TicketLink[]>();
}
