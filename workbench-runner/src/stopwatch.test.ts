import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stopwatch } from './stopwatch';

test('suma cada fase y el total', () => {
  let t = 1_000;
  const watch = stopwatch(() => t);
  t += 2_500;
  watch.lap('carpeta');
  t += 100_000;
  watch.lap('IA');
  assert.equal(watch.summary(), '⏱ 102.5 s en total: carpeta 2.5 s · IA 100.0 s');
});
