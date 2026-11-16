// rng.js — seeded randomness and small math helpers.
// The game normally runs on Math.random; screenshot staging (?seed=N)
// swaps in a deterministic stream so a staged scene is reproducible.

export const TAU = Math.PI * 2;

let stream = Math.random;

export function useSeed(seed) {
  let a = seed >>> 0;
  stream = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rand(a = 1, b) {
  if (b === undefined) { b = a; a = 0; }
  return a + stream() * (b - a);
}

export function randi(a, b) {
  return Math.floor(rand(a, b + 1));
}

export function pick(list) {
  return list[Math.floor(stream() * list.length)];
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function len(x, y) {
  return Math.hypot(x, y);
}

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}
