import type { StateCreator } from 'zustand';
import type { GameStore } from '../gameStore';
import type { Location } from '../../data/locations';
import { INITIAL_LOCATIONS } from '../../data/locations';
import { seeded } from '../../utils/seeded';

export type SearchOutcome = 'idol' | 'clue' | 'nothing';

export interface SearchResult {
  outcome: SearchOutcome;
  watched: boolean; // true if this was the 2nd+ search today
}

export interface IslandSlice {
  locations: Location[];
  searchesToday: number;
  playerCluesHeld: number;
  initLocations(): void;
  searchLocation(locationId: string): SearchResult;
  reshuffleIdolLocations(): void;
  resetDailySearches(): void;
}

export const createIslandSlice: StateCreator<GameStore, [], [], IslandSlice> = (set, get) => ({
  locations: INITIAL_LOCATIONS.map(l => ({ ...l })),
  searchesToday: 0,
  playerCluesHeld: 0,

  initLocations() {
    set({ locations: INITIAL_LOCATIONS.map(l => ({ ...l })), searchesToday: 0, playerCluesHeld: 0 });
  },

  searchLocation(locationId) {
    const { locations, searchesToday, playerCluesHeld, day } = get();
    const loc = locations.find(l => l.id === locationId);
    if (!loc || !loc.unlocked) return { outcome: 'nothing', watched: false };

    const watched = searchesToday >= 1;
    const newCount = searchesToday + 1;
    const rng = seeded(day * 1000 + locationId.charCodeAt(0) + newCount * 37);
    const roll = rng();

    // Idol find attempt — use global clue count for probability boost
    if (loc.idolHidden) {
      const prob = Math.min(0.85, 0.35 + playerCluesHeld * 0.15);
      if (roll < prob) {
        set(state => ({
          searchesToday: newCount,
          locations: state.locations.map(l =>
            l.id === locationId ? { ...l, idolHidden: false } : l
          ),
        }));
        get().setPlayerIdolCount(get().playerIdolCount + 1);
        return { outcome: 'idol', watched };
      }
    }

    // Clue find attempt (CLUE payoff locations)
    if (loc.payoff === 'CLUE' && roll < 0.55 && loc.cluesHeld < 2) {
      set(state => ({
        searchesToday: newCount,
        playerCluesHeld: state.playerCluesHeld + 1,
        locations: state.locations.map(l =>
          l.id === locationId ? { ...l, cluesHeld: l.cluesHeld + 1 } : l
        ),
      }));
      return { outcome: 'clue', watched };
    }

    set({ searchesToday: newCount });
    return { outcome: 'nothing', watched };
  },

  reshuffleIdolLocations() {
    set(state => {
      const rng = seeded(state.day * 999 + 1);
      const ids = state.locations.map(l => l.id);
      const shuffled = [...ids];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const idolSpots = new Set(shuffled.slice(0, 2));
      return {
        playerCluesHeld: 0,
        locations: state.locations.map(l => ({
          ...l,
          idolHidden: idolSpots.has(l.id),
          cluesHeld: 0,
        })),
      };
    });
  },

  resetDailySearches() {
    set({ searchesToday: 0 });
  },
});
