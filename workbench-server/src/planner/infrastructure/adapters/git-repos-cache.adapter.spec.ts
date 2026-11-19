import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { MirrorRemote, RepoMirrorService } from '@core/git/repo-mirror';
import { GitReposCacheAdapter } from './git-repos-cache.adapter';

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    'git',
    [
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );

const WEB = 'https://github.com/acme/web';
const API = 'https://github.com/acme/api';

describe('GitReposCacheAdapter (with real repositories)', () => {
  let root: string;
  let origins: Map<string, string>;
  let mirror: RepoMirrorService;
  let adapter: GitReposCacheAdapter;
  let tokens: Record<string, string | undefined>;

  const makeOrigin = (name: string, branch = 'main') => {
    const dir = join(root, 'origins', name);
    execFileSync('git', ['init', '--quiet', '-b', branch, dir]);
    writeFileSync(join(dir, 'README.md'), `${name} uno`);
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'base');
    origins.set(`github.com/acme/${name}`, dir);
    return dir;
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'repos-cache-'));
    origins = new Map();
    tokens = { GITHUB_TOKEN: 'token' };
    const config = {
      get: (key: string) =>
        ({
          MIRRORS_DIR: join(root, 'mirrors'),
          TASK_REPOS_DIR: join(root, 'tasks'),
          ...tokens,
        })[key],
    } as unknown as ConfigService;
    mirror = new RepoMirrorService(config);
    // El servidor habla con GitHub o Bitbucket: en las pruebas, cada repositorio sale de uno local.
    const realSync = mirror.sync.bind(mirror) as RepoMirrorService['sync'];
    jest
      .spyOn(mirror, 'sync')
      .mockImplementation(
        (remote: MirrorRemote, options?: { requireFresh?: boolean }) =>
          realSync(
            {
              ...remote,
              cloneUrl: `file://${origins.get(remote.key) ?? join(root, 'no-existe')}`,
            },
            options,
          ),
      );
    adapter = new GitReposCacheAdapter(config, mirror);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const mirrors = () => join(root, 'mirrors', 'github.com', 'acme');

  it('puts the repository of the task in its folder, readable, as a worktree of the shared mirror', async () => {
    makeOrigin('web');

    const { path, repos } = await adapter.ensure('issue-1', [WEB]);

    expect(repos).toEqual([{ url: WEB, name: 'web', used: true, note: null }]);
    expect(readFileSync(join(path, 'web', 'README.md'), 'utf8')).toBe(
      'web uno',
    );
    expect(await mirror.isWorktree(join(path, 'web'))).toBe(true);
    expect(readdirSync(mirrors())).toEqual(['web.git']);
  });

  it('does not clone again: the next time it only brings what is new', async () => {
    const origin = makeOrigin('web');
    const { path } = await adapter.ensure('issue-1', [WEB]);
    writeFileSync(join(origin, 'nuevo.txt'), 'dos');
    git(origin, 'add', '.');
    git(origin, 'commit', '-q', '-m', 'segundo');

    await adapter.ensure('issue-1', [WEB]);

    expect(existsSync(join(path, 'web', 'nuevo.txt'))).toBe(true);
    expect(readdirSync(mirrors())).toEqual(['web.git']);
  });

  it('shares one mirror between tasks, each with its own worktree', async () => {
    makeOrigin('web');

    const a = await adapter.ensure('issue-1', [WEB]);
    const b = await adapter.ensure('issue-2', [WEB]);

    expect(a.path).not.toBe(b.path);
    expect(existsSync(join(a.path, 'web', 'README.md'))).toBe(true);
    expect(existsSync(join(b.path, 'web', 'README.md'))).toBe(true);
    expect(readdirSync(mirrors())).toEqual(['web.git']);
  });

  it('falls back to master when there is no main', async () => {
    makeOrigin('web', 'master');

    const { repos } = await adapter.ensure('issue-1', [WEB]);

    expect(repos[0]).toMatchObject({ used: true });
  });

  it('removes a repository the task no longer has, so it is not within reach of the agent', async () => {
    makeOrigin('web');
    makeOrigin('api');
    const { path } = await adapter.ensure('issue-1', [WEB, API]);
    expect(existsSync(join(path, 'api'))).toBe(true);

    await adapter.ensure('issue-1', [WEB]);

    expect(existsSync(join(path, 'api'))).toBe(false);
    expect(existsSync(join(path, 'web'))).toBe(true);
  });

  it('replaces the full clone that an older version left in the folder', async () => {
    makeOrigin('web');
    const old = join(root, 'tasks', 'issue-1', 'web');
    mkdirSync(join(old, '.git'), { recursive: true });
    writeFileSync(join(old, 'viejo.txt'), 'x');

    await adapter.ensure('issue-1', [WEB]);

    expect(await mirror.isWorktree(old)).toBe(true);
    expect(existsSync(join(old, 'viejo.txt'))).toBe(false);
  });

  it('replaces the worktree that belongs to the mirror of another host when the link of the project moves', async () => {
    makeOrigin('web');
    // Antes el repositorio estaba en Bitbucket: su carpeta es un worktree de ese mirror.
    const old = join(root, 'tasks', 'issue-1', 'web');
    origins.set('bitbucket.org/acme/web', origins.get('github.com/acme/web')!);
    const viejo = await mirror.sync({
      key: 'bitbucket.org/acme/web',
      cloneUrl: 'x',
      cleanUrl: 'https://bitbucket.org/acme/web.git',
      secret: '',
    });
    await mirror.addWorktree(viejo.path, old, 'main');

    await adapter.ensure('issue-1', [WEB]);

    expect(
      await mirror.isWorktreeOf(old, mirror.pathOf('github.com/acme/web')),
    ).toBe(true);
  });

  it('opens the branch of a ticket the task mentions next to the repository', async () => {
    const origin = makeOrigin('web');
    git(origin, 'checkout', '-q', '-b', 'feature/MEL-466/mejora');
    writeFileSync(join(origin, 'contrato.txt'), 'jde_block');
    git(origin, 'add', '.');
    git(origin, 'commit', '-q', '-m', 'jde');
    git(origin, 'checkout', '-q', 'main');

    const { path, repos } = await adapter.ensure('issue-1', [WEB], {
      relatedKeys: ['MEL-466'],
    });

    expect(repos[0].branches).toEqual([
      {
        key: 'MEL-466',
        branch: 'feature/MEL-466/mejora',
        folder: 'web@MEL-466',
      },
    ]);
    expect(
      readFileSync(join(path, 'web@MEL-466', 'contrato.txt'), 'utf8'),
    ).toBe('jde_block');
  });

  it('keeps working with the previous copy when the remote cannot be reached, and says so', async () => {
    makeOrigin('web');
    await adapter.ensure('issue-1', [WEB]);
    rmSync(origins.get('github.com/acme/web')!, {
      recursive: true,
      force: true,
    });

    const { repos, path } = await adapter.ensure('issue-1', [WEB]);

    expect(repos[0]).toMatchObject({
      used: true,
      note: 'no se pudo actualizar: se usa la copia anterior',
    });
    expect(existsSync(join(path, 'web', 'README.md'))).toBe(true);
  });

  it('reports a repository that cannot be cloned, a link that is not valid and a provider without a token', async () => {
    const { repos } = await adapter.ensure('issue-1', [
      API,
      'https://evil.com/x/y',
    ]);
    expect(repos[0]).toMatchObject({ name: 'api', used: false });
    expect(repos[1]).toMatchObject({
      used: false,
      note: 'enlace de repositorio no válido',
    });

    tokens = {};
    makeOrigin('web');
    const sin = await adapter.ensure('issue-2', [WEB]);
    expect(sin.repos[0].note).toContain(
      'no hay token configurado para github.com',
    );
  });

  it('refuses a task id that could leave the folder', async () => {
    await expect(adapter.ensure('../fuera', [WEB])).rejects.toThrow(
      'Unsafe task id',
    );
  });
});
