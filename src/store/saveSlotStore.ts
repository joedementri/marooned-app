import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SaveSlotMeta {
  occupied: boolean;
  playerName: string;
  day: number;
  difficulty: 'easy' | 'medium' | 'hard';
  saveDate: string; // ISO string
}

export type SlotTuple = [SaveSlotMeta, SaveSlotMeta, SaveSlotMeta, SaveSlotMeta];

const EMPTY_SLOT: SaveSlotMeta = {
  occupied: false,
  playerName: '',
  day: 1,
  difficulty: 'medium',
  saveDate: '',
};

function emptySlots(): SlotTuple {
  return [
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
  ];
}

interface SaveSlotStore {
  slots: SlotTuple;
  updateSlot(index: number, meta: Partial<Omit<SaveSlotMeta, 'occupied'>>): void;
  clearSlot(index: number): void;
}

export const useSaveSlotStore = create<SaveSlotStore>()(
  persist(
    (set) => ({
      slots: emptySlots(),

      updateSlot(index, meta) {
        set(state => {
          const next = [...state.slots] as SlotTuple;
          next[index] = { ...next[index], ...meta, occupied: true };
          return { slots: next };
        });
      },

      clearSlot(index) {
        set(state => {
          const next = [...state.slots] as SlotTuple;
          next[index] = { ...EMPTY_SLOT };
          return { slots: next };
        });
      },
    }),
    {
      name: 'marooned-slots',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
