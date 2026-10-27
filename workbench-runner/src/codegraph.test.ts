import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { git } from './git';
import { codegraphMcpConfig, codegraphNotice, prepareIndex } from './codegraph';
import { fakeCodegraph, tempDir } from './test-helpers';

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
