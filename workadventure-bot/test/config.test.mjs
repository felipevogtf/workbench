import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "wa-env-"));
const file = join(dir, ".env");
writeFileSync(file, ["WA_MAP_URL=https://example.test/map   # comment after the value", "WANDER=0", "WA_VOICE_NAME=es_MX-ald-medium", "WA_GENDER=hombre", "# WA_FILLER=0", "WA_TAP=rate=0,variant=own-audible-keep"].join("\n"));
process.env.WA_ENV_FILE = file;
process.env.WA_VOICE_NAME = "from-the-shell"; // already set: the shell must win over .env
delete process.env.WA_FILLER;

const { cfg, ENV_FILE_LOADED } = await import("../src/config.mjs");

test(".env is loaded and inline comments are ignored", () => {
  assert.equal(ENV_FILE_LOADED, true);
  assert.equal(cfg.mapUrl, "https://example.test/map");
  assert.equal(cfg.wander, false);
  assert.equal(cfg.gender, "hombre");
});
test("a variable set in the shell wins over .env", () => assert.equal(cfg.voiceName, "from-the-shell"));
test("commented lines stay at their defaults (fillers are off)", () => assert.equal(cfg.filler, false));
test("WA_TAP is parsed into options", () => assert.deepEqual(cfg.tap, { rate: 0, variant: "own-audible-keep" }));
