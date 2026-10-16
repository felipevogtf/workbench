// Stand-in for the Copilot CLI used by brain.test.mjs. FAKE_MODE: ok (answer, then a slow shutdown) | fail (exit 3 with a message) | silent (exit 0 without events)
const mode = process.env.FAKE_MODE ?? "ok";
const emit = (o) => console.log(JSON.stringify(o));
if (mode === "fail") { console.error("Error: something went wrong"); process.exit(3); }
if (mode === "ok") {
  emit({ type: "assistant.message_start", data: { messageId: "m1", phase: "final_answer" } });
  emit({ type: "assistant.message_delta", data: { messageId: "m1", deltaContent: "Hola, " } });
  emit({ type: "assistant.message_delta", data: { messageId: "m1", deltaContent: "soy una IA." } });
  emit({ type: "result", data: {} });
  setTimeout(() => process.exit(0), 1500); // the real CLI needs about 1.3 s to shut down
}
