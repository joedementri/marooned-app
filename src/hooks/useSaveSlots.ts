import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameStore } from '../store/gameStore';
import { useSaveSlotStore } from '../store/saveSlotStore';

const SLOT_KEY = (n: number) => `marooned-save-slot-${n}`;

export function useSaveSlots() {
  const slots = useSaveSlotStore(s => s.slots);
  const updateSlot = useSaveSlotStore(s => s.updateSlot);
  const clearSlot = useSaveSlotStore(s => s.clearSlot);

  async function saveCurrentGame(): Promise<void> {
    const state = useGameStore.getState();
    const { slotIndex, playerName, day, difficulty } = state;
    await AsyncStorage.setItem(SLOT_KEY(slotIndex), JSON.stringify(state));
    updateSlot(slotIndex, { playerName, day, difficulty, saveDate: new Date().toISOString() });
  }

  async function loadGame(slotIndex: number): Promise<boolean> {
    const raw = await AsyncStorage.getItem(SLOT_KEY(slotIndex));
    if (!raw) return false;
    try {
      const saved = JSON.parse(raw);
      useGameStore.setState(saved);
      return true;
    } catch {
      return false;
    }
  }

  async function deleteSlot(slotIndex: number): Promise<void> {
    await AsyncStorage.removeItem(SLOT_KEY(slotIndex));
    clearSlot(slotIndex);
    // If the deleted slot was the active game, reset
    if (useGameStore.getState().slotIndex === slotIndex) {
      useGameStore.getState().resetGame();
    }
  }

  return { slots, saveCurrentGame, loadGame, deleteSlot };
}
