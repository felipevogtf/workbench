import { extractActions } from './chat-actions';
import { ExecutionTicket } from './entities/execution.props';

const ticket = (id: string, title: string): ExecutionTicket =>
  ({ id, title, status: 'pending' }) as ExecutionTicket;

const context = {
  tickets: [ticket('a', 'API'), ticket('b', 'Pantalla'), ticket('c', 'Tests')],
  repos: ['acme/web', 'acme/api'],
};

describe('extractActions', () => {
  it('takes the action lines out of the reply and keeps what is meant to be read', () => {
    const { reply, actions } = extractActions(
      [
        'Quité el ticket de pantalla y sumé uno de tests.',
        '',
        'ELIMINAR 2',
        'CREAR simple | Pruebas del endpoint | Escribir las pruebas unitarias del endpoint nuevo',
        '',
        '¿Algo más?',
      ].join('\n'),
      context,
    );

    expect(reply).toBe(
      'Quité el ticket de pantalla y sumé uno de tests.\n\n¿Algo más?',
    );
    expect(actions).toEqual([
      { kind: 'remove', ticketId: 'b', ticket: 2 },
      {
        kind: 'create',
        title: 'Pruebas del endpoint',
        text: 'Escribir las pruebas unitarias del endpoint nuevo',
        level: 'simple',
        repo: null,
      },
    ]);
  });

  it('creates a ticket with a level in Spanish, a description with pipes and a repo of the task', () => {
    const { actions } = extractActions(
      'CREAR complejo | Migrar | Cambiar el esquema | y mover los datos | acme/api',
      context,
    );

    expect(actions).toEqual([
      {
        kind: 'create',
        title: 'Migrar',
        text: 'Cambiar el esquema | y mover los datos',
        level: 'complex',
        repo: 'acme/api',
      },
    ]);
  });

  it('still understands TICKET as a way to create, and defaults the level to medium', () => {
    const { actions } = extractActions('TICKET | Algo | Hacer algo', context);

    expect(actions).toEqual([
      {
        kind: 'create',
        title: 'Algo',
        text: 'Hacer algo',
        level: 'medium',
        repo: null,
      },
    ]);
  });

  it('edits each field: title, description, criteria, level and repo', () => {
    const { actions } = extractActions(
      [
        'EDITAR 1 | título | Endpoint de órdenes',
        'EDITAR 1 | descripción | Devolver las órdenes paginadas',
        'EDITAR 3 | criterios | Pasa el test; Sin errores de lint ; ',
        'EDITAR 2 | nivel | medio',
        'EDITAR 2 | repo | ACME/API',
      ].join('\n'),
      context,
    );

    expect(actions).toEqual([
      {
        kind: 'update',
        ticketId: 'a',
        ticket: 1,
        field: 'title',
        value: 'Endpoint de órdenes',
      },
      {
        kind: 'update',
        ticketId: 'a',
        ticket: 1,
        field: 'description',
        value: 'Devolver las órdenes paginadas',
      },
      {
        kind: 'update',
        ticketId: 'c',
        ticket: 3,
        field: 'criteria',
        value: ['Pasa el test', 'Sin errores de lint'],
      },
      {
        kind: 'update',
        ticketId: 'b',
        ticket: 2,
        field: 'level',
        value: 'medium',
      },
      {
        kind: 'update',
        ticketId: 'b',
        ticket: 2,
        field: 'repo',
        value: 'acme/api',
      },
    ]);
  });

  it('reassigns the developer or the reviewer by the name of the agent', () => {
    const { actions } = extractActions(
      [
        'REASIGNAR 1 | desarrolla | Rebecca',
        'REASIGNAR 2 | revisa | Pilar',
      ].join('\n'),
      context,
    );

    expect(actions).toEqual([
      {
        kind: 'assign',
        ticketId: 'a',
        ticket: 1,
        role: 'developer',
        agent: 'Rebecca',
      },
      {
        kind: 'assign',
        ticketId: 'b',
        ticket: 2,
        role: 'reviewer',
        agent: 'Pilar',
      },
    ]);
  });

  it('takes a note for a ticket', () => {
    const { actions } = extractActions(
      'NOTA 3: Usa el helper que ya existe.',
      context,
    );

    expect(actions).toEqual([
      {
        kind: 'note',
        ticketId: 'c',
        ticket: 3,
        text: 'Usa el helper que ya existe.',
      },
    ]);
  });

  it('understands the lines even with bullets, bold or backticks around them', () => {
    const { reply, actions } = extractActions(
      [
        '- **ELIMINAR 1**',
        '`ELIMINAR 3`',
        '1. **NOTA 2:** Sin tocar los submódulos',
      ].join('\n'),
      context,
    );

    expect(reply).toBe('');
    expect(actions.map((action) => action.kind)).toEqual([
      'remove',
      'remove',
      'note',
    ]);
  });

  it('leaves in the reply, in sight, whatever it cannot understand', () => {
    const lines = [
      'ELIMINAR 9', // un ticket que no existe
      'EDITAR 1 | color | rojo', // un campo que no es
      'EDITAR 1 | nivel | enorme', // un nivel que no es
      'EDITAR 1 | repo | otra/cosa', // un repo que la tarea no tiene
      'EDITAR 1 | criterios | ; ;', // sin criterios
      'REASIGNAR 7 | revisa | Pilar',
      'CREAR simple | Sin descripción |',
    ];
    const { reply, actions } = extractActions(lines.join('\n'), context);

    expect(actions).toEqual([]);
    expect(reply).toBe(lines.join('\n'));
  });

  it('does not take ordinary sentences that start with a similar word', () => {
    const { reply, actions } = extractActions(
      'Eliminar el ticket 2 sería lo mejor.\nCrear más tickets no hace falta.',
      context,
    );

    expect(actions).toEqual([]);
    expect(reply).toContain('Eliminar el ticket 2 sería lo mejor.');
  });

  it('refers to the numbers of the list as Lucy saw it, so deleting one does not move the others', () => {
    const { actions } = extractActions(
      ['ELIMINAR 1', 'EDITAR 2 | título | Nuevo'].join('\n'),
      context,
    );

    expect(actions).toEqual([
      { kind: 'remove', ticketId: 'a', ticket: 1 },
      {
        kind: 'update',
        ticketId: 'b',
        ticket: 2,
        field: 'title',
        value: 'Nuevo',
      },
    ]);
  });

  it('does not take more than twelve actions in one reply', () => {
    const many = Array.from({ length: 20 }, () => 'NOTA 1: hola').join('\n');

    const { actions, reply } = extractActions(many, context);

    expect(actions).toHaveLength(12);
    expect(reply.split('\n')).toHaveLength(8);
  });

  it('cuts long texts', () => {
    const { actions } = extractActions(
      `CREAR simple | ${'t'.repeat(300)} | ${'d'.repeat(9000)}`,
      context,
    );

    expect(actions[0]).toMatchObject({ kind: 'create' });
    const created = actions[0] as { title: string; text: string };
    expect(created.title).toHaveLength(120);
    expect(created.text).toHaveLength(4000);
  });
});
