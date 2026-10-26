import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { AgentsStore } from '@ai-agents/index';
import { ChatPanel } from '@shared/chat/chat-panel/chat-panel';
import { Button } from '@shared/ui/button/button';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { ExecutionChatStore } from '../../data-access/execution-chat.store';
import { ExecutionStore } from '../../data-access/execution.store';
import { NoteProposal } from '../../models/execution';

/**
 * Chat flotante con Lucy sobre una ejecución: ella conoce el estado completo (tickets, quién los tiene,
 * errores, plan) y contesta; no cambia nada. Su avatar es el botón del chat. Necesita que la página
 * provea el `ExecutionChatStore`.
 */
@Component({
  selector: 'app-execution-chat',
  imports: [ChatPanel, Button, MarkdownViewer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-chat-panel
      [store]="chat"
      [heading]="'Habla con ' + (lucy()?.name ?? 'la IA')"
      [context]="context()"
      [assistant]="lucy()"
      [attachments]="false"
      emptyTitle="¿Qué quieres saber de la ejecución?"
      placeholder="Pregunta cómo va, por qué falló algo o qué hacer ahora…"
      [suggestions]="suggestions"
    >
      <p chat-empty>
        Conoce la tarea, el plan, los tickets, quién trabaja en cada uno y los errores. Te explica
        lo que pasó y te recomienda qué hacer. Si quieres que un trabajador sepa algo, ella te
        propone una nota para su ticket y tú la confirmas; lo demás lo haces con los botones de la
        pantalla.
      </p>
      @if (chat.proposals().length > 0) {
        <div chat-actions class="proposals">
          @for (proposal of chat.proposals(); track proposal) {
            <article class="proposal">
              <p class="proposal__about">Nota para el ticket {{ proposal.ticket }}</p>
              <div class="proposal__text" [class.proposal__text--clamped]="!isOpen(proposal)">
                <app-markdown-viewer [content]="proposal.text" />
              </div>
              @if (proposal.text.length > longNote) {
                <button type="button" class="proposal__more" (click)="toggle(proposal)">
                  {{ isOpen(proposal) ? 'Ver menos' : 'Ver la nota completa' }}
                </button>
              }
              <div class="proposal__buttons">
                <button
                  app-button
                  variant="secondary"
                  size="sm"
                  type="button"
                  [disabled]="store.acting()"
                  (click)="pass(proposal)"
                >
                  Dejar la nota
                </button>
                @if (store.detail()?.status === 'failed') {
                  <button
                    app-button
                    size="sm"
                    type="button"
                    [disabled]="store.acting()"
                    (click)="pass(proposal, true)"
                  >
                    Dejar la nota y reintentar
                  </button>
                }
              </div>
            </article>
          }
        </div>
      }
    </app-chat-panel>
  `,
  styles: `
    /* Una nota puede ser larga: el pie no pasa de un tramo del panel y se desplaza, para no tapar la conversación. */
    .proposals {
      display: grid;
      gap: var(--space-2);
      max-height: 40vh;
      overflow-y: auto;
    }

    .proposal {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-3);
      border: 1px solid var(--border);
      border-radius: var(--border-radius);
    }

    .proposal__about {
      margin: 0;
      font-size: 0.8125rem;
      font-weight: 600;
    }

    .proposal__text {
      margin: 0;
      overflow-wrap: anywhere;
    }

    /* El texto es Markdown (varios bloques): se recorta por altura, no por líneas. */
    .proposal__text--clamped {
      max-height: 6.5rem;
      overflow: hidden;
    }

    .proposal__more {
      justify-self: start;
      padding: 0;
      border: 0;
      background: none;
      color: var(--primary);
      font: inherit;
      font-size: 0.8125rem;
      cursor: pointer;
    }

    .proposal__buttons {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
  `,
})
export class ExecutionChat {
  readonly executionId = input.required<string>();
  /** Las preguntas de los desarrolladores que esperan respuesta: Lucy avisa de cada una nueva. */
  readonly questions = input<{ id: string; from: string; ticket: number; text: string }[]>([]);
  /** Las dudas que dejaron los agentes al avanzar sin detenerse: Lucy comenta cada una nueva. */
  readonly doubts = input<{ id: string; from: string; ticket: number; text: string }[]>([]);
  /** Sobre qué se conversa, bajo el título (ej. `acme/web · workbench/…`). */
  readonly context = input('');

  protected readonly chat = inject(ExecutionChatStore);
  protected readonly store = inject(ExecutionStore);
  private readonly agents = inject(AgentsStore);

  /** Quien contesta: el agente que crea los tickets, con el nombre y la imagen con que se ve en el tablero. */
  protected readonly lucy = computed(() => this.agents.assistantOf('task-tickets'));

  protected readonly suggestions = [
    '¿Cómo va la ejecución?',
    '¿Qué hizo cada trabajador hasta ahora?',
    '¿Por qué falló?',
    '¿Qué debería hacer ahora?',
  ];

  /** Las preguntas que ya se vieron: al abrir la página las que ya había no se anuncian como nuevas. */
  private seen: Set<string> | null = null;

  /** El usuario confirma la nota que propuso Lucy: queda en el ticket y el agente la verá la próxima vez. */
  protected async pass(proposal: NoteProposal, retry = false): Promise<void> {
    if (!(await this.store.addNote(proposal.ticketId, proposal.text))) return;
    this.chat.proposals.update((all) => all.filter((other) => other !== proposal));
    const left = `Listo: dejé la nota en el ticket ${proposal.ticket} «${proposal.title}».`;

    if (retry && (await this.store.retry())) {
      this.chat.receive(`${left} Volví a lanzar la ejecución: el agente la verá al retomarla.`);
      return;
    }
    this.chat.receive(
      `${left} El agente la verá la próxima vez que lo trabaje; si el ticket falló, usa **Reintentar**.`,
    );
  }

  /** Desde cuántos caracteres una nota se muestra recortada, con «Ver la nota completa». */
  protected readonly longNote = 200;

  /** Las notas propuestas que el usuario abrió completas. */
  private readonly opened = signal<ReadonlySet<NoteProposal>>(new Set());

  protected isOpen(proposal: NoteProposal): boolean {
    return this.opened().has(proposal);
  }

  protected toggle(proposal: NoteProposal): void {
    this.opened.update((current) => {
      const next = new Set(current);
      if (!next.delete(proposal)) next.add(proposal);
      return next;
    });
  }

  /** Las dudas que ya se vieron, igual que las preguntas. */
  private seenDoubts: Set<string> | null = null;

  /** El estado en que se vio la ejecución; `undefined` = todavía no se ha visto. */
  private status: string | undefined;

  constructor() {
    effect(() => this.chat.bind(this.executionId()));

    // Si la ejecución falla con la página abierta, Lucy lo dice en su chat para platicar qué hacer. Sin llamar al
    // modelo: es el error tal cual, y la conversación empieza cuando el usuario responde.
    effect(() => {
      const detail = this.store.detail();
      untracked(() => {
        if (!detail) return;
        const failedNow =
          detail.status === 'failed' && this.status !== undefined && this.status !== 'failed';
        this.status = detail.status;
        if (!failedNow) return;
        const error = (detail.error ?? 'sin detalle').replace(/\s+/g, ' ').slice(0, 300);
        this.chat.receive(
          `**La ejecución falló.**\n\n> ${error}\n\nSi quieres, platicamos qué hacer: te recomiendo algo y, cuando lo decidamos, dejo la nota para el agente.`,
        );
      });
    });

    // Una duda no detiene nada: Lucy la comenta para que el usuario decida si hay que corregir al agente.
    effect(() => {
      const doubts = this.doubts();
      untracked(() => {
        if (this.seenDoubts === null) {
          this.seenDoubts = new Set(doubts.map((doubt) => doubt.id));
          return;
        }
        for (const doubt of doubts) {
          if (this.seenDoubts.has(doubt.id)) continue;
          this.seenDoubts.add(doubt.id);
          this.chat.receive(
            `**${doubt.from}** avanzó en el ticket ${doubt.ticket}, pero dejó una duda:\n\n> ${doubt.text.replace(/\n/g, '\n> ')}\n\nNo detuvo nada. ¿Lo dejamos así? Si no, platicamos qué corregir y le dejo una nota.`,
          );
        }
      });
    });

    effect(() => {
      const questions = this.questions();
      untracked(() => {
        if (this.seen === null) {
          this.seen = new Set(questions.map((question) => question.id));
          return;
        }
        for (const question of questions) {
          if (this.seen.has(question.id)) continue;
          this.seen.add(question.id);
          this.chat.receive(
            `**${question.from}** me preguntó en el ticket ${question.ticket}:\n\n> ${question.text.replace(/\n/g, '\n> ')}\n\nTe lo dejé arriba, en «necesita tu respuesta», para que contestes.`,
          );
        }
      });
    });
  }
}
