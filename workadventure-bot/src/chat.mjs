// Conversation: read what people write (bubble chat) or say (state.inbox, from hearing.mjs), ask the LLM, answer in the
// chat and out loud. Logs: conversation.log (what happened) and latency.jsonl (how long each stage of every turn took).
import { cfg } from "./config.mjs";
import { logger, logJson } from "./logger.mjs";
import { state, voiceQuiet } from "./state.mjs";
import { think } from "./brain.mjs";
import { synthesize } from "./voice.mjs";

const log = logger("conversation");
const latencyLog = logger("latency");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();
const diff = (a, b) => (a != null && b != null ? Math.round(a - b) : null);
const secs = (ms) => (ms == null ? "-" : (ms / 1000).toFixed(1));

// Short spoken fillers, synthesized once at startup with the bot's own voice.
const FILLERS = ["Mmm, a ver.", "Déjame pensar un segundo.", "Claro, un momento.", "Buena pregunta.", "Mmm, interesante."];

/** `deps` lets tests replace the LLM, the text-to-speech and the loop condition. */
export async function startChat(page, identity, deps = {}) {
  const { voiceName, system } = identity;
  const askLlm = deps.think ?? think;
  const tts = deps.synthesize ?? synthesize;
  const running = deps.running ?? (() => true);

  // Plays a WAV through the virtual mic. While it plays (and just after) the bot ignores incoming audio, because its
  // own voice comes back through the other person's speakers. Returns when it started and ended.
  async function playWav(wav, label) {
    state.botSpeaking = true;
    const t = { startAt: now(), endAt: null };
    try {
      const sentBefore = await page.evaluate(() => window.__audioBytesSent?.()).catch(() => 0);
      t.startAt = now();
      const peak = await Promise.race([
        page.evaluate((b64) => window.__speak(b64), wav),
        sleep(45000).then(() => { throw new Error("speaking timed out"); }),
      ]);
      t.endAt = now();
      t.interrupted = state.bargeInAt >= t.startAt; // the person talked over it and its voice was cut
      const sentAfter = await page.evaluate(() => window.__audioBytesSent?.()).catch(() => 0);
      log(`${label} (${voiceName}) played for ${t.endAt - t.startAt} ms${t.interrupted ? " (interrupted)" : ""}, peak level ${peak.toFixed(2)} | audio sent to the room: +${sentAfter - sentBefore} bytes`);
    } catch (e) {
      log.error("voice error:", e.message);
    } finally {
      t.endAt ??= now();
      state.botSpeaking = false;
      // The echo of the bot reaches the other side a bit after it stops; after an interruption the person is already talking.
      if (!t.interrupted) state.mutedUntil = now() + cfg.echoTailMs;
    }
    return t;
  }

  let fillerWavs = [];
  let fillerTurn = 0;
  if (cfg.voice && cfg.filler) {
    // One at a time: asking the online voice service for all of them at once gets rate-limited (429).
    (async () => {
      const ready = [];
      const t0 = now();
      for (const t of FILLERS) {
        ready.push(await tts(t, voiceName));
        await sleep(1200);
      }
      fillerWavs = ready;
      log(`fillers ready (${now() - t0} ms)`);
    })().catch((e) => log.error("fillers failed:", e.message));
  }

  // Open the chat panel (first icon of the top-left bar) and the proximity "bubble" conversation.
  // The global chat needs a login; the bubble chat works for anonymous players near each other.
  await page.mouse.click(47, 47);
  await sleep(1500);
  await page.getByText(/burbuja de discusi|discussion bubble/i).first().click().catch(() => log.warn("bubble chat entry not found"));
  await sleep(1500);
  const read = () => page.locator(cfg.chatMsgSelector).allInnerTexts().catch(() => []);
  // Messages are tracked by position, not by text, so repeated texts ("hola") are still answered.
  // If the list gets shorter, a new bubble started and its chat is a fresh list.
  let handled = (await read()).length;
  const ownReplies = []; // what the bot wrote, so it never answers itself
  const history = []; // short conversation memory sent to the LLM
  let turnNo = 0;
  state.chatReady = true;
  log("chat ready, existing messages:", handled);

  while (running()) {
    await sleep(cfg.chatPollMs);
    const texts = await read();
    const pickedAt = now();
    const spokenItems = voiceQuiet() ? state.inbox.splice(0) : [];
    if (texts.length < handled) {
      handled = 0;
      history.length = 0;
    }
    // Everything written since the last poll counts as one turn, so a slow LLM call
    // never leaves the bot answering old messages while the person keeps typing.
    const written = texts
      .slice(handled)
      .map((t) => t.replace(/\s+/g, " ").trim())
      .filter((t) => t && !ownReplies.some((r) => r === t || (t.length > 20 && r.startsWith(t.slice(0, 20)))));
    const fresh = written.concat(spokenItems.map((i) => i.text));
    handled = texts.length;
    if (fresh.length) state.lastChat = pickedAt;
    if (!fresh.length) continue;

    const turn = ++turnNo;
    const turnStartAt = now();
    // The moment the bot "heard" the person: the end of the transcription of the last thing said, or when the chat poll saw the text.
    const lastVoice = spokenItems.at(-1) ?? null;
    const heardAt = lastVoice ? lastVoice.sttEndAt : pickedAt;
    const source = lastVoice && written.length ? "voice+chat" : lastVoice ? "voice" : "chat";
    log(`turn ${turn} [${source}] chat:`, fresh.join(" / "));

    // The model takes several seconds: say a short filler right away so the conversation feels alive.
    const filler = lastVoice && fillerWavs.length ? playWav(fillerWavs[fillerTurn++ % fillerWavs.length], "filler") : Promise.resolve(null);

    for (const t of fresh) history.push(`Usuario: ${t}`);
    const convo = `${history.slice(-12).join("\n")}\n\nResponde solo al ultimo mensaje del usuario, teniendo en cuenta la conversacion.`;
    const llmStartAt = now();
    const reply = await askLlm(system, convo).catch((e) => (log.error("llm error:", e.message), null));
    const llmEndAt = now();
    if (!reply) {
      log.warn(`turn ${turn}: no reply for:`, fresh.join(" / "));
      logJson("latency", { turn, source, error: "no reply", text: fresh.join(" / ").slice(0, 200), llm_ms: llmEndAt - llmStartAt });
      continue;
    }
    const oneLine = reply.replace(/\s+/g, " ").trim();
    ownReplies.push(oneLine);
    if (ownReplies.length > 10) ownReplies.shift();
    history.push(`Tu: ${oneLine}`);
    log(`turn ${turn} reply (${llmEndAt - llmStartAt} ms):`, oneLine);

    // The chat message goes out right away; the voice is synthesized meanwhile (and starts after the filler, if there is one).
    const ttsStartAt = now();
    let ttsEndAt = null;
    const wavReady = cfg.voice
      ? tts(oneLine, voiceName).then((w) => ((ttsEndAt = now()), w)).catch((e) => (log.error("voice error:", e.message), null))
      : null;
    let chatTypedAt = null;
    const typeReply = async () => {
      await page.locator(cfg.chatInputSelector).last().click().catch((e) => log.error("input click failed:", e.message));
      await page.keyboard.type(oneLine);
      await page.keyboard.press("Enter");
      chatTypedAt = now();
      // The chat box keeps the keyboard after sending: without this the arrow keys stop reaching the game and the bot never walks again.
      await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()).catch(() => {});
    };
    const typing = typeReply();
    const fillerTiming = await filler;
    let wav = wavReady ? await wavReady : null;
    if (wav && state.bargeInAt >= turnStartAt) {
      log(`turn ${turn}: voice skipped, the person interrupted the bot`);
      wav = null;
    }
    const readyAt = now();
    const [spoke] = await Promise.all([wav ? playWav(wav, "spoke") : null, typing]);

    // Every stage of this turn, in ms. "heard" = transcript ready (voice) or message seen (chat).
    const rec = {
      turn,
      source,
      text: fresh.join(" / ").slice(0, 200),
      reply: oneLine.slice(0, 200),
      stt_queue_ms: lastVoice ? diff(lastVoice.sttStartAt, lastVoice.segmentAt) : null, // Whisper busy with an earlier segment
      stt_ms: lastVoice ? diff(lastVoice.sttEndAt, lastVoice.sttStartAt) : null, // Whisper itself
      wait_ms: diff(pickedAt, heardAt), // transcript ready -> chat loop starts the turn (poll interval + waiting for silence)
      filler_ms: fillerTiming ? diff(fillerTiming.startAt, heardAt) : null, // heard -> filler starts
      llm_ms: llmEndAt - llmStartAt,
      tts_ms: ttsEndAt ? ttsEndAt - ttsStartAt : null,
      ready_ms: diff(readyAt, heardAt), // heard -> reply text + audio ready (chat and voice start here)
      chat_ms: diff(chatTypedAt, heardAt), // heard -> reply written in the chat
      interrupted: state.bargeInAt >= turnStartAt,
      voice_ms: spoke ? diff(spoke.startAt, heardAt) : null, // heard -> reply voice starts
      since_speech_end_chat_ms: lastVoice ? diff(chatTypedAt, lastVoice.speechEndAt) : null, // person stops talking -> chat reply
      since_speech_end_voice_ms: lastVoice && spoke ? diff(spoke.startAt, lastVoice.speechEndAt) : null, // person stops talking -> voice reply
    };
    logJson("latency", rec);
    latencyLog(
      `turn ${turn} [${source}] heard->chat ${secs(rec.chat_ms)}s | heard->voice ${secs(rec.voice_ms)}s | wait ${secs(rec.wait_ms)} stt ${secs(rec.stt_ms)} llm ${secs(rec.llm_ms)} tts ${secs(rec.tts_ms)} filler@${secs(rec.filler_ms)}` +
        (rec.since_speech_end_voice_ms != null ? ` | from end of speech: chat ${secs(rec.since_speech_end_chat_ms)}s voice ${secs(rec.since_speech_end_voice_ms)}s` : ""),
    );
  }
}
