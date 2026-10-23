import { computed, signal } from '@angular/core';
import { errorMessage } from '@shared/util/error-message';
import {
  ATTACHMENTS_ONLY_TEXT,
  ChatAttachment,
  ChatMessage,
  DraftAttachment,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_MESSAGE_CHARS,
  attachmentProblem,
} from './chat.models';

/** Cuántos mensajes se guardan en el navegador por conversación. */
const MAX_STORED_MESSAGES = 50;

/**
 * Una conversación de chat con la IA: sus mensajes, si el panel está abierto, si se espera una respuesta y
 * si falló, y los archivos que se están adjuntando al próximo mensaje. La conversación vive en el navegador
 * (una por clave: una PR, una tarea…) y viaja completa con cada pregunta, porque el servidor no guarda nada.
 * Cada pantalla la extiende diciendo cómo pedir la respuesta (`request`), cómo subir un archivo (`upload`) y
 * con qué prefijo se guarda (`storagePrefix`).
 */
export abstract class ChatConversation {
  private readonly messagesState = signal<ChatMessage[]>([]);
  private readonly openState = signal(false);
  private readonly sendingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly draftState = signal<DraftAttachment[]>([]);
  private readonly attachErrorState = signal<string | null>(null);
  private key: string | null = null;
  private nextDraft = 0;

  readonly messages = this.messagesState.asReadonly();
  readonly open = this.openState.asReadonly();
  readonly sending = this.sendingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Los archivos que se están adjuntando al próximo mensaje. */
  readonly draftAttachments = this.draftState.asReadonly();
  /** Por qué no se pudo adjuntar algo (tipo, tamaño o cantidad); se limpia al adjuntar de nuevo. */
  readonly attachError = this.attachErrorState.asReadonly();

  /** Hay una pregunta sin respuesta (falló): se puede reintentar. */
  readonly canRetry = computed(() => {
    const messages = this.messagesState();
    return messages.length > 0 && messages[messages.length - 1].role === 'user';
  });

  /** Algún archivo todavía se está subiendo: no se puede enviar hasta que termine. */
  readonly uploading = computed(() =>
    this.draftState().some((draft) => draft.status === 'uploading'),
  );

  /** Prefijo de la clave con que se guarda la conversación en el navegador. */
  protected abstract readonly storagePrefix: string;

  /** Pide la respuesta del asistente a la conversación (su último mensaje es del usuario). */
  protected abstract request(key: string, messages: ChatMessage[]): Promise<string>;

  /** Sube un archivo al servidor y devuelve el adjunto con su id. */
  protected abstract upload(file: File): Promise<ChatAttachment>;

  /** Cambia a la conversación de esta clave (la restaura del navegador si la hay). */
  bind(key: string): void {
    if (this.key === key) return;
    this.key = key;
    this.messagesState.set(this.load(key));
    this.errorState.set(null);
    this.draftState.set([]);
    this.attachErrorState.set(null);
  }

  toggle(): void {
    this.openState.update((open) => !open);
  }

  close(): void {
    this.openState.set(false);
  }

  /**
   * Sube los archivos elegidos y los deja listos para el próximo mensaje. Los que no se pueden adjuntar
   * (tipo, tamaño, o más de los permitidos) no se suben y se avisa por qué.
   */
  async attach(files: Iterable<File>): Promise<void> {
    this.attachErrorState.set(null);
    const uploads: Promise<void>[] = [];

    for (const file of files) {
      const taken = this.draftState().filter((draft) => draft.status !== 'error').length;
      if (taken >= MAX_ATTACHMENTS_PER_MESSAGE) {
        this.attachErrorState.set(`Máximo ${MAX_ATTACHMENTS_PER_MESSAGE} archivos por mensaje.`);
        break;
      }

      const problem = attachmentProblem(file);
      if (problem) {
        this.attachErrorState.set(`«${file.name}»: ${problem}`);
        continue;
      }
      uploads.push(this.startUpload(file));
    }
    await Promise.all(uploads);
  }

  removeAttachment(key: string): void {
    this.draftState.update((drafts) => drafts.filter((draft) => draft.key !== key));
    this.attachErrorState.set(null);
  }

  /** Hay algo para enviar (texto o archivos ya subidos) y nada lo impide. */
  canSend(text: string): boolean {
    return (
      !this.sendingState() &&
      !this.uploading() &&
      (text.trim().length > 0 || this.readyAttachments().length > 0)
    );
  }

  /** Abre el chat y manda el mensaje (ej. «explícame este segmento»). */
  ask(text: string): Promise<void> {
    this.openState.set(true);
    return this.send(text);
  }

  async send(text: string): Promise<void> {
    if (!this.canSend(text)) return;

    const attachments = this.readyAttachments();
    const content = text.trim() || ATTACHMENTS_ONLY_TEXT;
    this.messagesState.update((messages) => [
      ...messages,
      { role: 'user', content, ...(attachments.length > 0 && { attachments }) },
    ]);
    this.draftState.set([]);
    this.attachErrorState.set(null);
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
    this.draftState.set([]);
    this.attachErrorState.set(null);
    this.persist();
  }

  /** La conversación tal como se envía al servidor: cada mensaje recortado al largo que acepta. */
  snapshot(): ChatMessage[] {
    return this.messagesState().map(({ role, content, attachments }) => ({
      role,
      content: content.slice(0, MAX_MESSAGE_CHARS),
      ...(attachments && attachments.length > 0 && { attachments }),
    }));
  }

  private readyAttachments(): ChatAttachment[] {
    return this.draftState().flatMap((draft) =>
      draft.status === 'ready' && draft.attachment ? [draft.attachment] : [],
    );
  }

  private async startUpload(file: File): Promise<void> {
    const key = `draft-${this.nextDraft++}`;
    const owner = this.key;
    this.draftState.update((drafts) => [
      ...drafts,
      { key, name: file.name, size: file.size, status: 'uploading' },
    ]);

    // Si mientras tanto se pasó a otra conversación, el resultado ya no corresponde a esta.
    const update = (change: Partial<DraftAttachment>) => {
      if (this.key !== owner) return;
      this.draftState.update((drafts) =>
        drafts.map((draft) => (draft.key === key ? { ...draft, ...change } : draft)),
      );
    };

    try {
      // Solo lo que el mensaje necesita guardar y enviar (el servidor responde con algo más, como el tipo MIME).
      const { id, name, kind, size } = await this.upload(file);
      update({ status: 'ready', attachment: { id, name, kind, size } });
    } catch (error) {
      update({ status: 'error', error: errorMessage(error) });
    }
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
      return parsed
        .filter(
          (item): item is ChatMessage =>
            !!item &&
            (item.role === 'user' || item.role === 'assistant') &&
            typeof item.content === 'string',
        )
        .map(({ role, content, attachments }): ChatMessage => {
          const valid = Array.isArray(attachments)
            ? attachments.filter(
                (file) => !!file && typeof file.id === 'string' && typeof file.name === 'string',
              )
            : [];
          return valid.length > 0 ? { role, content, attachments: valid } : { role, content };
        });
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
