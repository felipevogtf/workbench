import { conversationLines } from './conversation';
import { PlanChatMessage, PlanRepoInfo } from './entities/plan.props';
import {
  repoLines,
  taskLines,
  ticketLines,
  MAX_PREVIOUS_PLAN_CHARS,
} from './plan-prompt';
import { TaskContext } from './ports/tasks-gateway.port';
import { TicketData } from './ports/tickets-gateway.port';

/** Cuántos mensajes anteriores se reenvían al agente (que no recuerda nada entre una pregunta y otra). */
export const MAX_CHAT_HISTORY_MESSAGES = 20;
const MAX_CHAT_HISTORY_CHARS = 40_000;

export interface TaskChatPromptInput {
  task: TaskContext;
  /** Tickets de Plane leídos (los de la tarea y los que el usuario mencionó en el chat). */
  tickets: TicketData[];
  /** Códigos mencionados que no se pudieron leer, para que el agente lo diga en vez de inventarlos. */
  missingTickets: string[];
  /** Markdown del último plan listo, o null si la tarea todavía no tiene. */
  plan: string | null;
  repos: PlanRepoInfo[];
  messages: readonly PlanChatMessage[];
}

/**
 * Contexto que recibe el agente del chat de una tarea: la tarea, sus tickets de Plane, el plan actual y
 * el código de sus repos, más la conversación. El agente no guarda memoria, así que la conversación va
 * completa (recortada a los últimos mensajes) en cada pregunta. Función pura.
 */
export function buildTaskChatPrompt({
  task,
  tickets,
  missingTickets,
  plan,
  repos,
  messages,
}: TaskChatPromptInput): string {
  const planText = plan?.trim();

  return [
    '# Contexto',
    'Conversas con un desarrollador para mejorar el plan de ejecución de esta tarea.',
    '',
    ...taskLines(task),
    ...ticketLines(tickets, '## Tickets de Plane'),
    ...(missingTickets.length > 0
      ? [
          '',
          `Tickets mencionados que no se pudieron leer: ${missingTickets.join(', ')}. No inventes su contenido.`,
        ]
      : []),
    ...repoLines(repos),
    '',
    '## Plan actual',
    '',
    planText
      ? planText.length > MAX_PREVIOUS_PLAN_CHARS
        ? `${planText.slice(0, MAX_PREVIOUS_PLAN_CHARS).trimEnd()}\n[…plan recortado…]`
        : planText
      : 'Todavía no hay un plan para esta tarea.',
    '',
    '# Conversación',
    '',
    ...conversationLines(messages, {
      maxMessages: MAX_CHAT_HISTORY_MESSAGES,
      maxChars: MAX_CHAT_HISTORY_CHARS,
    }),
    'Responde al último mensaje del usuario. Si lo conversado cambia el plan, di qué cambiarías: el plan solo se actualiza cuando el usuario pulsa «Replanificar».',
  ].join('\n');
}
