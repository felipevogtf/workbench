import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChatPanel } from '@shared/chat/chat-panel/chat-panel';
import { Icon } from '@shared/ui/icon/icon';
import { PullRequestChatStore } from '../../data-access/pull-request-chat.store';

/**
 * Chat flotante para preguntarle a la IA sobre la PR (el agente lee el repo de la PR). Le avisa de qué
 * archivo del diff se está mirando y lo muestra arriba, para que se vea qué contexto tiene.
 */
@Component({
  selector: 'app-pr-chat',
  imports: [ChatPanel, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pr-chat.html',
})
export class PrChat {
  /** Qué PR es, para el encabezado (ej. `garage-labs/miobra-web #173`). */
  readonly context = input.required<string>();

  protected readonly store = inject(PullRequestChatStore);

  /** Preguntas para empezar. */
  protected readonly suggestions = [
    '¿Qué hace esta pull request, en pocas líneas?',
    '¿Ves algún riesgo o error en estos cambios?',
    '¿Qué pruebas faltarían para darla por buena?',
  ];

  /** Qué archivo sabe la IA que se está mirando: solo su nombre; la ruta completa va en el tooltip. */
  protected readonly info = computed(() => {
    const file = this.store.context();
    return file ? `Hablando de ${file.path.slice(file.path.lastIndexOf('/') + 1)}` : null;
  });
}
