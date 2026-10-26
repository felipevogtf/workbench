import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Recipe, RecipeInput, RECIPE_TEMPLATE } from '../../models/recipe';
import { RecipeDialog } from './recipe-dialog';

const existing: Recipe = {
  id: 'r1',
  repo: 'acme/app',
  content: 'Levantar con `docker compose up`',
  dependsOn: ['acme/web'],
  createdAt: '2026-10-26T00:00:00Z',
  updatedAt: '2026-10-26T00:00:00Z',
};

@Component({
  imports: [RecipeDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-recipe-dialog
      [(open)]="open"
      [recipe]="recipe()"
      [repos]="['acme/web', 'acme/app']"
      [save]="save"
    />
  `,
})
class Host {
  readonly open = signal(false);
  readonly recipe = signal<Recipe | null>(null);
  save = vi.fn<(input: RecipeInput, existing: Recipe | null) => Promise<void>>(() =>
    Promise.resolve(),
  );
}

describe('RecipeDialog', () => {
  async function render(recipe: Recipe | null = null) {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.recipe.set(recipe);
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

  it('starts a new recipe from the template, with the repository to fill in', async () => {
    const { field } = await render();

    expect(field<HTMLInputElement>('recipe-repo').value).toBe('');
    expect(field<HTMLInputElement>('recipe-repo').disabled).toBe(false);
    expect(field<HTMLTextAreaElement>('recipe-content').value).toBe(RECIPE_TEMPLATE);
  });

  it('saves a new recipe with the repository, the dependencies and the trimmed text', async () => {
    const { host, type, submit } = await render();

    type('recipe-repo', ' acme/api ');
    type('recipe-depends', 'acme/web, acme/db  acme/web');
    type('recipe-content', '  Probar con npm test  ');
    await submit();

    expect(host.save).toHaveBeenCalledWith(
      { repo: 'acme/api', dependsOn: ['acme/web', 'acme/db'], content: 'Probar con npm test' },
      null,
    );
    expect(host.open()).toBe(false);
  });

  it('does not save without a valid repository, nor with a dependency that is not one', async () => {
    const { host, type, submit, root } = await render();

    type('recipe-repo', 'sin-organizacion');
    await submit();
    expect(host.save).not.toHaveBeenCalled();
    expect(root.textContent).toContain('organización/repositorio');

    type('recipe-repo', 'acme/api');
    type('recipe-depends', 'web');
    await submit();
    expect(host.save).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Cada uno debe ser');
  });

  it('edits an existing recipe: the repository is locked and its values come filled in', async () => {
    const { host, field, type, submit } = await render(existing);

    expect(field<HTMLInputElement>('recipe-repo').value).toBe('acme/app');
    expect(field<HTMLInputElement>('recipe-repo').disabled).toBe(true);
    expect(field<HTMLInputElement>('recipe-depends').value).toBe('acme/web');
    expect(field<HTMLTextAreaElement>('recipe-content').value).toContain('docker compose up');

    type('recipe-content', 'Otro texto');
    await submit();

    expect(host.save).toHaveBeenCalledWith(
      { repo: 'acme/app', dependsOn: ['acme/web'], content: 'Otro texto' },
      existing,
    );
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
    expect(root.querySelector('#recipe-content')).toBeNull();

    toggle().click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(field<HTMLTextAreaElement>('recipe-content').value).toContain('docker compose up');
  });
});
