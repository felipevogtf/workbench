import type { StagedAttachment } from '@core/attachments/attachments';
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

/** La línea con la que el agente avisa de que el usuario pidió un cambio al plan; el servidor la quita de la respuesta. */
export const UPDATE_PLAN_MARKER = '[[ACTUALIZAR_PLAN]]';

/** Separa la marca de actualizar el plan de la respuesta que se le muestra al usuario. */
export function splitPlanMarker(markdown: string): {
  text: string;
  updatesPlan: boolean;
} {
  if (!markdown.includes(UPDATE_PLAN_MARKER)) {
    return { text: markdown, updatesPlan: false };
  }
  const text = markdown.split(UPDATE_PLAN_MARKER).join('').trim();
  return { text, updatesPlan: true };
}

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
  /** Dónde quedó cada adjunto de la conversación, para que el agente los lea. */
  staged?: ReadonlyMap<string, StagedAttachment>;
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
  staged,
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
    ...conversationLines(
      messages,
      {
        maxMessages: MAX_CHAT_HISTORY_MESSAGES,
        maxChars: MAX_CHAT_HISTORY_CHARS,
      },
      staged,
    ),
    'Responde al último mensaje del usuario.',
    `Si el usuario pide cambiar el plan (o crearlo, cuando todavía no hay), di en una o dos frases qué cambias y termina la respuesta con una última línea que contenga solo ${UPDATE_PLAN_MARKER}. El sistema aplica el cambio al plan por su cuenta: no le pidas al usuario que pulse nada y no reescribas el plan en la respuesta. Si el usuario solo pregunta o comenta, responde sin esa línea.`,
  ].join('\n');
}
