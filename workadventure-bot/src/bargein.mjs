// Barge-in: decides when the person is talking over the bot. While the bot speaks, its own voice can come back through the
// other person's speakers, so a single loud chunk is not enough: the level must stay above the threshold for `chunks`
// consecutive chunks (256 ms each).
export function createBargeInDetector({ threshold, chunks = 2 }) {
  let run = 0;
  return {
    /** Feed the RMS level (0..1) of every incoming chunk; true when the person has been talking long enough. */
    feed(rms) {
      run = rms > threshold ? run + 1 : 0;
      return run >= chunks;
    },
    reset() {
      run = 0;
    },
  };
}
