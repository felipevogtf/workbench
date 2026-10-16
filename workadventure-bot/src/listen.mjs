// Speech to text: local Whisper through transformers.js (no API key). Model downloads on first use.
import "./config.mjs"; // loads .env before anything reads process.env
import { writeFileSync } from "node:fs";
import { pipeline } from "@huggingface/transformers";

const MODEL = process.env.WA_STT_MODEL ?? "Xenova/whisper-small";
let asr;

export async function transcribe(samples16k) {
  asr ??= await pipeline("automatic-speech-recognition", MODEL, { dtype: "q8" });
  const seconds = samples16k.length / 16000;
  const out = await asr(samples16k, {
    language: "spanish",
    task: "transcribe",
    // Bound the decode: ~5 tokens per second of audio is plenty for speech, and stops runaway loops.
    max_new_tokens: Math.min(120, Math.max(24, Math.ceil(seconds * 5))),
    no_repeat_ngram_size: 3,
  });
  return out.text.trim();
}

// Whisper sometimes loops on noise ("a lo a lo a lo ..."); detect text dominated by repeats.
export function looksLikeHallucination(text) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;
  return new Set(words).size / words.length < 0.4;
}

// Minimal 16-bit PCM WAV decoder -> mono Float32 at 16 kHz (linear resample). Used by tests.
export function wavTo16kMono(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = 12, rate = 16000, channels = 1, dataStart = 0, dataLen = 0;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = dv.getUint32(pos + 4, true);
    if (id === "fmt ") { channels = dv.getUint16(pos + 10, true); rate = dv.getUint32(pos + 12, true); }
    if (id === "data") { dataStart = pos + 8; dataLen = Math.min(size, buf.length - dataStart); break; }
    pos += 8 + size;
  }
  const n = Math.floor(dataLen / 2 / channels);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) mono[i] = dv.getInt16(dataStart + i * 2 * channels, true) / 32768;
  const outLen = Math.floor((n * 16000) / rate);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const t = (i * rate) / 16000, i0 = Math.floor(t), f = t - i0;
    out[i] = mono[i0] * (1 - f) + (mono[Math.min(i0 + 1, n - 1)] ?? 0) * f;
  }
  return out;
}

// Energy-based voice activity detection over a 16 kHz Int16 stream. Calls onSegment(Float32Array) per utterance.
export function createSegmenter(onSegment, { threshold = Number(process.env.WA_VAD_THRESHOLD ?? 0.012), endSilenceMs = Number(process.env.WA_VAD_END_MS ?? 1100), minSpeechMs = 500, maxMs = 25000 } = {}) {
  const RATE = 16000;
  let chunks = [], speechSamples = 0, silenceSamples = 0, active = false, preroll = [];
  const flush = () => {
    if (active && speechSamples >= (minSpeechMs * RATE) / 1000) {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Float32Array(total);
      let o = 0;
      for (const c of chunks) { out.set(c, o); o += c.length; }
      onSegment(out);
    }
    chunks = []; speechSamples = 0; silenceSamples = 0; active = false;
  };
  const feed = (int16) => {
    const f = new Float32Array(int16.length);
    let sum = 0;
    for (let i = 0; i < int16.length; i++) { f[i] = int16[i] / 32768; sum += f[i] * f[i]; }
    // Hysteresis: once a sentence started, even soft speech (half the start level) keeps it going,
    // so quiet word endings don't end the sentence early.
    const loud = Math.sqrt(sum / f.length) > (active ? threshold * 0.5 : threshold);
    if (!active) {
      preroll.push(f);
      if (preroll.length > 3) preroll.shift(); // ~0.7 s of context before the first loud chunk
      if (!loud) return;
      active = true;
      chunks = [...preroll];
      preroll = [];
    } else chunks.push(f);
    if (loud) { speechSamples += f.length; silenceSamples = 0; } else silenceSamples += f.length;
    const length = chunks.reduce((n, c) => n + c.length, 0);
    if (silenceSamples >= (endSilenceMs * RATE) / 1000 || length >= (maxMs * RATE) / 1000) flush();
  };
  // Drop whatever is being collected (used while the bot itself is speaking).
  feed.reset = () => {
    chunks = []; preroll = []; speechSamples = 0; silenceSamples = 0; active = false;
  };
  return feed;
}

// Writes mono 16-bit PCM as a WAV file (used by WA_DEBUG_AUDIO to keep what the bot really heard).
export function saveWav(path, samples, rate = 16000) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([h, data]));
}
