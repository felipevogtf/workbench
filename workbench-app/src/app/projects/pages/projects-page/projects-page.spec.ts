import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { ProjectsApi } from '../../data-access/projects.api';
import { Project } from '../../models/project';
import { ProjectsPage } from './projects-page';

const project = (repo: string, extra: Partial<Project> = {}): Project => ({
  id: `id-${repo}`,
  repo,
  content: '## Probar\n- `npm test` con docker-compose',
  dependsOn: [],
  name: repo.split('/')[1],
  repoUrl: `https://github.com/${repo}`,
  mainBranch: 'main',
  runnerEnvironment: null,
  architectureRules: '',
  verifyCommand: null,
  createdAt: '2026-10-26T00:00:00Z',
  updatedAt: new Date().toISOString(),
  ...extra,
});

describe('ProjectsPage', () => {
  let api: Record<
    'list' | 'repositories' | 'create' | 'update' | 'remove',
    ReturnType<typeof vi.fn>
  >;
  let ask: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ask = vi.fn(() => Promise.resolve(true));
    api = {
      list: vi.fn(() => of([])),
      repositories: vi.fn(() => of([])),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ProjectsApi, useValue: api },
        { provide: ConfirmDialog, useValue: { ask } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(ProjectsPage);
    await fixture.whenStable();
    return fixture;
  }

  const rowsOf = (element: HTMLElement) => Array.from(element.querySelectorAll('tbody tr'));

  it('invites to write the first project', async () => {
    const element = (await render()).nativeElement as HTMLElement;

    expect(element.textContent).toContain('Todavía no hay proyectos');
    expect(element.querySelector('table')).toBeNull();
  });

  it('lists the projects in a table with a readable excerpt, the branch and what each one depends on', async () => {
    api.list.mockReturnValue(
      of([project('acme/app', { dependsOn: ['acme/web'] }), project('acme/web', { content: '' })]),
    );
    const element = (await render()).nativeElement as HTMLElement;

    const rows = rowsOf(element);
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('acme/app');
    expect(rows[0].textContent).toContain('main');
    expect(rows[0].textContent).toContain('Probar npm test con docker-compose');
    expect(rows[0].textContent).toContain('acme/web');
    expect(rows[1].textContent).toContain('Receta vacía');
  });

  it('links each project to its own edit page, and new projects to /new', async () => {
    api.list.mockReturnValue(of([project('acme/app')]));
    const element = (await render()).nativeElement as HTMLElement;

    const edit = element.querySelector<HTMLAnchorElement>('[aria-label="Editar el proyecto acme/app"]');
    expect(edit?.getAttribute('href')).toBe('/id-acme/app/edit');
    expect(element.querySelector('a.title')?.getAttribute('href')).toBe('/id-acme/app/edit');
    const create = [...element.querySelectorAll<HTMLAnchorElement>('a')].find((link) =>
      link.textContent?.includes('Nuevo proyecto'),
    );
    expect(create?.getAttribute('href')).toBe('/new');
  });

  it('warns about a project without a link to clone, and shows which rules and verification it has', async () => {
    api.list.mockReturnValue(
      of([
        project('acme/app', { repoUrl: null }),
        project('acme/web', { architectureRules: 'capas', verifyCommand: 'arch' }),
      ]),
    );
    const element = (await render()).nativeElement as HTMLElement;

    const rows = rowsOf(element);
    expect(rows[0].textContent).toContain('Sin enlace');
    expect(rows[1].textContent).not.toContain('Sin enlace');
    expect(rows[1].textContent).toContain('Reglas');
    expect(rows[1].textContent).toContain('Verifica');
  });

  it('shows which labels each project is linked to, and warns about one that no label points to', async () => {
    api.list.mockReturnValue(of([project('acme/app'), project('acme/huérfano')]));
    api.repositories.mockReturnValue(of([{ repo: 'acme/app', labels: ['app', 'flota'] }]));
    const element = (await render()).nativeElement as HTMLElement;

    const rows = rowsOf(element);
    expect(rows[0].textContent).toContain('flota');
    expect(rows[0].textContent).not.toContain('Sin etiqueta');
    expect(rows[1].textContent).toContain('Sin etiqueta');
  });

  it('does not warn about the labels when none points to a repository, or they could not be read', async () => {
    api.list.mockReturnValue(of([project('acme/app')]));
    const element = (await render()).nativeElement as HTMLElement;

    expect(element.textContent).not.toContain('Sin etiqueta');
  });

  it('asks before deleting, and deletes only when confirmed', async () => {
    api.list.mockReturnValue(of([project('acme/app')]));
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const trash = () =>
      element.querySelector<HTMLButtonElement>('[aria-label="Borrar el proyecto acme/app"]')!;

    ask.mockResolvedValueOnce(false);
    trash().click();
    await fixture.whenStable();
    expect(api.remove).not.toHaveBeenCalled();

    trash().click();
    await fixture.whenStable();
    expect(api.remove).toHaveBeenCalledWith('id-acme/app');
    expect(element.querySelector('table')).toBeNull();
  });
});
