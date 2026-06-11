import type { StateCreator } from 'zustand';
import type { GameStore } from '../gameStore';
import { PLAYER_ID } from '../../utils/voteSimulator';
import { resolveTribal } from '../../utils/advantageResolver';
import { simulateTribalVotes } from '../../engine/voteEngine';

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
      const riActive = gameSettings.twist === 'redemption' && riQueue.length >= 2;
      if (!riActive) {
        next = PHASE_ORDER[idx + 2] ?? 'sleep';
      }
    }

    // Pre-merge: skip tribal if player's tribe is immune — simulate all losing tribes
    if (next === 'tribal' && gameMode === 'pre-merge' && playerTribeImmune) {
      const {
        castaways, day, tribes, immuneTribeId, gameSeed, relationships, alliances,
        addFeedEntry, eliminateCastaway, removeCastawayAdvantage, applyTribalAftermathToStore,
      } = get();

      const losingTribes = tribes.filter(t =>
        t.id !== immuneTribeId && !t.id.includes('merge')
      );

      for (const losingTribe of losingTribes) {
        const tribeMembers = castaways.filter(c => !c.eliminated && c.tribeId === losingTribe.id);
        if (tribeMembers.length >= 3) {
          const ctx = simulateTribalVotes({
            voters: tribeMembers,
            eligibleTargets: tribeMembers.map(c => c.id),
            playerVote: null,
            relationships,
            alliances,
            castaways,
            day,
            gameSeed,
            scopeTag: losingTribe.id,
          });
          ctx.consumed.forEach(c => removeCastawayAdvantage(c.holderId, c.type));
          const result = resolveTribal(ctx.votes, ctx.npcPlays, castaways, tribeMembers.length, day);
          if (result.eliminatedId !== PLAYER_ID && result.eliminatedId !== -1) {
            const voterIds = Object.entries(ctx.votes)
              .filter(([k]) => Number(k) === result.eliminatedId)
              .flatMap(([, v]) => v);
            eliminateCastaway(result.eliminatedId, day, voterIds);
            applyTribalAftermathToStore(ctx.votes, result.eliminatedId);
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
    // Run NPC-society simulation for the phase we just entered.
    get().runSimForTransition(next);
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
    // Night simulation runs for the day that's ending (grudge decay, energy regen,
    // Edge dwellers' day) before we roll over.
    get().runNightSim();
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
