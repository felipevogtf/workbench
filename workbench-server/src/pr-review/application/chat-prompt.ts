import {
  AttachmentRef,
  StagedAttachment,
  attachmentLines,
  attachmentsNote,
} from '@core/attachments/attachments';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: AttachmentRef[];
}

/** El archivo que el usuario tiene abierto en el diff mientras conversa. */
export interface ChatFileContext {
  path: string;
  status?: 'added' | 'deleted' | 'modified' | 'renamed';
  /** Ruta anterior, si el archivo se renombró. */
  oldPath?: string;
}

const STATUS_TEXT: Record<NonNullable<ChatFileContext['status']>, string> = {
  added: 'añadido en esta PR',
  deleted: 'eliminado en esta PR',
  modified: 'modificado en esta PR',
  renamed: 'renombrado en esta PR',
};

/** Cuántos mensajes anteriores se reenvían al agente (que no recuerda nada entre una pregunta y otra). */
export const MAX_HISTORY_MESSAGES = 20;
export const MAX_MESSAGE_CHARS = 30_000;
const MAX_DESCRIPTION_CHARS = 3000;

const SPEAKER: Record<ChatMessage['role'], string> = {
  user: 'Usuario',
  assistant: 'Asistente',
};

/**
 * Contexto que recibe el agente del chat: de qué PR se habla, qué hay en su directorio de trabajo y
 * la conversación hasta ahora. El agente no guarda memoria, así que la conversación va completa
 * (recortada a los últimos mensajes) en cada pregunta.
 */
export function buildChatPrompt(
  pullRequest: PullRequest,
  messages: readonly ChatMessage[],
  file?: ChatFileContext | null,
  staged: ReadonlyMap<string, StagedAttachment> = new Map(),
): string {
  const source = pullRequest.sourceBranch;
  const target = pullRequest.destBranch;
  const description = pullRequest.description?.trim();

  return [
    `# Contexto`,
    `Conversas con un desarrollador sobre la PR #${pullRequest.externalId}: ${pullRequest.title}`,
    `Repositorio: ${pullRequest.repo}`,
    `Autor: ${pullRequest.author}`,
    `Rama de la PR: ${source} -> ${target}`,
    '',
    `Tu directorio de trabajo tiene la rama de la PR (origin/${source}) en su último commit: el código que se`,
    `quiere mergear. La rama destino está como origin/${target}: para ver cómo era el código antes usa`,
    `\`git show origin/${target}:ruta/al/archivo\`, y para ver los cambios de la PR`,
    `\`git diff origin/${target}...HEAD\`.`,
    ...(pullRequest.ticketKeys.length > 0
      ? ['', `Tickets asociados: ${pullRequest.ticketKeys.join(', ')}`]
      : []),
    ...(description
      ? [
          '',
          '## Descripción de la PR',
          description.length > MAX_DESCRIPTION_CHARS
            ? `${description.slice(0, MAX_DESCRIPTION_CHARS).trimEnd()}\n…(recortada)`
            : description,
        ]
      : []),
    ...fileSection(file),
    '',
    '# Conversación',
    ...conversation(messages, staged),
    '',
    'Responde al último mensaje del usuario.',
  ].join('\n');
}

/**
 * El archivo que el usuario tiene seleccionado. Así, aunque no lo nombre en su pregunta, el agente sabe de
 * cuál habla. La ruta viene del navegador: se le quitan los saltos de línea y las comillas invertidas
 * para que no pueda colarse en el prompt como si fueran instrucciones.
 */
function fileSection(file?: ChatFileContext | null): string[] {
  const path = clean(file?.path);
  if (!path) return [];

  const status = file?.status ? ` (${STATUS_TEXT[file.status]})` : '';
  const oldPath = clean(file?.oldPath);
  return [
    '',
    '## Archivo que el usuario tiene abierto ahora en el diff',
    `\`${path}\`${status}${oldPath && oldPath !== path ? `, antes \`${oldPath}\`` : ''}`,
    'Si el usuario no dice de qué archivo habla, se refiere a este.',
  ];
}

/** Sin caracteres de control (saltos de línea, tabuladores…) ni comillas invertidas. */
const clean = (text?: string): string =>
  [...(text ?? '')]
    .filter((char) => char.charCodeAt(0) >= 32 && char !== '`')
    .join('')
    .trim();

/** Los mensajes que entran al prompt: los más recientes. */
export function recentMessages(
  messages: readonly ChatMessage[],
): readonly ChatMessage[] {
  return messages.slice(-MAX_HISTORY_MESSAGES);
}

function conversation(
  messages: readonly ChatMessage[],
  staged: ReadonlyMap<string, StagedAttachment>,
): string[] {
  const recent = recentMessages(messages);
  const omitted = messages.length - recent.length;
  const hasAttachments = recent.some((m) => (m.attachments?.length ?? 0) > 0);

  return [
    ...(hasAttachments ? attachmentsNote() : []),
    ...(omitted > 0 ? [`(${omitted} mensajes anteriores omitidos)`, ''] : []),
    ...recent.flatMap((message) => {
      const content =
        message.content.length > MAX_MESSAGE_CHARS
          ? `${message.content.slice(0, MAX_MESSAGE_CHARS).trimEnd()}\n…(recortado)`
          : message.content;
      return [
        `## ${SPEAKER[message.role]}`,
        content,
        ...attachmentLines(message.attachments ?? [], staged),
        '',
      ];
    }),
  ];
}
