// Dropout analysis of saved segments: node tools/analyze-audio.mjs [out/debug-audio]. Shows holes (digital silence) per segment and per capture variant.
import { readdirSync, readFileSync } from "node:fs";
const dir = process.argv[2] ?? "out/debug-audio";
const rows = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".wav")).sort()) {
  const b = readFileSync(`${dir}/${f}`);
  const n = (b.length - 44) / 2;
  const s = new Int16Array(b.buffer.slice(b.byteOffset + 44, b.byteOffset + 44 + n * 2));
  // 10 ms windows (160 samples): count windows that are digital silence while neighbours are speech
  const W = 160, nw = Math.floor(n / W);
  const rms = new Float32Array(nw), zero = new Uint8Array(nw);
  for (let w = 0; w < nw; w++) {
    let sum = 0, nz = 0;
    for (let j = 0; j < W; j++) { const v = s[w * W + j]; sum += v * v; if (v !== 0) nz++; }
    rms[w] = Math.sqrt(sum / W) / 32768; zero[w] = nz < 4 ? 1 : 0;
  }
  // speech region = windows between first and last with rms>0.02
  let a = rms.findIndex((r) => r > 0.02), z = nw - 1 - [...rms].reverse().findIndex((r) => r > 0.02);
  let holes = 0, holeWin = 0, runs = [];
  for (let w = Math.max(a, 0); w <= z; ) {
    if (zero[w]) { let e = w; while (e <= z && zero[e]) e++; runs.push(e - w); holes++; holeWin += e - w; w = e; } else w++;
  }
  const span = Math.max(1, z - a + 1);
  // block pattern 256 ms
  let pat = "";
  for (let i = 0; i + 4096 <= n; i += 4096) { let nz = 0, sum = 0; for (let j = 0; j < 4096; j++) { const v = s[i + j]; sum += v * v; if (v) nz++; } pat += nz < 80 ? "0" : Math.sqrt(sum / 4096) / 32768 > 0.01 ? "S" : "n"; }
  const txt = readFileSync(`${dir}/${f.replace(".wav", ".txt")}`, "utf8").split("\n").slice(1).join(" ").trim();
  rows.push({ f, dur: (n / 16000).toFixed(1), holes, holePct: ((100 * holeWin) / span).toFixed(1), maxRun: Math.max(0, ...runs) * 10, pat, txt: txt.slice(0, 90) });
}
for (const r of rows) console.log(`${r.f.padEnd(26)} ${r.dur.padStart(5)}s holes=${String(r.holes).padStart(3)} (${r.holePct.padStart(4)}% of speech, longest ${r.maxRun} ms) ${r.pat} | ${r.txt}`);
const byVar = {};
for (const r of rows) { const v = r.f.replace(/^\d+-/, "").replace(".wav", ""); (byVar[v] ??= []).push(r); }
console.log("\nPer variant:");
for (const [v, rs] of Object.entries(byVar)) console.log(v.padEnd(18), rs.length, "segments, avg holes/segment", (rs.reduce((a, r) => a + r.holes, 0) / rs.length).toFixed(1), ", avg hole% ", (rs.reduce((a, r) => a + Number(r.holePct), 0) / rs.length).toFixed(1));
