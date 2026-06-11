import React from 'react';
import type { ChallengeDef } from '../data/challenges';
import type { ChallengeParticipant, MinigameResult } from './types';
import type { Difficulty } from './types';

interface Props {
  def: ChallengeDef;
  participants: ChallengeParticipant[];
  difficulty: Difficulty;
  seed: number;
  mode?: 'compete' | 'spectate';
  onComplete: (r: MinigameResult) => void;
}

// Thin wrapper that renders the right minigame component for a ChallengeDef with
// the unified MinigameProps contract.
export default function ChallengeHost({ def, participants, difficulty, seed, mode = 'compete', onComplete }: Props) {
  const Comp = def.component;
  return (
    <Comp
      difficulty={difficulty}
      participants={participants}
      mode={mode}
      seed={seed}
      onComplete={onComplete}
    />
  );
}
