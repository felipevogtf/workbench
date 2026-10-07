import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { BoardsApi } from '../../data-access/boards.api';
import { Board, BoardCard } from '../../models/board';
import { BoardListPage } from './board-list-page';

const board = (id: string, name: string): Board => ({
  id,
  name,
  description: null,
  createdAt: '2026-10-06T12:00:00Z',
});

const card = (boardId: string, issueId: string): BoardCard => ({
  id: `${boardId}-${issueId}`,
  boardId,
  issueId,
  position: 1000,
  createdAt: '2026-10-06T12:00:00Z',
});

describe('BoardListPage', () => {
  async function render(api: Partial<Record<'list' | 'assignments', unknown>>) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BoardsApi, useValue: { assignments: () => of([]), ...api } },
      ],
    });
    const fixture = TestBed.createComponent(BoardListPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists the boards with their task count', async () => {
    const root = await render({
      list: () => of([board('a', 'Sprint 1'), board('b', 'Sprint 2')]),
      assignments: () => of([card('a', '1'), card('a', '2')]),
    });

    const text = root.textContent ?? '';
    expect(text).toContain('Sprint 1');
    expect(text).toContain('Sprint 2');
    expect(text).toContain('2 tareas');
    expect(text).toContain('0 tareas');
  });

  it('links each board to its page', async () => {
    const root = await render({ list: () => of([board('a', 'Sprint 1')]) });

    const link = root.querySelector<HTMLAnchorElement>('a.board-link');
    expect(link?.getAttribute('href')).toBe('/kanban/a');
  });

  it('invites to create a board when there are none', async () => {
    const root = await render({ list: () => of([]) });

    expect(root.textContent).toContain('Todavía no hay tableros');
  });

  it('shows the error when the boards cannot be loaded', async () => {
    const root = await render({ list: () => throwError(() => new Error('Sin conexión')) });

    expect(root.textContent).toContain('No se pudieron cargar los tableros');
    expect(root.textContent).toContain('Sin conexión');
  });
});
