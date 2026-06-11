import type { StateCreator } from 'zustand';
import type { GameStore } from '../gameStore';

export interface RedemptionIslandSlice {
  riQueue: number[];
  sendToRedemptionIsland(id: number): void;
  removeFromRedemptionIsland(id: number): void;
  clearRedemptionIsland(): void;
}

export const createRedemptionIslandSlice: StateCreator<GameStore, [], [], RedemptionIslandSlice> = (set) => ({
  riQueue: [],

  sendToRedemptionIsland(id) {
    set(state => ({
      riQueue: [...state.riQueue, id],
      castaways: state.castaways.map(c =>
        c.id === id ? { ...c, onRedemptionIsland: true } : c
      ),
    }));
  },

  removeFromRedemptionIsland(id) {
    set(state => ({
      riQueue: state.riQueue.filter(rid => rid !== id),
      castaways: state.castaways.map(c =>
        c.id === id ? { ...c, onRedemptionIsland: false } : c
      ),
    }));
  },

  clearRedemptionIsland() {
    set(state => ({
      riQueue: [],
      castaways: state.castaways.map(c => ({ ...c, onRedemptionIsland: false })),
    }));
  },
});
