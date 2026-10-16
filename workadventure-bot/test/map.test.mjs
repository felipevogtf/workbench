// Map parsing with tiny hand-made files: no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.WA_ENV_FILE = join(mkdtempSync(join(tmpdir(), "wa-map-")), "none.env");
process.env.WA_LOG_FILES = "0";
const { parseTmj, areasToTiles, findPrefab, applyEntities, loadMap } = await import("../src/map.mjs");

// 4x3 map; the walls are the top row and tile (3,1)
const tmj = {
  width: 4, height: 3, tilewidth: 32,
  layers: [
    { type: "tilelayer", name: "floor", data: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5] },
    { type: "group", name: "g", layers: [{ type: "tilelayer", name: "collisions", data: [1, 1, 1, 1, 0, 0, 0, 7, 0, 0, 0, 0] }] },
  ],
};

test("walls come from the collisions layer, also inside groups; other layers are ignored", () => {
  const g = parseTmj(tmj);
  assert.equal(g.layers, 1);
  assert.deepEqual([...g.walls], [1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0]);
});

test("a layer with the Tiled property collides=true also counts", () => {
  const g = parseTmj({ width: 2, height: 1, layers: [{ type: "tilelayer", name: "solid", properties: [{ name: "collides", value: true }], data: [0, 3] }] });
  assert.deepEqual([...g.walls], [0, 1]);
});

test("base64 layers without compression are decoded", () => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(0, 0);
  b.writeUInt32LE(9, 4);
  const g = parseTmj({ width: 2, height: 1, layers: [{ type: "tilelayer", name: "collisions", encoding: "base64", data: b.toString("base64") }] });
  assert.deepEqual([...g.walls], [0, 1]);
});

test("areas become tile rectangles rounded outwards, with a readable name", () => {
  const [a, b, c] = areasToTiles([
    { name: "Recepción", x: 40, y: 70, width: 100, height: 20, properties: [] },
    { name: "", x: 0, y: 0, width: 64, height: 32, properties: [{ type: "areaDescriptionProperties" }, { type: "silent" }] },
    { x: 32, y: 32, width: 32, height: 32 },
  ]);
  assert.deepEqual(a, { name: "Recepción", named: true, x1: 1, y1: 2, x2: 4, y2: 2 }); // x 40..140 -> tiles 1..4, y 70..90 -> tile 2
  assert.equal(b.name, "(silent)");
  assert.equal(b.named, false);
  assert.deepEqual([b.x2, b.y2], [1, 0]);
  assert.deepEqual([c.x1, c.y1, c.x2, c.y2], [1, 1, 1, 1]);
});

const collections = [{ collectionName: "Office", collection: [{ name: "Desk", direction: "Down", color: "#aaa", collisionGrid: [[1, 1], [0, 0]] }, { name: "Plant", direction: "Down" }] }];

test("a prefab is found by name and direction whatever its color", () => {
  assert.equal(findPrefab(collections, { id: "Office:Desk:#ffffff:Down", collectionName: "Office" }).name, "Desk");
  assert.equal(findPrefab(collections, { id: "Office:Nope:#fff:Down", collectionName: "Office" }), null);
});

test("furniture marks the tiles of its collision grid, never over walls or outside the map", () => {
  const g = parseTmj(tmj);
  // desk at pixel (64, 32) -> tile (2,1): grid row 0 = tiles (2,1) and (3,1); (3,1) is already a wall. Row 1 is free.
  const n = applyEntities(g, { d: { x: 64, y: 32, prefabRef: { id: "Office:Desk:#c:Down", collectionName: "Office" } }, p: { x: 0, y: 0, prefabRef: { id: "Office:Plant:#c:Down", collectionName: "Office" } } }, collections);
  assert.equal(n, 1);
  assert.equal(g.walls[1 * 4 + 2], 2);
  assert.equal(g.walls[1 * 4 + 3], 1); // stays a wall
  assert.equal(g.walls[2 * 4 + 2], 0);
});

const cacheDir = mkdtempSync(join(tmpdir(), "wa-map-cache-"));
const wam = { mapUrl: "map.tmj", areas: [{ name: "Sala", x: 32, y: 32, width: 64, height: 32 }], entities: { d: { x: 64, y: 32, prefabRef: { id: "Office:Desk:#c:Down", collectionName: "Office" } } }, entityCollections: [{ type: "file", url: "https://c.test/office.json" }] };
const responses = {
  "https://play.test/map?playUri=https%3A%2F%2Fplay.test%2F%40%2Forg%2Fworld%2Froom": { wamUrl: "https://maps.test/room.wam" },
  "https://maps.test/room.wam": wam,
  "https://maps.test/map.tmj": tmj,
  "https://c.test/office.json": collections[0],
};
const fetchJson = async (url) => {
  if (!(url in responses)) throw new Error(`${url} answered 404`);
  return responses[url];
};

test("loadMap follows room -> wam -> tmj and answers blocked() and areaAt() in tiles", async () => {
  const map = await loadMap("https://play.test/@/org/world/room", { fetchJson, cacheDir });
  assert.equal(map.source, "downloaded");
  assert.deepEqual(map.stats, { walls: 5, furniture: 1 });
  assert.equal(map.blocked(0, 0), true); // wall
  assert.equal(map.blocked(2, 1), true); // furniture
  assert.equal(map.blocked(1, 2), false); // free
  assert.equal(map.blocked(-1, 0), true); // outside the map
  assert.equal(map.blocked(4, 0), true);
  assert.equal(map.areaAt(1, 1).name, "Sala");
  assert.equal(map.areaAt(0, 0), null);
});

test("useEntities=false reads the walls only", async () => {
  const map = await loadMap("https://play.test/@/org/world/room2", { fetchJson: async (u) => fetchJson(u.replace("room2", "room")), useEntities: false, cacheDir });
  assert.equal(map.stats.furniture, 0);
  assert.equal(map.blocked(2, 1), false);
});

test("a failing download resolves to null with a warning instead of throwing", async () => {
  const warnings = [];
  const map = await loadMap("https://nowhere.test/@/a/b/c", { fetchJson, cacheDir, onWarn: (w) => warnings.push(w) });
  assert.equal(map, null);
  assert.match(warnings[0], /could not read the map/);
});

test("a second load uses the cache, and the cache is the fallback when the network fails", async () => {
  let calls = 0;
  const counting = async (u) => (calls++, fetchJson(u));
  const again = await loadMap("https://play.test/@/org/world/room", { fetchJson: counting, cacheDir });
  assert.equal(calls, 0);
  assert.match(again.source, /^cache/);
  assert.equal(again.blocked(2, 1), true);
  assert.equal(again.areaAt(1, 1).name, "Sala");
});
