// Listening: incoming audio of the people in the bubble -> VAD segments -> Whisper -> state.inbox.
// Also owns the audio diagnostics (WebRTC stats, capture quality, the capture-variant experiment).
// Logs: audio.log (capture) and conversation.log (what was heard / discarded).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cfg, PATHS } from "./config.mjs";
import { logger } from "./logger.mjs";
import { state } from "./state.mjs";
import { createBargeInDetector } from "./bargein.mjs";
import { transcribe, createSegmenter, looksLikeHallucination, saveWav } from "./listen.mjs";

const audioLog = logger("audio");
const talkLog = logger("conversation");

const VARIANTS = ["own-muted", "own-audible", "own-audible-keep", "app-element"];
const DEBUG_DIR = join(PATHS.out, "debug-audio");

// Whisper invents stock phrases when it is fed noise (subtitle credits, "thanks for watching"...): never answer those.
const NOISE_PHRASES = /amara\.org|suscr[ií]bete|subt[ií]tulos|gracias por ver|^\W*(m[uú]sica|aplausos)\W*$|^\W*\[.*\]\W*$/i;

/** Call after the page exists and before it navigates (it exposes functions the page script calls). */
export async function startHearing(page) {
  let currentVariant = cfg.tap.variant ?? "own-muted";
  const variantStats = {}; // variant -> { segments, empty (sum of ratios), secs }
  let segmentNumber = 0;
  let cycling = false;
  let selfTest = null; // { blocks, empty } while the self-test runs

  const printVariantSummary = () => {
    const rows = Object.entries(variantStats).map(
      ([v, x]) => `  ${v.padEnd(18)} ${x.segments} segments, ${((100 * x.empty) / x.segments).toFixed(0)}% of blocks empty on average, ${x.secs.toFixed(0)} s of voice`,
    );
    if (rows.length) audioLog(["capture methods compared (lower empty % is better; ~0% is a clean capture):", ...rows].join("\n"));
  };

  // Load Whisper now (first run downloads the model) so the first sentence isn't delayed.
  let transcribing = transcribe(new Float32Array(16000))
    .then(() => audioLog("whisper ready"))
    .catch((e) => audioLog.error("whisper failed to load:", e.message));

  const feed = createSegmenter((samples) => {
    if (state.sttPending >= 3) return audioLog.warn("stt is behind, dropping a voice segment");
    state.sttPending++;
    const segmentAt = Date.now();
    const speechEndAt = segmentAt - cfg.vadEndMs; // the VAD closes a segment after this much silence
    let rms = 0, peak = 0;
    for (const v of samples) { rms += v * v; peak = Math.max(peak, Math.abs(v)); }
    rms = Math.sqrt(rms / samples.length);
    audioLog(`voice segment ${(samples.length / 16000).toFixed(1)}s (level rms ${rms.toFixed(3)}, peak ${peak.toFixed(2)}) -> whisper`);
    // Share of 256 ms blocks that are digital silence: a clean capture has almost none inside speech.
    let emptyBlocks = 0, blocks = 0;
    for (let i = 0; i + 4096 <= samples.length; i += 4096) {
      let nz = 0;
      for (let j = 0; j < 4096; j++) if (samples[i + j] !== 0) nz++;
      blocks++;
      if (nz < 80) emptyBlocks++;
    }
    const emptyRatio = blocks ? emptyBlocks / blocks : 0;
    const vs = (variantStats[currentVariant] ??= { segments: 0, empty: 0, secs: 0 });
    if (rms > 0.01) { vs.segments++; vs.empty += emptyRatio; vs.secs += samples.length / 16000; }
    audioLog(`  segment capture quality: ${(100 * emptyRatio).toFixed(0)}% empty blocks [${currentVariant}]`);
    // WA_DEBUG_AUDIO=1 keeps every segment as out/debug-audio/NNN.wav with what Whisper understood, to inspect real-room audio.
    const debugId = cfg.debugAudio ? `${String(++segmentNumber).padStart(3, "0")}-${currentVariant}` : null;
    if (debugId) {
      mkdirSync(DEBUG_DIR, { recursive: true });
      saveWav(join(DEBUG_DIR, `${debugId}.wav`), samples);
    }
    // Whisper runs one segment at a time, in order.
    transcribing = transcribing.then(async () => {
      const sttStartAt = Date.now();
      try {
        const text = await transcribe(samples);
        const sttEndAt = Date.now();
        if (debugId) writeFileSync(join(DEBUG_DIR, `${debugId}.txt`), `rms ${rms.toFixed(4)} peak ${peak.toFixed(3)} dur ${(samples.length / 16000).toFixed(1)}s\n${text}\n`);
        const short = text.replace(/[^\p{L}]/gu, "").length < 3 && !/^(s[ií]|no|ok)\W*$/i.test(text);
        if (short) return talkLog("discarded (too short):", JSON.stringify(text));
        if (looksLikeHallucination(text)) return talkLog("discarded (repetitive noise):", text.slice(0, 60));
        if (NOISE_PHRASES.test(text)) return talkLog("discarded (typical noise phrase):", text.slice(0, 60));
        talkLog(`heard (${(samples.length / 16000).toFixed(1)}s of voice, whisper ${sttEndAt - sttStartAt} ms, queued ${sttStartAt - segmentAt} ms):`, text);
        state.inbox.push({ text, segmentAt, speechEndAt, sttStartAt, sttEndAt });
      } catch (e) {
        talkLog.error("stt error:", e.message);
      } finally {
        state.sttPending--;
      }
    });
  });

  await page.exposeFunction("__remoteTrack", (info) => {
    audioLog("remote audio track attached:", info);
    if (cfg.tapCycle && !cycling) {
      cycling = true;
      let i = 0;
      const next = async () => {
        currentVariant = VARIANTS[i++ % VARIANTS.length];
        await page.evaluate((v) => { window.__tapVariant = v; window.__applyTap(v); }, currentVariant).catch(() => {});
        audioLog(`capture method now: ${currentVariant}`);
      };
      next();
      setInterval(next, 30000);
    }
    setTimeout(() => page.evaluate(() => window.__tapMode).then((m) => audioLog("capture mode:", m ?? "(none yet)")).catch(() => {}), 6000);
    // Diagnostics: which media elements are consuming audio in the page a few seconds later.
    setTimeout(async () => {
      const els = await page
        .evaluate(() =>
          [...document.querySelectorAll("audio, video")].map((e) => {
            const tracks = e.srcObject && e.srcObject.getAudioTracks ? e.srcObject.getAudioTracks().length : 0;
            return `${e.tagName.toLowerCase()}${(window.__sinks ?? []).includes(e) ? "(bot sink)" : ""}[audioTracks=${tracks},muted=${e.muted},paused=${e.paused},vol=${e.volume}]`;
          }),
        )
        .catch(() => []);
      audioLog(`media elements in the page: ${els.length ? els.join(" ") : "none"}`);
    }, 5000);
  });

  // Diagnostics: how loud the incoming audio is (silence also produces chunks, so look at the level).
  let maxLevel = 0, lastChunkAt = 0, gaps = 0, maxGap = 0;
  setInterval(() => {
    if (maxLevel > 0.001) audioLog(`listening: incoming audio level ${maxLevel.toFixed(3)} in the last 15s`);
    // Measured in Node: Whisper blocks the event loop for ~1 s, so a gap here is not necessarily audio lost in the page.
    if (gaps) audioLog(`chunk arrival gaps in the last 15s: ${gaps} gaps, longest ${maxGap} ms (Node side; includes event-loop stalls while Whisper runs)`);
    gaps = 0;
    maxGap = 0;
    maxLevel = 0;
  }, 15000);

  // Every 2 s: what the WebRTC receiver reports. Compare with the holes in the captured audio (out/debug-audio).
  let prevRtp = null;
  setInterval(async () => {
    const st = await page.evaluate(() => window.__inboundStats && window.__inboundStats()).catch(() => null);
    if (!st) return;
    if (prevRtp && st.packets !== prevRtp.packets) {
      const d = (k) => st[k] - prevRtp[k];
      const jb = d("emitted") ? (1000 * d("jitterDelay")) / d("emitted") : 0;
      audioLog(`rtp: +${d("packets")} packets (lost ${d("lost")}), ${(d("samples") / 48000).toFixed(2)}s of audio decoded, concealed ${(d("concealed") / 48000).toFixed(2)}s (silent ${(d("silentConcealed") / 48000).toFixed(2)}s), stretched +${d("inserted")} / squeezed -${d("removed")} samples, jitter buffer ${jb.toFixed(0)} ms, level ${st.level.toFixed(2)}`);
    }
    prevRtp = st;
  }, 2000);

  const barge = createBargeInDetector({ threshold: cfg.bargeInRms });
  const recent = []; // the last chunks heard while the bot speaks, to keep the start of an interruption
  const hear = (pcm) => {
    let sum = 0;
    for (const v of pcm) sum += (v / 32768) ** 2;
    if (Math.sqrt(sum / pcm.length) > 0.01) state.lastLoud = Date.now();
    feed(pcm);
  };
  await page.exposeFunction("__audioChunk", (b64) => {
    const b = Buffer.from(b64, "base64");
    const pcm = new Int16Array(b.buffer, b.byteOffset, b.length / 2);
    if (selfTest) { // count blocks while the self-test tone plays
      let nz = 0;
      for (const v of pcm) if (v !== 0) nz++;
      selfTest.blocks++;
      if (nz < 80) selfTest.empty++;
    }
    // Chunks should arrive every 256 ms; a long gap means a late chunk (page busy, or Node busy transcribing).
    const nowMs = Date.now();
    if (lastChunkAt && nowMs - lastChunkAt > 400) { gaps++; maxGap = Math.max(maxGap, nowMs - lastChunkAt); }
    lastChunkAt = nowMs;
    for (const v of pcm) maxLevel = Math.max(maxLevel, Math.abs(v) / 32768);
    const rms = Math.sqrt(pcm.reduce((s, v) => s + (v / 32768) ** 2, 0) / pcm.length);
    // Echo guard: while the bot talks (and just after), its own voice comes back through the other
    // person's speakers and microphone. Ignore the audio so it doesn't answer itself. Headphones avoid it.
    // Barge-in: unless the person keeps talking loudly over the bot: then its voice is cut and they are heard.
    if (state.botSpeaking || Date.now() < state.mutedUntil) {
      if (cfg.bargeIn && state.botSpeaking) {
        recent.push(pcm);
        if (recent.length > 2) recent.shift();
        if (barge.feed(rms)) {
          talkLog(`barge-in: the person talks over the bot (level ${rms.toFixed(3)}), cutting its voice`);
          barge.reset();
          state.bargeInAt = Date.now();
          state.botSpeaking = false; // from here on the person is heard, not the echo guard
          state.mutedUntil = 0;
          page.evaluate(() => window.__stopSpeak && window.__stopSpeak()).catch(() => {});
          for (const c of recent.splice(0)) hear(c); // the first half second of what they said
          return;
        }
      }
      return feed.reset();
    }
    barge.reset();
    recent.length = 0;
    hear(pcm);
  });

  return {
    printVariantSummary,
    /** A tone made inside the page goes through the same capture chain; every block should arrive with sound. */
    async runSelfTest() {
      selfTest = { blocks: 0, empty: 0 };
      await page.evaluate(() => window.__selfTest(6000));
      await new Promise((r) => setTimeout(r, 7500));
      const { blocks, empty } = selfTest;
      audioLog(`self-test tone: ${blocks} blocks received, ${empty} empty (${blocks ? ((100 * empty) / blocks).toFixed(0) : "?"}% empty; ~0% expected, 66% would reproduce the room problem)`);
      selfTest = null;
    },
  };
}
