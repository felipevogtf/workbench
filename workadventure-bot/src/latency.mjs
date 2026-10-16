// Statistics over the turns written to logs/<run>/latency.jsonl (used by tools/latency-report.mjs).
export const STAGES = [
  ["chat_ms", "heard -> reply in chat"],
  ["voice_ms", "heard -> reply voice starts"],
  ["since_speech_end_chat_ms", "end of speech -> chat"],
  ["since_speech_end_voice_ms", "end of speech -> voice"],
  ["stt_ms", "whisper"],
  ["stt_queue_ms", "whisper queue"],
  ["wait_ms", "wait before the turn starts"],
  ["filler_ms", "heard -> filler starts"],
  ["llm_ms", "LLM"],
  ["tts_ms", "text-to-speech"],
  ["ready_ms", "heard -> reply ready"],
];

/** Nearest-rank percentile of a list of numbers; null when empty. */
export function percentile(values, p) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}

/** { stage: { n, min, p50, p90, max } } for every stage that has at least one number. */
export function summarize(records) {
  const out = {};
  for (const [key] of STAGES) {
    const v = records.map((r) => r[key]).filter((x) => typeof x === "number");
    if (v.length) out[key] = { n: v.length, min: Math.min(...v), p50: percentile(v, 50), p90: percentile(v, 90), max: Math.max(...v) };
  }
  return out;
}
