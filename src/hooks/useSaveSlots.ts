import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameStore } from '../store/gameStore';
import { useSaveSlotStore } from '../store/saveSlotStore';
import { SAVE_VERSION } from '../store/saveVersion';

const SLOT_KEY = (n: number) => `marooned-save-slot-${n}`;

export function useSaveSlots() {
  const slots = useSaveSlotStore(s => s.slots);
  const updateSlot = useSaveSlotStore(s => s.updateSlot);
  const clearSlot = useSaveSlotStore(s => s.clearSlot);

  async function saveCurrentGame(): Promise<void> {
    const state = useGameStore.getState();
    const { slotIndex, playerName, day, difficulty } = state;
    await AsyncStorage.setItem(SLOT_KEY(slotIndex), JSON.stringify({ ...state, __saveVersion: SAVE_VERSION }));
    updateSlot(slotIndex, { playerName, day, difficulty, saveDate: new Date().toISOString() });
  }

  // A version-matched save can still be truncated or hand-corrupted; applying
  // it blind leaves the store in an invalid state. Check the load-bearing keys.
  function isValidSave(saved: any): boolean {
    return (
      saved !== null &&
      typeof saved === 'object' &&
      Array.isArray(saved.castaways) && saved.castaways.length > 0 &&
      typeof saved.day === 'number' &&
      typeof saved.gameSeed === 'number' &&
      saved.gameSettings && typeof saved.gameSettings.finaleSize === 'number' &&
      saved.relationships && typeof saved.relationships === 'object'
    );
  }

  async function loadGame(slotIndex: number): Promise<boolean> {
    const raw = await AsyncStorage.getItem(SLOT_KEY(slotIndex));
    if (!raw) return false;
    try {
      const saved = JSON.parse(raw);
      // Reject saves from an incompatible schema version (no migration).
      if (saved.__saveVersion !== SAVE_VERSION) {
        await AsyncStorage.removeItem(SLOT_KEY(slotIndex));
        clearSlot(slotIndex);
        return false;
      }
      // Corrupt save: refuse to load but leave the slot intact for the user.
      if (!isValidSave(saved)) return false;
      delete saved.__saveVersion;
      // setState merges — reset first so any keys missing from the save fall
      // back to clean defaults instead of the previously loaded game's state.
      useGameStore.getState().resetGame();
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
