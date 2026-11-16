// combat.js — bullets, pickups and every collision. Kills feed the score
// through the combo multiplier; shards drift toward the player and keep
// the combo alive, hearts repair the hull.

import { rand, dist, TAU } from './rng.js';
import { W, H } from './world.js';

export class Combat {
  constructor(world, audio) {
    this.world = world;
    this.audio = audio;
    this.bullets = [];       // player's
    this.enemyBullets = [];  // the voidspawn's
    this.pickups = [];
  }

  clear() {
    this.bullets.length = 0;
    this.enemyBullets.length = 0;
    this.pickups.length = 0;
  }

  fire(player) {
    const n = player.projectiles;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * 0.13;
      const a = player.angle + off;
      this.bullets.push({
        x: player.x + Math.cos(player.angle) * 16,
        y: player.y + Math.sin(player.angle) * 16,
        vx: Math.cos(a) * player.bulletSpeed,
        vy: Math.sin(a) * player.bulletSpeed,
        dmg: player.damage,
        life: 0.9,
      });
    }
    this.audio.sfx('shoot');
  }

  spawnEnemyBullet(x, y, angle, speed) {
    this.enemyBullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 5, life: 4 });
  }

  dropPickups(e) {
    const shards = e.isBoss ? 10 : e.type === 'mini' ? 1 : 2 + Math.floor(rand(2));
    for (let i = 0; i < shards; i++) {
      const a = rand(TAU);
      this.pickups.push({
        kind: 'shard', x: e.x, y: e.y,
        vx: Math.cos(a) * rand(40, 130), vy: Math.sin(a) * rand(40, 130),
        life: 9, t: rand(TAU),
      });
    }
    if (!e.isBoss && Math.random() < 0.055) {
      this.pickups.push({ kind: 'heart', x: e.x, y: e.y, vx: 0, vy: 0, life: 9, t: 0 });
    }
  }

  // state: { score, combo, comboTimer, kills, addScore(points, x, y) }
  update(dt, player, enemies, state) {
    const world = this.world;
    // player bullets
    this.bullets = this.bullets.filter((b) => {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      return b.life > 0 && b.x > 0 && b.x < W && b.y > 0 && b.y < H;
    });
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const e of enemies) {
        if (e.dead || e.portalT > 0) continue;
        if (dist(b.x, b.y, e.x, e.y) < e.r + 3) {
          b.dead = true;
          e.hp -= b.dmg;
          e.flash = 0.09;
          world.burst(b.x, b.y, e.color, 4, 170, 0.3, 2.4);
          this.audio.sfx('enemyHit');
          if (e.hp <= 0) this.kill(e, player, state);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    // enemy bullets vs player
    this.enemyBullets = this.enemyBullets.filter((b) => {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      return b.life > 0 && b.x > 0 && b.x < W && b.y > 0 && b.y < H;
    });
    if (!player.dead) {
      for (const b of this.enemyBullets) {
        if (dist(b.x, b.y, player.x, player.y) < player.r + b.r - 2) {
          b.life = 0;
          if (player.hurt(world, this.audio)) state.onPlayerHit();
        }
      }
      this.enemyBullets = this.enemyBullets.filter((b) => b.life > 0);
      // body collisions
      for (const e of enemies) {
        if (e.dead || e.portalT > 0) continue;
        if (dist(player.x, player.y, e.x, e.y) < player.r + e.r - 3) {
          if (player.dashTime > 0) {
            // dashing through an enemy rams it
            e.hp -= 2;
            e.flash = 0.09;
            if (e.hp <= 0) this.kill(e, player, state);
          } else if (player.hurt(world, this.audio)) {
            state.onPlayerHit();
            e.hp -= 1;
            if (e.hp <= 0) this.kill(e, player, state);
          }
        }
      }
    }
    // pickups
    this.pickups = this.pickups.filter((p) => {
      p.life -= dt; p.t += dt * 4;
      const d = dist(p.x, p.y, player.x, player.y);
      if (!player.dead && d < 130) {
        const s = (1 - d / 130) * 340 + 60;
        p.vx += ((player.x - p.x) / (d || 1)) * s * dt * 4;
        p.vy += ((player.y - p.y) / (d || 1)) * s * dt * 4;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - 2.2 * dt; p.vy *= 1 - 2.2 * dt;
      if (!player.dead && d < player.r + 11) {
        if (p.kind === 'shard') {
          state.addScore(10, p.x, p.y, true);
          state.comboTimer = Math.min(state.comboTimer + 0.35, 4);
          this.audio.sfx('pickup');
        } else {
          player.heal(1);
          world.floatText(player.x, player.y - 22, '+1 HULL', '#4dff9d', 15);
          this.audio.sfx('heart');
        }
        return false;
      }
      return p.life > 0;
    });
  }

  kill(e, player, state) {
    e.dead = true;
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = 4;
    const mult = state.multiplier;
    state.addScore(e.score * mult, e.x, e.y, false);
    this.world.burst(e.x, e.y, e.color, e.isBoss ? 60 : 16, e.isBoss ? 420 : 280, 0.7, 3.6);
    this.world.addShake(e.isBoss ? 14 : 3.5);
    this.audio.sfx(e.isBoss ? 'bigExplode' : 'explode');
    this.dropPickups(e);
    if (e.type === 'splitter') {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + rand(0.5);
        state.spawnQueue.push({ type: 'mini', x: e.x + Math.cos(a) * 16, y: e.y + Math.sin(a) * 16 });
      }
    }
  }

  draw(ctx) {
    // pickups
    for (const p of this.pickups) {
      const blink = p.life < 2 ? (Math.sin(p.t * 10) > 0 ? 1 : 0.25) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.translate(p.x, p.y);
      if (p.kind === 'shard') {
        ctx.rotate(p.t);
        ctx.fillStyle = '#ffe95e';
        ctx.strokeStyle = '#fff6b0';
        ctx.beginPath();
        ctx.moveTo(0, -6); ctx.lineTo(4.4, 0); ctx.lineTo(0, 6); ctx.lineTo(-4.4, 0);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = '#4dff9d';
        const s = 7 + Math.sin(p.t * 2) * 1;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.9);
        ctx.bezierCurveTo(-s * 1.3, -s * 0.2, -s * 0.6, -s * 1.1, 0, -s * 0.35);
        ctx.bezierCurveTo(s * 0.6, -s * 1.1, s * 1.3, -s * 0.2, 0, s * 0.9);
        ctx.fill();
      }
      ctx.restore();
    }
    // player bullets
    ctx.fillStyle = '#bffbff';
    for (const b of this.bullets) {
      ctx.save();
      ctx.shadowColor = '#40e0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(b.x, b.y, 3.2, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // enemy bullets
    for (const b of this.enemyBullets) {
      ctx.save();
      ctx.shadowColor = '#ff3ea8';
      ctx.shadowBlur = 9;
      ctx.fillStyle = '#ff8fd0';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
}
