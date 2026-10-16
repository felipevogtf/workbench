// WorkAdventure bot: a headless Playwright browser that joins a room as a normal player, wanders, listens to the people
// near it (Whisper), answers with an LLM in the bubble chat and with a synthetic voice.
//
//   config.mjs     .env + every setting            logger.mjs     logs/<run>/<channel>.log
//   identity.mjs   name, gender, voice, prompt     state.mjs      state shared by the modules below
//   onboarding.mjs joins the room                  movement.mjs   wandering, zones, "someone is near"
//   hearing.mjs    audio -> VAD -> Whisper         chat.mjs       chat loop, LLM, speaking, latency log
//   brain.mjs      LLM (Copilot CLI)               voice.mjs      text-to-speech + virtual mic + audio tap
import { chromium } from "playwright";
import { cfg, describeConfig, ENV_FILE_LOADED } from "./config.mjs";
import { logger, LOG_DIR, RUN_ID } from "./logger.mjs";
import { VOICES, MIC_INIT_SCRIPT, LISTEN_INIT_SCRIPT } from "./voice.mjs";
import { createIdentity } from "./identity.mjs";
import { startHearing } from "./hearing.mjs";
import { createMovement } from "./movement.mjs";
import { joinRoom } from "./onboarding.mjs";
import { startChat } from "./chat.mjs";

const log = logger("system");

if (!cfg.mapUrl) {
  console.error("Set WA_MAP_URL (in .env or the shell) to the room URL, e.g. https://play.example.com/_/global/host/map.json");
  process.exit(1);
}
log(`run ${RUN_ID}, logs in ${LOG_DIR}${ENV_FILE_LOADED ? ", settings from .env" : ", no .env file"}`);
log("settings:", describeConfig() || "(defaults)");

const identity = createIdentity(VOICES);

const browser = await chromium.launch({
  headless: !cfg.headed,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  permissions: cfg.voice ? ["microphone"] : [],
});
// No real camera/mic: with voice the page gets a virtual mic fed by the TTS, without it, nothing.
if (cfg.voice) await context.addInitScript(MIC_INIT_SCRIPT);
if (cfg.listen) {
  await context.addInitScript((o) => { window.__tapOpts = o; }, cfg.tap);
  await context.addInitScript(LISTEN_INIT_SCRIPT);
}
const page = await context.newPage();
page.on("pageerror", (e) => log.error("pageerror:", e.message));

const movement = createMovement(page);
const hearing = cfg.listen ? await startHearing(page) : null;

await joinRoom(page, identity, hearing);

let stopping = false;
async function shutdown(why) {
  stopping = true; // the loops below fail once the browser closes; that is expected from here on
  log(`shutting down (${why})`);
  hearing?.printVariantSummary();
  await browser.close().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", () => shutdown("Ctrl+C"));
if (cfg.runSeconds) {
  setTimeout(async () => {
    await page.screenshot({ path: cfg.shot.replace(/\.png$/, "-end.png") }).catch(() => {});
    shutdown(`RUN_SECONDS=${cfg.runSeconds}`);
  }, cfg.runSeconds * 1000);
}

// Anything that escapes the loops goes to errors.log before the process dies.
process.on("unhandledRejection", (e) => { if (!stopping) log.error("unhandled rejection:", e?.stack ?? e); });
await Promise.all([cfg.wander ? movement.wander() : null, startChat(page, identity)]).catch((e) => {
  if (stopping) return; // closed on purpose (Ctrl+C or RUN_SECONDS); shutdown() exits the process
  log.error("fatal:", e?.stack ?? e);
  process.exit(1);
});
