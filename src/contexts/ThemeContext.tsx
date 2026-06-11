import React, { createContext, useContext } from 'react';
import { useSettingsStore, type ThemeKey } from '../store/settingsStore';
import { C } from '../tokens/colors';

export interface ThemeColors {
  screenBg: string;
  cardBg: string;
  cardBorder: string;
  text: string;
  textSoft: string;
  accent: string;
  campTimeOfDay: 'day' | 'dusk' | 'night';
}

const THEME_MAP: Record<ThemeKey, ThemeColors> = {
  island: {
    screenBg:      C.sand,
    cardBg:        C.bone,
    cardBorder:    C.ink,
    text:          C.ink,
    textSoft:      C.inkSoft,
    accent:        C.coral,
    campTimeOfDay: 'day',
  },
  dusk: {
    screenBg:      '#261535',
    cardBg:        '#3d2450',
    cardBorder:    '#8a5a9a',
    text:          C.bone,
    textSoft:      '#c8a8d8',
    accent:        C.sun,
    campTimeOfDay: 'dusk',
  },
  night: {
    screenBg:      C.night,
    cardBg:        C.nightMid,
    cardBorder:    '#2a3a6a',
    text:          C.bone,
    textSoft:      C.inkSoft,
    accent:        C.torch,
    campTimeOfDay: 'night',
  },
};

const ThemeContext = createContext<ThemeColors>(THEME_MAP.dusk);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeKey = useSettingsStore(s => s.theme);
  const colors = THEME_MAP[themeKey] ?? THEME_MAP.dusk;
  return <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeColors {
  return useContext(ThemeContext);
}
