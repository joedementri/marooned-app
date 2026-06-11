// Pure fire-making stage machine, shared by the player (driven by gestures) and
// the AI (driven by useFireAi). The full process: build a twine nest → shave
// magnesium → strike flint → coax an ember → small sticks → large sticks → the
// flame burns the rope → flag flips.

export type FireStage =
  | 'nest' | 'shave' | 'strike' | 'ember' | 'smallSticks' | 'largeSticks' | 'ropeBurn' | 'done';

export interface FireState {
  stage: FireStage;
  nestPieces: number;   // 0..NEST_NEEDED
  shavings: number;     // 0..100
  emberHealth: number;  // 0..100
  flameHeight: number;  // 0..100
  ropeBurn: number;     // 0..100
  strikes: number;
}

export const NEST_NEEDED = 3;
export const SHAVINGS_NEEDED = 100;
export const SMALL_TARGET = 55;
export const LARGE_TARGET = 100;
export const ROPE_FLAME_MIN = 68; // flame must be this high to burn the rope

export function initFireState(): FireState {
  return { stage: 'nest', nestPieces: 0, shavings: 0, emberHealth: 0, flameHeight: 0, ropeBurn: 0, strikes: 0 };
}

export type FireAction =
  | { kind: 'placePiece' }
  | { kind: 'shave'; quality: number }   // 0..1
  | { kind: 'strike'; quality: number }  // 0..1 (also encodes the rng roll)
  | { kind: 'blow'; strength: number }   // 0..1
  | { kind: 'addSmall' }
  | { kind: 'holdLarge'; dt: number }    // ms held this frame
  | { kind: 'fan' }                      // raise the flame while burning the rope
  | { kind: 'tick'; dt: number };        // ms elapsed (decay)

function clamp(v: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, v)); }

export function fireReducer(s: FireState, a: FireAction): FireState {
  if (s.stage === 'done') return s;
  const perSec = (rate: number, dt: number) => rate * (dt / 1000);

  switch (a.kind) {
    case 'placePiece': {
      if (s.stage !== 'nest') return s;
      const nestPieces = s.nestPieces + 1;
      return nestPieces >= NEST_NEEDED ? { ...s, nestPieces, stage: 'shave' } : { ...s, nestPieces };
    }

    case 'shave': {
      if (s.stage !== 'shave') return s;
      const shavings = clamp(s.shavings + 10 + a.quality * 14);
      return shavings >= SHAVINGS_NEEDED ? { ...s, shavings: 100, stage: 'strike' } : { ...s, shavings };
    }

    case 'strike': {
      if (s.stage !== 'strike') return s;
      const strikes = s.strikes + 1;
      // A clean, fast strike catches a spark.
      if (a.quality > 0.5) {
        return { ...s, strikes, emberHealth: 28, stage: 'ember' };
      }
      return { ...s, strikes };
    }

    case 'blow': {
      if (s.stage !== 'ember') return s;
      const emberHealth = clamp(s.emberHealth + 6 + a.strength * 10);
      if (emberHealth >= 62) {
        return { ...s, emberHealth: 100, flameHeight: 15, stage: 'smallSticks' };
      }
      return { ...s, emberHealth };
    }

    case 'addSmall': {
      if (s.stage !== 'smallSticks') return s;
      if (s.flameHeight < 8) return s; // nothing to catch on
      // Smother risk when piling on too aggressively.
      if (s.flameHeight > 46 && (s.strikes * 7919 + s.flameHeight) % 10 < 3) {
        return { ...s, flameHeight: clamp(s.flameHeight - 14) };
      }
      const flameHeight = clamp(s.flameHeight + 13);
      return flameHeight >= SMALL_TARGET ? { ...s, flameHeight: SMALL_TARGET, stage: 'largeSticks' } : { ...s, flameHeight };
    }

    case 'holdLarge': {
      if (s.stage !== 'largeSticks') return s;
      const flameHeight = clamp(s.flameHeight + perSec(48, a.dt));
      return flameHeight >= LARGE_TARGET ? { ...s, flameHeight: 100, stage: 'ropeBurn' } : { ...s, flameHeight };
    }

    case 'fan': {
      if (s.stage !== 'ropeBurn') return s;
      return { ...s, flameHeight: clamp(s.flameHeight + 16) };
    }

    case 'tick': {
      const dt = a.dt;
      switch (s.stage) {
        case 'ember': {
          const emberHealth = clamp(s.emberHealth - perSec(26, dt));
          if (emberHealth <= 0) {
            // Ember died — back to striking, but keep most shavings.
            return { ...s, emberHealth: 0, shavings: 60, stage: 'strike' };
          }
          return { ...s, emberHealth };
        }
        case 'smallSticks': {
          const flameHeight = clamp(s.flameHeight - perSec(8, dt));
          if (flameHeight <= 0) return { ...s, flameHeight: 0, emberHealth: 20, stage: 'ember' };
          return { ...s, flameHeight };
        }
        case 'largeSticks': {
          const flameHeight = clamp(s.flameHeight - perSec(11, dt));
          if (flameHeight <= SMALL_TARGET - 25) return { ...s, flameHeight, stage: 'smallSticks' };
          return { ...s, flameHeight };
        }
        case 'ropeBurn': {
          const flameHeight = clamp(s.flameHeight - perSec(9, dt));
          const ropeBurn = clamp(
            s.ropeBurn + (s.flameHeight >= ROPE_FLAME_MIN ? perSec(24, dt) : -perSec(6, dt)),
          );
          if (ropeBurn >= 100) return { ...s, flameHeight, ropeBurn: 100, stage: 'done' };
          if (flameHeight < SMALL_TARGET) return { ...s, flameHeight, ropeBurn, stage: 'largeSticks' };
          return { ...s, flameHeight, ropeBurn };
        }
        default:
          return s;
      }
    }
  }
}

// A coarse 0..1 progress estimate for the result/score when a bout is cut short.
export function fireProgress(s: FireState): number {
  const order: FireStage[] = ['nest', 'shave', 'strike', 'ember', 'smallSticks', 'largeSticks', 'ropeBurn', 'done'];
  const idx = order.indexOf(s.stage);
  const base = idx / (order.length - 1);
  if (s.stage === 'ropeBurn') return Math.min(1, 0.75 + (s.ropeBurn / 100) * 0.25);
  return base;
}
