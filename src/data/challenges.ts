import type React from 'react';
import type { MinigameProps, ChallengeKind } from '../minigames/types';
import SlidePuzzleGame from '../minigames/SlidePuzzleGame';
import SymbolMatchGame from '../minigames/SymbolMatchGame';
import BalanceBeamGame from '../minigames/BalanceBeamGame';
import RingTossGame from '../minigames/RingTossGame';
import WaterCarryGame from '../minigames/WaterCarryGame';
import HangOnGame from '../minigames/HangOnGame';
import FireGame from '../minigames/FireGame';

export interface ChallengeDef {
  key: string;
  displayName: string;
  kind: ChallengeKind;
  component: React.ComponentType<MinigameProps>;
  // Fire is a 2-up split-screen game; everything else takes the full field.
  twoUp: boolean;
  fullScreen: boolean; // bypass the ScrollView wrapper
}

export const CHALLENGE_DEFS: ChallengeDef[] = [
  { key: 'slide',   displayName: 'PUZZLE RACE',     kind: 'mental',    component: SlidePuzzleGame, twoUp: false, fullScreen: false },
  { key: 'symbol',  displayName: 'MEMORY BOARD',    kind: 'mental',    component: SymbolMatchGame, twoUp: false, fullScreen: false },
  { key: 'balance', displayName: 'BALANCE BEAM',    kind: 'mixed',     component: BalanceBeamGame, twoUp: false, fullScreen: false },
  { key: 'ring',    displayName: 'RING TOSS',       kind: 'strength',  component: RingTossGame,    twoUp: false, fullScreen: false },
  { key: 'water',   displayName: 'WATER CARRY',     kind: 'strength',  component: WaterCarryGame,  twoUp: false, fullScreen: false },
  { key: 'hang',    displayName: 'ENDURANCE HANG',  kind: 'endurance', component: HangOnGame,      twoUp: false, fullScreen: false },
  { key: 'fire',    displayName: 'FIRE-MAKING',     kind: 'mixed',     component: FireGame,        twoUp: true,  fullScreen: true },
];

export const CHALLENGE_BY_KEY: Record<string, ChallengeDef> =
  Object.fromEntries(CHALLENGE_DEFS.map(d => [d.key, d]));

// Pick a challenge for a given day, deterministically. Excludes the 2-up fire game
// from the regular individual/tribe rotation (fire is reserved for duels/F4).
export function pickChallenge(rng: () => number, opts?: { allowFire?: boolean }): ChallengeDef {
  const pool = CHALLENGE_DEFS.filter(d => opts?.allowFire || !d.twoUp);
  return pool[Math.floor(rng() * pool.length)];
}
