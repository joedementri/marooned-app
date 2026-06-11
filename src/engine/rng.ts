// Deterministic RNG for all simulation logic.
//
// Rule of thumb: anything that affects game state (votes, idol finds, alliances,
// challenge AI) must flow from `gameRng(gameSeed, scope)` so a season is fully
// reproducible from its `gameSeed`. Cosmetic-only animation may use Math.random().

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a hash over the joined parts → a 32-bit unsigned seed.
export function hashSeed(...parts: Array<string | number>): number {
  const str = parts.join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// A scoped, deterministic stream. `scope` namespaces the stream so independent
// systems on the same day don't share/clobber each other's sequence.
export function gameRng(gameSeed: number, scope: string): () => number {
  return mulberry32(hashSeed(gameSeed, scope));
}

// Convenience: pick a random element from a non-empty array using an rng.
export function pickFrom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Convenience: in-place-free Fisher-Yates shuffle returning a new array.
export function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
