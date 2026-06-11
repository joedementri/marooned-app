import { seeded } from '../utils/seeded';
import type { ArchetypeKey } from './archetypes';
import type { StatKey } from './statMeta';
import type { AdvantageType } from './advantages';
import { FIRST_NAMES_MALE, FIRST_NAMES_FEMALE, LAST_NAMES, JOBS } from './names';

export interface CastawayStats {
  trust: number;
  loyalty: number;
  suspicion: number;
  mood: number;
  strength: number;
  mental: number;
  social: number;
  threat: number;
}

// Hidden personality axes that drive the social/strategy simulation. Unlike
// `stats` (which are the player-facing relationship view), these never change and
// shape how an NPC behaves toward *everyone*, not just the player.
export interface CastawayPersonality {
  boldness: number;     // big moves, early advantage plays
  paranoia: number;     // idol-hunting drive, danger perception
  honesty: number;      // P(intel they give the player is truthful)
  emotionality: number; // grudge formation & decay speed
  strateginess: number; // strategic vs social vote weighting
  grit: number;         // endurance-challenge modifier
}

export interface Castaway {
  id: number;
  name: string;
  age: number;
  job: string;
  archetype: ArchetypeKey;
  color: string;
  tribeId: string;
  stats: CastawayStats;
  personality: CastawayPersonality;
  energy: number; // 0–1; spent on challenges/idol hunts, restored by sleep/rewards
  eliminated: boolean;
  eliminatedDay: number | null;
  onRedemptionIsland: boolean;
  hasIdol: boolean; // derived convenience mirror of advantages.includes('hii')
  advantages: AdvantageType[];
  revealed: Record<string, boolean>;
  lastInteraction: number | null;
  relationshipLog: Array<{ day: number; note: string }>;
}

const NPC_COLORS = [
  '#7c2d2d', '#2d5a3d', '#0f4c5c', '#b03b5c', '#6b4a8a',
  '#c9491f', '#3a6b8a', '#1a3a2c', '#4a2a4a', '#8a7a4a',
  '#1d7a8c', '#3a3a4a', '#5a4a3a', '#a85a2a', '#c98a2a',
  '#7a8a5a', '#4a3a2a', '#2a5a4a', '#7a4a6a', '#4a6a7a',
];

const ARCHETYPE_KEYS: ArchetypeKey[] = [
  'schemer', 'loyalist', 'provider', 'athlete', 'wildcard', 'strategist',
  'mediator', 'charmer', 'lonewolf', 'threat', 'floater', 'underdog',
  'pessimist', 'optimist', 'veteran', 'mastermind',
];

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

function buildStats(id: number, archetype: ArchetypeKey): CastawayStats {
  const rng = seeded(id * 137 + 11);
  const base = () => 0.35 + rng() * 0.45;
  const stats: CastawayStats = {
    trust:     base(),
    loyalty:   base(),
    suspicion: rng() * 0.35,
    mood:      0.55 + rng() * 0.3,
    strength:  base(),
    mental:    base(),
    social:    base(),
    threat:    base(),
  };

  if (archetype === 'athlete' || archetype === 'threat')        { stats.strength += 0.25; stats.threat += 0.25; }
  if (archetype === 'strategist' || archetype === 'mastermind') { stats.mental  += 0.25; stats.threat += 0.15; }
  if (archetype === 'charmer' || archetype === 'mediator')      { stats.social  += 0.25; stats.threat -= 0.05; }
  if (archetype === 'pessimist') { stats.suspicion += 0.25; stats.trust   -= 0.10; }
  if (archetype === 'optimist')  { stats.mood      += 0.15; stats.trust   += 0.10; }
  if (archetype === 'loyalist')  { stats.loyalty   += 0.10; }
  if (archetype === 'veteran')   { stats.mental    += 0.15; stats.strength -= 0.10; }
  if (archetype === 'lonewolf')  { stats.social    -= 0.20; stats.suspicion += 0.10; }
  if (archetype === 'floater')   { stats.threat    -= 0.20; }
  if (archetype === 'schemer')   { stats.suspicion += 0.10; stats.mental += 0.10; }

  (Object.keys(stats) as StatKey[]).forEach(k => { stats[k] = clamp01(stats[k]); });
  return stats;
}

export function buildPersonality(id: number, archetype: ArchetypeKey): CastawayPersonality {
  const rng = seeded(id * 911 + 53);
  const b = () => 0.3 + rng() * 0.4;
  const p: CastawayPersonality = {
    boldness: b(), paranoia: b(), honesty: b(),
    emotionality: b(), strateginess: b(), grit: b(),
  };
  switch (archetype) {
    case 'schemer':     p.boldness += 0.2; p.strateginess += 0.2; p.honesty -= 0.25; break;
    case 'mastermind':  p.strateginess += 0.3; p.boldness += 0.15; p.honesty -= 0.15; break;
    case 'strategist':  p.strateginess += 0.25; p.paranoia += 0.1; break;
    case 'loyalist':    p.honesty += 0.2; p.emotionality += 0.1; p.boldness -= 0.1; break;
    case 'wildcard':    p.boldness += 0.25; p.emotionality += 0.2; break;
    case 'pessimist':   p.paranoia += 0.25; p.emotionality += 0.1; break;
    case 'optimist':    p.honesty += 0.15; p.paranoia -= 0.15; break;
    case 'athlete':     p.grit += 0.25; p.boldness += 0.1; break;
    case 'threat':      p.grit += 0.2; p.boldness += 0.15; break;
    case 'charmer':     p.honesty -= 0.1; p.strateginess += 0.1; break;
    case 'mediator':    p.honesty += 0.15; p.emotionality -= 0.1; break;
    case 'lonewolf':    p.paranoia += 0.2; p.strateginess += 0.1; break;
    case 'floater':     p.boldness -= 0.15; p.strateginess -= 0.1; break;
    case 'underdog':    p.grit += 0.15; p.emotionality += 0.15; break;
    case 'veteran':     p.strateginess += 0.2; p.paranoia += 0.1; break;
    case 'provider':    p.honesty += 0.1; p.grit += 0.1; break;
  }
  (Object.keys(p) as (keyof CastawayPersonality)[]).forEach(k => { p[k] = clamp01(p[k]); });
  return p;
}

// tribeAssignments[i] is the tribe id for NPC slot i (id = i + 1). The caller is
// responsible for an even split that already accounts for the player's slot.
export function buildRandomCastaways(
  tribeAssignments: string[],
  seed: number,
): Castaway[] {
  const rng = seeded(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const allFirstNames = [...FIRST_NAMES_MALE, ...FIRST_NAMES_FEMALE];
  const usedNames = new Set<string>();

  const castaways: Castaway[] = [];

  for (let i = 0; i < tribeAssignments.length; i++) {
    const id = i + 1;

    let fullName: string;
    let attempts = 0;
    do {
      const firstName = pick(allFirstNames);
      const lastName = pick(LAST_NAMES);
      fullName = `${firstName} ${lastName}`;
      attempts++;
    } while (usedNames.has(fullName) && attempts < 100);
    usedNames.add(fullName!);

    const color = NPC_COLORS[i % NPC_COLORS.length];
    const archetype = ARCHETYPE_KEYS[Math.floor(rng() * ARCHETYPE_KEYS.length)];
    const tribeId = tribeAssignments[i];

    castaways.push({
      id,
      name: fullName!,
      age: 22 + Math.floor(rng() * 34),
      job: pick(JOBS),
      archetype,
      color,
      tribeId,
      stats: buildStats(id, archetype),
      personality: buildPersonality(id, archetype),
      energy: 0.8 + rng() * 0.2,
      eliminated: false,
      eliminatedDay: null,
      onRedemptionIsland: false,
      hasIdol: false,
      advantages: [],
      revealed: {
        archetype: false, trust: false, suspicion: true, mood: true,
        strength: false, mental: false, social: false, threat: false, loyalty: false,
      },
      lastInteraction: null,
      relationshipLog: [],
    });
  }

  return castaways;
}

export function initials(name: string): string {
  return name.split(' ').map(s => s[0]).slice(0, 2).join('');
}
