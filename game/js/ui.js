// ui.js — everything drawn over the arena: the HUD (score, combo, wave,
// hull, dash), the title screen, the upgrade draft cards, pause and the
// game-over panel. Menus are canvas-drawn so screenshots show the real UI.

import { clamp, TAU } from './rng.js';
import { W, H } from './world.js';

const FONT = "'Segoe UI', system-ui, sans-serif";

export function panel(ctx, x, y, w, h, alpha = 0.82) {
  ctx.save();
  ctx.fillStyle = `rgba(8,10,28,${alpha})`;
  ctx.strokeStyle = 'rgba(64,224,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function button(ctx, input, x, y, w, h, label, accent = '#40e0ff') {
  const hover = input.mouse.x >= x && input.mouse.x <= x + w && input.mouse.y >= y && input.mouse.y <= y + h;
  ctx.save();
  ctx.fillStyle = hover ? 'rgba(64,224,255,0.25)' : 'rgba(64,224,255,0.10)';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.font = `700 19px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#eafcff';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
  return hover;
}

export function clicked(input, x, y, w, h) {
  return input.clicks.some((c) => c.x >= x && c.x <= x + w && c.y >= y && c.y <= y + h);
}

function heart(ctx, x, y, s, filled, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = filled ? color : 'rgba(255,255,255,0.14)';
  ctx.strokeStyle = filled ? color : 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.85);
  ctx.bezierCurveTo(-s * 1.25, -s * 0.15, -s * 0.6, -s * 1.05, 0, -s * 0.35);
  ctx.bezierCurveTo(s * 0.6, -s * 1.05, s * 1.25, -s * 0.15, 0, s * 0.85);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawHud(ctx, state, player, director, boss) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // score block
  ctx.textAlign = 'left';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(190,230,255,0.75)';
  ctx.fillText('S C O R E', 20, 30);
  ctx.font = `800 27px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(state.score).padStart(6, '0'), 20, 58);
  // combo
  if (state.combo > 1) {
    const m = state.multiplier;
    ctx.font = `800 17px ${FONT}`;
    ctx.fillStyle = m >= 5 ? '#ffe95e' : m >= 3 ? '#ffb340' : '#7df0ff';
    ctx.fillText(`COMBO ×${m}`, 20, 82);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(20, 88, 92, 4);
    ctx.fillStyle = '#ffe95e';
    ctx.fillRect(20, 88, 92 * clamp(state.comboTimer / 4, 0, 1), 4);
  }
  // wave block
  ctx.textAlign = 'center';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(190,230,255,0.75)';
  ctx.fillText('W A V E', W / 2, 30);
  ctx.font = `800 27px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(director.wave), W / 2, 58);
  const left = state.enemiesLeft;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = 'rgba(190,230,255,0.8)';
  ctx.fillText(left > 0 ? `${left} hostiles remain` : 'sector clear', W / 2, 76);
  // hull
  ctx.textAlign = 'right';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(190,230,255,0.75)';
  ctx.fillText('H U L L', W - 20, 30);
  for (let i = 0; i < player.maxHp; i++) {
    heart(ctx, W - 30 - i * 25, 48, 9, i < player.hp, '#ff5d7a');
  }
  // dash meter
  ctx.textAlign = 'left';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(190,230,255,0.75)';
  ctx.fillText('DASH', 20, H - 34);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(20, H - 28, 92, 6);
  ctx.fillStyle = player.dashCooldown <= 0 ? '#40e0ff' : '#3f8cff';
  ctx.fillRect(20, H - 28, 92 * (1 - player.dashCooldown / player.dashCooldownMax), 6);
  if (player.dashCooldown <= 0) {
    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = '#40e0ff';
    ctx.fillText('READY', 118, H - 21);
  }
  // hints
  ctx.textAlign = 'right';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(190,230,255,0.5)';
  ctx.fillText('P pause · M sound', W - 20, H - 21);
  // boss bar
  if (boss) {
    const w = 420;
    ctx.fillStyle = 'rgba(255,62,168,0.16)';
    ctx.fillRect(W / 2 - w / 2, 88, w, 10);
    ctx.fillStyle = '#ff3ea8';
    ctx.fillRect(W / 2 - w / 2, 88, w * clamp(boss.hp / boss.maxHp, 0, 1), 10);
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb9e2';
    ctx.fillText('◈ VOIDMOTHER ◈', W / 2, 112);
  }
  ctx.restore();
}

export function drawTitle(ctx, state, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,5,16,0.42)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  // logo
  const pulse = 1 + Math.sin(time * 2.2) * 0.012;
  ctx.translate(W / 2, 168);
  ctx.scale(pulse, pulse);
  const g = ctx.createLinearGradient(-260, 0, 260, 0);
  g.addColorStop(0, '#40e0ff');
  g.addColorStop(0.5, '#b46bff');
  g.addColorStop(1, '#ff3ea8');
  ctx.font = `900 84px ${FONT}`;
  ctx.shadowColor = 'rgba(120,90,255,0.8)';
  ctx.shadowBlur = 34;
  ctx.fillStyle = g;
  ctx.fillText('VOIDBLOOM', 0, 0);
  ctx.shadowBlur = 0;
  ctx.font = `600 17px ${FONT}`;
  ctx.fillStyle = '#cfe8ff';
  ctx.fillText('a neon arena survival', 0, 34);
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `600 15.5px ${FONT}`;
  ctx.fillStyle = 'rgba(230,245,255,0.92)';
  ctx.fillText('Survive the voidspawn. Chain kills into combos, draft upgrades,', W / 2, 268);
  ctx.fillText('and bring down the Voidmother every fifth wave.', W / 2, 290);
  ctx.font = `600 14px ${FONT}`;
  ctx.fillStyle = 'rgba(160,200,235,0.85)';
  ctx.fillText('WASD / arrows — move      mouse — aim & fire      SHIFT / SPACE — dash      P — pause', W / 2, 330);
  if (state.best > 0) {
    ctx.font = `700 15px ${FONT}`;
    ctx.fillStyle = '#ffe95e';
    ctx.fillText(`BEST  ${state.best}`, W / 2, 486);
  }
  ctx.restore();
}

export function drawUpgrade(ctx, state, choices, input, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,5,16,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`WAVE ${state.wave} CLEARED`, W / 2, 138);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = '#7df0ff';
  ctx.fillText('choose an upgrade — click a card or press 1 · 2 · 3', W / 2, 166);
  const cw = 236, ch = 168, gap = 22;
  const x0 = W / 2 - (cw * 3 + gap * 2) / 2;
  const y = 208;
  const rects = [];
  choices.forEach((u, i) => {
    const x = x0 + i * (cw + gap);
    rects.push({ x, y, w: cw, h: ch, u });
    const hover = input.mouse.x >= x && input.mouse.x <= x + cw && input.mouse.y >= y && input.mouse.y <= y + ch;
    ctx.save();
    ctx.fillStyle = hover ? 'rgba(24,32,68,0.95)' : 'rgba(10,13,34,0.92)';
    ctx.strokeStyle = hover ? '#40e0ff' : 'rgba(64,224,255,0.4)';
    ctx.lineWidth = hover ? 2.6 : 1.6;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 14);
    ctx.fill(); ctx.stroke();
    ctx.font = `44px ${FONT}`;
    ctx.fillStyle = '#ffe95e';
    ctx.fillText(u.glyph, x + cw / 2, y + 62);
    ctx.font = `800 17px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(u.name, x + cw / 2, y + 102);
    ctx.font = `600 13.5px ${FONT}`;
    ctx.fillStyle = 'rgba(200,230,255,0.9)';
    ctx.fillText(u.desc, x + cw / 2, y + 128);
    ctx.font = `700 12px ${FONT}`;
    ctx.fillStyle = 'rgba(160,200,235,0.6)';
    ctx.fillText(`[ ${i + 1} ]`, x + cw / 2, y + 152);
    ctx.restore();
  });
  ctx.restore();
  return rects;
}

export function drawGameOver(ctx, state, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,5,16,0.6)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, W / 2 - 240, 120, 480, 300);
  ctx.textAlign = 'center';
  ctx.font = `900 44px ${FONT}`;
  ctx.fillStyle = '#ff5d7a';
  ctx.fillText('SHIP DOWN', W / 2, 186);
  ctx.font = `600 14px ${FONT}`;
  ctx.fillStyle = 'rgba(190,230,255,0.8)';
  ctx.fillText(`the void claims another bloom — wave ${state.wave}`, W / 2, 214);
  ctx.font = `800 40px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(state.score).padStart(6, '0'), W / 2, 268);
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = 'rgba(190,230,255,0.75)';
  ctx.fillText('S C O R E', W / 2, 288);
  ctx.font = `700 16px ${FONT}`;
  ctx.fillStyle = '#ffe95e';
  const isBest = state.score >= state.best && state.score > 0;
  ctx.fillText(isBest ? '★ NEW BEST ★' : `best ${state.best} · ${state.kills} kills`, W / 2, 322);
  ctx.font = `600 14.5px ${FONT}`;
  ctx.fillStyle = 'rgba(230,245,255,0.9)';
  ctx.fillText('press R or click RESTART to bloom again', W / 2, 392);
  ctx.restore();
}

export function drawPaused(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,5,16,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = `900 40px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PAUSED', W / 2, H / 2);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = 'rgba(200,230,255,0.85)';
  ctx.fillText('press P to resume', W / 2, H / 2 + 32);
  ctx.restore();
}

export function drawWaveBanner(ctx, state, time) {
  if (state.bannerT <= 0 || state.mode !== 'playing') return;
  const a = clamp(state.bannerT / 0.5, 0, 1);
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  ctx.textAlign = 'center';
  ctx.font = `900 46px ${FONT}`;
  ctx.fillStyle = state.bannerBoss ? '#ff3ea8' : '#ffffff';
  ctx.shadowColor = 'rgba(64,224,255,0.7)';
  ctx.shadowBlur = 22;
  ctx.fillText(state.bannerText, W / 2, 210);
  ctx.restore();
}
