import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { MirrorRemote, RepoMirrorService } from './repo-mirror';

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

describe('RepoMirrorService (with real repositories)', () => {
  let root: string;
  let origin: string;
  let service: RepoMirrorService;
  let remote: MirrorRemote;

  const commit = (file: string, text: string, message: string) => {
    writeFileSync(join(origin, file), text);
    git(origin, 'add', '.');
    git(origin, 'commit', '-q', '-m', message);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mirror-'));
    origin = join(root, 'origin');
    execFileSync('git', ['init', '--quiet', '-b', 'main', origin]);
    commit('README.md', 'uno', 'base');
    git(origin, 'checkout', '-q', '-b', 'feature/MEL-1/algo');
    commit('feature.txt', 'de la rama', 'feature');
    git(origin, 'checkout', '-q', 'main');
    service = new RepoMirrorService({
      get: (key: string) =>
        key === 'MIRRORS_DIR' ? join(root, 'mirrors') : undefined,
    } as unknown as ConfigService);
    remote = {
      key: 'github.com/Acme/Web',
      cloneUrl: `file://${origin}`,
      cleanUrl: 'https://github.com/Acme/Web.git',
      secret: 'secreto',
    };
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('clones every branch the first time, in a folder named after the repository whatever its capitals', async () => {
    const mirror = await service.sync(remote);

    expect(mirror.fresh).toBe(true);
    expect(mirror.path).toBe(service.pathOf('github.com/acme/web'));
    expect(mirror.path.endsWith(join('github.com', 'acme', 'web.git'))).toBe(
      true,
    );
    expect((await service.branches(mirror.path)).sort()).toEqual([
      'feature/MEL-1/algo',
      'main',
    ]);
  });

  it('never keeps the credentials: origin is the clean URL', async () => {
    const mirror = await service.sync({
      ...remote,
      cloneUrl: `file://${origin}`,
    });

    const config = readFileSync(join(mirror.path, 'config'), 'utf8');
    expect(config).toContain('https://github.com/Acme/Web.git');
    expect(config).not.toContain(origin);
    expect(config).not.toContain('secreto');
  });

  it('only brings what is new on the next sync, including new and deleted branches', async () => {
    const first = await service.sync(remote);
    commit('nuevo.txt', 'dos', 'segundo');
    git(origin, 'branch', 'otra');
    git(origin, 'branch', '-D', 'feature/MEL-1/algo');

    const second = await service.sync(remote);

    expect(second.path).toBe(first.path);
    expect((await service.branches(second.path)).sort()).toEqual([
      'main',
      'otra',
    ]);
    const worktree = join(root, 'wt');
    await service.addWorktree(second.path, worktree, 'main');
    expect(existsSync(join(worktree, 'nuevo.txt'))).toBe(true);
  });

  describe('worktrees', () => {
    it('gives each use its own folder on its own branch, from the same mirror', async () => {
      const { path } = await service.sync(remote);
      const main = join(root, 'wt-main');
      const feature = join(root, 'wt-feature');

      await service.addWorktree(path, main, 'main');
      await service.addWorktree(path, feature, 'feature/MEL-1/algo');

      expect(await service.isWorktree(main)).toBe(true);
      expect(existsSync(join(main, 'feature.txt'))).toBe(false);
      expect(readFileSync(join(feature, 'feature.txt'), 'utf8')).toBe(
        'de la rama',
      );
      expect(await service.head(main)).not.toBe(await service.head(feature));
    });

    it('moves an existing worktree to another branch, discarding its changes', async () => {
      const { path } = await service.sync(remote);
      const dest = join(root, 'wt');
      await service.addWorktree(path, dest, 'main');
      writeFileSync(join(dest, 'README.md'), 'cambiado a mano');

      await service.checkoutBranch(dest, 'feature/MEL-1/algo');
      expect(existsSync(join(dest, 'feature.txt'))).toBe(true);
      await service.checkoutBranch(dest, 'main');

      expect(readFileSync(join(dest, 'README.md'), 'utf8')).toBe('uno');
    });

    it('replaces whatever was in the folder, such as the old clone it used to be', async () => {
      const { path } = await service.sync(remote);
      const dest = join(root, 'viejo');
      mkdirSync(join(dest, '.git'), { recursive: true });
      writeFileSync(join(dest, 'basura.txt'), 'x');
      expect(await service.isWorktree(dest)).toBe(false);

      await service.addWorktree(path, dest, 'main');

      expect(await service.isWorktree(dest)).toBe(true);
      expect(existsSync(join(dest, 'basura.txt'))).toBe(false);
    });

    it('removes a worktree and its registration, and tolerates one that is already gone', async () => {
      const { path } = await service.sync(remote);
      const dest = join(root, 'wt');
      await service.addWorktree(path, dest, 'main');

      await service.removeWorktree(path, dest);
      await service.removeWorktree(path, dest);

      expect(existsSync(dest)).toBe(false);
      expect(
        execFileSync('git', ['worktree', 'list'], {
          cwd: path,
          encoding: 'utf8',
        })
          .trim()
          .split('\n'),
      ).toHaveLength(1);
    });

    it('forgets the worktrees whose folder was deleted by hand when it syncs again', async () => {
      const { path } = await service.sync(remote);
      const dest = join(root, 'wt');
      await service.addWorktree(path, dest, 'main');
      rmSync(dest, { recursive: true, force: true });

      await service.sync(remote);

      expect(
        execFileSync('git', ['worktree', 'list'], {
          cwd: path,
          encoding: 'utf8',
        })
          .trim()
          .split('\n'),
      ).toHaveLength(1);
    });

    it('refuses a branch name that could end up as an option of git', async () => {
      const { path } = await service.sync(remote);

      await expect(
        service.addWorktree(path, join(root, 'wt'), '--upload-pack=x'),
      ).rejects.toThrow('Unsafe branch');
      await expect(service.checkoutBranch(root, '-f')).rejects.toThrow(
        'Unsafe branch',
      );
    });
  });

  describe('when the remote cannot be reached', () => {
    it('keeps working with the copy it had, saying it is not fresh', async () => {
      await service.sync(remote);
      rmSync(origin, { recursive: true, force: true });

      const mirror = await service.sync(remote);

      expect(mirror.fresh).toBe(false);
      expect(await service.hasBranch(mirror.path, 'main')).toBe(true);
    });

    it('fails when the caller needs it fresh', async () => {
      await service.sync(remote);
      rmSync(origin, { recursive: true, force: true });

      await expect(
        service.sync(remote, { requireFresh: true }),
      ).rejects.toThrow('git fetch failed');
    });

    it('leaves nothing behind when the first clone fails, so the next try starts clean', async () => {
      const broken = {
        ...remote,
        cloneUrl: `file://${join(root, 'no-existe')}`,
      };

      await expect(service.sync(broken)).rejects.toThrow();

      expect(existsSync(service.pathOf(remote.key))).toBe(false);
      await expect(service.sync(remote)).resolves.toMatchObject({
        fresh: true,
      });
    });
  });

  it('syncs one repository at a time even when asked twice at once', async () => {
    const [a, b] = await Promise.all([
      service.sync(remote),
      service.sync(remote),
    ]);

    expect(a.path).toBe(b.path);
    expect(await service.hasBranch(a.path, 'main')).toBe(true);
  });

  it('refuses a key that is not host/organization/repository, or tries to leave the folder', () => {
    for (const key of [
      'github.com/acme',
      'github.com/../web',
      'github.com/-x/web',
      'a/b/c/d',
      '',
    ]) {
      expect(() => service.pathOf(key)).toThrow('Unsafe repository key');
    }
  });

  it('deletes the mirrors that nobody has asked for in weeks, and keeps the rest', async () => {
    const old = await service.sync(remote);
    const other = await service.sync({ ...remote, key: 'github.com/acme/api' });
    const weeksAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    utimesSync(old.path, weeksAgo, weeksAgo);
    // La limpieza corre como mucho una vez por hora: se fuerza a que ya haya pasado ese tiempo.
    (service as unknown as { lastSweep: number }).lastSweep = 0;

    await service.sync({ ...remote, key: 'github.com/acme/api' });
    await new Promise((done) => setTimeout(done, 300));

    expect(existsSync(old.path)).toBe(false);
    expect(statSync(other.path).isDirectory()).toBe(true);
  });
});
