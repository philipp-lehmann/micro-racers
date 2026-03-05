// ── RESULTS SCREEN ────────────────────────────────

// Layout constants shared between drawResults and the click handler in the main loop
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
