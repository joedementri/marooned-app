import type { ThemeKey } from '../store/settingsStore';

export interface Theme {
  sky1: string;
  sky2: string;
  sand: string;
  water: string;
  accent: string;
}

export const THEMES: Record<ThemeKey, Theme> = {
  island:  { sky1: '#7ec4d6', sky2: '#1d7a8c', sand: '#f0e3c4', water: '#0f4c5c', accent: '#e85a4f' },
  dusk:    { sky1: '#c95c8a', sky2: '#4a2a5a', sand: '#d8b88a', water: '#2a3a5a', accent: '#f4a83a' },
  night:   { sky1: '#1a2444', sky2: '#0e1428', sand: '#3a3a4a', water: '#0a1428', accent: '#ff6b35' },
};
