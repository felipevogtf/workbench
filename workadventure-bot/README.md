# WorkAdventure headless bot (prototype)

Joins a WorkAdventure room as a normal player with Playwright (random name + random skin), wanders, stops when someone
is near, and talks with them: it reads the bubble chat and also **listens** to their voice, and answers with text and
with **voice**. The LLM is GPT through GitHub Copilot CLI (same approach as workbench-server).

```powershell
npm install
npm run setup          # downloads Chromium for Playwright
copy .env.example .env # then edit WA_MAP_URL and anything else
npm start
```

Settings live in `.env` (documented in `.env.example`). A variable set in the shell wins over the file, so
`$env:WANDER="0"; npm start` still works for a one-off. Common ones: `HEADED=1` (watch the browser), `WANDER=0` (stand still),
`WA_VOICE=0` (text only), `RUN_SECONDS=120` (stop by itself). Run every command from the project root.

## Project layout

```
src/        the bot
  bot.mjs         entry point: wires everything together
  config.mjs      .env + every setting (the only place that knows the defaults)
  logger.mjs      logs split by function (see below)
  identity.mjs    name, gender, skin pool, voice and LLM prompt of this run
  state.mjs       state shared between the modules
  onboarding.mjs  joins the room: name, skin, camera prompt, tutorial, unmute the mic   <- WorkAdventure UI selectors live here
  movement.mjs    wandering, forbidden zones, "someone is near"
  hearing.mjs     incoming audio -> VAD -> Whisper -> things people said + audio diagnostics
  chat.mjs        chat loop: read chat/voice, ask the LLM, answer in the chat and out loud, time every stage
  brain.mjs       LLM through Copilot CLI
  listen.mjs      speech to text (Whisper) and the VAD segmenter
  voice.mjs       text to speech, the virtual microphone and the page-side audio tap
  position.mjs    player position from the game's WebSocket messages
  map.mjs         the room map: walls, furniture and areas, downloaded from the server (cached in out/map/)
  latency.mjs     statistics over latency.jsonl
  speak.ps1       Windows System.Speech fallback voice
config/     zones.json (forbidden zones), characters.json (names, skins, voices per gender)
tools/      latency-report, show-map, analyze-audio, bench-stt, make-voice-samples, run-variant.sh
test/       *.test.mjs run with `npm test`; manual/ needs the real room or a microphone; fixtures/voice has test recordings
plans/      small plans for the next changes (start with plans/README.md)
logs/       one folder per run (ignored by git)
out/        screenshots, saved audio, voice samples (ignored by git)
piper/      Piper voices and executable (ignored by git)
```

Where to look when something breaks: `logs/<run>/errors.log` (every error and warning of every channel, with its channel name),
then the channel's own log.

## Logs

Every run writes `logs/<date_time>/` with one file per function:

| File | What it holds |
|---|---|
| `system.log` | start-up, joining the room, microphone, shutdown, the settings used |
| `movement.log` | tiles it walks to (`WA_POS_LOG=1`), zones, "someone is near / nobody is talking" |
| `conversation.log` | what it heard (with Whisper time), each turn, the LLM reply, filler/voice playback, text-to-speech fallbacks |
| `audio.log` | listening diagnostics: segments, empty-block capture quality, WebRTC stats every 2 s, capture method |
| `latency.log` / `latency.jsonl` | one line per answered turn with every stage timed |
| `errors.log` | copy of every warning/error from any channel |

The terminal shows `system`, `conversation` and `latency`; `WA_LOG_CONSOLE=all` shows everything (`movement`, `audio`).

### Measuring latency
`npm run latency` prints every turn of the latest run and p50/p90/max per stage (`node tools/latency-report.mjs <run id>` for another one).
Per turn, from the moment the bot "heard" (transcript ready for speech, message seen for chat):

- `chat_ms`: heard -> reply typed in the chat. `voice_ms`: heard -> its voice starts.
- `since_speech_end_*`: same, counted from when the person stopped talking (estimated: the VAD closes a sentence after `WA_VAD_END_MS` of silence).
- Stages: `stt_ms` (Whisper), `stt_queue_ms` (waiting for Whisper), `wait_ms` (transcript ready until the chat loop starts the turn: poll every 1.5 s + waiting for silence),
  `filler_ms`, `llm_ms`, `tts_ms`, `ready_ms` (reply text and audio both ready).
- The chat message is typed as soon as the LLM answers, while the voice is still being synthesized: `chat_ms` does not include `tts_ms`, `voice_ms` does.

### Where the time goes (measured 2026-10-16)
Person stops talking -> reply in the chat takes about 11-14 s: the VAD waits ~1.1 s of silence, Whisper 1.4-2.9 s, the chat loop ~0.6-1 s, and the LLM 6.5-9 s.
Of one Copilot CLI call, the model itself works ~2.4 s; the rest is the CLI starting (~1.8 s), preparing (~2 s) and shutting down (~1.3 s, no longer waited for: the answer
is taken at its `result` event). Working directory and flags do not change it, and the CLI has no server mode. Whisper `base` is 2x faster than `small` but its
word error rate on the test recordings goes from 3% to 13% (`tiny`: 36%), so `small` stays.

### Browser vs browserless (60 s standing in the room, one run each)
| | Chromium bot (`src/bot.mjs`) | browserless (`research/no-browser/talk.mjs`) |
|---|---|---|
| processes | 8 | 2 |
| memory (working set) | 945 MB | 95 MB |
| CPU | ~290% of one core (headless Chromium draws the game) | ~0% |
| time to be in the room | ~28 s | ~2 s |
Whisper, once someone speaks, adds ~2.2 GB working set (3 GB private) to either of them.

## Talking over the bot
While the bot speaks, what it hears is normally ignored (its own voice comes back through your speakers). With `WA_BARGE_IN` on (default) the bot cuts its voice
when you keep talking louder than `WA_BARGE_IN_RMS` (0.04) for about half a second, and then listens to you; the chat message of that turn was already sent.
If its own echo cuts it off, raise `WA_BARGE_IN_RMS` or use headphones. After it stops on its own it ignores audio for `WA_ECHO_TAIL_MS` (1200 ms) and the chat loop
looks for new input every `WA_CHAT_POLL_MS` (600 ms). Interrupted turns show `interrupted: true` in `latency.jsonl`.
While it is thinking (the LLM takes 8-14 s) what you say is kept and answered in the next turn, not in parallel.

## How the voice works (no API keys)
- Speaking: Piper neural voices (offline, in ./piper: es_MX-claude-high, es_MX-ald-medium; pick with WA_VOICE_NAME), falling back to Windows System.Speech (Sabina/Raul) if ./piper is missing -> WAV -> played into a virtual microphone injected in the
  page (`voice.mjs`, replaces `getUserMedia`). The bot has no camera.
- Listening: incoming WebRTC audio is tapped in the page (`LISTEN_INIT_SCRIPT`), cut into sentences by an energy VAD and
  transcribed locally with Whisper (`listen.mjs`, `@huggingface/transformers`, model whisper-small, downloaded on first use, ~250 MB).
  Tune `WA_VAD_THRESHOLD` (default 0.012) if it misses quiet voices or hears noise, `WA_VAD_END_MS` (default 1100) for how long a pause ends a sentence; `WA_STT_MODEL` for a bigger model.

Verified on play.workadventu.re: onboarding, random name/skin, wandering, stopping near someone, chat reply (answers the
last message with conversation context), TTS, virtual mic inside the game (peak level 0.70), Whisper transcription of
synthesized Spanish speech.
The two-client test (`test/manual/test-human.mjs`, with `SPEAK="..."`) only works when both clients end up in the same bubble; to test by
hand run with `HEADED=1`, walk up to the bot and talk, then check the `heard` / `spoke` lines.

Limits:
- Voice and the bubble chat only work while someone is near the bot. The global chat needs a login.
- The mic toggle is clicked by screen position (436,47 on a 1280 px viewport); if WorkAdventure changes its toolbar, update `onboarding.mjs`.
- Use only on rooms you own or with permission; the "IA" tag keeps it clear that it is a bot.

## The room map
At start-up the bot downloads the map of the room (same files the game client loads, no login): the walls from the `collisions` layer,
the furniture from the collision grids of the placed entities, and the areas of the map editor. While wandering it does not choose a direction
with a wall or furniture within 3 tiles and stops 2 tiles before one; `movement.log` says `entered area ...` when it steps into an area.
`node tools/show-map.mjs` prints the grid (`#` wall, `f` furniture) and the areas with their tile coordinates, useful to write `config/zones.json`.
The map is cached 24 h; if it can't be read the bot walks without it as before. `WA_MAP=0` turns it off, `WA_MAP_FURNITURE=0` ignores furniture.

## Zones the bot must not enter
`config/zones.json` lists rectangles in tile coordinates (the startup map is 45x33 tiles of 32 px). The bot reads its own position
from the movement messages the game client sends over the WebSocket (`position.mjs`), stops 2 tiles before a blocked zone,
and walks out by the shortest side if it starts inside one. Optional `"home": {"x": 35, "y": 21, "radius": 12}` keeps it
within that many tiles of a point. `WA_ZONES` points to another file.

To find coordinates: `$env:WA_POS_LOG="1"; $env:HEADED="1"; $env:WANDER="0"; npm start`, click inside the bot's window and
walk it with the arrow keys; `movement.log` (and the console with `WA_LOG_CONSOLE=all`) prints `position: tile x=.. y=..`. Zones only avoid the bot's own wandering;
with the map on (above) it also avoids walls and furniture.

Standing still: when a bubble opens the bot waits while someone talks (30 s grace, 20 s after the other person leaves);
a silent bubble (another bot, someone away) does not freeze it forever.

## Checking the listening chain without WorkAdventure
`node test/manual/test-loopback.mjs "frase de prueba"` makes the virtual mic speak, sends it over a local WebRTC connection, captures it
with the same code the bot uses (AudioWorklet -> VAD -> Whisper) and prints what was understood. If this works but the bot
mishears you in the room, the problem is the real audio (echo, noise, a quiet mic), not the code: use headphones and watch the
`chunk arrival gaps` and `incoming audio level` lines in `audio.log`.

## Choosing a voice
`node tools/make-voice-samples.mjs` writes the same sentence in several voices to `out/voice-samples/` to compare by ear.
Pick one with `WA_VOICE_NAME`: local Piper (`es_MX-claude-high`, `es_MX-ald-medium`, offline) or Microsoft neural voices
(`edge:es-CL-LorenzoNeural`, `edge:es-CL-CatalinaNeural`, `edge:es-MX-JorgeNeural`, `edge:es-MX-DaliaNeural`; online: each reply's
text is sent to Microsoft, unofficial service that may rate-limit or change; falls back to Piper if it fails).
Piper is tuned livelier than its defaults (`WA_PIPER_SPEED` 0.9, `WA_PIPER_NOISE` 0.8, `WA_PIPER_NOISE_W` 0.95); `WA_EDGE_RATE` changes Edge speed.

## Characters (gender, name, skin, voice)
Each run picks a gender at random (`WA_GENDER=mujer` or `hombre` fixes it) and then a matching name, skin and voice from
`config/characters.json`: Chilean Microsoft voices (Catalina / Lorenzo), names, and the indexes of the Woka thumbnails (0-47, in grid order)
that look female or male. The skin classification was done by eye; edit the `wokas` lists if one looks wrong. WorkAdventure cuts
names at 10 characters, so names are trimmed to 7 plus " IA". The model is told its gender so it uses the right grammar.

## Measuring speech recognition
- `node tools/bench-stt.mjs`: runs `test/fixtures/voice/N.m4a` (with `N.txt` = what was really said) through Whisper base/small with several settings and prints the word error rate.
- `node test/manual/test-loopback-files.mjs`: plays the same recordings through the bot's whole listening path (virtual mic -> WebRTC -> capture -> VAD -> Whisper).
  On the first 3 test recordings both gave about 3% errors, so the engine and the code are fine; problems in a real room come from the audio itself.
- `WA_DEBUG_AUDIO=1`: the bot keeps every voice segment it hears as `out/debug-audio/NNN.wav` + `NNN.txt` (level and what Whisper understood), to inspect real-room audio.
  `node tools/analyze-audio.mjs [folder]` shows the holes (digital silence) of each saved segment.

## Fixed: audio from the room arrived with holes
In the room the bot used to receive only 1 of every 3 256 ms blocks of what people said (`00S00S00S...` in `out/debug-audio`). Cause: the
listening script is injected in every frame and WorkAdventure has several iframes; each built its own capture graph and pushed silent
blocks into the same stream. Now only the top page listens (`if (window.top !== window) return`). Found with `WA_SELFTEST=1`, which plays
a tone inside the page and counts empty blocks (~17% is normal: the tone lasts 6 of the 7.5 s measured; 69% was the bug).
Tools: `WA_DEBUG_AUDIO=1` (keep every heard segment), `WA_TAP_CYCLE=1` (compare capture methods), `tools/run-variant.sh`.

## Notes
- Spoken fillers ("mmm, a ver") are off by default; `WA_FILLER=1` turns them on.
- The Microsoft voice keeps one connection and sends requests one at a time (12 in a row worked without 429); only after 5 failed
  tries over ~20 s it falls back to the local voice of the same gender (`WA_EDGE_ATTEMPTS` changes the count).
- The bot answers anything it hears nearby, also remarks not meant for it, and ignores typical Whisper noise phrases.
