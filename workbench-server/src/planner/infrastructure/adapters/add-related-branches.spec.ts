import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { RepoMirrorService } from '@core/git/repo-mirror';
import { addRelatedBranches } from './add-related-branches';

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

describe('addRelatedBranches (with a real repository)', () => {
  let root: string;
  let parent: string;
  let mirror: RepoMirrorService;
  let mirrorPath: string;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'related-'));
    const origin = join(root, 'origin');
    parent = join(root, 'work');
    execFileSync('git', ['init', '--quiet', '-b', 'main', origin]);
    git(origin, 'commit', '--allow-empty', '-m', 'base');
    git(origin, 'checkout', '-q', '-b', 'feature/MEL-466/mejora');
    writeFileSync(join(origin, 'contrato.txt'), 'jde_block');
    git(origin, 'add', '.');
    git(origin, 'commit', '-m', 'jde');
    git(origin, 'checkout', '-q', 'main');
    git(origin, 'branch', 'feature/MEL-500/otra');

    mirror = new RepoMirrorService({
      get: (key: string) =>
        key === 'MIRRORS_DIR' ? join(root, 'mirrors') : undefined,
    } as unknown as ConfigService);
    mirrorPath = (
      await mirror.sync({
        key: 'github.com/acme/api',
        cloneUrl: `file://${origin}`,
        cleanUrl: 'https://github.com/acme/api.git',
        secret: '',
      })
    ).path;
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const options = (keys: string[], warn = jest.fn()) => ({
    mirror,
    mirrorPath,
    parent,
    repoName: 'api',
    keys,
    warn,
  });

  it('opens the branch of the mentioned ticket next to the repo, readable', async () => {
    const warn = jest.fn();

    const branches = await addRelatedBranches(options(['MEL-466'], warn));

    expect(branches).toEqual([
      {
        key: 'MEL-466',
        branch: 'feature/MEL-466/mejora',
        folder: 'api@MEL-466',
      },
    ]);
    expect(
      readFileSync(join(parent, 'api@MEL-466', 'contrato.txt'), 'utf8'),
    ).toContain('jde_block');
    expect(existsSync(join(parent, 'api@MEL-500'))).toBe(false);
    expect(await mirror.isWorktree(join(parent, 'api@MEL-466'))).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does nothing without keys or when no branch carries them', async () => {
    expect(await addRelatedBranches(options([]))).toEqual([]);
    expect(await addRelatedBranches(options(['MEL-999']))).toEqual([]);
  });

  it('does not fail when the mirror is not there, and says so', async () => {
    const warn = jest.fn();

    const branches = await addRelatedBranches({
      ...options(['MEL-466'], warn),
      mirrorPath: join(root, 'no-existe.git'),
    });

    expect(branches).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });
});
