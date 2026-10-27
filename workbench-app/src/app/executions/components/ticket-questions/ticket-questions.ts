import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Button } from '@shared/ui/button/button';
import { BoardCard, Worker } from '../../models/execution';

/**
 * Las preguntas de los desarrolladores que esperan al usuario: Lucy se las escala con su recomendación.
 * El usuario puede aceptarla o escribir su propia respuesta. Esta pieza no guarda nada: avisa al padre.
 */
@Component({
  selector: 'app-ticket-questions',
  imports: [Avatar, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="questions" aria-label="Preguntas de los trabajadores">
      @for (card of cards(); track card.ticket.id) {
        @let question = card.ticket.question;
        @if (question) {
          <article class="question">
            <header class="question__head">
              @if (lucy(); as who) {
                <app-avatar [name]="who.name" [src]="who.avatar" size="2.25rem" />
              }
              <strong>{{ lucy()?.name ?? 'Lucy' }} necesita tu respuesta</strong>
            </header>

            <p class="question__about">
              <strong>{{ question.from }}</strong> pregunta en el ticket {{ card.number }} «{{
                card.ticket.title
              }}»:
            </p>
            <blockquote class="question__text">{{ question.text }}</blockquote>

            @if (question.recommendation) {
              <p class="question__reco">
                <strong>Recomendación de {{ lucy()?.name ?? 'Lucy' }}:</strong>
                {{ question.recommendation }}
              </p>
              <button
                app-button
                variant="secondary"
                size="sm"
                type="button"
                [disabled]="busy()"
                (click)="accept(card)"
              >
                Usar la recomendación
              </button>
            } @else {
              <p class="question__reco muted">
                {{ lucy()?.name ?? 'Lucy' }} está pensando qué recomendar…
              </p>
            }

            <form class="question__form" (submit)="$event.preventDefault(); send(card, box)">
              <label>
                <span>Tu respuesta</span>
                <textarea
                  #box
                  class="app-control"
                  rows="3"
                  [disabled]="busy()"
                  [attr.aria-label]="'Respuesta para ' + question.from"
                ></textarea>
              </label>
              <button app-button size="sm" type="submit" [disabled]="busy()">Responder</button>
            </form>
          </article>
        }
      }
    </section>
  `,
  styles: `
    .questions {
      display: grid;
      gap: var(--space-3);
    }

    .question {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-4);
      border: 1px solid var(--warning);
      border-radius: var(--border-radius);
      background: var(--tone-warning-bg);
    }

    .question__head {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .question__about,
    .question__reco {
      margin: 0;
    }

    .question__text {
      margin: 0;
      padding-left: var(--space-3);
      border-left: 3px solid var(--warning);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .muted {
      opacity: 0.7;
    }

    .question__form {
      display: grid;
      gap: var(--space-2);
      justify-items: start;
    }

    .question__form label {
      display: grid;
      gap: var(--space-1);
      width: 100%;
      font-size: 0.8125rem;
    }

    .question__form textarea {
      min-height: 5.5rem;
    }
  `,
})
export class TicketQuestions {
  /** Solo las tarjetas con una pregunta pendiente. */
  readonly cards = input.required<readonly BoardCard[]>();
  readonly lucy = input<Worker | null>(null);
  readonly busy = input(false);

  readonly answer = output<{ ticketId: string; text: string }>();

  protected accept(card: BoardCard): void {
    const text = card.ticket.question?.recommendation;
    if (text) this.answer.emit({ ticketId: card.ticket.id, text });
  }

  protected send(card: BoardCard, box: HTMLTextAreaElement): void {
    const text = box.value.trim();
    if (!text) return;
    this.answer.emit({ ticketId: card.ticket.id, text });
    box.value = '';
  }
}
