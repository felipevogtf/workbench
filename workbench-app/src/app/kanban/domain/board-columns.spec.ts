import type { State } from '@tasks/index';
import { BoardCard } from '../models/board';
import { NO_STATE_KEY, applyMove, buildColumns, columnOf, positionAt } from './board-columns';

const states: State[] = [
  { id: 'doing', name: 'En curso', color: '#3b82f6', position: 1, isFinal: false },
  { id: 'todo', name: 'Por hacer', color: null, position: 0, isFinal: false },
];

function card(issueId: string, position: number): BoardCard {
  return {
    id: `c-${issueId}`,
    boardId: 'b1',
    issueId,
    position,
    createdAt: '2026-10-06T12:00:00Z',
  };
}

const issues = new Map<string, { stateId: string | null }>([
  ['a', { stateId: 'todo' }],
  ['b', { stateId: 'todo' }],
  ['c', { stateId: 'doing' }],
  ['d', { stateId: null }],
  ['e', { stateId: 'borrado' }],
]);

describe('buildColumns', () => {
  it('makes one column per state, in the order of the states', () => {
    const columns = buildColumns([], issues, states);
    expect(columns.map((column) => column.key)).toEqual(['todo', 'doing']);
  });

  it('puts the cards in their state column ordered by position', () => {
    const columns = buildColumns(
      [card('b', 2000), card('a', 1000), card('c', 1000)],
      issues,
      states,
    );
    expect(columns[0].issueIds).toEqual(['a', 'b']);
    expect(columns[1].issueIds).toEqual(['c']);
  });

  it('adds a first column for the issues without a state (or with a deleted one)', () => {
    const columns = buildColumns([card('d', 1000), card('e', 2000)], issues, states);
    expect(columns[0]).toMatchObject({ key: NO_STATE_KEY, stateId: null, issueIds: ['d', 'e'] });
  });

  it('ignores cards whose issue no longer exists', () => {
    const columns = buildColumns([card('zzz', 1000)], issues, states);
    expect(columns.flatMap((column) => column.issueIds)).toEqual([]);
  });
});

describe('applyMove', () => {
  const columns = buildColumns([card('a', 1000), card('b', 2000), card('c', 1000)], issues, states);

  it('reorders inside the same column', () => {
    const moved = applyMove(columns, 'a', 'todo', 1);
    expect(moved[0].issueIds).toEqual(['b', 'a']);
  });

  it('moves between columns at the given index', () => {
    const moved = applyMove(columns, 'a', 'doing', 0);
    expect(moved[0].issueIds).toEqual(['b']);
    expect(moved[1].issueIds).toEqual(['a', 'c']);
  });

  it('clamps an index past the end', () => {
    expect(applyMove(columns, 'a', 'doing', 99)[1].issueIds).toEqual(['c', 'a']);
  });

  it('does nothing when the target column does not exist', () => {
    expect(applyMove(columns, 'a', 'nope', 0)).toEqual(columns);
  });

  it('does not change the original columns', () => {
    applyMove(columns, 'a', 'doing', 0);
    expect(columns[0].issueIds).toEqual(['a', 'b']);
  });
});

describe('helpers', () => {
  it('finds the column of an issue', () => {
    const columns = buildColumns([card('c', 1000)], issues, states);
    expect(columnOf(columns, 'c')?.key).toBe('doing');
    expect(columnOf(columns, 'a')).toBeUndefined();
  });

  it('spaces positions like the server does', () => {
    expect([0, 1, 2].map(positionAt)).toEqual([1000, 2000, 3000]);
  });
});
