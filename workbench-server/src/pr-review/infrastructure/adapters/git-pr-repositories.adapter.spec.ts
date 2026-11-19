import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { MirrorRemote, RepoMirrorService } from '@core/git/repo-mirror';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import { remotePullRequest } from '@pr-review/application/testing/fakes';
import { GitCliCheckoutAdapter } from './git-cli-checkout.adapter';
import { GitCliRepositoryCacheAdapter } from './git-cli-repository-cache.adapter';

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

describe('the repositories of the pull requests (with a real repository)', () => {
  let root: string;
  let origin: string;
  let mirror: RepoMirrorService;
  let cache: GitCliRepositoryCacheAdapter;
  let checkout: GitCliCheckoutAdapter;
  let pullRequest: PullRequest;
  let reachable: boolean;

  const commit = (file: string, text: string) => {
    writeFileSync(join(origin, file), text);
    git(origin, 'add', '.');
    git(origin, 'commit', '-q', '-m', file);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'pr-repos-'));
    origin = join(root, 'origin');
    reachable = true;
    execFileSync('git', ['init', '--quiet', '-b', 'main', origin]);
    commit('REVIEW_RULES.md', 'Reglas de main');
    git(origin, 'checkout', '-q', '-b', 'feature/1');
    commit('cambio.txt', 'de la PR');
    git(origin, 'checkout', '-q', 'main');

    const config = {
      get: (key: string) =>
        ({
          MIRRORS_DIR: join(root, 'mirrors'),
          CHAT_REPOS_DIR: join(root, 'prs'),
        })[key],
      getOrThrow: () => 'token',
    } as unknown as ConfigService;
    mirror = new RepoMirrorService(config);
    // El servidor habla con Bitbucket: en las pruebas el repositorio sale de uno local.
    const realSync = mirror.sync.bind(mirror) as RepoMirrorService['sync'];
    jest
      .spyOn(mirror, 'sync')
      .mockImplementation(
        (remote: MirrorRemote, options?: { requireFresh?: boolean }) =>
          realSync(
            {
              ...remote,
              cloneUrl: `file://${reachable ? origin : join(root, 'no-existe')}`,
            },
            options,
          ),
      );
    cache = new GitCliRepositoryCacheAdapter(config, mirror);
    checkout = new GitCliCheckoutAdapter(config, mirror);
    pullRequest = PullRequest.createFromRemote(
      remotePullRequest('1', 'ws/app'),
    );
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const mirrorsOf = () =>
    readdirSync(join(root, 'mirrors', 'bitbucket.org', 'ws'));

  describe('the copy for the chat', () => {
    it('leaves the branch of the PR in a worktree of the shared mirror and says its commit', async () => {
      const { path, commit: head } = await cache.ensure(pullRequest);

      expect(existsSync(join(path, 'cambio.txt'))).toBe(true);
      expect(await mirror.isWorktree(path)).toBe(true);
      expect(head).toBe(git(path, 'rev-parse', 'HEAD').trim());
      expect(mirrorsOf()).toEqual(['app.git']);
    });

    it('only brings what is new the next time: the same folder moves to the new commit', async () => {
      const first = await cache.ensure(pullRequest);
      git(origin, 'checkout', '-q', 'feature/1');
      commit('mas.txt', 'otro');
      git(origin, 'checkout', '-q', 'main');

      const second = await cache.ensure(pullRequest);

      expect(second.path).toBe(first.path);
      expect(second.commit).not.toBe(first.commit);
      expect(existsSync(join(second.path, 'mas.txt'))).toBe(true);
      expect(mirrorsOf()).toEqual(['app.git']);
    });

    it('gives two PRs of the same repository their own folder from one mirror', async () => {
      git(origin, 'branch', 'feature/2');
      const other = PullRequest.createFromRemote(
        remotePullRequest('2', 'ws/app', { sourceBranch: 'feature/2' }),
      );

      const a = await cache.ensure(pullRequest);
      const b = await cache.ensure(other);

      expect(a.path).not.toBe(b.path);
      expect(existsSync(join(a.path, 'cambio.txt'))).toBe(true);
      expect(existsSync(join(b.path, 'cambio.txt'))).toBe(false);
      expect(mirrorsOf()).toEqual(['app.git']);
    });

    it('keeps answering with the copy it had when the provider cannot be reached', async () => {
      await cache.ensure(pullRequest);
      reachable = false;

      const { path } = await cache.ensure(pullRequest);

      expect(existsSync(join(path, 'cambio.txt'))).toBe(true);
    });

    it('fails clearly when the branch of the PR is not in the repository', async () => {
      const missing = PullRequest.createFromRemote(
        remotePullRequest('3', 'ws/app', { sourceBranch: 'feature/borrada' }),
      );

      await expect(cache.ensure(missing)).rejects.toThrow('feature/borrada');
    });

    it('refuses a branch name that could be an option of git', () => {
      const unsafe = PullRequest.createFromRemote(
        remotePullRequest('4', 'ws/app', { sourceBranch: '--upload-pack=x' }),
      );

      expect(() => cache.ensure(unsafe)).toThrow('Unsafe branch name');
    });
  });

  describe('the throwaway checkout for a review', () => {
    it('opens the branch of the PR and reads the rules from the destination branch', async () => {
      const result = await checkout.checkout(pullRequest);

      expect(existsSync(join(result.path, 'cambio.txt'))).toBe(true);
      expect(result.rules).toBe('Reglas de main');
      expect(result.commit).toBe(git(result.path, 'rev-parse', 'HEAD').trim());
      await result.dispose();
    });

    it('does not clone the repository again for the next review, and leaves nothing behind when it is done', async () => {
      const first = await checkout.checkout(pullRequest);
      await first.dispose();
      const second = await checkout.checkout(pullRequest);

      expect(mirrorsOf()).toEqual(['app.git']);
      const mirrorPath = mirror.pathOf('bitbucket.org/ws/app');
      expect(
        execFileSync('git', ['worktree', 'list'], {
          cwd: mirrorPath,
          encoding: 'utf8',
        })
          .trim()
          .split('\n'),
      ).toHaveLength(2);

      await second.dispose();

      expect(existsSync(second.path)).toBe(false);
      expect(
        execFileSync('git', ['worktree', 'list'], {
          cwd: mirrorPath,
          encoding: 'utf8',
        })
          .trim()
          .split('\n'),
      ).toHaveLength(1);
    });

    it('is not afraid of the destination branch lacking rules: it uses the ones of the PR, or none', async () => {
      git(origin, 'checkout', '-q', 'feature/1');
      commit('REVIEW_RULES.md', 'Reglas de la PR');
      git(origin, 'checkout', '-q', 'main');
      git(origin, 'rm', '-q', 'REVIEW_RULES.md');
      git(origin, 'commit', '-q', '-m', 'sin reglas');

      const result = await checkout.checkout(pullRequest);

      expect(result.rules).toBe('Reglas de la PR');
      await result.dispose();
    });

    it('refuses to review old code: when it cannot get the latest it fails', async () => {
      await (await checkout.checkout(pullRequest)).dispose();
      reachable = false;

      await expect(checkout.checkout(pullRequest)).rejects.toThrow(
        'git fetch failed',
      );
    });
  });
});
