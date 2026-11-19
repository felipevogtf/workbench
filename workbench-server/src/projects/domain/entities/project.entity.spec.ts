import { DomainError } from '@core/domain/domain.error';
import { MAX_RECIPE_CONTENT, Project } from './project.entity';

describe('Project', () => {
  it('trims the text, deduplicates the dependencies and starts with the same created and updated date', () => {
    const recipe = Project.create({
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
    const recipe = Project.create({
      repo: 'Garage-Labs/MiFlota-Web',
      content: 'x',
      dependsOn: ['Garage-Labs/MiCamion', 'garage-labs/micamion'],
    });

    expect(recipe.repo).toBe('garage-labs/miflota-web');
    expect(recipe.dependsOn).toEqual(['garage-labs/micamion']);
  });

  it('does not let a recipe depend on itself written with other capitals', () => {
    expect(() =>
      Project.create({
        repo: 'acme/app',
        content: 'x',
        dependsOn: ['ACME/App'],
      }),
    ).toThrow(/own repository/);
  });

  it('accepts an empty recipe, to write it later', () => {
    expect(Project.create({ repo: 'acme/app', content: '' }).content).toBe('');
  });

  it.each(['app', 'acme/', '/app', 'acme/app/extra', 'ac me/app', ''])(
    'rejects the repository "%s"',
    (repo) => {
      expect(() => Project.create({ repo, content: 'x' })).toThrow(DomainError);
    },
  );

  it('rejects a dependency that is not a repository, one on itself, and too many', () => {
    expect(() =>
      Project.create({ repo: 'acme/app', content: 'x', dependsOn: ['web'] }),
    ).toThrow(/organization\/repository/);
    expect(() =>
      Project.create({
        repo: 'acme/app',
        content: 'x',
        dependsOn: ['acme/app'],
      }),
    ).toThrow(/own repository/);
    expect(() =>
      Project.create({
        repo: 'acme/app',
        content: 'x',
        dependsOn: Array.from({ length: 11 }, (_, i) => `acme/r${i}`),
      }),
    ).toThrow(/at most 10/);
  });

  it('rejects a recipe that is too long', () => {
    expect(() =>
      Project.create({
        repo: 'acme/app',
        content: 'x'.repeat(MAX_RECIPE_CONTENT + 1),
      }),
    ).toThrow(/cannot exceed/);
  });

  it('updates the text and the dependencies but never the repository', () => {
    const recipe = Project.create({ repo: 'acme/app', content: 'uno' });
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
    const recipe = Project.create({
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

describe('Project: name, branch, environment, rules and verification', () => {
  it('starts with the repository name, the main branch and no environment, rules or command', () => {
    const project = Project.create({ repo: 'Acme/App', content: '' });

    expect(project.name).toBe('app');
    expect(project.mainBranch).toBe('main');
    expect(project.runnerEnvironment).toBeNull();
    expect(project.architectureRules).toBe('');
    expect(project.verifyCommand).toBeNull();
  });

  it('keeps what it is given, trimmed, and clears the optional ones with an empty text', () => {
    const project = Project.create({
      repo: 'acme/app',
      content: '',
      name: '  Mi app  ',
      mainBranch: ' develop ',
      runnerEnvironment: 'acme/app-env',
      architectureRules: '  Los controllers no tocan repositorios  ',
      verifyCommand: ' npm run lint:arch ',
    });

    expect(project.name).toBe('Mi app');
    expect(project.mainBranch).toBe('develop');
    expect(project.runnerEnvironment).toBe('acme/app-env');
    expect(project.architectureRules).toBe(
      'Los controllers no tocan repositorios',
    );
    expect(project.verifyCommand).toBe('npm run lint:arch');

    project.update({ runnerEnvironment: '', verifyCommand: '', name: '' });
    expect(project.runnerEnvironment).toBeNull();
    expect(project.verifyCommand).toBeNull();
    expect(project.name).toBe('app');
  });

  it('only changes what comes in the update', () => {
    const project = Project.create({
      repo: 'acme/app',
      content: 'uno',
      mainBranch: 'develop',
      verifyCommand: 'make check',
    });

    project.update({ content: 'dos' });

    expect(project.mainBranch).toBe('develop');
    expect(project.verifyCommand).toBe('make check');
  });

  it.each(['-D', '--force', 'a..b', 'with space', ''])(
    'rejects "%s" as a main branch (it could end up as a git option)',
    (branch) => {
      expect(() =>
        Project.create({ repo: 'acme/app', content: '', mainBranch: branch }),
      ).toThrow(DomainError);
    },
  );

  it('rejects a verify command with several lines or too long', () => {
    expect(() =>
      Project.create({
        repo: 'acme/app',
        content: '',
        verifyCommand: 'one\ntwo',
      }),
    ).toThrow(DomainError);
    expect(() =>
      Project.create({
        repo: 'acme/app',
        content: '',
        verifyCommand: 'x'.repeat(501),
      }),
    ).toThrow(DomainError);
  });

  it('rejects architecture rules that are too long', () => {
    expect(() =>
      Project.create({
        repo: 'acme/app',
        content: '',
        architectureRules: 'x'.repeat(10_001),
      }),
    ).toThrow(DomainError);
  });
});
