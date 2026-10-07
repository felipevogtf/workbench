import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Toast } from '@shared/ui/toast/toast';
import { State } from '../models/catalogs';
import { Issue } from '../models/issue';
import { IssuesStore } from './issues.store';
import { ProjectsStore } from './projects.store';
import { StatesStore } from './states.store';
import { TasksApi } from './tasks.api';

function issue(id: string, stateId: string | null, closedAt: string | null = null): Issue {
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
    closedAt,
  };
}

const states: State[] = [
  { id: 'todo', name: 'Por hacer', color: null, position: 0, isFinal: false },
  { id: 'done', name: 'Hecho', color: null, position: 1, isFinal: true },
];

describe('IssuesStore', () => {
  let api: Record<'listIssues' | 'closeIssues' | 'reopenIssues', ReturnType<typeof vi.fn>>;
  let store: IssuesStore;
  let toast: Toast;
  const hidden = signal<ReadonlySet<string>>(new Set());

  beforeEach(async () => {
    hidden.set(new Set());
    api = {
      listIssues: vi.fn(() =>
        of([
          issue('a', 'todo'),
          issue('b', 'done'),
          issue('c', null),
          issue('d', 'todo', '2026-10-01'),
        ]),
      ),
      closeIssues: vi.fn(),
      reopenIssues: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: TasksApi, useValue: api },
        {
          provide: ProjectsStore,
          useValue: {
            hiddenIds: hidden,
            projectById: () => new Map(),
            load: () => Promise.resolve(),
          },
        },
        { provide: StatesStore, useValue: { states: () => states, load: () => Promise.resolve() } },
      ],
    });
    store = TestBed.inject(IssuesStore);
    toast = TestBed.inject(Toast);
    await store.load();
  });

  const ids = () => store.filtered().map((i) => i.id);

  it('by default shows the pending and the unassigned, not the finished nor the closed', () => {
    expect(ids().sort()).toEqual(['a', 'c']);
  });

  it('shows the finished ones when their state is activated', () => {
    store.setStateKeys(['todo', 'done', 'none']);
    expect(ids().sort()).toEqual(['a', 'b', 'c']);
  });

  it('shows the history in the closed view', () => {
    store.setFilters({ view: 'closed' });
    expect(ids()).toEqual(['d']);
  });

  it('closes issues: they leave the open view and the server count is reported', async () => {
    api.closeIssues.mockReturnValue(of({ updated: 2 }));

    await store.close(['a', 'b']);

    expect(api.closeIssues).toHaveBeenCalledWith(['a', 'b']);
    expect(ids()).toEqual(['c']);
    store.setFilters({ view: 'closed' });
    expect(ids().sort()).toEqual(['a', 'b', 'd']);
    expect(toast.messages()[0].message).toBe('2 tareas cerradas');
  });

  it('reopens issues: they come back with the state they had', async () => {
    api.reopenIssues.mockReturnValue(of({ updated: 1 }));

    await store.reopen(['d']);

    expect(ids().sort()).toEqual(['a', 'c', 'd']);
    expect(toast.messages()[0].message).toBe('1 tarea reabierta');
  });

  it('does not touch the list when the server fails', async () => {
    api.closeIssues.mockReturnValue(throwError(() => new Error('boom')));

    expect(await store.close(['a'])).toBe(0);

    expect(ids().sort()).toEqual(['a', 'c']);
    expect(toast.messages()[0]).toMatchObject({ tone: 'danger', message: 'boom' });
  });

  it('does nothing without ids', async () => {
    await store.close([]);
    expect(api.closeIssues).not.toHaveBeenCalled();
  });

  it('hides the tasks of hidden projects from every list, but keeps them findable by id', () => {
    hidden.set(new Set(['p1']));

    expect(ids()).toEqual([]);
    expect(store.issues()).toHaveLength(0);
    expect(store.visibleIssueById().size).toBe(0);
    expect(store.allIssues()).toHaveLength(4);
    expect(store.issueById().get('a')?.id).toBe('a');
  });
});
