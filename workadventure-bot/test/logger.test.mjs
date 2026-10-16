import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = mkdtempSync(join(tmpdir(), "wa-logs-"));
process.env.WA_LOG_DIR = base;
process.env.WA_RUN_ID = "run-1";
process.env.WA_ENV_FILE = join(base, "none.env");
process.env.WA_LOG_CONSOLE = "none";
const { logger, logJson, LOG_DIR } = await import("../src/logger.mjs");
const read = (f) => readFileSync(join(LOG_DIR, f), "utf8");

test("each channel writes its own file", () => {
  logger("movement")("tile 3,4");
  logger("conversation")("heard: hola");
  assert.match(read("movement.log"), /^\d\d:\d\d:\d\d\.\d{3} tile 3,4$/m);
  assert.match(read("conversation.log"), /heard: hola/);
  assert.doesNotMatch(read("movement.log"), /hola/);
});

test("errors and warnings are also copied to errors.log with their channel", () => {
  const log = logger("audio");
  log.warn("stt behind");
  log.error("whisper failed");
  const errors = read("errors.log");
  assert.match(errors, /\[audio\] WARN stt behind/);
  assert.match(errors, /\[audio\] ERROR whisper failed/);
  assert.match(read("audio.log"), /ERROR whisper failed/);
});

test("logJson writes one JSON object per line", () => {
  logJson("latency", { turn: 1, chat_ms: 1234 });
  logJson("latency", { turn: 2, chat_ms: 99 });
  const lines = read("latency.jsonl").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines.length, 2);
  assert.equal(lines[0].chat_ms, 1234);
  assert.ok(lines[0].t);
});

test("nothing is created until something is logged to a channel that was not used", () => {
  assert.equal(existsSync(join(LOG_DIR, "system.log")), false);
});
