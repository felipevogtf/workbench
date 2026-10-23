import {
  StagedAttachment,
  attachmentLines,
  attachmentsNote,
} from '@core/attachments/attachments';
import { PlanChatMessage } from './entities/plan.props';

/** Largo máximo de un mensaje del chat de una tarea (el mismo tope que valida el endpoint). */
export const MAX_CHAT_MESSAGE_CHARS = 30_000;

const SPEAKER: Record<PlanChatMessage['role'], string> = {
  user: 'Usuario',
  assistant: 'Asistente',
};

export interface ConversationLimits {
  /** Cuántos mensajes como máximo (los más recientes). */
  maxMessages: number;
  /** Cuántos caracteres como máximo entre todos los mensajes (se descartan los más antiguos). */
  maxChars: number;
}

/**
 * La conversación como texto para el prompt. Si no cabe, se queda con los mensajes más recientes y avisa
 * cuántos dejó fuera: lo último que se dijo pesa más que lo del principio.
 */
export function conversationLines(
  messages: readonly PlanChatMessage[],
  { maxMessages, maxChars }: ConversationLimits,
  staged: ReadonlyMap<string, StagedAttachment> = new Map(),
): string[] {
  const kept: string[][] = [];
  let used = 0;

  for (let i = messages.length - 1; i >= 0 && kept.length < maxMessages; i--) {
    const { role, content } = messages[i];
    const text =
      content.length > MAX_CHAT_MESSAGE_CHARS
        ? `${content.slice(0, MAX_CHAT_MESSAGE_CHARS).trimEnd()}\n…(recortado)`
        : content;
    // Siempre entra el último mensaje, aunque solo; después, mientras quepa.
    if (kept.length > 0 && used + text.length > maxChars) break;
    used += text.length;
    kept.unshift([
      `### ${SPEAKER[role]}`,
      text,
      ...attachmentLines(messages[i].attachments ?? [], staged),
      '',
    ]);
  }

  const omitted = messages.length - kept.length;
  const hasAttachments = messages
    .slice(messages.length - kept.length)
    .some((message) => (message.attachments?.length ?? 0) > 0);
  return [
    ...(hasAttachments ? attachmentsNote() : []),
    ...(omitted > 0 ? [`(${omitted} mensajes anteriores omitidos)`, ''] : []),
    ...kept.flat(),
  ];
}

/** Lo que dijo el usuario, del mensaje más reciente al más antiguo (para buscar tickets que mencionó). */
export function userTexts(messages: readonly PlanChatMessage[]): string[] {
  return messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .reverse();
}
