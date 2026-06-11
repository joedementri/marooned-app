import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type ThemeKey = 'island' | 'dusk' | 'night';

interface SettingsStore {
  soundEnabled: boolean;
  musicEnabled: boolean;
  difficulty: Difficulty;
  theme: ThemeKey;
  setSoundEnabled(v: boolean): void;
  setMusicEnabled(v: boolean): void;
  setDifficulty(v: Difficulty): void;
  setTheme(v: ThemeKey): void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      soundEnabled: true,
      musicEnabled: true,
      difficulty: 'medium',
      theme: 'dusk',
      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setMusicEnabled: (v) => set({ musicEnabled: v }),
      setDifficulty: (v) => set({ difficulty: v }),
      setTheme: (v) => set({ theme: v }),
    }),
    {
      name: 'marooned-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
