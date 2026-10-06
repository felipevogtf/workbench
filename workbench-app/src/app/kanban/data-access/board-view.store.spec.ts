import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Toast } from '@shared/ui/toast/toast';
import { Issue, IssuesStore, LabelsStore, ProjectsStore, State, StatesStore } from '@tasks/index';
import { BoardCard } from '../models/board';
import { BoardViewStore } from './board-view.store';
import { BoardsApi } from './boards.api';

const states: State[] = [
  { id: 'todo', name: 'Por hacer', color: null, position: 0 },
  { id: 'doing', name: 'En curso', color: null, position: 1 },
];

function makeIssue(id: string, stateId: string | null): Issue {
  return {
    id,
    name: id,
    isLocal: true,
    externalId: null,
    remoteSequence: null,
    localSequence: 1,
    externalState: null,
    description: null,
    priority: null,
    estimatedHours: null,
    stateId,
    projectId: 'p1',
    labelIds: [],
    startDate: null,
    dueDate: null,
  };
}

function makeCard(issueId: string, position: number): BoardCard {
  return {
    id: `c-${issueId}`,
    boardId: 'b1',
    issueId,
    position,
    createdAt: '2026-10-06T12:00:00Z',
  };
}

describe('BoardViewStore', () => {
  let api: Record<'cards' | 'move' | 'addIssue' | 'removeIssue', ReturnType<typeof vi.fn>>;
  let store: BoardViewStore;
  let toast: Toast;
  let issues: ReturnType<typeof signal<Issue[]>>;
  let applied: [string, string | null][];

  beforeEach(async () => {
    issues = signal([makeIssue('a', 'todo'), makeIssue('b', 'todo'), makeIssue('c', 'doing')]);
    applied = [];
    api = {
      cards: vi.fn(() => of([makeCard('a', 1000), makeCard('b', 2000), makeCard('c', 1000)])),
      move: vi.fn(() => of(undefined)),
      addIssue: vi.fn(),
      removeIssue: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [
        BoardViewStore,
        { provide: BoardsApi, useValue: api },
        {
          provide: IssuesStore,
          useValue: {
            load: () => Promise.resolve(),
            issueById: () => new Map(issues().map((issue) => [issue.id, issue])),
            applyState: (id: string, stateId: string | null) => {
              applied.push([id, stateId]);
              issues.update((list) =>
                list.map((issue) => (issue.id === id ? { ...issue, stateId } : issue)),
              );
            },
          },
        },
        { provide: StatesStore, useValue: { load: () => Promise.resolve(), states: () => states } },
        { provide: ProjectsStore, useValue: { load: () => Promise.resolve() } },
        { provide: LabelsStore, useValue: { load: () => Promise.resolve() } },
      ],
    });
    store = TestBed.inject(BoardViewStore);
    toast = TestBed.inject(Toast);
    await store.load('b1');
  });

  const ids = (key: string) => store.columns().find((column) => column.key === key)?.issueIds;

  it('builds the columns from the cards, the issues and the states', () => {
    expect(ids('todo')).toEqual(['a', 'b']);
    expect(ids('doing')).toEqual(['c']);
  });

  it('moves a card at once and tells the server the column and the index', async () => {
    const pending = store.move('a', 'doing', 0);

    expect(ids('todo')).toEqual(['b']);
    expect(ids('doing')).toEqual(['a', 'c']);
    await pending;
    expect(api.move).toHaveBeenCalledWith('b1', 'a', { stateId: 'doing', index: 0 });
    expect(applied).toEqual([['a', 'doing']]);
  });

  it('puts the card back and reports the error when the server refuses', async () => {
    api.move.mockReturnValue(throwError(() => new Error('Estado inexistente')));

    await store.move('a', 'doing', 0);

    expect(ids('todo')).toEqual(['a', 'b']);
    expect(ids('doing')).toEqual(['c']);
    expect(applied.at(-1)).toEqual(['a', 'todo']);
    expect(toast.messages()[0]).toMatchObject({ tone: 'danger', message: 'Estado inexistente' });
  });

  it('does not call the server when the card is dropped where it was', async () => {
    await store.move('a', 'todo', 0);
    expect(api.move).not.toHaveBeenCalled();
  });

  it('reorders inside a column', async () => {
    await store.move('a', 'todo', 1);
    expect(ids('todo')).toEqual(['b', 'a']);
    expect(api.move).toHaveBeenCalledWith('b1', 'a', { stateId: 'todo', index: 1 });
  });

  it('removes a card from the board', async () => {
    await store.removeIssue('b');
    expect(ids('todo')).toEqual(['a']);
  });

  it('adds the cards that the server accepts and reports the rest', async () => {
    api.addIssue
      .mockReturnValueOnce(of(makeCard('d', 3000)))
      .mockReturnValueOnce(throwError(() => new Error('Ya está en otro tablero')));
    issues.update((list) => [...list, makeIssue('d', 'doing'), makeIssue('e', 'doing')]);

    await store.addIssues(['d', 'e']);

    expect(ids('doing')).toEqual(['c', 'd']);
    expect(toast.messages().some((m) => m.tone === 'danger')).toBe(true);
    expect(toast.messages().some((m) => m.tone === 'success')).toBe(true);
  });
});
