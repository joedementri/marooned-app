import { useCallback, useMemo, useRef } from 'react';
import type { MinigameProps, ChallengeParticipant } from './types';
import { composeChallengeResult } from '../engine/challengeEngine';

// Shared plumbing for a minigame: splits player vs AI participants and exposes a
// single `finish` that composes the deterministic ranking and reports it once.
export function useChallengeBout(props: MinigameProps) {
  const { participants, seed, mode, onComplete } = props;

  const player = useMemo(() => participants.find(p => p.isPlayer) ?? null, [participants]);
  const ai = useMemo<ChallengeParticipant[]>(() => participants.filter(p => !p.isPlayer), [participants]);

  const doneRef = useRef(false);

  const finish = useCallback(
    (playerOutcome?: { score: number; timeMs: number | null }) => {
      if (doneRef.current) return;
      doneRef.current = true;
      const result = composeChallengeResult(participants, seed, playerOutcome);
      onComplete(result);
    },
    [participants, seed, onComplete],
  );

  return { player, ai, mode, seed, finish };
}
