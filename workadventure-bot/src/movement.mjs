// Movement: wander around with the arrow keys, keep out of the forbidden zones, stand still while someone is near.
// Log: movement.log.
import { existsSync, readFileSync } from "node:fs";
import { cfg } from "./config.mjs";
import { logger } from "./logger.mjs";
import { state } from "./state.mjs";
import { trackPosition, insideBlocked, outsideHome } from "./position.mjs";
import { loadMap } from "./map.mjs";

const log = logger("movement");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DIRS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/** Call right after the page is created (it listens to the game's WebSocket from the start). */
export function createMovement(page) {
  // Zones the bot must not enter (config/zones.json, in tiles) and its position, read from the game's own movement messages.
  const zones = existsSync(cfg.zonesFile) ? JSON.parse(readFileSync(cfg.zonesFile, "utf8")) : {};
  const tracker = trackPosition(page, zones.tile ?? 32);
  log(`zones: ${(zones.blocked ?? []).map((z) => z.name).join(", ") || "none"}${zones.home ? `, home radius ${zones.home.radius}` : ""}`);
  // The room map (walls, furniture, named areas) downloads in the background while the bot joins; null = unknown, the bot walks as before.
  let map = null;
  const mapReady = !cfg.mapCollisions
    ? Promise.resolve()
    : loadMap(cfg.mapUrl, { useEntities: cfg.mapFurniture, onWarn: (w) => log.warn("map:", w) }).then((loaded) => {
        map = loaded;
        if (!map) return log.warn("map: not available, walking without it");
        const named = map.areas.filter((a) => a.named).length;
        log(`map (${map.source}): ${map.width}x${map.height} tiles, ${map.stats.walls} wall tiles + ${map.stats.furniture} furniture tiles, ${map.areas.length} areas (${named} named)`);
        let inArea = null;
        setInterval(() => {
          if (!tracker.pos) return;
          const a = map.areaAt(tracker.tx, tracker.ty);
          if (a !== inArea) log(a ? `entered area ${a.name} at tile ${tracker.tx},${tracker.ty}` : `left area ${inArea.name}`);
          inArea = a;
        }, 500);
      });

  // Every tile the bot steps on (WA_POS_LOG=1). Also the picker mode to read coordinates for zones.json.
  if (cfg.posLog) {
    let last = "";
    setInterval(() => {
      const now = tracker.pos ? `${tracker.tx},${tracker.ty}` : "";
      if (now && now !== last) log(`position: tile x=${tracker.tx} y=${tracker.ty}`);
      last = now;
    }, 300);
  }

  // Someone is near when the bubble chat no longer shows its "get closer to someone" hint.
  // After a conversation the chat keeps its history and never shows that hint again, so the last system line
  // ("X ha dejado la conversación") also counts: if the bubble ended and nobody has talked for 20 s, the bot is free.
  let wasNear = false; // result of the previous someoneNear() check
  let alone = true; // the "get closer to someone" hint was showing at the last check
  let bubbleSince = 0; // when the current bubble opened
  async function someoneNear() {
    if (!state.chatReady) return false;
    const hint = page.getByText(/acércate a alguien|get closer to someone/i).first();
    if (await hint.isVisible().catch(() => false)) {
      alone = true;
      if (wasNear) log("nobody is near anymore");
      wasNear = false;
      return false;
    }
    if (alone) {
      alone = false;
      bubbleSince = Date.now(); // the bubble just opened: give the person time to start talking
    }
    const system = await page.locator(".messageTextBody").allInnerTexts().catch(() => []);
    const ended = /ha dejado la conversaci|left the conversation/i.test(system.at(-1) ?? "");
    const now = Date.now();
    // Wait still while the bubble is fresh or someone talks; a silent bubble (another bot, someone AFK)
    // must not freeze the bot forever.
    const active = now - Math.max(state.lastLoud, state.lastChat, ended ? 0 : bubbleSince) < (ended ? 20000 : 30000);
    if (active !== wasNear) log(active ? "someone is near: standing still" : "nobody is talking: wandering again");
    wasNear = active;
    return active;
  }

  // Tile the bot would reach `n` tiles ahead in a direction, or null while its position is still unknown.
  const ahead = (k, n) => (tracker.pos ? [tracker.tx + DIRS[k][0] * n, tracker.ty + DIRS[k][1] * n] : null);
  // A wall or a piece of furniture within `n` tiles in a direction (needs the map).
  const solidAhead = (k, n) => !!map && [1, 2, 3].slice(0, n).some((i) => { const t = ahead(k, i); return !!t && map.blocked(t[0], t[1]); });
  // A direction is safe when 3 tiles ahead is neither a forbidden zone (with a 1 tile margin) nor outside the home area,
  // and there is no wall or furniture in the way.
  const safeDir = (k) => {
    const t = ahead(k, 3);
    return (!t || (!insideBlocked(zones, t[0], t[1], 1) && !outsideHome(zones, t[0], t[1]))) && !solidAhead(k, 3);
  };

  // Shortest way out: of a blocked rectangle through its nearest side, or back towards the home centre.
  function escapeDir() {
    const { tx, ty } = tracker;
    const z = insideBlocked(zones, tx, ty, 0);
    if (z) {
      const way = {
        ArrowLeft: tx - (z.x1 - 1),
        ArrowRight: z.x2 + 1 - tx,
        ArrowUp: ty - (z.y1 - 1),
        ArrowDown: z.y2 + 1 - ty,
      };
      return Object.entries(way).sort((a, b) => a[1] - b[1])[0][0];
    }
    const h = zones.home;
    const dx = h.x - tx, dy = h.y - ty;
    return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : dy > 0 ? "ArrowDown" : "ArrowUp";
  }

  // Wander: hold an arrow key for a random time, then switch direction.
  async function wander() {
    const keys = Object.keys(DIRS);
    await mapReady;
    log("wandering around (WA_POS_LOG=1 writes every tile it walks to)");
    let announced = false;
    while (true) {
      // Stay still while someone is in the bubble, so the conversation doesn't break.
      while (await someoneNear()) await sleep(1000);
      // If a text box still has the keyboard (the chat input after answering), the arrow keys would never reach the game.
      await page.evaluate(() => { const a = document.activeElement; if (a && a !== document.body && (a.isContentEditable || /^(INPUT|TEXTAREA)$/.test(a.tagName))) a.blur(); }).catch(() => {});

      // Already inside a forbidden zone (spawn, pushed...): walk out before wandering again.
      let guard = 0;
      while (tracker.pos && (insideBlocked(zones, tracker.tx, tracker.ty, 0) || outsideHome(zones, tracker.tx, tracker.ty)) && guard++ < 40) {
        const way = escapeDir();
        if (guard === 1) log(`outside the allowed area at tile ${tracker.tx},${tracker.ty}: walking out (${way})`);
        await page.keyboard.down(way);
        await sleep(250);
        await page.keyboard.up(way);
        await sleep(50);
      }

      if (!announced && tracker.pos) {
        announced = true;
        log(`first steps taken, now at tile ${tracker.tx},${tracker.ty}`);
      }
      const options = keys.filter(safeDir);
      const k = (options.length ? options : keys)[Math.floor(Math.random() * (options.length || keys.length))];
      await page.keyboard.down(k);
      const until = Date.now() + 400 + Math.random() * 1800;
      while (Date.now() < until && !(await someoneNear())) {
        // Stop at the edge of a blocked zone instead of walking into it.
        const next = ahead(k, 2); // 2 tiles: the position reported by the game lags a little behind the avatar
        if (next && (insideBlocked(zones, next[0], next[1], 0) || outsideHome(zones, next[0], next[1]))) {
          log(`stopped before a forbidden tile (${k}) at ${tracker.tx},${tracker.ty}`);
          break;
        }
        if (solidAhead(k, 2)) {
          log(`stopped before a wall or furniture (${k}) at ${tracker.tx},${tracker.ty}`);
          break;
        }
        await sleep(100);
      }
      await page.keyboard.up(k);
      await sleep(500 + Math.random() * 2000);
    }
  }

  return { wander, someoneNear, tracker, mapReady, getMap: () => map };
}
