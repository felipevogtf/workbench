import { test } from "node:test";
import assert from "node:assert/strict";
import { percentile, summarize } from "../src/latency.mjs";

test("percentile uses nearest rank", () => {
  assert.equal(percentile([], 50), null);
  assert.equal(percentile([5], 90), 5);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5);
  assert.equal(percentile([10, 1, 5, 3, 7], 90), 10);
});

test("summarize skips missing stages and ignores nulls", () => {
  const s = summarize([
    { chat_ms: 4000, voice_ms: null, llm_ms: 3000 },
    { chat_ms: 6000, voice_ms: 7000, llm_ms: 5000 },
    { chat_ms: 8000, llm_ms: 9000 },
  ]);
  assert.deepEqual(s.chat_ms, { n: 3, min: 4000, p50: 6000, p90: 8000, max: 8000 });
  assert.equal(s.voice_ms.n, 1);
  assert.equal(s.tts_ms, undefined);
});
