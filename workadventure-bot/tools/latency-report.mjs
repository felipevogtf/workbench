// Latency summary of a run: npm run latency  (latest run)  |  node tools/latency-report.mjs <run folder or run id>
import "../src/config.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PATHS } from "../src/config.mjs";
import { STAGES, summarize } from "../src/latency.mjs";

const arg = process.argv[2];
let dir;
if (arg) dir = existsSync(arg) ? resolve(arg) : join(PATHS.logs, arg);
else {
  const runs = existsSync(PATHS.logs) ? readdirSync(PATHS.logs).filter((d) => existsSync(join(PATHS.logs, d, "latency.jsonl"))).sort() : [];
  if (!runs.length) {
    console.log("No latency.jsonl found in", PATHS.logs, "- talk to the bot first.");
    process.exit(1);
  }
  dir = join(PATHS.logs, runs.at(-1));
}
const file = join(dir, "latency.jsonl");
if (!existsSync(file)) {
  console.log("No latency.jsonl in", dir);
  process.exit(1);
}
const records = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const ok = records.filter((r) => !r.error);
const fmt = (ms) => (ms == null ? "    -" : (ms / 1000).toFixed(1).padStart(5));

console.log(`Run ${dir}\n${records.length} turns (${records.length - ok.length} without reply)\n`);
console.log("turn source       chat voice | wait  stt  llm  tts | text");
for (const r of records) {
  console.log(
    `${String(r.turn).padStart(4)} ${String(r.source ?? "").padEnd(11)} ${fmt(r.chat_ms)} ${fmt(r.voice_ms)} |${fmt(r.wait_ms)}${fmt(r.stt_ms)}${fmt(r.llm_ms)}${fmt(r.tts_ms)} | ${r.error ? "ERROR " + r.error + ": " : ""}${(r.text ?? "").slice(0, 50)}`,
  );
}
const stats = summarize(ok);
console.log("\nstage                          n    min    p50    p90    max   (seconds)");
for (const [key, label] of STAGES) {
  const s = stats[key];
  if (s) console.log(`${label.padEnd(28)} ${String(s.n).padStart(3)} ${fmt(s.min)}  ${fmt(s.p50)}  ${fmt(s.p90)}  ${fmt(s.max)}`);
}
