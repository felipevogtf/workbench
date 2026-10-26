import { ExecutionTicket } from './entities/execution.props';
import { extractNoteProposals } from './note-proposals';

const ticket = (id: string, title: string): ExecutionTicket =>
  ({ id, title }) as ExecutionTicket;

const TICKETS = [ticket('a', 'API'), ticket('b', 'Pantalla')];

describe('extractNoteProposals', () => {
  it('takes the NOTA lines out of the reply and returns them as proposals', () => {
    const { reply, proposals } = extractNoteProposals(
      [
        'Le dejo una nota a Kiwi.',
        '',
        'NOTA 2: No toques los submódulos.',
        'Avísame si quieres otra.',
      ].join('\n'),
      TICKETS,
    );

    expect(reply).toBe('Le dejo una nota a Kiwi.\n\nAvísame si quieres otra.');
    expect(proposals).toEqual([
      {
        ticketId: 'b',
        ticket: 2,
        title: 'Pantalla',
        text: 'No toques los submódulos.',
      },
    ]);
  });

  it('accepts several, in any case and with spaces around', () => {
    const { proposals } = extractNoteProposals(
      '  nota 1 :  Usa el componente X\nNOTA 2: Y',
      TICKETS,
    );

    expect(proposals.map((p) => [p.ticketId, p.text])).toEqual([
      ['a', 'Usa el componente X'],
      ['b', 'Y'],
    ]);
  });

  it('leaves in the reply a line for a ticket that does not exist', () => {
    const { reply, proposals } = extractNoteProposals(
      'NOTA 9: Hola\nNOTA 0: Hola',
      TICKETS,
    );

    expect(proposals).toEqual([]);
    expect(reply).toBe('NOTA 9: Hola\nNOTA 0: Hola');
  });

  it('does not take as a proposal a NOTA that is in the middle of a sentence', () => {
    const { reply, proposals } = extractNoteProposals(
      'Te dejo una NOTA 1: sobre eso',
      TICKETS,
    );

    expect(proposals).toEqual([]);
    expect(reply).toBe('Te dejo una NOTA 1: sobre eso');
  });

  it('keeps at most five proposals', () => {
    const many = Array.from({ length: 8 }, () => 'NOTA 1: x').join('\n');

    expect(extractNoteProposals(many, TICKETS).proposals).toHaveLength(5);
  });

  it('returns the reply untouched when there is nothing to propose', () => {
    expect(extractNoteProposals('Todo bien.', TICKETS)).toEqual({
      reply: 'Todo bien.',
      proposals: [],
    });
  });
});
