// Deterministic tribal-council vote simulation driven by the relationship graph
// and alliances, plus NPC advantage-play decisions. Supersedes the scoring half of
// utils/voteSimulator (which still owns VoteMap/tallyVotes/PLAYER_ID).

import type { Castaway } from '../data/roster';
import type { Relationship, Alliance } from '../store/slices/socialSlice';
import type { AdvantageType } from '../data/advantages';
import type { AdvantagePlay } from '../utils/advantageResolver';
import { PLAYER_ID, type VoteMap } from '../utils/voteSimulator';
import { gameRng } from './rng';
import { getRel, perceivedThreat } from './socialEngine';

export interface VoteEngineInput {
  voters: Castaway[];           // NPC voters at this council (no player)
  eligibleTargets: number[];    // ids that can receive votes (immune removed); may include PLAYER_ID
  playerVote: number | null;    // player's vote target (null if player isn't voting)
  relationships: Record<string, Relationship>;
  alliances: Alliance[];
  castaways: Castaway[];        // full roster for lookups (includes player)
  day: number;
  gameSeed: number;
  scopeTag?: string;            // namespaces the rng (e.g. tribe id)
  // npcId → target the player TOLD them they're voting for (via whisper).
  // NPCs only follow the player's lead when a plan was actually shared —
  // and they follow what they were told, which may be a lie.
  sharedPlans?: Record<number, { day: number; targetId: number }>;
}

export interface VoteContext {
  votes: VoteMap;
  npcPlays: AdvantagePlay[];
  consumed: Array<{ holderId: number; type: AdvantageType }>; // advantages to remove from NPC inventories
  blocSummary: Array<{ allianceId: string; targetId: number }>;
  narration: string[];
}

function blocConsensus(
  alliance: Alliance,
  eligibleTargets: number[],
  castMap: Map<number, Castaway>,
  rels: Record<string, Relationship>,
): number | null {
  if (alliance.targetId != null && eligibleTargets.includes(alliance.targetId)) return alliance.targetId;
  const memberSet = new Set(alliance.memberIds);
  const cands = eligibleTargets.filter(id => !memberSet.has(id));
  if (cands.length === 0) return null;
  let best: { id: number; score: number } | null = null;
  for (const id of cands) {
    const c = castMap.get(id);
    if (!c) continue;
    let score = perceivedThreat(c);
    let g = 0, d = 0, n = 0;
    for (const m of alliance.memberIds) {
      const r = getRel(rels, m, id);
      g += r.grudge; d += 1 - r.trust; n++;
    }
    if (n > 0) score += (g / n) * 0.5 + (d / n) * 0.3;
    if (!best || score > best.score) best = { id, score };
  }
  return best?.id ?? null;
}

// Deterministic part of a voter's preference for one candidate (no chaos noise).
// Shared by the full simulation and predictVoterTarget so a "read" of an NPC
// matches how they'd actually lean at tribal.
function scoreCandidateForVoter(
  voter: Castaway,
  id: number,
  castMap: Map<number, Castaway>,
  relationships: Record<string, Relationship>,
  bloc: { targetId: number; strength: number } | undefined,
  sharedPlans: VoteEngineInput['sharedPlans'],
  day: number,
): number | null {
  const t = castMap.get(id);
  if (!t) return null;
  const r = getRel(relationships, voter.id, id);
  let s = perceivedThreat(t) * 1.4;
  s += (-r.affinity) * 1.2;
  s += r.grudge * 1.6;
  if (bloc && bloc.targetId === id) s += 0.8 + bloc.strength * 1.2;
  // Follow the player's lead ONLY if the player whispered a plan to this
  // voter (no mind-reading the secret ballot), and only toward the target
  // the player named — which may not be who the player actually votes for.
  const plan = sharedPlans?.[voter.id];
  if (plan && plan.day === day && plan.targetId === id) {
    const trustPlayer = getRel(relationships, voter.id, PLAYER_ID).trust;
    if (voter.archetype === 'loyalist' || trustPlayer > 0.6) s += 0.6;
  }
  if (voter.archetype === 'schemer' || voter.archetype === 'mastermind') s += t.stats.mental * 0.4;
  if (voter.archetype === 'floater' && bloc && bloc.targetId === id) s += 0.5;
  return s;
}

// Best guess at who a single NPC is leaning toward tonight, without running
// the full council simulation (used when the player asks someone their plan).
// Excludes chaos noise — it's a read of intent, not a guarantee.
export function predictVoterTarget(input: {
  voter: Castaway;
  eligibleTargets: number[];
  relationships: Record<string, Relationship>;
  alliances: Alliance[];
  castaways: Castaway[];
  day: number;
  sharedPlans?: VoteEngineInput['sharedPlans'];
}): number | null {
  const { voter, eligibleTargets, relationships, alliances, castaways, day, sharedPlans } = input;
  const castMap = new Map(castaways.map(c => [c.id, c]));

  let bloc: { targetId: number; strength: number } | undefined;
  for (const alliance of alliances) {
    if (!alliance.memberIds.includes(voter.id)) continue;
    const target = blocConsensus(alliance, eligibleTargets, castMap, relationships);
    if (target == null) continue;
    if (!bloc || alliance.strength > bloc.strength) bloc = { targetId: target, strength: alliance.strength };
  }

  let best: { id: number; score: number } | null = null;
  for (const id of eligibleTargets) {
    if (id === voter.id) continue;
    const s = scoreCandidateForVoter(voter, id, castMap, relationships, bloc, sharedPlans, day);
    if (s == null) continue;
    if (!best || s > best.score) best = { id, score: s };
  }
  return best?.id ?? null;
}

export function simulateTribalVotes(input: VoteEngineInput): VoteContext {
  const { voters, eligibleTargets, playerVote, relationships, alliances, castaways, day, gameSeed, scopeTag, sharedPlans } = input;
  const rng = gameRng(gameSeed, `vote-d${day}-${scopeTag ?? 'main'}`);
  const castMap = new Map(castaways.map(c => [c.id, c]));

  const votes: VoteMap = {};
  const narration: string[] = [];
  const blocSummary: Array<{ allianceId: string; targetId: number }> = [];

  if (playerVote != null) votes[playerVote] = [PLAYER_ID];

  // 1. Bloc pass — each alliance settles on a consensus target.
  const voterIds = new Set(voters.map(v => v.id));
  const voterBlocTarget = new Map<number, { targetId: number; strength: number }>();
  for (const alliance of alliances) {
    const activeMembers = alliance.memberIds.filter(id => voterIds.has(id));
    if (activeMembers.length < 2) continue;
    const target = blocConsensus(alliance, eligibleTargets, castMap, relationships);
    if (target == null) continue;
    blocSummary.push({ allianceId: alliance.id, targetId: target });
    for (const m of activeMembers) {
      const cur = voterBlocTarget.get(m);
      if (!cur || alliance.strength > cur.strength) {
        voterBlocTarget.set(m, { targetId: target, strength: alliance.strength });
      }
    }
  }

  // 2. Individual pass.
  for (const voter of voters) {
    const candidates = eligibleTargets.filter(id => id !== voter.id);
    if (candidates.length === 0) continue;
    const bloc = voterBlocTarget.get(voter.id);

    let best: { id: number; score: number } | null = null;
    for (const id of candidates) {
      const base = scoreCandidateForVoter(voter, id, castMap, relationships, bloc, sharedPlans, day);
      if (base == null) continue;
      const chaos = (voter.archetype === 'wildcard' || voter.archetype === 'pessimist') ? rng() * 1.5 : rng() * 0.4;
      const s = base + chaos;
      if (!best || s > best.score) best = { id, score: s };
    }
    if (best) {
      if (!votes[best.id]) votes[best.id] = [];
      votes[best.id].push(voter.id);
    }
  }

  // 3. NPC advantage plays.
  //
  // NPCs do NOT get to read the real ballot box. Each one acts on what they
  // could plausibly know: their own vote, votes coordinated inside their own
  // alliances, and whispers they "heard" around camp — more if they're
  // paranoid or close to the voter. Paranoid players overestimate the votes
  // against them, which produces realistic wasted idols.
  const npcPlays: AdvantagePlay[] = [];
  const consumed: Array<{ holderId: number; type: AdvantageType }> = [];

  const ballots: Array<{ voterId: number; targetId: number }> = [];
  for (const [t, vs] of Object.entries(votes)) {
    for (const v of vs) ballots.push({ voterId: v, targetId: Number(t) });
  }
  const totalVotes = ballots.length;
  // Headcount is public knowledge, so the majority threshold is too.
  const needToBoot = Math.floor(totalVotes / 2) + 1;

  const allianceMates = new Map<number, Set<number>>();
  for (const alliance of alliances) {
    for (const m of alliance.memberIds) {
      let set = allianceMates.get(m);
      if (!set) { set = new Set(); allianceMates.set(m, set); }
      for (const o of alliance.memberIds) if (o !== m) set.add(o);
    }
  }

  function perceivedCountsFor(npc: Castaway): Record<number, number> {
    const counts: Record<number, number> = {};
    const mates = allianceMates.get(npc.id);
    for (const b of ballots) {
      let heard: boolean;
      if (b.voterId === npc.id || (mates?.has(b.voterId) ?? false)) {
        heard = true; // own vote / coordinated within the alliance
      } else {
        const closeness = (getRel(relationships, npc.id, b.voterId).affinity + 1) / 2;
        heard = rng() < 0.3 + 0.35 * npc.personality.paranoia + 0.35 * closeness;
      }
      if (heard) counts[b.targetId] = (counts[b.targetId] ?? 0) + 1;
    }
    return counts;
  }

  const idolUsedThisCouncil = new Set<number>(); // protected ids (avoid double idol on same person)

  for (const npc of voters) {
    const perceived = perceivedCountsFor(npc);
    const overestimate = npc.personality.paranoia > 0.7 ? 1 : 0;
    const votesAgainst = (perceived[npc.id] ?? 0) + overestimate;
    const inDanger = votesAgainst >= 2 && votesAgainst >= needToBoot - 1;

    // a) Save yourself.
    if (npc.advantages.includes('hii') && inDanger && !idolUsedThisCouncil.has(npc.id)) {
      const willPlay = votesAgainst >= needToBoot || npc.personality.paranoia > 0.55 || rng() < npc.personality.boldness;
      if (willPlay) {
        npcPlays.push({ actorId: npc.id, type: 'hii' });
        consumed.push({ holderId: npc.id, type: 'hii' });
        idolUsedThisCouncil.add(npc.id);
        narration.push(`${npc.name.split(' ')[0]} reaches into their bag...`);
        continue;
      }
    }

    // b) Blindside save: play your idol on a close ally who seems about to go.
    if (npc.advantages.includes('hii') && npc.personality.boldness > 0.55) {
      const ally = voters
        .filter(o => o.id !== npc.id && getRel(relationships, npc.id, o.id).affinity > 0.6)
        .map(o => ({ o, against: perceived[o.id] ?? 0 }))
        .filter(x => x.against >= needToBoot - 1 && !idolUsedThisCouncil.has(x.o.id))
        .sort((a, b) => b.against - a.against)[0];
      if (ally && rng() < npc.personality.boldness) {
        npcPlays.push({ actorId: ally.o.id, type: 'hii' });
        consumed.push({ holderId: npc.id, type: 'hii' });
        idolUsedThisCouncil.add(ally.o.id);
        narration.push(`${npc.name.split(' ')[0]} stuns the council, protecting ${ally.o.name.split(' ')[0]}.`);
      }
    }

    // c) Extra vote in a race they believe is tight, piled onto their target.
    if (npc.advantages.includes('extra_vote') && totalVotes > 0) {
      const myTarget = Object.entries(votes).find(([, vs]) => vs.includes(npc.id))?.[0];
      if (myTarget != null && (perceived[Number(myTarget)] ?? 0) >= needToBoot - 1 && rng() < 0.5 + npc.personality.boldness * 0.3) {
        npcPlays.push({ actorId: npc.id, type: 'extra_vote' });
        consumed.push({ holderId: npc.id, type: 'extra_vote' });
        narration.push(`${npc.name.split(' ')[0]} produces an Extra Vote.`);
      }
    }
  }

  return { votes, npcPlays, consumed, blocSummary, narration };
}
