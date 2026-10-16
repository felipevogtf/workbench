// A spoken turn through the chat loop with a fake page: checks the latency record and the logs without a browser, an LLM or a voice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = mkdtempSync(join(tmpdir(), "wa-turn-"));
process.env.WA_LOG_DIR = base;
process.env.WA_RUN_ID = "run";
process.env.WA_ENV_FILE = join(base, "none.env");
process.env.WA_LOG_CONSOLE = "none";
const { startChat } = await import("../src/chat.mjs");
const { state } = await import("../src/state.mjs");
const { LOG_DIR } = await import("../src/logger.mjs");

const typed = [];
const page = {
  mouse: { click: async () => {} },
  getByText: () => ({ first: () => ({ click: async () => {} }) }),
  locator: (sel) => (sel.includes("message-bubble") ? { allInnerTexts: async () => [] } : { last: () => ({ click: async () => {} }) }),
  keyboard: { type: async (t) => typed.push(t), press: async () => {} },
  evaluate: async (fn) => (String(fn).includes("__speak") ? 0.5 : 0),
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let go = true;

test("a spoken turn writes the conversation log and a complete latency record", async () => {
  const t = Date.now();
  // The person stopped talking ~1.2 s ago; Whisper took 800 ms and started right away.
  state.inbox.push({ text: "hola, cuéntame algo", segmentAt: t - 2000, speechEndAt: t - 3200, sttStartAt: t - 2000, sttEndAt: t - 1200 });
  const loop = startChat(page, { voiceName: "test-voice", system: "sys" }, {
    think: async () => (await wait(300), "Claro, te cuento algo."),
    synthesize: async () => (await wait(100), "d2F2"),
    running: () => go,
  });
  await wait(4500);
  go = false;
  await loop;

  const rec = JSON.parse(readFileSync(join(LOG_DIR, "latency.jsonl"), "utf8").trim().split("\n").at(-1));
  assert.equal(rec.source, "voice");
  assert.equal(rec.reply, "Claro, te cuento algo.");
  assert.equal(rec.stt_ms, 800);
  assert.ok(rec.llm_ms >= 300 && rec.llm_ms < 1000, `llm_ms ${rec.llm_ms}`);
  assert.ok(rec.tts_ms >= 100, `tts_ms ${rec.tts_ms}`);
  assert.ok(rec.chat_ms >= 1200 + 300, `chat_ms ${rec.chat_ms} counts from the end of the transcription`);
  assert.ok(rec.since_speech_end_chat_ms > rec.chat_ms, "counting from the end of speech is longer than from the transcript");
  assert.ok(rec.since_speech_end_voice_ms != null && rec.voice_ms != null);
  assert.deepEqual(typed, ["Claro, te cuento algo."]);

  const log = readFileSync(join(LOG_DIR, "conversation.log"), "utf8");
  assert.match(log, /turn 1 \[voice\] chat: hola, cuéntame algo/);
  assert.match(log, /turn 1 reply/);
  assert.match(readFileSync(join(LOG_DIR, "latency.log"), "utf8"), /heard->chat .*s \| heard->voice/);
});
