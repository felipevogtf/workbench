export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Largo máximo de un mensaje que acepta el servidor; lo que pase de ahí se recorta al enviarlo. */
export const MAX_MESSAGE_CHARS = 30_000;
