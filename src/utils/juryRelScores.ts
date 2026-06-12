import type { Castaway } from '../data/roster';
import type { Relationship } from '../store/slices/socialSlice';
import { getRel } from '../engine/socialEngine';

// Snapshot how warmly a departing juror regards every other castaway, taken
// from the juror's OWN relationship edges at the moment they join the jury.
// (Previously this snapshotted each castaway's trust toward the player, which
// made every jury vote about the player's stats instead of the juror's view.)
export function buildJuryRelScores(
  jurorId: number,
  castaways: Castaway[],
  relationships: Record<string, Relationship>,
): Record<number, number> {
  const scores: Record<number, number> = {};
  for (const c of castaways) {
    if (c.id === jurorId) continue;
    const r = getRel(relationships, jurorId, c.id);
    scores[c.id] = 0.5 * r.trust + 0.5 * ((r.affinity + 1) / 2);
  }
  return scores;
}
