// Player position, read from the WebSocket messages WorkAdventure's own client sends when it moves.
// Observed frame shape (protobuf): 2 -> 2 -> 1 -> { 1: x px, 2: y px, 3: direction, 4: moving }.

function* fields(buf) {
  let i = 0;
  const varint = () => {
    let r = 0, mul = 1;
    for (;;) {
      if (i >= buf.length) throw new Error("eof");
      const c = buf[i++];
      r += (c & 127) * mul;
      if (!(c & 128)) return r;
      mul *= 128;
    }
  };
  while (i < buf.length) {
    const tag = varint();
    const field = Math.floor(tag / 8), wire = tag % 8;
    if (wire === 0) yield [field, varint()];
    else if (wire === 2) {
      const n = varint();
      yield [field, buf.subarray(i, i + n)];
      i += n;
    } else if (wire === 5) i += 4;
    else if (wire === 1) i += 8;
    else throw new Error("bad wire type");
  }
}
const sub = (buf, field) => {
  for (const [f, v] of fields(buf)) if (f === field && typeof v !== "number") return v;
  return null;
};

export function decodePosition(buf) {
  try {
    const pos = [2, 2, 1].reduce((b, f) => (b ? sub(b, f) : null), buf);
    if (!pos) return null;
    let x, y;
    for (const [f, v] of fields(pos)) {
      if (f === 1) x = v;
      if (f === 2) y = v;
    }
    return x === undefined || y === undefined ? null : { x, y };
  } catch {
    return null;
  }
}

// Attach before navigating. `tracker.pos` is the last known position in pixels, or null if the bot has not moved yet.
export function trackPosition(page, tile = 32) {
  const tracker = { pos: null, tile, get tx() { return this.pos && Math.floor(this.pos.x / tile); }, get ty() { return this.pos && Math.floor(this.pos.y / tile); } };
  page.on("websocket", (ws) =>
    ws.on("framesent", (f) => {
      if (!Buffer.isBuffer(f.payload)) return;
      const p = decodePosition(f.payload);
      if (p) tracker.pos = p;
    }),
  );
  return tracker;
}

// zones.json: { "tile": 32, "blocked": [{ "name": "...", "x1": 40, "y1": 10, "x2": 55, "y2": 20 }], "home": { "x": 35, "y": 21, "radius": 12 } }
// Coordinates are tiles; rectangles include both corners. `margin` widens the blocked rectangles.
export function insideBlocked(zones, tx, ty, margin = 0) {
  return (zones.blocked ?? []).find((z) => tx >= z.x1 - margin && tx <= z.x2 + margin && ty >= z.y1 - margin && ty <= z.y2 + margin) ?? null;
}
export function outsideHome(zones, tx, ty) {
  const h = zones.home;
  return !!h && Math.max(Math.abs(tx - h.x), Math.abs(ty - h.y)) > h.radius;
}
