import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cloneRelatedBranches } from './clone-related-branches';

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

describe('cloneRelatedBranches (with a real repository)', () => {
  let root: string;
  let origin: string;
  let parent: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'related-'));
    origin = join(root, 'origin');
    parent = join(root, 'work');
    execFileSync('git', ['init', '--quiet', '-b', 'main', origin]);
    execFileSync('git', ['-C', origin, 'config', 'user.name', 't']);
    git(origin, 'commit', '--allow-empty', '-m', 'base');
    git(origin, 'checkout', '-q', '-b', 'feature/MEL-466/mejora');
    execFileSync('sh', ['-c', 'echo jde_block > contrato.txt'], {
      cwd: origin,
    });
    git(origin, 'add', '.');
    git(origin, 'commit', '-m', 'jde');
    git(origin, 'checkout', '-q', 'main');
    git(origin, 'branch', 'feature/MEL-500/otra');
    execFileSync('mkdir', ['-p', parent]);
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const credentials = () => ({
    cloneUrl: `file://${origin}`,
    cleanUrl: `file://${origin}`,
    secret: '',
  });

  it('clones the branch of the mentioned ticket next to the repo, readable', async () => {
    const warn = jest.fn();

    const branches = await cloneRelatedBranches({
      credentials: credentials(),
      parent,
      repoName: 'api',
      keys: ['MEL-466'],
      warn,
    });

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
    expect(warn).not.toHaveBeenCalled();
  });

  it('does nothing without keys or when no branch carries them', async () => {
    const warn = jest.fn();
    const none = {
      credentials: credentials(),
      parent,
      repoName: 'api',
      warn,
    };

    expect(await cloneRelatedBranches({ ...none, keys: [] })).toEqual([]);
    expect(await cloneRelatedBranches({ ...none, keys: ['MEL-999'] })).toEqual(
      [],
    );
  });

  it('does not fail when the remote cannot be reached', async () => {
    const warn = jest.fn();

    const branches = await cloneRelatedBranches({
      credentials: {
        cloneUrl: `file://${join(root, 'no-existe')}`,
        cleanUrl: '',
        secret: '',
      },
      parent,
      repoName: 'api',
      keys: ['MEL-466'],
      warn,
    });

    expect(branches).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });
});
