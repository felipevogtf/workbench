import { Issue } from '@tasks/index';
import { ProjectRef, groupByProject } from './group-by-project';

const issue = (id: string, projectId: string, sequence: number, name = `Tarea ${id}`): Issue =>
  ({
    id,
    name,
    projectId,
    isLocal: false,
    remoteSequence: sequence,
    localSequence: sequence,
  }) as Issue;

const projects = new Map<string, ProjectRef>([
  ['p1', { id: 'p1', name: 'Melón', identifier: 'MEL' }],
  ['p2', { id: 'p2', name: 'Interno', identifier: null }],
]);

describe('groupByProject', () => {
  it('groups the issues by project, with the total hours of each project', () => {
    const issues = new Map([
      ['a', issue('a', 'p1', 10)],
      ['b', issue('b', 'p1', 11)],
      ['c', issue('c', 'p2', 3)],
    ]);

    const result = groupByProject(
      [
        { issueId: 'a', hours: 2 },
        { issueId: 'b', hours: 5.5 },
        { issueId: 'c', hours: 4 },
      ],
      issues,
      projects,
    );

    expect(result.map((p) => [p.name, p.totalHours])).toEqual([
      ['Melón', 7.5],
      ['Interno', 4],
    ]);
    expect(result[0].issues.map((i) => [i.code, i.hours])).toEqual([
      ['MEL-11', 5.5],
      ['MEL-10', 2],
    ]);
    expect(result[1].issues[0].code).toBe('#3');
  });

  it('sorts projects from most to fewest hours', () => {
    const issues = new Map([
      ['a', issue('a', 'p1', 1)],
      ['c', issue('c', 'p2', 1)],
    ]);

    const result = groupByProject(
      [
        { issueId: 'a', hours: 1 },
        { issueId: 'c', hours: 6 },
      ],
      issues,
      projects,
    );

    expect(result.map((p) => p.id)).toEqual(['p2', 'p1']);
  });

  it('does not accumulate floating point noise in the project total', () => {
    const issues = new Map([
      ['a', issue('a', 'p1', 1)],
      ['b', issue('b', 'p1', 2)],
    ]);

    const [project] = groupByProject(
      [
        { issueId: 'a', hours: 0.1 },
        { issueId: 'b', hours: 0.2 },
      ],
      issues,
      projects,
    );

    expect(project.totalHours).toBe(0.3);
  });

  it('keeps the hours of issues that cannot be resolved under «Sin proyecto»', () => {
    const [group] = groupByProject([{ issueId: 'ghost', hours: 3 }], new Map(), projects);

    expect(group).toMatchObject({ id: null, name: 'Sin proyecto', totalHours: 3 });
    expect(group.issues[0]).toMatchObject({ name: 'Tarea no disponible', code: '—' });
  });

  it('returns nothing when there are no hours', () => {
    expect(groupByProject([], new Map(), projects)).toEqual([]);
  });
});
