import { computed, signal } from '@angular/core';
import { errorMessage } from '@shared/util/error-message';
import { ChatMessage, MAX_MESSAGE_CHARS } from './chat.models';

/** Cuántos mensajes se guardan en el navegador por conversación. */
const MAX_STORED_MESSAGES = 50;

/**
 * Una conversación de chat con la IA: sus mensajes, si el panel está abierto, si se espera una respuesta y
 * si falló. La conversación vive en el navegador (una por clave: una PR, una tarea…) y viaja completa con
 * cada pregunta, porque el servidor no guarda nada. Cada pantalla la extiende diciendo cómo pedir la
 * respuesta (`request`) y con qué prefijo se guarda (`storagePrefix`).
 */
export abstract class ChatConversation {
  private readonly messagesState = signal<ChatMessage[]>([]);
  private readonly openState = signal(false);
  private readonly sendingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private key: string | null = null;

  readonly messages = this.messagesState.asReadonly();
  readonly open = this.openState.asReadonly();
  readonly sending = this.sendingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  /** Hay una pregunta sin respuesta (falló): se puede reintentar. */
  readonly canRetry = computed(() => {
    const messages = this.messagesState();
    return messages.length > 0 && messages[messages.length - 1].role === 'user';
  });

  /** Prefijo de la clave con que se guarda la conversación en el navegador. */
  protected abstract readonly storagePrefix: string;

  /** Pide la respuesta del asistente a la conversación (su último mensaje es del usuario). */
  protected abstract request(key: string, messages: ChatMessage[]): Promise<string>;

  /** Cambia a la conversación de esta clave (la restaura del navegador si la hay). */
  bind(key: string): void {
    if (this.key === key) return;
    this.key = key;
    this.messagesState.set(this.load(key));
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

  /** La conversación tal como se envía al servidor: cada mensaje recortado al largo que acepta. */
  snapshot(): ChatMessage[] {
    return this.messagesState().map(({ role, content }) => ({
      role,
      content: content.slice(0, MAX_MESSAGE_CHARS),
    }));
  }

  private async reply(): Promise<void> {
    const key = this.key;
    if (!key) return;

    this.sendingState.set(true);
    this.errorState.set(null);
    this.persist();
    try {
      const reply = await this.request(key, this.snapshot());

      // Si mientras tanto se pasó a otra conversación, la respuesta ya no corresponde a esta.
      if (this.key === key) {
        this.messagesState.update((current) => [...current, { role: 'assistant', content: reply }]);
      }
    } catch (error) {
      if (this.key === key) this.errorState.set(errorMessage(error));
    } finally {
      this.sendingState.set(false);
      this.persist();
    }
  }

  /** El almacenamiento puede no estar (modo privado, datos bloqueados): el chat sigue sin guardarse. */
  private load(key: string): ChatMessage[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(this.storagePrefix + key) ?? '[]');
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
    if (!this.key) return;
    try {
      const messages = this.messagesState().slice(-MAX_STORED_MESSAGES);
      if (messages.length === 0) {
        localStorage.removeItem(this.storagePrefix + this.key);
      } else {
        localStorage.setItem(this.storagePrefix + this.key, JSON.stringify(messages));
      }
    } catch {
      // Sin almacenamiento no se guarda la conversación.
    }
  }
}
