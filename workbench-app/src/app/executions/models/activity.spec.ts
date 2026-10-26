import { activityOf } from './activity';
import { job } from '../testing/factories';

const who = (job: { agentId: string | null }) =>
  job.agentId === 'dev' ? 'David' : job.agentId === 'rev' ? 'Maine' : 'Lucy';

describe('activityOf', () => {
  it('does not put the final review in the story of a ticket', () => {
    const events = activityOf(
      [job('f', { kind: 'final', agentId: 'rev', startedAt: '2026-10-26T10:00:00Z' })],
      who,
    );

    expect(events).toEqual([]);
  });

  it('tells who created the tickets', () => {
    const events = activityOf([job('t', { kind: 'tickets', agentId: 'tk' })], who);

    expect(events.map((e) => [e.who, e.action])).toEqual([
      ['Lucy', 'creó los tickets de esta ejecución'],
    ]);
  });

  it('tells the story of a ticket in the order it happened', () => {
    const events = activityOf(
      [
        job('r1', {
          kind: 'review',
          agentId: 'rev',
          startedAt: '2026-10-25T10:10:00Z',
          finishedAt: '2026-10-25T10:12:00Z',
          review: { approved: false, summary: 'Falta algo', issues: ['Maneja el 404'] },
        }),
        job('d1', {
          kind: 'develop',
          agentId: 'dev',
          startedAt: '2026-10-25T10:00:00Z',
          finishedAt: '2026-10-25T10:08:00Z',
          output: 'Agregué la fuente',
        }),
      ],
      who,
    );

    expect(events.map((e) => `${e.who} ${e.action}`)).toEqual([
      'David empezó el desarrollo',
      'David terminó el desarrollo',
      'Maine empezó la revisión',
      'Maine pidió cambios',
    ]);
    expect(events[1].detail).toBe('Agregué la fuente');
    expect(events[3].detail).toContain('Falta algo');
    expect(events[3].detail).toContain('- Maneja el 404');
    expect(events[3].tone).toBe('warning');
  });

  it('says when the reviewer approved', () => {
    const events = activityOf(
      [
        job('r', {
          kind: 'review',
          agentId: 'rev',
          review: { approved: true, summary: 'Todo bien', issues: [] },
        }),
      ],
      who,
    );

    const approval = events.find((e) => e.action === 'aprobó el ticket');
    expect(approval).toMatchObject({ who: 'Maine', detail: 'Todo bien', tone: 'success' });
  });

  it('shows a failure with its reason, and marks the retries', () => {
    const events = activityOf(
      [
        job('d', {
          kind: 'develop',
          agentId: 'dev',
          status: 'failed',
          attempt: 2,
          error: 'Sin permiso',
        }),
      ],
      who,
    );

    expect(events.map((e) => e.action)).toEqual([
      'empezó el desarrollo (intento 2)',
      'falló en el desarrollo',
    ]);
    expect(events[1]).toMatchObject({ detail: 'Sin permiso', tone: 'danger' });
  });

  it('shows a cancelled job, and a review without a readable verdict', () => {
    const cancelled = activityOf(
      [job('d', { kind: 'develop', agentId: 'dev', status: 'cancelled' })],
      who,
    );
    const unreadable = activityOf(
      [job('r', { kind: 'review', agentId: 'rev', review: null })],
      who,
    );

    expect(cancelled.map((e) => e.action)).toContain('fue cancelado');
    expect(unreadable.map((e) => e.action)).toContain('terminó la revisión');
  });

  it('leaves out publishing the branch, which is not about a ticket', () => {
    expect(activityOf([job('p', { kind: 'publish', agentId: null })], who)).toEqual([]);
  });

  it('puts what has no time at the end, without shuffling it', () => {
    const events = activityOf(
      [
        job('a', {
          kind: 'develop',
          agentId: 'dev',
          startedAt: null,
          finishedAt: null,
          status: 'failed',
          error: 'x',
        }),
        job('b', {
          kind: 'review',
          agentId: 'rev',
          startedAt: '2026-10-25T10:00:00Z',
          status: 'running',
          finishedAt: null,
        }),
      ],
      who,
    );

    expect(events.map((e) => e.who)).toEqual(['Maine', 'David']);
  });
});
