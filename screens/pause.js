// ── PAUSE MENU ────────────────────────────────────

function drawPause() {
  // Dark overlay
  ctx.fillStyle = 'rgba(0,10,18,0.72)';
  ctx.fillRect(0, 0, W, H);

  const panW = 380, panH = 370;
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
    { l: 'RESUME RACE ▶',                             y: panY + 110, col: COLORS.primary   },
    { l: 'RESTART RACE',                               y: panY + 170, col: COLORS.secondary },
    { l: musicMuted ? '♪  SOUND OFF' : '♪  SOUND ON', y: panY + 230, col: musicMuted ? COLORS.danger : COLORS.secondary },
    { l: 'QUIT TO MENU',                               y: panY + 290, col: COLORS.danger    },
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
      } else if (btn.l.startsWith('RESTART')) {
        paused = false;
        initRace(); countdownNum = 3; countdownTime = 0; screen = 'countdown'; setMusicMode('beat');
      } else if (btn.l.includes('SOUND')) {
        musicMuted = !musicMuted;
        typeof setMusicMuted === 'function' && setMusicMuted(musicMuted);
      } else if (btn.l.startsWith('QUIT')) {
        paused = false;
        saveSettings(); screen = 'start'; setMusicMode('beat');
      }
    }
  });
}
