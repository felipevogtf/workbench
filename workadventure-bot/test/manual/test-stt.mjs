import "../../src/config.mjs"; // loads .env
import { synthesize } from "../../src/voice.mjs";
import { transcribe, wavTo16kMono } from "../../src/listen.mjs";
const phrase = process.argv[2] ?? "Hola, ¿cómo estás? Me gustaría saber cómo te llamas.";
const wav = Buffer.from(await synthesize(phrase, "Microsoft Raul"), "base64");
const t0 = Date.now();
console.log("heard:", await transcribe(wavTo16kMono(wav)), `(${Date.now() - t0} ms incl. model load)`);
