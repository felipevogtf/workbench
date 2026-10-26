import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { AgentsStore } from '@ai-agents/index';
import { ChatPanel } from '@shared/chat/chat-panel/chat-panel';
import { ExecutionChatStore } from '../../data-access/execution-chat.store';

/**
 * Chat flotante con Lucy sobre una ejecución: ella conoce el estado completo (tickets, quién los tiene,
 * errores, plan) y contesta; no cambia nada. Su avatar es el botón del chat. Necesita que la página
 * provea el `ExecutionChatStore`.
 */
@Component({
  selector: 'app-execution-chat',
  imports: [ChatPanel],
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
        lo que pasó y te recomienda qué hacer, pero no cambia nada: para eso usas los botones de la
        pantalla.
      </p>
    </app-chat-panel>
  `,
})
export class ExecutionChat {
  readonly executionId = input.required<string>();
  /** Las preguntas de los desarrolladores que esperan respuesta: Lucy avisa de cada una nueva. */
  readonly questions = input<{ id: string; from: string; ticket: number; text: string }[]>([]);
  /** Sobre qué se conversa, bajo el título (ej. `acme/web · workbench/…`). */
  readonly context = input('');

  protected readonly chat = inject(ExecutionChatStore);
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

  constructor() {
    effect(() => this.chat.bind(this.executionId()));

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
