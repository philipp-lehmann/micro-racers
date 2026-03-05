// ── EDITOR SCREEN ──────────────────────────────────

function rebuildEditorPreview() {
  editPreview = editPts.length >= 3
    ? buildTrackObj({ name: '', sub: '', col: USER_TRACK_COLORS[0], pts: editPts }, true)
    : null;
}

function drawEditor() {
  drawBg();
  ctx.fillStyle = 'rgba(0,6,14,0.30)'; ctx.fillRect(0, 0, W, H);

  // Live track preview (top-down, no iso)
  if (editPreview) {
    drawTrack(editPreview, 0.85);
  }

  // Draw placed points and connecting lines
  if (editPts.length > 0) {
    // Thin lines between points
    ctx.save();
    ctx.strokeStyle = '#00ff8866'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(editPts[0][0], editPts[0][1]);
    for (let i = 1; i < editPts.length; i++) ctx.lineTo(editPts[i][0], editPts[i][1]);
    ctx.stroke();
    // Dashed closing segment
    if (editPts.length >= 2) {
      const last = editPts[editPts.length - 1];
      ctx.strokeStyle = '#00ff8844';
      ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(editPts[0][0], editPts[0][1]); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // Numbered dots
    editPts.forEach(([x, y], i) => {
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#000c18'; ctx.fill();
      ctx.strokeStyle = COLORS.primary; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = COLORS.primary; ctx.font = 'bold 11px Courier New';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(i + 1, x, y);
      ctx.restore();
    });
  }

  // ── Toolbar ──
  const TB_H = 90;
  const TB_Y = H - TB_H;
  ctx.fillStyle = 'rgba(0,6,16,0.92)'; ctx.fillRect(0, TB_Y, W, TB_H);
  ctx.strokeStyle = '#002230'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, TB_Y); ctx.lineTo(W, TB_Y); ctx.stroke();

  ctx.fillStyle = '#334455'; ctx.font = '15px Courier New';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('CLICK TO ADD POINTS  ·  Z UNDO  ·  ≥3 PTS TO SAVE', 30, TB_Y + TB_H / 2);

  const canSave = editPts.length >= 3;
  const BTN_W = 130, BTN_H = 48;
  const discardX = W - BTN_W * 2 - 44, saveX = W - BTN_W - 20;
  const BTN_Y = TB_Y + (TB_H - BTN_H) / 2;

  // DISCARD button
  const discardHov = inBox(mouse.x, mouse.y, discardX, BTN_Y, BTN_W, BTN_H);
  ctx.fillStyle = discardHov ? COLORS.danger : COLORS.danger + BTN_DIM;
  ctx.strokeStyle = COLORS.danger; ctx.lineWidth = 1.5;
  ctx.fillRect(discardX, BTN_Y, BTN_W, BTN_H); ctx.strokeRect(discardX, BTN_Y, BTN_W, BTN_H);
  ctx.fillStyle = discardHov ? '#fff' : COLORS.danger;
  ctx.font = 'bold 18px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('DISCARD', discardX + BTN_W / 2, BTN_Y + BTN_H / 2);

  // SAVE button
  ctx.save(); ctx.globalAlpha = canSave ? 1 : 0.35;
  const saveHov = canSave && inBox(mouse.x, mouse.y, saveX, BTN_Y, BTN_W, BTN_H);
  ctx.fillStyle = saveHov ? COLORS.primary : COLORS.primary + BTN_DIM;
  ctx.strokeStyle = COLORS.primary; ctx.lineWidth = 1.5;
  if (saveHov) { ctx.shadowColor = COLORS.primary; ctx.shadowBlur = 10; }
  ctx.fillRect(saveX, BTN_Y, BTN_W, BTN_H); ctx.strokeRect(saveX, BTN_Y, BTN_W, BTN_H);
  ctx.shadowBlur = 0;
  ctx.fillStyle = saveHov ? COLORS.bg : COLORS.primary;
  ctx.font = 'bold 18px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('SAVE', saveX + BTN_W / 2, BTN_Y + BTN_H / 2);
  ctx.restore();

  // ✕ close (top-right)
  const cW = 50, cH = 50;
  const cX = W - cW - 14, cY = 14;
  const cHov = inBox(mouse.x, mouse.y, cX, cY, cW, cH);
  ctx.fillStyle = cHov ? COLORS.danger : COLORS.danger + BTN_DIM;
  ctx.strokeStyle = COLORS.danger; ctx.lineWidth = 1.5;
  ctx.fillRect(cX, cY, cW, cH); ctx.strokeRect(cX, cY, cW, cH);
  ctx.fillStyle = cHov ? '#fff' : COLORS.danger;
  ctx.font = 'bold 22px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✕', cX + cW / 2, cY + cH / 2);

  // Point count
  ctx.fillStyle = editPts.length >= 3 ? COLORS.primary : '#334455';
  ctx.font = '14px Courier New'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(editPts.length + ' pts', discardX - 16, TB_Y + TB_H / 2);

  // Handle button clicks — returns true if a UI element consumed the click
  if (mouse.click) {
    if (cHov) { screen = 'tracks'; return true; }
    if (discardHov) { editPts = []; editPreview = null; screen = 'tracks'; return true; }
    if (saveHov && canSave) {
      const userCount = TRACKS.filter(t => t.isUser).length;
      const col = USER_TRACK_COLORS[userCount % USER_TRACK_COLORS.length];
      const tpl = USER_TRACK_NAMES[userCount % USER_TRACK_NAMES.length];
      const lap = Math.floor(userCount / USER_TRACK_NAMES.length);
      const def = {
        name: tpl.name + (lap > 0 ? ' ' + (lap + 1) : ''),
        sub:  tpl.sub,
        col, pts: [...editPts],
      };
      TRACKS.push(buildTrackObj(def, true));
      persistUserTracks();
      selectedTrack = TRACKS.length - 1;
      editPts = []; editPreview = null;
      screen = 'tracks'; return true;
    }
    // Check if click is on a UI element (toolbar or top-right ✕)
    if (mouse.y >= TB_Y) return true;  // in toolbar
    if (inBox(mouse.x, mouse.y, cX, cY, cW, cH)) return true;
  }
  return false;
}
