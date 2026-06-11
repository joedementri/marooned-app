import type { Castaway } from '../data/roster';
import { seeded } from './seeded';

// ID conventions: 0 = player, 1–18 = NPC castaway ids
export const PLAYER_ID = 0;

export interface VoteInput {
  // NPCs who are voting this tribal (already filtered to the relevant tribe/post-merge group)
  voters: Castaway[];
  // NPCs who can be voted for (immune NPC already removed)
  targets: Castaway[];
  // Whether the player is a valid target (false if player has individual or tribe immunity)
  playerIsTarget: boolean;
  // Who the player voted for (NPC id)
  playerVote: number;
  day: number;
}

// Returns: targetId (0=player) → array of voter ids (0=player, 1-18=NPC)
export type VoteMap = Record<number, number[]>;

export function simulateVotes(input: VoteInput): VoteMap {
  const { voters, targets, playerIsTarget, playerVote, day } = input;
  const rng = seeded(day * 7_777 + voters.length * 31);
  const result: VoteMap = {};

  // Player's vote
  result[playerVote] = [PLAYER_ID];

  // Build the full pool of castaway targets for NPC consideration
  const targetIds = targets.map(t => t.id);
  if (playerIsTarget) targetIds.push(PLAYER_ID);

  const targetMap = new Map<number, Castaway | null>(
    targets.map(t => [t.id, t] as [number, Castaway])
  );
  targetMap.set(PLAYER_ID, null); // player is null (no stats available to NPCs)

  for (const voter of voters) {
    const pool = targetIds.filter(id => id !== voter.id);
    if (pool.length === 0) continue;

    const picked = pickTarget(voter, pool, targetMap, playerVote, rng);
    if (!result[picked]) result[picked] = [];
    result[picked].push(voter.id);
  }

  return result;
}

function pickTarget(
  voter: Castaway,
  pool: number[],
  targetMap: Map<number, Castaway | null>,
  playerVote: number,
  rng: () => number,
): number {
  const scored = pool.map(id => {
    const c = targetMap.get(id) ?? null;
    let score = 0;

    if (c) {
      score += c.stats.threat * 3.0;
      score += (1 - c.stats.loyalty) * 1.5;
      score += c.stats.suspicion * 1.0;
      score -= c.stats.social * 0.5;

      if (voter.archetype === 'schemer' || voter.archetype === 'mastermind') {
        score += c.stats.mental * 1.5;
      }
      if (voter.archetype === 'loyalist') {
        // Vote with the player's target
        if (id === playerVote) score += 2.5;
      }
    } else {
      // Targeting the player: NPCs perceive player threat via their own suspicion
      score += voter.stats.suspicion * 2.0 + voter.stats.threat * 0.5;
    }

    if (voter.archetype === 'wildcard' || voter.archetype === 'pessimist') {
      score += rng() * 3.0;
    } else {
      score += rng() * 0.5;
    }

    return { id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].id;
}

// Tally raw votes into an array sorted by vote count (desc)
export function tallyVotes(votes: VoteMap): Array<{ id: number; count: number }> {
  return Object.entries(votes)
    .map(([id, voters]) => ({ id: Number(id), count: voters.length }))
    .sort((a, b) => b.count - a.count);
}

// Resolve a tie by returning the tied id with the highest threat stat (or first if player involved)
export function breakTie(
  tiedIds: number[],
  castawayMap: Map<number, Castaway>,
  rng: () => number,
): number {
  if (tiedIds.includes(PLAYER_ID)) {
    // Player is never auto-eliminated in a tie — another tied NPC goes instead
    const npcTied = tiedIds.filter(id => id !== PLAYER_ID);
    if (npcTied.length === 0) return PLAYER_ID;
    return npcTied[Math.floor(rng() * npcTied.length)];
  }
  // Eliminate the highest-threat NPC
  const best = tiedIds
    .map(id => ({ id, threat: castawayMap.get(id)?.stats.threat ?? 0 }))
    .sort((a, b) => b.threat - a.threat);
  return best[0].id;
}
