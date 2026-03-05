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

  // Draw placed obstacle previews
  editObstacles.forEach(ob => {
    const h = ob.size / 2;
    ctx.save();
    ctx.translate(ob.x, ob.y);
    ctx.rotate(ob.angle || 0);
    ctx.fillStyle   = '#0d2233';
    ctx.strokeStyle = '#2a6080';
    ctx.lineWidth   = 1.8;
    ctx.shadowColor = '#1a5070'; ctx.shadowBlur = 10;
    ctx.fillRect(-h, -h, ob.size, ob.size);
    ctx.strokeRect(-h, -h, ob.size, ob.size);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#3a7a9a'; ctx.lineWidth = 1;
    ctx.strokeRect(-h + 4, -h + 4, ob.size - 8, ob.size - 8);
    ctx.restore();
  });

  // Draw placed track points and connecting lines
  if (editPts.length > 0) {
    ctx.save();
    ctx.strokeStyle = '#00ff8866'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(editPts[0][0], editPts[0][1]);
    for (let i = 1; i < editPts.length; i++) ctx.lineTo(editPts[i][0], editPts[i][1]);
    ctx.stroke();
    if (editPts.length >= 2) {
      const last = editPts[editPts.length - 1];
      ctx.strokeStyle = '#00ff8844';
      ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(editPts[0][0], editPts[0][1]); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

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

  // Tool selector: TRACK | OBSTACLE
  const TOOL_W = 110, TOOL_H = 48, TOOL_GAP = 8;
  const toolBaseX = 20, toolY = TB_Y + (TB_H - TOOL_H) / 2;

  ['track', 'obstacle'].forEach((tool, ti) => {
    const tx = toolBaseX + ti * (TOOL_W + TOOL_GAP);
    const active = editTool === tool;
    const hov = inBox(mouse.x, mouse.y, tx, toolY, TOOL_W, TOOL_H);
    const col = tool === 'obstacle' ? '#2a88bb' : COLORS.primary;
    ctx.fillStyle = active ? col : (hov ? col + '55' : col + BTN_DIM);
    ctx.strokeStyle = col; ctx.lineWidth = active ? 2 : 1.5;
    if (active) { ctx.shadowColor = col; ctx.shadowBlur = 12; }
    ctx.fillRect(tx, toolY, TOOL_W, TOOL_H);
    ctx.strokeRect(tx, toolY, TOOL_W, TOOL_H);
    ctx.shadowBlur = 0;
    ctx.fillStyle = active ? (tool === 'obstacle' ? '#fff' : COLORS.bg) : col;
    ctx.font = 'bold 14px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tool === 'track' ? 'TRACK' : 'OBSTACLE', tx + TOOL_W / 2, toolY + TOOL_H / 2);
    if (mouse.click && hov) editTool = tool;
  });

  // Hint text
  const hintX = toolBaseX + 2 * (TOOL_W + TOOL_GAP) + 12;
  ctx.fillStyle = '#334455'; ctx.font = '13px Courier New';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const hint = editTool === 'obstacle'
    ? 'CLICK TO PLACE BLOCKS  ·  Z UNDO'
    : 'CLICK TO ADD POINTS  ·  Z UNDO  ·  ≥3 PTS TO SAVE';
  ctx.fillText(hint, hintX, TB_Y + TB_H / 2);

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

  // Point / obstacle count
  const countLabel = editTool === 'obstacle'
    ? editObstacles.length + ' blocks'
    : editPts.length + ' pts';
  ctx.fillStyle = editPts.length >= 3 ? COLORS.primary : '#334455';
  ctx.font = '14px Courier New'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(countLabel, discardX - 16, TB_Y + TB_H / 2);

  // Handle button clicks — returns true if a UI element consumed the click
  if (mouse.click) {
    if (cHov) { screen = 'tracks'; return true; }
    if (discardHov) { editPts = []; editPreview = null; editObstacles = []; screen = 'tracks'; return true; }
    if (saveHov && canSave) {
      const userCount = TRACKS.filter(t => t.isUser).length;
      const col = USER_TRACK_COLORS[userCount % USER_TRACK_COLORS.length];
      const tpl = USER_TRACK_NAMES[userCount % USER_TRACK_NAMES.length];
      const lap = Math.floor(userCount / USER_TRACK_NAMES.length);
      const def = {
        name: tpl.name + (lap > 0 ? ' ' + (lap + 1) : ''),
        sub:  tpl.sub,
        col, pts: [...editPts],
        obstacles: editObstacles.map(o => ({ ...o })),
      };
      TRACKS.push(buildTrackObj(def, true));
      persistUserTracks();
      selectedTrack = TRACKS.length - 1;
      editPts = []; editPreview = null; editObstacles = [];
      screen = 'tracks'; return true;
    }
    // Absorb toolbar clicks so they don't place a point/obstacle
    if (mouse.y >= TB_Y) return true;
    if (inBox(mouse.x, mouse.y, cX, cY, cW, cH)) return true;
    // Tool selector clicks already handled above — absorb them
    for (let ti = 0; ti < 2; ti++) {
      const tx = toolBaseX + ti * (TOOL_W + TOOL_GAP);
      if (inBox(mouse.x, mouse.y, tx, toolY, TOOL_W, TOOL_H)) return true;
    }
  }
  return false;
}
