import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Toast } from '@shared/ui/toast/toast';
import { ProjectsApi } from '../../data-access/projects.api';
import { Project, RECIPE_TEMPLATE } from '../../models/project';
import { ProjectFormPage } from './project-form-page';

const existing: Project = {
  id: 'r1',
  repo: 'acme/app',
  content: 'Levantar con `docker compose up`',
  dependsOn: ['acme/web'],
  name: 'app',
  repoUrl: null,
  mainBranch: 'main',
  runnerEnvironment: null,
  architectureRules: '',
  verifyCommand: null,
  createdAt: '2026-10-26T00:00:00Z',
  updatedAt: '2026-10-26T00:00:00Z',
};

const other = (repo: string): Project => ({
  ...existing,
  id: `id-${repo}`,
  repo,
  name: repo.split('/')[1],
});

describe('ProjectFormPage', () => {
  let api: Record<
    'list' | 'repositories' | 'create' | 'update' | 'remove',
    ReturnType<typeof vi.fn>
  >;
  let navigate: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      list: vi.fn(() => of([existing, other('acme/web')])),
      repositories: vi.fn(() =>
        of([
          { repo: 'acme/app', labels: ['app'] },
          { repo: 'acme/web', labels: ['web'] },
          { repo: 'acme/db', labels: ['db'] },
        ]),
      ),
      create: vi.fn((input: Partial<Project>) => of({ ...existing, ...input, id: 'new' })),
      update: vi.fn((id: string, changes: Partial<Project>) => of({ ...existing, ...changes, id })),
      remove: vi.fn(() => of(undefined)),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ProjectsApi, useValue: api },
        { provide: Toast, useValue: toast },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true) as never;
  });

  async function render(id?: string) {
    const fixture = TestBed.createComponent(ProjectFormPage);
    if (id) fixture.componentRef.setInput('id', id);
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const field = <T extends HTMLElement>(fieldId: string) => root.querySelector<T>(`#${fieldId}`)!;
    const type = (fieldId: string, value: string) => {
      const element = field<HTMLInputElement | HTMLTextAreaElement>(fieldId);
      element.value = value;
      element.dispatchEvent(new Event('input'));
    };
    const submit = async () => {
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
    };
    return { fixture, root, field, type, submit };
  }

  describe('a new project', () => {
    it('starts with the recipe template, the default branch and an editable repository', async () => {
      const { field, root } = await render();

      expect(root.textContent).toContain('Nuevo proyecto');
      expect(field<HTMLInputElement>('project-repo').disabled).toBe(false);
      expect(field<HTMLTextAreaElement>('project-content').value).toBe(RECIPE_TEMPLATE);
      expect(field<HTMLInputElement>('project-branch').value).toBe('main');
    });

    it('creates it with the repository, the dependencies and the trimmed text, and goes back to the list', async () => {
      const { type, submit } = await render();

      type('project-repo', ' acme/api ');
      type('project-depends', 'acme/web, acme/db  acme/web');
      type('project-content', '  Probar con npm test  ');
      await submit();

      expect(api.create).toHaveBeenCalledWith({
        repo: 'acme/api',
        dependsOn: ['acme/web', 'acme/db'],
        content: 'Probar con npm test',
        name: '',
        repoUrl: '',
        mainBranch: 'main',
        runnerEnvironment: '',
        architectureRules: '',
        verifyCommand: '',
      });
      expect(toast.success).toHaveBeenCalledWith('Proyecto creado');
      expect(navigate).toHaveBeenCalledWith('/projects');
    });

    it('does not save without a valid repository, nor with a dependency that is not one', async () => {
      const { type, submit, root } = await render();

      type('project-repo', 'sin-organizacion');
      await submit();
      expect(api.create).not.toHaveBeenCalled();
      expect(root.textContent).toContain('organización/repositorio');

      type('project-repo', 'acme/api');
      type('project-depends', 'web');
      await submit();
      expect(api.create).not.toHaveBeenCalled();
      expect(root.textContent).toContain('Cada uno debe ser');
    });

    it('stays on the page and shows the error when the server refuses', async () => {
      api.create.mockReturnValue(throwError(() => new Error('There is already a project')));
      const { type, submit, root } = await render();

      type('project-repo', 'acme/web');
      await submit();

      expect(root.textContent).toContain('There is already a project');
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('editing', () => {
    it('comes filled in with the project and its repository locked', async () => {
      const { field, root } = await render('r1');

      expect(root.textContent).toContain('acme/app');
      expect(field<HTMLInputElement>('project-repo').value).toBe('acme/app');
      expect(field<HTMLInputElement>('project-repo').disabled).toBe(true);
      expect(field<HTMLInputElement>('project-depends').value).toBe('acme/web');
      expect(field<HTMLTextAreaElement>('project-content').value).toContain('docker compose up');
    });

    it('saves only through update, with the same repository, and goes back to the list', async () => {
      const { type, submit } = await render('r1');

      type('project-content', 'Otro texto');
      await submit();

      expect(api.create).not.toHaveBeenCalled();
      expect(api.update).toHaveBeenCalledWith('r1', {
        dependsOn: ['acme/web'],
        content: 'Otro texto',
        name: 'app',
        repoUrl: '',
        mainBranch: 'main',
        runnerEnvironment: '',
        architectureRules: '',
        verifyCommand: '',
      });
      expect(toast.success).toHaveBeenCalledWith('Proyecto guardado');
      expect(navigate).toHaveBeenCalledWith('/projects');
    });

    it('says so when the project does not exist, without showing the form', async () => {
      const { root } = await render('no-existe');

      expect(root.textContent).toContain('Este proyecto no existe');
      expect(root.querySelector('form')).toBeNull();
    });
  });

  describe('the repositories that the labels point to', () => {
    const suggested = (root: HTMLElement, id: string) =>
      [...root.querySelectorAll<HTMLOptionElement>(`#${id}-list option`)].map(
        (option) => option.value,
      );

    it('suggests for a new project only the repositories that still have none', async () => {
      const { root } = await render();

      expect(suggested(root, 'project-repo')).toEqual(['acme/db']);
    });

    it('suggests as dependencies any known repository, with project or without', async () => {
      const { root } = await render();

      expect(suggested(root, 'project-depends').sort()).toEqual(
        ['acme/app', 'acme/db', 'acme/web'].sort(),
      );
    });

    it('warns when the repository written is not pointed to by any label', async () => {
      const { fixture, root, type } = await render();
      const warning = () => root.querySelector('.note')?.textContent ?? '';

      type('project-repo', 'acme/web');
      fixture.detectChanges();
      expect(warning()).toBe('');

      type('project-repo', 'Acme/Otro');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(warning()).toContain('Ninguna etiqueta apunta a este repositorio');

      type('project-repo', ' ACME/WEB ');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(warning()).toBe('');
    });

    it('does not warn while it is not a repository yet, nor when there are no labels with one', async () => {
      api.repositories.mockReturnValue(of([]));
      const { fixture, root, type } = await render();

      type('project-repo', 'acme/otro');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(root.querySelector('.note')).toBeNull();
    });
  });

  it('shows a preview of the Markdown and goes back to writing', async () => {
    const { fixture, root } = await render('r1');
    const toggle = () =>
      [...root.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
        /Vista previa|Seguir escribiendo/.test(button.textContent ?? ''),
      )!;

    toggle().click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root.querySelector('.preview code')?.textContent).toBe('docker compose up');
    expect(root.querySelector('#project-content')).toBeNull();

    toggle().click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect((root.querySelector('#project-content') as HTMLTextAreaElement).value).toContain(
      'docker compose up',
    );
  });

  describe('the link of the repository', () => {
    it('saves a link to the same repository and trims it', async () => {
      const { type, submit } = await render();

      type('project-repo', 'acme/api');
      type('project-url', ' https://github.com/acme/api ');
      await submit();

      expect(api.create).toHaveBeenCalledWith(
        expect.objectContaining({ repo: 'acme/api', repoUrl: 'https://github.com/acme/api' }),
      );
    });

    it('does not save a link to another repository or another host', async () => {
      const { type, submit, root } = await render();

      type('project-repo', 'acme/api');
      type('project-url', 'https://github.com/acme/other');
      await submit();
      expect(api.create).not.toHaveBeenCalled();
      expect(root.textContent).toContain('enlace de GitHub o Bitbucket');

      type('project-url', 'https://evil.com/acme/api');
      await submit();
      expect(api.create).not.toHaveBeenCalled();
    });
  });
});
