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
  const defs = TRACKS.filter(t => t.isUser).map(({ name, sub, col, pts }) => ({ name, sub, col, pts }));
  localStorage.setItem('mrUserTracks', JSON.stringify(defs));
}

loadUserTracks();

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
    if (e.key === 'ArrowUp')   menuRow = (menuRow - 1 + 2) % 2;
    if (e.key === 'ArrowDown') menuRow = (menuRow + 1) % 2;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      if (menuRow === 0) {
        selectedTrack = (selectedTrack + dir + TRACKS.length) % TRACKS.length;
      } else {
        LAPS = Math.max(1, Math.min(9, LAPS + dir));
      }
    }
    if (e.key === 'Enter' || e.key === ' ') {
      initRace(); countdownNum = 3; countdownTime = 0; screen = 'countdown';
      setMusicMode('beat');
    }
  }

  if (screen === 'race' && e.key === 'Escape') { paused = !paused; mouse.click = false; }

  if (screen === 'editor') {
    if (e.key === 'z' || e.key === 'Z') { editPts.pop(); rebuildEditorPreview(); }
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
let musicMuted    = false;    // whether the soundtrack is muted
let paused        = false;    // whether the race is paused

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

// ── ISOMETRIC CAMERA ──────────────────────────────
const ISO_SCALE = Math.SQRT1_2;  // cos45 = sin45 = 1/√2
let camera = { x: 800, y: 570, zoom: 0.8 };

// (physics constants, CAR_PRESETS, makeCar → cars.js)
function initRace() {
  cars = []; finishOrder = []; raceTime = 0; particles = [];
  allHumansFinishedAt = -1; allOutAt = -1; paused = false;
  playerSlots.forEach((slot, i) => {
    const isAI = slot.mode === 'ai';
    const color = isAI ? muteColor(COLORS.pc[i]) : COLORS.pc[i];
    cars.push(makeCar(i, isAI, color, slot.preset));
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
  const humanCars = cars.filter(c => !c.isAI);
  const targets = humanCars.length ? humanCars : cars;
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
  // Sort by effective race position (done cars rank above active ones)
  const sorted = [...cars].sort((a, b) => {
    const posA = (a.done ? LAPS + 2 : a.laps) + a.progress;
    const posB = (b.done ? LAPS + 2 : b.laps) + b.progress;
    return posB - posA;
  });

  // Top bar
  ctx.fillStyle = 'rgba(0,8,18,0.92)'; ctx.fillRect(0, 0, W, 30);
  ctx.strokeStyle = '#002230'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(W, 30); ctx.stroke();
  ctx.textBaseline = 'middle';

  // Race timer (left) and track name + leading lap (right)
  ctx.fillStyle = COLORS.primary; ctx.font = 'bold 20px Courier New'; ctx.textAlign = 'left';
  ctx.fillText('TIME  ' + formatTime(raceTime), 10, 15);
  ctx.fillStyle = track.col; ctx.font = '20px Courier New'; ctx.textAlign = 'right';
  ctx.fillText(track.name + '  L' + (Math.min(sorted[0].laps + 1, LAPS)) + '/' + LAPS, W - 10, 15);

  // Per-car standings in the centre of the top bar
  sorted.forEach((car, i) => {
    const x = W / 2 - 155 + i * 106;
    ctx.fillStyle = car.color; ctx.font = 'bold 20px Courier New'; ctx.textAlign = 'center';
    ctx.fillText((i + 1) + '. ' + car.label, x, 10);
    ctx.font = '16px Courier New';
    ctx.fillStyle = car.done ? COLORS.primary : car.dnf ? '#ff6644' : COLORS.white;
    ctx.fillText(car.done ? '✓ DONE' : car.dnf ? '✗ OUT' : 'L' + Math.min(car.laps + 1, LAPS) + '/' + LAPS, x, 22);
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

function drawStart() {
  drawBg(); titlePulse += 0.04;
  const track = TRACKS[selectedTrack];

  // ── Layout constants ──
  const LEFT_W  = W * 0.4;           // 640px left column
  const RIGHT_W = W - LEFT_W;        // 960px right column
  const PAD     = 50;
  const ROW_W   = LEFT_W - PAD * 2;  // 540px
  const ROW_H   = 88;
  const ROW_X   = PAD;

  // Full-canvas scrim
  ctx.fillStyle = 'rgba(0,6,14,0.55)'; ctx.fillRect(0, 0, W, H);

  // ── Right column: isometric track preview ──
  ctx.save();
  ctx.beginPath(); ctx.rect(LEFT_W, 0, RIGHT_W, H); ctx.clip();

  const xs = track.spline.map(p => p[0]);
  const ys = track.spline.map(p => p[1]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const tcx = (xmin + xmax) / 2, tcy = (ymin + ymax) / 2;
  const worldSpan = (xmax - xmin) + (ymax - ymin);
  const previewPad = 110;
  const zoomX = (RIGHT_W - previewPad * 2) / (worldSpan * ISO_SCALE);
  const zoomY = (H       - previewPad * 2) / (worldSpan * 0.5 * ISO_SCALE);
  const previewZoom = Math.min(zoomX, zoomY, 1.2);

  ctx.translate(LEFT_W + RIGHT_W / 2, H / 2);
  ctx.transform(ISO_SCALE, 0.5 * ISO_SCALE, -ISO_SCALE, 0.5 * ISO_SCALE, 0, 0);
  ctx.scale(previewZoom, previewZoom);
  ctx.translate(-tcx, -tcy);
  drawTrack(track, 0.88);
  ctx.restore();

  // Track name at the bottom of the right column
  const rcx = LEFT_W + RIGHT_W / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = track.col; ctx.font = 'bold 30px Courier New';
  ctx.shadowColor = track.col; ctx.shadowBlur = menuRow === 0 ? 22 : 12;
  ctx.fillText(track.name, rcx, H - 112); ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.muted; ctx.font = '16px Courier New';
  ctx.fillText(track.sub + '  ·  ' + (selectedTrack + 1) + ' / ' + TRACKS.length, rcx, H - 82);

  // ── Title ──
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const glow = 18 + Math.sin(titlePulse) * 8;
  ctx.shadowColor = COLORS.primary; ctx.shadowBlur = glow;
  ctx.fillStyle = COLORS.primary; ctx.font = 'bold 52px Courier New';
  ctx.fillText('MICRO RACERS', ROW_X, 95); ctx.shadowBlur = 0;

  // ── Player picker cards (2 × 2 grid) ──
  const PICKERS_Y = 155;
  const CARD_GAP  = 10;
  const CARD_W    = (ROW_W - CARD_GAP) / 2;   // ≈265px
  const CARD_H    = 145;
  const HDR_H     = 36;

  for (let i = 0; i < 4; i++) {
    const col   = i % 2;
    const row   = Math.floor(i / 2);
    const cx    = ROW_X + col * (CARD_W + CARD_GAP);
    const cy    = PICKERS_Y + row * (CARD_H + CARD_GAP);
    const slot  = playerSlots[i];
    const pcol  = COLORS.pc[i];
    const isHuman = slot.mode === 'human';

    // Card border + background
    ctx.fillStyle   = pcol + (isHuman ? '22' : '0d');
    ctx.strokeStyle = pcol + (isHuman ? 'cc' : '55');
    ctx.lineWidth   = isHuman ? 2 : 1;
    ctx.fillRect(cx, cy, CARD_W, CARD_H);
    ctx.strokeRect(cx, cy, CARD_W, CARD_H);

    // Header bar — click to toggle human/ai
    const toggleHov = inBox(mouse.x, mouse.y, cx, cy, CARD_W, HDR_H);
    ctx.fillStyle = toggleHov ? pcol + '44' : pcol + '28';
    ctx.fillRect(cx, cy, CARD_W, HDR_H);
    if (mouse.click && toggleHov) slot.mode = isHuman ? 'ai' : 'human';

    // Player label (P1…P4)
    ctx.textBaseline = 'middle';
    ctx.fillStyle = pcol; ctx.font = 'bold 18px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('P' + (i + 1), cx + 12, cy + HDR_H / 2);

    // Human / AI badge
    ctx.font = 'bold 13px Courier New';
    ctx.textAlign = 'right';
    ctx.fillStyle = isHuman ? COLORS.primary : COLORS.dim;
    ctx.fillText(isHuman ? '● HUMAN' : '○  AI', cx + CARD_W - 12, cy + HDR_H / 2);

    // Car type picker — left half prev, right half next
    const pickY = cy + HDR_H;
    const pickH = CARD_H - HDR_H;
    const prevHov = inBox(mouse.x, mouse.y, cx,              pickY, CARD_W / 2, pickH);
    const nextHov = inBox(mouse.x, mouse.y, cx + CARD_W / 2, pickY, CARD_W / 2, pickH);
    if (mouse.click && prevHov) slot.preset = (slot.preset - 1 + CAR_PRESETS.length) % CAR_PRESETS.length;
    if (mouse.click && nextHov) slot.preset = (slot.preset + 1) % CAR_PRESETS.length;

    // Car preview — SVG image centered above the preset name
    const prevW = 88, prevH = 48;   // 4× the in-game 22×12 size
    const imgX  = cx + CARD_W / 2 - prevW / 2;
    const imgY  = pickY + 6;

    ctx.font = 'bold 14px Courier New'; ctx.textBaseline = 'middle';
    ctx.fillStyle = (prevHov || nextHov) ? COLORS.secondary : COLORS.dim;
    ctx.textAlign = 'left';  ctx.fillText('◀', cx + 10,          imgY + prevH / 2);
    ctx.textAlign = 'right'; ctx.fillText('▶', cx + CARD_W - 10, imgY + prevH / 2);
    const previewImg = getPreviewImage(slot.preset, pcol);
    ctx.save();
    if (previewImg && previewImg.complete && previewImg.naturalWidth > 0) {
      ctx.shadowColor = pcol; ctx.shadowBlur = isHuman ? 16 : 6;
      ctx.drawImage(previewImg, imgX, imgY, prevW, prevH);
    } else {
      // Fallback: plain colored rectangle while image loads
      ctx.fillStyle = pcol + (isHuman ? '33' : '14');
      ctx.strokeStyle = pcol + (isHuman ? 'cc' : '44'); ctx.lineWidth = 1;
      ctx.fillRect(imgX, imgY, prevW, prevH);
      ctx.strokeRect(imgX, imgY, prevW, prevH);
    }
    ctx.restore();

    ctx.font = (isHuman ? 'bold ' : '') + '13px Courier New';
    ctx.fillStyle = isHuman ? COLORS.white : COLORS.dim;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(CAR_PRESETS[slot.preset].name, cx + CARD_W / 2, imgY + prevH + 12);
  }

  // ── Keyboard-navigable rows: TRACK + LAPS ──
  const ROWS_Y  = PICKERS_Y + 2 * CARD_H + CARD_GAP + 16;
  const rowDefs = [
    { label: 'TRACK', value: track.name },
    { label: 'LAPS',  value: LAPS + (LAPS === 1 ? ' LAP' : ' LAPS') },
  ];
  rowDefs.forEach((rowDef, i) => {
    const ry  = ROWS_Y + i * (ROW_H + 8);
    const rcy = ry + ROW_H / 2;
    const hovered = inBox(mouse.x, mouse.y, ROW_X, ry, ROW_W, ROW_H);
    const sel = menuRow === i || hovered;
    if (hovered && mouse.click) {
      menuRow = i;
      const dir = mouse.x < ROW_X + ROW_W / 2 ? -1 : 1;
      if (i === 0) selectedTrack = (selectedTrack + dir + TRACKS.length) % TRACKS.length;
      else         LAPS = Math.max(1, Math.min(9, LAPS + dir));
    }
    ctx.save();
    ctx.globalAlpha = sel ? 1 : 0.9;
    ctx.fillStyle   = sel ? COLORS.primary + BTN_DIM : COLORS.secondary + BTN_DIM;
    ctx.strokeStyle = sel ? COLORS.primary            : COLORS.secondary;
    ctx.lineWidth   = sel ? 2 : 1;
    ctx.fillRect(ROW_X, ry, ROW_W, ROW_H);
    ctx.strokeRect(ROW_X, ry, ROW_W, ROW_H);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = sel ? COLORS.primary : COLORS.secondary;
    ctx.font = '15px Courier New';
    ctx.fillText(rowDef.label, ROW_X + 26, rcy);
    ctx.textAlign = 'center';
    ctx.font = (sel ? 'bold ' : '') + '28px Courier New';
    ctx.fillText('←  ' + rowDef.value + '  →', ROW_X + ROW_W / 2, rcy);
    ctx.restore();
  });

  // ── START RACE button ──
  const sbY = ROWS_Y + 2 * (ROW_H + 8) + 12;
  const startHovered = inBox(mouse.x, mouse.y, ROW_X, sbY, ROW_W, ROW_H);
  const pulse = 0.6 + 0.4 * Math.abs(Math.sin(titlePulse * 1.5));
  ctx.shadowColor = COLORS.primary; ctx.shadowBlur = startHovered ? 32 : 12 * pulse;
  ctx.fillStyle   = startHovered ? COLORS.primary : COLORS.primary + BTN_DIM;
  ctx.strokeStyle = COLORS.primary; ctx.lineWidth = 2;
  ctx.fillRect(ROW_X, sbY, ROW_W, ROW_H);
  ctx.strokeRect(ROW_X, sbY, ROW_W, ROW_H); ctx.shadowBlur = 0;
  ctx.fillStyle = startHovered ? COLORS.bg : COLORS.primary;
  ctx.font = 'bold 32px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('▶  START RACE', ROW_X + ROW_W / 2, sbY + ROW_H / 2);
  if (mouse.click && startHovered) { initRace(); countdownNum = 3; countdownTime = 0; screen = 'countdown'; setMusicMode('beat'); }

  // ── EDIT TRACKS button ──
  const etY = sbY + ROW_H + 8;
  const etH = 50;
  const editTracksHovered = inBox(mouse.x, mouse.y, ROW_X, etY, ROW_W, etH);
  ctx.fillStyle   = editTracksHovered ? COLORS.secondary : COLORS.secondary + BTN_DIM;
  ctx.strokeStyle = COLORS.secondary; ctx.lineWidth = 1.5;
  if (editTracksHovered) { ctx.shadowColor = COLORS.secondary; ctx.shadowBlur = 10; }
  ctx.fillRect(ROW_X, etY, ROW_W, etH);
  ctx.strokeRect(ROW_X, etY, ROW_W, etH); ctx.shadowBlur = 0;
  ctx.fillStyle = editTracksHovered ? COLORS.bg : COLORS.secondary;
  ctx.font = 'bold 20px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✎  EDIT TRACKS', ROW_X + ROW_W / 2, etY + etH / 2);
  if (mouse.click && editTracksHovered) screen = 'tracks';

  // ── MUTE button ──
  const muteY = etY + etH + 8;
  const muteH = 38;
  const muteHov = inBox(mouse.x, mouse.y, ROW_X, muteY, ROW_W, muteH);
  const muteCol = musicMuted ? COLORS.danger : COLORS.secondary;
  ctx.fillStyle   = muteHov ? muteCol : muteCol + BTN_DIM;
  ctx.strokeStyle = muteCol; ctx.lineWidth = 1;
  ctx.fillRect(ROW_X, muteY, ROW_W, muteH);
  ctx.strokeRect(ROW_X, muteY, ROW_W, muteH);
  ctx.fillStyle = muteHov ? COLORS.bg : muteCol;
  ctx.font = 'bold 16px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(musicMuted ? '♪  SOUND OFF' : '♪  SOUND ON', ROW_X + ROW_W / 2, muteY + muteH / 2);
  if (mouse.click && muteHov) {
    musicMuted = !musicMuted;
    typeof setMusicMuted === 'function' && setMusicMuted(musicMuted);
  }

  // ── Footer ──
  ctx.fillStyle = COLORS.secondary; ctx.fillRect(0, H - 62, W, 62);
  ctx.strokeStyle = COLORS.secondary; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, H - 62); ctx.lineTo(W, H - 62); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.secondary; ctx.font = '16px Courier New';
  ctx.fillText('↑↓ CHANGE ROW   ← → CHANGE VALUE   ↵ ENTER START', W / 2, H - 42);
  ctx.fillStyle = '#002a20'; ctx.font = '13px Courier New';
  ctx.fillText('IN RACE   P1 ↑↓←→ //BOOST   P2 WASD R/BOOST   P3 IJKL P/BOOST   P4 NUM8426 */BOOST   BKSP/Q/U/5 RETIRE', W / 2, H - 16);
}

function drawCountdown() {
  ctx.fillStyle = 'rgba(0,8,18,0.50)'; ctx.fillRect(0, 0, W, H);
  const label = countdownNum > 0 ? String(countdownNum) : 'GO!';
  // Number scales in from large to normal over each one-second tick
  const progress = 1 - countdownTime;
  const scale = 0.7 + 0.3 * progress;
  const alpha = Math.min(1, progress * 2);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.translate(W / 2, H / 2); ctx.scale(scale, scale);
  ctx.fillStyle   = countdownNum > 0 ? COLORS.white : COLORS.primary;
  ctx.shadowColor = countdownNum > 0 ? COLORS.white : COLORS.primary; ctx.shadowBlur = 80;
  ctx.font = 'bold 140px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0); ctx.shadowBlur = 0; ctx.restore();
  ctx.fillStyle = '#334455'; ctx.font = '20px Courier New';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (countdownNum > 0) ctx.fillText('GET READY  ·  ' + LAPS + ' LAPS', W / 2, H / 2 + 90);
}

// ── PAUSE MENU ────────────────────────────────────
function drawPause() {
  // Dark overlay
  ctx.fillStyle = 'rgba(0,10,18,0.72)';
  ctx.fillRect(0, 0, W, H);

  const panW = 380, panH = 310;
  const panX = W / 2 - panW / 2, panY = H / 2 - panH / 2;

  // Panel background + border
  ctx.fillStyle = '#001520';
  ctx.fillRect(panX, panY, panW, panH);
  ctx.strokeStyle = COLORS.primary; ctx.lineWidth = 1.5;
  ctx.strokeRect(panX, panY, panW, panH);

  // Title
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = COLORS.primary; ctx.shadowBlur = 18;
  ctx.fillStyle = COLORS.primary; ctx.font = 'bold 36px Courier New';
  ctx.fillText('PAUSED', W / 2, panY + 50);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#334455'; ctx.font = '14px Courier New';
  ctx.fillText('ESC  to resume', W / 2, panY + 80);

  // Buttons
  const btnW = 300, btnH = 48;
  const btnX = W / 2 - btnW / 2;
  const pauseBtns = [
    { l: 'RESUME RACE ▶',                          y: panY + 110, col: COLORS.primary   },
    { l: musicMuted ? '♪  SOUND OFF' : '♪  SOUND ON', y: panY + 170, col: musicMuted ? COLORS.danger : COLORS.secondary },
    { l: 'QUIT TO MENU',                            y: panY + 230, col: COLORS.danger    },
  ];

  pauseBtns.forEach(btn => {
    const hov = inBox(mouse.x, mouse.y, btnX, btn.y, btnW, btnH);
    ctx.fillStyle   = hov ? btn.col : btn.col + BTN_DIM;
    ctx.strokeStyle = btn.col; ctx.lineWidth = 1.5;
    if (hov) { ctx.shadowColor = btn.col; ctx.shadowBlur = 10; }
    ctx.fillRect(btnX, btn.y, btnW, btnH);
    ctx.strokeRect(btnX, btn.y, btnW, btnH);
    ctx.shadowBlur = 0;
    ctx.fillStyle = hov ? COLORS.bg : btn.col;
    ctx.font = 'bold 18px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(btn.l, W / 2, btn.y + btnH / 2);

    if (mouse.click && hov) {
      if (btn.l.startsWith('RESUME')) {
        paused = false;
      } else if (btn.l.includes('SOUND')) {
        musicMuted = !musicMuted;
        typeof setMusicMuted === 'function' && setMusicMuted(musicMuted);
      } else if (btn.l.startsWith('QUIT')) {
        paused = false;
        screen = 'start'; setMusicMode('beat');
      }
    }
  });
}

// Layout constants shared between drawResults and the click handler
const RES = {
  tableW:   800,
  get tableX() { return W / 2 - this.tableW / 2; },  // 400
  COL: { pos: 0, driver: 90, time: 330, lap: 530, prog: 690 },
  progBarW: 110,
  rowH:     120,
  headerY:  108,   // top of the column-label row
  get rowsY()  { return this.headerY + 22; },  // top of first data row
  btnW: 198, btnH: 44,
  get btnY()   { return this.rowsY + 4 * this.rowH + 30; },
};

function drawResults() {
  drawBg(); drawTrack(TRACKS[selectedTrack], 0.18); drawParticles();
  ctx.fillStyle = 'rgba(0,6,14,0.92)'; ctx.fillRect(0, 0, W, H);
  const track = TRACKS[selectedTrack];

  // ── Title ──────────────────────────────────────
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = COLORS.primary; ctx.shadowBlur = 22;
  ctx.fillStyle = COLORS.primary; ctx.font = 'bold 38px Courier New';
  ctx.fillText('RACE COMPLETE', W / 2, 52); ctx.shadowBlur = 0;
  ctx.fillStyle = track.col; ctx.font = '18px Courier New';
  ctx.fillText(track.name + '  ·  ' + track.sub + '  ·  ' + LAPS + ' LAP' + (LAPS > 1 ? 'S' : ''), W / 2, 78);
  ctx.strokeStyle = '#002530'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(50, 92); ctx.lineTo(W - 50, 92); ctx.stroke();

  // ── Column headers ──────────────────────────────
  const { tableX, tableW, COL, progBarW, rowH, headerY, rowsY, btnY, btnW, btnH } = RES;
  ctx.textBaseline = 'middle'; ctx.fillStyle = '#004433'; ctx.font = '14px Courier New';
  [['POS', COL.pos + 45, 'center'], ['DRIVER', COL.driver, 'left'],
   ['FINISH TIME', COL.time, 'left'], ['BEST LAP', COL.lap, 'left'],
   ['PROGRESS', COL.prog, 'left']].forEach(([label, cx, align]) => {
    ctx.textAlign = align;
    ctx.fillText(label, tableX + cx, headerY + 10);
  });
  ctx.strokeStyle = '#003322'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(tableX, rowsY); ctx.lineTo(tableX + tableW, rowsY); ctx.stroke();

  // ── Sort ────────────────────────────────────────
  const sorted = [...cars].sort((a, b) => {
    if (a.done !== b.done) return a.done ? -1 : 1;
    if (a.done && b.done) return a.finishTime - b.finishTime;
    return (b.laps + b.progress) - (a.laps + a.progress);
  });

  const medals = ['1ST', '2ND', '3RD', '4TH'];
  sorted.forEach((car, i) => {
    const rowY  = rowsY + i * rowH;
    const rowCY = rowY + rowH / 2;
    const isWinner = i === 0;

    // Row background / divider
    if (isWinner) {
      ctx.fillStyle   = car.color + '14'; ctx.fillRect(tableX, rowY, tableW, rowH);
      ctx.strokeStyle = car.color + '33'; ctx.lineWidth = 1; ctx.strokeRect(tableX, rowY, tableW, rowH);
    } else {
      ctx.strokeStyle = '#001e28'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tableX, rowY); ctx.lineTo(tableX + tableW, rowY); ctx.stroke();
    }

    // POS medal — centred in its column
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = car.color;
    ctx.font = (isWinner ? 'bold 30' : 'bold 22') + 'px Courier New';
    ctx.fillText(medals[i], tableX + COL.pos + 45, rowCY);

    // Driver name + type tag
    ctx.textAlign = 'left';
    ctx.fillStyle = car.color;
    ctx.font = (isWinner ? 'bold 32' : '26') + 'px Courier New';
    ctx.fillText(car.label, tableX + COL.driver, rowCY);

    // Finish time or status
    const resultText = car.done ? formatTime(car.finishTime) : car.dnf ? 'RETIRED' : 'DNF';
    ctx.fillStyle = car.done ? COLORS.white : '#445566';
    ctx.font = (isWinner ? 'bold 28' : '22') + 'px Courier New';
    ctx.fillText(resultText, tableX + COL.time, rowCY);

    // Best lap
    const lapText = car.bestLap < Infinity ? formatTime(car.bestLap) : '—';
    ctx.fillStyle = '#668877'; ctx.font = '22px Courier New';
    ctx.fillText(lapText, tableX + COL.lap, rowCY);

    // Progress bar
    const barX = tableX + COL.prog;
    const barH = 10, barY = rowCY - barH / 2;
    const progressPct = Math.min(1, (car.laps + car.progress) / LAPS);
    ctx.fillStyle = '#001520'; ctx.fillRect(barX, barY, progBarW, barH);
    const grad = ctx.createLinearGradient(barX, 0, barX + progBarW, 0);
    grad.addColorStop(0, car.color + '88'); grad.addColorStop(1, car.color);
    ctx.fillStyle = grad; ctx.fillRect(barX, barY, progBarW * progressPct, barH);
    for (let l = 1; l < LAPS; l++) {
      ctx.fillStyle = '#002535';
      ctx.fillRect(barX + progBarW / LAPS * l - .5, barY, 1, barH);
    }
    ctx.strokeStyle = car.color + '55'; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, progBarW, barH);
    ctx.fillStyle = car.color; ctx.font = '15px Courier New'; ctx.textAlign = 'left';
    ctx.fillText(Math.round(progressPct * 100) + '%', barX, rowCY + 16);
  });

  // ── Buttons ─────────────────────────────────────
  const resultBtns = [
    { l: 'RACE AGAIN ▶',   x: W / 2 + 14  },
    { l: 'CHANGE TRACK ⤨', x: W / 2 - 220 },
  ];
  const btnsReady = resultsCooldown <= 0;
  ctx.save(); ctx.globalAlpha = btnsReady ? 1 : 0.35;
  resultBtns.forEach(btn => {
    const isHovered = btnsReady && inBox(mouse.x, mouse.y, btn.x, btnY, btnW, btnH);
    ctx.fillStyle   = isHovered ? COLORS.primary : COLORS.primary + BTN_DIM;
    ctx.strokeStyle = COLORS.primary; ctx.lineWidth = 1.5;
    if (isHovered) { ctx.shadowColor = COLORS.primary; ctx.shadowBlur = 12; }
    ctx.fillRect(btn.x, btnY, btnW, btnH); ctx.strokeRect(btn.x, btnY, btnW, btnH); ctx.shadowBlur = 0;
    ctx.fillStyle = isHovered ? COLORS.bg : COLORS.primary;
    ctx.font = 'bold 20px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(btn.l, btn.x + btnW / 2, btnY + btnH / 2);
  });
  ctx.restore();
  ctx.fillStyle = '#223344'; ctx.font = '16px Courier New';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('TOTAL ELAPSED  ' + formatTime(raceTime), W / 2, btnY + btnH + 22);

  // ── Track Records ────────────────────────────────
  const hsKey = TRACKS[selectedTrack].name + ':' + LAPS;
  const hs = highscores[hsKey];
  if (hs && (hs.finishTime || hs.bestLap)) {
    const ry = btnY + btnH + 60;
    ctx.strokeStyle = '#002530'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tableX, ry - 10); ctx.lineTo(tableX + tableW, ry - 10); ctx.stroke();
    ctx.fillStyle = '#004433'; ctx.font = '14px Courier New';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('TRACK RECORDS', tableX, ry + 8);
    const gold = '#ddaa00';
    if (hs.finishTime) {
      const isNew = newRecords.finishTime;
      ctx.fillStyle = isNew ? gold : '#446655'; ctx.font = (isNew ? 'bold ' : '') + '20px Courier New';
      ctx.fillText('BEST FINISH  ' + formatTime(hs.finishTime.time) + '  ' + hs.finishTime.label + (isNew ? '  ★ NEW RECORD' : ''), tableX + 200, ry + 8);
    }
    if (hs.bestLap) {
      const isNew = newRecords.bestLap;
      ctx.fillStyle = isNew ? gold : '#446655'; ctx.font = (isNew ? 'bold ' : '') + '20px Courier New';
      ctx.fillText('BEST LAP  ' + formatTime(hs.bestLap.time) + '  ' + hs.bestLap.label + (isNew ? '  ★ NEW RECORD' : ''), tableX + 200, ry + 36);
    }
  }
}

// ── TRACKS SCREEN ─────────────────────────────────

function drawMiniTrackPreview(track, px, py, pw, ph) {
  const xs = track.spline.map(p => p[0]);
  const ys = track.spline.map(p => p[1]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const tw = xmax - xmin || 1, th = ymax - ymin || 1;
  const scale = Math.min((pw - 16) / tw, (ph - 16) / th);
  const offX = px + pw / 2 - (xmin + tw / 2) * scale;
  const offY = py + ph / 2 - (ymin + th / 2) * scale;
  ctx.save();
  ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
  ctx.translate(offX, offY); ctx.scale(scale, scale);
  drawTrack(track, 1);
  ctx.restore();
}

function drawTracksScreen() {
  drawBg();
  ctx.fillStyle = 'rgba(0,6,14,0.72)'; ctx.fillRect(0, 0, W, H);

  const HDR_H = 70;
  const PREV_W = 200, PREV_H = 120;
  const ROW_H  = 134;
  const LIST_X = 60, LIST_W = W - 120;
  const LIST_Y = HDR_H + 10;
  const MAX_ROWS = Math.floor((H - LIST_Y - 10) / ROW_H);

  // ── Header ──
  ctx.fillStyle = 'rgba(0,8,20,0.95)'; ctx.fillRect(0, 0, W, HDR_H);
  ctx.strokeStyle = '#002230'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HDR_H); ctx.lineTo(W, HDR_H); ctx.stroke();
  ctx.fillStyle = COLORS.primary; ctx.font = 'bold 32px Courier New';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.shadowColor = COLORS.primary; ctx.shadowBlur = 14;
  ctx.fillText('TRACKS', LIST_X, HDR_H / 2); ctx.shadowBlur = 0;

  // ✕ close button
  const closeW = 50, closeH = 50;
  const closeX = W - closeW - 20, closeY = (HDR_H - closeH) / 2;
  const closeHov = inBox(mouse.x, mouse.y, closeX, closeY, closeW, closeH);
  ctx.fillStyle = closeHov ? COLORS.danger : COLORS.danger + BTN_DIM;
  ctx.strokeStyle = COLORS.danger; ctx.lineWidth = 1.5;
  ctx.fillRect(closeX, closeY, closeW, closeH);
  ctx.strokeRect(closeX, closeY, closeW, closeH);
  ctx.fillStyle = closeHov ? '#fff' : COLORS.danger;
  ctx.font = 'bold 22px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✕', closeX + closeW / 2, closeY + closeH / 2);
  if (mouse.click && closeHov) { screen = 'start'; return; }

  // ── ADD NEW TRACK button ──
  const addW = 220, addH = 50;
  const addX = W - addW - 90, addY = (HDR_H - addH) / 2;
  const addHov = inBox(mouse.x, mouse.y, addX, addY, addW, addH);
  ctx.fillStyle = addHov ? COLORS.primary : COLORS.primary + BTN_DIM;
  ctx.strokeStyle = COLORS.primary; ctx.lineWidth = 1.5;
  if (addHov) { ctx.shadowColor = COLORS.primary; ctx.shadowBlur = 10; }
  ctx.fillRect(addX, addY, addW, addH);
  ctx.strokeRect(addX, addY, addW, addH); ctx.shadowBlur = 0;
  ctx.fillStyle = addHov ? COLORS.bg : COLORS.primary;
  ctx.font = 'bold 18px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('＋  ADD NEW TRACK', addX + addW / 2, addY + addH / 2);
  if (mouse.click && addHov) { editPts = []; editPreview = null; screen = 'editor'; return; }

  // ── Track list ──
  const visible = TRACKS.slice(0, MAX_ROWS);
  visible.forEach((track, i) => {
    const ry = LIST_Y + i * ROW_H;
    const isSel = (selectedTrack === i);

    // Row background
    ctx.fillStyle = isSel ? track.col + '18' : 'rgba(0,10,24,0.6)';
    ctx.strokeStyle = isSel ? track.col : '#002030';
    ctx.lineWidth = isSel ? 2 : 1;
    ctx.fillRect(LIST_X, ry, LIST_W, ROW_H - 4);
    ctx.strokeRect(LIST_X, ry, LIST_W, ROW_H - 4);

    // Mini track preview
    const prevX = LIST_X + 8, prevY = ry + (ROW_H - 4 - PREV_H) / 2;
    ctx.fillStyle = COLORS.track;
    ctx.fillRect(prevX, prevY, PREV_W, PREV_H);
    drawMiniTrackPreview(track, prevX, prevY, PREV_W, PREV_H);

    // Name / subtitle / tag
    const txtX = LIST_X + PREV_W + 24;
    const midY = ry + (ROW_H - 4) / 2;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = track.col; ctx.font = 'bold 26px Courier New';
    ctx.fillText(track.name, txtX, midY - 18);
    ctx.fillStyle = COLORS.white; ctx.font = '16px Courier New';
    ctx.fillText(track.sub, txtX, midY + 8);
    ctx.fillStyle = track.isUser ? '#00ccff' : '#445566';
    ctx.font = '16px Courier New';
    ctx.fillText(track.isUser ? '(CUSTOM)' : '(BUILT-IN)', txtX, midY + 30);

    // Click row to select track
    if (mouse.click && inBox(mouse.x, mouse.y, LIST_X, ry, LIST_W - 60, ROW_H - 4)) {
      selectedTrack = i;
    }

    // Delete button (only for user tracks)
    const delW = 44, delH = 44;
    const delX = LIST_X + LIST_W - delW - 10;
    const delY = ry + (ROW_H - 4 - delH) / 2;
    if (track.isUser) {
      const delHov = inBox(mouse.x, mouse.y, delX, delY, delW, delH);
      ctx.fillStyle = delHov ? COLORS.danger : COLORS.danger + BTN_DIM;
      ctx.strokeStyle = COLORS.danger; ctx.lineWidth = 1.5;
      ctx.fillRect(delX, delY, delW, delH);
      ctx.strokeRect(delX, delY, delW, delH);
      ctx.fillStyle = delHov ? '#fff' : COLORS.danger;
      ctx.font = 'bold 18px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✕', delX + delW / 2, delY + delH / 2);
      if (mouse.click && delHov) {
        TRACKS.splice(i, 1);
        persistUserTracks();
        selectedTrack = Math.min(selectedTrack, TRACKS.length - 1);
        return;
      }
    } else {
      // Greyed-out placeholder
      ctx.fillStyle = COLORS.danger + BTN_DIM; ctx.strokeStyle = '#002030'; ctx.lineWidth = 1;
      ctx.fillRect(delX, delY, delW, delH); ctx.strokeRect(delX, delY, delW, delH);
      ctx.fillStyle = '#223344';
      ctx.font = 'bold 18px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✕', delX + delW / 2, delY + delH / 2);
    }
  });

  if (TRACKS.length > MAX_ROWS) {
    ctx.fillStyle = '#334455'; ctx.font = '14px Courier New';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('+ ' + (TRACKS.length - MAX_ROWS) + ' more (select with keyboard on start screen)',
      W / 2, LIST_Y + MAX_ROWS * ROW_H + 12);
  }
}

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
    countdownTime += dt;
    if (countdownTime >= 1) { countdownTime = 0; countdownNum--; }
    if (countdownNum < 0) { screen = 'race'; setMusicMode('race'); }
    updateCamera(dt);
    drawBg();
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.transform(ISO_SCALE, 0.5 * ISO_SCALE, -ISO_SCALE, 0.5 * ISO_SCALE, 0, 0);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    drawTrack(TRACKS[selectedTrack]);
    drawParticles();
    cars.forEach(c => drawCar(c, false));
    ctx.restore();
    drawCarLabels();
    drawCountdown();

  } else if (screen === 'race') {
    if (!paused) {
      raceTime += dt;
      cars.forEach(c => updateCar(c, dt));
      resolveCarCollisions();
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

    const shouldEnd =
      cars.every(c => c.done && !c.dnf) ||                              // 1. all finished
      (allOutAt >= 0 && raceTime - allOutAt >= 5) ||                    // 2. all out for 5 s
      (allHumansFinishedAt >= 0 && raceTime - allHumansFinishedAt >= 10); // 3. humans done 10 s ago

    if (shouldEnd) {
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
      if      (inBox(mouse.x, mouse.y, W / 2 + 14, btnY, btnW, btnH)) { initRace(); countdownNum = 3; countdownTime = 0; screen = 'countdown'; setMusicMode('beat'); }
      else if (inBox(mouse.x, mouse.y, W / 2 - 220,  btnY, btnW, btnH)) { screen = 'start'; setMusicMode('beat'); }
    }
    if (screen === 'results') { updateParticles(dt); drawResults(); }

  } else if (screen === 'tracks') {
    drawTracksScreen();

  } else if (screen === 'editor') {
    const clickHandled = drawEditor();
    if (mouse.click && !clickHandled) {
      editPts.push([mouse.x, mouse.y, 80]);
      rebuildEditorPreview();
    }
  }

  mouse.click = false;  // consume the click so it only fires once per frame
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
