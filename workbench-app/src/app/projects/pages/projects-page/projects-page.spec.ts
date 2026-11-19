import { TestBed } from '@angular/core/testing';
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
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
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

  it('invites to write the first project', async () => {
    const element = (await render()).nativeElement as HTMLElement;

    expect(element.textContent).toContain('Todavía no hay proyectos');
  });

  it('lists the projects with a readable excerpt and what each one depends on', async () => {
    api.list.mockReturnValue(
      of([project('acme/app', { dependsOn: ['acme/web'] }), project('acme/web', { content: '' })]),
    );
    const element = (await render()).nativeElement as HTMLElement;

    const rows = Array.from(element.querySelectorAll('.projects li'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('acme/app');
    expect(rows[0].textContent).toContain('Probar npm test con docker-compose');
    expect(rows[0].textContent).toContain('Depende de');
    expect(rows[0].textContent).toContain('acme/web');
    expect(rows[1].textContent).toContain('Receta vacía');
  });

  it('shows which labels each project is linked to, and warns about one that no label points to', async () => {
    api.list.mockReturnValue(of([project('acme/app'), project('acme/huérfano')]));
    api.repositories.mockReturnValue(of([{ repo: 'acme/app', labels: ['app', 'flota'] }]));
    const element = (await render()).nativeElement as HTMLElement;

    const rows = Array.from(element.querySelectorAll('.projects li'));
    expect(rows[0].textContent).toContain('app');
    expect(rows[0].textContent).toContain('flota');
    expect(rows[0].textContent).not.toContain('Sin etiqueta');
    expect(rows[1].textContent).toContain('Sin etiqueta');
  });

  it('does not warn about the labels when none points to a repository, or they could not be read', async () => {
    api.list.mockReturnValue(of([project('acme/app')]));
    const element = (await render()).nativeElement as HTMLElement;

    expect(element.textContent).not.toContain('Sin etiqueta');
  });

  it('opens the editor with the project when the user edits it', async () => {
    api.list.mockReturnValue(of([project('acme/app')]));
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;

    element
      .querySelector<HTMLButtonElement>('[aria-label="Editar el proyecto acme/app"]')!
      .click();
    await fixture.whenStable();

    expect(element.textContent).toContain('Proyecto acme/app');
    expect(element.querySelector<HTMLInputElement>('#project-repo')!.disabled).toBe(true);
  });

  it('opens an empty editor for a new project', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;

    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Nuevo proyecto'))!
      .click();
    await fixture.whenStable();

    expect(element.textContent).toContain('Nuevo proyecto');
    expect(element.querySelector<HTMLInputElement>('#project-repo')!.disabled).toBe(false);
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
    expect(element.querySelector('.projects')).toBeNull();
  });
});
