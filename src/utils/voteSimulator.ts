import type { Castaway } from '../data/roster';

// ID conventions: 0 = player, 1–18 = NPC castaway ids
export const PLAYER_ID = 0;

// Returns: targetId (0=player) → array of voter ids (0=player, 1-18=NPC)
export type VoteMap = Record<number, number[]>;

// Tally raw votes into an array sorted by vote count (desc)
export function tallyVotes(votes: VoteMap): Array<{ id: number; count: number }> {
  return Object.entries(votes)
    .map(([id, voters]) => ({ id: Number(id), count: voters.length }))
    .sort((a, b) => b.count - a.count);
}

// Resolve a deadlocked tie like drawing rocks: a seeded-random pick among the
// tied castaways. (Always eliminating the highest threat let players engineer
// ties to assassinate threats for free.)
export function breakTie(
  tiedIds: number[],
  _castawayMap: Map<number, Castaway>,
  rng: () => number,
): number {
  if (tiedIds.includes(PLAYER_ID)) {
    // Player is never auto-eliminated in a tie — another tied NPC goes instead
    const npcTied = tiedIds.filter(id => id !== PLAYER_ID);
    if (npcTied.length === 0) return PLAYER_ID;
    return npcTied[Math.floor(rng() * npcTied.length)];
  }
  return tiedIds[Math.floor(rng() * tiedIds.length)];
}
