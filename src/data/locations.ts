export type LocationPayoff = 'IDOL' | 'CLUE' | 'COMMON';

export interface Location {
  id: string;
  name: string;
  risk: number;          // 0–1
  payoff: LocationPayoff;
  staminaCost: number;
  mapX: number;          // % from left
  mapY: number;          // % from top
  unlocked: boolean;
  cluesHeld: number;     // clues found for this location
  idolHidden: boolean;   // true when an idol is currently here
}

export const INITIAL_LOCATIONS: Location[] = [
  { id: 'beach',    name: 'South Beach',       risk: 0.10, payoff: 'COMMON', staminaCost: 10, mapX: 22, mapY: 78, unlocked: true,  cluesHeld: 0, idolHidden: false },
  { id: 'tidepool', name: 'Tide Pools',         risk: 0.20, payoff: 'CLUE',   staminaCost: 15, mapX: 70, mapY: 80, unlocked: true,  cluesHeld: 0, idolHidden: false },
  { id: 'cliffs',   name: 'Coastal Cliffs',     risk: 0.50, payoff: 'IDOL',   staminaCost: 25, mapX: 80, mapY: 35, unlocked: false, cluesHeld: 0, idolHidden: true  },
  { id: 'jungle',   name: 'Inland Jungle',      risk: 0.40, payoff: 'CLUE',   staminaCost: 20, mapX: 45, mapY: 45, unlocked: false, cluesHeld: 0, idolHidden: false },
  { id: 'wreck',    name: 'Old Wreck',           risk: 0.60, payoff: 'IDOL',   staminaCost: 30, mapX: 15, mapY: 30, unlocked: false, cluesHeld: 0, idolHidden: true  },
  { id: 'spring',   name: 'Freshwater Spring',   risk: 0.15, payoff: 'COMMON', staminaCost:  8, mapX: 55, mapY: 18, unlocked: true,  cluesHeld: 0, idolHidden: false },
];

export const CLUE_FLAVOR: Record<string, [string, string]> = {
  cliffs:  ['Near salt water, up high', 'Under the split rock at the tide pools — look east from the cliff face'],
  jungle:  ['Something shines through the canopy at midday', 'Twenty paces north of the twisted strangler fig'],
  wreck:   ['The old timbers hold more than rot', 'Beneath the rusted anchor chain, wrapped in sailcloth'],
};

// Returns idol find probability for a location given clues held
export function idolFindProbability(location: Location): number {
  const base = 0.35;
  const clueBonus = location.cluesHeld * 0.15;
  return Math.min(0.85, base + clueBonus);
}

// "Being watched" warning fires if player searches ≥2 times per day
export const SEARCHES_PER_DAY_WARNING = 2;