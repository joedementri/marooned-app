// Pure NPC-society simulation. No store access — takes a snapshot, returns the
// deltas to apply. Reusable by the live game and by a headless season simulator.

import type { Relationship, Alliance } from '../store/slices/socialSlice';
import type { IntelEntry, IntelClaim } from '../store/slices/intelSlice';
import type { Castaway } from '../data/roster';
import type { AdvantageType } from '../data/advantages';
import type { Location } from '../data/locations';
import type { DayPhase } from '../store/slices/phaseSlice';
import type { FeedEntry, FeedEntryType } from '../store/gameStore';
import { gameRng, pickFrom, shuffled } from './rng';
import { PLAYER_ID, type VoteMap } from '../utils/voteSimulator';

// ─── relationship primitives ──────────────────────────────────────────────────

export function relKey(a: number, b: number): string {
  return `${a}>${b}`;
}

export function defaultRel(): Relationship {
  return { affinity: 0, trust: 0.3, grudge: 0, lastEventDay: null };
}

export function getRel(
  rels: Record<string, Relationship>,
  a: number,
  b: number,
): Relationship {
  return rels[relKey(a, b)] ?? defaultRel();
}

export function mutualAffinity(rels: Record<string, Relationship>, a: number, b: number): number {
  return (getRel(rels, a, b).affinity + getRel(rels, b, a).affinity) / 2;
}

export function mutualTrust(rels: Record<string, Relationship>, a: number, b: number): number {
  return (getRel(rels, a, b).trust + getRel(rels, b, a).trust) / 2;
}

// A blended, single-number "how dangerous is this person" used for targeting.
export function perceivedThreat(c: Castaway): number {
  return clamp01(
    0.45 * c.stats.threat + 0.2 * c.stats.strength + 0.15 * c.stats.mental + 0.2 * c.stats.social,
  );
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

// Rough archetype chemistry, symmetric. Returns roughly -0.2..0.3.
const AFFINITY_PAIRS: Record<string, number> = {
  'loyalist|loyalist': 0.25, 'loyalist|optimist': 0.2, 'loyalist|provider': 0.2,
  'strategist|mastermind': 0.25, 'strategist|schemer': 0.2, 'mastermind|schemer': 0.2,
  'mediator|charmer': 0.25, 'mediator|optimist': 0.2, 'charmer|optimist': 0.2,
  'athlete|provider': 0.2, 'athlete|threat': 0.15, 'veteran|veteran': 0.2,
  'lonewolf|lonewolf': -0.15, 'pessimist|optimist': -0.2, 'schemer|loyalist': -0.15,
  'wildcard|strategist': -0.15, 'threat|threat': -0.1,
};

function archetypeCompat(a: string, b: string): number {
  return AFFINITY_PAIRS[`${a}|${b}`] ?? AFFINITY_PAIRS[`${b}|${a}`] ?? 0;
}

export function initRelationships(
  castaways: Castaway[],
  gameSeed: number,
): Record<string, Relationship> {
  const rels: Record<string, Relationship> = {};
  for (const a of castaways) {
    for (const b of castaways) {
      if (a.id === b.id) continue;
      const rng = gameRng(gameSeed, `rel-${a.id}-${b.id}`);
      const compat = archetypeCompat(a.archetype, b.archetype);
      const affinity = clamp(-0.25 + rng() * 0.5 + compat, -1, 1);
      const trust = clamp01(0.25 + rng() * 0.2 + compat * 0.3);
      rels[relKey(a.id, b.id)] = { affinity, trust, grudge: 0, lastEventDay: null };
    }
  }
  return rels;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ─── tick types ───────────────────────────────────────────────────────────────

export type RelDelta = { a: number; b: number; d: Partial<Relationship> };

export type AllianceOp =
  | { kind: 'create'; alliance: Alliance }
  | { kind: 'dissolve'; id: string }
  | { kind: 'setTarget'; id: string; targetId: number | null }
  | { kind: 'strength'; id: string; delta: number }
  | { kind: 'addMember'; id: string; memberId: number }
  | { kind: 'removeMember'; id: string; memberId: number };

export interface NpcAdvantageFind { id: number; type: AdvantageType; locationId: string | null; }

export interface SimTickResult {
  relDeltas: RelDelta[];
  allianceOps: AllianceOp[];
  npcAdvantageFinds: NpcAdvantageFind[];
  observations: IntelEntry[];
  feed: FeedEntry[];
  energyDeltas: Record<number, number>;
}

export interface SimInput {
  day: number;
  phase: DayPhase;
  castaways: Castaway[];   // active roster for this tick (alive, in camp; includes player)
  relationships: Record<string, Relationship>;
  alliances: Alliance[];
  locations: Location[];
  gameSeed: number;
  playerTribeId: string;
  playerInCamp: boolean;
}

const ALLIANCE_NAMES = [
  'The Water Well', 'Sunrise Crew', 'The Driftwood Pact', 'Coconut Cartel',
  'The Undercurrent', 'High Tide', 'The Quiet Few', 'Palm Alliance',
  'Sandbar Syndicate', 'The Lagoon Order', 'Saltwater Six', 'The Reef',
];

const OBSERVE_CHANCE = 0.35;

function emptyResult(): SimTickResult {
  return { relDeltas: [], allianceOps: [], npcAdvantageFinds: [], observations: [], feed: [], energyDeltas: {} };
}

function nameMap(cast: Castaway[]): Map<number, string> {
  return new Map(cast.map(c => [c.id, c.id === PLAYER_ID ? 'you' : c.name.split(' ')[0]]));
}

function obs(
  day: number,
  kind: IntelEntry['kind'],
  subjectIds: number[],
  claim: IntelClaim,
  text: string,
  confidence: IntelEntry['confidence'] = 'high',
): IntelEntry {
  return {
    id: `intel-${kind}-${subjectIds.join('-')}-d${day}-${Math.floor(Math.random() * 1e6)}`,
    day, kind, sourceId: null, subjectIds, claim, text, truthful: true, confidence,
  };
}

function feedEntry(day: number, phase: DayPhase, text: string, type: FeedEntryType = 'alliance'): FeedEntry {
  return { id: `sim-${type}-d${day}-${Math.floor(Math.random() * 1e6)}`, day, phase, text, type };
}

// ─── morning: camp life, bonding, idol hunts, alliance formation ───────────────

export function simulateMorningTick(input: SimInput): SimTickResult {
  const { day, phase, castaways, relationships, alliances, locations, gameSeed, playerInCamp } = input;
  const res = emptyResult();
  const rng = gameRng(gameSeed, `morning-d${day}`);
  const names = nameMap(castaways);
  const npcs = castaways.filter(c => c.id !== PLAYER_ID);
  if (npcs.length < 2) return res;

  // 1. Pairwise hangouts (include player as a passive partner so edges drift).
  const pool = shuffled(castaways.map(c => c.id), rng);
  for (let i = 0; i + 1 < pool.length; i += 2) {
    const a = pool[i], b = pool[i + 1];
    const ca = castaways.find(c => c.id === a)!;
    const cb = castaways.find(c => c.id === b)!;
    const base = mutualAffinity(relationships, a, b);
    const bondBias = 0.5 + base * 0.4;
    if (rng() < bondBias) {
      const amt = 0.03 + rng() * 0.05;
      res.relDeltas.push({ a, b, d: { affinity: amt, trust: amt * 0.7, lastEventDay: day } });
      res.relDeltas.push({ a: b, b: a, d: { affinity: amt, trust: amt * 0.7, lastEventDay: day } });
      if (playerInCamp && a !== PLAYER_ID && b !== PLAYER_ID && rng() < OBSERVE_CHANCE) {
        res.observations.push(obs(day, 'observation', [a, b],
          { type: 'relationship', a, b, tone: 'close' },
          `You saw ${names.get(a)} and ${names.get(b)} working together at camp.`));
      }
    } else {
      const emo = (ca.personality.emotionality + cb.personality.emotionality) / 2;
      const amt = 0.04 + rng() * 0.05;
      res.relDeltas.push({ a, b, d: { affinity: -amt, grudge: amt * emo, lastEventDay: day } });
      res.relDeltas.push({ a: b, b: a, d: { affinity: -amt, grudge: amt * emo, lastEventDay: day } });
      if (playerInCamp && a !== PLAYER_ID && b !== PLAYER_ID && rng() < OBSERVE_CHANCE) {
        res.observations.push(obs(day, 'observation', [a, b],
          { type: 'relationship', a, b, tone: 'feuding' },
          `${names.get(a)} and ${names.get(b)} got into it over camp chores.`));
      }
    }
  }

  // 2. NPC idol hunting — contests the same hidden-idol economy the player uses.
  const idolLocs = locations.filter(l => l.unlocked && l.idolHidden).map(l => l.id);
  const consumed = new Set<string>();
  for (const npc of shuffled(npcs, rng)) {
    if (npc.energy < 0.2) continue;
    const drive = npc.personality.paranoia * npc.energy;
    if (rng() >= drive * 0.22) continue;
    res.energyDeltas[npc.id] = (res.energyDeltas[npc.id] ?? 0) - 0.1;
    const avail = idolLocs.filter(id => !consumed.has(id));
    if (avail.length > 0 && rng() < 0.25 + drive * 0.3) {
      const locId = pickFrom(avail, rng);
      consumed.add(locId);
      res.npcAdvantageFinds.push({ id: npc.id, type: 'hii', locationId: locId });
      res.feed.push(feedEntry(day, phase, `Someone has been searching the jungle alone.`, 'advantage'));
    }
    // Player may notice a hunter's absence from camp.
    if (playerInCamp && rng() < OBSERVE_CHANCE * 0.6) {
      res.observations.push(obs(day, 'observation', [npc.id],
        { type: 'idol-hunting', id: npc.id },
        `${names.get(npc.id)} has been gone from camp a lot lately.`, 'medium'));
    }
  }

  // 3. Alliance formation: one strong, mutually-trusting cluster may bond up.
  const cap = Math.max(2, Math.ceil(npcs.length / 3));
  if (alliances.length < cap && npcs.length >= 4 && rng() < 0.5) {
    const formed = tryFormAlliance(npcs, relationships, day, rng, alliances);
    if (formed) {
      res.allianceOps.push({ kind: 'create', alliance: formed });
      if (playerInCamp && rng() < OBSERVE_CHANCE) {
        res.observations.push(obs(day, 'overheard', formed.memberIds,
          { type: 'alliance-exists', memberIds: formed.memberIds },
          `You overheard ${formed.memberIds.map(id => names.get(id)).join(', ')} making a quiet pact.`, 'medium'));
      }
    }
  }

  return res;
}

function tryFormAlliance(
  npcs: Castaway[],
  rels: Record<string, Relationship>,
  day: number,
  rng: () => number,
  existing: Alliance[],
): Alliance | null {
  // Seed from a schemer/mastermind/strategist if available, else any.
  const seeds = shuffled(npcs, rng).sort((a, b) =>
    schemerScore(b) - schemerScore(a));
  const seed = seeds[0];
  if (!seed) return null;
  const partners = npcs
    .filter(n => n.id !== seed.id)
    .filter(n => mutualTrust(rels, seed.id, n.id) > 0.5 && mutualAffinity(rels, seed.id, n.id) > 0.15)
    .sort((a, b) => mutualTrust(rels, seed.id, b.id) - mutualTrust(rels, seed.id, a.id));
  if (partners.length < 1) return null;
  const size = Math.min(partners.length, 1 + Math.floor(rng() * 3)); // 2–4 total
  const memberIds = [seed.id, ...partners.slice(0, size).map(p => p.id)];
  // Avoid creating a duplicate of an existing alliance's exact membership.
  const dup = existing.some(a =>
    a.memberIds.length === memberIds.length && memberIds.every(m => a.memberIds.includes(m)));
  if (dup) return null;
  const usedNames = new Set(existing.map(a => a.name));
  const name = ALLIANCE_NAMES.find(n => !usedNames.has(n)) ?? `Alliance ${existing.length + 1}`;
  return {
    id: `all-${seed.id}-d${day}`,
    name,
    memberIds,
    strength: 0.45 + rng() * 0.2,
    createdDay: day,
    targetId: null,
    knownToPlayer: false,
  };
}

function schemerScore(c: Castaway): number {
  const a = c.archetype;
  const bonus = a === 'mastermind' ? 0.4 : a === 'schemer' ? 0.3 : a === 'strategist' ? 0.25 : 0;
  return bonus + c.personality.strateginess * 0.3;
}

// ─── evening: pre-tribal scramble, alliances pick targets ──────────────────────

export function simulateEveningTick(input: SimInput): SimTickResult {
  const { day, phase, castaways, relationships, alliances, gameSeed, playerInCamp } = input;
  const res = emptyResult();
  const rng = gameRng(gameSeed, `evening-d${day}`);
  const names = nameMap(castaways);
  const activeIds = new Set(castaways.map(c => c.id));

  for (const alliance of alliances) {
    const members = alliance.memberIds.filter(id => activeIds.has(id));
    if (members.length < 2) continue;
    const target = pickAllianceTarget(alliance, castaways, relationships);
    if (target != null) {
      res.allianceOps.push({ kind: 'setTarget', id: alliance.id, targetId: target });
      // Tighten the alliance the night before a vote.
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          res.relDeltas.push({ a: members[i], b: members[j], d: { trust: 0.03, lastEventDay: day } });
          res.relDeltas.push({ a: members[j], b: members[i], d: { trust: 0.03, lastEventDay: day } });
        }
      }
      if (playerInCamp && !alliance.memberIds.includes(PLAYER_ID) && rng() < OBSERVE_CHANCE) {
        const voter = pickFrom(members.filter(m => m !== PLAYER_ID), rng);
        res.observations.push(obs(day, 'overheard', [voter, target],
          { type: 'vote-target', voterId: voter, targetId: target },
          `You overheard ${names.get(voter)} say the name "${names.get(target)}" before tribal.`, 'medium'));
      }
    }
  }

  return res;
}

export function pickAllianceTarget(
  alliance: Alliance,
  active: Castaway[],
  rels: Record<string, Relationship>,
): number | null {
  const memberSet = new Set(alliance.memberIds);
  const candidates = active.filter(c => !memberSet.has(c.id));
  if (candidates.length === 0) return null;
  const members = active.filter(c => memberSet.has(c.id));
  let best: { id: number; score: number } | null = null;
  for (const cand of candidates) {
    let score = perceivedThreat(cand);
    let grudgeSum = 0, distrustSum = 0;
    for (const m of members) {
      const r = getRel(rels, m.id, cand.id);
      grudgeSum += r.grudge;
      distrustSum += 1 - r.trust;
    }
    score += (grudgeSum / members.length) * 0.5 + (distrustSum / members.length) * 0.3;
    if (!best || score > best.score) best = { id: cand.id, score };
  }
  return best?.id ?? null;
}

// ─── night: decay + recovery ───────────────────────────────────────────────────

export function simulateNightTick(input: SimInput): SimTickResult {
  const { day, castaways, relationships, alliances, gameSeed } = input;
  const res = emptyResult();
  const rng = gameRng(gameSeed, `night-d${day}`);

  // Grudges fade; pace scaled by emotionality (emotional people hold on longer).
  for (const c of castaways) {
    if (c.id === PLAYER_ID) continue;
    res.energyDeltas[c.id] = (res.energyDeltas[c.id] ?? 0) + 0.2 + rng() * 0.15;
    for (const other of castaways) {
      if (other.id === c.id) continue;
      const r = getRel(relationships, c.id, other.id);
      if (r.grudge > 0.01) {
        const fade = -(0.04 + (1 - c.personality.emotionality) * 0.06);
        res.relDeltas.push({ a: c.id, b: other.id, d: { grudge: fade } });
      }
    }
  }

  // Idle alliances weaken slightly.
  for (const alliance of alliances) {
    if ((alliance.createdDay ?? day) < day - 1) {
      res.allianceOps.push({ kind: 'strength', id: alliance.id, delta: -0.03 });
    }
  }

  return res;
}

// ─── post-tribal aftermath: grudges from blindsides, alliance fallout ──────────

export function applyTribalAftermath(input: {
  castaways: Castaway[];
  alliances: Alliance[];
  votes: VoteMap;
  eliminatedId: number;
  day: number;
}): { relDeltas: RelDelta[]; allianceOps: AllianceOp[]; feed: FeedEntry[] } {
  const { castaways, alliances, votes, eliminatedId, day } = input;
  const relDeltas: RelDelta[] = [];
  const allianceOps: AllianceOp[] = [];
  const feed: FeedEntry[] = [];

  const votersAgainst = votes[eliminatedId] ?? [];
  const castMap = new Map(castaways.map(c => [c.id, c]));

  // Allies of the booted player resent everyone who wrote their name down.
  const boots = castMap.get(eliminatedId);
  if (boots) {
    const allyAlliances = alliances.filter(a => a.memberIds.includes(eliminatedId));
    const allyIds = new Set<number>();
    allyAlliances.forEach(a => a.memberIds.forEach(m => { if (m !== eliminatedId) allyIds.add(m); }));
    for (const allyId of allyIds) {
      const ally = castMap.get(allyId);
      if (!ally) continue;
      const emo = ally.personality.emotionality;
      for (const voterId of votersAgainst) {
        if (voterId === allyId) continue;
        relDeltas.push({ a: allyId, b: voterId, d: { grudge: 0.12 + emo * 0.12, affinity: -0.1, trust: -0.1, lastEventDay: day } });
      }
    }
    // Alliances whose plan failed (their target survived) lose cohesion.
    for (const alliance of alliances) {
      if (alliance.targetId != null && alliance.targetId !== eliminatedId) {
        allianceOps.push({ kind: 'strength', id: alliance.id, delta: -0.2 });
      }
      // A blindsided alliance that lost one of its own fractures.
      if (alliance.memberIds.includes(eliminatedId) && alliance.targetId !== eliminatedId) {
        allianceOps.push({ kind: 'removeMember', id: alliance.id, memberId: eliminatedId });
        allianceOps.push({ kind: 'strength', id: alliance.id, delta: -0.15 });
      }
    }
  }

  return { relDeltas, allianceOps, feed };
}
