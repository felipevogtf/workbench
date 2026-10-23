import { conversationLines } from './conversation';
import { PlanChatMessage, PlanRepoInfo } from './entities/plan.props';
import { TicketData } from './ports/tickets-gateway.port';
import { TaskContext } from './ports/tasks-gateway.port';

/** La descripción se recorta para no pasar el límite de argumentos de los CLI que reciben el prompt así. */
export const MAX_DESCRIPTION_CHARS = 6000;
/** Del plan anterior y de la conversación entra lo que quepa: el resto se recorta (lo último pesa más). */
export const MAX_PREVIOUS_PLAN_CHARS = 30_000;
export const MAX_REVISION_CONVERSATION_CHARS = 40_000;

/** Lo que se agrega al pedir una replanificación: el plan anterior (solo uno) y lo conversado con el usuario. */
export interface PlanRevision {
  /** Markdown del plan del que se parte; null si ya no existe o nunca hubo uno. */
  previousPlan: string | null;
  conversation: readonly PlanChatMessage[];
}

export interface PlanPromptInput {
  task: TaskContext;
  tickets: TicketData[];
  repos: PlanRepoInfo[];
  /** Presente solo en una replanificación. */
  revision?: PlanRevision | null;
}

export function truncate(text: string, max: number): string {
  return text.length > max
    ? `${text.slice(0, max)}\n[…descripción recortada…]`
    : text;
}

/** Los datos de la tarea: título, proyecto, estado, etiquetas… y su descripción. */
export function taskLines(task: TaskContext): string[] {
  const lines: string[] = [`**Título:** ${task.name}`];

  const facts: [string, string | number | null][] = [
    ['Proyecto', task.projectName],
    ['Estado', task.stateName],
    [
      'Prioridad',
      task.priority && task.priority !== 'none' ? task.priority : null,
    ],
    ['Inicio', task.startDate],
    ['Vencimiento', task.dueDate],
    ['Horas estimadas', task.estimatedHours],
    ['Etiquetas', task.labels.map((label) => label.name).join(', ') || null],
  ];
  for (const [label, value] of facts) {
    if (value !== null && value !== '') lines.push(`**${label}:** ${value}`);
  }

  lines.push('', '## Descripción', '');
  lines.push(
    task.description?.trim()
      ? truncate(task.description.trim(), MAX_DESCRIPTION_CHARS)
      : '(La tarea no tiene descripción.)',
  );
  return lines;
}

/** Los tickets de Plane leídos, cada uno con su estado, etiquetas y descripción. */
export function ticketLines(tickets: TicketData[], heading: string): string[] {
  if (tickets.length === 0) return [];

  const lines = ['', heading, ''];
  for (const ticket of tickets) {
    const meta = [
      ticket.stateName,
      ticket.priority && ticket.priority !== 'none' ? ticket.priority : null,
      ticket.labels.length > 0 ? ticket.labels.join(', ') : null,
    ]
      .filter(Boolean)
      .join(' · ');
    lines.push(`### ${ticket.key}: ${ticket.title}${meta ? ` (${meta})` : ''}`);
    if (ticket.descriptionText?.trim())
      lines.push('', ticket.descriptionText.trim());
    lines.push('');
  }
  return lines;
}

/** Los repositorios que el agente puede leer y los que no se pudieron clonar. */
export function repoLines(repos: PlanRepoInfo[]): string[] {
  const lines: string[] = ['', '## Repositorios', ''];
  const used = repos.filter((repo) => repo.used);
  if (used.length > 0) {
    lines.push(
      'Puedes leer el código de estos repositorios (rama principal, solo lectura). Cada uno está en su carpeta, dentro del directorio actual:',
      '',
      ...used.map((repo) => `- \`${repo.name}/\` — ${repo.url}`),
    );
  } else {
    lines.push(
      'No hay código disponible para esta tarea: planifica a nivel funcional, sin inventar archivos ni rutas, e indícalo en el plan.',
    );
  }
  const skipped = repos.filter((repo) => !repo.used);
  if (skipped.length > 0) {
    lines.push(
      '',
      'Repositorios que no se pudieron leer:',
      ...skipped.map(
        (repo) => `- ${repo.url}: ${repo.note ?? 'no disponible'}`,
      ),
    );
  }
  return lines;
}

/**
 * Contexto de una replanificación: el plan anterior (solo ese, aunque haya más en el historial), la
 * conversación con el usuario y qué se espera del agente.
 */
function revisionLines(revision: PlanRevision): string[] {
  const previous = revision.previousPlan?.trim();
  return [
    '',
    '## Plan anterior',
    '',
    previous
      ? previous.length > MAX_PREVIOUS_PLAN_CHARS
        ? `${previous.slice(0, MAX_PREVIOUS_PLAN_CHARS).trimEnd()}\n[…plan recortado…]`
        : previous
      : '(No hay un plan anterior: elabora el plan desde cero teniendo en cuenta la conversación.)',
    '',
    '## Conversación con el usuario sobre el plan',
    '',
    ...conversationLines(revision.conversation, {
      maxMessages: revision.conversation.length,
      maxChars: MAX_REVISION_CONVERSATION_CHARS,
    }),
    '## Qué hacer ahora',
    '',
    'Esta es una replanificación. Actualiza el plan anterior incorporando lo conversado: responde las dudas con lo que el usuario aclaró, aplica sus correcciones, ten en cuenta los tickets que mencionó (arriba) y conserva lo que no se discutió.',
    'Entrega el plan completo y actualizado, con el mismo formato de siempre; no un resumen de los cambios.',
  ];
}

/**
 * Contexto que recibe el agente planificador (el prompt del agente, editable en la UI, define el
 * formato del plan). Es una función pura.
 */
export function buildPlanPrompt({
  task,
  tickets,
  repos,
  revision,
}: PlanPromptInput): string {
  return [
    '# Tarea a planificar',
    '',
    ...taskLines(task),
    ...ticketLines(tickets, '## Tickets citados en la tarea'),
    ...repoLines(repos),
    ...(revision ? revisionLines(revision) : []),
  ].join('\n');
}
