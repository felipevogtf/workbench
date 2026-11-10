import { Issue } from '@tasks/index';
import { groupByDay } from './group-by-day';
import { ProjectRef } from './group-by-project';

const issue = (id: string, sequence: number): Issue =>
  ({
    id,
    name: `Tarea ${id}`,
    projectId: 'p1',
    isLocal: false,
    remoteSequence: sequence,
    localSequence: sequence,
  }) as Issue;

const projects = new Map<string, ProjectRef>([
  ['p1', { id: 'p1', name: 'Melón', identifier: 'MEL' }],
]);

describe('groupByDay', () => {
  it('lists the tickets of each day, the day with its total and the longest ticket first', () => {
    const issues = new Map([
      ['a', issue('a', 10)],
      ['b', issue('b', 11)],
    ]);

    const result = groupByDay(
      [
        { date: '2026-10-07', issueId: 'a', hours: 1 },
        { date: '2026-10-05', issueId: 'a', hours: 1.5 },
        { date: '2026-10-05', issueId: 'b', hours: 3 },
      ],
      issues,
      projects,
    );

    expect(result.map((day) => [day.date, day.totalHours])).toEqual([
      ['2026-10-05', 4.5],
      ['2026-10-07', 1],
    ]);
    expect(result[0].issues.map((i) => [i.code, i.hours])).toEqual([
      ['MEL-11', 3],
      ['MEL-10', 1.5],
    ]);
  });

  it('keeps the hours of an issue that can no longer be found', () => {
    const [day] = groupByDay([{ date: '2026-10-05', issueId: 'x', hours: 2 }], new Map(), projects);

    expect(day.issues).toEqual([{ id: 'x', name: 'Tarea no disponible', code: '—', hours: 2 }]);
  });

  it('is empty without hours', () => {
    expect(groupByDay([], new Map(), projects)).toEqual([]);
  });
});
