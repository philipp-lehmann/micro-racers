// ── OBSTACLES ─────────────────────────────────────
let obstacles = [];

/**
 * Fills the `obstacles` array with randomly-placed square blocks on the track.
 * Uses a deterministic seed derived from the track name so obstacles are
 * consistent across restarts of the same track.
 */
function generateObstacles(track) {
  // If the track has hand-placed obstacles, use those directly.
  if (track.obstacles && track.obstacles.length > 0) {
    obstacles = track.obstacles.map(o => ({ ...o }));
    return;
  }
  obstacles = [];
  const spline = track.spline;
  const n = spline.length;
  // Simple LCG seeded by the track name so each track always gets the same layout.
  let seed = track.name.split('').reduce((s, c) => s + c.charCodeAt(0), 17);
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 0xffffffff;
  };
  const COUNT = 10;
  for (let i = 0; i < COUNT; i++) {
    // Spread evenly across 10–90 % of track progress, with a small random jitter
    const progress = 0.10 + (i / COUNT) * 0.80 + rand() * (0.80 / COUNT);
    const idx = Math.floor(progress * n) % n;
    const pt  = spline[idx];
    const npt = spline[(idx + 1) % n];
    const fwd = Math.atan2(npt[1] - pt[1], npt[0] - pt[0]);
    const lat = fwd + Math.PI / 2;
    // Lateral offset: keep inside the road but avoid the exact center line
    const halfW = pt[2] / 2;
    const sign  = rand() > 0.5 ? 1 : -1;
    const off   = sign * (halfW * 0.15 + rand() * halfW * 0.50);
    const size  = 32 + rand() * 36;   // 32 – 68 px, mean ≈ 50 px
    obstacles.push({ x: pt[0] + Math.cos(lat) * off, y: pt[1] + Math.sin(lat) * off, size, angle: fwd });
  }
}

/** Draws all obstacles in world space (call inside the isometric transform). */
function drawObstacles(obs = obstacles) {
  if (!obs || !obs.length) return;
  obs.forEach(ob => {
    const h = ob.size / 2;
    ctx.save();
    ctx.translate(ob.x, ob.y);
    ctx.rotate(ob.angle || 0);
    ctx.fillStyle   = '#0d2233';
    ctx.strokeStyle = '#2a6080';
    ctx.lineWidth   = 1.8;
    ctx.shadowColor = '#1a5070';
    ctx.shadowBlur  = 10;
    ctx.fillRect(-h, -h, ob.size, ob.size);
    ctx.strokeRect(-h, -h, ob.size, ob.size);
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = '#3a7a9a';
    ctx.lineWidth   = 1;
    ctx.strokeRect(-h + 4, -h + 4, ob.size - 8, ob.size - 8);
    ctx.restore();
  });
}

/** Circle-vs-rotated-AABB collision between cars and obstacles. */
function resolveObstacleCollisions() {
  cars.forEach(car => {
    if (car.done || car.dnf) return;
    obstacles.forEach(ob => {
      const h   = ob.size / 2;
      const ang = ob.angle || 0;
      // Transform car centre into obstacle local space (un-rotate around ob centre)
      const cos = Math.cos(-ang), sin = Math.sin(-ang);
      const relX = car.x - ob.x, relY = car.y - ob.y;
      const lx = cos * relX - sin * relY;
      const ly = sin * relX + cos * relY;
      // Nearest point on axis-aligned square in local space
      const cx = Math.max(-h, Math.min(h, lx));
      const cy = Math.max(-h, Math.min(h, ly));
      const dx = lx - cx, dy = ly - cy;
      const dist = Math.hypot(dx, dy);
      if (dist >= CAR_RADIUS || dist < 0.001) return;
      // Local-space push normal
      const overlap = CAR_RADIUS - dist;
      const lnx = dx / dist, lny = dy / dist;
      // Rotate normal back to world space
      const wnx = Math.cos(ang) * lnx - Math.sin(ang) * lny;
      const wny = Math.sin(ang) * lnx + Math.cos(ang) * lny;
      car.x += wnx * overlap;
      car.y += wny * overlap;
      const vN = car.speed * (Math.cos(car.angle) * wnx + Math.sin(car.angle) * wny);
      if (vN > 0) {
        car.speed -= vN * 1.7;
        car.speed  = Math.max(-MAX_REVERSE, Math.min(MAX_SPEED, car.speed));
        car.skidTimer = 0; spawnSkid(car);
      }
    });
  });
}
