// Maps castaway stats to challenge performance and resolves rankings. Pure and
// deterministic: AI results come from the participant's `skill` plus a seeded
// noise term, so an off-screen challenge resolves the same way every replay.

import type { Castaway } from '../data/roster';
import type {
  ChallengeParticipant,
  ParticipantResult,
  MinigameResult,
  ChallengeKind,
} from '../minigames/types';
import { mulberry32, hashSeed } from './rng';

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

// How good is this castaway at a given kind of challenge (0..1).
export function challengeSkill(c: Castaway, kind: ChallengeKind): number {
  const s = c.stats;
  const grit = c.personality.grit;
  let base: number;
  switch (kind) {
    case 'strength':  base = 0.6 * s.strength + 0.25 * grit + 0.15 * s.threat; break;
    case 'mental':    base = 0.75 * s.mental + 0.25 * grit; break;
    case 'endurance': base = 0.45 * s.strength + 0.4 * grit + 0.15 * s.mental; break;
    case 'mixed':
    default:          base = 0.4 * s.strength + 0.4 * s.mental + 0.2 * grit; break;
  }
  return clamp01(base * (0.7 + 0.3 * c.energy));
}

// Build a participant from a castaway for a particular challenge kind.
export function makeParticipant(c: Castaway, kind: ChallengeKind, isPlayer: boolean): ChallengeParticipant {
  return { id: c.id, name: c.name, color: c.color, isPlayer, skill: challengeSkill(c, kind) };
}

function aiResult(p: ChallengeParticipant, rng: () => number): ParticipantResult {
  const noise = (rng() - 0.5) * 0.3;
  const score = clamp01(p.skill + noise);
  const timeMs = Math.round(6000 * (1.4 - score)); // higher score → finishes sooner
  return { id: p.id, score, finished: true, timeMs };
}

function sortRankings(results: ParticipantResult[]): ParticipantResult[] {
  return [...results].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity);
  });
}

// Resolve a challenge given the participants. If the player played, pass their
// measured outcome; otherwise (spectate / headless) everyone is scored from skill.
export function composeChallengeResult(
  participants: ChallengeParticipant[],
  seed: number,
  player?: { score: number; timeMs: number | null },
): MinigameResult {
  const rng = mulberry32(seed >>> 0);
  const results = participants.map(p =>
    p.isPlayer && player
      ? { id: p.id, score: player.score, finished: true, timeMs: player.timeMs }
      : aiResult(p, rng)
  );
  const rankings = sortRankings(results);
  return { rankings, winnerId: rankings[0]?.id ?? -1 };
}

// Fully headless resolution (no player), e.g. an off-screen tribe's challenge or
// an Edge re-entry the player isn't part of.
export function simulateHeadlessChallenge(
  participants: ChallengeParticipant[],
  seed: number,
): MinigameResult {
  return composeChallengeResult(participants, seed);
}

// Convenience: a stable seed for a challenge instance.
export function challengeSeed(gameSeed: number, tag: string): number {
  return hashSeed(gameSeed, tag);
}
