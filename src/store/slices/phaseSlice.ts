import type { StateCreator } from 'zustand';
import type { GameStore } from '../gameStore';
import { PLAYER_ID, tallyVotes, breakTie } from '../../utils/voteSimulator';
import { resolveTribal } from '../../utils/advantageResolver';
import { simulateTribalVotes } from '../../engine/voteEngine';
import { seeded } from '../../utils/seeded';

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
          const result = resolveTribal(ctx.votes, ctx.npcPlays, castaways, tribeMembers.length, day, { breakTies: false });

          // Mirror the on-screen tie rules off-screen: one silent revote
          // among the non-tied voters, then rocks.
          let eliminatedId = result.eliminatedId;
          let finalVotes = ctx.votes;
          if (result.tieIds && result.tieIds.length > 1) {
            const tieIds = result.tieIds;
            const rctx = simulateTribalVotes({
              voters: tribeMembers.filter(c => !tieIds.includes(c.id)),
              eligibleTargets: tieIds,
              playerVote: null,
              relationships,
              alliances,
              castaways,
              day,
              gameSeed,
              scopeTag: `revote-${losingTribe.id}`,
            });
            const tally = tallyVotes(rctx.votes);
            const rng = seeded(day * 7_773);
            const castMap = new Map(castaways.map(c => [c.id, c]));
            if (tally.length === 0) {
              eliminatedId = breakTie(tieIds, castMap, rng);
            } else {
              const top = tally[0].count;
              const tops = tally.filter(t => t.count === top).map(t => t.id);
              eliminatedId = tops.length === 1 ? tops[0] : breakTie(tops, castMap, rng);
              finalVotes = rctx.votes;
            }
          }

          if (eliminatedId !== PLAYER_ID && eliminatedId !== -1) {
            const voterIds = Object.entries(finalVotes)
              .filter(([k]) => Number(k) === eliminatedId)
              .flatMap(([, v]) => v);
            eliminateCastaway(eliminatedId, day, voterIds);
            applyTribalAftermathToStore(finalVotes, eliminatedId);
            const bootedName = castaways.find(c => c.id === eliminatedId)?.name ?? 'Someone';
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
    get().clearSharedPlans();
  },
});
