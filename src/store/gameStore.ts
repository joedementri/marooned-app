import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createPhaseSlice, type PhaseSlice, type DayPhase } from './slices/phaseSlice';
import { createCastawaySlice, type CastawaySlice } from './slices/castawaySlice';
import { createAdvantageSlice, type AdvantageSlice } from './slices/advantageSlice';
import { createJurySlice, type JurySlice } from './slices/jurySlice';
import { createIslandSlice, type IslandSlice } from './slices/islandSlice';
import { createRedemptionIslandSlice, type RedemptionIslandSlice } from './slices/redemptionIslandSlice';
import { buildRandomCastaways } from '../data/roster';
import type { Castaway } from '../data/roster';
import { PRE_MERGE_TRIBE_NAMES, MERGE_TRIBE_NAMES } from '../data/tribes';
import { PLAYER_ID } from '../utils/voteSimulator';
import { INITIAL_LOCATIONS } from '../data/locations';
import { seeded } from '../utils/seeded';

export interface Tribe {
  id: string;
  name: string;
  color: string;
}

export interface GameSettings {
  totalCastaways: number;
  numTribes: number;
  redemptionIsland: boolean;
  jurySize: number;
  finaleSize: number;
  finalTcStyle: 'vote' | 'fire';
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  totalCastaways: 18,
  numTribes: 2,
  redemptionIsland: false,
  jurySize: 9,
  finaleSize: 3,
  finalTcStyle: 'vote',
};

export type FeedEntryType = 'alliance' | 'vote' | 'advantage' | 'tribal' | 'merge' | 'system';

export interface FeedEntry {
  id: string;
  day: number;
  phase: DayPhase;
  text: string;
  type: FeedEntryType;
}

interface GameRootState {
  slotIndex: number;
  playerName: string;
  difficulty: 'easy' | 'medium' | 'hard';
  playerTribeId: string;
  tribes: Tribe[];
  mergeTribeName: string | null;
  feed: FeedEntry[];
  isGameActive: boolean;
  gameSettings: GameSettings;
}

interface GameRootActions {
  startNewGame(params: {
    slotIndex: number;
    playerName: string;
    difficulty: 'easy' | 'medium' | 'hard';
    settings: GameSettings;
  }): void;
  addFeedEntry(entry: FeedEntry): void;
  triggerMerge(): void;
  resetGame(): void;
}

export type GameStore =
  PhaseSlice &
  CastawaySlice &
  AdvantageSlice &
  JurySlice &
  IslandSlice &
  RedemptionIslandSlice &
  GameRootState &
  GameRootActions;

const TRIBE_COLORS = ['#0f4c5c', '#7c2d2d', '#2d5a3d', '#6b4a8a'];

const ROOT_DEFAULTS: GameRootState = {
  slotIndex: 0,
  playerName: '',
  difficulty: 'medium',
  playerTribeId: '',
  tribes: [],
  mergeTribeName: null,
  feed: [],
  isGameActive: false,
  gameSettings: DEFAULT_GAME_SETTINGS,
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get, api) => ({
      ...ROOT_DEFAULTS,

      ...createPhaseSlice(set, get, api),
      ...createCastawaySlice(set, get, api),
      ...createAdvantageSlice(set, get, api),
      ...createJurySlice(set, get, api),
      ...createIslandSlice(set, get, api),
      ...createRedemptionIslandSlice(set, get, api),

      startNewGame({ slotIndex, playerName, difficulty, settings }) {
        const { totalCastaways, numTribes } = settings;
        const rng = seeded((Date.now() % 100000) + slotIndex * 13);

        // Pick numTribes distinct names
        const pool = [...PRE_MERGE_TRIBE_NAMES];
        const tribeNames: string[] = [];
        for (let i = 0; i < numTribes; i++) {
          const idx = Math.floor(rng() * pool.length);
          tribeNames.push(pool[idx]);
          pool.splice(idx, 1);
        }

        const tribes: Tribe[] = tribeNames.map((name, i) => ({
          id: name.toLowerCase(),
          name,
          color: TRIBE_COLORS[i],
        }));

        const tribeIds = tribes.map(t => t.id);
        const playerTribeId = tribeIds[Math.floor(rng() * tribeIds.length)];
        const mergeTribeName = MERGE_TRIBE_NAMES[Math.floor(rng() * MERGE_TRIBE_NAMES.length)];

        const npcCount = totalCastaways - 1;
        const npcSeed = (Date.now() % 100000) + slotIndex * 17;
        const npcs = buildRandomCastaways(tribeIds, npcCount, npcSeed);

        const playerCastaway: Castaway = {
          id: PLAYER_ID,
          name: playerName,
          age: 0,
          job: '',
          archetype: 'strategist',
          color: '#3d5a7c',
          tribeId: playerTribeId,
          stats: {
            trust: 0.5, loyalty: 0.5, suspicion: 0.1,
            mood: 0.75, strength: 0.5, mental: 0.5,
            social: 0.5, threat: 0.2,
          },
          eliminated: false,
          eliminatedDay: null,
          onRedemptionIsland: false,
          hasIdol: false,
          advantages: [],
          revealed: {
            archetype: false, trust: true, suspicion: true, mood: true,
            strength: true, mental: true, social: true, threat: true, loyalty: true,
          },
          lastInteraction: null,
          relationshipLog: [],
        };

        const castaways = [playerCastaway, ...npcs];

        set({
          slotIndex,
          playerName,
          difficulty,
          gameSettings: settings,
          playerTribeId,
          tribes,
          mergeTribeName,
          feed: [],
          isGameActive: true,
          day: 1,
          phase: 'morning',
          gameMode: 'pre-merge',
          immunityWinnerId: null,
          playerTribeImmune: false,
          immuneTribeId: null,
          castaways,
          playerAdvantages: [],
          playerIdolCount: 0,
          playerImmunityWins: 0,
          playerThreat: 0.2,
          jury: [],
          locations: INITIAL_LOCATIONS.map(l => ({ ...l })),
          searchesToday: 0,
          playerCluesHeld: 0,
          riQueue: [],
        });
      },

      addFeedEntry(entry) {
        set(state => ({ feed: [entry, ...state.feed].slice(0, 100) }));
      },

      triggerMerge() {
        const { mergeTribeName, day, phase, castaways, gameSettings, riQueue } = get();
        const name = mergeTribeName ?? 'Tabu';
        const mergeId = name.toLowerCase();
        const mergeColor = '#c98a2a';

        set(state => ({
          gameMode: 'post-merge',
          playerTribeId: mergeId,
          tribes: [...state.tribes, { id: mergeId, name, color: mergeColor }],
          castaways: state.castaways.map(c =>
            c.eliminated ? c : { ...c, tribeId: mergeId }
          ),
        }));

        get().addFeedEntry({
          id: `merge-day${day}`,
          day,
          phase,
          text: `The tribes have merged. Welcome to ${name}.`,
          type: 'merge',
        });
        get().reshuffleIdolLocations();

        // Redemption Island re-entry: last RI castaway comes back
        if (gameSettings.redemptionIsland && riQueue.length > 0) {
          const returneeId = riQueue[riQueue.length - 1];
          get().removeFromRedemptionIsland(returneeId);
          // Assign them to merge tribe
          set(state => ({
            castaways: state.castaways.map(c =>
              c.id === returneeId ? { ...c, tribeId: mergeId, onRedemptionIsland: false } : c
            ),
          }));
          // Permanently eliminate any remaining RI occupants
          const remaining = get().riQueue;
          remaining.forEach(rid => {
            set(state => ({
              castaways: state.castaways.map(c =>
                c.id === rid ? { ...c, eliminated: true, onRedemptionIsland: false, eliminatedDay: day } : c
              ),
              riQueue: state.riQueue.filter(id => id !== rid),
            }));
          });
          const returneeName = get().castaways.find(c => c.id === returneeId)?.name ?? 'Someone';
          get().addFeedEntry({
            id: `ri-return-day${day}`,
            day,
            phase,
            text: `${returneeName} returns from Redemption Island and re-enters the game!`,
            type: 'merge',
          });
        }

        const alive = get().castaways.filter(c => !c.eliminated).length;
        get().addFeedEntry({
          id: `merge-note-day${day}`,
          day,
          phase,
          text: `${alive} players remain. Individual immunity is now in play.`,
          type: 'system',
        });
      },

      resetGame() {
        set({
          ...ROOT_DEFAULTS,
          day: 1,
          phase: 'morning',
          gameMode: 'pre-merge',
          immunityWinnerId: null,
          playerTribeImmune: false,
          immuneTribeId: null,
          castaways: [],
          playerAdvantages: [],
          playerIdolCount: 0,
          playerImmunityWins: 0,
          playerThreat: 0.2,
          jury: [],
          locations: INITIAL_LOCATIONS.map(l => ({ ...l })),
          searchesToday: 0,
          playerCluesHeld: 0,
          riQueue: [],
        });
      },
    }),
    {
      name: 'marooned-game-current',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
