// ── SOUNDTRACK ────────────────────────────────────
// Dark electro — 220 BPM, D natural minor (D E F G A Bb C)
// cpm(55) = 55 cycles/min in 4/4 = 220 BPM
// Note: Bb written as "as" (A#, enharmonic) in Strudel mini-notation.
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

// ── Bass: D pedal + A–Bb–C tension movement ──────────
const _BASS  = `note("d2 d2 d2 d2 a1 a1 as1 c2").s("sawtooth").lpf(600).gain(0.55)`;

// ── Melody A pool: chiptune arpeggios (square wave) ──
// D natural minor: D E F G A Bb(as) C
const _SFX_A = `.s("square").decay(0.06).sustain(0.1).gain(0.28).lpf(2800)`;
const _MEL_A_POOL = [
  `note("d4 f4 a4 d5 c5 a4 f4 d4")${_SFX_A}`,       // Dm arpeggio up/down
  `note("a3 d4 f4 a4 g4 f4 e4 d4")${_SFX_A}`,       // low Dm, stepwise back
  `note("f4 a4 c5 f5 e5 c5 a4 f4")${_SFX_A}`,       // F major (III) arpeggio
  `note("d4 e4 f4 g4 a4 g4 f4 e4")${_SFX_A}`,       // stepwise natural minor
  `note("d5 c5 as4 a4 g4 f4 e4 d4")${_SFX_A}`,      // descending with Bb — very ominous
  `note("a4 as4 c5 d5 c5 as4 a4 g4")${_SFX_A}`,     // chromatic ascent via Bb
  `note("d4 f4 g4 a4 as4 a4 g4 f4")${_SFX_A}`,      // arch with Bb peak
  `note("g4 a4 as4 c5 d5 c5 as4 a4")${_SFX_A}`,     // rising tension through Bb
  `note("d4 a4 f4 d4 c5 as4 f4 e4")${_SFX_A}`,      // Dm bounce + Bb colour
  `note("f4 g4 a4 c5 d5 c5 a4 g4")${_SFX_A}`,       // wave, clean minor
];

// ── Melody B pool: syncopated lead lines (sawtooth) ──
const _SFX_B = `.s("sawtooth").decay(0.10).sustain(0.20).gain(0.22).lpf(2000)`;
const _MEL_B_POOL = [
  `note("d5 ~ f5 ~ a5 as5 a5 f5")${_SFX_B}`,   // Dm + Bb peak
  `note("a4 ~ c5 ~ f5 e5 d5 ~")${_SFX_B}`,     // descending feel
  `note("f5 ~ ~ d5 c5 ~ as4 ~")${_SFX_B}`,     // sparse and ominous
  `note("d5 c5 ~ as4 ~ a4 g4 f4")${_SFX_B}`,   // descending run — darkest
  `note("as4 ~ d5 ~ f5 ~ e5 d5")${_SFX_B}`,    // Bb opening, heavy
  `note("a4 ~ f4 ~ d4 ~ f4 a4")${_SFX_B}`,     // spacious Dm pendulum
  `note("c5 ~ as4 ~ a4 ~ g4 f4")${_SFX_B}`,    // stepwise dark descent
  `note("f5 e5 ~ d5 ~ c5 ~ as4")${_SFX_B}`,    // stepwise with Bb landing
  `note("a4 ~ a5 ~ g5 f5 ~ d5")${_SFX_B}`,     // octave leap then fall
  `note("d5 ~ as4 ~ g4 a4 ~ d4")${_SFX_B}`,    // Dm + Bb, octave drop
];

// ── Synth layer: i–VI–VII–i chord stabs (Dm–Bb–C–Dm) ─
const _SYNTH = `
  note("<[d3,f3,a3,d4] [as2,d3,f3,as3] [c3,e3,g3,c4] [d3,f3,a3,d4]>")
    .s("sawtooth").attack(0.03).decay(0.18).sustain(0.28).gain(0.17).lpf(1200)`;

function _buildRacePattern() {
  const pick = pool => pool[Math.floor(Math.random() * pool.length)];
  return `stack(${_KICK}, ${_SNARE}, ${_HATS}, ${_BASS}, ${pick(_MEL_A_POOL)}, ${pick(_MEL_B_POOL)}, ${_SYNTH}).cpm(${CPM})`;
}

const _PATTERNS = {
  intro:   `stack(${_KICK}).cpm(${CPM})`,
  beat:    `stack(${_KICK}, ${_SNARE}, ${_HATS}, ${_BASS}).cpm(${CPM})`,
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
    } else if (mode === 'race') {
      await evaluate(_buildRacePattern());
    } else if (_PATTERNS[mode]) {
      await evaluate(_PATTERNS[mode]);
    } else {
      hush();
    }
  } catch (e) { console.warn('[music]', e); }
}

window.setMusicMode = function (mode) {
  // Always re-pick a fresh melody when race starts, even if already in race mode.
  if (mode === _mode && mode !== 'race') return;
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
