import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BoardCard } from '../models/board';
import { BoardsApi } from './boards.api';
import { BoardsStore } from './boards.store';

const card = (boardId: string, issueId: string): BoardCard => ({
  id: `${boardId}-${issueId}`,
  boardId,
  issueId,
  position: 1000,
  createdAt: '2026-10-06T12:00:00Z',
});

describe('BoardsStore counts', () => {
  let api: { assignments: ReturnType<typeof vi.fn> };
  let store: BoardsStore;

  beforeEach(() => {
    api = { assignments: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: BoardsApi, useValue: api }] });
    store = TestBed.inject(BoardsStore);
  });

  it('counts the tasks of each board', async () => {
    api.assignments.mockReturnValue(of([card('a', '1'), card('a', '2'), card('b', '3')]));

    await store.loadCounts();

    expect(store.counts().get('a')).toBe(2);
    expect(store.counts().get('b')).toBe(1);
    expect(store.counts().get('c')).toBeUndefined();
  });

  it('shows no counts instead of failing when the request fails', async () => {
    api.assignments.mockReturnValue(throwError(() => new Error('boom')));

    await store.loadCounts();

    expect(store.counts().size).toBe(0);
  });
});
