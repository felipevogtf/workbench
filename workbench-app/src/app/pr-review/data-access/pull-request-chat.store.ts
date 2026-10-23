import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChatConversation } from '@shared/chat/chat-conversation';
import { ChatMessage } from '@shared/chat/chat.models';
import { ChatFileContext } from '../models/chat';
import { PullRequestsApi } from './pull-requests.api';

/** Chat sobre una PR. La conversación vive en el navegador (una por PR). Se provee a nivel de página. */
@Injectable()
export class PullRequestChatStore extends ChatConversation {
  private readonly api = inject(PullRequestsApi);
  private readonly contextState = signal<ChatFileContext | null>(null);

  protected readonly storagePrefix = 'workbench.chat.pr.';

  /** El archivo que el usuario tiene abierto: va con cada pregunta. */
  readonly context = this.contextState.asReadonly();

  /** Cambia el archivo que se le dice a la IA que el usuario está mirando (null = ninguno). */
  setContext(context: ChatFileContext | null): void {
    this.contextState.set(context);
  }

  protected async request(pullRequestId: string, messages: ChatMessage[]): Promise<string> {
    const { reply } = await firstValueFrom(
      this.api.chat(pullRequestId, messages, this.contextState() ?? undefined),
    );
    return reply;
  }
}
