import { DomainError } from '@core/domain/domain.error';
import { TimeEntry } from '@time-tracking/domain/entities/time-entry.entity';
import { TimeEntryRepositoryPort } from '@time-tracking/domain/ports/time-entry-repository.port';
import { TimeEntriesService } from './time-entries.service';

function build(existingIssues: string[] = ['i1'], localIssues: string[] = []) {
  const entries: TimeEntry[] = [];
  const repo: TimeEntryRepositoryPort = {
    findById: (id) => Promise.resolve(entries.find((e) => e.id === id) ?? null),
    findByIssueId: (issueId) =>
      Promise.resolve(entries.filter((e) => e.issueId === issueId)),
    save: (entry) => {
      entries.push(entry);
      return Promise.resolve(entry);
    },
    delete: (id) => {
      entries.splice(
        entries.findIndex((e) => e.id === id),
        1,
      );
      return Promise.resolve();
    },
    moveToIssue: (from, to) => {
      const moving = entries.filter((e) => e.issueId === from);
      entries.splice(
        0,
        entries.length,
        ...entries.map((e) =>
          e.issueId === from
            ? TimeEntry.reconstruct({
                id: e.id,
                issueId: to,
                hours: e.hours,
                date: e.date,
                createdAt: e.createdAt,
              })
            : e,
        ),
      );
      return Promise.resolve(moving.length);
    },
    findBetweenDates: (from, to) =>
      Promise.resolve(entries.filter((e) => e.date >= from && e.date <= to)),
    sumHoursGroupedByIssue: () => {
      const totals: Record<string, number> = {};
      for (const e of entries)
        totals[e.issueId] = (totals[e.issueId] ?? 0) + e.hours;
      return Promise.resolve(totals);
    },
    sumHoursByIssueId: (issueId) =>
      Promise.resolve(
        entries
          .filter((e) => e.issueId === issueId)
          .reduce((sum, e) => sum + e.hours, 0),
      ),
  };
  const service = new TimeEntriesService(
    repo,
    { exists: (id) => Promise.resolve(existingIssues.includes(id)) },
    {
      findLocalIds: (ids) =>
        Promise.resolve(new Set(ids.filter((id) => localIssues.includes(id)))),
    },
  );
  return { service, entries };
}

describe('TimeEntriesService', () => {
  it('registers several entries on the same day for one issue and totals them', async () => {
    const { service } = build();

    await service.addTimeEntry({
      issueId: 'i1',
      hours: 1.5,
      date: '2026-10-07',
    });
    await service.addTimeEntry({ issueId: 'i1', hours: 2, date: '2026-10-07' });

    expect(await service.findByIssue('i1')).toHaveLength(2);
    expect(await service.getTotalHoursByIssue('i1')).toBe(3.5);
  });

  it('moves the hours of one issue to another', async () => {
    const { service } = build(['i1', 'i2']);
    await service.addTimeEntry({
      issueId: 'i1',
      hours: 1.5,
      date: '2026-10-07',
    });
    await service.addTimeEntry({ issueId: 'i1', hours: 2, date: '2026-10-08' });

    expect(await service.moveEntries('i1', 'i2')).toBe(2);
    expect(await service.getTotalHoursByIssue('i1')).toBe(0);
    expect(await service.getTotalHoursByIssue('i2')).toBe(3.5);
    await expect(service.moveEntries('i1', 'nope')).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('totals the logged hours of every issue that has some', async () => {
    const { service } = build(['i1', 'i2', 'i3']);
    await service.addTimeEntry({
      issueId: 'i1',
      hours: 1.5,
      date: '2026-10-07',
    });
    await service.addTimeEntry({ issueId: 'i1', hours: 2, date: '2026-10-08' });
    await service.addTimeEntry({ issueId: 'i2', hours: 4, date: '2026-10-08' });

    expect(await service.getTotalsByIssue()).toEqual({ i1: 3.5, i2: 4 });
  });

  it('builds a report with only the entries inside the range', async () => {
    const { service } = build(['i1', 'i2']);
    await service.addTimeEntry({ issueId: 'i1', hours: 2, date: '2026-10-05' });
    await service.addTimeEntry({ issueId: 'i2', hours: 3, date: '2026-10-07' });
    await service.addTimeEntry({ issueId: 'i1', hours: 8, date: '2026-09-30' });

    const report = await service.getReport('2026-10-05', '2026-10-11');

    expect(report.totalHours).toBe(5);
    expect(report.byDay).toEqual([
      { date: '2026-10-05', hours: 2 },
      { date: '2026-10-07', hours: 3 },
    ]);
    expect(report.byIssue.map((i) => i.issueId)).toEqual(['i2', 'i1']);
  });

  it('counts local issues by default and leaves them out when asked', async () => {
    const { service } = build(['plane', 'local'], ['local']);
    await service.addTimeEntry({
      issueId: 'plane',
      hours: 2,
      date: '2026-10-05',
    });
    await service.addTimeEntry({
      issueId: 'local',
      hours: 3,
      date: '2026-10-05',
    });
    await service.addTimeEntry({
      issueId: 'local',
      hours: 1,
      date: '2026-10-06',
    });

    const all = await service.getReport('2026-10-05', '2026-10-11');
    expect(all.totalHours).toBe(6);
    expect(all.byIssue.map((i) => i.issueId)).toEqual(['local', 'plane']);

    const withoutLocal = await service.getReport('2026-10-05', '2026-10-11', {
      includeLocal: false,
    });
    expect(withoutLocal.totalHours).toBe(2);
    expect(withoutLocal.byDay).toEqual([{ date: '2026-10-05', hours: 2 }]);
    expect(withoutLocal.byIssue).toEqual([{ issueId: 'plane', hours: 2 }]);
  });

  it('rejects an invalid report range', async () => {
    const { service } = build();
    await expect(service.getReport('2026-10-06', '2026-10-05')).rejects.toThrow(
      'from must not be after to',
    );
  });

  it('refuses to register hours on an issue that does not exist', async () => {
    const { service } = build();
    await expect(
      service.addTimeEntry({ issueId: 'nope', hours: 1, date: '2026-10-07' }),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('rejects hours out of range', async () => {
    const { service } = build();
    await expect(
      service.addTimeEntry({ issueId: 'i1', hours: 0, date: '2026-10-07' }),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      service.addTimeEntry({ issueId: 'i1', hours: 25, date: '2026-10-07' }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('deletes an entry and reports one that does not exist', async () => {
    const { service, entries } = build();
    const entry = await service.addTimeEntry({
      issueId: 'i1',
      hours: 1,
      date: '2026-10-07',
    });

    await service.deleteTimeEntry(entry.id);

    expect(entries).toHaveLength(0);
    await expect(service.deleteTimeEntry(entry.id)).rejects.toMatchObject({
      kind: 'not-found',
    });
  });
});
