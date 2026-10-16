// Logs split by function. Every run gets its own folder, logs/<date_time>/, with one file per channel:
//   system.log        start-up, joining the room, microphone, shutdown
//   movement.log      position, wandering, zones, "someone is near"
//   conversation.log  what was heard, what the bot answered and how (chat, voice, filler, text-to-speech)
//   audio.log         listening diagnostics: segments, capture quality, WebRTC stats
//   latency.jsonl     one JSON line per answered turn with every stage timed (see tools/latency-report.mjs)
//   errors.log        copy of every error/warning from any channel, to find what went wrong first
// The console only shows some channels (WA_LOG_CONSOLE, default "system,conversation,latency"; "all" shows everything).
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { inspect } from "node:util";
import { PATHS } from "./config.mjs";

const pad = (n, w = 2) => String(n).padStart(w, "0");
const d0 = new Date();
export const RUN_ID =
  process.env.WA_RUN_ID ?? `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}_${pad(d0.getHours())}-${pad(d0.getMinutes())}-${pad(d0.getSeconds())}`;
export const LOG_DIR = join(PATHS.logs, RUN_ID);

const FILES = process.env.WA_LOG_FILES !== "0";
const CONSOLE = new Set((process.env.WA_LOG_CONSOLE ?? "system,conversation,latency").split(",").map((s) => s.trim()).filter(Boolean));
let dirReady = false;

const clock = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
const text = (args) => args.map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : inspect(a, { breakLength: Infinity }))).join(" ");

function append(file, line) {
  if (!FILES) return;
  try {
    if (!dirReady) {
      mkdirSync(LOG_DIR, { recursive: true });
      dirReady = true;
    }
    appendFileSync(join(LOG_DIR, file), line + "\n");
  } catch {
    // never let logging break the bot
  }
}

/** log = logger("movement"); log("msg"); log.warn("msg"); log.error("msg") */
export function logger(channel) {
  const emit = (level, args) => {
    const t = clock();
    const tag = level ? `${level.toUpperCase()} ` : "";
    const line = `${t} ${tag}${text(args)}`;
    append(`${channel}.log`, line);
    if (level) append("errors.log", `${t} [${channel}] ${tag}${text(args)}`);
    if (level || CONSOLE.has("all") || CONSOLE.has(channel)) console.log(`${t} [${channel}] ${tag}${text(args)}`);
  };
  const log = (...args) => emit("", args);
  log.warn = (...args) => emit("warn", args);
  log.error = (...args) => emit("error", args);
  return log;
}

/** One JSON object per line in <channel>.jsonl, with an ISO timestamp. */
export function logJson(channel, obj) {
  append(`${channel}.jsonl`, JSON.stringify({ t: new Date().toISOString(), ...obj }));
}
