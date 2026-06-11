import type { StateCreator } from 'zustand';
import type { GameStore } from '../gameStore';
import type { Castaway, CastawayStats } from '../../data/roster';
import type { AdvantageType } from '../../data/advantages';
import { PLAYER_ID } from '../../utils/voteSimulator';

export interface CastawaySlice {
  castaways: Castaway[];
  setCastaways(castaways: Castaway[]): void;
  eliminateCastaway(id: number, day: number, votedOutBy: number[]): void;
  permanentEliminate(id: number, day: number, votedOutBy: number[]): void;
  updateCastawayStats(id: number, delta: Partial<CastawayStats>): void;
  adjustEnergy(id: number, delta: number): void;
  revealCastawayTrait(id: number, traitKey: string): void;
  setCastawayIdol(id: number, hasIdol: boolean): void;
  addCastawayAdvantage(id: number, advantageType: AdvantageType): void;
  removeCastawayAdvantage(id: number, advantageType: AdvantageType): void;
  assignToMergeTribe(mergeId: string): void;
  checkMergeTrigger(): boolean;
}

export const createCastawaySlice: StateCreator<GameStore, [], [], CastawaySlice> = (set, get) => ({
  castaways: [],

  setCastaways(castaways) {
    set({ castaways });
  },

  eliminateCastaway(id, day, votedOutBy) {
    const { gameSettings, gameMode, playerEdgeReentryUsed } = get();
    const twist = gameSettings.twist;

    // Redemption Island: pre-merge boots duel for a way back in.
    const sendToRI =
      twist === 'redemption' &&
      gameMode === 'pre-merge' &&
      id !== PLAYER_ID;

    // Edge of Extinction: post-merge boots (and optionally pre-merge) go to the Edge.
    // The player goes to the Edge only if they still have a re-entry shot left.
    const sendToEdge =
      twist === 'edge' &&
      (gameMode !== 'pre-merge' || gameSettings.edgePreMerge) &&
      (id !== PLAYER_ID || !playerEdgeReentryUsed);

    if (sendToRI) {
      get().sendToRedemptionIsland(id);
    } else if (sendToEdge) {
      get().sendToEdge(id, day);
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

  adjustEnergy(id, delta) {
    set(state => ({
      castaways: state.castaways.map(c =>
        c.id === id ? { ...c, energy: Math.max(0, Math.min(1, c.energy + delta)) } : c
      ),
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
      castaways: state.castaways.map(c => {
        if (c.id !== id) return c;
        const has = c.advantages.includes('hii');
        let advantages = c.advantages;
        if (hasIdol && !has) advantages = [...c.advantages, 'hii'];
        if (!hasIdol && has) advantages = c.advantages.filter(a => a !== 'hii');
        return { ...c, hasIdol, advantages };
      }),
    }));
  },

  addCastawayAdvantage(id, advantageType) {
    set(state => ({
      castaways: state.castaways.map(c =>
        c.id === id
          ? {
              ...c,
              advantages: [...c.advantages, advantageType],
              hasIdol: c.hasIdol || advantageType === 'hii',
            }
          : c
      ),
    }));
  },

  removeCastawayAdvantage(id, advantageType) {
    set(state => ({
      castaways: state.castaways.map(c => {
        if (c.id !== id) return c;
        // Remove a single occurrence so duplicate advantages are handled correctly.
        const idx = c.advantages.indexOf(advantageType);
        if (idx === -1) return c;
        const advantages = [...c.advantages.slice(0, idx), ...c.advantages.slice(idx + 1)];
        return { ...c, advantages, hasIdol: advantages.includes('hii') };
      }),
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
    const { castaways, gameMode, tribes, gameSettings, edgeIds } = get();
    const { jurySize, finaleSize, numTribes } = gameSettings;

    const mergeAliveThreshold = jurySize + finaleSize;
    const mergeTribeSizeThreshold = Math.floor(mergeAliveThreshold / numTribes);
    const finalTribalThreshold = finaleSize;

    // RI / Edge players are not counted as alive for threshold checks
    const alive = castaways.filter(
      c => !c.eliminated && !c.onRedemptionIsland && !edgeIds.includes(c.id)
    );

    if (alive.length <= finalTribalThreshold && gameMode !== 'final-tribal' && gameMode !== 'ended') {
      // Edge of Extinction: anyone still on the Edge at the end joins the jury.
      if (gameSettings.twist === 'edge') {
        const day = get().day;
        get().edgeIds.slice().forEach(eid => {
          if (eid === PLAYER_ID) return;
          get().addJuryMember({
            castawayId: eid,
            eliminatedDay: get().castaways.find(c => c.id === eid)?.eliminatedDay ?? day,
            eliminatedBy: [],
            bitternessFactor: 0.2,
            relationshipScores: {},
          });
          get().permanentEliminate(eid, day, []);
        });
      }
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
