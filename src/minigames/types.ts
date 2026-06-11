// Shared contract for all minigames. A game receives the participants (the player
// plus AI opponents, each with a precomputed `skill`), runs its mechanic, and
// reports a full ranking so challenge outcomes feed the simulation fairly.

export type Difficulty = 'easy' | 'medium' | 'hard';
export type ChallengeKind = 'strength' | 'mental' | 'endurance' | 'mixed';

export interface ChallengeParticipant {
  id: number;        // 0 = player
  name: string;
  color: string;
  isPlayer: boolean;
  skill: number;     // 0..1, derived from stats + personality + energy
}

export interface ParticipantResult {
  id: number;
  score: number;          // 0..1, higher is better
  finished: boolean;
  timeMs: number | null;  // lower is better, when applicable
}

export interface MinigameResult {
  rankings: ParticipantResult[]; // sorted best → worst
  winnerId: number;
}

export interface MinigameProps {
  difficulty: Difficulty;
  participants: ChallengeParticipant[];
  mode: 'compete' | 'spectate';
  seed: number;
  onComplete: (r: MinigameResult) => void;
}
