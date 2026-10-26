import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Agent, agentLabel, levelLabel } from '@ai-agents/index';
import { Badge, BadgeTone } from '@shared/ui/badge/badge';
import { BoardCard, TICKET_LEVEL_LABEL, TicketLevel } from '../../models/execution';

const LEVEL_TONE: Record<TicketLevel, BadgeTone> = {
  simple: 'neutral',
  medium: 'info',
  complex: 'warning',
};

/**
 * Los tickets recién creados con quién los desarrollará y quién los revisará, para que el usuario lo
 * ajuste antes de empezar. Cambiar un selector avisa al padre; esta pieza no guarda nada.
 */
@Component({
  selector: 'app-ticket-assignment',
  imports: [Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="assign" aria-label="Asignación de los tickets">
      <h2 class="assign__title">Asigna los tickets</h2>
      <p class="assign__hint">
        Lucy eligió un desarrollador según el nivel de cada ticket y repartió la revisión. Cámbialo
        si quieres y pulsa «Empezar el desarrollo».
      </p>

      <ol class="assign__list">
        @for (card of cards(); track card.ticket.id) {
          <li class="row">
            <span class="row__number" aria-hidden="true">{{ card.number }}</span>
            <div class="row__main">
              <strong class="row__title">{{ card.ticket.title }}</strong>
              <app-badge [tone]="tone[card.ticket.level]">{{
                levelName[card.ticket.level]
              }}</app-badge>
              @if (card.repo) {
                <app-badge tone="info">{{ card.repo }}</app-badge>
              }
            </div>

            <label class="row__field">
              <span>Desarrolla</span>
              <select
                [disabled]="busy()"
                [attr.aria-label]="'Desarrollador del ticket ' + card.number"
                (change)="pick(card, 'developerId', $event)"
              >
                @for (agent of developers(); track agent.id) {
                  <option [value]="agent.id" [selected]="agent.id === card.ticket.developerId">
                    {{ describe(agent) }}
                  </option>
                }
              </select>
            </label>

            <label class="row__field">
              <span>Revisa</span>
              <select
                [disabled]="busy()"
                [attr.aria-label]="'Revisor del ticket ' + card.number"
                (change)="pick(card, 'reviewerId', $event)"
              >
                @for (agent of reviewers(); track agent.id) {
                  <option [value]="agent.id" [selected]="agent.id === card.ticket.reviewerId">
                    {{ describe(agent) }}
                  </option>
                }
              </select>
            </label>
          </li>
        }
      </ol>
    </section>
  `,
  styles: `
    .assign {
      display: grid;
      gap: 0.75rem;
    }

    .assign__title {
      margin: 0;
      font-size: 1.05rem;
    }

    .assign__hint {
      margin: 0;
      font-size: 0.9rem;
      color: var(--color-text-muted, #94a3b8);
    }

    .assign__list {
      display: grid;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .row {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.75rem 1rem;
      align-items: center;
      padding: 0.75rem 1rem;
      border: 1px solid var(--color-border, #2a2a36);
      border-radius: 0.75rem;
    }

    .row__number {
      color: var(--color-text-muted, #94a3b8);
      font-variant-numeric: tabular-nums;
    }

    .row__main {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }

    .row__title {
      overflow-wrap: anywhere;
    }

    .row__field {
      display: grid;
      gap: 0.25rem;
      grid-column: 1 / -1;
      font-size: 0.8rem;
      color: var(--color-text-muted, #94a3b8);
    }

    .row__field select {
      min-height: 2.5rem;
      padding: 0 0.75rem;
      border: 1px solid var(--color-border, #2a2a36);
      border-radius: 0.5rem;
      background: transparent;
      color: inherit;
      font: inherit;
    }

    @media (min-width: 48rem) {
      .row {
        grid-template-columns: auto minmax(0, 1fr) 14rem 14rem;
      }

      .row__field {
        grid-column: auto;
      }
    }
  `,
})
export class TicketAssignment {
  readonly cards = input.required<BoardCard[]>();
  readonly developers = input<Agent[]>([]);
  readonly reviewers = input<Agent[]>([]);
  readonly busy = input(false);

  readonly assign = output<{ ticketId: string; developerId?: string; reviewerId?: string }>();

  protected readonly tone = LEVEL_TONE;
  protected readonly levelName = TICKET_LEVEL_LABEL;

  /** «Rebecca · Simple», para que se sepa para qué sirve cada uno. */
  protected describe(agent: Agent): string {
    const level = levelLabel(agent.level);
    return level ? `${agentLabel(agent)} · ${level}` : agentLabel(agent);
  }

  protected pick(card: BoardCard, field: 'developerId' | 'reviewerId', event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value && value !== card.ticket[field]) {
      this.assign.emit({ ticketId: card.ticket.id, [field]: value });
    }
  }
}
