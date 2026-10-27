import { OrganizerSession } from '@organizer/domain/entities/organizer-session.entity';
import {
  GroupInfo,
  GroupsGatewayPort,
} from '@organizer/domain/ports/groups-gateway.port';
import { OrganizerSessionRepositoryPort } from '@organizer/domain/ports/organizer-session-repository.port';
import { OrganizerService } from './organizer.service';

describe('OrganizerService', () => {
  let stored: OrganizerSession[];
  let groups: Map<string, GroupInfo & { title: string }>;
  let service: OrganizerService;

  beforeEach(() => {
    stored = [];
    groups = new Map();
    const sessions: OrganizerSessionRepositoryPort = {
      findAll: () => Promise.resolve([...stored].reverse()),
      findById: (id) =>
        Promise.resolve(stored.find((each) => each.id === id) ?? null),
      save: (session) => {
        if (!stored.includes(session)) stored.push(session);
        return Promise.resolve(session);
      },
    };
    const gateway: GroupsGatewayPort = {
      createGroup: (data) => {
        const id = `group-${groups.size + 1}`;
        groups.set(id, {
          title: data.title,
          notes: data.notes ?? null,
          members: [],
        });
        return Promise.resolve(id);
      },
      getGroup: (id) => Promise.resolve(groups.get(id) as GroupInfo),
      setMembers: (id, ids) => {
        const group = groups.get(id) as GroupInfo;
        group.members = ids.map((memberId) => ({
          id: memberId,
          key: `MEL-${memberId}`,
          name: `Tarea ${memberId}`,
        }));
        return Promise.resolve();
      },
      update: (id, data) => {
        const group = groups.get(id) as GroupInfo & { title: string };
        if (data.title !== undefined) group.title = data.title;
        if (data.notes !== undefined) group.notes = data.notes;
        return Promise.resolve();
      },
      delete: (id) => {
        groups.delete(id);
        stored = stored.filter((each) => each.groupIssueId !== id);
        return Promise.resolve();
      },
    };
    service = new OrganizerService(sessions, gateway);
  });

  it('creates a session with its group task, empty at first', async () => {
    const { session, group } = await service.create({
      title: '  Anulación de guías  ',
      projectId: 'p1',
    });

    expect(session.title).toBe('Anulación de guías');
    expect(session.groupIssueId).toBe('group-1');
    expect(group.members).toEqual([]);
  });

  it('does not leave a group task behind when the title is empty', async () => {
    await expect(
      service.create({ title: '   ', projectId: 'p1' }),
    ).rejects.toThrow('title');
    expect(groups.size).toBe(0);
  });

  it('keeps the tasks in the order they were set and counts them in the list', async () => {
    const { session } = await service.create({ title: 'A', projectId: 'p1' });

    const detail = await service.setMembers(session.id, ['3', '1', '2']);

    expect(detail.group.members.map((member) => member.id)).toEqual([
      '3',
      '1',
      '2',
    ]);
    expect((await service.list())[0].memberCount).toBe(3);
  });

  it('renames the session and its group task, and changes the notes', async () => {
    const { session } = await service.create({ title: 'A', projectId: 'p1' });

    const detail = await service.update(session.id, {
      title: 'B',
      notes: 'El 2 depende del 1',
    });

    expect(detail.session.title).toBe('B');
    expect(groups.get(session.groupIssueId)?.title).toBe('B');
    expect(detail.group.notes).toBe('El 2 depende del 1');
  });

  it('removes the session with its group task', async () => {
    const { session } = await service.create({ title: 'A', projectId: 'p1' });

    await service.remove(session.id);

    expect(await service.list()).toEqual([]);
    await expect(service.get(session.id)).rejects.toMatchObject({
      kind: 'not-found',
    });
  });
});
