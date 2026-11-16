// world.js — the arena itself: parallax starfield, nebula glow, floor grid,
// particles, floating score text, spawn portals and screen shake.

import { rand, TAU, clamp } from './rng.js';

export const W = 960;
export const H = 540;

export class World {
  constructor() {
    this.stars = [];
    for (let layer = 0; layer < 3; layer++) {
      const n = [70, 46, 26][layer];
      for (let i = 0; i < n; i++) {
        this.stars.push({ x: rand(W), y: rand(H), layer, r: 0.6 + layer * 0.7, tw: rand(TAU) });
      }
    }
    this.nebulae = [
      { x: 200, y: 120, r: 260, c: 'rgba(64,224,255,0.055)' },
      { x: 790, y: 430, r: 300, c: 'rgba(255,62,168,0.05)' },
      { x: 700, y: 90, r: 200, c: 'rgba(150,90,255,0.05)' },
      { x: 120, y: 470, r: 210, c: 'rgba(64,255,170,0.04)' },
    ];
    this.particles = [];
    this.texts = [];
    this.portals = [];
    this.shake = 0;
    this.time = 0;
  }

  addShake(amount) {
    this.shake = Math.min(16, this.shake + amount);
  }

  burst(x, y, color, n = 14, speed = 260, life = 0.55, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU);
      const s = rand(0.25, 1) * speed;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.5, 1) * life, maxLife: life, color, size: rand(0.5, 1) * size,
      });
    }
  }

  trail(x, y, color, size = 4) {
    this.particles.push({ x, y, vx: rand(-16, 16), vy: rand(-16, 16), life: 0.3, maxLife: 0.3, color, size });
  }

  floatText(x, y, text, color = '#ffffff', size = 15) {
    this.texts.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
  }

  addPortal(x, y, color) {
    this.portals.push({ x, y, color, t: 0, dur: 0.8 });
  }

  update(dt) {
    this.time += dt;
    for (const s of this.stars) {
      s.x -= (2 + s.layer * 5) * dt;
      if (s.x < -2) { s.x = W + 2; s.y = rand(H); }
    }
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= (1 - 2.4 * dt);
      p.vy *= (1 - 2.4 * dt);
      return p.life > 0;
    });
    this.texts = this.texts.filter((t) => {
      t.life -= dt;
      t.y -= 34 * dt;
      return t.life > 0;
    });
    this.portals = this.portals.filter((p) => {
      p.t += dt;
      return p.t < p.dur;
    });
    this.shake *= Math.pow(0.0015, dt);
    if (this.shake < 0.05) this.shake = 0;
  }

  draw(ctx) {
    ctx.fillStyle = '#070818';
    ctx.fillRect(0, 0, W, H);
    for (const n of this.nebulae) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, n.c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    // floor grid
    ctx.strokeStyle = 'rgba(80,120,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 48) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y <= H; y += 48) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    // stars
    for (const s of this.stars) {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(this.time * 1.4 + s.tw));
      ctx.globalAlpha = a * (0.35 + s.layer * 0.3);
      ctx.fillStyle = '#cfe8ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // arena frame
    ctx.strokeStyle = 'rgba(64,224,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.strokeStyle = 'rgba(64,224,255,0.10)';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    // portals (spawn telegraphs)
    for (const p of this.portals) {
      const k = p.t / p.dur;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.75 * k;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26 * (1 - k) + 8, this.time * 6, this.time * 6 + TAU * 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14 * (1 - k) + 4, -this.time * 8, -this.time * 8 + TAU * 0.6);
      ctx.stroke();
      ctx.restore();
    }
    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife) + 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // floating texts
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.life / t.maxLife, 0, 1);
      ctx.font = `700 ${t.size}px 'Segoe UI', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  applyShake(ctx) {
    if (this.shake > 0) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    }
  }
}
