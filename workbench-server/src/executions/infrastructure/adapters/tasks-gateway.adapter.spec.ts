import { TasksFacade } from '@tasks/application/tasks-facade.service';
import { Issue } from '@tasks/domain/entities/issue.entity';
import { Label } from '@tasks/domain/entities/label.entity';
import { TaskProject } from '@tasks/domain/entities/task-project.entity';
import { ProjectsFacade } from '@projects/application/projects-facade.service';
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
    projectRepos: [],
    startDate: null,
    dueDate: null,
    estimatedHours: null,
    syncedAt: new Date(),
    closedAt: null,
    pausedAt: null,
    createdAt: new Date(),
    ...extra,
  });

const project = (identifier: string | null, defaults: string[] = []) =>
  TaskProject.reconstruct({
    id: 'p1',
    name: 'Melón',
    externalId: 'plane-p1',
    source: 'plane',
    identifier,
    syncEnabled: true,
    visible: true,
    defaultProjectRepos: defaults,
    syncedAt: null,
    createdAt: new Date(),
  });

const label = Label.reconstruct({
  id: 'l1',
  name: 'Web',
  color: '#000000',
  projectRepo: 'acme/web',
});

// Los proyectos que existen: las etiquetas apuntan a ellos y de ahí sale el enlace.
const KNOWN_LINKS = [
  { repo: 'acme/web', name: 'web', repoUrl: 'https://bitbucket.org/acme/web' },
  { repo: 'acme/api', name: 'api', repoUrl: 'https://bitbucket.org/acme/api' },
];

function adapter(
  found: Issue | null,
  of: TaskProject | null,
  extra: Partial<Record<'groupContext' | 'groupOf', unknown>> = {},
  links: { repo: string; name: string; repoUrl: string }[] = KNOWN_LINKS,
) {
  return new TasksGatewayAdapter(
    {
      findIssue: () => Promise.resolve(found),
      findLabels: () => Promise.resolve([label]),
      findProject: () => Promise.resolve(of),
      groupContext: () => Promise.resolve(null),
      groupOf: () => Promise.resolve(null),
      ...extra,
    } as unknown as TasksFacade,
    {
      linksFor: (repos: string[]) =>
        Promise.resolve(
          repos.flatMap((repo) => links.filter((link) => link.repo === repo)),
        ),
    } as unknown as ProjectsFacade,
  );
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

  it('composes a group from its tasks: their text, their repositories and their codes', async () => {
    const api = Label.reconstruct({
      id: 'l2',
      name: 'Api',
      color: null,
      projectRepo: 'acme/api',
    });
    const task = await adapter(
      issue({ isLocal: true, externalId: null, remoteSequence: null }),
      null,
      {
        groupContext: () =>
          Promise.resolve({
            description: 'Grupo de 2 tareas',
            members: [
              { id: 'a', key: 'MEL-430', name: 'Tono' },
              { id: 'b', key: 'MEL-431', name: 'Bloqueo' },
            ],
            labels: [api],
          }),
      },
    ).getTask('i1');

    expect(task).toMatchObject({
      description: 'Grupo de 2 tareas',
      key: 'MEL-430_MEL-431',
      members: [
        { key: 'MEL-430', name: 'Tono' },
        { key: 'MEL-431', name: 'Bloqueo' },
      ],
    });
    expect(task?.repoUrls).toEqual([
      'https://bitbucket.org/acme/api',
      'https://bitbucket.org/acme/web',
    ]);
  });

  it('says which group a task belongs to', async () => {
    const task = await adapter(issue(), project('MEL'), {
      groupOf: () => Promise.resolve('g1'),
    }).getTask('i1');

    expect(task?.groupId).toBe('g1');
  });

  it('takes the repositories from the projects of the task before its labels', async () => {
    const task = await adapter(
      issue({ projectRepos: ['acme/api'] }),
      project('MEL'),
      {},
      [
        {
          repo: 'acme/api',
          name: 'api',
          repoUrl: 'https://github.com/acme/api',
        },
      ],
    ).getTask('i1');

    expect(task?.repoUrls).toEqual(['https://github.com/acme/api']);
  });

  it('falls back to the labels when none of its projects has a link', async () => {
    const task = await adapter(
      issue({ projectRepos: ['acme/sinenlace'] }),
      project('MEL'),
    ).getTask('i1');

    expect(task?.repoUrls).toEqual(['https://bitbucket.org/acme/web']);
  });

  it('uses the default projects of its task project when it has none of its own', async () => {
    const task = await adapter(issue(), project('MEL', ['acme/api']), {}, [
      { repo: 'acme/api', name: 'api', repoUrl: 'https://github.com/acme/api' },
    ]).getTask('i1');

    expect(task?.repoUrls).toEqual(['https://github.com/acme/api']);
  });

  it('prefers its own projects over the defaults of its task project', async () => {
    const asked: string[][] = [];
    const gateway = new TasksGatewayAdapter(
      {
        findIssue: () => Promise.resolve(issue({ projectRepos: ['acme/web'] })),
        findLabels: () => Promise.resolve([]),
        findProject: () => Promise.resolve(project('MEL', ['acme/api'])),
        groupContext: () => Promise.resolve(null),
        groupOf: () => Promise.resolve(null),
      } as unknown as TasksFacade,
      {
        linksFor: (repos: string[]) => {
          asked.push(repos);
          return Promise.resolve([]);
        },
      } as unknown as ProjectsFacade,
    );

    await gateway.getTask('i1');

    expect(asked[0]).toEqual(['acme/web']);
  });

  it('is null when the task does not exist', async () => {
    expect(await adapter(null, null).getTask('nada')).toBeNull();
  });
});
