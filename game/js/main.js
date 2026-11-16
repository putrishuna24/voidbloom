// main.js — VOIDBLOOM's conductor: the state machine (title attract mode,
// playing, upgrade draft, game over), the fixed-clamp game loop, wave flow,
// and the ?shot= staging the maker uses to take the entry's screenshots.

import { useSeed, rand, clamp, angleTo, TAU } from './rng.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { World, W, H } from './world.js';
import { Player } from './player.js';
import { Enemy, WaveDirector } from './enemies.js';
import { Combat } from './combat.js';
import { rollChoices } from './upgrades.js';
import * as ui from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const audio = new AudioSys();
const world = new World();
const player = new Player();
const combat = new Combat(world, audio);
const director = new WaveDirector(world);

const params = new URLSearchParams(location.search);
if (params.get('seed')) useSeed(Number(params.get('seed')) * 7919 + 13);
const SHOT = params.get('shot');

const state = {
  mode: 'title',
  paused: false,
  score: 0,
  best: 0,
  combo: 0,
  comboTimer: 0,
  kills: 0,
  wave: 0,
  comboGuard: false,
  spawnQueue: [],
  choices: [],
  bannerT: 0,
  bannerText: '',
  bannerBoss: false,
  deathT: 0,
  autoPlay: true,
  time: 0,
  get multiplier() { return 1 + Math.min(7, Math.floor(this.combo / 8)); },
  get enemiesLeft() { return enemies.length + director.queue.length + this.spawnQueue.length; },
  addScore(points, x, y, quiet) {
    this.score += points;
    if (!quiet && points > 0) world.floatText(x, y - 14, `+${points}`, '#ffe95e', points >= 500 ? 19 : 14);
  },
  onPlayerHit() {
    if (!this.comboGuard) this.combo = Math.floor(this.combo / 2);
    this.comboTimer = Math.min(this.comboTimer, 1.6);
  },
};

try { state.best = Number(localStorage.getItem('voidbloom-best') || 0); } catch { state.best = 0; }

let enemies = [];

function banner(text, boss = false) {
  state.bannerText = text;
  state.bannerBoss = boss;
  state.bannerT = 1.7;
}

function startWave(n) {
  state.wave = n;
  director.startWave(n);
  if (n % 5 === 0) {
    banner('⚠ VOIDMOTHER ⚠', true);
    audio.sfx('boss');
  } else {
    banner(`WAVE ${n}`);
  }
}

function startRun() {
  player.reset();
  combat.clear();
  enemies = [];
  state.spawnQueue = [];
  state.score = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.kills = 0;
  state.comboGuard = false;
  state.deathT = 0;
  state.paused = false;
  startWave(1);
}

function waveCleared() {
  audio.sfx('waveclear');
  if (state.autoPlay) {
    const c = rollChoices(player, state);
    if (c.length) c[0].apply(player, state);
    startWave(state.wave + 1);
  } else {
    state.choices = rollChoices(player, state);
    state.mode = 'upgrade';
  }
}

function gameOver() {
  state.mode = 'over';
  if (state.score > state.best) {
    state.best = state.score;
    try { localStorage.setItem('voidbloom-best', String(state.best)); } catch { /* private mode */ }
  }
  audio.sfx('gameover');
}

function separateEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.r + b.r - 2;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const ux = dx / d, uy = dy / d;
        if (!a.isBoss) { a.x -= ux * push; a.y -= uy * push; }
        if (!b.isBoss) { b.x += ux * push; b.y += uy * push; }
      }
    }
  }
}

function updatePlaying(dt) {
  // spawn queue (splitter children, boss minions arrive via director)
  for (const s of state.spawnQueue) enemies.push(new Enemy(s.type, s.x, s.y));
  state.spawnQueue = [];
  director.update(dt, enemies);

  let ctl;
  if (state.autoPlay) {
    ctl = player.autopilot(dt, enemies, combat.pickups);
  } else {
    const mv = input.moveAxis();
    ctl = {
      move: mv,
      aim: angleTo(player.x, player.y, input.mouse.x, input.mouse.y),
      firing: input.mouse.down,
      dash: input.down('ShiftLeft', 'ShiftRight', 'Space'),
    };
  }
  if (!player.dead) {
    if (player.update(dt, ctl.move, ctl.aim, ctl.firing, ctl.dash, world)) {
      combat.fire(player);
      player.consumeFireTimer();
    }
  }

  for (const e of enemies) {
    if (e.portalT > 0) { e.portalT -= dt; continue; }
    e.update(dt, player, combat, director);
  }
  separateEnemies();
  combat.update(dt, player, enemies, state);
  enemies = enemies.filter((e) => !e.dead);
  state.comboTimer -= dt;
  if (state.comboTimer <= 0) state.combo = 0;

  if (player.dead) {
    state.deathT += dt;
    if (state.deathT === dt) {
      world.burst(player.x, player.y, '#40e0ff', 46, 380, 0.9, 4);
      world.burst(player.x, player.y, '#ff3ea8', 30, 300, 0.9, 3.4);
      world.addShake(15);
      audio.sfx('bigExplode');
    }
    if (state.deathT > 1.15) {
      if (state.autoPlay) { startRun(); }
      else gameOver();
    }
    return;
  }

  if (director.done && enemies.length === 0 && state.spawnQueue.length === 0) {
    waveCleared();
  }
}

function update(dt) {
  state.time += dt;
  world.update(dt);
  state.bannerT = Math.max(0, state.bannerT - dt);
  audio.updateMusic(state.mode === 'playing' && !state.paused);

  if (state.mode === 'title') {
    updatePlaying(dt); // attract mode: the game plays itself behind the title
    if (input.justPressed('Enter') || ui.clicked(input, W / 2 - 110, 356, 220, 52)) {
      audio.unlock();
      audio.sfx('click');
      state.autoPlay = false;
      state.mode = 'playing';
      startRun();
    }
  } else if (state.mode === 'playing') {
    if (input.justPressed('KeyP')) state.paused = !state.paused;
    if (!state.paused) updatePlaying(dt);
    if (input.justPressed('Escape')) {
      state.mode = 'title';
      state.autoPlay = true;
      startRun();
    }
  } else if (state.mode === 'upgrade') {
    if (input.justPressed('Digit1', 'Digit2', 'Digit3')) {
      const i = ['Digit1', 'Digit2', 'Digit3'].findIndex((c) => input.pressed.has(c));
      chooseUpgrade(i);
    }
  } else if (state.mode === 'over') {
    if (input.justPressed('KeyR') || (input.clicks.length && state.deathT > 0)) {
      audio.sfx('click');
      state.mode = 'playing';
      startRun();
    }
    if (input.justPressed('Escape')) {
      state.mode = 'title';
      state.autoPlay = true;
      startRun();
    }
  }
  if (input.justPressed('KeyM')) audio.muted = !audio.muted;
}

function chooseUpgrade(i) {
  const u = state.choices[i];
  if (!u) return;
  u.apply(player, state);
  audio.sfx('upgrade');
  world.floatText(player.x, player.y - 30, u.name, '#7df0ff', 17);
  state.mode = 'playing';
  startWave(state.wave + 1);
}

let upgradeRects = [];
function draw() {
  ctx.save();
  world.applyShake(ctx);
  world.draw(ctx);
  combat.draw(ctx);
  for (const e of enemies) {
    if (e.portalT > 0) ctx.globalAlpha = 0.3;
    e.draw(ctx);
    ctx.globalAlpha = 1;
  }
  if (!player.dead && state.mode !== 'over') player.draw(ctx, state.time);
  ctx.restore();

  const boss = enemies.find((e) => e.isBoss);
  if (state.mode === 'playing' || state.mode === 'upgrade') {
    ui.drawHud(ctx, state, player, director, boss);
  }
  ui.drawWaveBanner(ctx, state, state.time);

  if (state.mode === 'title') {
    ui.drawTitle(ctx, state, state.time);
    ui.button(ctx, input, W / 2 - 110, 356, 220, 52, '▶  PLAY');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = "600 12.5px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = 'rgba(160,200,235,0.65)';
    ctx.fillText('sound on for the full bloom — M to mute', W / 2, 436);
    ctx.restore();
  } else if (state.mode === 'upgrade') {
    upgradeRects = ui.drawUpgrade(ctx, state, state.choices, input, state.time);
    for (const r of upgradeRects) {
      if (ui.clicked(input, r.x, r.y, r.w, r.h)) chooseUpgrade(state.choices.indexOf(r.u));
    }
  } else if (state.mode === 'over') {
    ui.drawGameOver(ctx, state, state.time);
    ui.button(ctx, input, W / 2 - 100, 336, 200, 46, 'RESTART');
    if (ui.clicked(input, W / 2 - 100, 336, 200, 46)) {
      state.mode = 'playing';
      startRun();
    }
  }
  if (state.paused && state.mode === 'playing') ui.drawPaused(ctx);
}

// --- screenshot staging -------------------------------------------------
function stageShot(kind) {
  if (kind === 'title') {
    state.autoPlay = true;
    state.mode = 'title';
    startRun();
    startWave(2);
  } else if (kind === 'battle') {
    state.autoPlay = true;
    state.mode = 'playing';
    startRun();
    startWave(4);
    state.score = 8640; state.kills = 37; state.combo = 14; state.comboTimer = 3.1;
    for (let i = 0; i < 6; i++) {
      const kinds = ['chaser', 'weaver', 'dart', 'splitter', 'chaser', 'dart'];
      const e = new Enemy(kinds[i], 140 + (i % 3) * 320 + rand(40), 110 + Math.floor(i / 3) * 260 + rand(30));
      enemies.push(e);
    }
  } else if (kind === 'upgrade') {
    state.autoPlay = false;
    state.mode = 'upgrade';
    startRun();
    state.score = 5210; state.kills = 23; state.wave = 3;
    state.choices = rollChoices(player, state);
    director.wave = 3; director.queue = [];
  } else if (kind === 'over') {
    state.mode = 'over';
    state.score = 18450; state.best = 18450; state.kills = 121; state.wave = 8;
    state.deathT = 1;
    world.burst(480, 290, '#40e0ff', 30, 300, 1, 3.6);
    world.burst(480, 290, '#ff3ea8', 22, 240, 1, 3);
  }
}

if (SHOT) stageShot(SHOT);
else { state.autoPlay = true; startRun(); }

addEventListener('pointerdown', () => audio.unlock(), { once: false });
addEventListener('keydown', () => audio.unlock(), { once: false });

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.033);
  last = now;
  const slow = player.dead && state.mode === 'playing' ? 0.35 : 1;
  update(dt * slow);
  draw();
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
