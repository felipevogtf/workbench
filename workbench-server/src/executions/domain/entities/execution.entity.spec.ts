import { Execution } from './execution.entity';
import { ExecutionTicket } from './execution.props';

const REPO = {
  url: 'https://github.com/acme/web',
  host: 'github.com',
  fullName: 'acme/web',
  sshUrl: 'git@github.com:acme/web.git',
};

const ticket = (
  id: string,
  extra: Partial<ExecutionTicket> = {},
): ExecutionTicket => ({
  id,
  title: `Ticket ${id}`,
  description: `Descripción ${id}`,
  criteria: ['Funciona'],
  level: 'medium',
  developerId: 'dev-1',
  reviewerId: 'rev-1',
  status: 'pending',
  rounds: 0,
  feedback: null,
  startSha: null,
  headSha: null,
  summary: null,
  reviewNote: null,
  question: null,
  decisions: [],
  questionsAsked: 0,
  ...extra,
});

/** Un borrador con los tickets ya creados por Lucy. */
function draft(
  tickets: ExecutionTicket[] = [ticket('a'), ticket('b'), ticket('c')],
): Execution {
  const execution = Execution.create({
    issueId: 'issue-1',
    planId: 'plan-1',
    repo: REPO,
    branch: 'feature/x',
  });
  execution.setTickets(tickets);
  execution.setStage('tickets', 'done');
  return execution;
}

const titles = (execution: Execution) =>
  execution.tickets.map((each) => each.title);

describe('Execution: the tickets of a draft', () => {
  describe('when they can be changed', () => {
    it('not while Lucy is still creating them', () => {
      const execution = Execution.create({
        issueId: 'i',
        planId: 'p',
        repo: REPO,
        branch: 'b',
      });

      expect(() => execution.createTicket(ticket('x'), 'lucy')).toThrow(
        'not ready',
      );
    });

    it('not once the development started', () => {
      const execution = draft();
      execution.begin();

      expect(() => execution.createTicket(ticket('x'), 'lucy')).toThrow(
        'draft',
      );
      expect(() => execution.removeTicket('a', 'lucy')).toThrow('draft');
      expect(() =>
        execution.updateTicket('a', { title: 'Otro' }, 'lucy'),
      ).toThrow('draft');
      expect(() =>
        execution.assignTicket('a', { reviewerId: 'rev-2' }, 'lucy'),
      ).toThrow('draft');
      expect(() => execution.leaveNote('a', 'hola', 'lucy')).toThrow('draft');
    });

    it('only the pending ones: one that already started is not touched', () => {
      const execution = draft([ticket('a', { status: 'done' }), ticket('b')]);

      expect(() =>
        execution.updateTicket('a', { title: 'Otro' }, 'lucy'),
      ).toThrow('no longer pending');
      expect(() => execution.removeTicket('a', 'lucy')).toThrow(
        'no longer pending',
      );
      expect(() =>
        execution.assignTicket('a', { reviewerId: 'rev-2' }, 'lucy'),
      ).toThrow('no longer pending');
      expect(execution.changes).toEqual([]);
    });
  });

  describe('creating', () => {
    it('adds the ticket at the end and records who did it', () => {
      const execution = draft();

      const change = execution.createTicket(
        ticket('d', { title: 'Nuevo' }),
        'lucy',
      );

      expect(titles(execution)).toEqual([
        'Ticket a',
        'Ticket b',
        'Ticket c',
        'Nuevo',
      ]);
      expect(change).toMatchObject({
        by: 'lucy',
        kind: 'create',
        ticketId: 'd',
        undone: false,
      });
      expect(change.summary).toContain('Nuevo');
      expect(execution.changes).toHaveLength(1);
    });

    it('undoing it takes the ticket out again', () => {
      const execution = draft();
      const change = execution.createTicket(ticket('d'), 'lucy');

      execution.undo(change.id);

      expect(titles(execution)).toEqual(['Ticket a', 'Ticket b', 'Ticket c']);
      expect(execution.changes[0].undone).toBe(true);
    });
  });

  describe('modifying', () => {
    it('changes the fields it is given and remembers how they were', () => {
      const execution = draft();

      const change = execution.updateTicket(
        'b',
        {
          title: 'Pantalla de órdenes',
          level: 'complex',
          criteria: ['Se ve bien', 'Carga rápido'],
        },
        'lucy',
      );

      expect(execution.ticket('b')).toMatchObject({
        title: 'Pantalla de órdenes',
        level: 'complex',
        criteria: ['Se ve bien', 'Carga rápido'],
      });
      expect(change.before).toEqual({
        title: 'Ticket b',
        level: 'medium',
        criteria: ['Funciona'],
      });
    });

    it('undoing it brings back the previous values', () => {
      const execution = draft();
      const change = execution.updateTicket(
        'b',
        { title: 'Otro', level: 'simple' },
        'lucy',
      );

      execution.undo(change.id);

      expect(execution.ticket('b')).toMatchObject({
        title: 'Ticket b',
        level: 'medium',
      });
    });

    it('an optional field that did not exist stops existing when undone', () => {
      const execution = draft();
      const change = execution.updateTicket('a', { repo: 'acme/api' }, 'lucy');
      expect(execution.ticket('a').repo).toBe('acme/api');

      execution.undo(change.id);

      expect('repo' in execution.ticket('a')).toBe(false);
    });

    it('refuses a change that leaves the ticket as it was, an empty title or description, and an unknown level', () => {
      const execution = draft();

      expect(() =>
        execution.updateTicket('a', { title: 'Ticket a' }, 'lucy'),
      ).toThrow('as it was');
      expect(() =>
        execution.updateTicket('a', { title: '  ' }, 'lucy'),
      ).toThrow('title');
      expect(() =>
        execution.updateTicket('a', { description: '' }, 'lucy'),
      ).toThrow('description');
      expect(() =>
        execution.updateTicket('a', { level: 'enorme' as never }, 'lucy'),
      ).toThrow('level');
      expect(execution.changes).toEqual([]);
    });

    it('says which ticket does not exist', () => {
      expect(() => draft().updateTicket('zzz', { title: 'x' }, 'lucy')).toThrow(
        'not found',
      );
    });
  });

  describe('removing', () => {
    it('takes the ticket out of the list but keeps it, to be restored', () => {
      const execution = draft();

      const change = execution.removeTicket('b', 'lucy');

      expect(titles(execution)).toEqual(['Ticket a', 'Ticket c']);
      expect(execution.removedTickets.map((each) => each.id)).toEqual(['b']);
      expect(change).toMatchObject({ kind: 'remove', index: 1 });
    });

    it('undoing it puts the ticket back in the place it had', () => {
      const execution = draft();
      const change = execution.removeTicket('b', 'lucy');

      execution.undo(change.id);

      expect(titles(execution)).toEqual(['Ticket a', 'Ticket b', 'Ticket c']);
      expect(execution.removedTickets).toEqual([]);
    });

    it('restores at the end when the list is shorter than before', () => {
      const execution = draft();
      const first = execution.removeTicket('c', 'lucy');
      execution.removeTicket('a', 'lucy');

      execution.undo(first.id);

      expect(titles(execution)).toEqual(['Ticket b', 'Ticket c']);
    });

    it('does not keep more than thirty removed tickets', () => {
      const execution = draft(
        Array.from({ length: 35 }, (_, n) => ticket(`t${n}`)),
      );
      for (let n = 0; n < 35; n++) execution.removeTicket(`t${n}`, 'lucy');

      expect(execution.removedTickets).toHaveLength(30);
      expect(execution.removedTickets[0].id).toBe('t5');
    });
  });

  describe('reassigning', () => {
    it('changes the developer and the reviewer, and says who', () => {
      const execution = draft();

      const change = execution.assignTicket(
        'a',
        { developerId: 'dev-2', reviewerId: 'rev-2' },
        'user',
        { developer: 'Rebecca', reviewer: 'Pilar' },
      );

      expect(execution.ticket('a')).toMatchObject({
        developerId: 'dev-2',
        reviewerId: 'rev-2',
      });
      expect(change.summary).toContain('desarrolla Rebecca');
      expect(change.summary).toContain('revisa Pilar');
      expect(change.by).toBe('user');
    });

    it('undoing it brings back the previous workers', () => {
      const execution = draft();
      const change = execution.assignTicket(
        'a',
        { developerId: 'dev-2' },
        'lucy',
      );

      execution.undo(change.id);

      expect(execution.ticket('a').developerId).toBe('dev-1');
    });

    it('refuses to assign who already has the ticket', () => {
      expect(() =>
        draft().assignTicket('a', { developerId: 'dev-1' }, 'lucy'),
      ).toThrow('already has');
    });
  });

  describe('notes', () => {
    it('leaves a note on a pending ticket, and undoing it removes only that note', () => {
      const execution = draft([
        ticket('a', {
          notes: [{ at: '2026-01-01', from: 'user', text: 'Vieja' }],
        }),
      ]);

      const change = execution.leaveNote(
        'a',
        '  No toques los submódulos  ',
        'lucy',
      );
      expect(execution.ticket('a').notes?.map((note) => note.text)).toEqual([
        'Vieja',
        'No toques los submódulos',
      ]);

      execution.undo(change.id);
      expect(execution.ticket('a').notes?.map((note) => note.text)).toEqual([
        'Vieja',
      ]);
    });

    it('refuses an empty note', () => {
      expect(() => draft().leaveNote('a', '  ', 'lucy')).toThrow('empty');
    });
  });

  describe('undoing', () => {
    it('cannot be done twice', () => {
      const execution = draft();
      const change = execution.removeTicket('a', 'lucy');
      execution.undo(change.id);

      expect(() => execution.undo(change.id)).toThrow('already undone');
    });

    it('says when the change does not exist', () => {
      expect(() => draft().undo('nope')).toThrow('not found');
    });

    it('cannot be done once the development started', () => {
      const execution = draft();
      const change = execution.removeTicket('a', 'lucy');
      execution.begin();

      expect(() => execution.undo(change.id)).toThrow('draft');
    });

    it('cannot change a ticket that is no longer pending', () => {
      const execution = draft();
      const change = execution.updateTicket('a', { title: 'Otro' }, 'lucy');
      execution.ticket('a').status = 'done';

      expect(() => execution.undo(change.id)).toThrow('no longer pending');
    });

    it('keeps the history in order, oldest first', () => {
      const execution = draft();
      execution.removeTicket('a', 'lucy');
      execution.createTicket(ticket('d'), 'lucy');
      execution.updateTicket('b', { title: 'Otro' }, 'user');

      expect(
        execution.changes.map((change) => [change.kind, change.by]),
      ).toEqual([
        ['remove', 'lucy'],
        ['create', 'lucy'],
        ['update', 'user'],
      ]);
    });
  });
});
