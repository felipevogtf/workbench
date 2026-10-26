import { REPO_PATTERN, RECIPE_TEMPLATE, parseRepos } from './recipe';

describe('recipe model', () => {
  it('reads the repositories separated by comma, space or new line, without repeats', () => {
    expect(parseRepos('acme/web, acme/api  acme/web\nacme/db')).toEqual([
      'acme/web',
      'acme/api',
      'acme/db',
    ]);
    expect(parseRepos('   ')).toEqual([]);
    expect(parseRepos('')).toEqual([]);
  });

  it.each(['acme/web', 'garage-labs/miobra-ionicv6', 'a.b/c_d'])('accepts %s', (repo) => {
    expect(REPO_PATTERN.test(repo)).toBe(true);
  });

  it.each(['web', 'acme/', '/web', 'acme/web/extra', 'ac me/web', ''])('rejects "%s"', (repo) => {
    expect(REPO_PATTERN.test(repo)).toBe(false);
  });

  it('offers a template that covers how to start, fill the database, test and what not to touch', () => {
    for (const section of ['Levantar el proyecto', 'Base de datos', 'Probar', 'No tocar']) {
      expect(RECIPE_TEMPLATE).toContain(section);
    }
  });
});
