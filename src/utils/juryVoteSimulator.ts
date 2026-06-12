import type { Castaway } from '../data/roster';
import type { JuryMember } from '../store/slices/jurySlice';
import { seeded } from './seeded';

// Archetype pairs that reward each other in jury votes
const ARCHETYPE_AFFINITIES: Array<[string, string]> = [
  ['loyalist',   'loyalist'],
  ['loyalist',   'underdog'],
  ['strategist', 'mastermind'],
  ['strategist', 'schemer'],
  ['mediator',   'charmer'],
  ['mediator',   'optimist'],
  ['athlete',    'provider'],
  ['veteran',    'veteran'],
];

function archetypeBonus(jurorArchetype: string, finalistArchetype: string): number {
  for (const [a, b] of ARCHETYPE_AFFINITIES) {
    if (
      (jurorArchetype === a && finalistArchetype === b) ||
      (jurorArchetype === b && finalistArchetype === a)
    ) {
      return 15;
    }
  }
  return 0;
}

export interface JuryVoteResult {
  votes: Record<number, number>; // jurorCastawayId → finalistId they vote for
  tally: Record<number, number>; // finalistId → vote count
  winnerId: number;              // finalist with most jury votes
}

// finalists: the 2–3 alive castaways at final tribal (may include the player)
// playerIsFinalist: if true, player's id is 0 and competes for jury votes
// playerSocialScore: snapshot of player's social stat for jury weighting
// castaways: full roster, used to look up juror archetypes
export function simulateJuryVotes(
  jury: JuryMember[],
  finalists: Castaway[],
  playerIsFinalist: boolean,
  playerSocialScore: number,     // 0–1
  day: number,
  castaways: Castaway[],
): JuryVoteResult {
  const rng = seeded(day * 3_333 + jury.length * 17);

  const finalistIds = [...new Set([
    ...finalists.map(f => f.id),
    ...(playerIsFinalist ? [0] : []), // 0 = player
  ])];

  const votes: Record<number, number> = {};
  const tally: Record<number, number> = {};
  const scoreSum: Record<number, number> = {};
  finalistIds.forEach(id => { tally[id] = 0; scoreSum[id] = 0; });

  for (const juror of jury) {
    const scores = finalistIds.map(finalistId => {
      let score = 0;

      const relScore = juror.relationshipScores[finalistId] ?? 0;
      score += relScore * 40;

      // Bitterness penalty if finalist voted juror out
      if (juror.eliminatedBy.includes(finalistId)) {
        score -= juror.bitternessFactor * 30;
      }

      // Archetype alignment bonus
      if (finalistId === 0) {
        // Player: no archetype known; give partial social bonus only
        score += playerSocialScore * 10;
      } else {
        const finalist = finalists.find(f => f.id === finalistId)!;
        score += archetypeBonus(
          castaways.find(c => c.id === juror.castawayId)?.archetype ?? '',
          finalist.archetype,
        );
        score += finalist.stats.social * 10;
      }

      // Mild noise to avoid deterministic ties
      score += rng() * 3;

      return { finalistId, score };
    });

    scores.sort((a, b) => b.score - a.score);
    const picked = scores[0].finalistId;
    votes[juror.castawayId] = picked;
    tally[picked] = (tally[picked] ?? 0) + 1;
    for (const { finalistId, score } of scores) scoreSum[finalistId] += score;
  }

  // Winner = most jury votes. Ties break to the finalist the jury scored
  // higher overall, then a seeded coin flip — never insertion order.
  const topVotes = Math.max(...finalistIds.map(id => tally[id]));
  const tied = finalistIds.filter(id => tally[id] === topVotes);
  let winnerId: number;
  if (tied.length === 1) {
    winnerId = tied[0];
  } else {
    const topScore = Math.max(...tied.map(id => scoreSum[id]));
    const best = tied.filter(id => scoreSum[id] === topScore);
    winnerId = best[Math.floor(rng() * best.length)];
  }

  return { votes, tally, winnerId };
}
