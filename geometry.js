// ── SPLINE & GEOMETRY ─────────────────────────────

/**
 * Generates a smooth closed Catmull-Rom spline through the control points.
 * @param {number[][]} pts - Array of [x, y, w] control points (w = road width)
 * @param {number}     res - Number of output segments between each pair of points
 * @returns {number[][]} Dense array of [x, y, w] positions along the spline
 */
function buildSpline(pts, res) {
  res = res || 14;
  const numPts = pts.length;
  const out = [];
  for (let i = 0; i < numPts; i++) {
    // Catmull-Rom needs four surrounding points; wrap indices for the closed loop
    const p0 = pts[(i - 1 + numPts) % numPts];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % numPts];
    const p3 = pts[(i + 2) % numPts];
    for (let j = 0; j < res; j++) {
      const t = j / res, t2 = t * t, t3 = t2 * t;
      // Standard Catmull-Rom matrix formula applied to x, y, and w
      const cr = (c0, c1, c2, c3) =>
        .5 * (2 * c1 + (-c0 + c2) * t + (2 * c0 - 5 * c1 + 4 * c2 - c3) * t2 + (-c0 + 3 * c1 - 3 * c2 + c3) * t3);
      out.push([cr(p0[0], p1[0], p2[0], p3[0]),
                cr(p0[1], p1[1], p2[1], p3[1]),
                cr(p0[2], p1[2], p2[2], p3[2])]);
    }
  }
  return out;
}

/**
 * Extrudes a spline into left and right boundary edges.
 * Uses the per-point width stored in spline[i][2] (interpolated from control-point w values).
 * @returns {{ leftEdge: number[][], rightEdge: number[][] }}
 */
function buildEdges(spline) {
  const numPts = spline.length;
  const leftEdge = [], rightEdge = [];
  for (let i = 0; i < numPts; i++) {
    // Tangent approximated by looking at the previous and next spline points
    const prev = spline[(i - 1 + numPts) % numPts];
    const next = spline[(i + 1) % numPts];
    const dx = next[0] - prev[0], dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    // Normal is 90° CCW from the tangent
    const nx = -dy / len, ny = dx / len;
    const hw = spline[i][2] * .5;  // half-width at this spline point
    leftEdge.push([spline[i][0] + nx * hw, spline[i][1] + ny * hw]);
    rightEdge.push([spline[i][0] - nx * hw, spline[i][1] - ny * hw]);
  }
  clipEdgeFolds(leftEdge);
  clipEdgeFolds(rightEdge);
  return { leftEdge, rightEdge };
}

// Collapses self-intersecting (folded) sections of an offset edge polyline.
// When a sharp corner causes the inner edge to fold back on itself, this
// detects the crossing and moves all intermediate points to the intersection.
function clipEdgeFolds(pts) {
  const n = pts.length;
  const win = Math.min(20, Math.floor(n / 4));
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n];
      const b = pts[i];
      const d1x = b[0] - a[0], d1y = b[1] - a[1];
      if (d1x * d1x + d1y * d1y < 1e-10) continue;
      for (let gap = 1; gap <= win; gap++) {
        const c = pts[(i + gap) % n];
        const d = pts[(i + gap + 1) % n];
        const d2x = d[0] - c[0], d2y = d[1] - c[1];
        const den = d1x * d2y - d1y * d2x;
        if (Math.abs(den) < 1e-10) continue;
        const ex = c[0] - a[0], ey = c[1] - a[1];
        const t = (ex * d2y - ey * d2x) / den;
        const s = (ex * d1y - ey * d1x) / den;
        if (t > 0 && t < 1 && s > 0 && s < 1) {
          const ix = a[0] + t * d1x, iy = a[1] + t * d1y;
          for (let m = 0; m <= gap; m++) {
            const p = pts[(i + m) % n];
            p[0] = ix; p[1] = iy;
          }
          break;
        }
      }
    }
  }
}

// ── GEOMETRY HELPERS ──────────────────────────────

/** Minimum distance from point (px, py) to line segment (ax, ay)→(bx, by). */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (!lenSq) return Math.hypot(px - ax, py - ay);
  // Project point onto segment, clamped to [0, 1]
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Returns the minimum distance from (x, y) to the track centerline and the
 * interpolated road width at the nearest point.
 */
function nearestTrackPoint(x, y, track) {
  const spline = track.spline;
  let minDist = Infinity, nearWidth = 72;
  for (let i = 0; i < spline.length; i++) {
    const j = (i + 1) % spline.length;
    const d = distToSegment(x, y, spline[i][0], spline[i][1], spline[j][0], spline[j][1]);
    if (d < minDist) {
      minDist = d;
      // Interpolate width between the two segment endpoints
      const dx = spline[j][0] - spline[i][0], dy = spline[j][1] - spline[i][1];
      const lenSq = dx * dx + dy * dy;
      const t = lenSq ? Math.max(0, Math.min(1, ((x - spline[i][0]) * dx + (y - spline[i][1]) * dy) / lenSq)) : 0;
      nearWidth = spline[i][2] + t * (spline[j][2] - spline[i][2]);
    }
  }
  return { dist: minDist, width: nearWidth };
}

/**
 * Returns how far around the track a position is, as a fraction 0.0–1.0,
 * and the index of the nearest spline segment.
 * Searches all segments (global) — only use this for one-time initialisation.
 * @returns {{ progress: number, segIdx: number }}
 */
function trackProgress(x, y, track) {
  const spline = track.spline;
  const numPts = spline.length;
  let minDist = Infinity, nearestSegIdx = 0, nearestT = 0;
  for (let i = 0; i < numPts; i++) {
    const j = (i + 1) % numPts;
    const dx = spline[j][0] - spline[i][0], dy = spline[j][1] - spline[i][1];
    const lenSq = dx * dx + dy * dy;
    const t = lenSq
      ? Math.max(0, Math.min(1, ((x - spline[i][0]) * dx + (y - spline[i][1]) * dy) / lenSq))
      : 0;
    const d = Math.hypot(x - (spline[i][0] + t * dx), y - (spline[i][1] + t * dy));
    if (d < minDist) { minDist = d; nearestSegIdx = i; nearestT = t; }
  }
  const segLen = (nearestSegIdx + 1 < numPts)
    ? track.cumulativeLengths[nearestSegIdx + 1] - track.cumulativeLengths[nearestSegIdx]
    : track.totalLength - track.cumulativeLengths[nearestSegIdx];
  return {
    progress: (track.cumulativeLengths[nearestSegIdx] + nearestT * segLen) / track.totalLength,
    segIdx: nearestSegIdx,
  };
}

/**
 * Per-frame variant of trackProgress.
 * Only searches within ±10 % of the spline around the car's last known segment,
 * so it cannot snap to a parallel section of a self-intersecting track.
 * @param {number} segIdx  Last known nearest segment index (stored on the car).
 * @returns {{ progress: number, segIdx: number }}
 */
function trackProgressLocal(x, y, track, segIdx) {
  const spline = track.spline;
  const numPts = spline.length;
  const HALF = Math.ceil(numPts * 0.1);
  let minDist = Infinity, nearestSeg = segIdx, nearestT = 0;
  for (let wi = -HALF; wi <= HALF; wi++) {
    const i = ((segIdx + wi) % numPts + numPts) % numPts;
    const j = (i + 1) % numPts;
    const dx = spline[j][0] - spline[i][0], dy = spline[j][1] - spline[i][1];
    const lenSq = dx * dx + dy * dy;
    const t = lenSq
      ? Math.max(0, Math.min(1, ((x - spline[i][0]) * dx + (y - spline[i][1]) * dy) / lenSq))
      : 0;
    const d = Math.hypot(x - (spline[i][0] + t * dx), y - (spline[i][1] + t * dy));
    if (d < minDist) { minDist = d; nearestSeg = i; nearestT = t; }
  }
  const segLen = (nearestSeg + 1 < numPts)
    ? track.cumulativeLengths[nearestSeg + 1] - track.cumulativeLengths[nearestSeg]
    : track.totalLength - track.cumulativeLengths[nearestSeg];
  return {
    progress: (track.cumulativeLengths[nearestSeg] + nearestT * segLen) / track.totalLength,
    segIdx: nearestSeg,
  };
}

/**
 * Per-frame variant of nearestTrackPoint.
 * Same local-window approach as trackProgressLocal — prevents the off-track
 * detector from snapping to the road of a parallel section.
 * @param {number} segIdx  Last known nearest segment index (stored on the car).
 * @returns {{ dist: number, width: number }}
 */
function nearestTrackPointLocal(x, y, track, segIdx) {
  const spline = track.spline;
  const numPts = spline.length;
  const HALF = Math.ceil(numPts * 0.1);
  let minDist = Infinity, nearWidth = 72;
  for (let wi = -HALF; wi <= HALF; wi++) {
    const i = ((segIdx + wi) % numPts + numPts) % numPts;
    const j = (i + 1) % numPts;
    const d = distToSegment(x, y, spline[i][0], spline[i][1], spline[j][0], spline[j][1]);
    if (d < minDist) {
      minDist = d;
      const dx = spline[j][0] - spline[i][0], dy = spline[j][1] - spline[i][1];
      const lenSq = dx * dx + dy * dy;
      const t = lenSq ? Math.max(0, Math.min(1, ((x - spline[i][0]) * dx + (y - spline[i][1]) * dy) / lenSq)) : 0;
      nearWidth = spline[i][2] + t * (spline[j][2] - spline[i][2]);
    }
  }
  return { dist: minDist, width: nearWidth };
}

/** Returns a darkened version of a #rrggbb hex colour (factor 0–1). */
function muteColor(hex, factor = 0.8) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return '#' + [r, g, b].map(v => Math.round(v * factor).toString(16).padStart(2, '0')).join('');
}

/** Formats elapsed seconds as "M:SS.ms" (e.g. 1:07.43). */
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return minutes + ':' + (seconds % 60).toFixed(2).padStart(5, '0');
}

/** Returns true if canvas point (mx, my) falls inside the rectangle (x, y, w, h). */
function inBox(mx, my, x, y, w, h) {
  return mx >= x && mx <= x + w && my >= y && my <= y + h;
}
