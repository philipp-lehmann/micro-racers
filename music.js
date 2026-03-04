// ── SOUNDTRACK ────────────────────────────────────
// Requires @strudel/web (globals: initStrudel, evaluate, hush)
//
// Modes
//   'beat'    – drums only  (start / countdown / menus)
//   'race'    – drums + bass + melody
//   'results' – bass only  (beat and melody paused)

// All patterns use Web Audio oscillators only — no sample loading required.
// Synthesised drums:
//   kick  – low sine, fast decay
//   snare – mid square, short decay, low-pass filtered
//   hihat – high triangle, very short decay
const _DRUMS = `
  note("c1 ~ c1 ~").s("sine").gain(1.5).decay(0.1).sustain(0),
  note("~ c2 ~ c2").s("square").gain(0.55).decay(0.06).sustain(0).lpf(900),
  note("c5*8").s("triangle").gain(0.28).decay(0.025).sustain(0)`;

const _PATTERNS = {

  beat: `stack(${_DRUMS})`,

  race: `stack(
    ${_DRUMS},
    note("c2 ~ ~ ~ g1 ~ ~ ~").s("sawtooth").lpf(600).gain(0.5),
    note("c4 ~ e4 ~ g4 ~ b3 ~").s("triangle").gain(0.28).delay(0.12)
  )`,

  results: `note("c2 ~ ~ ~ g1 ~ ~ ~").s("sawtooth").lpf(400).gain(0.4)`,
};

let _mode   = null;
let _ready  = false;

async function _apply(mode) {
  if (!_ready) return;
  try {
    if (_PATTERNS[mode]) await evaluate(_PATTERNS[mode]);
    else hush();
  } catch (e) { console.warn('[music]', e); }
}

// Called from game code whenever the screen state changes
window.setMusicMode = function (mode) {
  if (mode === _mode) return;
  _mode = mode;
  _apply(mode);
};

// initStrudel() sets up repl synchronously; sample loading is async but
// evaluate() works immediately — patterns just use synth fallbacks until
// samples are ready.
initStrudel();
_ready = true;
