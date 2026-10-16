// Every module of src/ (except the entry point, which launches a browser) loads without errors: catches wrong paths after moving files.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.WA_LOG_FILES = "0";
const modules = ["config", "logger", "state", "identity", "brain", "listen", "voice", "position", "latency", "map", "bargein", "hearing", "movement", "onboarding", "chat"];

for (const m of modules) {
  test(`src/${m}.mjs loads`, async () => {
    const mod = await import(`../src/${m}.mjs`);
    assert.ok(Object.keys(mod).length > 0, "exports something");
  });
}
