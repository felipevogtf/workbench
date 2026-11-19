import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Toast } from '@shared/ui/toast/toast';
import { Project, ProjectInput } from '../models/project';
import { ProjectsApi } from './projects.api';
import { ProjectsStore } from './projects.store';

const project = (repo: string, extra: Partial<Project> = {}): Project => ({
  id: `id-${repo}`,
  repo,
  content: 'texto',
  dependsOn: [],
  name: repo.split('/')[1],
  mainBranch: 'main',
  runnerEnvironment: null,
  architectureRules: '',
  verifyCommand: null,
  createdAt: '2026-10-26T00:00:00Z',
  updatedAt: '2026-10-26T00:00:00Z',
  ...extra,
});

/** Lo que manda el diálogo al guardar. */
const input = (repo: string): ProjectInput => ({
  repo,
  content: 'texto',
  dependsOn: [],
  name: '',
  mainBranch: 'main',
  runnerEnvironment: '',
  architectureRules: '',
  verifyCommand: '',
});

const changesOf = (value: ProjectInput): Omit<ProjectInput, "repo"> => {
  const { repo, ...changes } = value;
  void repo;
  return changes;
};

describe('ProjectsStore', () => {
  let api: Record<
    'list' | 'repositories' | 'create' | 'update' | 'remove',
    ReturnType<typeof vi.fn>
  >;
  let store: ProjectsStore;
  let toast: Toast;

  beforeEach(() => {
    api = {
      list: vi.fn(() => of([project('acme/web'), project('acme/app')])),
      repositories: vi.fn(() =>
        of([
          { repo: 'acme/app', labels: ['app'] },
          { repo: 'acme/web', labels: ['flota', 'web'] },
          { repo: 'acme/db', labels: ['db'] },
        ]),
      ),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [ProjectsStore, { provide: ProjectsApi, useValue: api }],
    });
    store = TestBed.inject(ProjectsStore);
    toast = TestBed.inject(Toast);
  });

  it('loads the projects and knows which repositories have one', async () => {
    await store.load();

    expect(store.projects().map((item) => item.repo)).toEqual(['acme/web', 'acme/app']);
    expect(store.repos()).toEqual(['acme/web', 'acme/app']);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('loads the repositories that the labels point to, and says which labels use each one', async () => {
    await store.load();

    expect(store.options().map((option) => option.repo)).toEqual([
      'acme/app',
      'acme/web',
      'acme/db',
    ]);
    expect(store.labelsOf('acme/web')).toEqual(['flota', 'web']);
    expect(store.labelsOf('Acme/Web')).toEqual(['flota', 'web']);
    expect(store.labelsOf('acme/otro')).toEqual([]);
  });

  it('still loads the projects when the repositories of the labels cannot be read', async () => {
    api.repositories.mockReturnValue(throwError(() => new Error('falló')));

    await store.load();

    expect(store.projects()).toHaveLength(2);
    expect(store.options()).toEqual([]);
    expect(store.error()).toBeNull();
  });

  it('keeps the error when it cannot load', async () => {
    api.list.mockReturnValue(throwError(() => new Error('sin conexión')));

    await store.load();

    expect(store.error()).toBeTruthy();
    expect(store.loaded()).toBe(false);
  });

  it('adds a new project in its place by repository', async () => {
    await store.load();
    api.create.mockReturnValue(of(project('acme/api')));

    await store.save({ ...input('acme/api'), content: 'x' }, null);

    expect(api.create).toHaveBeenCalledWith({ ...input('acme/api'), content: 'x' });
    expect(store.repos()).toEqual(['acme/api', 'acme/web', 'acme/app'].sort());
  });

  it('updates an existing project without touching the repository', async () => {
    await store.load();
    const existing = store.projects()[0];
    api.update.mockReturnValue(of({ ...existing, content: 'nuevo', dependsOn: ['acme/db'] }));

    await store.save(
      { ...input(existing.repo), content: 'nuevo', dependsOn: ['acme/db'], mainBranch: 'develop' },
      existing,
    );

    expect(api.update).toHaveBeenCalledWith(existing.id, {
      ...changesOf(input(existing.repo)),
      content: 'nuevo',
      dependsOn: ['acme/db'],
      mainBranch: 'develop',
    });
    expect(store.projects().find((item) => item.id === existing.id)?.content).toBe('nuevo');
    expect(store.projects()).toHaveLength(2);
  });

  it('lets the error of a failed save reach the dialog, so it stays open', async () => {
    api.create.mockReturnValue(throwError(() => new Error('There is already a project')));

    await expect(
      store.save(input('acme/web'), null),
    ).rejects.toThrow('already');
  });

  it('removes a project, and tells the user when it cannot', async () => {
    await store.load();
    const first = store.projects()[0];

    expect(await store.remove(first)).toBe(true);
    expect(store.projects()).toHaveLength(1);

    api.remove.mockReturnValue(throwError(() => new Error('falló')));
    const error = vi.spyOn(toast, 'error');
    expect(await store.remove(store.projects()[0])).toBe(false);
    expect(error).toHaveBeenCalled();
    expect(store.projects()).toHaveLength(1);
  });
});
