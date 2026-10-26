import { ExecutionTicket } from './entities/execution.props';

/** Una instrucción que Lucy propone dejarle a un agente; el usuario la confirma antes de que se guarde. */
export interface NoteProposal {
  ticketId: string;
  /** El número del ticket tal como se lista en el contexto de Lucy (desde 1). */
  ticket: number;
  title: string;
  text: string;
}

const MAX_PROPOSALS = 5;
const MAX_NOTE = 2_000;

/**
 * Separa de la respuesta de Lucy las líneas `NOTA <número>: <instrucción>`, que son propuestas y no texto para
 * leer. Una línea con un número de ticket que no existe, o de un ticket ya hecho, se deja en la respuesta, a la vista.
 */
export function extractNoteProposals(
  reply: string,
  tickets: readonly ExecutionTicket[],
): { reply: string; proposals: NoteProposal[] } {
  const proposals: NoteProposal[] = [];
  const kept: string[] = [];

  for (const line of reply.split(/\r?\n/)) {
    const match = /^[ \t]*NOTA[ \t]+(\d+)[ \t]*:[ \t]*(.+?)[ \t]*$/i.exec(line);
    const ticket = match ? tickets[Number(match[1]) - 1] : undefined;
    // Un ticket hecho no se vuelve a trabajar: una nota no le llegaría a nadie, así que no se ofrece el botón.
    if (
      !match ||
      !ticket ||
      ticket.status === 'done' ||
      proposals.length >= MAX_PROPOSALS
    ) {
      kept.push(line);
      continue;
    }
    proposals.push({
      ticketId: ticket.id,
      ticket: Number(match[1]),
      title: ticket.title,
      text: match[2].slice(0, MAX_NOTE),
    });
  }

  return { reply: kept.join('\n').trim(), proposals };
}
