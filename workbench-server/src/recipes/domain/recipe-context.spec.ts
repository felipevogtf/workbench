import { Recipe } from './entities/recipe.entity';
import { buildRecipeContext, MAX_RECIPE_CONTEXT_CHARS } from './recipe-context';

const recipe = (repo: string, content: string, dependsOn: string[] = []) =>
  Recipe.create({ repo, content, dependsOn });

describe('buildRecipeContext', () => {
  it('shows the recipe of the repository', () => {
    const context = buildRecipeContext(
      ['acme/app'],
      [recipe('acme/app', 'docker compose up')],
    );

    expect(context).toBe('## Receta de acme/app\ndocker compose up');
  });

  it('finds the recipe whatever the capitals of the repository of the task', () => {
    const context = buildRecipeContext(
      ['Acme/App'],
      [
        recipe('acme/app', 'la app', ['acme/web']),
        recipe('acme/web', 'la web'),
      ],
    );

    expect(context).toContain('## Receta de acme/app');
    expect(context).toContain('## Receta de acme/web');
  });

  it('is null when nothing has a recipe, and for no repositories', () => {
    expect(buildRecipeContext(['acme/app'], [])).toBeNull();
    expect(buildRecipeContext([], [recipe('acme/app', 'x')])).toBeNull();
    expect(
      buildRecipeContext(['acme/app'], [recipe('acme/otro', 'x')]),
    ).toBeNull();
  });

  it('puts the recipe of what it depends on below, marked as such', () => {
    const context = buildRecipeContext(
      ['acme/app'],
      [
        recipe('acme/app', 'la app', ['acme/web']),
        recipe('acme/web', 'la web'),
      ],
    );

    expect(context).toBe(
      [
        '## Receta de acme/app',
        'la app',
        '',
        '## Receta de acme/web (repositorio del que depende acme/app)',
        'la web',
      ].join('\n'),
    );
  });

  it('follows the dependencies two levels and no more', () => {
    const context = buildRecipeContext(
      ['acme/a'],
      [
        recipe('acme/a', 'A', ['acme/b']),
        recipe('acme/b', 'B', ['acme/c']),
        recipe('acme/c', 'C', ['acme/d']),
        recipe('acme/d', 'D'),
      ],
    );

    expect(context).toContain('Receta de acme/b');
    expect(context).toContain('Receta de acme/c');
    expect(context).not.toContain('Receta de acme/d');
  });

  it('shows each recipe once, even with a cycle or a shared dependency', () => {
    const context = buildRecipeContext(
      ['acme/a', 'acme/b'],
      [
        recipe('acme/a', 'A', ['acme/b', 'acme/c']),
        recipe('acme/b', 'B', ['acme/a', 'acme/c']),
        recipe('acme/c', 'C', ['acme/a']),
      ],
    );

    for (const name of ['acme/a', 'acme/b', 'acme/c']) {
      expect(
        context?.match(new RegExp(`## Receta de ${name}\\b`, 'g')),
      ).toHaveLength(1);
    }
  });

  it('only warns when a dependency has no recipe yet', () => {
    const context = buildRecipeContext(
      ['acme/app'],
      [recipe('acme/app', 'la app', ['acme/web'])],
    );

    expect(context).toContain('(acme/web no tiene una receta escrita todavía)');
    expect(context).not.toContain('## Receta de acme/web');
  });

  it('does not warn about a repository of the task that has no recipe', () => {
    const context = buildRecipeContext(
      ['acme/app', 'acme/sin-receta'],
      [recipe('acme/app', 'la app')],
    );

    expect(context).not.toContain('sin-receta');
  });

  it('cuts a very long recipe', () => {
    const context = buildRecipeContext(
      ['acme/app'],
      [recipe('acme/app', 'x'.repeat(MAX_RECIPE_CONTEXT_CHARS + 500))],
    );

    expect(context).toContain('[... recortado]');
    expect(context!.length).toBeLessThan(MAX_RECIPE_CONTEXT_CHARS + 100);
  });

  it('says so when a recipe was left empty', () => {
    expect(
      buildRecipeContext(['acme/app'], [recipe('acme/app', '')]),
    ).toContain('(la receta está vacía)');
  });
});
