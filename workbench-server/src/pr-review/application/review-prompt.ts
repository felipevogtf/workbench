import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import { TicketData } from '@pr-review/domain/ports/tickets-gateway.port';

/** Un ticket detectado en la PR y lo que se pudo leer de él (null = no se pudo leer). */
export interface TicketContext {
  key: string;
  ticket: TicketData | null;
}

/** La revisión previa de la PR: su commit y lo que dijo, para no empezar de cero en cada re-revisión. */
export interface PreviousReview {
  commit: string;
  markdown: string;
}

const MAX_DESCRIPTION_CHARS = 4000;
const MAX_PREVIOUS_REVIEW_CHARS = 6000;

/** Contexto que recibe el agente: datos de la PR, su descripción y los tickets de Plane que referencia. */
export function buildReviewPrompt(
  pullRequest: PullRequest,
  tickets: readonly TicketContext[],
  previous: PreviousReview | null = null,
): string {
  return [
    `# PR #${pullRequest.externalId}: ${pullRequest.title}`,
    `Repositorio: ${pullRequest.repo}`,
    `Autor: ${pullRequest.author}`,
    `Rama: ${pullRequest.sourceBranch} -> ${pullRequest.destBranch}`,
    `URL: ${pullRequest.url}`,
    '',
    '## Descripción de la PR',
    describe(pullRequest.description),
    '',
    '## Tickets asociados (Plane)',
    ...ticketSections(tickets),
    '',
    ...previousSection(pullRequest, previous),
    `Para ver los cambios usa: git diff origin/${pullRequest.destBranch}...origin/${pullRequest.sourceBranch}`,
  ].join('\n');
}

function previousSection(
  pullRequest: PullRequest,
  previous: PreviousReview | null,
): string[] {
  if (!previous) {
    return ['## Revisión anterior', 'Ninguna: esta es la primera revisión de la PR.', ''];
  }

  const text = previous.markdown.trim();
  const body =
    text.length > MAX_PREVIOUS_REVIEW_CHARS
      ? `${text.slice(0, MAX_PREVIOUS_REVIEW_CHARS).trimEnd()}
…(recortada)`
      : text;

  return [
    '## Revisión anterior',
    `Commit revisado: ${previous.commit}`,
    `Cambios desde esa revisión: git diff ${previous.commit}..origin/${pullRequest.sourceBranch}`,
    '(si ese commit ya no existe en el repo, por un rebase o force-push, haz una revisión completa)',
    '',
    '<revision_anterior>',
    body,
    '</revision_anterior>',
    '',
  ];
}

function describe(description: string | null): string {
  const text = description?.trim();
  if (!text) return '(sin descripción)';
  return text.length > MAX_DESCRIPTION_CHARS
    ? `${text.slice(0, MAX_DESCRIPTION_CHARS).trimEnd()}\n…(recortado)`
    : text;
}

function ticketSections(tickets: readonly TicketContext[]): string[] {
  if (tickets.length === 0) {
    return [
      'Sin ticket asociado: ni la rama ni la descripción de la PR referencian ninguno.',
    ];
  }

  return tickets.flatMap(({ key, ticket }) => {
    if (!ticket) {
      return [
        `### ${key}`,
        'No se pudo leer el ticket (no existe, no es visible o Plane no respondió).',
        '',
      ];
    }

    const meta = [
      `Estado: ${ticket.stateName ?? 'desconocido'}`,
      `Etiquetas: ${ticket.labels.length > 0 ? ticket.labels.join(', ') : 'ninguna'}`,
      `Prioridad: ${ticket.priority ?? 'sin definir'}`,
    ].join(' · ');

    return [
      `### ${key} — ${ticket.title}`,
      meta,
      ticket.descriptionText || '(el ticket no tiene descripción)',
      '',
    ];
  });
}
