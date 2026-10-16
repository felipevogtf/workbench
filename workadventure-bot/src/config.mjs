// Central settings. Loads .env first (variables already set in the shell win over the file), then exposes every option
// of the bot in one place. Every module that reads process.env imports this file before anything else.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const envFile = process.env.WA_ENV_FILE ?? join(ROOT, ".env");
export const ENV_FILE_LOADED = existsSync(envFile);
if (ENV_FILE_LOADED) process.loadEnvFile(envFile);

export const PATHS = {
  root: ROOT,
  config: join(ROOT, "config"),
  logs: process.env.WA_LOG_DIR ?? join(ROOT, "logs"),
  out: join(ROOT, "out"),
  piper: join(ROOT, "piper"),
  voiceFixtures: join(ROOT, "test", "fixtures", "voice"),
};


const flag = (name, dflt) => (process.env[name] === undefined ? dflt : process.env[name] === "1");
const num = (name, dflt) => (process.env[name] === undefined ? dflt : Number(process.env[name]));

// "rate=0,variant=own-audible-keep" -> { rate: 0, variant: "own-audible-keep" }
const parseTap = (s) =>
  Object.fromEntries(s.split(",").filter(Boolean).map((kv) => kv.split("=")).map(([k, v]) => [k, k === "rate" ? Number(v) : v]));

export const cfg = {
  mapUrl: process.env.WA_MAP_URL,
  gender: ["mujer", "hombre"].includes(process.env.WA_GENDER) ? process.env.WA_GENDER : null, // null = random
  botName: process.env.WA_BOT_NAME ?? null, // null = random name + "IA" tag
  randomSkin: process.env.WA_RANDOM_SKIN !== "0",
  headed: flag("HEADED", false),
  wander: process.env.WANDER !== "0",
  runSeconds: num("RUN_SECONDS", 0), // 0 = run until Ctrl+C
  voice: process.env.WA_VOICE !== "0",
  listen: process.env.WA_VOICE !== "0" && process.env.WA_LISTEN !== "0",
  voiceName: process.env.WA_VOICE_NAME ?? null, // null = the character's voice
  filler: process.env.WA_FILLER === "1", // off by default: "mmm, a ver" while the LLM thinks
  mapCollisions: process.env.WA_MAP !== "0", // read the room map to avoid walls and furniture
  mapFurniture: process.env.WA_MAP_FURNITURE !== "0", // ...including the collision grids of the furniture
  bargeIn: process.env.WA_BARGE_IN !== "0", // the person can interrupt the bot by talking over it
  bargeInRms: num("WA_BARGE_IN_RMS", 0.04), // level that counts as talking over it
  echoTailMs: num("WA_ECHO_TAIL_MS", 1200), // audio ignored this long after the bot stops (its echo comes back)
  chatPollMs: num("WA_CHAT_POLL_MS", 600), // how often the chat loop looks for something new
  zonesFile: process.env.WA_ZONES ?? join(PATHS.config, "zones.json"),
  charactersFile: join(PATHS.config, "characters.json"),
  posLog: flag("WA_POS_LOG", false),
  chatMsgSelector: process.env.WA_CHAT_MSG_SELECTOR ?? ".message-bubble",
  chatInputSelector: process.env.WA_CHAT_INPUT_SELECTOR ?? "div.message-input",
  // audio capture experiments
  tap: parseTap(process.env.WA_TAP ?? ""),
  debugAudio: flag("WA_DEBUG_AUDIO", false),
  tapCycle: process.env.WA_TAP_CYCLE ? process.env.WA_TAP_CYCLE === "1" : flag("WA_DEBUG_AUDIO", false),
  selfTest: flag("WA_SELFTEST", false),
  vadEndMs: num("WA_VAD_END_MS", 1100),
  // outputs
  shot: process.env.SHOT ?? join(PATHS.out, "bot.png"),
};

/** Human readable list of the options that differ from the defaults, written to the run's system log. */
export function describeConfig() {
  return Object.entries(process.env)
    .filter(([k]) => /^(WA_|HEADED$|WANDER$|RUN_SECONDS$|SHOT$|COPILOT_JS$)/.test(k) && k !== "WA_MAP_URL")
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join(" ");
}
