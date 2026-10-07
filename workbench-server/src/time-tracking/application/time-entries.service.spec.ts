import { DomainError } from '@core/domain/domain.error';
import { TimeEntry } from '@time-tracking/domain/entities/time-entry.entity';
import { TimeEntryRepositoryPort } from '@time-tracking/domain/ports/time-entry-repository.port';
import { TimeEntriesService } from './time-entries.service';

function build(existingIssues: string[] = ['i1']) {
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
    sumHoursByIssueId: (issueId) =>
      Promise.resolve(
        entries
          .filter((e) => e.issueId === issueId)
          .reduce((sum, e) => sum + e.hours, 0),
      ),
  };
  const service = new TimeEntriesService(repo, {
    exists: (id) => Promise.resolve(existingIssues.includes(id)),
  });
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
