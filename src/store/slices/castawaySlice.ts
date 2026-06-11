import type { StateCreator } from 'zustand';
import type { GameStore } from '../gameStore';
import type { Castaway, CastawayStats } from '../../data/roster';
import { PLAYER_ID } from '../../utils/voteSimulator';

export interface CastawaySlice {
  castaways: Castaway[];
  setCastaways(castaways: Castaway[]): void;
  eliminateCastaway(id: number, day: number, votedOutBy: number[]): void;
  permanentEliminate(id: number, day: number, votedOutBy: number[]): void;
  updateCastawayStats(id: number, delta: Partial<CastawayStats>): void;
  revealCastawayTrait(id: number, traitKey: string): void;
  setCastawayIdol(id: number, hasIdol: boolean): void;
  addCastawayAdvantage(id: number, advantageType: string): void;
  removeCastawayAdvantage(id: number, advantageType: string): void;
  assignToMergeTribe(mergeId: string): void;
  checkMergeTrigger(): boolean;
}

export const createCastawaySlice: StateCreator<GameStore, [], [], CastawaySlice> = (set, get) => ({
  castaways: [],

  setCastaways(castaways) {
    set({ castaways });
  },

  eliminateCastaway(id, day, votedOutBy) {
    const { gameSettings, gameMode } = get();
    const sendToRI =
      gameSettings.redemptionIsland &&
      gameMode === 'pre-merge' &&
      id !== PLAYER_ID;

    if (sendToRI) {
      get().sendToRedemptionIsland(id);
    } else {
      set(state => ({
        castaways: state.castaways.map(c =>
          c.id === id ? { ...c, eliminated: true, eliminatedDay: day } : c
        ),
      }));
    }
    get().checkMergeTrigger();
  },

  permanentEliminate(id, day, _votedOutBy) {
    set(state => ({
      castaways: state.castaways.map(c =>
        c.id === id
          ? { ...c, eliminated: true, eliminatedDay: day, onRedemptionIsland: false }
          : c
      ),
      riQueue: state.riQueue.filter(rid => rid !== id),
    }));
    get().checkMergeTrigger();
  },

  updateCastawayStats(id, delta) {
    set(state => ({
      castaways: state.castaways.map(c => {
        if (c.id !== id) return c;
        const next = { ...c.stats };
        (Object.keys(delta) as Array<keyof CastawayStats>).forEach(k => {
          next[k] = Math.max(0, Math.min(1, next[k] + (delta[k] ?? 0)));
        });
        return { ...c, stats: next };
      }),
    }));
  },

  revealCastawayTrait(id, traitKey) {
    set(state => ({
      castaways: state.castaways.map(c =>
        c.id === id ? { ...c, revealed: { ...c.revealed, [traitKey]: true } } : c
      ),
    }));
  },

  setCastawayIdol(id, hasIdol) {
    set(state => ({
      castaways: state.castaways.map(c => c.id === id ? { ...c, hasIdol } : c),
    }));
  },

  addCastawayAdvantage(id, advantageType) {
    set(state => ({
      castaways: state.castaways.map(c =>
        c.id === id ? { ...c, advantages: [...c.advantages, advantageType] } : c
      ),
    }));
  },

  removeCastawayAdvantage(id, advantageType) {
    set(state => ({
      castaways: state.castaways.map(c =>
        c.id === id
          ? { ...c, advantages: c.advantages.filter(a => a !== advantageType) }
          : c
      ),
    }));
  },

  assignToMergeTribe(mergeId) {
    set(state => ({
      castaways: state.castaways.map(c =>
        c.eliminated ? c : { ...c, tribeId: mergeId }
      ),
    }));
  },

  checkMergeTrigger() {
    const { castaways, gameMode, tribes, gameSettings } = get();
    const { jurySize, finaleSize, numTribes } = gameSettings;

    const mergeAliveThreshold = jurySize + finaleSize;
    const mergeTribeSizeThreshold = Math.floor(mergeAliveThreshold / numTribes);
    const finalTribalThreshold = finaleSize;

    // RI players are not counted as alive for threshold checks
    const alive = castaways.filter(c => !c.eliminated && !c.onRedemptionIsland);

    if (alive.length <= finalTribalThreshold && gameMode !== 'final-tribal' && gameMode !== 'ended') {
      get().setGameMode('final-tribal');
      return true;
    }

    if (gameMode !== 'pre-merge') return false;

    const tribeSizes = tribes
      .filter(t => !t.id.includes('merge'))
      .map(t => alive.filter(c => c.tribeId === t.id).length);
    const smallestTribe = Math.min(...(tribeSizes.length ? tribeSizes : [0]));

    if (alive.length <= mergeAliveThreshold || smallestTribe <= mergeTribeSizeThreshold) {
      get().triggerMerge();
      return true;
    }
    return false;
  },
});
