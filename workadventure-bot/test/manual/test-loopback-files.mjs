import "../../src/config.mjs"; // loads .env
// Plays real recordings (test/fixtures/voice/N.m4a) through the bot's whole listening path: virtual mic -> WebRTC (Opus) ->
// tap -> VAD -> Whisper, and compares with what was really said (N.txt). Shows if the path itself degrades the speech.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { MIC_INIT_SCRIPT, LISTEN_INIT_SCRIPT } from "../../src/voice.mjs";
import { createSegmenter, transcribe } from "../../src/listen.mjs";

const DIR = process.env.WA_TEST_DIR ?? "test/fixtures/voice";
const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ\s]/g, " ").split(/\s+/).filter(Boolean);
function wer(ref, hyp) {
  const r = norm(ref), h = norm(hyp);
  if (!r.length) return null;
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) for (let j = 1; j <= h.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return d[r.length][h.length] / r.length;
}
const b = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ permissions: ["microphone"] });
await ctx.addInitScript(MIC_INIT_SCRIPT);
await ctx.addInitScript((o) => { window.__tapOpts = o; }, process.env.TAP ? JSON.parse(process.env.TAP) : {});
await ctx.addInitScript(LISTEN_INIT_SCRIPT);
const page = await ctx.newPage();
page.on("console", (m) => console.log("page:", m.type(), m.text().slice(0, 200)));
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 200)));
let heard = [], queue = Promise.resolve();
const feed = createSegmenter((samples) => {
  queue = queue.then(async () => { heard.push({ secs: samples.length / 16000, text: await transcribe(samples) }); });
});
await page.exposeFunction("__audioChunk", (b64) => {
  const buf = Buffer.from(b64, "base64");
  feed(new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2));
});
await page.goto("https://example.com");
await page.evaluate(async () => {
  const a = new RTCPeerConnection(), c = new RTCPeerConnection();
  a.onicecandidate = (e) => e.candidate && c.addIceCandidate(e.candidate);
  c.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate);
  const s = await navigator.mediaDevices.getUserMedia({ audio: true });
  s.getTracks().forEach((t) => a.addTrack(t, s));
  await a.setLocalDescription(await a.createOffer());
  await c.setRemoteDescription(a.localDescription);
  await c.setLocalDescription(await c.createAnswer());
  await a.setRemoteDescription(c.localDescription);
  await new Promise((r) => setTimeout(r, 4000)); // lets the capture decide between the app element and its own sink
});
const files = readdirSync(DIR).filter((f) => f.endsWith(".m4a")).sort();
const wers = [];
for (const f of files) {
  const base = f.replace(/\.m4a$/, "");
  const wav = execFileSync("ffmpeg", ["-v", "error", "-i", `${DIR}/${f}`, "-ac", "1", "-ar", "24000", "-f", "wav", "-"], { maxBuffer: 1 << 28 });
  heard = [];
  await page.evaluate((w) => window.__speak(w), wav.toString("base64"));
  await new Promise((r) => setTimeout(r, 3500)); // end-of-sentence silence
  await queue;
  const text = heard.map((h) => h.text).join(" ");
  const ref = existsSync(`${DIR}/${base}.txt`) ? readFileSync(`${DIR}/${base}.txt`, "utf8").trim() : "";
  const w = wer(ref, text);
  if (w !== null) wers.push(w);
  console.log(`${base}: ${w === null ? "s/ref" : (w * 100).toFixed(0) + "%"} | ${heard.length} segmento(s) [${heard.map((h) => h.secs.toFixed(1) + "s").join(", ")}]\n   oyó: ${text}${ref ? `\n   dijo: ${ref}` : ""}`);
}
console.log("tap stats:", JSON.stringify(await page.evaluate(() => window.__tapStats)));
console.log(`promedio WER por el camino completo: ${(100 * wers.reduce((x, y) => x + y, 0) / wers.length).toFixed(0)}%`);
await b.close();
process.exit(0);
