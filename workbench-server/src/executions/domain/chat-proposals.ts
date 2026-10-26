import {
  ExecutionStatus,
  ExecutionTicket,
  TICKET_LEVELS,
  TicketLevel,
} from './entities/execution.props';

/**
 * Una nota para el agente de un ticket. En uno ya hecho de una ejecución completada la nota lo REABRE: vuelve a desarrollo y
 * revisión con ella.
 */
export interface NoteProposal {
  kind: 'note';
  ticketId: string;
  /** El número del ticket tal como se lista en el contexto de Lucy (desde 1). */
  ticket: number;
  title: string;
  text: string;
  /** Verdadero cuando el ticket ya está hecho: confirmar la nota lo reabre. */
  reopen: boolean;
}

/** Un ticket nuevo (un hotfix, algo que no se consideró) para sumar a una ejecución completada. */
export interface NewTicketProposal {
  kind: 'ticket';
  title: string;
  /** La descripción del ticket. */
  text: string;
  level: TicketLevel;
  /** `organización/repo` cuando la tarea tiene varios; `null` = el primero. */
  repo: string | null;
}

/** Pedir la revisión final de toda la rama. */
export interface FinalReviewProposal {
  kind: 'final-review';
}

export type ChatProposal =
  NoteProposal | NewTicketProposal | FinalReviewProposal;

export interface ProposalContext {
  tickets: readonly ExecutionTicket[];
  status: ExecutionStatus;
  /** Ya hay una revisión final en marcha: no se vuelve a ofrecer. */
  finalReviewRunning: boolean;
  /** Los repositorios de la tarea, `organización/repo`. */
  repos: readonly string[];
}

const MAX_PROPOSALS = 5;
const MAX_NOTE = 2_000;
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 4_000;

const NOTE = /^[ \t]*NOTA[ \t]+(\d+)[ \t]*:[ \t]*(.+?)[ \t]*$/i;
const TICKET =
  /^[ \t]*TICKET[ \t]*(simple|medium|complex)?[ \t]*\|[ \t]*([^|]+?)[ \t]*\|[ \t]*([^|]+?)(?:[ \t]*\|[ \t]*([^|]+?))?[ \t]*$/i;
const FINAL_REVIEW = /^[ \t]*REVISI[OÓ]N[ \t]+FINAL[ \t]*$/i;

/**
 * Separa de la respuesta de Lucy las líneas que son propuestas y no texto para leer: `NOTA <número>: <instrucción>`,
 * `TICKET <nivel> | <título> | <descripción> [| <repo>]` y `REVISION FINAL`. Ninguna se ejecuta sola: el usuario las confirma.
 *
 * Una línea que no se puede ofrecer se deja en la respuesta, a la vista: un ticket que no existe, una nota para un ticket
 * hecho cuando la ejecución no está completada (nadie lo volvería a trabajar), o un ticket nuevo o una revisión final
 * con la ejecución sin terminar.
 */
export function extractProposals(
  reply: string,
  context: ProposalContext,
): { reply: string; proposals: ChatProposal[] } {
  const proposals: ChatProposal[] = [];
  const kept: string[] = [];
  const completed = context.status === 'completed';

  for (const line of reply.split(/\r?\n/)) {
    const proposal =
      proposals.length < MAX_PROPOSALS
        ? proposalOf(line, context, completed)
        : null;
    // Dos pedidos de revisión final serían la misma.
    if (
      !proposal ||
      (proposal.kind === 'final-review' &&
        proposals.some((other) => other.kind === 'final-review'))
    ) {
      kept.push(line);
      continue;
    }
    proposals.push(proposal);
  }

  return { reply: kept.join('\n').trim(), proposals };
}

function proposalOf(
  line: string,
  context: ProposalContext,
  completed: boolean,
): ChatProposal | null {
  const note = NOTE.exec(line);
  if (note) {
    const ticket = context.tickets[Number(note[1]) - 1];
    if (!ticket) return null;
    const done = ticket.status === 'done';
    // Un ticket hecho solo se vuelve a trabajar si se reabre, y eso solo se puede con la ejecución completada.
    if (done && !completed) return null;
    return {
      kind: 'note',
      ticketId: ticket.id,
      ticket: Number(note[1]),
      title: ticket.title,
      text: note[2].slice(0, MAX_NOTE),
      reopen: done,
    };
  }

  const added = TICKET.exec(line);
  if (added) {
    if (!completed) return null;
    const wanted = added[4]?.trim().toLowerCase();
    const level = TICKET_LEVELS.find(
      (each) => each === added[1]?.toLowerCase(),
    );
    return {
      kind: 'ticket',
      title: added[2].slice(0, MAX_TITLE),
      text: added[3].slice(0, MAX_DESCRIPTION),
      level: level ?? 'medium',
      repo: context.repos.find((repo) => repo.toLowerCase() === wanted) ?? null,
    };
  }

  if (FINAL_REVIEW.test(line)) {
    return completed && !context.finalReviewRunning
      ? { kind: 'final-review' }
      : null;
  }
  return null;
}
