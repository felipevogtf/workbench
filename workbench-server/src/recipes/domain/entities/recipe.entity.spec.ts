import { DomainError } from '@core/domain/domain.error';
import { MAX_RECIPE_CONTENT, Recipe } from './recipe.entity';

describe('Recipe', () => {
  it('trims the text, deduplicates the dependencies and starts with the same created and updated date', () => {
    const recipe = Recipe.create({
      repo: ' acme/app ',
      content: '  Levantar con docker compose up  ',
      dependsOn: ['acme/web', ' acme/web ', 'acme/api'],
    });

    expect(recipe.repo).toBe('acme/app');
    expect(recipe.content).toBe('Levantar con docker compose up');
    expect(recipe.dependsOn).toEqual(['acme/web', 'acme/api']);
    expect(recipe.createdAt).toEqual(recipe.updatedAt);
  });

  it('keeps the repository and the dependencies in lowercase, as GitHub and Bitbucket treat them', () => {
    const recipe = Recipe.create({
      repo: 'Garage-Labs/MiFlota-Web',
      content: 'x',
      dependsOn: ['Garage-Labs/MiCamion', 'garage-labs/micamion'],
    });

    expect(recipe.repo).toBe('garage-labs/miflota-web');
    expect(recipe.dependsOn).toEqual(['garage-labs/micamion']);
  });

  it('does not let a recipe depend on itself written with other capitals', () => {
    expect(() =>
      Recipe.create({
        repo: 'acme/app',
        content: 'x',
        dependsOn: ['ACME/App'],
      }),
    ).toThrow(/own repository/);
  });

  it('accepts an empty recipe, to write it later', () => {
    expect(Recipe.create({ repo: 'acme/app', content: '' }).content).toBe('');
  });

  it.each(['app', 'acme/', '/app', 'acme/app/extra', 'ac me/app', ''])(
    'rejects the repository "%s"',
    (repo) => {
      expect(() => Recipe.create({ repo, content: 'x' })).toThrow(DomainError);
    },
  );

  it('rejects a dependency that is not a repository, one on itself, and too many', () => {
    expect(() =>
      Recipe.create({ repo: 'acme/app', content: 'x', dependsOn: ['web'] }),
    ).toThrow(/organization\/repository/);
    expect(() =>
      Recipe.create({
        repo: 'acme/app',
        content: 'x',
        dependsOn: ['acme/app'],
      }),
    ).toThrow(/own repository/);
    expect(() =>
      Recipe.create({
        repo: 'acme/app',
        content: 'x',
        dependsOn: Array.from({ length: 11 }, (_, i) => `acme/r${i}`),
      }),
    ).toThrow(/at most 10/);
  });

  it('rejects a recipe that is too long', () => {
    expect(() =>
      Recipe.create({
        repo: 'acme/app',
        content: 'x'.repeat(MAX_RECIPE_CONTENT + 1),
      }),
    ).toThrow(/cannot exceed/);
  });

  it('updates the text and the dependencies but never the repository', () => {
    const recipe = Recipe.create({ repo: 'acme/app', content: 'uno' });
    const created = recipe.createdAt;

    recipe.update({ content: 'dos', dependsOn: ['acme/web'] });

    expect(recipe.repo).toBe('acme/app');
    expect(recipe.content).toBe('dos');
    expect(recipe.dependsOn).toEqual(['acme/web']);
    expect(recipe.createdAt).toBe(created);
    expect(recipe.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created.getTime(),
    );
  });

  it('keeps what was not changed, and revalidates what was', () => {
    const recipe = Recipe.create({
      repo: 'acme/app',
      content: 'uno',
      dependsOn: ['acme/web'],
    });

    recipe.update({ content: 'dos' });
    expect(recipe.dependsOn).toEqual(['acme/web']);

    expect(() => recipe.update({ dependsOn: ['acme/app'] })).toThrow(
      DomainError,
    );
    expect(recipe.dependsOn).toEqual(['acme/web']);
  });
});
