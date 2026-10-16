// Who the bot is in this run: gender, name, skin pool, voice and the LLM system prompt.
// The gender is random unless WA_GENDER is set; name, skin and voice follow it (config/characters.json).
import { readFileSync } from "node:fs";
import { cfg } from "./config.mjs";

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function createIdentity(voices) {
  const characters = JSON.parse(readFileSync(cfg.charactersFile, "utf8"));
  const gender = cfg.gender ?? pick(["mujer", "hombre"]);
  const character = characters[gender];
  // WorkAdventure cuts names at 10 characters, so the "IA" tag is short and the name is trimmed to leave room for it.
  const name = (cfg.botName ?? `${pick(character.names).slice(0, 7)} IA`).slice(0, 10);
  const voiceName = cfg.voiceName ?? character.voice ?? pick(voices);
  const system = `Eres ${name}, ${character.grammar} (usa concordancia de género ${gender === "mujer" ? "femenina" : "masculina"}) que es un bot de IA en un mundo virtual (WorkAdventure). Responde en español, en máximo 2 frases, y di que eres una IA si te lo preguntan.`;
  return { gender, character, name, voiceName, system, pickSkin: () => pick(character.wokas) };
}
