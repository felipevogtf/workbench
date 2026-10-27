import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Agent, agentLabel, levelLabel } from '@ai-agents/index';
import { Badge, BadgeTone } from '@shared/ui/badge/badge';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
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
  imports: [Badge, MarkdownViewer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="assign" aria-label="Asignación de los tickets">
      <h2 class="assign__title">Asigna los tickets</h2>
      <p class="assign__hint">
        Lucy eligió un desarrollador según el nivel de cada ticket y repartió la revisión. Cámbialo
        si quieres y pulsa «Empezar el desarrollo». Abre «Ver el detalle» de un ticket para leer qué
        hay que hacer antes de decidir.
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

            <details class="row__detail">
              <summary>Ver el detalle del ticket {{ card.number }}</summary>
              <div class="row__detail-body">
                <h3>Descripción</h3>
                <app-markdown-viewer [content]="card.ticket.description" />
                @if (card.ticket.criteria.length > 0) {
                  <h3>Criterios de aceptación</h3>
                  <app-markdown-viewer [content]="list(card.ticket.criteria)" />
                }
                @if (card.ticket.files?.length) {
                  <h3>Archivos previstos</h3>
                  <app-markdown-viewer [content]="paths(card.ticket.files)" />
                }
              </div>
            </details>

            <label class="row__field">
              <span>Desarrolla</span>
              <select
                class="app-control"
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
                class="app-control"
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
      gap: var(--space-3);
    }

    .assign__title {
      margin: 0;
      font-size: 1.15rem;
      color: var(--primary);
    }

    .assign__hint {
      margin: 0;
      font-size: 0.9rem;
      color: var(--text-color);
    }

    .assign__list {
      display: grid;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .row {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--space-3) var(--space-4);
      align-items: center;
      padding: var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--background);
    }

    .row__number {
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: var(--radius-pill);
      background: var(--tone-neutral-bg);
      color: var(--primary);
      font-size: 0.85rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .row__main {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
    }

    .row__title {
      overflow-wrap: anywhere;
      color: var(--primary);
    }

    .row__detail {
      grid-column: 1 / -1;
      border-top: 1px solid var(--border);
      padding-top: var(--space-3);
      font-size: 0.9rem;
    }

    .row__detail summary {
      cursor: pointer;
      color: var(--primary);
      font-weight: 500;
    }

    .row__detail-body {
      display: grid;
      gap: var(--space-2);
      margin-top: var(--space-3);
      color: var(--primary);
    }

    .row__detail-body h3 {
      margin: var(--space-2) 0 0;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-color);
    }

    .row__field {
      display: grid;
      gap: var(--space-1);
      grid-column: 1 / -1;
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--text-color);
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

  protected list(items: readonly string[]): string {
    return items.map((item) => `- ${item}`).join('\n');
  }

  /** Las rutas, en código para que los guiones bajos no se lean como énfasis. */
  protected paths(files: readonly string[] | undefined): string {
    return this.list((files ?? []).map((file) => `\`${file}\``));
  }

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
