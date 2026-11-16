// enemies.js — the voidspawn. Four hunter types with distinct movement
// and a boss every fifth wave, plus the wave director that composes each
// wave, telegraphs spawns through portals and scales the pressure.

import { rand, clamp, angleTo, TAU } from './rng.js';
import { W, H } from './world.js';

export const TYPES = {
  chaser:   { hp: 2, speed: 118, r: 14, score: 50,  color: '#ff5d7a', sides: 3 },
  dart:     { hp: 1, speed: 92,  r: 11, score: 80,  color: '#ffb340', sides: 4 },
  weaver:   { hp: 3, speed: 74,  r: 15, score: 120, color: '#b46bff', sides: 4 },
  splitter: { hp: 4, speed: 62,  r: 19, score: 100, color: '#4dff9d', sides: 5 },
  mini:     { hp: 1, speed: 168, r: 8,  score: 30,  color: '#4dff9d', sides: 5 },
};

export class Enemy {
  constructor(type, x, y, scale = 1) {
    const t = TYPES[type];
    this.type = type;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = t.r;
    this.hp = Math.round(t.hp * scale);
    this.maxHp = this.hp;
    this.speed = t.speed * rand(0.9, 1.1);
    this.score = t.score;
    this.color = t.color;
    this.sides = t.sides;
    this.rot = rand(TAU);
    this.t = rand(10);
    this.fireTimer = rand(1.2, 2.6);
    this.dashState = 0; // dart: 0 roam, 1 telegraph, 2 lunging
    this.dashTimer = rand(0.6, 1.6);
    this.flash = 0;
    this.dead = false;
  }

  update(dt, player, combat) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    const a = angleTo(this.x, this.y, player.x, player.y);
    const d = Math.hypot(player.x - this.x, player.y - this.y);
    if (this.type === 'chaser' || this.type === 'mini') {
      this.vx += (Math.cos(a) * this.speed - this.vx) * Math.min(1, 3.2 * dt);
      this.vy += (Math.sin(a) * this.speed - this.vy) * Math.min(1, 3.2 * dt);
    } else if (this.type === 'weaver') {
      const sway = Math.sin(this.t * 2.6) * 0.9;
      const dir = d > 300 ? a : a + Math.PI * 0.82;
      this.vx += (Math.cos(dir + sway * 0.4) * this.speed - this.vx) * Math.min(1, 2.4 * dt);
      this.vy += (Math.sin(dir + sway * 0.4) * this.speed - this.vy) * Math.min(1, 2.4 * dt);
      this.fireTimer -= dt;
      if (this.fireTimer <= 0 && d < 430) {
        this.fireTimer = rand(2.0, 2.9);
        combat.spawnEnemyBullet(this.x, this.y, a, 215);
      }
    } else if (this.type === 'splitter') {
      this.vx += (Math.cos(a) * this.speed - this.vx) * Math.min(1, 2.2 * dt);
      this.vy += (Math.sin(a) * this.speed - this.vy) * Math.min(1, 2.2 * dt);
    } else if (this.type === 'dart') {
      this.dashTimer -= dt;
      if (this.dashState === 0) {
        this.vx += (Math.cos(a) * this.speed - this.vx) * Math.min(1, 3 * dt);
        this.vy += (Math.sin(a) * this.speed - this.vy) * Math.min(1, 3 * dt);
        if (this.dashTimer <= 0 && d < 330) { this.dashState = 1; this.dashTimer = 0.45; this.lockA = a; }
      } else if (this.dashState === 1) {
        this.vx *= 1 - 6 * dt; this.vy *= 1 - 6 * dt;
        this.lockA = a;
        if (this.dashTimer <= 0) {
          this.dashState = 2; this.dashTimer = 0.34;
          this.vx = Math.cos(this.lockA) * 560;
          this.vy = Math.sin(this.lockA) * 560;
        }
      } else {
        if (this.dashTimer <= 0) { this.dashState = 0; this.dashTimer = rand(0.7, 1.5); }
      }
    }
    this.x = clamp(this.x + this.vx * dt, this.r, W - this.r);
    this.y = clamp(this.y + this.vy * dt, this.r, H - this.r);
    this.rot += dt * (this.type === 'dart' && this.dashState === 1 ? 9 : 1.4);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    const flash = this.flash > 0;
    ctx.fillStyle = flash ? '#ffffff' : this.color;
    ctx.strokeStyle = flash ? '#ffffff' : this.color;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    for (let i = 0; i < this.sides; i++) {
      const a = (i / this.sides) * TAU;
      const px = Math.cos(a) * (this.r + 7), py = Math.sin(a) * (this.r + 7);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < this.sides; i++) {
      const a = (i / this.sides) * TAU;
      const px = Math.cos(a) * this.r, py = Math.sin(a) * this.r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : this.color;
    ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill();
    if (this.type === 'dart' && this.dashState === 1) {
      ctx.rotate(-this.rot);
      ctx.strokeStyle = 'rgba(255,179,64,0.55)';
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(this.lockA) * 120, Math.sin(this.lockA) * 120);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    if (this.maxHp > 2 && this.hp < this.maxHp) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(this.x - 14, this.y - this.r - 10, 28, 3.4);
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x - 14, this.y - this.r - 10, 28 * (this.hp / this.maxHp), 3.4);
    }
  }
}

export class Boss {
  constructor(wave) {
    this.type = 'boss';
    this.x = W / 2; this.y = 104;
    this.vx = 0; this.vy = 0;
    this.r = 44;
    this.maxHp = 90 + wave * 22;
    this.hp = this.maxHp;
    this.score = 1500;
    this.color = '#ff3ea8';
    this.t = 0;
    this.rot = 0;
    this.flash = 0;
    this.phaseTimer = 2.2;
    this.phase = 0;
    this.dead = false;
    this.isBoss = true;
  }

  update(dt, player, combat, director) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.rot += dt * 0.7;
    const targetX = W / 2 + Math.sin(this.t * 0.45) * 250;
    const targetY = 118 + Math.sin(this.t * 0.8) * 36;
    this.vx += (targetX - this.x) * Math.min(1, 1.6 * dt) * 2.2;
    this.vy += (targetY - this.y) * Math.min(1, 1.6 * dt) * 2.2;
    this.x += this.vx * dt * 0.4 + (targetX - this.x) * dt * 0.9;
    this.y += this.vy * dt * 0.4 + (targetY - this.y) * dt * 0.9;
    this.phaseTimer -= dt;
    if (this.phaseTimer <= 0) {
      this.phase = (this.phase + 1) % 3;
      this.phaseTimer = this.phase === 0 ? 1.5 : this.phase === 1 ? 2.6 : 1.9;
      if (this.phase === 0) {
        const n = 14;
        for (let i = 0; i < n; i++) combat.spawnEnemyBullet(this.x, this.y, (i / n) * TAU + this.t, 168);
      } else if (this.phase === 1) {
        director.spawnNear('mini', this.x - 60, this.y + 30);
        director.spawnNear('mini', this.x + 60, this.y + 30);
        director.spawnNear('chaser', this.x, this.y + 56);
      }
    }
    if (this.phase === 2 && Math.random() < dt * 7) {
      const a = angleTo(this.x, this.y, player.x, player.y) + rand(-0.16, 0.16);
      combat.spawnEnemyBullet(this.x, this.y, a, 252);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 74);
    g.addColorStop(0, 'rgba(255,62,168,0.4)');
    g.addColorStop(1, 'rgba(255,62,168,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 74, 0, TAU); ctx.fill();
    ctx.rotate(this.rot);
    ctx.strokeStyle = this.flash > 0 ? '#ffffff' : this.color;
    ctx.lineWidth = 3;
    for (const rr of [this.r, this.r * 0.66]) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
      ctx.rotate(0.5);
    }
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#ff3ea8';
    ctx.beginPath(); ctx.arc(0, 0, 10 + Math.sin(this.t * 5) * 2, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

export class WaveDirector {
  constructor(world) {
    this.world = world;
    this.wave = 0;
    this.queue = [];
    this.spawnTimer = 0;
    this.bossActive = false;
  }

  composition(wave) {
    if (wave % 5 === 0) return [{ type: 'boss', n: 1 }];
    const list = [];
    const budget = 4 + wave * 2;
    let spent = 0;
    const add = (type, n, cost) => { list.push({ type, n }); spent += n * cost; };
    add('chaser', Math.min(3 + wave, 9), 1);
    if (wave >= 2) add('dart', Math.min(wave, 6), 1.4);
    if (wave >= 3) add('weaver', Math.min(wave - 1, 5), 1.8);
    if (wave >= 4) add('splitter', Math.min(wave - 2, 4), 2);
    let guard = 0;
    while (spent < budget && guard++ < 12) add('chaser', 2, 1);
    return list;
  }

  startWave(wave) {
    this.wave = wave;
    this.queue = [];
    for (const { type, n } of this.composition(wave)) {
      for (let i = 0; i < n; i++) this.queue.push(type);
    }
    // shuffle, but keep the boss first
    const boss = this.queue.filter((t) => t === 'boss');
    const rest = this.queue.filter((t) => t !== 'boss');
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(rand(i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    this.queue = [...boss, ...rest];
    this.spawnTimer = 0.4;
    this.bossActive = boss.length > 0;
  }

  edgePoint() {
    const side = Math.floor(rand(4));
    if (side === 0) return { x: rand(60, W - 60), y: 34 };
    if (side === 1) return { x: rand(60, W - 60), y: H - 34 };
    if (side === 2) return { x: 34, y: rand(60, H - 60) };
    return { x: W - 34, y: rand(60, H - 60) };
  }

  spawnNear(type, x, y) {
    this.pending = this.pending || [];
    this.pending.push(new Enemy(type, clamp(x, 24, W - 24), clamp(y, 24, H - 24)));
  }

  update(dt, enemies) {
    if (this.pending && this.pending.length) {
      enemies.push(...this.pending);
      this.pending = [];
    }
    if (!this.queue.length) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.55;
      const type = this.queue.shift();
      if (type === 'boss') {
        enemies.push(new Boss(this.wave));
      } else {
        const p = this.edgePoint();
        this.world.addPortal(p.x, p.y, TYPES[type].color);
        const e = new Enemy(type, p.x, p.y, 1 + this.wave * 0.06);
        e.portalT = 0.8;
        enemies.push(e);
      }
    }
  }

  get done() {
    return this.queue.length === 0;
  }
}
