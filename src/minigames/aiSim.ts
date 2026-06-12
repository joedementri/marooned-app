// Helpers for per-game AI simulation. Each participant gets an independent,
// order-insensitive RNG stream keyed on (seed, tag, id), so adding/removing
// opponents never reshuffles anyone else's outcome.

import { mulberry32, hashSeed } from '../engine/rng';

export function aiRng(seed: number, participantId: number, tag: string): () => number {
  return mulberry32(hashSeed(seed, tag, participantId));
}

// Cheap gaussian-ish noise in roughly [-1.5, 1.5], mean 0 (sum of 3 uniforms).
export function gauss(rng: () => number): number {
  return rng() + rng() + rng() - 1.5;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
