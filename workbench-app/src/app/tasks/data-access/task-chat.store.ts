import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChatConversation } from '@shared/chat/chat-conversation';
import { ChatAttachment, ChatMessage } from '@shared/chat/chat.models';
import { ChatAttachmentsApi } from '@core/api/chat-attachments.api';
import { TasksApi } from './tasks.api';

/**
 * Chat para mejorar el plan de una tarea. La conversación vive en el navegador (una por tarea) y se
 * limpia al replanificar, porque el plan nuevo ya la incorporó. Se provee a nivel de página.
 */
@Injectable()
export class TaskChatStore extends ChatConversation {
  private readonly api = inject(TasksApi);
  private readonly attachments = inject(ChatAttachmentsApi);

  protected readonly storagePrefix = 'workbench.chat.task.';

  protected upload(file: File): Promise<ChatAttachment> {
    return firstValueFrom(this.attachments.upload(file));
  }

  protected async request(issueId: string, messages: ChatMessage[]): Promise<string> {
    const { reply } = await firstValueFrom(this.api.chatTask(issueId, messages));
    return reply;
  }
}
