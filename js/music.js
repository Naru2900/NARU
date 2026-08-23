/* =========================================================
   NARU — Web Audio Mini-Jukebox
   Plays a short looping electronic melody using only the
   browser's Web Audio API. No external files, no paid API.
   ========================================================= */

const NaruMusic = (() => {
  let ctx = null;
  let playing = false;
  let loopTimer = null;

  // A 4-bar pentatonic riff, frequencies in Hz.
  const MELODY = [
    261.63, 329.63, 392.0, 523.25,
    392.0, 329.63, 261.63, 293.66,
    329.63, 392.0, 329.63, 293.66,
    261.63, 220.0, 196.0, 220.0,
  ];

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  function playNote(freq, start, duration) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function scheduleLoop() {
    if (!playing || !ctx) return;
    let now = ctx.currentTime + 0.05;
    for (let i = 0; i < MELODY.length; i++) {
      playNote(MELODY[i], now + i * 0.22, 0.22);
    }
    loopTimer = setTimeout(scheduleLoop, MELODY.length * 220 + 60);
  }

  function start() {
    const ac = ensureContext();
    if (!ac) return false;
    if (playing) return true;

    playing = true;
    if (ac.state === "suspended") {
      try {
        ac.resume();
      } catch (err) {
        /* resume is async; keep going anyway */
      }
    }
    scheduleLoop();
    return true;
  }

  function stop() {
    playing = false;
    if (loopTimer) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }
    // Silence the current audio quickly.
    if (ctx && ctx.state === "running") {
      try {
        ctx.close();
      } catch (err) {
        /* ignore */
      }
      ctx = null;
    }
  }

  function isPlaying() {
    return playing;
  }

  return { start, stop, isPlaying };
})();