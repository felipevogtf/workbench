import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

process.env.COPILOT_JS = fileURLToPath(new URL("./fixtures/fake-copilot.mjs", import.meta.url));
process.env.WA_ENV_FILE = "none";
const { think } = await import("../src/brain.mjs");

test("the answer is delivered at the result event, without waiting for the CLI to shut down", async () => {
  process.env.FAKE_MODE = "ok";
  const t = Date.now();
  const answer = await think("sistema", "hola");
  const ms = Date.now() - t;
  assert.equal(answer, "Hola, soy una IA.");
  assert.ok(ms < 1300, `took ${ms} ms, the fake CLI only exits after 1500 ms`);
});

test("a failing CLI rejects with its exit code and message, not the command line", async () => {
  process.env.FAKE_MODE = "fail";
  await assert.rejects(think("sistema", "un texto largo que no debe aparecer en el error"), (e) => {
    assert.match(e.message, /exit 3/);
    assert.match(e.message, /something went wrong/);
    assert.doesNotMatch(e.message, /un texto largo/);
    return true;
  });
});

test("a CLI that exits cleanly without events resolves to null", async () => {
  process.env.FAKE_MODE = "silent";
  assert.equal(await think("sistema", "hola"), null);
});
