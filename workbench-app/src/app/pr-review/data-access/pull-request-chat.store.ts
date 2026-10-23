import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { ChatMessage, MAX_MESSAGE_CHARS } from '../models/chat';
import { PullRequestsApi } from './pull-requests.api';

const STORAGE_PREFIX = 'workbench.chat.pr.';
/** Cuántos mensajes se guardan en el navegador por PR. */
const MAX_STORED_MESSAGES = 50;

/**
 * Chat sobre una PR. La conversación vive en el navegador (una por PR) y viaja completa con cada
 * pregunta, porque el servidor no guarda nada. Se provee a nivel de página.
 */
@Injectable()
export class PullRequestChatStore {
  private readonly api = inject(PullRequestsApi);

  private readonly messagesState = signal<ChatMessage[]>([]);
  private readonly openState = signal(false);
  private readonly sendingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private pullRequestId: string | null = null;

  readonly messages = this.messagesState.asReadonly();
  readonly open = this.openState.asReadonly();
  readonly sending = this.sendingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  /** Hay una pregunta sin respuesta (falló): se puede reintentar. */
  readonly canRetry = computed(() => {
    const messages = this.messagesState();
    return messages.length > 0 && messages[messages.length - 1].role === 'user';
  });

  /** Cambia la conversación a la de esta PR. */
  bind(pullRequestId: string): void {
    if (this.pullRequestId === pullRequestId) return;
    this.pullRequestId = pullRequestId;
    this.messagesState.set(this.load(pullRequestId));
    this.errorState.set(null);
  }

  toggle(): void {
    this.openState.update((open) => !open);
  }

  close(): void {
    this.openState.set(false);
  }

  /** Abre el chat y manda el mensaje (ej. «explícame este segmento»). */
  ask(text: string): Promise<void> {
    this.openState.set(true);
    return this.send(text);
  }

  async send(text: string): Promise<void> {
    const content = text.trim();
    if (!content || this.sendingState()) return;

    this.messagesState.update((messages) => [...messages, { role: 'user', content }]);
    await this.reply();
  }

  /** Vuelve a pedir la respuesta a la última pregunta, que quedó sin contestar. */
  async retry(): Promise<void> {
    if (!this.canRetry() || this.sendingState()) return;
    await this.reply();
  }

  clear(): void {
    this.messagesState.set([]);
    this.errorState.set(null);
    this.persist();
  }

  private async reply(): Promise<void> {
    const id = this.pullRequestId;
    if (!id) return;

    this.sendingState.set(true);
    this.errorState.set(null);
    this.persist();
    try {
      const messages = this.messagesState().map(({ role, content }) => ({
        role,
        content: content.slice(0, MAX_MESSAGE_CHARS),
      }));
      const { reply } = await firstValueFrom(this.api.chat(id, messages));

      // Si mientras tanto se pasó a otra PR, la respuesta ya no corresponde a esta conversación.
      if (this.pullRequestId === id) {
        this.messagesState.update((current) => [...current, { role: 'assistant', content: reply }]);
      }
    } catch (error) {
      if (this.pullRequestId === id) this.errorState.set(errorMessage(error));
    } finally {
      this.sendingState.set(false);
      this.persist();
    }
  }

  /** El almacenamiento puede no estar (modo privado, datos bloqueados): el chat sigue sin guardarse. */
  private load(id: string): ChatMessage[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_PREFIX + id) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item): item is ChatMessage =>
          !!item &&
          (item.role === 'user' || item.role === 'assistant') &&
          typeof item.content === 'string',
      );
    } catch {
      return [];
    }
  }

  private persist(): void {
    if (!this.pullRequestId) return;
    try {
      const messages = this.messagesState().slice(-MAX_STORED_MESSAGES);
      if (messages.length === 0) {
        localStorage.removeItem(STORAGE_PREFIX + this.pullRequestId);
      } else {
        localStorage.setItem(STORAGE_PREFIX + this.pullRequestId, JSON.stringify(messages));
      }
    } catch {
      // Sin almacenamiento no se guarda la conversación.
    }
  }
}
