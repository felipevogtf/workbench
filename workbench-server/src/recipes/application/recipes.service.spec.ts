import { Recipe } from '@recipes/domain/entities/recipe.entity';
import { RecipeRepositoryPort } from '@recipes/domain/ports/recipe-repository.port';
import { RepositoryOption } from '@recipes/domain/ports/repository-options.port';
import { RecipesService } from './recipes.service';

class InMemoryRecipes implements RecipeRepositoryPort {
  items = new Map<string, Recipe>();
  findAll = () => Promise.resolve([...this.items.values()]);
  findById = (id: string) => Promise.resolve(this.items.get(id) ?? null);
  findByRepo = (repo: string) =>
    Promise.resolve(
      [...this.items.values()].find((recipe) => recipe.repo === repo) ?? null,
    );
  save = (recipe: Recipe) => {
    this.items.set(recipe.id, recipe);
    return Promise.resolve(recipe);
  };
  delete = (id: string) => {
    this.items.delete(id);
    return Promise.resolve();
  };
}

describe('RecipesService', () => {
  let repository: InMemoryRecipes;
  let options: RepositoryOption[];
  let service: RecipesService;

  beforeEach(() => {
    repository = new InMemoryRecipes();
    options = [];
    service = new RecipesService(repository, {
      list: () => Promise.resolve(options),
    });
  });

  it('offers the repositories that the labels point to', async () => {
    options = [{ repo: 'acme/web', labels: ['web'] }];

    expect(await service.repositories()).toEqual([
      { repo: 'acme/web', labels: ['web'] },
    ]);
  });

  it('keeps one recipe per repository however it is written', async () => {
    await service.create({ repo: 'Acme/Web', content: 'la web' });

    expect((await service.list())[0].repo).toBe('acme/web');
    await expect(
      service.create({ repo: ' ACME/web ', content: 'otra' }),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('finds the recipe of a repository written with other capitals', async () => {
    await service.create({ repo: 'acme/web', content: 'la web' });

    expect(await service.contextFor(['Acme/Web'])).toContain(
      '## Receta de acme/web',
    );
  });

  it('creates a recipe and lists them by repository', async () => {
    await service.create({ repo: 'acme/web', content: 'la web' });
    await service.create({ repo: 'acme/app', content: 'la app' });

    expect((await service.list()).map((recipe) => recipe.repo)).toEqual([
      'acme/app',
      'acme/web',
    ]);
  });

  it('does not create two recipes for the same repository', async () => {
    await service.create({ repo: 'acme/app', content: 'uno' });

    await expect(
      service.create({ repo: 'acme/app', content: 'dos' }),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('updates, reads and removes a recipe', async () => {
    const { id } = await service.create({ repo: 'acme/app', content: 'uno' });

    await service.update(id, { content: 'dos', dependsOn: ['acme/web'] });
    expect((await service.get(id)).content).toBe('dos');

    await service.remove(id);
    await expect(service.get(id)).rejects.toMatchObject({ kind: 'not-found' });
    await expect(service.remove(id)).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('builds the context of the repositories with their dependencies', async () => {
    await service.create({
      repo: 'acme/app',
      content: 'la app',
      dependsOn: ['acme/web'],
    });
    await service.create({ repo: 'acme/web', content: 'la web' });

    const context = await service.contextFor(['acme/app']);

    expect(context).toContain('## Receta de acme/app');
    expect(context).toContain('repositorio del que depende acme/app');
  });

  it('gives no context when there is no recipe or no repository', async () => {
    expect(await service.contextFor(['acme/app'])).toBeNull();
    expect(await service.contextFor([])).toBeNull();
  });
});
