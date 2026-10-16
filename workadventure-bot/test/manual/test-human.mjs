import "../../src/config.mjs"; // loads .env
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { MIC_INIT_SCRIPT, synthesize } from "../../src/voice.mjs";
const b = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, permissions: process.env.SPEAK ? ["microphone"] : [] });
if (process.env.SPEAK) await ctx.addInitScript(MIC_INIT_SCRIPT); // virtual mic so this test client can talk
const p = await ctx.newPage();
const s = (ms) => new Promise((r) => setTimeout(r, ms));
await p.goto(process.env.WA_MAP_URL);
await p.fill('input[name="fname"]', "Humano");
await p.click("form.loginScene button");
for (let i = 0; i < 6; i++) {
  const btn = p.getByRole("button", { name: /^\s*(continuar|guardar)\s*$/i }).first();
  if (await btn.isVisible().catch(() => false)) await btn.click();
  await s(1500);
}
await s(3000);
const sk = p.getByText(/saltar tutorial/i).first();
if (await sk.isVisible().catch(() => false)) await sk.click();
await s(1000);
if (process.env.SPEAK) {
  const nocam = p.getByRole("button", { name: /continuar sin c/i });
  if (await nocam.isVisible().catch(() => false)) await nocam.click({ timeout: 3000 }).catch(() => {});
  await s(1000);
  await p.mouse.click(436, 47); // unmute the mic
  await s(1500);
}
await p.mouse.click(47, 47);
await s(1500);
await p.getByText("Burbuja de discusión").first().click();
await s(1500);
// walk around until the "Acércate a alguien" hint disappears (a bubble formed)
const keys = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"];
// random walk with longer strides so the test client sweeps the area around the spawn
for (let i = 0; i < 120 && await p.getByText("Acércate a alguien").isVisible().catch(() => false); i++) {
  const k = keys[Math.floor(Math.random() * 4)];
  await p.keyboard.down(k);
  for (let t = 0; t < 6 && await p.getByText("Acércate a alguien").isVisible().catch(() => false); t++) await s(100);
  await p.keyboard.up(k);
  await s(150);
}
console.log("bubble formed:", !(await p.getByText("Acércate a alguien").isVisible().catch(() => false)));
const input = p.locator("div.message-input").last();
await input.click();
await p.keyboard.type(process.env.MSG ?? "hola bot, ¿quién eres?");
await p.keyboard.press("Enter");
console.log("sent, waiting for reply");
if (process.env.SPEAK) {
  await s(Number(process.env.SPEAK_DELAY ?? 12) * 1000); // give the bot time to hook its capture
  for (let n = 0; n < Number(process.env.SPEAK_REPEAT ?? 2); n++) {
    if (n) await s(6000);
  const peak = await p.evaluate((b64) => window.__speak(b64), process.env.SPEAK_FILE ? execFileSync("ffmpeg", ["-v", "error", "-i", process.env.SPEAK_FILE, "-ac", "1", "-ar", "24000", "-f", "wav", "-"], { maxBuffer: 1 << 28 }).toString("base64") : await synthesize(process.env.SPEAK, "Microsoft Sabina Desktop"));
  console.log("spoke, peak", peak.toFixed(2));
  }
}
if (process.env.MSG2 !== undefined) {
  await s(Number(process.env.GAP ?? 30) * 1000);
  await input.click();
  await p.keyboard.type(process.env.MSG2);
  await p.keyboard.press("Enter");
  console.log("sent second");
}
await s(Number(process.env.WAIT ?? 4) * 1000);
await p.screenshot({ path: "out/human.png" });
console.log(await p.evaluate(() => {
  const out = [];
  document.querySelectorAll("#chat *").forEach((e) => {
    if (e.children.length === 0 && e.textContent.trim().length > 2)
      out.push(e.tagName + " ." + String(e.className).slice(0, 70) + " | parent: " + String(e.parentElement.className).slice(0, 70) + " | " + e.textContent.trim().slice(0, 60));
  });
  return out.join("\n");
}));
await b.close();
