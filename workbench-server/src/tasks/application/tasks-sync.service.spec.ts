import { IssuesService } from './issues.service';
import { ProjectsService } from './projects.service';
import { TasksSyncService } from './tasks-sync.service';
import { Project } from '@tasks/domain/entities/project.entity';

const planeProject = (name: string) =>
  Project.createFromExternal({
    name,
    externalId: `ext-${name}`,
    source: 'plane',
  });

describe('TasksSyncService', () => {
  const build = (syncByProject: jest.Mock) => {
    const local = Project.createLocal({ name: 'Local' });
    const projects = {
      syncProjects: jest.fn().mockResolvedValue({ created: 1, updated: 0 }),
      getAllProjects: jest
        .fn()
        .mockResolvedValue([planeProject('A'), local, planeProject('B')]),
    };
    const service = new TasksSyncService(
      projects as unknown as ProjectsService,
      { syncByProject } as unknown as IssuesService,
    );
    return { service, projects };
  };

  it('syncs the issues of every Plane project and skips local ones', async () => {
    const syncByProject = jest
      .fn()
      .mockResolvedValue({ created: 2, updated: 1 });
    const { service } = build(syncByProject);

    const result = await service.syncAll();

    expect(syncByProject).toHaveBeenCalledTimes(2);
    expect(result.issues).toEqual({ created: 4, updated: 2 });
    expect(result.failedProjects).toEqual([]);
  });

  it('keeps going when one project fails and reports it', async () => {
    const syncByProject = jest
      .fn()
      .mockRejectedValueOnce(new Error('Plane down'))
      .mockResolvedValueOnce({ created: 1, updated: 0 });
    const { service } = build(syncByProject);

    const result = await service.syncAll();

    expect(result.issues).toEqual({ created: 1, updated: 0 });
    expect(result.failedProjects).toHaveLength(1);
    expect(result.failedProjects[0].message).toBe('Plane down');
  });

  it('shares the run in progress instead of starting another', async () => {
    const syncByProject = jest
      .fn()
      .mockResolvedValue({ created: 0, updated: 0 });
    const { service, projects } = build(syncByProject);

    await Promise.all([service.syncAll(), service.syncAll()]);

    expect(projects.syncProjects).toHaveBeenCalledTimes(1);
  });
});
