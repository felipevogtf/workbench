import { DomainError } from '@core/domain/domain.error';
import { Issue } from '@tasks/domain/entities/issue.entity';
import { IssueGroupRepositoryPort } from '@tasks/domain/ports/issue-group-repository.port';
import { IssueRepositoryPort } from '@tasks/domain/ports/issue-repository.port';
import { IssueGroupsService } from './issue-groups.service';
import type { IssuesService } from './issues.service';

const issue = (name: string, local = true) =>
  Issue.reconstruct({
    id: crypto.randomUUID(),
    name,
    isLocal: local,
    externalId: local ? null : crypto.randomUUID(),
    remoteSequence: local ? null : 1,
    localSequence: 1,
    externalState: null,
    description: null,
    priority: null,
    estimatedHours: null,
    closedAt: null,
    stateId: null,
    projectId: 'p1',
    labelIds: [],
    startDate: null,
    dueDate: null,
    syncedAt: new Date(),
    createdAt: new Date(),
  });

describe('IssueGroupsService', () => {
  let all: Issue[];
  let links: Map<string, string[]>; // grupo → miembros, en orden
  let service: IssueGroupsService;

  beforeEach(() => {
    all = [];
    links = new Map();
    const groups: IssueGroupRepositoryPort = {
      memberIds: (groupId) => Promise.resolve(links.get(groupId) ?? []),
      groupOf: (memberId) =>
        Promise.resolve(
          [...links].find(([, members]) => members.includes(memberId))?.[0] ??
            null,
        ),
      setMembers: (groupId, ids) => {
        links.set(groupId, ids);
        return Promise.resolve();
      },
    };
    const issues = {
      findById: (id: string) =>
        Promise.resolve(all.find((each) => each.id === id) ?? null),
      findByIds: (ids: string[]) =>
        Promise.resolve(all.filter((each) => ids.includes(each.id))),
    } as unknown as IssueRepositoryPort;
    const issuesService = {
      createIssue: (data: { name: string; description?: string | null }) => {
        const created = issue(data.name);
        all.push(created);
        return Promise.resolve(created);
      },
    } as unknown as IssuesService;
    service = new IssueGroupsService(groups, issues, issuesService);
  });

  const add = (name: string, local = false) => {
    const created = issue(name, local);
    all.push(created);
    return created;
  };

  it('keeps the members in the order they were given', async () => {
    const group = await service.createGroup({
      title: 'Grupo',
      projectId: 'p1',
    });
    const [a, b, c] = [add('A'), add('B'), add('C')];

    const members = await service.setMembers(group.id, [c.id, a.id, b.id]);

    expect(members.map((member) => member.name)).toEqual(['C', 'A', 'B']);
    expect((await service.members(group.id)).map((m) => m.name)).toEqual([
      'C',
      'A',
      'B',
    ]);
    expect(await service.groupOf(a.id)).toBe(group.id);
  });

  it('replaces the members instead of adding to them', async () => {
    const group = await service.createGroup({
      title: 'Grupo',
      projectId: 'p1',
    });
    const [a, b] = [add('A'), add('B')];
    await service.setMembers(group.id, [a.id, b.id]);

    await service.setMembers(group.id, [b.id]);

    expect(await service.groupOf(a.id)).toBeNull();
    expect(await service.groupOf(b.id)).toBe(group.id);
  });

  it('does not let a task be in two groups', async () => {
    const first = await service.createGroup({ title: 'Uno', projectId: 'p1' });
    const second = await service.createGroup({ title: 'Dos', projectId: 'p1' });
    const shared = add('Compartida');
    await service.setMembers(first.id, [shared.id]);

    await expect(
      service.setMembers(second.id, [shared.id]),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('does not let a group be a member of another, nor contain itself', async () => {
    const outer = await service.createGroup({ title: 'Uno', projectId: 'p1' });
    const inner = await service.createGroup({ title: 'Dos', projectId: 'p1' });
    await service.setMembers(inner.id, [add('A').id]);

    await expect(service.setMembers(outer.id, [inner.id])).rejects.toThrow(
      DomainError,
    );
    await expect(service.setMembers(outer.id, [outer.id])).rejects.toThrow(
      DomainError,
    );
  });

  it('rejects repeated or unknown tasks and too many of them', async () => {
    const group = await service.createGroup({
      title: 'Grupo',
      projectId: 'p1',
    });
    const a = add('A');

    await expect(service.setMembers(group.id, [a.id, a.id])).rejects.toThrow(
      DomainError,
    );
    await expect(service.setMembers(group.id, ['nope'])).rejects.toMatchObject({
      kind: 'not-found',
    });
    const many = Array.from({ length: 9 }, (_, index) => add(`T${index}`).id);
    await expect(service.setMembers(group.id, many)).rejects.toThrow(
      DomainError,
    );
  });

  it('only a local task can be a group', async () => {
    const synced = add('De Plane');

    await expect(service.setMembers(synced.id, [])).rejects.toThrow(
      /local task/,
    );
  });
});
