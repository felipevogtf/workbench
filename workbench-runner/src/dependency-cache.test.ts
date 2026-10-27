import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';
import { DependencyCache } from './dependency-cache';
import { tempDir } from './test-helpers';

const run = async (command: string, args: string[]) => {
  try {
    await promisify(execFile)(command, args);
    return { code: 0, stderr: '' };
  } catch (error) {
    return { code: 1, stderr: (error as Error).message };
  }
};

const ENTRIES = [{ dir: 'vendor', lock: 'composer.lock' }];

function worktree(lock: string, withVendor = true) {
  const dir = tempDir('wt');
  writeFileSync(join(dir, 'composer.lock'), lock);
  if (withVendor) {
    mkdirSync(join(dir, 'vendor', 'acme'), { recursive: true });
    writeFileSync(join(dir, 'vendor', 'acme', 'lib.php'), `<?php // ${lock}`);
  }
  return dir;
}

describe('DependencyCache', () => {
  it('copies what a worktree installed and gives it to the next worktree', async () => {
    const cache = new DependencyCache(tempDir('deps'), run);
    assert.deepEqual(await cache.save('acme/web', worktree('v1'), ENTRIES), [
      'vendor',
    ]);

    const next = worktree('v1', false);
    assert.deepEqual(await cache.seed('acme/web', next, ENTRIES), ['vendor']);
    assert.equal(
      readFileSync(join(next, 'vendor', 'acme', 'lib.php'), 'utf8'),
      '<?php // v1',
    );
  });

  it('leaves alone a worktree that already has its folder', async () => {
    const cache = new DependencyCache(tempDir('deps'), run);
    await cache.save('acme/web', worktree('v1'), ENTRIES);

    const own = worktree('v2');
    assert.deepEqual(await cache.seed('acme/web', own, ENTRIES), []);
    assert.equal(
      readFileSync(join(own, 'vendor', 'acme', 'lib.php'), 'utf8'),
      '<?php // v2',
    );
  });

  it('only saves again when the lockfile changed', async () => {
    const cache = new DependencyCache(tempDir('deps'), run);
    await cache.save('acme/web', worktree('v1'), ENTRIES);
    assert.deepEqual(await cache.save('acme/web', worktree('v1'), ENTRIES), []);
    assert.deepEqual(await cache.save('acme/web', worktree('v2'), ENTRIES), [
      'vendor',
    ]);

    const next = worktree('v2', false);
    await cache.seed('acme/web', next, ENTRIES);
    assert.equal(
      readFileSync(join(next, 'vendor', 'acme', 'lib.php'), 'utf8'),
      '<?php // v2',
    );
  });

  it('does not save what comes from a branch that changed the lockfile', async () => {
    const cache = new DependencyCache(tempDir('deps'), run);
    const changed = worktree('v9');

    assert.deepEqual(
      await cache.save('acme/web', changed, ENTRIES, async () => false),
      [],
    );
    const next = worktree('v9', false);
    assert.deepEqual(await cache.seed('acme/web', next, ENTRIES), []);
  });

  it('does nothing without a cache, a lockfile or an installed folder', async () => {
    const cache = new DependencyCache(tempDir('deps'), run);
    const empty = worktree('v1', false);
    assert.deepEqual(await cache.seed('acme/web', empty, ENTRIES), []);
    assert.equal(existsSync(join(empty, 'vendor')), false);
    assert.deepEqual(await cache.save('acme/web', empty, ENTRIES), []);
    assert.deepEqual(
      await cache.save('acme/web', worktree('v1'), [
        { dir: 'vendor', lock: 'no-existe.lock' },
      ]),
      [],
    );
  });
});
