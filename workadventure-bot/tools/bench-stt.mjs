import "../src/config.mjs"; // loads .env
// Runs the recordings in test/fixtures/voice (N.m4a + N.txt with what was really said) through Whisper with several
// settings and prints what it understood and the word error rate (0% = perfect).
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { pipeline } from "@huggingface/transformers";

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
const load = (file) => {
  const buf = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], { maxBuffer: 1 << 28 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
};
const files = readdirSync(DIR).filter((f) => f.endsWith(".m4a")).sort();
const audios = files.map((f) => {
  const base = f.replace(/\.m4a$/, "");
  const ref = existsSync(`${DIR}/${base}.txt`) ? readFileSync(`${DIR}/${base}.txt`, "utf8").trim() : "";
  return { base, ref, samples: load(`${DIR}/${f}`) };
});

const MODELS = (process.env.WA_BENCH_MODELS ?? "Xenova/whisper-base,Xenova/whisper-small").split(",");
const CONFIGS = {
  "bot actual (lang=es, no_repeat=3)": (s) => ({ language: "spanish", task: "transcribe", max_new_tokens: Math.min(120, Math.max(24, Math.ceil((s.length / 16000) * 5))), no_repeat_ngram_size: 3 }),
  "simple (lang=es)": () => ({ language: "spanish", task: "transcribe" }),
  "autodetect idioma": () => ({ task: "transcribe" }),
  "lang=es + beams=5": () => ({ language: "spanish", task: "transcribe", num_beams: 5 }),
};
for (const model of MODELS) {
  const t0 = Date.now();
  const asr = await pipeline("automatic-speech-recognition", model, { dtype: "q8" });
  console.log(`\n##### ${model} (carga ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  for (const [name, opts] of Object.entries(CONFIGS)) {
    const wers = [];
    console.log(`\n  [${name}]`);
    for (const a of audios) {
      const t1 = Date.now();
      const out = (await asr(a.samples, opts(a.samples))).text.trim();
      const w = wer(a.ref, out);
      if (w !== null) wers.push(w);
      console.log(`   ${a.base}: ${w === null ? "  s/ref" : (w * 100).toFixed(0).padStart(4) + "%"}  ${((Date.now() - t1) / 1000).toFixed(1)}s  -> ${out}`);
      if (a.ref && w) console.log(`        dijo: ${a.ref}`);
    }
    console.log(`   promedio WER: ${(100 * wers.reduce((x, y) => x + y, 0) / wers.length).toFixed(0)}%`);
  }
}
process.exit(0);
