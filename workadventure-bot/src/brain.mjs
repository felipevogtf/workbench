// LLM brain: GPT through GitHub Copilot CLI (`copilot -p`), same approach as workbench-server.
import "./config.mjs"; // loads .env before anything reads process.env
import { spawn } from "node:child_process";
import { join } from "node:path";

const MODEL = process.env.WA_MODEL ?? "auto";
// Reasoning effort (faster answers) is not supported by "auto", so it is off unless WA_EFFORT is set.
const EFFORT = process.env.WA_EFFORT; // optional: only models other than "auto" accept it
// Run the CLI's JS entry with node directly: no shell, so chat text can't be interpreted as commands.
const COPILOT_JS =
  process.env.COPILOT_JS ?? join(process.env.ProgramFiles ?? "", "nodejs", "node_modules", "@github", "copilot", "npm-loader.js");

// Same parsing as workbench-server copilot-output.ts: keep only `final_answer` messages.
function extractAnswer(stdout) {
  const finals = new Map();
  const phases = new Map();
  let saw = false;
  for (const line of stdout.split("\n")) {
    if (!line.startsWith("{")) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const id = e.data?.messageId;
    if (!id) continue;
    if (e.type === "assistant.message_start") { saw = true; phases.set(id, e.data?.phase ?? ""); }
    else if (e.type === "assistant.message_delta" && phases.get(id) === "final_answer")
      finals.set(id, (finals.get(id) ?? "") + (e.data?.deltaContent ?? ""));
  }
  return saw ? [...finals.values()].join("\n\n").trim() : stdout.trim();
}

export function think(system, userText) {
  const prompt = `${system}\n\n---\n\nMensaje del usuario en el chat:\n${userText}`;
  const args = [COPILOT_JS, "-p", prompt, "--output-format", "json", "--disable-builtin-mcps",
    "--model", MODEL, ...(EFFORT ? ["--reasoning-effort", EFFORT] : []), "--deny-tool", "write", "--deny-tool", "shell", "--deny-tool", "url"];
  const env = { ...process.env, COPILOT_GITHUB_TOKEN: process.env.COPILOT_TOKEN ?? process.env.COPILOT_GITHUB_TOKEN };
  if (!env.COPILOT_GITHUB_TOKEN) delete env.COPILOT_GITHUB_TOKEN;
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env });
    let out = "", err = "", pending = "", settled = false;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      settle(reject, new Error("Copilot CLI timed out after 120 s"));
    }, 120000);
    // The CLI prints a "result" event when the answer is complete and then takes over a second more to shut down.
    // The answer is handed over at the "result" event; the process is left to exit on its own.
    child.stdout.on("data", (d) => {
      out += d;
      pending += d;
      let i;
      while ((i = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, i);
        pending = pending.slice(i + 1);
        if (!line.startsWith('{"type":"result"')) continue;
        const answer = extractAnswer(out);
        if (answer) return settle(resolve, answer);
      }
    });
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => settle(reject, e));
    child.on("close", (code, signal) => {
      if (code === 0) return settle(resolve, extractAnswer(out) || null);
      // report the exit status and the useful tail (the command line itself would include the whole prompt)
      const tail = (err || out).trim().slice(-400);
      settle(reject, new Error(`Copilot CLI failed (exit ${code ?? "?"}${signal ? `, signal ${signal}` : ""})${tail ? `: ${tail}` : " with no output"}`));
    });
  });
}
