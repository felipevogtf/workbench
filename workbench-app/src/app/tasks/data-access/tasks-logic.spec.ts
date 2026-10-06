import { Issue, DEFAULT_ISSUE_FILTERS, IssueFilters } from '../models/issue';
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
    ...patch,
  };
}

const filters = (patch: Partial<IssueFilters>): IssueFilters => ({
  ...DEFAULT_ISSUE_FILTERS,
  ...patch,
});

describe('matchesFilters', () => {
  it('accepts everything with the default filters', () => {
    expect(matchesFilters(issue(), DEFAULT_ISSUE_FILTERS, 'Melón')).toBe(true);
  });

  it('filters by project, state and label', () => {
    expect(matchesFilters(issue(), filters({ projectId: 'p2' }), '')).toBe(false);
    expect(matchesFilters(issue(), filters({ stateId: 's2' }), '')).toBe(false);
    expect(matchesFilters(issue(), filters({ labelId: 'l2' }), '')).toBe(false);
    expect(
      matchesFilters(issue(), filters({ projectId: 'p1', stateId: 's1', labelId: 'l1' }), ''),
    ).toBe(true);
  });

  it('filters the issues without a state', () => {
    expect(matchesFilters(issue({ stateId: null }), filters({ stateId: 'none' }), '')).toBe(true);
    expect(matchesFilters(issue(), filters({ stateId: 'none' }), '')).toBe(false);
  });

  it('filters by origin', () => {
    expect(matchesFilters(issue(), filters({ origin: 'plane' }), '')).toBe(false);
    expect(matchesFilters(issue({ isLocal: false }), filters({ origin: 'plane' }), '')).toBe(true);
    expect(matchesFilters(issue({ isLocal: false }), filters({ origin: 'local' }), '')).toBe(false);
  });

  it('searches the name, the project and the number, ignoring case', () => {
    expect(matchesFilters(issue(), filters({ search: 'LOGIN' }), 'Melón')).toBe(true);
    expect(matchesFilters(issue(), filters({ search: 'melón' }), 'Melón')).toBe(true);
    expect(matchesFilters(issue(), filters({ search: '#12' }), 'Melón')).toBe(true);
    expect(matchesFilters(issue(), filters({ search: 'otra cosa' }), 'Melón')).toBe(false);
  });

  it('uses the Plane sequence as the number when there is one', () => {
    const fromPlane = issue({ isLocal: false, remoteSequence: 253 });
    expect(matchesFilters(fromPlane, filters({ search: '#253' }), '')).toBe(true);
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
});
