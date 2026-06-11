import { seeded } from '../utils/seeded';
import type { ArchetypeKey } from './archetypes';
import type { StatKey } from './statMeta';
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

export interface Castaway {
  id: number;
  name: string;
  age: number;
  job: string;
  archetype: ArchetypeKey;
  color: string;
  tribeId: string;
  stats: CastawayStats;
  eliminated: boolean;
  eliminatedDay: number | null;
  onRedemptionIsland: boolean;
  hasIdol: boolean;
  advantages: string[];
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

export function buildRandomCastaways(
  tribeIds: string[],
  npcCount: number,
  seed: number,
): Castaway[] {
  const rng = seeded(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const allFirstNames = [...FIRST_NAMES_MALE, ...FIRST_NAMES_FEMALE];
  const usedNames = new Set<string>();

  const castaways: Castaway[] = [];

  for (let i = 0; i < npcCount; i++) {
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
    const tribeId = tribeIds[i % tribeIds.length];

    castaways.push({
      id,
      name: fullName!,
      age: 22 + Math.floor(rng() * 34),
      job: pick(JOBS),
      archetype,
      color,
      tribeId,
      stats: buildStats(id, archetype),
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
