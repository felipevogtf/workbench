import { PlanRepoInfo } from './entities/plan.props';
import { TicketData } from './ports/tickets-gateway.port';
import { TaskContext } from './ports/tasks-gateway.port';

/** La descripción se recorta para no pasar el límite de argumentos de los CLI que reciben el prompt así. */
export const MAX_DESCRIPTION_CHARS = 6000;

export interface PlanPromptInput {
  task: TaskContext;
  tickets: TicketData[];
  repos: PlanRepoInfo[];
}

function truncate(text: string, max: number): string {
  return text.length > max
    ? `${text.slice(0, max)}\n[…descripción recortada…]`
    : text;
}

/**
 * Contexto que recibe el agente planificador (el prompt del agente, editable en la UI, define el
 * formato del plan). Es una función pura.
 */
export function buildPlanPrompt({
  task,
  tickets,
  repos,
}: PlanPromptInput): string {
  const lines: string[] = [
    '# Tarea a planificar',
    '',
    `**Título:** ${task.name}`,
  ];

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

  if (tickets.length > 0) {
    lines.push('', '## Tickets citados en la tarea', '');
    for (const ticket of tickets) {
      const meta = [
        ticket.stateName,
        ticket.priority && ticket.priority !== 'none' ? ticket.priority : null,
        ticket.labels.length > 0 ? ticket.labels.join(', ') : null,
      ]
        .filter(Boolean)
        .join(' · ');
      lines.push(
        `### ${ticket.key}: ${ticket.title}${meta ? ` (${meta})` : ''}`,
      );
      if (ticket.descriptionText?.trim())
        lines.push('', ticket.descriptionText.trim());
      lines.push('');
    }
  }

  lines.push('', '## Repositorios', '');
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

  return lines.join('\n');
}
