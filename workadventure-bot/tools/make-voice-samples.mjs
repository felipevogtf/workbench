import "../src/config.mjs"; // loads .env
// Writes the same sentence in several voices to out/voice-samples so they can be compared by ear.
import { mkdir, writeFile } from "node:fs/promises";
import { synthesize } from "../src/voice.mjs";

const TEXT = "Hola, qué bueno verte por acá. Soy tu asistente. ¿Quieres que te cuente un chiste, o prefieres que conversemos un rato?";
const SAMPLES = [
  ["1-piper-claude-original", "es_MX-claude-high", { WA_PIPER_SPEED: "1.0", WA_PIPER_NOISE: "0.667", WA_PIPER_NOISE_W: "0.8" }, "wav"],
  ["2-piper-claude-ajustada", "es_MX-claude-high", {}, "wav"],
  ["3-piper-ald-ajustada", "es_MX-ald-medium", {}, "wav"],
  ["4-edge-chile-hombre-Lorenzo", "edge:es-CL-LorenzoNeural", {}, "mp3"],
  ["5-edge-chile-mujer-Catalina", "edge:es-CL-CatalinaNeural", {}, "mp3"],
  ["6-edge-mexico-hombre-Jorge", "edge:es-MX-JorgeNeural", {}, "mp3"],
  ["7-edge-mexico-mujer-Dalia", "edge:es-MX-DaliaNeural", {}, "mp3"],
];
await mkdir("out/voice-samples", { recursive: true });
for (const [name, voice, env, ext] of SAMPLES) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    const b64 = await synthesize(TEXT, voice);
    await writeFile(`out/voice-samples/${name}.${ext}`, Buffer.from(b64, "base64"));
    console.log("ok  ", name);
  } catch (e) {
    console.log("FAIL", name, "-", e.message.slice(0, 120));
  } finally {
    for (const k of Object.keys(env)) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]);
  }
}
process.exit(0);
