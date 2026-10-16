// State shared between the modules (listening, movement, chat). Everything that more than one of them reads or writes lives here.
export const state = {
  botSpeaking: false, // the bot's own voice is playing: incoming audio is ignored (echo guard)
  mutedUntil: 0, // and for a moment after it stops, while its echo reaches the other side
  sttPending: 0, // voice segments waiting for / being transcribed by Whisper
  lastLoud: 0, // last time someone was audibly talking
  lastChat: 0, // last time a chat message arrived
  chatReady: false, // the bubble chat panel is open
  bargeInAt: 0, // last time the person interrupted the bot (its voice was cut)
  // Things people said out loud, waiting for the chat loop to answer them:
  // { text, segmentAt, speechEndAt, sttStartAt, sttEndAt } (epoch ms; speechEndAt is estimated from the VAD)
  inbox: [],
};

// Answer only once the person has stopped talking and everything they said has been transcribed.
export const voiceQuiet = () => state.sttPending === 0 && Date.now() - state.lastLoud > 1300;
