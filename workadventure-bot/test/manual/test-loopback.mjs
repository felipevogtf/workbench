import "../../src/config.mjs"; // loads .env
// Offline check of the listening chain: virtual mic -> WebRTC -> tap -> VAD -> Whisper, without WorkAdventure.
import { chromium } from "playwright";
import { MIC_INIT_SCRIPT, LISTEN_INIT_SCRIPT, synthesize } from "../../src/voice.mjs";
import { createSegmenter, transcribe } from "../../src/listen.mjs";

const phrase = process.argv[2] ?? "¿Sabes que hay rayos por acá? Quiero que me cuentes un chiste.";
const b = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ permissions: ["microphone"] });
await ctx.addInitScript(MIC_INIT_SCRIPT);
await ctx.addInitScript(LISTEN_INIT_SCRIPT);
const page = await ctx.newPage();
const heard = [];
let chunks = 0;
const feed = createSegmenter(async (samples) => {
  const t = await transcribe(samples);
  console.log(`segment ${(samples.length / 16000).toFixed(1)}s ->`, JSON.stringify(t));
  heard.push(t);
});
await page.exposeFunction("__audioChunk", (b64) => {
  const buf = Buffer.from(b64, "base64");
  chunks++;
  feed(new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2));
});
await page.goto("https://example.com");
const wav = await synthesize(phrase, "es_MX-ald-medium");
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
  await new Promise((r) => setTimeout(r, 1500));
});
console.log("speaking:", phrase);
await page.evaluate((w) => window.__speak(w), wav);
await new Promise((r) => setTimeout(r, 4500)); // end-of-sentence silence + transcription
console.log("chunks received:", chunks, "| heard:", JSON.stringify(heard.join(" ")));
await b.close();
process.exit(0);
