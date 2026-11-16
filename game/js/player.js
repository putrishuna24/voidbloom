// player.js — the player's bloomship: movement, dashing with i-frames,
// weapon stats grown by upgrades, and the autopilot that flies the ship
// on the title screen's attract mode (and in staged screenshot scenes).

import { clamp, len, angleTo, TAU } from './rng.js';
import { W, H } from './world.js';

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = W / 2;
    this.y = H / 2 + 60;
    this.vx = 0;
    this.vy = 0;
    this.r = 12;
    this.angle = -Math.PI / 2;
    this.maxHp = 3;
    this.hp = 3;
    this.speed = 265;
    this.fireRate = 6.5;      // shots per second
    this.damage = 1;
    this.projectiles = 1;
    this.bulletSpeed = 560;
    this.dashCooldownMax = 1.6;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.fireTimer = 0;
    this.hurtFlash = 0;
    this.dead = false;
    this.trailAcc = 0;
  }

  get invulnerable() {
    return this.dashTime > 0 || this.hurtFlash > 0.55;
  }

  hurt(world, audio) {
    if (this.invulnerable || this.dead) return false;
    this.hp -= 1;
    this.hurtFlash = 0.7;
    world.addShake(9);
    world.burst(this.x, this.y, '#ff5d7a', 22, 300, 0.6, 3.5);
    audio.sfx('hurt');
    if (this.hp <= 0) this.dead = true;
    return true;
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  // move: {x,y} unit intent; aim: angle; firing: bool; dash: bool.
  update(dt, move, aim, firing, dash, world) {
    const dashing = this.dashTime > 0;
    if (dash && this.dashCooldown <= 0 && (move.x !== 0 || move.y !== 0)) {
      this.dashTime = 0.16;
      this.dashCooldown = this.dashCooldownMax;
      this.dashDir = { x: move.x, y: move.y };
      world.burst(this.x, this.y, '#40e0ff', 10, 160, 0.3, 2.5);
    }
    const spd = dashing ? 980 : this.speed;
    const dir = dashing ? this.dashDir : move;
    const accel = dashing ? 1 : 10;
    this.vx += (dir.x * spd - this.vx) * Math.min(1, accel * dt);
    this.vy += (dir.y * spd - this.vy) * Math.min(1, accel * dt);
    this.x = clamp(this.x + this.vx * dt, 18, W - 18);
    this.y = clamp(this.y + this.vy * dt, 18, H - 18);
    this.angle = aim;
    this.dashTime = Math.max(0, this.dashTime - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.fireTimer -= dt;
    this.trailAcc += dt;
    if (this.trailAcc > 0.03 && len(this.vx, this.vy) > 60) {
      this.trailAcc = 0;
      world.trail(this.x - Math.cos(this.angle) * 12, this.y - Math.sin(this.angle) * 12, dashing ? '#40e0ff' : '#3f8cff', 3.4);
    }
    return firing && this.fireTimer <= 0;
  }

  consumeFireTimer() {
    this.fireTimer = 1 / this.fireRate;
  }

  // Attract-mode pilot: kite the nearest enemy, keep a mid-range orbit,
  // dodge dense spots, fire whenever a target is in reach.
  autopilot(dt, enemies, pickups) {
    let tx = null, td = Infinity;
    for (const e of enemies) {
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d < td) { td = d; tx = e; }
    }
    let move = { x: 0, y: 0 };
    let aim = this.angle;
    let firing = false;
    let dash = false;
    if (tx) {
      aim = angleTo(this.x, this.y, tx.x, tx.y);
      firing = td < 460;
      const want = 190;
      const away = angleTo(tx.x, tx.y, this.x, this.y);
      let mx = 0, my = 0;
      if (td < want - 30) { mx = Math.cos(away); my = Math.sin(away); }
      else if (td > want + 60) { mx = -Math.cos(away); my = -Math.sin(away); }
      const orbit = away + Math.PI / 2;
      mx += Math.cos(orbit) * 0.7;
      my += Math.sin(orbit) * 0.7;
      // avoid walls
      if (this.x < 90) mx += 1.2; if (this.x > W - 90) mx -= 1.2;
      if (this.y < 90) my += 1.2; if (this.y > H - 90) my -= 1.2;
      const l = len(mx, my) || 1;
      move = { x: mx / l, y: my / l };
      dash = td < 74 && this.dashCooldown <= 0;
    } else if (pickups && pickups.length) {
      const p = pickups[0];
      const a = angleTo(this.x, this.y, p.x, p.y);
      move = { x: Math.cos(a), y: Math.sin(a) };
      aim = a;
    } else {
      const a = performance.now() / 1400;
      move = { x: Math.cos(a) * 0.6, y: Math.sin(a) * 0.6 };
    }
    return { move, aim, firing, dash };
  }

  draw(ctx, time) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.hurtFlash > 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.35;
    // glow
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
    g.addColorStop(0, 'rgba(64,224,255,0.5)');
    g.addColorStop(1, 'rgba(64,224,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
    // rotating shield ring
    ctx.rotate(time * 1.6);
    ctx.strokeStyle = 'rgba(64,224,255,0.75)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 17, i * (TAU / 3), i * (TAU / 3) + TAU / 5);
      ctx.stroke();
    }
    ctx.rotate(-time * 1.6);
    // hull, pointing at the aim
    ctx.rotate(this.angle);
    ctx.fillStyle = '#dff7ff';
    ctx.strokeStyle = '#40e0ff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-9, 9);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-9, -9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff3ea8';
    ctx.beginPath(); ctx.arc(1, 0, 3.4, 0, TAU); ctx.fill();
    ctx.restore();
    // dash cooldown pip ring
    if (this.dashCooldown > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 24, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - this.dashCooldown / this.dashCooldownMax));
      ctx.stroke();
      ctx.restore();
    }
  }
}
