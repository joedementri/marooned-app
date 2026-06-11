import type { GameStore } from '../store/gameStore';
import type { IntelEntry } from '../store/slices/intelSlice';
import type { AdvantageType } from './advantages';
import { PLAYER_ID } from '../utils/voteSimulator';
import { gameRng, pickFrom } from '../engine/rng';

export type RewardEffectKind = 'feast' | 'comfort' | 'spy' | 'clue' | 'advantage';

export interface RewardDef {
  key: string;
  name: string;
  effect: RewardEffectKind;
}

export const REWARDS: RewardDef[] = [
  { key: 'feast',    name: 'Island Feast',       effect: 'feast' },
  { key: 'comfort',  name: 'Camp Comforts',      effect: 'comfort' },
  { key: 'letters',  name: 'Letters from Home',  effect: 'comfort' },
  { key: 'spy',      name: 'Spy on the Others',  effect: 'spy' },
  { key: 'map',      name: 'A Weathered Map',    effect: 'clue' },
  { key: 'crate',    name: 'A Mystery Crate',    effect: 'advantage' },
];

const SPY_ADVANTAGES: AdvantageType[] = ['extra_vote', 'steal_a_vote', 'idol_nullifier'];

export interface RewardContext {
  playerWon: boolean;
  winnerMemberIds: number[];
  store: GameStore;
}

// Applies the mechanical effect of a reward to the winning side and returns a
// short note for the UI.
export function applyRewardEffect(reward: RewardDef, ctx: RewardContext): string {
  const { playerWon, winnerMemberIds, store } = ctx;
  const day = store.day;

  switch (reward.effect) {
    case 'feast': {
      winnerMemberIds.forEach(id => {
        store.adjustEnergy(id, 0.25);
        store.updateCastawayStats(id, { mood: 0.1 });
      });
      return playerWon ? 'Full bellies — your side gains energy for tomorrow.' : 'The other side feasts and recovers.';
    }
    case 'comfort': {
      winnerMemberIds.forEach(id => store.updateCastawayStats(id, { mood: 0.18 }));
      return playerWon ? 'Morale soars around camp.' : 'The other side enjoys a morale boost.';
    }
    case 'spy': {
      if (!playerWon) return 'The winners scouted your camp.';
      const entries = buildSpyIntel(store);
      if (entries.length > 0) store.addIntel(entries);
      return `You spied on the others and learned ${entries.length} thing${entries.length === 1 ? '' : 's'}.`;
    }
    case 'clue': {
      if (!playerWon) return 'The map went to the other side.';
      store.addPlayerClue(1);
      return 'The map points you toward a hidden idol (+1 clue).';
    }
    case 'advantage': {
      if (!playerWon) return 'The crate went to the other side.';
      const rng = gameRng(store.gameSeed, `reward-adv-d${day}`);
      if (rng() < 0.35) {
        store.setPlayerIdolCount(store.playerIdolCount + 1);
        return 'Inside the crate: a Hidden Immunity Idol!';
      }
      const adv = pickFrom(SPY_ADVANTAGES, rng);
      store.addPlayerAdvantage(adv);
      return `Inside the crate: an advantage.`;
    }
    default:
      return '';
  }
}

// Truthful intel about a couple of other castaways (alliances or vote targets).
function buildSpyIntel(store: GameStore): IntelEntry[] {
  const day = store.day;
  const rng = gameRng(store.gameSeed, `reward-spy-d${day}`);
  const others = store.castaways.filter(c => !c.eliminated && c.id !== PLAYER_ID);
  const entries: IntelEntry[] = [];

  // Prefer revealing real alliances the player doesn't yet know about.
  const hiddenAlliances = store.alliances.filter(a => !a.knownToPlayer && !a.memberIds.includes(PLAYER_ID));
  for (const alliance of hiddenAlliances.slice(0, 2)) {
    const names = alliance.memberIds
      .map(id => store.castaways.find(c => c.id === id)?.name.split(' ')[0])
      .filter(Boolean)
      .join(', ');
    entries.push({
      id: `intel-spy-${alliance.id}-d${day}`,
      day, kind: 'reward-spy', sourceId: null,
      subjectIds: alliance.memberIds,
      claim: { type: 'alliance-exists', memberIds: alliance.memberIds },
      text: `From the other camp you saw a tight group: ${names}.`,
      truthful: true, confidence: 'high',
    });
    store.revealAllianceToPlayer(alliance.id);
  }

  // Otherwise, surface a relationship read.
  if (entries.length === 0 && others.length >= 2) {
    const a = pickFrom(others, rng);
    const b = pickFrom(others.filter(c => c.id !== a.id), rng);
    entries.push({
      id: `intel-spy-rel-${a.id}-${b.id}-d${day}`,
      day, kind: 'reward-spy', sourceId: null,
      subjectIds: [a.id, b.id],
      claim: { type: 'relationship', a: a.id, b: b.id, tone: 'close' },
      text: `You watched ${a.name.split(' ')[0]} and ${b.name.split(' ')[0]} strategizing together.`,
      truthful: true, confidence: 'medium',
    });
  }

  return entries;
}
