// Prints the room's walls (#), furniture (f) and named areas: node tools/show-map.mjs [room url]   (default: WA_MAP_URL)
import "../src/config.mjs";
import { cfg } from "../src/config.mjs";
import { loadMap } from "../src/map.mjs";

const url = process.argv[2] ?? cfg.mapUrl;
if (!url) {
  console.error("Pass a room url or set WA_MAP_URL");
  process.exit(1);
}
const map = await loadMap(url, { useEntities: cfg.mapFurniture, onWarn: (w) => console.warn("warning:", w) });
if (!map) {
  console.error("Could not read the map of", url);
  process.exit(1);
}
console.log(`${map.width}x${map.height} tiles, ${map.stats.walls} wall tiles, ${map.stats.furniture} furniture tiles (${map.source})\n`);
const cols = "0123456789".repeat(Math.ceil(map.width / 10)).slice(0, map.width);
console.log("    " + cols);
map.ascii().split("\n").forEach((row, y) => console.log(String(y).padStart(3) + " " + row));
console.log("\nareas (tile rectangles):");
for (const a of map.areas) console.log(`  ${a.name}  x ${a.x1}-${a.x2}, y ${a.y1}-${a.y2}`);
