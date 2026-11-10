import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChatConversation } from '@shared/chat/chat-conversation';
import { ChatAttachment, ChatMessage } from '@shared/chat/chat.models';
import { ChatAttachmentsApi } from '@core/api/chat-attachments.api';
import { TasksApi } from './tasks.api';

/**
 * Chat para mejorar el plan de una tarea. La conversación vive en el navegador (una por tarea). Cuando la IA entiende que se
 * pidió un cambio al plan, avisa con `onUpdatesPlan`. Se provee a nivel de página.
 */
@Injectable()
export class TaskChatStore extends ChatConversation {
  private readonly api = inject(TasksApi);
  private readonly attachments = inject(ChatAttachmentsApi);

  protected readonly storagePrefix = 'workbench.chat.task.';

  /** Lo que se hace cuando la IA entendió que el usuario pidió cambiar el plan (ya con su respuesta en la conversación). */
  onUpdatesPlan: (() => void) | null = null;

  protected upload(file: File): Promise<ChatAttachment> {
    return firstValueFrom(this.attachments.upload(file));
  }

  protected async request(issueId: string, messages: ChatMessage[]): Promise<string> {
    const { reply, updatesPlan } = await firstValueFrom(this.api.chatTask(issueId, messages));
    // Después de que la respuesta entre a la conversación.
    if (updatesPlan) setTimeout(() => this.onUpdatesPlan?.(), 0);
    return reply;
  }
}
