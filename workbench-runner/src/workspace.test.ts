import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { git } from './git';
import { REPO, createRemote, remoteBranches, tempDir } from './test-helpers';
import { Workspaces, assertSafe } from './workspace';

const BRANCH = 'workbench/vista-1234abcd';

describe('assertSafe', () => {
  it('accepts what the server sends', () => {
    assert.doesNotThrow(() => assertSafe(REPO, BRANCH));
  });

  it('rejects repositories that could leave the work folder or add git options', () => {
    for (const fullName of [
      '../web',
      'acme/..',
      'acme',
      'acme/web/extra',
      '-acme/web',
      'acme/we b',
    ]) {
      assert.throws(
        () => assertSafe({ ...REPO, fullName }, BRANCH),
        /repositorio/,
        fullName,
      );
    }
  });

  it('rejects addresses that are not ssh on bitbucket or github', () => {
    for (const sshUrl of [
      'https://bitbucket.org/acme/web.git',
      'git@evil.com:acme/web.git',
      'ssh://git@bitbucket.org/acme/web.git',
      '--upload-pack=calc',
      'git@bitbucket.org:acme/web',
    ]) {
      assert.throws(
        () => assertSafe({ ...REPO, sshUrl }, BRANCH),
        /Dirección/,
        sshUrl,
      );
    }
  });

  it('rejects branch names that are not plain', () => {
    for (const branch of ['-x', '../x', 'a..b', 'a/', 'a b', '']) {
      assert.throws(() => assertSafe(REPO, branch), /rama/, branch);
    }
  });
});

describe('Workspaces', () => {
  function setup() {
    const bare = createRemote();
    const workDir = tempDir('work');
    return {
      bare,
      workDir,
      workspaces: new Workspaces(workDir, { 'acme/web': bare }),
    };
  }

  it('clones the repo and opens a worktree on a new branch from the main branch', async () => {
    const { workspaces, workDir } = setup();

    const workspace = await workspaces.prepare(REPO, BRANCH);

    assert.equal(workspace.baseBranch, 'main');
    assert.ok(workspace.dir.startsWith(workDir));
    assert.ok(existsSync(join(workspace.dir, 'README.md')));
    assert.equal(
      (
        await git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: workspace.dir })
      ).trim(),
      BRANCH,
    );
  });

  it('copies the configured files into a new worktree, without overwriting them afterwards', async () => {
    const bare = createRemote();
    const workspaces = new Workspaces(
      tempDir('work'),
      { 'acme/web': bare },
      {
        'acme/web': [
          { from: 'README.md', to: 'src/environments/environment.ts' },
        ],
      },
    );

    const { dir } = await workspaces.prepare(REPO, BRANCH);
    const copy = join(dir, 'src', 'environments', 'environment.ts');
    assert.equal(readFileSync(copy, 'utf8'), '# web\n');

    writeFileSync(copy, 'mío\n');
    await workspaces.prepare(REPO, BRANCH);
    assert.equal(readFileSync(copy, 'utf8'), 'mío\n');
  });

  it('refuses to copy a file out of the repository', async () => {
    const bare = createRemote();
    const workspaces = new Workspaces(
      tempDir('work'),
      { 'acme/web': bare },
      { 'acme/web': [{ from: 'README.md', to: '../fuera.txt' }] },
    );

    await assert.rejects(
      workspaces.prepare(REPO, BRANCH),
      /fuera del repositorio/,
    );
  });

  it('reuses the worktree, with its work, on the next job of the same execution', async () => {
    const { workspaces } = setup();
    const first = await workspaces.prepare(REPO, BRANCH);
    writeFileSync(join(first.dir, 'a.txt'), 'trabajo\n');

    const second = await workspaces.prepare(REPO, BRANCH);

    assert.equal(second.dir, first.dir);
    assert.ok(existsSync(join(second.dir, 'a.txt')));
  });

  it('pushes the branch to the remote', async () => {
    const { workspaces, bare } = setup();
    const { dir } = await workspaces.prepare(REPO, BRANCH);
    writeFileSync(join(dir, 'a.txt'), 'x\n');
    await git(['add', '--all'], { cwd: dir });
    await git(['commit', '-m', 'trabajo'], { cwd: dir });

    await workspaces.push(dir, BRANCH);

    assert.ok(remoteBranches(bare).includes(BRANCH));
  });

  it('releases the worktree but keeps the branch', async () => {
    const { workspaces, workDir } = setup();
    const { dir } = await workspaces.prepare(REPO, BRANCH);

    await workspaces.release(REPO, BRANCH);

    assert.equal(existsSync(dir), false);
    const clone = join(workDir, 'repos', 'acme__web');
    const branches = await git(['branch', '--format=%(refname:short)'], {
      cwd: clone,
    });
    assert.ok(branches.split('\n').includes(BRANCH));
  });

  it('picks up the branch again if the worktree was released', async () => {
    const { workspaces } = setup();
    const { dir } = await workspaces.prepare(REPO, BRANCH);
    writeFileSync(join(dir, 'a.txt'), 'x\n');
    await git(['add', '--all'], { cwd: dir });
    await git(['commit', '-m', 'trabajo'], { cwd: dir });
    await workspaces.release(REPO, BRANCH);

    const again = await workspaces.prepare(REPO, BRANCH);

    assert.ok(existsSync(join(again.dir, 'a.txt')));
  });

  it('rebuilds the worktree from the branch on the remote when this clone never had it', async () => {
    const { workspaces, bare } = setup();
    const first = await workspaces.prepare(REPO, BRANCH);
    writeFileSync(join(first.dir, 'a.txt'), 'trabajo\n');
    await git(['add', '--all'], { cwd: first.dir });
    await git(['commit', '-m', 'trabajo'], { cwd: first.dir });
    await workspaces.push(first.dir, BRANCH);

    // Otro PC (otro clon) retoma la rama: no puede partir de main, perdería el trabajo.
    const other = new Workspaces(tempDir('other'), { 'acme/web': bare });
    const again = await other.prepare(REPO, BRANCH);

    assert.ok(existsSync(join(again.dir, 'a.txt')));
    assert.equal(
      (
        await git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: again.dir })
      ).trim(),
      BRANCH,
    );
  });

  it('moves a released worktree forward to what was added to its branch on the remote', async () => {
    const { workspaces, bare } = setup();
    const { dir } = await workspaces.prepare(REPO, BRANCH);
    writeFileSync(join(dir, 'a.txt'), 'trabajo\n');
    await git(['add', '--all'], { cwd: dir });
    await git(['commit', '-m', 'trabajo'], { cwd: dir });
    await workspaces.push(dir, BRANCH);
    await workspaces.release(REPO, BRANCH);

    // Alguien corrige a mano en la PR y sube un commit a la rama.
    const mate = tempDir('mate');
    await git(['clone', '--branch', BRANCH, bare, mate]);
    writeFileSync(join(mate, 'arreglo.txt'), 'a mano\n');
    await git(['add', '--all'], { cwd: mate });
    await git(['commit', '-m', 'arreglo'], { cwd: mate });
    await git(['push', 'origin', BRANCH], { cwd: mate });

    const again = await workspaces.prepare(REPO, BRANCH);

    assert.ok(existsSync(join(again.dir, 'a.txt')));
    assert.ok(existsSync(join(again.dir, 'arreglo.txt')));
    // Y se puede volver a subir sin que git rechace el push.
    writeFileSync(join(again.dir, 'b.txt'), 'x\n');
    await git(['add', '--all'], { cwd: again.dir });
    await git(['commit', '-m', 'otro'], { cwd: again.dir });
    await assert.doesNotReject(workspaces.push(again.dir, BRANCH));
  });

  it('sees what was added to the remote since the last time', async () => {
    const { workspaces, bare } = setup();
    await workspaces.prepare(REPO, 'workbench/primera-1');

    // Un compañero sube un commit a main.
    const mate = tempDir('mate');
    await git(['clone', bare, mate]);
    writeFileSync(join(mate, 'nuevo.txt'), 'x\n');
    await git(['add', '--all'], { cwd: mate });
    await git(['commit', '-m', 'nuevo'], { cwd: mate });
    await git(['push', 'origin', 'main'], { cwd: mate });

    const next = await workspaces.prepare(REPO, 'workbench/segunda-2');
    assert.ok(existsSync(join(next.dir, 'nuevo.txt')));
  });

  it('sweeps the worktrees nobody touched in a week and leaves the recent ones', async () => {
    const { workspaces, workDir } = setup();
    const recent = await workspaces.prepare(REPO, 'workbench/reciente-1');
    const old = join(workDir, 'worktrees', 'viejo');
    mkdirSync(old, { recursive: true });
    const longAgo = new Date(Date.now() - 8 * 24 * 60 * 60_000);
    utimesSync(old, longAgo, longAgo);

    const removed = await workspaces.sweep();

    assert.deepEqual(removed, ['viejo']);
    assert.equal(existsSync(old), false);
    assert.ok(existsSync(recent.dir));
  });

  it('never works outside the work folder', async () => {
    const { workspaces } = setup();
    await assert.rejects(
      workspaces.prepare(
        { sshUrl: REPO.sshUrl, fullName: 'acme/web' },
        '../../afuera',
      ),
      /rama/,
    );
  });
});
