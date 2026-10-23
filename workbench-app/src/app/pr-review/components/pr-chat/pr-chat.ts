import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
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
  styleUrl: './pr-chat.scss',
})
export class PrChat {
  /** Qué PR es, para el encabezado (ej. `garage-labs/miobra-web #173`). */
  readonly context = input.required<string>();

  protected readonly store = inject(PullRequestChatStore);

  /** Solo el nombre del archivo: la ruta completa va en el tooltip. */
  protected fileName(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1);
  }
}
