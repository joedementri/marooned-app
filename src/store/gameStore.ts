import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createPhaseSlice, type PhaseSlice, type DayPhase } from './slices/phaseSlice';
import { createCastawaySlice, type CastawaySlice } from './slices/castawaySlice';
import { createAdvantageSlice, type AdvantageSlice } from './slices/advantageSlice';
import { createJurySlice, type JurySlice } from './slices/jurySlice';
import { createIslandSlice, type IslandSlice } from './slices/islandSlice';
import { createRedemptionIslandSlice, type RedemptionIslandSlice } from './slices/redemptionIslandSlice';
import { createSocialSlice, type SocialSlice } from './slices/socialSlice';
import { createIntelSlice, type IntelSlice } from './slices/intelSlice';
import { createSimSlice, type SimSlice } from './slices/simSlice';
import { createEdgeSlice, type EdgeSlice } from './slices/edgeSlice';
import { buildRandomCastaways, buildPersonality } from '../data/roster';
import type { Castaway } from '../data/roster';
import { PRE_MERGE_TRIBE_NAMES, MERGE_TRIBE_NAMES } from '../data/tribes';
import { PLAYER_ID } from '../utils/voteSimulator';
import { INITIAL_LOCATIONS } from '../data/locations';
import { initRelationships } from '../engine/socialEngine';
import { makeParticipant, simulateHeadlessChallenge } from '../engine/challengeEngine';
import { gameRng, hashSeed, shuffled } from '../engine/rng';
import { SAVE_VERSION } from './saveVersion';

export interface Tribe {
  id: string;
  name: string;
  color: string;
}

export type TwistKind = 'none' | 'redemption' | 'edge';

export interface GameSettings {
  totalCastaways: number;
  numTribes: number;
  twist: TwistKind;
  edgePreMerge: boolean; // Edge of Extinction: also send pre-merge boots to the Edge
  jurySize: number;
  finaleSize: number;
  finalTcStyle: 'vote' | 'fire';
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  totalCastaways: 18,
  numTribes: 2,
  twist: 'none',
  edgePreMerge: false,
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
  gameSeed: number;
  lastSimTick: string | null;
  playerEdgeReentryUsed: boolean;
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
  SocialSlice &
  IntelSlice &
  SimSlice &
  EdgeSlice &
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
  gameSeed: 0,
  lastSimTick: null,
  playerEdgeReentryUsed: false,
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
      ...createSocialSlice(set, get, api),
      ...createIntelSlice(set, get, api),
      ...createSimSlice(set, get, api),
      ...createEdgeSlice(set, get, api),

      startNewGame({ slotIndex, playerName, difficulty, settings }) {
        const { totalCastaways, numTribes } = settings;
        const gameSeed = hashSeed(Date.now(), slotIndex, playerName);
        const setupRng = gameRng(gameSeed, 'setup');

        // Pick numTribes distinct names
        const pool = [...PRE_MERGE_TRIBE_NAMES];
        const tribeNames: string[] = [];
        for (let i = 0; i < numTribes; i++) {
          const idx = Math.floor(setupRng() * pool.length);
          tribeNames.push(pool[idx]);
          pool.splice(idx, 1);
        }

        const tribes: Tribe[] = tribeNames.map((name, i) => ({
          id: name.toLowerCase(),
          name,
          color: TRIBE_COLORS[i],
        }));

        const tribeIds = tribes.map(t => t.id);
        const mergeTribeName = MERGE_TRIBE_NAMES[Math.floor(setupRng() * MERGE_TRIBE_NAMES.length)];

        // Allocate every slot — including the player's — evenly across tribes, then
        // shuffle so the player isn't always on tribe 0. This is the fix for the
        // old "player added as an extra body" bug.
        const slots = shuffled(
          Array.from({ length: totalCastaways }, (_, i) => tribeIds[i % tribeIds.length]),
          gameRng(gameSeed, 'tribe-alloc'),
        );
        const playerTribeId = slots[0];
        const npcAssignments = slots.slice(1);
        const npcs = buildRandomCastaways(npcAssignments, hashSeed(gameSeed, 'npc'));

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
          personality: buildPersonality(PLAYER_ID, 'strategist'),
          energy: 1,
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
          gameSeed,
          lastSimTick: null,
          playerEdgeReentryUsed: false,
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
          relationships: initRelationships(castaways, gameSeed),
          alliances: [],
          intel: [],
          edgeIds: [],
          edgeState: {},
          edgeReturnsDone: 0,
        });

        // Project the freshly-seeded npc→player edges into player-facing stats.
        get().syncPlayerFacingStats();
      },

      addFeedEntry(entry) {
        set(state => ({ feed: [entry, ...state.feed].slice(0, 100) }));
      },

      triggerMerge() {
        const { mergeTribeName, day, phase, gameSettings, riQueue, gameSeed } = get();
        const name = mergeTribeName ?? 'Tabu';
        const mergeId = name.toLowerCase();
        const mergeColor = '#c98a2a';

        set(state => ({
          gameMode: 'post-merge',
          playerTribeId: mergeId,
          tribes: [...state.tribes, { id: mergeId, name, color: mergeColor }],
          castaways: state.castaways.map(c =>
            c.eliminated || c.onRedemptionIsland || state.edgeIds.includes(c.id)
              ? c
              : { ...c, tribeId: mergeId }
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
        // Making the merge puts the player more squarely on everyone's radar.
        get().bumpPlayerThreat(0.08);

        // Redemption Island re-entry: last RI castaway comes back
        if (gameSettings.twist === 'redemption' && riQueue.length > 0) {
          const returneeId = riQueue[riQueue.length - 1];
          get().removeFromRedemptionIsland(returneeId);
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

        // Edge of Extinction: NPC edge dwellers compete to re-enter at the merge.
        if (gameSettings.twist === 'edge') {
          const edgeNpcs = get().edgeIds.filter(id => id !== PLAYER_ID);
          if (edgeNpcs.length > 0) {
            const participants = edgeNpcs
              .map(id => get().castaways.find(c => c.id === id))
              .filter((c): c is Castaway => !!c)
              .map(c => makeParticipant(c, 'mixed', false));
            const result = simulateHeadlessChallenge(participants, hashSeed(gameSeed, `edge-reentry-merge-d${day}`));
            get().resolveReentry(result.winnerId);
            const name = get().castaways.find(c => c.id === result.winnerId)?.name ?? 'Someone';
            get().addFeedEntry({
              id: `edge-return-day${day}`,
              day,
              phase,
              text: `${name} wins their way back from the Edge of Extinction!`,
              type: 'merge',
            });
          }
        }

        const alive = get().castaways.filter(
          c => !c.eliminated && !c.onRedemptionIsland && !get().edgeIds.includes(c.id)
        ).length;
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
          relationships: {},
          alliances: [],
          sharedPlans: {},
          intel: [],
          edgeIds: [],
          edgeState: {},
          edgeReturnsDone: 0,
        });
      },
    }),
    {
      name: 'marooned-game-v2',
      version: SAVE_VERSION,
      migrate: (persisted, version) => (version === SAVE_VERSION ? (persisted as GameStore) : (undefined as unknown as GameStore)),
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
