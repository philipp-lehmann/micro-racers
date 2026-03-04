// ── SOUNDTRACK ────────────────────────────────────
// Requires @strudel/web (globals: initStrudel, evaluate, hush)
//
// Modes
//   'beat'    – drums only  (start / menus)
//   'race'    – drums + bass + melody  (140 BPM, BK-inspired)
//   'results' – bass only
//
// cpm(35) = 35 cycles/min in 4/4 = 140 BPM

// All patterns use Web Audio oscillators only — no sample loading required.
// Synthesised drums: kick=sine, snare=square+lpf, hihat=triangle
const _DRUMS = `
  note("c1 ~ c1 ~").s("sine").gain(1.5).decay(0.08).sustain(0),
  note("~ c2 ~ c2").s("square").gain(0.5).decay(0.05).sustain(0).lpf(900),
  note("c5*8").s("triangle").gain(0.25).decay(0.02).sustain(0)`;

// 16-note, 2-bar BK-style melody (8th notes at 140 BPM via .slow(2))
// C major, ascending runs + arpeggiated descent
const _MELODY = `
  note("a5 c6 e6 c6 a5 c6 e6 g6 f6 a6 f6 d6 e6 g6 e6 c6")
    .s("triangle").gain(0.28).decay(0.1).sustain(0.18).slow(2)`;

const _BASS = `note("c3 ~ ~ c3 g2 ~ ~ g2").s("sawtooth").lpf(700).gain(0.42)`;

const _PATTERNS = {
  beat:    `stack(${_DRUMS}).cpm(50)`,
  race:    `stack(${_DRUMS}, ${_BASS}, ${_MELODY}).cpm(50)`,
  results: `${_BASS}.lpf(400).gain(0.38).cpm(50)`,
};

let _mode  = null;
let _muted = false;
let _ready = false;

async function _apply(mode) {
  if (!_ready || _muted) return;
  try {
    if (_PATTERNS[mode]) await evaluate(_PATTERNS[mode]);
    else hush();
  } catch (e) { console.warn('[music]', e); }
}

// Called from game code on screen transitions
window.setMusicMode = function (mode) {
  if (mode === _mode) return;
  _mode = mode;
  _apply(mode);
};

// Toggle mute; returns new muted state
window.setMusicMuted = function (muted) {
  _muted = muted;
  if (_muted) hush();
  else if (_mode) _apply(_mode);
};

// Auto-start beat on the very first user interaction (satisfies browser autoplay policy)
function _onFirstInteraction() {
  if (!_mode) { _mode = 'beat'; _apply('beat'); }
}
document.addEventListener('click',   _onFirstInteraction, { once: true });
document.addEventListener('keydown', _onFirstInteraction, { once: true });

// initStrudel() sets up repl synchronously; evaluate() is ready immediately.
initStrudel();
_ready = true;
