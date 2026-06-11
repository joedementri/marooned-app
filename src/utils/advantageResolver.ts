import type { AdvantageType } from '../data/advantages';
import { ADVANTAGE_RESOLUTION_ORDER } from '../data/advantages';
import type { VoteMap } from './voteSimulator';
import { PLAYER_ID, tallyVotes, breakTie } from './voteSimulator';
import type { Castaway } from '../data/roster';
import { seeded } from './seeded';

export interface AdvantagePlay {
  actorId: number;        // 0 = player, 1-18 = NPC
  type: AdvantageType;
  targetId?: number;      // for steal_a_vote, idol_nullifier: whose vote/idol is targeted
}

export interface TribalResult {
  originalVotes: VoteMap;
  resolvedVotes: VoteMap;
  eliminatedId: number;            // 0 = player, 1-18 = NPC
  idolPlayed: boolean;
  idolPlayerId: number | null;
  idolNullified: boolean;
  safetyDeparted: number[];        // castaway ids who left before vote
  stolenVoterIds: number[];        // voters whose vote was stolen
  extraVoteActorId: number | null;
}

export function resolveTribal(
  rawVotes: VoteMap,
  plays: AdvantagePlay[],
  castaways: Castaway[],
  aliveCount: number,
  day: number,
): TribalResult {
  const castawayMap = new Map<number, Castaway>(castaways.map(c => [c.id, c]));
  const rng = seeded(day * 5_555);

  const result: TribalResult = {
    originalVotes: deepCloneVotes(rawVotes),
    resolvedVotes: deepCloneVotes(rawVotes),
    eliminatedId: -1,
    idolPlayed: false,
    idolPlayerId: null,
    idolNullified: false,
    safetyDeparted: [],
    stolenVoterIds: [],
    extraVoteActorId: null,
  };

  // Process in canonical resolution order
  for (const type of ADVANTAGE_RESOLUTION_ORDER) {
    const matching = plays.filter(p => p.type === type);
    if (matching.length === 0) continue;

    for (const play of matching) {
      switch (type) {
        case 'safety_without_power': {
          // Actor leaves before vote; they are immune and cannot vote
          result.safetyDeparted.push(play.actorId);
          // Remove their votes cast and any votes targeting them
          removeVoter(result.resolvedVotes, play.actorId);
          removeTarget(result.resolvedVotes, play.actorId);
          break;
        }

        case 'steal_a_vote': {
          if (play.targetId == null) break;
          // Move target's votes to actor
          const stolen = stealVotes(result.resolvedVotes, play.targetId, play.actorId);
          if (stolen.length > 0) result.stolenVoterIds.push(...stolen);
          break;
        }

        case 'extra_vote': {
          // Actor casts an additional vote for whoever they originally voted for
          const originalTarget = findVoteTarget(result.resolvedVotes, play.actorId);
          if (originalTarget != null) {
            if (!result.resolvedVotes[originalTarget]) result.resolvedVotes[originalTarget] = [];
            result.resolvedVotes[originalTarget].push(play.actorId);
            result.extraVoteActorId = play.actorId;
          }
          break;
        }

        case 'idol_nullifier': {
          if (play.targetId == null) break;
          // Cancel any HII play by targetId (handled when HII is processed)
          // Mark nullification; HII loop checks this
          result.idolNullified = true;
          break;
        }

        case 'hii': {
          // Check if this play is nullified
          if (result.idolNullified && plays.some(p => p.type === 'idol_nullifier' && p.targetId === play.actorId)) {
            break; // idol cancelled
          }
          // HII: remove all votes targeting the actor
          const hadVotes = (result.resolvedVotes[play.actorId]?.length ?? 0) > 0;
          if (hadVotes) {
            result.idolPlayed = true;
            result.idolPlayerId = play.actorId;
            delete result.resolvedVotes[play.actorId];
          }
          // NPC plays their idol when ≥3 votes (handled outside resolver for NPC auto-plays)
          break;
        }
      }
    }
  }

  // Determine eliminated player
  const tally = tallyVotes(result.resolvedVotes);
  if (tally.length === 0) {
    // Edge case: nobody can be eliminated (e.g., all votes cancelled) — random elimination
    const living = castaways.filter(c => !c.eliminated && !result.safetyDeparted.includes(c.id));
    result.eliminatedId = living.length > 0
      ? living[Math.floor(rng() * living.length)].id
      : PLAYER_ID;
    return result;
  }

  const topCount = tally[0].count;
  const topIds = tally.filter(t => t.count === topCount).map(t => t.id);

  result.eliminatedId = topIds.length === 1
    ? topIds[0]
    : breakTie(topIds, castawayMap, rng);

  return result;
}

// Checks whether an NPC should auto-play their idol (≥3 votes targeting them)
export function shouldNpcPlayIdol(votes: VoteMap, npcId: number): boolean {
  return (votes[npcId]?.length ?? 0) >= 3;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function deepCloneVotes(votes: VoteMap): VoteMap {
  const clone: VoteMap = {};
  for (const [k, v] of Object.entries(votes)) {
    clone[Number(k)] = [...v];
  }
  return clone;
}

function removeVoter(votes: VoteMap, voterId: number): void {
  for (const key of Object.keys(votes)) {
    votes[Number(key)] = votes[Number(key)].filter(v => v !== voterId);
  }
}

function removeTarget(votes: VoteMap, targetId: number): void {
  delete votes[targetId];
}

function stealVotes(votes: VoteMap, fromId: number, toActorId: number): number[] {
  const stolen: number[] = [];
  // Find what fromId voted for
  const targetId = findVoteTarget(votes, fromId);
  if (targetId == null) return stolen;
  // Remove fromId's vote
  votes[targetId] = votes[targetId].filter(v => v !== fromId);
  // Add toActorId's vote in its place (double-voting for same target)
  if (!votes[targetId]) votes[targetId] = [];
  votes[targetId].push(toActorId);
  stolen.push(fromId);
  return stolen;
}

function findVoteTarget(votes: VoteMap, voterId: number): number | null {
  for (const [target, voters] of Object.entries(votes)) {
    if (voters.includes(voterId)) return Number(target);
  }
  return null;
}
