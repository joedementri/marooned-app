import type { StateCreator } from 'zustand';
import type { GameStore } from '../gameStore';

export interface JuryMember {
  castawayId: number;
  eliminatedDay: number;
  eliminatedBy: number[];               // voter ids (0 = player)
  bitternessFactor: number;             // 0–1; high if blindsided
  relationshipScores: Record<number, number>; // finalistId → trust+loyalty snapshot
  vote?: number;                        // finalistId this juror votes for (set at FinalTribal)
}

export interface JurySlice {
  jury: JuryMember[];
  addJuryMember(member: Omit<JuryMember, 'vote'>): void;
  setJuryVote(castawayId: number, finalistId: number): void;
  clearJury(): void;
}

export const createJurySlice: StateCreator<GameStore, [], [], JurySlice> = (set) => ({
  jury: [],

  addJuryMember(member) {
    set(state => ({ jury: [...state.jury, member] }));
  },

  setJuryVote(castawayId, finalistId) {
    set(state => ({
      jury: state.jury.map(j =>
        j.castawayId === castawayId ? { ...j, vote: finalistId } : j
      ),
    }));
  },

  clearJury() {
    set({ jury: [] });
  },
});
