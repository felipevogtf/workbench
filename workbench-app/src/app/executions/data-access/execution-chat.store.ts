import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChatConversation } from '@shared/chat/chat-conversation';
import { ChatAttachment, ChatMessage } from '@shared/chat/chat.models';
import { ChatProposal } from '../models/execution';
import { ExecutionsApi } from './executions.api';

/**
 * Chat con Lucy sobre una ejecución. La conversación vive en el navegador (una por ejecución) y viaja
 * completa con cada pregunta. No lleva archivos adjuntos. Se provee a nivel de página.
 */
@Injectable()
export class ExecutionChatStore extends ChatConversation {
  private readonly api = inject(ExecutionsApi);

  protected readonly storagePrefix = 'workbench.chat.execution.';

  protected upload(): Promise<ChatAttachment> {
    return Promise.reject(new Error('Este chat no acepta archivos'));
  }

  /** Lo que Lucy propone en su última respuesta (notas, tickets, la revisión final), a la espera de que el usuario lo confirme. */
  readonly proposals = signal<ChatProposal[]>([]);

  protected async request(executionId: string, messages: ChatMessage[]): Promise<string> {
    this.proposals.set([]);
    const { reply, proposals } = await firstValueFrom(this.api.chat(executionId, messages));
    this.proposals.set(proposals ?? []);
    return reply;
  }
}
