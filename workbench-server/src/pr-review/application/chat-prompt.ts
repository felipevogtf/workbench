import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
    '',
    '# Conversación',
    ...conversation(messages),
    '',
    'Responde al último mensaje del usuario.',
  ].join('\n');
}

function conversation(messages: readonly ChatMessage[]): string[] {
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);
  const omitted = messages.length - recent.length;

  return [
    ...(omitted > 0 ? [`(${omitted} mensajes anteriores omitidos)`, ''] : []),
    ...recent.flatMap((message) => {
      const content =
        message.content.length > MAX_MESSAGE_CHARS
          ? `${message.content.slice(0, MAX_MESSAGE_CHARS).trimEnd()}\n…(recortado)`
          : message.content;
      return [`## ${SPEAKER[message.role]}`, content, ''];
    }),
  ];
}
