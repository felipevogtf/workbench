import { TasksFacade } from '@tasks/application/tasks-facade.service';
import { Issue } from '@tasks/domain/entities/issue.entity';
import { Label } from '@tasks/domain/entities/label.entity';
import { Project } from '@tasks/domain/entities/project.entity';
import { TasksGatewayAdapter } from './tasks-gateway.adapter';

const issue = (extra: Partial<Parameters<typeof Issue.reconstruct>[0]> = {}) =>
  Issue.reconstruct({
    id: 'i1',
    name: 'Vista de órdenes',
    isLocal: false,
    externalId: 'plane-1',
    externalState: null,
    remoteSequence: 12,
    localSequence: 1,
    description: '<p>Mostrar las órdenes</p>',
    priority: null,
    stateId: null,
    projectId: 'p1',
    labelIds: ['l1'],
    startDate: null,
    dueDate: null,
    estimatedHours: null,
    syncedAt: new Date(),
    closedAt: null,
    createdAt: new Date(),
    ...extra,
  });

const project = (identifier: string | null) =>
  Project.reconstruct({
    id: 'p1',
    name: 'Melón',
    externalId: 'plane-p1',
    source: 'plane',
    identifier,
    syncEnabled: true,
    visible: true,
    syncedAt: null,
    createdAt: new Date(),
  });

const label = Label.reconstruct({
  id: 'l1',
  name: 'Web',
  color: '#000000',
  repoUrl: 'https://bitbucket.org/acme/web',
});

function adapter(found: Issue | null, of: Project | null) {
  return new TasksGatewayAdapter({
    findIssue: () => Promise.resolve(found),
    findLabels: () => Promise.resolve([label]),
    findProject: () => Promise.resolve(of),
  } as unknown as TasksFacade);
}

describe('TasksGatewayAdapter', () => {
  it('gives the code of the Plane ticket: the key of the project and the number of the task', async () => {
    const task = await adapter(issue(), project('MEL')).getTask('i1');

    expect(task).toMatchObject({
      id: 'i1',
      name: 'Vista de órdenes',
      description: 'Mostrar las órdenes',
      repoUrls: ['https://bitbucket.org/acme/web'],
      key: 'MEL-12',
    });
  });

  it('has no code for a local task', async () => {
    const task = await adapter(
      issue({ isLocal: true, externalId: null, remoteSequence: null }),
      null,
    ).getTask('i1');

    expect(task?.key).toBeNull();
  });

  it('has no code when the project has no key, or the task has no number from Plane', async () => {
    expect(
      (await adapter(issue(), project(null)).getTask('i1'))?.key,
    ).toBeNull();
    expect(
      (
        await adapter(issue({ remoteSequence: null }), project('MEL')).getTask(
          'i1',
        )
      )?.key,
    ).toBeNull();
  });

  it('is null when the task does not exist', async () => {
    expect(await adapter(null, null).getTask('nada')).toBeNull();
  });
});
