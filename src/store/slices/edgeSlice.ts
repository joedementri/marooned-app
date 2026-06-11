import type { StateCreator } from 'zustand';
import type { GameStore } from '../gameStore';
import type { AdvantageType } from '../../data/advantages';
import { gameRng } from '../../engine/rng';
import { PLAYER_ID } from '../../utils/voteSimulator';

// Edge of Extinction: booted players live on the Edge, scavenge for advantages
// they can bring back, and compete in occasional re-entry challenges. Edge members
// who never return still form part of the finale jury (modern Survivor rules).

export interface EdgeDweller {
  arrivedDay: number;
  grit: number;                 // accrues from surviving Edge days; aids re-entry odds
  advantages: AdvantageType[];  // found on the Edge, carried back on re-entry
}

export interface EdgeSlice {
  edgeIds: number[];
  edgeState: Record<number, EdgeDweller>;
  edgeReturnsDone: number; // count of re-entry challenges resolved so far (cap 2)
  sendToEdge(id: number, day: number): void;
  removeFromEdge(id: number): void;
  runEdgeDay(): void;
  resolveReentry(winnerId: number): void;
  clearEdge(): void;
}

const EDGE_ADVANTAGE_TABLE: AdvantageType[] = ['hii', 'extra_vote', 'idol_nullifier'];

export const createEdgeSlice: StateCreator<GameStore, [], [], EdgeSlice> = (set, get) => ({
  edgeIds: [],
  edgeState: {},
  edgeReturnsDone: 0,

  sendToEdge(id, day) {
    if (id === PLAYER_ID) {
      // Player can go to the Edge too, but keeps their found advantages.
      const existing = get().playerAdvantages;
      set(state => ({
        edgeIds: state.edgeIds.includes(id) ? state.edgeIds : [...state.edgeIds, id],
        edgeState: { ...state.edgeState, [id]: { arrivedDay: day, grit: 0, advantages: [...existing] } },
      }));
      return;
    }
    set(state => ({
      edgeIds: state.edgeIds.includes(id) ? state.edgeIds : [...state.edgeIds, id],
      edgeState: { ...state.edgeState, [id]: { arrivedDay: day, grit: 0, advantages: [] } },
    }));
  },

  removeFromEdge(id) {
    set(state => {
      const nextState = { ...state.edgeState };
      delete nextState[id];
      return { edgeIds: state.edgeIds.filter(e => e !== id), edgeState: nextState };
    });
  },

  // One simulated day on the Edge: dwellers gain grit and occasionally scavenge an
  // advantage. Surfaces feed entries; advantage finds are deliberately hidden from
  // the player (they only learn via re-entry).
  runEdgeDay() {
    const { edgeIds, edgeState, gameSeed, day, castaways } = get();
    if (edgeIds.length === 0) return;
    const rng = gameRng(gameSeed, `edge-day-${day}`);

    const nextState: Record<number, EdgeDweller> = { ...edgeState };
    for (const id of edgeIds) {
      if (id === PLAYER_ID) continue; // player's Edge day is played manually
      const d = nextState[id];
      if (!d) continue;
      const grit = Math.min(1, d.grit + 0.05 + rng() * 0.05);
      let advantages = d.advantages;
      // Rare scavenge find, more likely the longer they've been out there.
      const findChance = 0.06 + Math.min(0.12, (day - d.arrivedDay) * 0.01);
      if (rng() < findChance && advantages.length < 2) {
        const found = EDGE_ADVANTAGE_TABLE[Math.floor(rng() * EDGE_ADVANTAGE_TABLE.length)];
        advantages = [...advantages, found];
      }
      nextState[id] = { ...d, grit, advantages };
    }
    set({ edgeState: nextState });
  },

  // A castaway wins a re-entry challenge: they rejoin the active tribe with any
  // advantages they scavenged on the Edge.
  resolveReentry(winnerId) {
    const { edgeState, playerTribeId } = get();
    const dweller = edgeState[winnerId];
    get().removeFromEdge(winnerId);
    set(state => ({
      edgeReturnsDone: state.edgeReturnsDone + 1,
      castaways: state.castaways.map(c =>
        c.id === winnerId
          ? { ...c, eliminated: false, eliminatedDay: null, onRedemptionIsland: false, tribeId: playerTribeId }
          : c
      ),
    }));
    if (dweller) {
      if (winnerId === PLAYER_ID) {
        dweller.advantages.forEach(a => {
          if (a === 'hii') get().setPlayerIdolCount(get().playerIdolCount + 1);
          else get().addPlayerAdvantage(a);
        });
      } else {
        dweller.advantages.forEach(a => get().addCastawayAdvantage(winnerId, a));
      }
    }
  },

  clearEdge() {
    set({ edgeIds: [], edgeState: {}, edgeReturnsDone: 0 });
  },
});
