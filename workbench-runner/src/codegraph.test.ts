import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { git } from './git';
import { codegraphMcpConfig, codegraphNotice, prepareIndex } from './codegraph';
import { createRemote, fakeCodegraph, tempDir } from './test-helpers';

async function repoWithIndex(withIndex: boolean) {
  const clone = tempDir('clone');
  await git(['init', '--initial-branch=main'], { cwd: clone });
  const worktree = tempDir('wt');
  await git(['init', '--initial-branch=main'], { cwd: worktree });
  if (withIndex) {
    mkdirSync(join(clone, '.codegraph'));
    writeFileSync(join(clone, '.codegraph', 'codegraph.db'), 'índice');
  }
  return { clone, worktree };
}

describe('index of the clone', () => {
  /** Un remoto, un clon con índice y un compañero que sube un commit a main. */
  async function cloneBehindMain() {
    const bare = createRemote();
    const clone = tempDir('clone');
    await git(['clone', bare, clone]);
    mkdirSync(join(clone, '.codegraph'));
    writeFileSync(join(clone, '.codegraph', 'codegraph.db'), 'índice');

    const mate = tempDir('mate');
    await git(['clone', bare, mate]);
    writeFileSync(join(mate, 'nuevo.txt'), 'x');
    await git(['add', '--all'], { cwd: mate });
    await git(['commit', '-m', 'nuevo'], { cwd: mate });
    await git(['push', 'origin', 'main'], { cwd: mate });
    await git(['fetch', 'origin'], { cwd: clone });

    const worktree = tempDir('wt');
    await git(['init', '--initial-branch=main'], { cwd: worktree });
    return { clone, worktree };
  }

  it('brings the clone up to the base branch and syncs it before copying, only when the base moved', async () => {
    const { config, calls } = fakeCodegraph();
    const { clone, worktree } = await cloneBehindMain();
    const logs: string[] = [];

    await prepareIndex(config, { clone, worktree }, undefined, (l) =>
      logs.push(l),
    );

    assert.ok(
      existsSync(join(clone, 'nuevo.txt')),
      'the clone moved to origin/main',
    );
    assert.deepEqual(
      calls().filter((c) => c.includes(clone)),
      [`sync ${clone} | off`],
    );
    assert.ok(logs.some((line) => line.includes('Índice del clon al día')));
    assert.ok(
      readFileSync(join(clone, '.codegraph', 'indexed-at'), 'utf8').trim(),
    );

    // Otro worktree, sin que main haya avanzado: no se vuelve a sincronizar el clon.
    const second = tempDir('wt2');
    await git(['init', '--initial-branch=main'], { cwd: second });
    await prepareIndex(config, { clone, worktree: second });
    assert.equal(calls().filter((c) => c.includes(clone)).length, 1);
  });

  it('keeps going with the old index when the clone cannot be updated', async () => {
    const { config } = fakeCodegraph();
    const places = await repoWithIndex(true);
    const logs: string[] = [];

    assert.equal(
      await prepareIndex(config, places, undefined, (l) => logs.push(l)),
      true,
    );
    assert.ok(
      logs.some((line) =>
        line.includes('No se pudo actualizar el índice del clon'),
      ),
    );
  });
});

describe('codegraph', () => {
  it('copies the index of the clone to a new worktree, keeps it out of git and brings it up to date', async () => {
    const { config, calls } = fakeCodegraph();
    const places = await repoWithIndex(true);

    assert.equal(await prepareIndex(config, places), true);

    assert.equal(
      readFileSync(join(places.worktree, '.codegraph', 'codegraph.db'), 'utf8'),
      'índice',
    );
    assert.deepEqual(calls(), [`sync ${places.worktree} | off`]);
    const status = await git(['status', '--porcelain'], {
      cwd: places.worktree,
    });
    assert.equal(status.trim(), '');
  });

  it('does not copy again when the worktree already has its index', async () => {
    const { config } = fakeCodegraph();
    const places = await repoWithIndex(true);
    await prepareIndex(config, places);
    writeFileSync(
      join(places.worktree, '.codegraph', 'codegraph.db'),
      'propio',
    );

    await prepareIndex(config, places);

    assert.equal(
      readFileSync(join(places.worktree, '.codegraph', 'codegraph.db'), 'utf8'),
      'propio',
    );
  });

  it('says there is no index when the clone has none', async () => {
    const { config, calls } = fakeCodegraph();
    const places = await repoWithIndex(false);

    assert.equal(await prepareIndex(config, places), false);
    assert.deepEqual(calls(), []);
  });

  it('starts the server without telemetry and names each project in the prompt', () => {
    const config = JSON.parse(
      codegraphMcpConfig({ bin: '/usr/bin/codegraph', repos: [] }),
    ) as {
      mcpServers: {
        codegraph: {
          command: string;
          args: string[];
          env: Record<string, string>;
        };
      };
    };
    assert.deepEqual(config.mcpServers.codegraph.args, ['serve', '--mcp']);
    assert.equal(config.mcpServers.codegraph.env.CODEGRAPH_TELEMETRY, 'off');

    const notice = codegraphNotice([
      { fullName: 'acme/web', dir: '/work/web' },
      { fullName: 'acme/app', dir: '/work/app' },
    ]);
    assert.match(notice, /codegraph_explore/);
    assert.match(notice, /- acme\/web: `projectPath` = \/work\/web/);
    assert.match(notice, /- acme\/app: `projectPath` = \/work\/app/);
  });
});
