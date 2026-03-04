// ── SOUNDTRACK ────────────────────────────────────
// SwitchAngel-inspired pumping electro — 220 BPM
// cpm(55) = 55 cycles/min in 4/4 = 220 BPM
//
// Menu:    kick pulse intro (8 beats) → kick + snare + hats + bass
// Race:    full stack + 2 melody tracks + synth chord layer
// Results: bass + synth layer only

const BPM = 220;
const CPM = BPM / 4;  // 55

// ── Drums (Web Audio oscillators, no samples needed) ─
const _KICK  = `note("c0*4").s("sine").decay(0.15).sustain(0).gain(1.8)`;
const _SNARE = `note("~ c2 ~ c2").s("square").decay(0.07).sustain(0).lpf(1800).gain(0.65)`;
const _HATS  = `note("c5*16").s("triangle").decay(0.02).sustain(0).gain(0.17)`;

// ── Bass: punching 8th-note root + fifth movement ────
const _BASS  = `note("c2 c2 c2 c2 g1 g1 f1 g1").s("sawtooth").lpf(700).gain(0.5)`;

// ── Melody A: chiptune arpeggios (square wave) ───────
const _MEL_A = `
  note("c4 e4 g4 c5 b4 g4 e4 c4")
    .s("square").decay(0.06).sustain(0.1).gain(0.28).lpf(3000)`;

// ── Melody B: syncopated lead line (sawtooth) ────────
const _MEL_B = `
  note("c5 ~ e5 ~ g5 a5 g5 e5")
    .s("sawtooth").decay(0.09).sustain(0.18).gain(0.22).lpf(2200)`;

// ── Synth layer: I–V–IV–V chord stabs (4-bar loop) ──
const _SYNTH = `
  note("<[c3,e3,g3,c4] [g2,b2,d3,g3] [f2,a2,c3,f3] [g2,b2,d3,g3]>")
    .s("sawtooth").attack(0.01).decay(0.12).sustain(0.18).gain(0.18).lpf(1600)`;

const _PATTERNS = {
  intro:   `stack(${_KICK}).cpm(${CPM})`,
  beat:    `stack(${_KICK}, ${_SNARE}, ${_HATS}, ${_BASS}).cpm(${CPM})`,
  race:    `stack(${_KICK}, ${_SNARE}, ${_HATS}, ${_BASS}, ${_MEL_A}, ${_MEL_B}, ${_SYNTH}).cpm(${CPM})`,
  results: `stack(${_BASS}, ${_SYNTH}).cpm(${CPM})`,
};

// 8 beats of intro before beat + bass drop (ms)
const _INTRO_MS = 8 * 60000 / BPM;  // ~2182 ms

let _mode      = null;
let _muted     = false;
let _ready     = false;
let _beatTimer = null;

async function _apply(mode) {
  if (!_ready || _muted) return;
  clearTimeout(_beatTimer);
  try {
    if (mode === 'beat') {
      // Pulsing kick intro, then full beat+bass drops after 8 beats
      await evaluate(_PATTERNS.intro);
      _beatTimer = setTimeout(async () => {
        if (_mode === 'beat' && !_muted) await evaluate(_PATTERNS.beat);
      }, _INTRO_MS);
    } else if (_PATTERNS[mode]) {
      await evaluate(_PATTERNS[mode]);
    } else {
      hush();
    }
  } catch (e) { console.warn('[music]', e); }
}

window.setMusicMode = function (mode) {
  if (mode === _mode) return;
  _mode = mode;
  _apply(mode);
};

window.setMusicMuted = function (muted) {
  _muted = muted;
  clearTimeout(_beatTimer);
  if (_muted) hush();
  else if (_mode) _apply(_mode);
};

// Auto-start beat on the very first user interaction (browser autoplay policy)
function _onFirstInteraction() {
  if (!_mode) { _mode = 'beat'; _apply('beat'); }
}
document.addEventListener('click',   _onFirstInteraction, { once: true });
document.addEventListener('keydown', _onFirstInteraction, { once: true });

initStrudel();
_ready = true;
