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
  drawObstacles(track.obstacles);
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
  if (mouse.click && addHov) { editPts = []; editPreview = null; editObstacles = []; editTool = 'track'; screen = 'editor'; return; }

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
