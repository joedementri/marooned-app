import type { StateCreator } from 'zustand';
import type { GameStore } from '../gameStore';
import type { AdvantageType } from '../../data/advantages';

export type IntelKind = 'observation' | 'told' | 'overheard' | 'reward-spy';
export type IntelConfidence = 'high' | 'medium' | 'low';

export type IntelClaim =
  | { type: 'alliance-exists'; memberIds: number[] }
  | { type: 'vote-target'; voterId: number; targetId: number }
  | { type: 'has-advantage'; holderId: number; advantage: AdvantageType | 'unknown' }
  | { type: 'relationship'; a: number; b: number; tone: 'close' | 'feuding' }
  | { type: 'idol-hunting'; id: number };

export interface IntelEntry {
  id: string;
  day: number;
  kind: IntelKind;
  sourceId: number | null;   // null = the player's own eyes
  subjectIds: number[];
  claim: IntelClaim;
  text: string;
  truthful: boolean;         // hidden from UI — used only by downstream logic/debug
  confidence: IntelConfidence;
}

const INTEL_CAP = 200;

export interface IntelSlice {
  intel: IntelEntry[];
  addIntel(entries: IntelEntry[]): void;
  clearIntel(): void;
}

export const createIntelSlice: StateCreator<GameStore, [], [], IntelSlice> = (set) => ({
  intel: [],

  addIntel(entries) {
    if (entries.length === 0) return;
    set(state => ({ intel: [...entries, ...state.intel].slice(0, INTEL_CAP) }));
  },

  clearIntel() {
    set({ intel: [] });
  },
});
