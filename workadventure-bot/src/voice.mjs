// Voice output: offline Windows TTS (System.Speech) -> WAV -> played into a virtual microphone injected in the page.
import "./config.mjs"; // loads .env before anything reads process.env
import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PATHS } from "./config.mjs";
import { logger } from "./logger.mjs";

const log = logger("conversation");

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "speak.ps1");

// Runs before any page script: getUserMedia returns a stream fed by __speak(), so the bot's mic is "real" to WorkAdventure.
export const MIC_INIT_SCRIPT = () => {
  const ctx = new AudioContext();
  const dest = ctx.createMediaStreamDestination();
  const keep = ctx.createGain(); // silent keep-alive so the track stays live between sentences
  keep.gain.value = 0;
  const osc = ctx.createOscillator();
  osc.connect(keep).connect(dest);
  osc.start();
  const meter = ctx.createAnalyser();
  ctx.createMediaStreamSource(dest.stream).connect(meter);

  const md = navigator.mediaDevices;
  const origEnumerate = md.enumerateDevices.bind(md);
  md.getUserMedia = async (c) => {
    // A clone per request: the app may stop() the track it gets, which would kill a shared one for good.
    if (c && c.audio) {
      const clones = dest.stream.getAudioTracks().map((t) => t.clone());
      (window.__micClones ??= []).push(...clones);
      return new MediaStream(clones);
    }
    throw new DOMException("No camera", "NotFoundError");
  };
  md.enumerateDevices = async () => [
    ...(await origEnumerate()).filter((d) => d.kind !== "audioinput" && d.kind !== "videoinput"),
    { deviceId: "botmic", groupId: "botmic", kind: "audioinput", label: "Bot mic", toJSON() { return this; } },
  ];

  // True when the app holds a live, unmuted mic track (WorkAdventure disables the track when the mic button is off).
  window.__micOn = () => (window.__micClones ?? []).some((t) => t.readyState === "live" && t.enabled);
  window.__micState = () => ({ ctx: ctx.state, sr: ctx.sampleRate, tracks: dest.stream.getAudioTracks().map((t) => `${t.readyState}/${t.enabled}/${t.muted}`) });

  // Plays base64 WAV into the mic and returns the peak level seen on the stream (0..1) as a sanity check.
  window.__speak = async (b64) => {
    await ctx.resume();
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const buf = await ctx.decodeAudioData(bytes.buffer);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(dest);
    (window.__speaking ??= new Set()).add(src);
    const data = new Float32Array(meter.fftSize);
    let peak = 0;
    const timer = setInterval(() => {
      meter.getFloatTimeDomainData(data);
      for (const v of data) peak = Math.max(peak, Math.abs(v));
    }, 50);
    await new Promise((resolve) => {
      src.onended = resolve;
      setTimeout(resolve, (buf.duration + 3) * 1000); // never hang if the context stalls and onended never fires
      src.start();
    });
    clearInterval(timer);
    window.__speaking.delete(src);
    return peak;
  };
  // Cuts whatever the bot is saying (somebody talks over it).
  window.__stopSpeak = () => { for (const s of window.__speaking ?? []) { try { s.stop(); } catch {} } };
};

// Neural voices with Piper (offline) when installed under ./piper, otherwise the plain Windows voices.
const ROOT = PATHS.root; // piper/ lives at the project root
const PIPER_EXE = join(ROOT, "piper", "piper", "piper.exe");
const PIPER_VOICES = ["es_MX-claude-high", "es_MX-ald-medium"];
const HAS_PIPER = existsSync(PIPER_EXE) && PIPER_VOICES.every((v) => existsSync(join(ROOT, "piper", `${v}.onnx`)));

export const VOICES = HAS_PIPER ? PIPER_VOICES : ["Microsoft Sabina Desktop", "Microsoft Raul"];

// Piper reads the text from stdin (never from the command line) and writes a WAV file.
function synthesizePiper(text, voice, wav) {
  return new Promise((resolve, reject) => {
    // Piper's defaults sound slow and flat; a little faster and livelier reads more naturally (override with WA_PIPER_*).
    const tune = [
      "--length_scale", process.env.WA_PIPER_SPEED ?? "0.9",
      "--noise_scale", process.env.WA_PIPER_NOISE ?? "0.8",
      "--noise_w", process.env.WA_PIPER_NOISE_W ?? "0.95",
      "--sentence_silence", "0.15",
    ];
    const child = spawn(PIPER_EXE, ["--model", join(ROOT, "piper", `${voice}.onnx`), "--output_file", wav, ...tune], {
      cwd: dirname(PIPER_EXE), // espeak-ng-data lives next to the executable
      timeout: 60000,
    });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Piper failed (${code}): ${stderr.slice(-200)}`))));
    child.stdin.end(text.replace(/\s+/g, " ").trim() + "\n", "utf8");
  });
}

// Microsoft neural voices through the Edge "read aloud" service (voice "edge:es-CL-LorenzoNeural"). Online: the text is sent
// to Microsoft. Returns base64 MP3; the page decodes it with decodeAudioData like a WAV.
// One connection per voice, reused for every sentence, and one request at a time with a small gap: opening a new connection
// for each sentence is what the service answered with 429 (too many requests).
const edgeClients = new Map();
let edgeQueue = Promise.resolve();
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

async function edgeOnce(text, voiceName) {
  let tts = edgeClients.get(voiceName);
  if (!tts) {
    tts = new MsEdgeTTS();
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    edgeClients.set(voiceName, tts);
  }
  const safe = text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
  const { audioStream } = tts.toStream(safe, { rate: Number(process.env.WA_EDGE_RATE ?? 1.0) });
  const parts = [];
  await new Promise((resolve, reject) => {
    audioStream.on("data", (d) => parts.push(d));
    audioStream.on("error", reject);
    audioStream.on("close", resolve);
  });
  if (!parts.length) throw new Error("Edge TTS returned no audio");
  return Buffer.concat(parts).toString("base64");
}

function synthesizeEdge(text, voiceName, attempts = 5) {
  const job = edgeQueue.then(async () => {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const out = await edgeOnce(text, voiceName);
        await sleepMs(400);
        return out;
      } catch (e) {
        lastError = e;
        edgeClients.delete(voiceName); // next try opens a fresh connection
        await sleepMs(1500 * attempt);
      }
    }
    throw lastError;
  });
  edgeQueue = job.catch(() => {});
  return job;
}

export async function synthesize(text, voice) {
  if (voice.startsWith("edge:")) {
    try {
      return await synthesizeEdge(text, voice.slice(5), Number(process.env.WA_EDGE_ATTEMPTS ?? 5));
    } catch (e) {
      // Only after several tries over about 20 s: speak with a local voice of the same gender rather than staying mute.
      log.warn(`tts: Edge voice failed (${e.message.slice(0, 80)}), using a local voice for this sentence`);
      const female = /Catalina|Dalia|Elena|Lorena|Paloma/i.test(voice);
      const local = female ? "es_MX-claude-high" : "es_MX-ald-medium";
      return synthesize(text, VOICES.includes(local) ? local : (VOICES.find((v) => v.startsWith("es_")) ?? VOICES[0]));
    }
  }
  const dir = await mkdtemp(join(tmpdir(), "wa-tts-"));
  const txt = join(dir, "t.txt");
  const wav = join(dir, "o.wav");
  try {
    if (voice.startsWith("es_")) {
      await synthesizePiper(text, voice, wav);
      return (await readFile(wav)).toString("base64");
    }
    await writeFile(txt, text, "utf8");
    // Text goes through a file, never the command line, so chat content can't be interpreted by the shell.
    await new Promise((resolve, reject) =>
      execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SCRIPT, voice, txt, wav], { timeout: 60000 }, (err, _o, stderr) =>
        err ? reject(new Error(`TTS failed: ${(stderr || err.message).slice(0, 200)}`)) : resolve(),
      ),
    );
    return (await readFile(wav)).toString("base64");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Runs before any page script: taps the audio of every incoming WebRTC track (the people in the bubble),
// mixes it to 16 kHz mono and hands Int16 chunks (base64) to window.__audioChunk.
export const LISTEN_INIT_SCRIPT = () => {
  // Init scripts run in every frame, and WorkAdventure has several iframes: each one would build its own capture graph
  // and push its (silent) blocks into the same stream, leaving only 1 block in 3 with sound. Only the top page listens.
  if (window.top !== window) return;
  const Orig = window.RTCPeerConnection;
  if (!Orig) return;
  // Capture options for experiments (WA_TAP in the bot): rate = AudioContext rate (0 = the browser's native one),
  // sink = "muted" | "audible" | "none" element attached to the remote track.
  const opts = window.__tapOpts ?? {};
  const ctx = new AudioContext(opts.rate === 0 ? {} : { sampleRate: opts.rate ?? 16000 });
  const mix = ctx.createGain();
  const mute = ctx.createGain();
  mute.gain.value = 0;
  // An AudioWorklet runs on the audio thread, so it keeps capturing while the main thread is busy drawing the game
  // (a ScriptProcessor runs on the main thread and dropped audio there). It sends 4096-sample blocks (256 ms).
  const workletSource = `
    class Tap extends AudioWorkletProcessor {
      constructor() { super(); this.buf = new Float32Array(4096); this.n = 0; }
      process(inputs) {
        const ch = inputs[0] && inputs[0][0];
        if (ch) for (let i = 0; i < ch.length; i++) {
          this.buf[this.n++] = ch[i];
          if (this.n === 4096) { this.port.postMessage(this.buf.slice()); this.n = 0; }
        }
        return true;
      }
    }
    registerProcessor("tap", Tap);`;
  ctx.audioWorklet
    .addModule(URL.createObjectURL(new Blob([workletSource], { type: "application/javascript" })))
    .then(() => {
      const tap = new AudioWorkletNode(ctx, "tap");
      tap.port.onmessage = (e) => {
        let f = e.data;
        const ratio = Math.round(ctx.sampleRate / 16000);
        if (ratio > 1) { // native rate (e.g. 48 kHz): average groups of samples down to 16 kHz
          const down = new Float32Array(Math.floor(f.length / ratio));
          for (let i = 0; i < down.length; i++) { let sum = 0; for (let k = 0; k < ratio; k++) sum += f[i * ratio + k]; down[i] = sum / ratio; }
          f = down;
        }
        const i16 = new Int16Array(f.length);
        for (let i = 0; i < f.length; i++) i16[i] = Math.max(-1, Math.min(1, f[i])) * 32767;
        const bytes = new Uint8Array(i16.buffer);
        let bin = "";
        for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
        if (window.__audioChunk) window.__audioChunk(btoa(bin));
      };
      mix.connect(tap);
      tap.connect(mute).connect(ctx.destination);
    })
    .catch((e) => console.error("audio worklet failed:", e && e.message));
  // Direct capture: each remote track is read with MediaStreamTrackProcessor, reduced to 16 kHz mono and queued; every
  // 256 ms one block per track is taken, the tracks are summed, and the result goes to window.__audioChunk.
  const BLOCK = 4096;
  const queues = []; // { chunks: Float32Array[], size }
  window.__tapStats = { tracks: 0, frames: 0, sent: 0, error: "" };
  const send = (f) => {
    window.__tapStats.sent++;
    const i16 = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) i16[i] = Math.max(-1, Math.min(1, f[i])) * 32767;
    const bytes = new Uint8Array(i16.buffer);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    if (window.__audioChunk) window.__audioChunk(btoa(bin));
  };
  // A block is sent as soon as a track has 4096 samples (256 ms): no timer, so nothing is dropped when timers run late.
  // Tracks are sent independently; people rarely talk at the same time, and their blocks then just alternate.
  const drain = (q) => {
    while (q.size >= BLOCK) {
      const out = new Float32Array(BLOCK);
      let need = BLOCK, o = 0;
      while (need > 0) {
        const c = q.chunks[0];
        const take = Math.min(need, c.length);
        out.set(c.subarray(0, take), o);
        o += take; need -= take; q.size -= take;
        if (take === c.length) q.chunks.shift(); else q.chunks[0] = c.subarray(take);
      }
      send(out);
    }
  };
  function tapTrack(track) {
    window.__tapStats.tracks++;
    const q = { chunks: [], size: 0 };
    queues.push(q);
    const reader = new MediaStreamTrackProcessor({ track }).readable.getReader();
    (async () => {
      for (;;) {
        const { value: data, done } = await reader.read();
        if (done) break;
        const ratio = data.sampleRate / 16000;
        const mono = new Float32Array(data.numberOfFrames);
        const plane = new Float32Array(data.numberOfFrames);
        for (let ch = 0; ch < data.numberOfChannels; ch++) {
          data.copyTo(plane, { planeIndex: ch, format: "f32-planar" });
          for (let i = 0; i < mono.length; i++) mono[i] += plane[i] / data.numberOfChannels;
        }
        const n = Math.floor(mono.length / ratio);
        const down = new Float32Array(n);
        for (let i = 0; i < n; i++) { // box filter: average the samples that fall in each 16 kHz sample
          const a = Math.floor(i * ratio), b = Math.max(a + 1, Math.floor((i + 1) * ratio));
          let s = 0;
          for (let k = a; k < b && k < mono.length; k++) s += mono[k];
          down[i] = s / (b - a);
        }
        window.__tapStats.frames++;
        data.close();
        q.chunks.push(down);
        q.size += n;
        drain(q);
      }
    })().catch((e) => { window.__tapStats.error = String(e && e.message); console.error("track capture stopped:", e && e.message); });
  }
  // Capture variants (switchable at runtime with window.__applyTap(name)); the bot cycles through them to compare.
  //   own-muted          my muted <audio> + MediaStreamSource            (the original method)
  //   own-audible        same, element not muted (volume 0.05)
  //   own-audible-keep   same, and the app's own <audio> left playing
  //   app-element        MediaElementSource on the app's own <audio>
  const elementNodes = new WeakMap(); // createMediaElementSource may only be called once per element
  let current = { nodes: [], els: [], paused: [] };
  const appElementsFor = (track) =>
    [...document.querySelectorAll("audio, video")].filter(
      (el) => !(window.__sinks ?? []).includes(el) && el.srcObject && el.srcObject.getAudioTracks && el.srcObject.getAudioTracks().some((t) => t.id === track.id),
    );
  // Self-test of the capture chain: feeds a tone generated here into the same graph (no remote audio involved).
  window.__selfTest = (ms) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.3;
    osc.frequency.value = 440;
    osc.connect(g).connect(mix);
    ctx.resume();
    osc.start();
    setTimeout(() => { osc.stop(); osc.disconnect(); g.disconnect(); }, ms);
  };
  window.__applyTap = (variant) => {
    for (const n of current.nodes) { try { n.disconnect(); } catch {} }
    for (const el of current.els) { el.pause(); el.srcObject = null; }
    for (const el of current.paused) { el.muted = false; el.play().catch(() => {}); }
    current = { nodes: [], els: [], paused: [] };
    ctx.resume();
    for (const track of (window.__tracks ?? []).filter((t) => t.readyState === "live")) {
      const stream = new MediaStream([track]);
      if (variant === "app-element") {
        const [appEl] = appElementsFor(track);
        if (!appEl) { window.__tapMode = "app-element (no app element found)"; continue; }
        let node = elementNodes.get(appEl);
        if (!node) { node = ctx.createMediaElementSource(appEl); elementNodes.set(appEl, node); }
        node.connect(mix);
        current.nodes.push(node);
      } else {
        const el = new Audio();
        el.muted = variant === "own-muted";
        el.volume = variant === "own-muted" ? 1 : 0.05;
        el.srcObject = stream;
        (window.__sinks ??= []).push(el);
        el.play().catch(() => {});
        current.els.push(el);
        const node = ctx.createMediaStreamSource(stream);
        node.connect(mix);
        current.nodes.push(node);
        if (variant !== "own-audible-keep") {
          // two consumers of one track compete for its audio: silence the app's elements for it
          for (const delay of [0, 1000, 3000]) setTimeout(() => {
            for (const appEl of appElementsFor(track)) { if (!current.paused.includes(appEl)) current.paused.push(appEl); appEl.pause(); appEl.muted = true; }
          }, delay);
        }
      }
    }
    window.__tapMode = variant;
  };
  function Patched(...args) {
    const pc = new Orig(...args);
    (window.__pcs ??= []).push(pc);
    pc.addEventListener("track", (ev) => {
      if (ev.track.kind !== "audio") return;
      if (window.__remoteTrack) window.__remoteTrack(ev.track.readyState + "/muted=" + ev.track.muted);
      (window.__tracks ??= []).push(ev.track);
      window.__applyTap(window.__tapVariant ?? opts.variant ?? "own-muted");
    });
    return pc;
  }
  // Counters of the incoming audio over WebRTC (packets, loss, samples the decoder had to invent), summed over connections.
  window.__inboundStats = async () => {
    const t = { packets: 0, lost: 0, bytes: 0, samples: 0, concealed: 0, silentConcealed: 0, jitterDelay: 0, emitted: 0, level: 0, inserted: 0, removed: 0 };
    for (const pc of window.__pcs ?? []) {
      if (pc.connectionState === "closed") continue;
      (await pc.getStats()).forEach((r) => {
        if (r.type !== "inbound-rtp" || r.kind !== "audio") return;
        t.packets += r.packetsReceived ?? 0; t.lost += r.packetsLost ?? 0; t.bytes += r.bytesReceived ?? 0;
        t.samples += r.totalSamplesReceived ?? 0; t.concealed += r.concealedSamples ?? 0; t.silentConcealed += r.silentConcealedSamples ?? 0;
        t.jitterDelay += r.jitterBufferDelay ?? 0; t.emitted += r.jitterBufferEmittedCount ?? 0; t.level = Math.max(t.level, r.audioLevel ?? 0);
        t.inserted += r.insertedSamplesForDeceleration ?? 0; t.removed += r.removedSamplesForAcceleration ?? 0;
      });
    }
    return t;
  };
  // Total audio bytes this page has sent over WebRTC: proves whether the bot's voice really leaves the browser.
  window.__audioBytesSent = async () => {
    let bytes = 0;
    for (const pc of window.__pcs ?? []) {
      if (pc.connectionState === "closed") continue;
      (await pc.getStats()).forEach((r) => {
        if (r.type === "outbound-rtp" && r.kind === "audio") bytes += r.bytesSent ?? 0;
      });
    }
    return bytes;
  };
  Patched.prototype = Orig.prototype;
  Object.setPrototypeOf(Patched, Orig);
  window.RTCPeerConnection = Patched;
};
