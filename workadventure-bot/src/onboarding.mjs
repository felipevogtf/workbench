// Joining the room like a normal player: name screen, skin, camera/mic prompts, tutorial, unmute the virtual mic.
// Log: system.log. Selectors were inspected on play.workadventu.re; if WorkAdventure changes its UI, look here first.
import { join } from "node:path";
import { cfg, PATHS } from "./config.mjs";
import { logger } from "./logger.mjs";

const log = logger("system");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NEXT = /^\s*(continuar|continue|entrar|enter|siguiente|next|ok|join|unirse|guardar|save)\s*$/i;

/** 1) Name screen. Retries a few times: the page can be slow, and on failure it keeps a screenshot and the visible text. */
async function enterName(page, name) {
  for (let attempt = 1; ; attempt++) {
    try {
      await page.waitForSelector('input[name="fname"]', { timeout: 25000 });
      break;
    } catch (e) {
      const text = await page.evaluate(() => document.body.innerText.slice(0, 300).replace(/\s+/g, " ")).catch(() => "?");
      log.error(`name screen not found (attempt ${attempt}) url=${page.url()} text="${text}"`);
      await page.screenshot({ path: join(PATHS.out, `bot-error-${attempt}.png`) }).catch(() => {});
      if (attempt >= 3) throw e;
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    }
  }
  await page.fill('input[name="fname"]', name);
  await page.click("form.loginScene button");
}

/** 2) Skin: one of the Wokas that match the bot's gender (indexes in config/characters.json, in the order of the thumbnail grid). */
async function pickSkin(page, identity) {
  const count = () => page.evaluate(() => [...document.querySelectorAll("button")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 60 && r.width < 100 && r.height > 60 && r.height < 100; }).length);
  for (let i = 0; i < 15 && (await count().catch(() => 0)) < 24; i++) await sleep(1000);
  const index = identity.pickSkin();
  const clicked = await page
    .evaluate((n) => {
      const btns = [...document.querySelectorAll("button")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 60 && r.width < 100 && r.height > 60 && r.height < 100; });
      if (!btns[n]) return false;
      btns[n].scrollIntoView({ block: "center" });
      btns[n].click();
      return true;
    }, index)
    .catch(() => false);
  if (clicked) log(`skin ${index} picked (${identity.gender})`);
  else {
    const dice = page.getByRole("button", { name: /aleatoriamente|randomly|random/i }).first();
    if (await dice.isVisible().catch(() => false)) await dice.click();
    log.warn("skin grid not found, picked a random one");
  }
  await sleep(500);
}

/** The mic toggle is in the top bar (1280 px viewport, chat panel still closed); its button has "bg-danger" while muted. */
async function unmuteMic(page) {
  // WorkAdventure asks for a camera and starts with the mic muted: go on without camera, then unmute the mic.
  const noCam = page.getByRole("button", { name: /continuar sin c|continue without/i });
  if (await noCam.isVisible().catch(() => false)) await noCam.click({ timeout: 3000 }).catch(() => {});
  await sleep(1000);
  // Verify through the button state and retry, because a blind click can land on a modal or toggle it the wrong way.
  const micOn = () =>
    page
      .evaluate(() => {
        const btn = document.elementFromPoint(436, 47)?.closest("button");
        return !!btn && !btn.className.includes("bg-danger");
      })
      .catch(() => false);
  for (let i = 0; i < 3 && !(await micOn()); i++) {
    await page.mouse.click(436, 47);
    await sleep(2000);
  }
  if (await micOn()) log("mic ON (unmuted)");
  else log.warn("mic still OFF - others will not hear the bot");
}

/** Everything from opening the URL until the bot stands in the game. `hearing` is optional (self-test). */
export async function joinRoom(page, identity, hearing) {
  log("opening", cfg.mapUrl, "as", identity.name, `(${identity.gender})`, cfg.voice ? "voice " + identity.voiceName : "no voice");
  await page.goto(cfg.mapUrl, { waitUntil: "domcontentloaded" });
  await enterName(page, identity.name);
  if (cfg.randomSkin) await pickSkin(page, identity);

  // 3) Click through the remaining screens (woka, camera...) until the game canvas is up. Matched by label (selectors unverified).
  let idle = 0;
  for (let i = 0; i < 20 && idle < 3; i++) {
    const btn = page.getByRole("button", { name: NEXT }).first();
    if (await btn.isVisible().catch(() => false)) {
      idle = 0;
      log("click:", (await btn.innerText().catch(() => "?")).trim());
      await btn.click().catch(() => {});
    } else idle++;
    await sleep(1500);
  }
  await page.waitForSelector("canvas", { timeout: 30000 });
  await sleep(3000);
  // In-game welcome tutorial grabs the keyboard; skip it if present.
  const skip = page.getByText(/saltar tutorial|skip tutorial/i).first();
  if (await skip.isVisible().catch(() => false)) {
    log("skipping tutorial");
    await skip.click().catch(() => {});
    await sleep(1000);
  }
  if (cfg.voice) {
    await unmuteMic(page);
    if (cfg.selfTest && cfg.listen && hearing) await hearing.runSelfTest();
  }
  await page.screenshot({ path: cfg.shot });
  log("in game, screenshot ->", cfg.shot);
}
