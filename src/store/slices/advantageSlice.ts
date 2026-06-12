import type { StateCreator } from 'zustand';
import type { GameStore } from '../gameStore';
import type { AdvantageType } from '../../data/advantages';

export interface AdvantageSlice {
  playerAdvantages: AdvantageType[];
  playerIdolCount: number;
  playerImmunityWins: number;
  playerThreat: number; // 0–1
  addPlayerAdvantage(type: AdvantageType): void;
  removePlayerAdvantage(type: AdvantageType): void;
  setPlayerIdolCount(count: number): void;
  incrementImmunityWins(): void;
  setPlayerThreat(value: number): void;
  bumpPlayerThreat(delta: number): void;
}

export const createAdvantageSlice: StateCreator<GameStore, [], [], AdvantageSlice> = (set) => ({
  playerAdvantages: [],
  playerIdolCount: 0,
  playerImmunityWins: 0,
  playerThreat: 0.2,

  addPlayerAdvantage(type) {
    set(state => ({ playerAdvantages: [...state.playerAdvantages, type] }));
  },

  removePlayerAdvantage(type) {
    set(state => ({ playerAdvantages: state.playerAdvantages.filter(a => a !== type) }));
  },

  setPlayerIdolCount(count) {
    set({ playerIdolCount: Math.max(0, count) });
  },

  incrementImmunityWins() {
    // Winning in front of everyone makes you a bigger target.
    set(state => ({
      playerImmunityWins: state.playerImmunityWins + 1,
      playerThreat: Math.min(1, state.playerThreat + 0.06),
    }));
  },

  setPlayerThreat(value) {
    set({ playerThreat: Math.max(0, Math.min(1, value)) });
  },

  bumpPlayerThreat(delta) {
    set(state => ({ playerThreat: Math.max(0, Math.min(1, state.playerThreat + delta)) }));
  },
});
