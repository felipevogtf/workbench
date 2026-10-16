// The room's map: which tiles are blocked (walls from the "collisions" layer, furniture from the entities' collision grids)
// and where the named areas are. Read from the same files the game client downloads, no login needed:
//   <play server>/map?playUri=<room url>  ->  { wamUrl | mapUrl }
//   .wam (map editor file)                ->  { mapUrl (the .tmj), areas, entities, entityCollections }
//   .tmj (Tiled map)                      ->  tile layers, the one called "collisions" has the walls
// Everything is in tiles (tx, ty), like the position tracker. Returns null when the map can't be read; the bot then works as before.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "./config.mjs";

const CACHE_DIR = join(PATHS.out, "map");
const CACHE_MAX_AGE_MS = 24 * 3600 * 1000;

const flat = (layers) => layers.flatMap((l) => (l.layers ? flat(l.layers) : [l]));
const prop = (layer, name) => (layer.properties ?? []).find((p) => p.name === name)?.value;

/** Tile ids of a Tiled tile layer as an array (plain arrays, or base64 without compression); null if unsupported. */
function layerData(layer) {
  if (Array.isArray(layer.data)) return layer.data;
  if (typeof layer.data === "string" && layer.encoding === "base64" && !layer.compression) {
    const b = Buffer.from(layer.data, "base64");
    return Array.from({ length: b.length / 4 }, (_, i) => b.readUInt32LE(i * 4));
  }
  return null;
}

/** Walls: every non-empty tile of the layers called "collisions" (or with the Tiled property collides=true). */
export function parseTmj(tmj) {
  const { width, height } = tmj;
  const walls = new Uint8Array(width * height);
  let layers = 0;
  for (const layer of flat(tmj.layers ?? [])) {
    if (layer.type !== "tilelayer") continue;
    if (layer.name !== "collisions" && prop(layer, "collides") !== true) continue;
    const data = layerData(layer);
    if (!data) continue;
    layers++;
    data.forEach((id, i) => { if (id) walls[i] = 1; });
  }
  return { width, height, tile: tmj.tilewidth ?? 32, walls, layers };
}

/** Pixel rectangles of the .wam areas -> tile rectangles (rounded outwards) with a readable name. */
export function areasToTiles(areas, tile = 32) {
  return (areas ?? []).map((a) => {
    const kinds = (a.properties ?? []).map((p) => p.type).filter((t) => t && t !== "areaDescriptionProperties");
    return {
      name: (a.name ?? "").trim() || (kinds.length ? `(${kinds.join("+")})` : "(area)"),
      named: !!(a.name ?? "").trim(),
      x1: Math.floor(a.x / tile),
      y1: Math.floor(a.y / tile),
      x2: Math.ceil((a.x + a.width) / tile) - 1,
      y2: Math.ceil((a.y + a.height) / tile) - 1,
    };
  });
}

/** Prefab ids look like "<collection>:<name>:<color>:<direction>"; the collision grid is the same for every color. */
export function findPrefab(collections, ref) {
  const [collectionName, name, , direction] = ref.id.split(":");
  const c = collections.find((x) => x.collectionName === (ref.collectionName ?? collectionName));
  return c?.collection?.find((p) => p.name === name && p.direction === direction) ?? c?.collection?.find((p) => p.name === name) ?? null;
}

/** Marks the tiles covered by the collision grids of the placed entities (grid origin = top-left of the entity). */
export function applyEntities(grid, entities, collections, tile = 32) {
  let count = 0;
  for (const e of Object.values(entities ?? {})) {
    const prefab = e.prefabRef ? findPrefab(collections, e.prefabRef) : null;
    const g = prefab?.collisionGrid;
    if (!g) continue;
    const tx0 = Math.floor(e.x / tile), ty0 = Math.floor(e.y / tile);
    g.forEach((row, r) => row.forEach((v, c) => {
      const x = tx0 + c, y = ty0 + r;
      if (v && x >= 0 && y >= 0 && x < grid.width && y < grid.height && !grid.walls[y * grid.width + x]) {
        grid.walls[y * grid.width + x] = 2; // 2 = furniture
        count++;
      }
    }));
  }
  return count;
}

function build({ width, height, tile, walls, areas, stats, source }) {
  const inside = (tx, ty) => tx >= 0 && ty >= 0 && tx < width && ty < height;
  return {
    width, height, tile, areas, stats, source,
    /** true for walls, furniture and everything outside the map */
    blocked: (tx, ty) => !inside(tx, ty) || walls[ty * width + tx] !== 0,
    /** the first area that contains the tile, or null */
    areaAt: (tx, ty) => areas.find((a) => tx >= a.x1 && tx <= a.x2 && ty >= a.y1 && ty <= a.y2) ?? null,
    ascii: () => Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => (walls[y * width + x] === 1 ? "#" : walls[y * width + x] === 2 ? "f" : ".")).join("")).join("\n"),
    walls,
  };
}

const cachePath = (playUri, dir = CACHE_DIR) => join(dir, playUri.replace(/[^a-z0-9]+/gi, "_").slice(0, 120) + ".json");

function readCache(playUri, maxAge, dir) {
  try {
    const c = JSON.parse(readFileSync(cachePath(playUri, dir), "utf8"));
    if (Date.now() - c.fetchedAt > maxAge) return null;
    return build({ ...c, walls: Uint8Array.from(Buffer.from(c.walls, "base64")), source: `cache (${Math.round((Date.now() - c.fetchedAt) / 60000)} min old)` });
  } catch {
    return null;
  }
}

/**
 * Downloads and parses the map of a room. `fetchJson` and `cacheDir` can be replaced in tests. `useEntities=false` ignores furniture.
 * Resolves to null (never throws) when anything fails and there is no usable cache.
 */
export async function loadMap(playUri, { fetchJson = defaultFetchJson, useEntities = true, onWarn = () => {}, cacheDir = CACHE_DIR } = {}) {
  const fresh = readCache(playUri, CACHE_MAX_AGE_MS, cacheDir);
  if (fresh) return fresh;
  try {
    const info = await fetchJson(`${new URL(playUri).origin}/map?playUri=${encodeURIComponent(playUri)}`);
    let wam = null, tmjUrl;
    if (info.wamUrl) {
      wam = await fetchJson(info.wamUrl);
      tmjUrl = new URL(wam.mapUrl, info.wamUrl).href;
    } else if (info.mapUrl) tmjUrl = new URL(info.mapUrl, playUri).href;
    else throw new Error("the server answered without wamUrl or mapUrl");
    const grid = parseTmj(await fetchJson(tmjUrl));
    if (!grid.layers) onWarn("the map has no readable collisions layer: every tile counts as free");
    let entityTiles = 0;
    if (wam && useEntities) {
      const collections = [];
      for (const c of wam.entityCollections ?? []) {
        if (c.type !== "file") continue;
        try { collections.push(await fetchJson(c.url)); } catch (e) { onWarn(`entity collection ${c.url}: ${e.message}`); }
      }
      entityTiles = applyEntities(grid, wam.entities, collections, grid.tile);
    }
    const areas = areasToTiles(wam?.areas, grid.tile);
    const wallTiles = grid.walls.reduce((n, v) => n + (v === 1 ? 1 : 0), 0);
    try {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(cachePath(playUri, cacheDir), JSON.stringify({ fetchedAt: Date.now(), width: grid.width, height: grid.height, tile: grid.tile, walls: Buffer.from(grid.walls).toString("base64"), areas, stats: { walls: wallTiles, furniture: entityTiles } }));
    } catch {}
    return build({ ...grid, areas, stats: { walls: wallTiles, furniture: entityTiles }, source: "downloaded" });
  } catch (e) {
    onWarn(`could not read the map (${e.message})`);
    return readCache(playUri, Infinity, cacheDir);
  }
}

async function defaultFetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}
