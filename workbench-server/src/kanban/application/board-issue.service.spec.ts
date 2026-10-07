import { DomainError } from '@core/domain/domain.error';
import { Board } from '@kanban/domain/entities/board.entity';
import { BoardIssue } from '@kanban/domain/entities/board-issue.entity';
import { BoardIssueRepositoryPort } from '@kanban/domain/ports/board-issue-repository.port';
import { BoardRepositoryPort } from '@kanban/domain/ports/board-repository.port';
import { TasksGatewayPort } from '@kanban/domain/ports/tasks-gateway.port';
import { BoardIssueService } from './board-issue.service';

interface World {
  boards: Board[];
  cards: BoardIssue[];
  /** issueId → estado actual (las tareas que existen). */
  issues: Map<string, string | null>;
  states: Set<string>;
}

function build(world: Partial<World> = {}) {
  const state: World = {
    boards: [Board.create({ name: 'Tablero', description: null })],
    cards: [],
    issues: new Map(),
    states: new Set(['todo', 'doing']),
    ...world,
  };

  const boardRepository: BoardRepositoryPort = {
    findById: (id) =>
      Promise.resolve(state.boards.find((b) => b.id === id) ?? null),
    findAll: () => Promise.resolve(state.boards),
    save: () => Promise.resolve(),
    delete: () => Promise.resolve(),
  };
  const boardIssueRepository: BoardIssueRepositoryPort = {
    findById: (id) =>
      Promise.resolve(state.cards.find((c) => c.id === id) ?? null),
    findAll: () => Promise.resolve(state.cards),
    findByBoardId: (boardId) =>
      Promise.resolve(
        state.cards
          .filter((c) => c.boardId === boardId)
          .sort((a, b) => a.position - b.position),
      ),
    findByIssueId: (issueId) =>
      Promise.resolve(state.cards.find((c) => c.issueId === issueId) ?? null),
    save: (card) => {
      if (!state.cards.includes(card)) state.cards.push(card);
      return Promise.resolve();
    },
    saveMany: (cards) => {
      for (const card of cards)
        if (!state.cards.includes(card)) state.cards.push(card);
      return Promise.resolve();
    },
    delete: (id) => {
      state.cards = state.cards.filter((c) => c.id !== id);
      return Promise.resolve();
    },
    deleteByBoardId: () => Promise.resolve(),
  };
  const tasksGateway: TasksGatewayPort = {
    issueExists: (id) => Promise.resolve(state.issues.has(id)),
    findIssueRefsByIds: (ids) =>
      Promise.resolve(
        ids
          .filter((id) => state.issues.has(id))
          .map((id) => ({ id, stateId: state.issues.get(id) ?? null })),
      ),
    setIssueState: (id, stateId) => {
      state.issues.set(id, stateId);
      return Promise.resolve();
    },
    stateExists: (id) => Promise.resolve(state.states.has(id)),
  };

  const service = new BoardIssueService(
    boardIssueRepository,
    boardRepository,
    tasksGateway,
  );
  return { service, state, boardId: state.boards[0].id };
}

/** Orden de las tareas de una columna según la posición de sus tarjetas. */
const column = (state: World, stateId: string | null) =>
  state.cards
    .filter((c) => (state.issues.get(c.issueId) ?? null) === stateId)
    .sort((a, b) => a.position - b.position)
    .map((c) => c.issueId);

describe('BoardIssueService', () => {
  describe('addIssueToBoard', () => {
    it('puts each new card at the end of the column of its issue state', async () => {
      const { service, state, boardId } = build({
        issues: new Map([
          ['a', 'todo'],
          ['b', 'todo'],
          ['c', 'doing'],
        ]),
      });

      await service.addIssueToBoard({ boardId, issueId: 'a' });
      await service.addIssueToBoard({ boardId, issueId: 'b' });
      await service.addIssueToBoard({ boardId, issueId: 'c' });

      expect(column(state, 'todo')).toEqual(['a', 'b']);
      expect(state.cards.find((c) => c.issueId === 'a')?.position).toBe(1000);
      expect(state.cards.find((c) => c.issueId === 'b')?.position).toBe(2000);
      expect(state.cards.find((c) => c.issueId === 'c')?.position).toBe(1000);
    });

    it('rejects an unknown board or issue', async () => {
      const { service, boardId } = build({ issues: new Map([['a', null]]) });

      await expect(
        service.addIssueToBoard({ boardId: 'nope', issueId: 'a' }),
      ).rejects.toMatchObject({
        kind: 'not-found',
      });
      await expect(
        service.addIssueToBoard({ boardId, issueId: 'nope' }),
      ).rejects.toMatchObject({
        kind: 'not-found',
      });
    });

    it('does not let an issue be in two boards', async () => {
      const { service, boardId } = build({ issues: new Map([['a', null]]) });
      await service.addIssueToBoard({ boardId, issueId: 'a' });

      await expect(
        service.addIssueToBoard({ boardId, issueId: 'a' }),
      ).rejects.toMatchObject({
        kind: 'conflict',
      });
    });
  });

  describe('moveIssue', () => {
    async function board() {
      const world = build({
        issues: new Map([
          ['a', 'todo'],
          ['b', 'todo'],
          ['c', 'todo'],
          ['d', 'doing'],
        ]),
      });
      for (const issueId of ['a', 'b', 'c', 'd']) {
        await world.service.addIssueToBoard({
          boardId: world.boardId,
          issueId,
        });
      }
      return world;
    }

    it('reorders a card inside its column and renumbers it', async () => {
      const { service, state, boardId } = await board();

      await service.moveIssue(boardId, 'c', { index: 0 });

      expect(column(state, 'todo')).toEqual(['c', 'a', 'b']);
      expect(
        state.cards
          .filter((c) => state.issues.get(c.issueId) === 'todo')
          .map((c) => c.position),
      ).toEqual([2000, 3000, 1000]);
    });

    it('moves a card to another column: it changes the issue state and lands where asked', async () => {
      const { service, state, boardId } = await board();

      await service.moveIssue(boardId, 'a', { stateId: 'doing', index: 0 });

      expect(state.issues.get('a')).toBe('doing');
      expect(column(state, 'doing')).toEqual(['a', 'd']);
      expect(column(state, 'todo')).toEqual(['b', 'c']);
    });

    it('moves a card to the end when the index is past the column', async () => {
      const { service, state, boardId } = await board();

      await service.moveIssue(boardId, 'a', { stateId: 'doing', index: 99 });

      expect(column(state, 'doing')).toEqual(['d', 'a']);
    });

    it('can leave a card without state', async () => {
      const { service, state, boardId } = await board();

      await service.moveIssue(boardId, 'a', { stateId: null, index: 0 });

      expect(state.issues.get('a')).toBeNull();
    });

    it('keeps the state when no target state is given', async () => {
      const { service, state, boardId } = await board();

      await service.moveIssue(boardId, 'b', { index: 0 });

      expect(state.issues.get('b')).toBe('todo');
    });

    it('rejects a bad index, an unknown state and a card that is not in the board', async () => {
      const { service, boardId } = await board();

      await expect(
        service.moveIssue(boardId, 'a', { index: -1 }),
      ).rejects.toBeInstanceOf(DomainError);
      await expect(
        service.moveIssue(boardId, 'a', { index: 1.5 }),
      ).rejects.toBeInstanceOf(DomainError);
      await expect(
        service.moveIssue(boardId, 'a', { stateId: 'nope', index: 0 }),
      ).rejects.toMatchObject({
        kind: 'not-found',
      });
      await expect(
        service.moveIssue(boardId, 'zzz', { index: 0 }),
      ).rejects.toMatchObject({
        kind: 'not-found',
      });
    });
  });

  it('removes a card from the board', async () => {
    const { service, state, boardId } = build({
      issues: new Map([['a', null]]),
    });
    await service.addIssueToBoard({ boardId, issueId: 'a' });

    await service.removeIssueFromBoard({ boardId, issueId: 'a' });

    expect(state.cards).toHaveLength(0);
    await expect(
      service.removeIssueFromBoard({ boardId, issueId: 'a' }),
    ).rejects.toMatchObject({
      kind: 'not-found',
    });
  });
});
