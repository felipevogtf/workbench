import { Issue, DEFAULT_ISSUE_FILTERS, IssueFilters, issuePlaneUrl } from '../models/issue';
import { TimeEntry } from '../models/catalogs';
import { matchesFilters } from './issues.store';
import { reordered } from './states.store';
import { groupByDay } from './time-entries.store';

function issue(patch: Partial<Issue> = {}): Issue {
  return {
    id: 'i1',
    name: 'Arreglar login',
    isLocal: true,
    externalId: null,
    remoteSequence: null,
    localSequence: 12,
    externalState: null,
    description: null,
    priority: null,
    estimatedHours: null,
    stateId: 's1',
    projectId: 'p1',
    labelIds: ['l1'],
    startDate: null,
    dueDate: null,
    closedAt: null,
    ...patch,
  };
}

const filters = (patch: Partial<IssueFilters>): IssueFilters => ({
  ...DEFAULT_ISSUE_FILTERS,
  ...patch,
});

/** Estados activos por defecto: s1 (pendiente) y los sin estado; s9 es finalizado. */
const ACTIVE = new Set(['s1', 'none']);
const match = (i: Issue, f: IssueFilters, project = '', code = '') =>
  matchesFilters(i, f, project, code, ACTIVE);

describe('matchesFilters', () => {
  it('accepts everything with the default filters', () => {
    expect(match(issue(), DEFAULT_ISSUE_FILTERS, 'Melón')).toBe(true);
  });

  it('filters by project and label', () => {
    expect(match(issue(), filters({ projectId: 'p2' }), '')).toBe(false);
    expect(match(issue(), filters({ labelId: 'l2' }), '')).toBe(false);
    expect(match(issue(), filters({ projectId: 'p1', labelId: 'l1' }), '')).toBe(true);
  });

  it('hides the issues whose state is not among the active ones (the finished by default)', () => {
    expect(match(issue({ stateId: 's9' }), DEFAULT_ISSUE_FILTERS)).toBe(false);
    expect(match(issue({ stateId: 's1' }), DEFAULT_ISSUE_FILTERS)).toBe(true);
  });

  it('shows the issues without a state when the «none» state is active', () => {
    expect(match(issue({ stateId: null }), DEFAULT_ISSUE_FILTERS)).toBe(true);
    expect(
      matchesFilters(issue({ stateId: null }), DEFAULT_ISSUE_FILTERS, '', '', new Set(['s1'])),
    ).toBe(false);
  });

  it('shows a finished issue when its state is activated', () => {
    expect(
      matchesFilters(issue({ stateId: 's9' }), DEFAULT_ISSUE_FILTERS, '', '', new Set(['s9'])),
    ).toBe(true);
  });

  it('keeps closed issues out of the open view, whatever their state', () => {
    const closed = issue({ closedAt: '2026-10-06T12:00:00Z' });
    expect(match(closed, DEFAULT_ISSUE_FILTERS)).toBe(false);
  });

  it('shows only the closed issues in the closed view, ignoring the state', () => {
    const closed = issue({ stateId: 's9', closedAt: '2026-10-06T12:00:00Z' });
    expect(match(closed, filters({ view: 'closed' }))).toBe(true);
    expect(match(issue(), filters({ view: 'closed' }))).toBe(false);
  });

  it('still applies the other filters in the closed view', () => {
    const closed = issue({ closedAt: '2026-10-06T12:00:00Z' });
    expect(match(closed, filters({ view: 'closed', projectId: 'p2' }))).toBe(false);
  });

  it('filters by origin', () => {
    expect(match(issue(), filters({ origin: 'plane' }), '')).toBe(false);
    expect(match(issue({ isLocal: false }), filters({ origin: 'plane' }), '')).toBe(true);
    expect(match(issue({ isLocal: false }), filters({ origin: 'local' }), '')).toBe(false);
  });

  it('searches the name, the project and the number, ignoring case', () => {
    expect(match(issue(), filters({ search: 'LOGIN' }), 'Melón')).toBe(true);
    expect(match(issue(), filters({ search: 'melón' }), 'Melón')).toBe(true);
    expect(match(issue(), filters({ search: '#12' }), 'Melón')).toBe(true);
    expect(match(issue(), filters({ search: 'otra cosa' }), 'Melón')).toBe(false);
  });

  it('uses the Plane sequence as the number when there is one', () => {
    const fromPlane = issue({ isLocal: false, remoteSequence: 253 });
    expect(match(fromPlane, filters({ search: '#253' }), '')).toBe(true);
  });
});

describe('reordered', () => {
  it('swaps a state with its neighbour', () => {
    expect(reordered(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(reordered(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('returns null at the edges or for an unknown state', () => {
    expect(reordered(['a', 'b'], 'a', -1)).toBeNull();
    expect(reordered(['a', 'b'], 'b', 1)).toBeNull();
    expect(reordered(['a', 'b'], 'z', 1)).toBeNull();
  });
});

describe('groupByDay', () => {
  const entry = (id: string, date: string, hours: number): TimeEntry => ({
    id,
    issueId: 'i1',
    date,
    hours,
  });

  it('groups several entries of the same day and totals them', () => {
    const days = groupByDay([entry('a', '2026-10-05', 1.5), entry('b', '2026-10-05', 2)]);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ date: '2026-10-05', hours: 3.5 });
    expect(days[0].entries).toHaveLength(2);
  });

  it('lists the most recent day first', () => {
    const days = groupByDay([entry('a', '2026-10-01', 1), entry('b', '2026-10-06', 1)]);
    expect(days.map((day) => day.date)).toEqual(['2026-10-06', '2026-10-01']);
  });

  describe('issuePlaneUrl', () => {
    const project = { identifier: 'MEL', ticketBaseUrl: 'https://plane.x.cl/ws/browse/' };

    it('builds the link of a Plane issue from its project and sequence', () => {
      const plane = issue({ isLocal: false, remoteSequence: 253 });
      expect(issuePlaneUrl(plane, project)).toBe('https://plane.x.cl/ws/browse/MEL-253/');
    });

    it('has no link for local issues or projects without Plane data', () => {
      expect(issuePlaneUrl(issue(), project)).toBeNull();
      const plane = issue({ isLocal: false, remoteSequence: 1 });
      expect(issuePlaneUrl(plane, { identifier: null, ticketBaseUrl: null })).toBeNull();
      expect(issuePlaneUrl(plane, undefined)).toBeNull();
    });
  });
});
