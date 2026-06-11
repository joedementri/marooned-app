import type { StateCreator } from 'zustand';
import type { GameStore } from '../gameStore';
import { simulateVotes, PLAYER_ID } from '../../utils/voteSimulator';
import { resolveTribal } from '../../utils/advantageResolver';

export type DayPhase = 'morning' | 'redemption' | 'reward' | 'day' | 'immunity' | 'evening' | 'tribal' | 'sleep';
export type GameMode = 'pre-merge' | 'post-merge' | 'final-tribal' | 'ended';

const PHASE_ORDER: DayPhase[] = ['morning', 'redemption', 'reward', 'day', 'immunity', 'evening', 'tribal', 'sleep'];

export interface PhaseSlice {
  day: number;
  phase: DayPhase;
  gameMode: GameMode;
  immunityWinnerId: number | null;
  playerTribeImmune: boolean;
  immuneTribeId: string | null;
  advancePhase(): void;
  setImmunityWinner(id: number | null, winnerTribeId?: string): void;
  setGameMode(mode: GameMode): void;
  incrementDay(): void;
}

export const createPhaseSlice: StateCreator<GameStore, [], [], PhaseSlice> = (set, get) => ({
  day: 1,
  phase: 'morning',
  gameMode: 'pre-merge',
  immunityWinnerId: null,
  playerTribeImmune: false,
  immuneTribeId: null,

  advancePhase() {
    const { phase, playerTribeImmune, gameMode, gameSettings, riQueue } = get();
    const idx = PHASE_ORDER.indexOf(phase);
    if (idx === -1 || idx === PHASE_ORDER.length - 1) return;
    let next = PHASE_ORDER[idx + 1];

    // Skip redemption phase if RI not active or not enough duelers
    if (next === 'redemption') {
      if (!gameSettings.redemptionIsland || riQueue.length < 2) {
        next = PHASE_ORDER[idx + 2] ?? 'sleep';
      }
    }

    // Pre-merge: skip tribal if player's tribe is immune — simulate all losing tribes
    if (next === 'tribal' && gameMode === 'pre-merge' && playerTribeImmune) {
      const { castaways, day, tribes, immuneTribeId, addFeedEntry, eliminateCastaway } = get();

      const losingTribes = tribes.filter(t =>
        t.id !== immuneTribeId && !t.id.includes('merge')
      );

      for (const losingTribe of losingTribes) {
        const tribeMembers = castaways.filter(c => !c.eliminated && c.tribeId === losingTribe.id);
        if (tribeMembers.length >= 3) {
          const rawVotes = simulateVotes({
            voters: tribeMembers,
            targets: tribeMembers,
            playerIsTarget: false,
            playerVote: 0,
            day,
          });
          delete rawVotes[PLAYER_ID];
          const result = resolveTribal(rawVotes, [], castaways, tribeMembers.length, day);
          if (result.eliminatedId !== PLAYER_ID && result.eliminatedId !== -1) {
            const voterIds = Object.entries(rawVotes)
              .filter(([k]) => Number(k) === result.eliminatedId)
              .flatMap(([, v]) => v);
            eliminateCastaway(result.eliminatedId, day, voterIds);
            const bootedName = castaways.find(c => c.id === result.eliminatedId)?.name ?? 'Someone';
            addFeedEntry({
              id: `opp-tribal-${losingTribe.id}-day${day}`,
              day,
              phase,
              text: `${losingTribe.name}: ${bootedName} was voted out on Day ${day}.`,
              type: 'tribal',
            });
          }
        }
      }
      next = 'sleep';
    }

    set({ phase: next });
  },

  setImmunityWinner(id, winnerTribeId) {
    const { gameMode, playerTribeId } = get();
    const playerTribeImmune =
      gameMode === 'pre-merge' && winnerTribeId != null && winnerTribeId === playerTribeId;
    set({
      immunityWinnerId: id,
      playerTribeImmune,
      immuneTribeId: winnerTribeId ?? null,
    });
  },

  setGameMode(mode) {
    set({ gameMode: mode });
  },

  incrementDay() {
    set(state => ({
      day: state.day + 1,
      phase: 'morning',
      immunityWinnerId: null,
      playerTribeImmune: false,
      immuneTribeId: null,
    }));
    get().resetDailySearches();
  },
});
