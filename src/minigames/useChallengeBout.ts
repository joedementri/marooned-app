import { useCallback, useMemo, useRef } from 'react';
import type { MinigameProps, ChallengeParticipant, ParticipantResult } from './types';
import { composeChallengeResult, type AiOutcome } from '../engine/challengeEngine';

// Shared plumbing for a minigame: splits player vs AI participants and exposes a
// single `finish` that composes the deterministic ranking and reports it once.
// Games that simulate their own AI pass `aiOutcomes`; games that own the full
// ranking outright (eliminations, point totals) use `finishRanked`.
export function useChallengeBout(props: MinigameProps) {
  const { participants, seed, mode, onComplete } = props;

  const player = useMemo(() => participants.find(p => p.isPlayer) ?? null, [participants]);
  const ai = useMemo<ChallengeParticipant[]>(() => participants.filter(p => !p.isPlayer), [participants]);

  const doneRef = useRef(false);

  const finish = useCallback(
    (playerOutcome?: { score: number; timeMs: number | null }, aiOutcomes?: AiOutcome[]) => {
      if (doneRef.current) return;
      doneRef.current = true;
      const result = composeChallengeResult(participants, seed, playerOutcome, aiOutcomes);
      onComplete(result);
    },
    [participants, seed, onComplete],
  );

  const finishRanked = useCallback(
    (results: ParticipantResult[]) => {
      if (doneRef.current) return;
      doneRef.current = true;
      const rankings = [...results].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity);
      });
      onComplete({ rankings, winnerId: rankings[0]?.id ?? -1 });
    },
    [onComplete],
  );

  return { player, ai, mode, seed, finish, finishRanked };
}
