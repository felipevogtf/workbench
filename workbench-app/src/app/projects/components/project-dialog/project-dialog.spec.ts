import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Project, ProjectInput, RECIPE_TEMPLATE } from '../../models/project';
import { ProjectDialog } from './project-dialog';

const existing: Project = {
  id: 'r1',
  repo: 'acme/app',
  content: 'Levantar con `docker compose up`',
  dependsOn: ['acme/web'],
  name: 'app',
  mainBranch: 'main',
  runnerEnvironment: null,
  architectureRules: '',
  verifyCommand: null,
  createdAt: '2026-10-26T00:00:00Z',
  updatedAt: '2026-10-26T00:00:00Z',
};

@Component({
  imports: [ProjectDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-project-dialog
      [(open)]="open"
      [project]="project()"
      [options]="options()"
      [projectRepos]="['acme/app']"
      [save]="save"
    />
  `,
})
class Host {
  readonly open = signal(false);
  readonly project = signal<Project | null>(null);
  readonly options = signal([
    { repo: 'acme/app', labels: ['app'] },
    { repo: 'acme/web', labels: ['web'] },
    { repo: 'acme/db', labels: ['db'] },
  ]);
  save = vi.fn<(input: ProjectInput, existing: Project | null) => Promise<void>>(() =>
    Promise.resolve(),
  );
}

describe('ProjectDialog', () => {
  async function render(project: Project | null = null) {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.project.set(project);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const field = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
    const type = (id: string, value: string) => {
      const element = field<HTMLInputElement | HTMLTextAreaElement>(id);
      element.value = value;
      element.dispatchEvent(new Event('input'));
    };
    const submit = () => {
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      return fixture.whenStable();
    };
    return { fixture, host: fixture.componentInstance, root, field, type, submit };
  }

  it('starts a new project from the template, with the repository to fill in', async () => {
    const { field } = await render();

    expect(field<HTMLInputElement>('project-repo').value).toBe('');
    expect(field<HTMLInputElement>('project-repo').disabled).toBe(false);
    expect(field<HTMLTextAreaElement>('project-content').value).toBe(RECIPE_TEMPLATE);
  });

  it('saves a new project with the repository, the dependencies and the trimmed text', async () => {
    const { host, type, submit } = await render();

    type('project-repo', ' acme/api ');
    type('project-depends', 'acme/web, acme/db  acme/web');
    type('project-content', '  Probar con npm test  ');
    await submit();

    expect(host.save).toHaveBeenCalledWith(
      {
        repo: 'acme/api',
        dependsOn: ['acme/web', 'acme/db'],
        content: 'Probar con npm test',
        name: '',
        mainBranch: 'main',
        runnerEnvironment: '',
        architectureRules: '',
        verifyCommand: '',
      },
      null,
    );
    expect(host.open()).toBe(false);
  });

  it('does not save without a valid repository, nor with a dependency that is not one', async () => {
    const { host, type, submit, root } = await render();

    type('project-repo', 'sin-organizacion');
    await submit();
    expect(host.save).not.toHaveBeenCalled();
    expect(root.textContent).toContain('organización/repositorio');

    type('project-repo', 'acme/api');
    type('project-depends', 'web');
    await submit();
    expect(host.save).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Cada uno debe ser');
  });

  it('edits an existing project: the repository is locked and its values come filled in', async () => {
    const { host, field, type, submit } = await render(existing);

    expect(field<HTMLInputElement>('project-repo').value).toBe('acme/app');
    expect(field<HTMLInputElement>('project-repo').disabled).toBe(true);
    expect(field<HTMLInputElement>('project-depends').value).toBe('acme/web');
    expect(field<HTMLTextAreaElement>('project-content').value).toContain('docker compose up');

    type('project-content', 'Otro texto');
    await submit();

    expect(host.save).toHaveBeenCalledWith(
      {
        repo: 'acme/app',
        dependsOn: ['acme/web'],
        content: 'Otro texto',
        name: 'app',
        mainBranch: 'main',
        runnerEnvironment: '',
        architectureRules: '',
        verifyCommand: '',
      },
      existing,
    );
  });

  describe('the repositories that the labels point to', () => {
    const suggested = (root: HTMLElement, id: string) =>
      [...root.querySelectorAll<HTMLOptionElement>(`#${id}-list option`)].map(
        (option) => option.value,
      );

    it('suggests for a new project only the repositories that still have none', async () => {
      const { root } = await render();

      expect(suggested(root, 'project-repo')).toEqual(['acme/web', 'acme/db']);
    });

    it('suggests as dependencies any known repository, with project or without', async () => {
      const { root } = await render();

      expect(suggested(root, 'project-depends')).toEqual(['acme/app', 'acme/web', 'acme/db']);
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
      const { fixture, host, root, type } = await render();

      type('project-repo', 'acme');
      fixture.detectChanges();
      expect(root.querySelector('.note')).toBeNull();

      host.options.set([]);
      type('project-repo', 'acme/otro');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(root.querySelector('.note')).toBeNull();
    });
  });

  it('shows a preview of the Markdown and goes back to writing', async () => {
    const { fixture, root, field } = await render(existing);
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
    expect(field<HTMLTextAreaElement>('project-content').value).toContain('docker compose up');
  });
});
