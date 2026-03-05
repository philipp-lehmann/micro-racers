// ── PHYSICS CONSTANTS ─────────────────────────────
const MAX_SPEED   = 220;  // top forward speed (px/s) — kept for HUD/collision refs
const MAX_REVERSE = 65;   // top reverse speed (px/s)
const BOOST_DRAIN  = 0.35; // boost charge consumed per second while active
const BOOST_REFILL = 0.15; // boost charge restored per second while inactive

// Gravel-trap zone: distance past the track edge where the off-track penalty
// ramps from 0 → 100 %. Beyond this zone the full penalty applies immediately.
const GRAVEL_ZONE = 40;   // px

// ── CAR PRESETS ────────────────────────────────────
// All physics parameters per car archetype. Add more entries for new car types.
//
// accel: coefficient in the quadratic-drag model  dv/dt = accel·(1-(v/top)²)
//   → reaches ~90 % top speed in (atanh(0.9) · topSpeed / accel) seconds
//   → with accel=162 and topSpeed=220 that is ~2 s; ~100 % only after ~10 s
const CAR_PRESETS = [
  {
    name:        'CLASSIC',
    svgTemplate: `<svg width="44" height="24" viewBox="0 0 44 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="4" y="5.5" width="36" height="13" rx="2" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="24" y="5.5" width="6" height="13" rx="2" fill="CARCOLOR" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="13" y="5.5" width="18" height="13" rx="2" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="7" y="2.5" width="8" height="3" rx="1.5" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="7" y="18.5" width="8" height="3" rx="1.5" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="28" y="2.5" width="8" height="3" rx="1.5" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="28" y="18.5" width="8" height="3" rx="1.5" stroke="CARCOLOR" stroke-width="1.5"/>
</svg>
`,
    topSpeed:    220,   // px/s
    accel:       162,   // quadratic-drag acceleration constant
    brake:       260,   // deceleration when braking (px/s²)
    friction:    95,    // passive drag when off throttle (px/s²)
    turnRate:    3.0,   // rad/s (scaled by speed in updateCar)
    boostFactor: 1.3,   // top-speed multiplier while boost is active
    reverseMax:  65,    // px/s
  },
  {
    name:        'FAST',
    svgTemplate: `<svg width="44" height="24" viewBox="0 0 44 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M4 8.1025C4 6.9587 4.95751 6.04788 6.09988 6.10499L38.0999 7.70499C39.1643 7.75821 40 8.63675 40 9.7025V14.2975C40 15.3632 39.1643 16.2418 38.0999 16.295L6.09988 17.895C4.95751 17.9521 4 17.0413 4 15.8975V8.1025Z" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="18" y="9" width="8" height="6" rx="2" fill="CARCOLOR" stroke="CARCOLOR" stroke-width="1.5"/>
<path d="M15 5.5C15 3.84315 13.6569 2.5 12 2.5H10C8.34315 2.5 7 3.84315 7 5.5" stroke="CARCOLOR" stroke-width="1.5"/>
<path d="M7 18.5C7 20.1569 8.34315 21.5 10 21.5H12C13.6569 21.5 15 20.1569 15 18.5" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="28" y="2.5" width="8" height="3" rx="1.5" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="28" y="18.5" width="8" height="3" rx="1.5" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="7" y="8" width="3" height="8" fill="#D9D9D9"/>
<rect x="7" y="8" width="3" height="8" rx="1.5" fill="CARCOLOR" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="38" y="10" width="2" height="4" rx="1" stroke="CARCOLOR" stroke-width="1.5"/>
</svg>
`,
    topSpeed:    310,
    accel:       220,
    brake:       190,
    friction:    65,
    turnRate:    2.2,
    boostFactor: 1.4,
    reverseMax:  40,
  },
  {
    name:        'TANK',
    svgTemplate: `<svg width="44" height="24" viewBox="0 0 44 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="4" y="4" width="36" height="16" rx="2" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="28" y="6" width="5" height="12" rx="2" fill="CARCOLOR" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="4" y="6" width="14" height="12" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="7" y="1" width="6" height="3" rx="1" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="7" y="20" width="6" height="3" rx="1" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="15" y="1" width="6" height="3" rx="1" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="15" y="20" width="6" height="3" rx="1" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="33" y="1" width="5" height="3" rx="1" stroke="CARCOLOR" stroke-width="1.5"/>
<rect x="33" y="20" width="5" height="3" rx="1" stroke="CARCOLOR" stroke-width="1.5"/>
</svg>
`,
    topSpeed:    150,
    accel:       120,
    brake:       420,
    friction:    170,
    turnRate:    4.2,
    boostFactor: 1.15,
    reverseMax:  90,
  },
];

/** Generates a colored Image from a preset's SVG template for the given color. */
function makeCarImage(preset, color) {
  const svg = preset.svgTemplate.replace(/CARCOLOR/g, color);
  const img = new Image();
  img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
  return img;
}

// ── CAR FACTORY ───────────────────────────────────
/**
 * Creates a car object positioned on the starting grid.
 * Cars are staggered in two columns (left/right) and rows (front/back)
 * just behind the start/finish line.
 */
function makeCar(id, isAI, color, presetIdx) {
  const track  = TRACKS[selectedTrack];
  const spline = track.spline;
  const row    = Math.floor(id / 2);
  const side   = (id % 2 === 0) ? -1 : 1;  // left or right of centerline
  const ROW_GAP = 50;    // px between each grid row
  const GRID_OFFSET = 20; // extra px behind start line for the front row
  const targetLen = track.totalLength - GRID_OFFSET - row * ROW_GAP;
  let startIdx = 0;
  for (let k = track.cumulativeLengths.length - 1; k >= 0; k--) {
    if (track.cumulativeLengths[k] <= targetLen) { startIdx = k; break; }
  }
  const nextPt   = spline[(startIdx + 1) % spline.length];
  const angle    = Math.atan2(nextPt[1] - spline[startIdx][1], nextPt[0] - spline[startIdx][0]);
  // Perpendicular offset direction so paired cars sit side-by-side
  const lateralX = Math.cos(angle + Math.PI / 2);
  const lateralY = Math.sin(angle + Math.PI / 2);
  const x = spline[startIdx][0] + lateralX * side * 17;
  const y = spline[startIdx][1] + lateralY * side * 17;
  return {
    id, isAI, color,
    x, y, angle,
    speed: 0, steering: 0, throttle: 0,
    laps: (typeof gameMode !== 'undefined' && gameMode === 'elimination') ? -1 : 0,
    progress:     trackProgress(x, y, track),
    lastProgress: 0,
    canCountLap:  false,   // must cross halfway before the finish line counts
    aiTarget:     (startIdx + 10) % spline.length,  // next waypoint for the AI
    onTrack:      true,
    offFraction:  0,   // 0 = fully on track, 1 = fully off; updated each frame
    stats:        CAR_PRESETS[presetIdx || 0],
    presetIdx:    presetIdx || 0,
    img:          makeCarImage(CAR_PRESETS[presetIdx || 0], color),
    done: false, dnf: false, finishTime: 0,
    label:    isAI ? 'CPU' + (id + 1) : 'P' + (id + 1),
    boostCharge: 0.5, isBoosting: false,
    skidTimer: 0, honkCooldown: 0,
    lapStart: 0, bestLap: Infinity,
  };
}

// ── CAR PHYSICS ───────────────────────────────────

/** Advances a single car's physics and AI/input state by dt seconds. */
function updateCar(car, dt) {
  if (car.done || car.dnf) return;
  const track = TRACKS[selectedTrack];

  // ── Input ──────────────────────────────────────
  if (car.isAI) {
    // Steer toward the next waypoint on the spline centerline
    const spline = track.spline;
    const target = spline[car.aiTarget];
    const dx = target[0] - car.x, dy = target[1] - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 40) car.aiTarget = (car.aiTarget + 4) % spline.length;
    let angleDiff = Math.atan2(dy, dx) - car.angle;
    // Normalize to [-π, π]
    while (angleDiff >  Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    car.steering = Math.max(-1, Math.min(1, angleDiff * 3));
    // Back off throttle when turning sharply to stay on the racing line
    car.throttle = Math.abs(angleDiff) > 0.9 ? 0.55 : 0.92;
  } else {
    const ctrl = CONTROLS[car.id];
    car.throttle = keys[ctrl.up] ? 1 : (keys[ctrl.dn] ? -1 : 0);
    car.steering = keys[ctrl.lt] ? -1 : (keys[ctrl.rt] ? 1 : 0);
    // Give up — retire from the race
    if (keys[ctrl.give]) {
      car.dnf = true;
      spawnBurst(car.x, car.y, car.color);
      return;
    }
    // Honk / beacon
    if (car.honkCooldown > 0) car.honkCooldown -= dt;
    if (keys[ctrl.honk] && car.honkCooldown <= 0) {
      car.honkCooldown = 0.5;
      spawnHonk(car.x, car.y, car.color);
    }
    // Boost
    car.isBoosting = keys[ctrl.boost] && car.boostCharge > 0;
    if (car.isBoosting) {
      car.boostCharge = Math.max(0, car.boostCharge - BOOST_DRAIN * dt);
    } else {
      car.boostCharge = Math.min(1, car.boostCharge + BOOST_REFILL * dt);
    }
  }

  // ── Speed update ───────────────────────────────
  const stats = car.stats;
  // Off-track penalty from the previous frame (one-frame lag, same as car.onTrack).
  // Smoothly reduce the effective top-speed cap as the car ventures into gravel.
  const baseTopSpeed = car.isBoosting ? stats.topSpeed * stats.boostFactor : stats.topSpeed;
  const topSpeed = baseTopSpeed - (baseTopSpeed - 90) * car.offFraction;

  if (car.throttle > 0) {
    // Quadratic-drag model: dv/dt = accel·(1-(v/topSpeed)²)
    // → reaches ~90 % top speed in ~2 s, asymptotes to 100 % over ~10 s.
    const v = Math.max(0, car.speed);
    const dragFactor = 1 - Math.pow(v / baseTopSpeed, 2);
    car.speed = Math.min(car.speed + stats.accel * car.throttle * dragFactor * dt, topSpeed);
  } else if (car.throttle < 0) {
    // Brake first; only start reversing once fully stopped
    if (car.speed > 0) car.speed = Math.max(0, car.speed - stats.brake * dt);
    else               car.speed = Math.max(-stats.reverseMax, car.speed - stats.accel * .4 * dt);
  } else {
    // Passive friction coasts the car to a stop
    const frictionDelta = stats.friction * dt;
    car.speed = Math.abs(car.speed) < frictionDelta ? 0 : car.speed - Math.sign(car.speed) * frictionDelta;
  }

  // ── Steering ───────────────────────────────────
  // Turn rate scales with speed so the car can't pirouette when almost stationary
  const speedFactor = Math.min(1, Math.abs(car.speed) / 60);
  car.angle += car.steering * stats.turnRate * speedFactor * dt;

  // ── Position ───────────────────────────────────
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(6, Math.min(W - 6, car.x));
  car.y = Math.max(6, Math.min(H - 6, car.y));

  // ── Off-track detection (gravel-zone gradient) ─
  // offFraction: 0 = fully on track, 1 = fully off.
  // Ramps linearly over GRAVEL_ZONE px past the track edge.
  const { dist: trackDist, width: localWidth } = nearestTrackPoint(car.x, car.y, track);
  const overEdge = Math.max(0, trackDist - localWidth / 2 - 3);
  car.offFraction = Math.min(1, overEdge / GRAVEL_ZONE);
  car.onTrack = car.offFraction === 0;
  if (car.offFraction > 0) {
    // Speed decay scaled by how far into the gravel zone the car is.
    // A gentle brush of the edge barely slows you; full off-track: ~85 %/s.
    car.speed *= Math.pow(0.85, 60 * dt * car.offFraction);
    if (Math.abs(car.speed) > 10) spawnSkid(car);
  }

  // ── Skid marks when cornering hard at speed ────
  if (Math.abs(car.steering) > 0.7 && Math.abs(car.speed) > 100) spawnSkid(car);
  if (car.skidTimer > 0) car.skidTimer -= dt;

  // ── Lap counting ──────────────────────────────
  car.lastProgress = car.progress;
  car.progress = trackProgress(car.x, car.y, track);

  // 1. Set the flag once the car actually crosses the halfway point from below
  if (car.progress > 0.5 && car.lastProgress < 0.5) car.canCountLap = true;

  // 2. ONLY use this block to handle lap increments
  if (car.canCountLap && car.lastProgress > 0.86 && car.progress < 0.14 && car.speed > 8) {
    const lapTime = raceTime - car.lapStart;
    if (lapTime < car.bestLap) car.bestLap = lapTime;
    car.lapStart = raceTime;
    car.laps++;
    // Reset flag so they must loop all the way around again
    car.canCountLap = false;

    if (car.laps >= LAPS && !car.done && gameMode !== "elimination") {
      car.done = true;
      car.finishTime = raceTime;
      finishOrder.push(car.id);
      spawnBurst(car.x, car.y, car.color);
    }
  }

  // 3. Penalise reversing across the start/finish line
  if (car.lastProgress < 0.14 && car.progress > 0.86 && car.speed < -5) {
    car.laps = Math.max((typeof gameMode !== 'undefined' && gameMode === 'elimination') ? -1 : 0, car.laps - 1);
  }
}

const CAR_RADIUS = 14;  // collision circle radius (cars are 22×12 px rectangles)

/** Detects and resolves car-car collisions for all active cars. */
function resolveCarCollisions() {
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.done || a.dnf) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.done || b.dnf) continue;

      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= CAR_RADIUS * 2 || dist < 0.01) continue;

      // Push cars apart so they no longer overlap
      const overlap = CAR_RADIUS * 2 - dist;
      const nx = dx / dist, ny = dy / dist;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;

      // Velocity component along the collision normal for each car
      const aN = a.speed * (Math.cos(a.angle) * nx + Math.sin(a.angle) * ny);
      const bN = b.speed * (Math.cos(b.angle) * nx + Math.sin(b.angle) * ny);
      if (aN - bN <= 0) continue;  // already separating — no impulse needed

      // Elastic impulse (restitution 0.7 — slightly inelastic for a solid feel)
      const imp = (aN - bN) * 0.85;

      // Project impulse back onto each car's own heading axis
      a.speed -= imp * (Math.cos(a.angle) * nx + Math.sin(a.angle) * ny);
      b.speed += imp * (Math.cos(b.angle) * nx + Math.sin(b.angle) * ny);
      a.speed = Math.max(-MAX_REVERSE, Math.min(MAX_SPEED, a.speed));
      b.speed = Math.max(-MAX_REVERSE, Math.min(MAX_SPEED, b.speed));

      // Trigger skid marks on both cars
      a.skidTimer = 0; spawnSkid(a);
      b.skidTimer = 0; spawnSkid(b);
    }
  }
}

// ── CAR RENDERING ─────────────────────────────────

function drawCar(car, withLabel = true) {
  const carWidth = 22, carHeight = 12;
  const img = car.img;
  const hasImg = img && img.complete && img.naturalWidth > 0;

  ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);

  // Glow — human cars glow brighter than AI cars
  ctx.shadowColor = car.isBoosting ? '#ffffff' : car.color;
  ctx.shadowBlur = car.isBoosting ? 28 : (car.onTrack ? 14 : 4);

  if (hasImg) {
    ctx.drawImage(img, -carWidth / 2, -carHeight / 2, carWidth, carHeight);
  } else {
    // Fallback: procedural drawing
    ctx.strokeStyle = car.color; ctx.lineWidth = 1.8;
    ctx.strokeRect(-carWidth / 2, -carHeight / 2, carWidth, carHeight);
    ctx.fillStyle = car.color + '44';
    ctx.fillRect(carWidth / 2 - 9, -carHeight / 2 + 2, 7, carHeight - 4);
    ctx.strokeStyle = car.color; ctx.lineWidth = 0.8;
    ctx.strokeRect(carWidth / 2 - 9, -carHeight / 2 + 2, 7, carHeight - 4);
    ctx.fillStyle = car.color;
    ctx.beginPath(); ctx.arc(carWidth / 2 - 1, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // Speed-streak lines — longer and brighter when boosting
  if (!car.isAI && (Math.abs(car.speed) > 140 || car.isBoosting)) {
    const streakLen = car.isBoosting ? 22 : 10;
    ctx.globalAlpha = car.isBoosting ? 0.7 : 0.25;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = car.isBoosting ? '#ffffff' : car.color; ctx.lineWidth = 1;
    [-3, 0, 3].forEach(offset => {
      ctx.beginPath();
      ctx.moveTo(-carWidth / 2 - 2, offset);
      ctx.lineTo(-carWidth / 2 - streakLen, offset);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  if (withLabel) {
    // Car label drawn in world space just below the car body
    ctx.save();
    ctx.font = '14px Courier New'; ctx.fillStyle = car.color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(car.label, car.x, car.y + carHeight / 2 + 4);
    ctx.restore();
  }
}
