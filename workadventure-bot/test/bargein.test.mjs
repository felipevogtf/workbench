import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = mkdtempSync(join(tmpdir(), "wa-barge-"));
process.env.WA_LOG_DIR = base;
process.env.WA_RUN_ID = "run";
process.env.WA_ENV_FILE = join(base, "none.env");
process.env.WA_LOG_CONSOLE = "none";
const { createBargeInDetector } = await import("../src/bargein.mjs");
const { startChat } = await import("../src/chat.mjs");
const { state } = await import("../src/state.mjs");
const { LOG_DIR } = await import("../src/logger.mjs");

test("the detector needs consecutive loud chunks, a single one (or an echo blip) does not count", () => {
  const d = createBargeInDetector({ threshold: 0.04, chunks: 2 });
  assert.equal(d.feed(0.2), false);
  assert.equal(d.feed(0.01), false); // back to quiet: the run starts over
  assert.equal(d.feed(0.2), false);
  assert.equal(d.feed(0.2), true);
  d.reset();
  assert.equal(d.feed(0.2), false);
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const lastRecord = () => JSON.parse(readFileSync(join(LOG_DIR, "latency.jsonl"), "utf8").trim().split("\n").at(-1));
const fakePage = (typed, onSpeak) => ({
  mouse: { click: async () => {} },
  getByText: () => ({ first: () => ({ click: async () => {} }) }),
  locator: (sel) => (sel.includes("message-bubble") ? { allInnerTexts: async () => [] } : { last: () => ({ click: async () => {} }) }),
  keyboard: { type: async (t) => typed.push(t), press: async () => {} },
  evaluate: async (fn) => (String(fn).includes("__speak") ? onSpeak() : 0),
});
const item = () => { const t = Date.now(); return { text: "hola", segmentAt: t - 2000, speechEndAt: t - 3000, sttStartAt: t - 2000, sttEndAt: t - 1000 }; };

test("talking over the bot while it speaks: the turn is marked interrupted and the echo guard does not mute the person afterwards", async () => {
  const typed = [];
  let go = true;
  state.inbox.push(item());
  const loop = startChat(fakePage(typed, async () => { await wait(200); state.bargeInAt = Date.now(); return 0.5; }), { voiceName: "v", system: "s" }, {
    think: async () => "respuesta uno",
    synthesize: async () => "d2F2",
    running: () => go,
  });
  await wait(4000);
  go = false;
  await loop;
  assert.equal(lastRecord().interrupted, true);
  assert.equal(state.mutedUntil, 0);
  assert.match(readFileSync(join(LOG_DIR, "conversation.log"), "utf8"), /spoke \(v\) played for \d+ ms \(interrupted\)/);
});

test("if the person interrupted before the voice was ready, the voice is skipped but the chat message still goes out", async () => {
  const typed = [];
  let go = true;
  let spoke = 0;
  state.bargeInAt = 0;
  state.inbox.push(item());
  const loop = startChat(fakePage(typed, async () => (spoke++, 0.5)), { voiceName: "v", system: "s" }, {
    think: async () => { await wait(100); state.bargeInAt = Date.now(); return "respuesta dos"; }, // the person starts talking while it thinks
    synthesize: async () => "d2F2",
    running: () => go,
  });
  await wait(4000);
  go = false;
  await loop;
  assert.equal(spoke, 0);
  assert.deepEqual(typed, ["respuesta dos"]);
  assert.match(readFileSync(join(LOG_DIR, "conversation.log"), "utf8"), /voice skipped, the person interrupted the bot/);
});
