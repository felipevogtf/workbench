import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Issue, IssuesStore, ProjectsStore } from '@tasks/index';
import { TimeReport } from '../models/time-report';
import { DashboardApi } from './dashboard.api';
import { DashboardStore } from './dashboard.store';

const issue = {
  id: 'i1',
  name: 'Corregir el login',
  projectId: 'p1',
  isLocal: false,
  remoteSequence: 7,
  localSequence: 1,
} as Issue;

const report = (from: string, to: string, extra: Partial<TimeReport> = {}): TimeReport => ({
  from,
  to,
  totalHours: 0,
  byDay: [],
  byIssue: [],
  ...extra,
});

describe('DashboardStore', () => {
  let api: { timeReport: ReturnType<typeof vi.fn> };

  function create(): DashboardStore {
    api = { timeReport: vi.fn((from: string, to: string) => of(report(from, to))) };
    TestBed.configureTestingModule({
      providers: [
        DashboardStore,
        { provide: DashboardApi, useValue: api },
        {
          provide: IssuesStore,
          useValue: { load: () => Promise.resolve(), issueById: signal(new Map([['i1', issue]])) },
        },
        {
          provide: ProjectsStore,
          useValue: {
            load: () => Promise.resolve(),
            projectById: signal(new Map([['p1', { id: 'p1', name: 'Melón', identifier: 'MEL' }]])),
          },
        },
      ],
    });
    return TestBed.inject(DashboardStore);
  }

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();
  }

  it('starts on the current week, from Monday to Sunday', async () => {
    const store = create();
    await settle();

    const { from, to } = store.range();
    expect(new Date(`${from}T12:00:00`).getDay()).toBe(1);
    expect(new Date(`${to}T12:00:00`).getDay()).toBe(0);
    expect(api.timeReport).toHaveBeenCalledWith(from, to, true);
  });

  it('counts the local tasks by default and asks again without them when unchecked', async () => {
    const store = create();
    await settle();
    expect(store.includeLocal()).toBe(true);
    api.timeReport.mockClear();

    store.includeLocal.set(false);
    await settle();

    const { from, to } = store.range();
    expect(api.timeReport).toHaveBeenCalledTimes(1);
    expect(api.timeReport).toHaveBeenCalledWith(from, to, false);
  });

  it('asks again when the period changes', async () => {
    const store = create();
    await settle();
    api.timeReport.mockClear();

    store.shift(-1);
    await settle();
    expect(api.timeReport).toHaveBeenCalledTimes(1);

    store.setMode('month');
    await settle();
    const { from, to } = store.range();
    expect(from.endsWith('-01')).toBe(true);
    expect(api.timeReport).toHaveBeenLastCalledWith(from, to, true);
  });

  it('uses the dates of the free range and does not ask for an invalid one', async () => {
    const store = create();
    store.setMode('range');
    store.setCustomRange({ from: '2026-10-01', to: '2026-10-15' });
    await settle();
    expect(api.timeReport).toHaveBeenLastCalledWith('2026-10-01', '2026-10-15', true);

    api.timeReport.mockClear();
    store.setCustomRange({ from: '2026-10-20' });
    await settle();

    expect(store.rangeValid()).toBe(false);
    expect(api.timeReport).not.toHaveBeenCalled();
  });

  it('groups the worked issues by project and fills the days without hours', async () => {
    const store = create();
    store.setMode('range');
    api.timeReport.mockImplementation((from: string, to: string) =>
      of(
        report(from, to, {
          totalHours: 5,
          byDay: [{ date: '2026-10-02', hours: 5 }],
          byIssue: [{ issueId: 'i1', hours: 5 }],
        }),
      ),
    );
    store.setCustomRange({ from: '2026-10-01', to: '2026-10-03' });
    await settle();

    expect(store.totalHours()).toBe(5);
    expect(store.issueCount()).toBe(1);
    expect(store.activeDays()).toBe(1);
    expect(store.days()).toEqual([
      { date: '2026-10-01', hours: 0 },
      { date: '2026-10-02', hours: 5 },
      { date: '2026-10-03', hours: 0 },
    ]);
    expect(store.workedProjects()).toMatchObject([
      { name: 'Melón', totalHours: 5, issues: [{ code: 'MEL-7', hours: 5 }] },
    ]);
  });

  it('shows the error when the report cannot be loaded', async () => {
    const store = create();
    api.timeReport.mockImplementation(() => {
      throw new Error('boom');
    });
    store.setMode('month');
    await settle();

    expect(store.error()).toBe('boom');
  });
});
