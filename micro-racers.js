// ── CANVAS SETUP ──────────────────────────────────
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = 1600, H = 1140;  // logical canvas dimensions in pixels
canvas.width = W; canvas.height = H;

// Scale canvas to fill the browser window while preserving aspect ratio
function resize() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = (W * scale) + 'px';
  canvas.style.height = (H * scale) + 'px';
}
resize();
window.addEventListener('resize', resize);

// ── COLOR PALETTE ─────────────────────────────────
const COLORS = {
  bg:    '#000c18',  // dark navy background
  grid:  '#001628',  // subtle grid lines
  track:     '#001a28',  // track surface fill
  primary:   '#00ff88',  // primary UI green
  secondary: '#0cb566',  // secondary UI green
  dim:       '#0c6c3f',  // dimmed green
  white:     '#aaffcc',  // light text
  muted: '#fcfcfc',  // muted / inactive text
  // Player car colors: cyan, red, yellow, purple
  pc: ['#00ffff', '#ff3355', '#ffee00', '#cc44ff'],
  danger: '#ff3366', // delete / discard red
};
// Button idle-state background: 10% tint of the button's accent colour
const BTN_DIM = '1a';

// ── TRACK DATA (pre-computed) ──────────────────────
function buildTrackObj(def, isUser) {
  const spline = buildSpline(def.pts, 14);
  const edges  = buildEdges(spline);
  // Pre-compute cumulative arc-lengths so trackProgress() can work in O(n) each frame
  const cumulativeLengths = [0];
  for (let i = 1; i < spline.length; i++)
    cumulativeLengths.push(cumulativeLengths[i - 1] +
      Math.hypot(spline[i][0] - spline[i - 1][0], spline[i][1] - spline[i - 1][1]));
  // Total perimeter includes the wrap-around closing segment
  const totalLength = cumulativeLengths[cumulativeLengths.length - 1] +
    Math.hypot(spline[0][0] - spline[spline.length - 1][0], spline[0][1] - spline[spline.length - 1][1]);
  return { ...def, spline, edges, cumulativeLengths, totalLength, isUser: !!isUser };
}

let TRACKS = TRACK_DEFS.map(def => buildTrackObj(def, false));

// ── USER TRACK PERSISTENCE ─────────────────────────
const USER_TRACK_COLORS = ['#ff8822','#00ccff','#ff3366','#ffee00','#aa44ff','#bd849c'];

const USER_TRACK_NAMES = [
  { name: 'KITCHEN COUNTER',   sub: 'MIDNIGHT SPRINT'    },
  { name: 'BILLIARD TABLE 2',  sub: 'RETURN MATCH'       },
  { name: 'WORKBENCH',         sub: 'TOOL BELT CIRCUIT'  },
  { name: 'BATHROOM FLOOR',    sub: 'SLIPPERY CIRCUIT'   },
  { name: 'BREAKFAST TABLE 2', sub: 'SECOND SERVING'     },
  { name: 'GARDEN PATH',       sub: 'OUTDOOR LOOP'       },
  { name: 'WORK DESK 2',       sub: 'OVERTIME LAP'       },
  { name: 'LIVING ROOM',       sub: 'CARPET CLASSIC'     },
  { name: 'SANDBOX',           sub: 'DESERT DRIFT'       },
  { name: 'ROOFTOP',           sub: 'SKYLINE CIRCUIT'    },
  { name: 'KITCHEN TABLE',     sub: 'CRUMBS & CORNERS'   },
  { name: 'WORKBENCH 2',       sub: 'SECOND SHIFT'       },
];

function loadUserTracks() {
  try {
    const defs = JSON.parse(localStorage.getItem('mrUserTracks') || '[]');
    defs.forEach(def => TRACKS.push(buildTrackObj(def, true)));
  } catch {}
}

function persistUserTracks() {
  const defs = TRACKS.filter(t => t.isUser).map(({ name, sub, col, pts, obstacles }) => ({ name, sub, col, pts, obstacles: obstacles || [] }));
  localStorage.setItem('mrUserTracks', JSON.stringify(defs));
}

loadUserTracks();

// ── SETTINGS PERSISTENCE ──────────────────────────
function saveSettings() {
  const data = {
    playerSlots: playerSlots.map(s => ({ mode: s.mode, preset: s.preset })),
    selectedTrack,
    gameMode,
    LAPS,
    POINTS_TO_WIN,
    musicMuted,
  };
  try { localStorage.setItem('mrSettings', JSON.stringify(data)); } catch {}
}

function loadSettings() {
  try {
    const data = JSON.parse(localStorage.getItem('mrSettings') || 'null');
    if (!data) return;
    if (Array.isArray(data.playerSlots)) {
      data.playerSlots.forEach((s, i) => {
        if (playerSlots[i]) {
          playerSlots[i].mode   = s.mode   || playerSlots[i].mode;
          playerSlots[i].preset = typeof s.preset === 'number' ? s.preset : playerSlots[i].preset;
        }
      });
    }
    if (typeof data.selectedTrack === 'number') selectedTrack = Math.min(data.selectedTrack, TRACKS.length - 1);
    if (data.gameMode === 'race' || data.gameMode === 'elimination') gameMode = data.gameMode;
    if (typeof data.LAPS === 'number') LAPS = Math.max(1, Math.min(9, data.LAPS));
    if (typeof data.POINTS_TO_WIN === 'number') POINTS_TO_WIN = Math.max(1, Math.min(9, data.POINTS_TO_WIN));
    if (typeof data.musicMuted === 'boolean') {
      musicMuted = data.musicMuted;
      typeof setMusicMuted === 'function' && setMusicMuted(musicMuted);
    }
  } catch {}
}

loadSettings();

// ── HIGHSCORES ────────────────────────────────────
let highscores = {};   // { "trackName:laps": { finishTime: {time,label}, bestLap: {time,label} } }
let newRecords = {};   // same shape, truthy if record was broken this race

function loadHighscores() {
  try { highscores = JSON.parse(localStorage.getItem('mrHighscores') || '{}'); } catch {}
}

function saveHighscores() {
  localStorage.setItem('mrHighscores', JSON.stringify(highscores));
}

function checkAndSaveHighscores() {
  const key = TRACKS[selectedTrack].name + ':' + LAPS;
  if (!highscores[key]) highscores[key] = {};
  const hs = highscores[key];
  newRecords = {};

  cars.filter(c => !c.isAI).forEach(c => {
    if (c.done && c.finishTime < (hs.finishTime?.time ?? Infinity)) {
      hs.finishTime = { time: c.finishTime, label: c.label };
      newRecords.finishTime = true;
    }
    if (c.bestLap < (hs.bestLap?.time ?? Infinity)) {
      hs.bestLap = { time: c.bestLap, label: c.label };
      newRecords.bestLap = true;
    }
  });

  saveHighscores();
}

loadHighscores();


// ── INPUT ─────────────────────────────────────────
const keys = {};  // set of currently-held keyboard keys
document.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Backspace','/','Enter','Escape'].includes(e.key)) e.preventDefault();
  keys[e.key] = true;

  if (screen === 'start') {
    if (e.key === 'ArrowUp')   menuRow = (menuRow - 1 + 3) % 3;
    if (e.key === 'ArrowDown') menuRow = (menuRow + 1) % 3;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      if (menuRow === 0) {
        selectedTrack = (selectedTrack + dir + TRACKS.length) % TRACKS.length;
      } else if (menuRow === 1) {
        gameMode = gameMode === 'race' ? 'elimination' : 'race';
      } else if (gameMode === 'race') {
        LAPS = Math.max(1, Math.min(9, LAPS + dir));
      } else {
        POINTS_TO_WIN = Math.max(1, Math.min(9, POINTS_TO_WIN + dir));
      }
    }
    if (e.key === 'Enter' || e.key === ' ') {
      initRace(); countdownNum = 3; countdownTime = 0; screen = 'countdown';
      setMusicMode('beat');
    }
  }

  if ((screen === 'race' || screen === 'countdown') && e.key === 'Escape') { paused = !paused; mouse.click = false; }

  if (screen === 'editor') {
    if (e.key === 'z' || e.key === 'Z') {
      if (editTool === 'obstacle') { editObstacles.pop(); }
      else { editPts.pop(); rebuildEditorPreview(); }
    }
    if (e.key === 'Escape') screen = 'tracks';
  }
  if (screen === 'tracks' && e.key === 'Escape') screen = 'start';

  if (screen === 'race' && cars.length && cars.filter(c => !c.isAI).every(c => c.done || c.dnf)) {
    // All human players are out — any retire key skips the countdown and jumps to results
    if (CONTROLS.some(c => e.key === c.give)) {
      cars.filter(c => !c.done && !c.dnf).forEach(c => { c.dnf = true; });
      checkAndSaveHighscores();
      resultsCooldown = 0;
      screen = 'results'; setMusicMode('results');
    }
  }
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

// Keyboard bindings for each of the four player slots
const CONTROLS = [
  { up: 'ArrowUp', dn: 'ArrowDown', lt: 'ArrowLeft', rt: 'ArrowRight', give: 'Backspace', honk: '-',  boost: '.'  }, // P1: arrows
  { up: 'w',       dn: 's',         lt: 'a',          rt: 'd',         give: 'q',         honk: 'e',  boost: 'r'  }, // P2: WASD
  { up: 'i',       dn: 'k',         lt: 'j',          rt: 'l',         give: 'u',         honk: 'o',  boost: 'p'  }, // P3: IJKL
  { up: '8',       dn: '2',         lt: '4',          rt: '6',         give: '5',         honk: '0',  boost: '*'  }, // P4: numpad
];

// Mouse position tracked in logical canvas coordinates
const mouse = { x: 0, y: 0, click: false };
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left) * (W / rect.width);
  mouse.y = (e.clientY - rect.top)  * (H / rect.height);
});
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left) * (W / rect.width);
  mouse.y = (e.clientY - rect.top)  * (H / rect.height);
  mouse.click = true;
});

// ── GAME STATE ────────────────────────────────────
let screen        = 'start';  // 'start' | 'countdown' | 'race' | 'results' | 'tracks' | 'editor'
let selectedTrack = 0;        // index into TRACKS
// Per-slot config for the start screen: mode 'human'|'ai', preset index into CAR_PRESETS
let playerSlots = [
  { mode: 'human', preset: 0 },
  { mode: 'ai',    preset: 0 },
  { mode: 'ai',    preset: 0 },
  { mode: 'ai',    preset: 0 },
];
let cars          = [];       // all four car objects
let finishOrder   = [];       // car IDs in the order they finished
let raceTime      = 0;        // total elapsed race time in seconds
let countdownNum  = 3;        // current countdown digit shown (3 → 2 → 1 → GO!)
let countdownTime = 0;        // how far through the current 1-second tick (0–1)
let particles     = [];       // active particle objects
let LAPS          = 1;        // number of laps per race (user-selectable)
let titlePulse    = 0;        // animation clock for the title-screen glow
let resultsCooldown = 0;      // seconds before results buttons become clickable
let menuRow       = 0;        // which start-screen row is selected (0–2)
let editPts       = [];       // [x, y, w] points being drawn in the editor
let editPreview   = null;     // compiled track object for live preview (null if < 3 pts)
let editObstacles = [];       // {x, y, size} obstacles placed in the editor
let editTool      = 'track';  // 'track' | 'obstacle'
let musicMuted    = false;    // whether the soundtrack is muted
let paused        = false;    // whether the race is paused
let gameMode      = 'race';   // 'race' | 'elimination'
let POINTS_TO_WIN = 3;        // rounds needed to win the championship (elimination)
const ELIM_DISTANCE = 200;    // px of track distance behind leader before elimination
let scores          = [0,0,0,0]; // per-slot cumulative championship points (elimination)
let elimRoundWinner = -1;        // car id that won the last elimination round
let elimStartProgress = 0;       // track progress (0-1) where the next round's grid is placed
let elimGridOrder     = null;    // car-id order for next round grid (null = randomize)

// Cache for car preview images on the start screen, keyed "presetIdx:color"
const previewImageCache = {};
function getPreviewImage(presetIdx, color) {
  const key = presetIdx + ':' + color;
  if (!previewImageCache[key]) previewImageCache[key] = makeCarImage(CAR_PRESETS[presetIdx], color);
  return previewImageCache[key];
}
// Race-end timing for the three win conditions
let allHumansFinishedAt = -1; // raceTime when the last human crossed the line
let allOutAt            = -1; // raceTime when all cars became done or dnf
let elimDoneAt          = -1; // raceTime when elimination round reduced to 1 car
let allHumansOutAt      = -1; // raceTime when every human is done or dnf
let lastAiCullAt        = -1; // raceTime of the most recent ai cull

// ── ISOMETRIC CAMERA ──────────────────────────────
const ISO_SCALE = Math.SQRT1_2;  // cos45 = sin45 = 1/√2
let camera = { x: 800, y: 570, zoom: 0.8 };

// (physics constants, CAR_PRESETS, makeCar → cars.js)

// (obstacles global, generateObstacles, drawObstacles, resolveObstacleCollisions → obstacles.js)

/** Once all humans are out, DNFs the last-placed active car every 3 s. */
function updateAiCull() {
  if (allHumansOutAt < 0) return;
  const active = cars.filter(c => !c.done && !c.dnf);
  if (active.length <= 1) return;
  const ref = lastAiCullAt >= 0 ? lastAiCullAt : allHumansOutAt;
  if (raceTime - ref < 3) return;
  const track = TRACKS[selectedTrack];
  const last = active.reduce((worst, c) => {
    const d  = gameMode === 'elimination' ? elimDist(c,     track.totalLength) : (c.laps     + c.progress);
    const wd = gameMode === 'elimination' ? elimDist(worst, track.totalLength) : (worst.laps + worst.progress);
    return d < wd ? c : worst;
  });
  last.dnf = true;
  spawnBurst(last.x, last.y, last.color);
  lastAiCullAt = raceTime;
}

/**
 * Returns absolute distance from race start for a car in elimination mode.
 * laps starts at -1, so we add 1 so the odometer reads 0 at the start line.
 */
function elimDist(car, totalLength) {
  return (car.laps + 1 + car.progress) * totalLength;
}

/** Eliminates cars that are more than ELIM_DISTANCE px of track behind the leader. */
function updateElimination() {
  if (gameMode !== 'elimination') return;
  if (raceTime < 5) return;  // minimum round duration
  const track = TRACKS[selectedTrack];
  const active = cars.filter(c => !c.done && !c.dnf);
  if (active.length <= 1) return;
  const maxDist = Math.max(...active.map(c => elimDist(c, track.totalLength)));
  active.forEach(car => {
    if (maxDist - elimDist(car, track.totalLength) > ELIM_DISTANCE) {
      car.dnf = true;
      spawnBurst(car.x, car.y, car.color);
    }
  });
}

function initRace() {
  saveSettings();
  cars = []; finishOrder = []; raceTime = 0; particles = [];
  allHumansFinishedAt = -1; allOutAt = -1; elimDoneAt = -1; allHumansOutAt = -1; lastAiCullAt = -1; paused = false;
  generateObstacles(TRACKS[selectedTrack]);
  // Determine grid position for each car.
  // Elimination: reverse last round's finish order (last place → pole). First round: randomize.
  // Race: default order (car id = grid slot).
  let gridPosOf = i => i;
  if (gameMode === 'elimination') {
    const order = elimGridOrder || [...playerSlots.keys()].sort(() => Math.random() - 0.5);
    const posMap = {};
    order.forEach((carId, pos) => { posMap[carId] = pos; });
    gridPosOf = i => posMap[i];
  }
  playerSlots.forEach((slot, i) => {
    const isAI = slot.mode === 'ai';
    const color = isAI ? muteColor(COLORS.pc[i]) : COLORS.pc[i];
    cars.push(makeCar(i, isAI, color, slot.preset, gridPosOf(i)));
  });
  camera.x = cars.reduce((s, c) => s + c.x, 0) / cars.length;
  camera.y = cars.reduce((s, c) => s + c.y, 0) / cars.length;
  camera.zoom = 1.25;
}

// ── PARTICLES ─────────────────────────────────────

/** Emits a skid-mark particle at the car position (rate-limited by skidTimer). */
function spawnSkid(car) {
  if (car.skidTimer > 0) return;
  car.skidTimer = 0.08;
  particles.push({ x: car.x, y: car.y, life: 0.9, maxLife: 0.9, type: 'skid', color: car.color });
}

/** Emits an explosion of 28 burst particles (e.g. when a car crosses the finish line). */
function spawnBurst(x, y, color) {
  for (let i = 0; i < 28; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 110;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 0.8 + Math.random() * 0.6, maxLife: 1.4,
      type: 'burst', color,
    });
  }
}

/** Emits an expanding ring beacon when a player honks. */
function spawnHonk(x, y, color) {
  particles.push({ x, y, life: 0.65, maxLife: 0.65, type: 'honk', color });
}

// (updateCar, CAR_RADIUS, resolveCarCollisions → cars.js)


function updateParticles(dt) {
  particles.forEach(p => {
    p.life -= dt;
    if (p.type === 'burst') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 60 * dt;  // gravity pulls burst particles downward
    }
  });
}

// ── DRAW ─────────────────────────────────────────

function drawBg() {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  // Subtle dot-grid for the retro aesthetic
  ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 0.5;
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

function drawTrack(track, alpha) {
  if (alpha === undefined) alpha = 1;
  ctx.save(); ctx.globalAlpha = alpha;
  const { spline, edges, col } = track;
  const numPts = spline.length;

  // Fill the track surface; even-odd rule handles the figure-8 self-intersection correctly
  ctx.beginPath();
  ctx.moveTo(edges.leftEdge[0][0], edges.leftEdge[0][1]);
  for (let i = 1; i < numPts; i++) ctx.lineTo(edges.leftEdge[i][0], edges.leftEdge[i][1]);
  ctx.closePath();
  ctx.moveTo(edges.rightEdge[0][0], edges.rightEdge[0][1]);
  for (let i = 1; i < numPts; i++) ctx.lineTo(edges.rightEdge[i][0], edges.rightEdge[i][1]);
  ctx.closePath();
  ctx.fillStyle = COLORS.track; ctx.fill('evenodd');

  // Glowing coloured edge lines
  [edges.leftEdge, edges.rightEdge].forEach(edge => {
    ctx.beginPath(); ctx.moveTo(edge[0][0], edge[0][1]);
    for (let i = 1; i < numPts; i++) ctx.lineTo(edge[i][0], edge[i][1]);
    ctx.closePath();
    ctx.strokeStyle = col; ctx.lineWidth = 1.6;
    ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
  });

  // Dashed centerline
  ctx.setLineDash([10, 24]); ctx.strokeStyle = '#002a1a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(spline[0][0], spline[0][1]);
  for (let i = 1; i < numPts; i++) ctx.lineTo(spline[i][0], spline[i][1]);
  ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);

  // Chequered start/finish line drawn across the track at spline index 0
  const lx = edges.leftEdge[0][0],  ly = edges.leftEdge[0][1];
  const rx = edges.rightEdge[0][0], ry = edges.rightEdge[0][1];
  const lineAngle  = Math.atan2(ry - ly, rx - lx);
  const lineLength = Math.hypot(rx - lx, ry - ly);
  const squareSize = 7;
  const numSquares = Math.floor(lineLength / squareSize);
  ctx.save(); ctx.translate(lx, ly); ctx.rotate(lineAngle);
  for (let i = 0; i < numSquares; i++) {
    ctx.fillStyle = (i % 2 === 0) ? '#ffffff' : '#111111';
    ctx.fillRect(i * squareSize, -squareSize / 2, squareSize, squareSize);
  }
  ctx.restore();
  ctx.restore();
}

function drawParticles() {
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    const fadeAlpha = p.life / p.maxLife;
    ctx.save(); ctx.globalAlpha = fadeAlpha;
    if (p.type === 'burst') {
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3 * fadeAlpha, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'honk') {
      const t = 1 - p.life / p.maxLife;  // 0 → 1 as particle ages
      const radius = t * 70;
      ctx.strokeStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = p.color; ctx.font = 'bold 13px Courier New';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('HONK', p.x, p.y - radius * 0.55);
    } else {
      // Skid marks: hollow ring that fades out in place
      ctx.strokeStyle = p.color + '44'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  });
}

// (drawCar → cars.js)

/** Converts a world-space point to screen-space under the current iso camera. */
function worldToScreen(wx, wy) {
  const dx = (wx - camera.x) * camera.zoom;
  const dy = (wy - camera.y) * camera.zoom;
  return {
    x: W / 2 + (dx - dy) * ISO_SCALE,
    y: H / 2 + (dx + dy) * 0.5 * ISO_SCALE,
  };
}

/** Smooth-follows the centroid of human players and adjusts zoom for spread. */
function updateCamera(dt) {
  const maxZoom = 2.25;
  const minZoom = 0.5;

  // During elimination countdown: lock onto the winner and zoom in hard
  if (elimDoneAt >= 0 && gameMode === 'elimination') {
    const track = TRACKS[selectedTrack];
    const winner = cars.filter(c => !c.done && !c.dnf)[0]
      || [...cars].sort((a, b) => elimDist(b, track.totalLength) - elimDist(a, track.totalLength))[0];
    const lerpSpeed = 3;
    camera.x += (winner.x - camera.x) * lerpSpeed * dt;
    camera.y += (winner.y - camera.y) * lerpSpeed * dt;
    camera.zoom += (maxZoom * 2 - camera.zoom) * lerpSpeed * dt;
    return;
  }
  const humanCars = cars.filter(c => !c.isAI);
  const activeHumans = humanCars.filter(c => !c.done && !c.dnf);
  let targets;
  if (activeHumans.length) {
    targets = activeHumans;
  } else if (humanCars.length) {
    // All humans are out — follow the leading active car instead
    const track = TRACKS[selectedTrack];
    const active = cars.filter(c => !c.done && !c.dnf);
    const pool = active.length ? active : cars;
    const leader = pool.reduce((best, c) => {
      const d = gameMode === 'elimination'
        ? elimDist(c, track.totalLength)
        : (c.laps + c.progress);
      const bd = gameMode === 'elimination'
        ? elimDist(best, track.totalLength)
        : (best.laps + best.progress);
      return d > bd ? c : best;
    });
    targets = [leader];
  } else {
    targets = cars;
  }
  const cx = targets.reduce((s, c) => s + c.x, 0) / targets.length;
  const cy = targets.reduce((s, c) => s + c.y, 0) / targets.length;
  let spread = 0;
  if (targets.length > 1) {
    const xs = targets.map(c => c.x), ys = targets.map(c => c.y);
    spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  }
  // Speed-based zoom: close when slow, pulls back at full throttle
  const avgSpeed = targets.reduce((s, c) => s + Math.abs(c.speed), 0) / targets.length;
  const speedZoom = maxZoom - (avgSpeed / MAX_SPEED) * 0.5;  // 2.25 at rest → 0.75 at max speed
  // Spread-based zoom: zoom out when players are far apart
  const spreadFactor = 560 / (spread + 560);
  const targetZoom = Math.max(minZoom, speedZoom * spreadFactor);
  const lerpSpeed = 3;
  camera.x += (cx - camera.x) * lerpSpeed * dt;
  camera.y += (cy - camera.y) * lerpSpeed * dt;
  camera.zoom += (targetZoom - camera.zoom) * lerpSpeed * dt;
}

/** Draws car labels in screen space (called after restoring the iso transform). */
function drawCarLabels() {
  cars.forEach(car => {
    const s = worldToScreen(car.x, car.y);
    ctx.save();
    ctx.font = '14px Courier New'; ctx.fillStyle = car.color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(car.label, s.x, s.y + 8);
    ctx.restore();
  });
}

function drawHUD() {
  const track = TRACKS[selectedTrack];
  const isElim = gameMode === 'elimination';

  // Sort by effective race position.
  // Elimination: use (laps+1+progress) so laps=-1 cars sort correctly against laps=0 cars.
  const sorted = [...cars].sort((a, b) => {
    const posA = isElim ? (a.laps + 1 + a.progress) : ((a.done ? LAPS + 2 : a.laps) + a.progress);
    const posB = isElim ? (b.laps + 1 + b.progress) : ((b.done ? LAPS + 2 : b.laps) + b.progress);
    return posB - posA;
  });

  // Top bar — taller in elimination mode to fit the gap row
  const topBarH = isElim ? 44 : 30;
  ctx.fillStyle = 'rgba(0,8,18,0.92)'; ctx.fillRect(0, 0, W, topBarH);
  ctx.strokeStyle = '#002230'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, topBarH); ctx.lineTo(W, topBarH); ctx.stroke();
  ctx.textBaseline = 'middle';

  // Race timer (left) and track name + leading lap (right)
  ctx.fillStyle = COLORS.primary; ctx.font = 'bold 20px Courier New'; ctx.textAlign = 'left';
  ctx.fillText('TIME  ' + formatTime(raceTime), 10, 15);
  ctx.fillStyle = track.col; ctx.font = '20px Courier New'; ctx.textAlign = 'right';
  ctx.fillText(track.name + '  L' + (Math.min(Math.max(0, sorted[0].laps) + 1, LAPS)) + '/' + LAPS, W - 10, 15);

  // Per-car standings in the centre of the top bar
  // Precompute gaps to leader for all cars
  const leaderDist = isElim
    ? elimDist(sorted[0], track.totalLength)
    : (sorted[0].laps + sorted[0].progress) * track.totalLength;

  sorted.forEach((car, i) => {
    const x = W / 2 - 155 + i * 106;
    ctx.fillStyle = car.color; ctx.font = 'bold 20px Courier New'; ctx.textAlign = 'center';
    ctx.fillText((i + 1) + '. ' + car.label, x, 10);

    // Sub-label: lap count in race mode, progress-% through current lap in elimination mode
    ctx.font = '16px Courier New';
    ctx.fillStyle = car.done ? COLORS.primary : car.dnf ? '#ff6644' : COLORS.white;
    let subLabel;
    if (car.done)       subLabel = '✓ DONE';
    else if (car.dnf)   subLabel = '✗ OUT';
    else if (isElim)    subLabel = Math.round(car.progress * 100) + '%';
    else                subLabel = 'L' + Math.min(car.laps + 1, LAPS) + '/' + LAPS;
    ctx.fillText(subLabel, x, 22);

    // Gap-to-leader row (elimination only, in the extended strip)
    if (isElim && !car.done && !car.dnf) {
      const gap = leaderDist - elimDist(car, track.totalLength);
      const danger = Math.min(1, gap / ELIM_DISTANCE);
      ctx.font = '11px Courier New';
      ctx.fillStyle = danger > 0.7 ? '#ff4444' : danger > 0.4 ? '#ffaa00' : '#448866';
      ctx.fillText(gap < 1 ? 'LEAD' : '-' + Math.round(gap) + 'px', x, 36);
    }
  });

  // Speedometer + boost bars along the bottom, one per human player
  cars.filter(c => !c.isAI).forEach(car => {
    const barW = 70, barH = 5;
    const barX = 10 + (car.id * 84), barY = H - 16;
    const speedPercent = Math.abs(car.speed) / MAX_SPEED;
    ctx.fillStyle = '#001520'; ctx.fillRect(barX, barY, barW, barH);
    // Bar colour shifts from player colour → yellow → red as speed increases
    ctx.fillStyle = speedPercent > 0.8 ? '#ff4444' : speedPercent > 0.5 ? '#ffee00' : car.color;
    ctx.fillRect(barX, barY, barW * speedPercent, barH);
    ctx.strokeStyle = car.color + '44'; ctx.lineWidth = 0.8; ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = car.done ? COLORS.primary : car.dnf ? '#ff4444' : car.color;
    ctx.font = '14px Courier New'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    const statusLabel = car.done ? 'FINISHED' : car.dnf ? 'RETIRED' : Math.abs(Math.round(car.speed));
    ctx.fillText(car.label + '  ' + statusLabel, barX, barY - 1);
    ctx.textBaseline = 'alphabetic';
    // Boost bar (above speed bar)
    const bstY = barY - 8;
    ctx.fillStyle = '#001520'; ctx.fillRect(barX, bstY, barW, 4);
    ctx.fillStyle = car.isBoosting ? '#ffffff' : '#ff9900';
    ctx.fillRect(barX, bstY, barW * car.boostCharge, 4);
    ctx.strokeStyle = '#ff990044'; ctx.lineWidth = 0.8; ctx.strokeRect(barX, bstY, barW, 4);
  });

  // Race-end countdown banners
  if (allHumansFinishedAt >= 0 && allOutAt < 0) {
    const remaining = 10 - (raceTime - allHumansFinishedAt);
    if (remaining > 0) {
      ctx.fillStyle = COLORS.primary; ctx.font = 'bold 18px Courier New';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('AI FINISHES IN  ' + remaining.toFixed(1) + 's', W / 2, H - 6);
    }
  } else if (allOutAt >= 0) {
    const remaining = 5 - (raceTime - allOutAt);
    if (remaining > 0) {
      ctx.fillStyle = '#ff6644'; ctx.font = 'bold 18px Courier New';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('RESULTS IN  ' + remaining.toFixed(1) + 's', W / 2, H - 6);
    }
  }
}

// ── SCREENS ───────────────────────────────────────
// (drawStart, drawCountdown → screens/start.js)
// (drawPause              → screens/pause.js)
// (drawResults, RES       → screens/results.js)
// (drawTracksScreen       → screens/tracks.js)
// (drawEditor             → screens/editor.js)

// ── MAIN LOOP ─────────────────────────────────────
let lastTimestamp = 0;
function loop(timestamp) {
  // Cap delta time to 50 ms to avoid a physics spiral-of-death when the tab loses focus
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
  lastTimestamp = timestamp;
  ctx.clearRect(0, 0, W, H);

  if (screen === 'start') {
    drawStart();

  } else if (screen === 'countdown') {
    if (!paused) {
      countdownTime += dt;
      if (countdownTime >= 1) { countdownTime = 0; countdownNum--; }
      if (countdownNum < 0) { screen = 'race'; setMusicMode('race'); }
      updateCamera(dt);
    }
    drawBg();
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.transform(ISO_SCALE, 0.5 * ISO_SCALE, -ISO_SCALE, 0.5 * ISO_SCALE, 0, 0);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    drawTrack(TRACKS[selectedTrack]);
    drawObstacles();
    drawParticles();
    cars.forEach(c => drawCar(c, false));
    ctx.restore();
    drawCarLabels();
    drawCountdown();
    if (paused) drawPause();

  } else if (screen === 'race') {
    if (!paused) {
      raceTime += dt;
      cars.forEach(c => updateCar(c, dt));
      resolveCarCollisions();
      resolveObstacleCollisions();
      updateElimination();
      updateAiCull();
      updateParticles(dt);
      updateCamera(dt);
    }

    // ── Win-condition tracking ────────────────────
    const humans = cars.filter(c => !c.isAI);
    // Condition 3: record when every human has crossed the finish line
    if (allHumansFinishedAt < 0 && humans.every(c => c.done && !c.dnf))
      allHumansFinishedAt = raceTime;
    // Condition 2: record when every car is out of the race (finished or retired)
    if (allOutAt < 0 && cars.every(c => c.done || c.dnf))
      allOutAt = raceTime;
    // AI cull trigger: record when every human is done or dnf
    if (allHumansOutAt < 0 && humans.length > 0 && humans.every(c => c.done || c.dnf))
      allHumansOutAt = raceTime;

    // Elimination: record when only 1 (or 0) car remains, then wait 3 s before ending
    if (gameMode === 'elimination' && elimDoneAt < 0 && raceTime > 2 &&
        cars.filter(c => !c.done && !c.dnf).length <= 1)
      elimDoneAt = raceTime;

    const shouldEnd =
      cars.every(c => c.done && !c.dnf) ||                                    // 1. all finished
      (allOutAt >= 0 && raceTime - allOutAt >= 5) ||                          // 2. all out for 5 s
      (allHumansFinishedAt >= 0 && raceTime - allHumansFinishedAt >= 10) ||   // 3. humans done 10 s
      (elimDoneAt >= 0 && raceTime - elimDoneAt >= 3);                        // 4. elimination winner (3 s delay)

    if (shouldEnd) {
      // Award elimination championship point to the round winner
      if (gameMode === 'elimination') {
        const track = TRACKS[selectedTrack];
        const active = cars.filter(c => !c.done && !c.dnf);
        const sorted = [...cars].sort((a, b) => elimDist(b, track.totalLength) - elimDist(a, track.totalLength));
        const winner = active.length > 0 ? active[0] : sorted[0];
        scores[winner.id]++;
        elimRoundWinner = winner.id;
        elimStartProgress = winner.progress;
        // Reverse finish order: last place → pole position next round
        elimGridOrder = sorted.map(c => c.id).reverse();
      }
      // DNF any cars still on-track (leaves finishTime/done unchanged for real finishers)
      cars.filter(c => !c.done && !c.dnf).forEach(c => { c.dnf = true; });
      checkAndSaveHighscores();
      resultsCooldown = 1.5;
      screen = 'results'; setMusicMode('results');
    } else {
      drawBg();
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.transform(ISO_SCALE, 0.5 * ISO_SCALE, -ISO_SCALE, 0.5 * ISO_SCALE, 0, 0);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-camera.x, -camera.y);
      drawTrack(TRACKS[selectedTrack]);
      drawObstacles();
      drawParticles();
      cars.forEach(c => drawCar(c, false));
      ctx.restore();
      drawCarLabels();
      drawHUD();
    }
    if (paused) drawPause();

  } else if (screen === 'results') {
    const wasWaiting = resultsCooldown > 0;
    resultsCooldown = Math.max(0, resultsCooldown - dt);
    if (wasWaiting && resultsCooldown <= 0) mouse.click = false; // discard stale clicks
    // Handle button clicks before drawing so no mid-draw state changes occur
    if (resultsCooldown <= 0 && mouse.click) {
      const { btnW, btnH, btnY } = RES;
      const isChampion = gameMode === 'elimination' && scores.some(s => s >= POINTS_TO_WIN);
      if (inBox(mouse.x, mouse.y, W / 2 + 14, btnY, btnW, btnH)) {
        if (isChampion) { scores = [0,0,0,0]; elimStartProgress = 0; elimGridOrder = null; screen = 'start'; setMusicMode('beat'); }
        else { initRace(); countdownNum = 3; countdownTime = 0; screen = 'countdown'; setMusicMode('beat'); }
      } else if (inBox(mouse.x, mouse.y, W / 2 - 220, btnY, btnW, btnH)) {
        if (gameMode === 'elimination') { scores = [0,0,0,0]; elimStartProgress = 0; elimGridOrder = null; }
        screen = 'start'; setMusicMode('beat');
      }
    }
    if (screen === 'results') { updateParticles(dt); drawResults(); }

  } else if (screen === 'tracks') {
    drawTracksScreen();

  } else if (screen === 'editor') {
    const clickHandled = drawEditor();
    if (mouse.click && !clickHandled) {
      if (editTool === 'obstacle') {
        // Snap obstacle angle to nearest spline point of the current preview
        let obAngle = 0;
        if (editPreview) {
          const sp = editPreview.spline;
          let bestDist = Infinity, bestIdx = 0;
          sp.forEach((pt, i) => {
            const d = Math.hypot(pt[0] - mouse.x, pt[1] - mouse.y);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
          });
          const npt = sp[(bestIdx + 1) % sp.length];
          obAngle = Math.atan2(npt[1] - sp[bestIdx][1], npt[0] - sp[bestIdx][0]);
        }
        editObstacles.push({ x: mouse.x, y: mouse.y, size: 50, angle: obAngle });
      } else {
        editPts.push([mouse.x, mouse.y, 80]);
        rebuildEditorPreview();
      }
    }
  }

  mouse.click = false;  // consume the click so it only fires once per frame
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
