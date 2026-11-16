// upgrades.js — between waves the player drafts one of three upgrades.
// Each is a permanent run-long change, so the choice shapes the build:
// raw fire rate, split shots, dash tech, hull, magnet and combo control.

import { pick } from './rng.js';

export const UPGRADES = [
  {
    id: 'rapid', name: 'RAPID CYCLER', glyph: '»',
    desc: '+20% fire rate',
    apply: (p) => { p.fireRate *= 1.2; },
  },
  {
    id: 'heavy', name: 'HEAVY ROUNDS', glyph: '◆',
    desc: '+1 bullet damage',
    apply: (p) => { p.damage += 1; },
  },
  {
    id: 'split', name: 'SPLIT BLOOM', glyph: '✦',
    desc: '+1 projectile per shot',
    apply: (p) => { p.projectiles += 1; },
  },
  {
    id: 'swift', name: 'SWIFT THRUSTERS', glyph: '→',
    desc: '+13% move speed',
    apply: (p) => { p.speed *= 1.13; },
  },
  {
    id: 'dash', name: 'PHASE DASH', glyph: '↯',
    desc: 'Dash recharges 30% faster',
    apply: (p) => { p.dashCooldownMax *= 0.7; },
  },
  {
    id: 'vitality', name: 'EXTRA HULL', glyph: '♥',
    desc: '+1 max hull and repair 1',
    apply: (p) => { p.maxHp += 1; p.heal(1); },
  },
  {
    id: 'velocity', name: 'RAIL VELOCITY', glyph: '↑',
    desc: '+22% bullet speed, +10% fire rate',
    apply: (p) => { p.bulletSpeed *= 1.22; p.fireRate *= 1.1; },
  },
  {
    id: 'guard', name: 'COMBO GUARD', glyph: '◎',
    desc: 'Taking a hit no longer halves your combo',
    apply: (p, s) => { s.comboGuard = true; },
  },
];

export function rollChoices(player, state) {
  const pool = UPGRADES.filter((u) => u.id !== 'split' || player.projectiles < 5);
  const chosen = [];
  const copy = [...pool];
  while (chosen.length < 3 && copy.length) {
    const u = pick(copy);
    chosen.push(u);
    copy.splice(copy.indexOf(u), 1);
  }
  return chosen;
}
