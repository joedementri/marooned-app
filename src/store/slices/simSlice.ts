import type { StateCreator } from 'zustand';
import type { GameStore } from '../gameStore';
import type { DayPhase } from './phaseSlice';
import type { Castaway } from '../../data/roster';
import type { VoteMap } from '../../utils/voteSimulator';
import { PLAYER_ID } from '../../utils/voteSimulator';
import {
  simulateMorningTick,
  simulateEveningTick,
  simulateNightTick,
  applyTribalAftermath,
  type SimInput,
  type SimTickResult,
} from '../../engine/socialEngine';

// Bridges the pure social engine to the store: builds a snapshot, runs the right
// tick for a phase transition, and writes the deltas back. Idempotent per
// (day, phase) via `lastSimTick`.

export interface SimSlice {
  runSimForTransition(nextPhase: DayPhase): void;
  runNightSim(): void;
  applyTribalAftermathToStore(votes: VoteMap, eliminatedId: number): void;
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

function buildActiveRoster(state: GameStore): Castaway[] {
  return state.castaways.filter(
    c => !c.eliminated && !c.onRedemptionIsland && !state.edgeIds.includes(c.id)
  );
}

function buildInput(state: GameStore, phase: DayPhase, active: Castaway[]): SimInput {
  const playerInCamp = active.some(c => c.id === PLAYER_ID);
  return {
    day: state.day,
    phase,
    castaways: active,
    relationships: state.relationships,
    alliances: state.alliances,
    locations: state.locations,
    gameSeed: state.gameSeed,
    playerTribeId: state.playerTribeId,
    playerInCamp,
  };
}

export const createSimSlice: StateCreator<GameStore, [], [], SimSlice> = (set, get) => {
  function applyTickResult(result: SimTickResult): void {
    get().applyRelDeltas(result.relDeltas);
    get().applyAllianceOps(result.allianceOps);

    for (const find of result.npcAdvantageFinds) {
      get().addCastawayAdvantage(find.id, find.type);
      if (find.locationId) {
        const locId = find.locationId;
        set(state => ({
          locations: state.locations.map(l => l.id === locId ? { ...l, idolHidden: false } : l),
        }));
      }
    }

    if (Object.keys(result.energyDeltas).length > 0) {
      set(state => ({
        castaways: state.castaways.map(c => {
          const d = result.energyDeltas[c.id];
          return d == null ? c : { ...c, energy: clamp01(c.energy + d) };
        }),
      }));
    }

    if (result.observations.length > 0) get().addIntel(result.observations);
    result.feed.forEach(f => get().addFeedEntry(f));

    get().syncPlayerFacingStats();
  }

  return {
    runSimForTransition(nextPhase) {
      const state = get();
      const tickKey = `d${state.day}-${nextPhase}`;
      if (state.lastSimTick === tickKey) return;

      let result: SimTickResult | null = null;
      const active = buildActiveRoster(state);
      if (nextPhase === 'day') {
        result = simulateMorningTick(buildInput(state, nextPhase, active));
      } else if (nextPhase === 'evening') {
        result = simulateEveningTick(buildInput(state, nextPhase, active));
      }

      set({ lastSimTick: tickKey });
      if (result) applyTickResult(result);
    },

    runNightSim() {
      const state = get();
      const active = buildActiveRoster(state);
      const result = simulateNightTick(buildInput(state, 'sleep', active));
      applyTickResult(result);
      // Edge dwellers live their day too.
      if (state.edgeIds.length > 0) get().runEdgeDay();
    },

    applyTribalAftermathToStore(votes, eliminatedId) {
      const state = get();
      const { relDeltas, allianceOps, feed } = applyTribalAftermath({
        castaways: state.castaways,
        alliances: state.alliances,
        votes,
        eliminatedId,
        day: state.day,
      });
      get().applyRelDeltas(relDeltas);
      get().applyAllianceOps(allianceOps);
      feed.forEach(f => get().addFeedEntry(f));
      get().syncPlayerFacingStats();
    },
  };
};
