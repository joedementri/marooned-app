import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useGameStore } from '../store/gameStore';
import type { DayPhase } from '../store/slices/phaseSlice';
import type { GameParamList } from '../navigation/types';

type GameNav = StackNavigationProp<GameParamList>;

const PHASE_SCREEN_MAP: Partial<Record<DayPhase, keyof GameParamList>> = {
  redemption: 'RedemptionIsland',
  reward:     'Reward',
  immunity:   'Immunity',
  tribal:     'Council',
};

function nextPhaseAfter(
  current: DayPhase,
  gameMode: string,
  playerTribeImmune: boolean,
  riActive: boolean,
  riQueueLength: number,
): DayPhase | null {
  const order: DayPhase[] = ['morning', 'redemption', 'reward', 'day', 'immunity', 'evening', 'tribal', 'sleep'];
  const idx = order.indexOf(current);
  if (idx === -1 || idx === order.length - 1) return null;
  let next = order[idx + 1];
  if (next === 'redemption' && (!riActive || riQueueLength < 2)) {
    next = order[idx + 2] ?? 'sleep';
  }
  if (next === 'tribal' && gameMode === 'pre-merge' && playerTribeImmune) next = 'sleep';
  return next;
}

export function usePhase() {
  const navigation = useNavigation<GameNav>();
  const {
    phase, day, gameMode, playerTribeImmune, riQueue, gameSettings,
    advancePhase, incrementDay,
  } = useGameStore(
    useShallow(s => ({
      phase:             s.phase,
      day:               s.day,
      gameMode:          s.gameMode,
      playerTribeImmune: s.playerTribeImmune,
      riQueue:           s.riQueue,
      gameSettings:      s.gameSettings,
      advancePhase:      s.advancePhase,
      incrementDay:      s.incrementDay,
    }))
  );

  const advance = useCallback(() => {
    if (phase === 'sleep') {
      incrementDay();
      return;
    }

    const arriving = nextPhaseAfter(
      phase,
      gameMode,
      playerTribeImmune,
      gameSettings.twist === 'redemption',
      riQueue.length,
    );
    advancePhase();

    if (!arriving) return;

    if (arriving === 'tribal') {
      if (gameMode === 'final-tribal') {
        navigation.navigate('FinalTribal');
      } else {
        navigation.navigate('Council');
      }
      return;
    }

    const screen = PHASE_SCREEN_MAP[arriving];
    if (screen) navigation.navigate(screen as any);
  }, [phase, gameMode, playerTribeImmune, gameSettings, riQueue, advancePhase, incrementDay, navigation]);

  return { phase, day, gameMode, advance };
}
