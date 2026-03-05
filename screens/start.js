// ── START SCREEN ──────────────────────────────────

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
  drawObstacles(track.obstacles);
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

  // ── Keyboard-navigable rows: TRACK + MODE + LAPS/POINTS ──
  const ROWS_Y  = PICKERS_Y + 2 * CARD_H + CARD_GAP + 16;
  const thirdLabel = gameMode === 'race' ? 'LAPS' : 'POINTS';
  const thirdValue = gameMode === 'race'
    ? LAPS + (LAPS === 1 ? ' LAP' : ' LAPS')
    : POINTS_TO_WIN + (POINTS_TO_WIN === 1 ? ' PT' : ' PTS');
  const rowDefs = [
    { label: 'TRACK', value: track.name },
    { label: 'MODE',  value: gameMode === 'race' ? 'RACE' : 'ELIMINATION' },
    { label: thirdLabel, value: thirdValue },
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
      else if (i === 1) gameMode = gameMode === 'race' ? 'elimination' : 'race';
      else if (gameMode === 'race') LAPS = Math.max(1, Math.min(9, LAPS + dir));
      else POINTS_TO_WIN = Math.max(1, Math.min(9, POINTS_TO_WIN + dir));
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
  const sbY = ROWS_Y + 3 * (ROW_H + 8) + 12;
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
