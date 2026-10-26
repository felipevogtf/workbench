import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { LOCK_FILE, acquireLock } from './lock';
import { tempDir } from './test-helpers';

describe('acquireLock', () => {
  it('takes the lock when nobody has it, and frees it on release', () => {
    const dir = tempDir('lock');

    const lock = acquireLock(dir, 4242);
    assert.equal(lock.ok, true);
    assert.equal(readFileSync(join(dir, LOCK_FILE), 'utf8'), '4242');

    if (lock.ok) lock.release();
    assert.equal(existsSync(join(dir, LOCK_FILE)), false);
  });

  it('refuses a second runner while the first one is alive', async () => {
    const dir = tempDir('lock');
    // Un proceso de verdad que sigue vivo mientras dura la prueba.
    const alive = spawn(
      process.execPath,
      ['-e', 'setTimeout(() => {}, 30000)'],
      {
        stdio: 'ignore',
      },
    );
    try {
      writeFileSync(join(dir, LOCK_FILE), String(alive.pid));

      const second = acquireLock(dir, process.pid);

      assert.deepEqual(second, { ok: false, busyPid: alive.pid });
      assert.equal(
        readFileSync(join(dir, LOCK_FILE), 'utf8'),
        String(alive.pid),
      );
    } finally {
      alive.kill();
    }
  });

  it('ignores the file of a runner that died', async () => {
    const dir = tempDir('lock');
    const dead = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
    await new Promise((resolve) => dead.on('exit', resolve));
    writeFileSync(join(dir, LOCK_FILE), String(dead.pid));

    const lock = acquireLock(dir, process.pid);

    assert.equal(lock.ok, true);
    assert.equal(
      readFileSync(join(dir, LOCK_FILE), 'utf8'),
      String(process.pid),
    );
  });

  it('ignores a file that does not hold a pid', () => {
    const dir = tempDir('lock');
    writeFileSync(join(dir, LOCK_FILE), 'basura');

    assert.equal(acquireLock(dir).ok, true);
  });

  it('does not delete the file of another runner when releasing', () => {
    const dir = tempDir('lock');
    const lock = acquireLock(dir, 1111);
    writeFileSync(join(dir, LOCK_FILE), '2222');

    if (lock.ok) lock.release();

    assert.equal(readFileSync(join(dir, LOCK_FILE), 'utf8'), '2222');
  });
});
