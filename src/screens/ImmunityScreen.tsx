import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { usePhase } from '../hooks/usePhase';
import { useAudio } from '../hooks/useAudio';
import { useHaptics } from '../hooks/useHaptics';
import { seeded } from '../utils/seeded';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';
import { useTheme } from '../contexts/ThemeContext';
import TapGame from '../minigames/TapGame';
import MemoryGame from '../minigames/MemoryGame';
import HoldGame from '../minigames/HoldGame';
import FireGame from '../minigames/FireGame';

type Props = StackScreenProps<GameParamList, 'Immunity'>;

const CHALLENGE_TYPES = ['ENDURANCE HOLD', 'BALANCE MAZE', 'MEMORY SEQUENCE', 'FIRE-MAKING', 'PUZZLE ASSEMBLY'];

function pickMiniGame(challengeType: string): 'tap' | 'memory' | 'hold' | 'fire' {
  const t = challengeType.toUpperCase();
  if (t.includes('FIRE'))                          return 'fire';
  if (t.includes('ENDUR') || t.includes('HOLD'))  return 'hold';
  if (t.includes('MEMORY') || t.includes('MAZE')) return 'memory';
  return 'tap';
}

export default function ImmunityScreen({ navigation }: Props) {
  const [playerImmune, setPlayerImmune] = useState<boolean | null>(null);
  const [winnerName, setWinnerName] = useState<string>('');

  const {
    day, difficulty, castaways, playerTribeId, tribes,
    gameMode, addFeedEntry, phase, setImmunityWinner,
  } = useGameStore(
    useShallow(s => ({
      day:               s.day,
      difficulty:        s.difficulty,
      castaways:         s.castaways,
      playerTribeId:     s.playerTribeId,
      tribes:            s.tribes,
      gameMode:          s.gameMode,
      addFeedEntry:      s.addFeedEntry,
      phase:             s.phase,
      setImmunityWinner: s.setImmunityWinner,
    }))
  );
  const { advance } = usePhase();
  const { playSfx } = useAudio();
  const hap = useHaptics();
  const theme = useTheme();

  const rng = seeded(day * 5555 + 42);
  const challengeType = CHALLENGE_TYPES[Math.floor(rng() * CHALLENGE_TYPES.length)];
  const miniGame = pickMiniGame(challengeType);
  const isTribeMode = gameMode === 'pre-merge';

  const handleResult = useCallback((playerWon: boolean) => {
    if (playerWon) { hap.success(); playSfx('win'); }
    else           { hap.warning(); playSfx('lose'); }

    if (isTribeMode) {
      const playerTribe = tribes.find(t => t.id === playerTribeId);
      const nonPlayerTribes = tribes.filter(t => t.id !== playerTribeId && !t.id.includes('merge'));
      const rngTribe = seeded(day * 7777 + 55);
      const otherWinner = nonPlayerTribes[Math.floor(rngTribe() * nonPlayerTribes.length)];
      const winTribe = playerWon ? playerTribe : otherWinner;
      setPlayerImmune(playerWon);
      setWinnerName(winTribe?.name ?? '');
      setImmunityWinner(playerWon ? 0 : 1, winTribe?.id);
      addFeedEntry({
        id:   `immunity-day${day}`,
        day,
        phase,
        text: `${winTribe?.name ?? 'A tribe'} wins immunity. They are safe from tonight's vote.`,
        type: 'system',
      });
    } else {
      setPlayerImmune(playerWon);
      if (playerWon) {
        setWinnerName('YOU');
        setImmunityWinner(0);
        addFeedEntry({ id: `immunity-day${day}`, day, phase, text: 'You won individual immunity!', type: 'advantage' });
      } else {
        const alive = castaways.filter(c => !c.eliminated && !c.onRedemptionIsland);
        const rngNpc = seeded(day * 8888 + 23);
        const winner = alive[Math.floor(rngNpc() * alive.length)];
        setWinnerName(winner?.name ?? '');
        setImmunityWinner(winner?.id ?? null);
        addFeedEntry({ id: `immunity-day${day}`, day, phase, text: `${winner?.name ?? 'Someone'} wins individual immunity.`, type: 'system' });
      }
    }
  }, [isTribeMode, tribes, playerTribeId, castaways, day, phase, addFeedEntry, setImmunityWinner, hap, playSfx]);

  function handleContinue() {
    advance();
    navigation.goBack();
  }

  // FireGame needs full screen — bypass the ScrollView wrapper while it's active
  if (miniGame === 'fire' && playerImmune === null) {
    return <FireGame difficulty={difficulty} onResult={handleResult} />;
  }

  return (
    <ScrollView contentContainerStyle={[styles.root, { backgroundColor: theme.screenBg }]} bounces={false}>
      <Text style={styles.eyebrow}>IMMUNITY CHALLENGE</Text>
      <Text style={styles.type}>{challengeType}</Text>

      {playerImmune === null && (
        <>
          {miniGame === 'tap'    && <TapGame    difficulty={difficulty} onResult={handleResult} />}
          {miniGame === 'memory' && <MemoryGame difficulty={difficulty} onResult={handleResult} />}
          {miniGame === 'hold'   && <HoldGame   difficulty={difficulty} onResult={handleResult} />}
        </>
      )}

      {playerImmune !== null && (
        <View style={[styles.result, { borderColor: playerImmune ? C.palm : C.coral }]}>
          <Text style={styles.resultIcon}>{playerImmune ? '🛡️' : '⚔️'}</Text>
          <Text style={[styles.resultTitle, { color: playerImmune ? C.palm : C.coral }]}>
            {playerImmune
              ? isTribeMode ? 'YOUR TRIBE IS SAFE' : 'YOU WIN IMMUNITY'
              : isTribeMode ? 'YOUR TRIBE GOES TO TRIBAL' : 'YOU ARE VULNERABLE'}
          </Text>
          {!playerImmune && winnerName && (
            <Text style={styles.resultSub}>{winnerName} wins immunity.</Text>
          )}
        </View>
      )}

      {playerImmune !== null && (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: playerImmune ? C.palm : C.coral }]}
          onPress={handleContinue}
        >
          <Text style={styles.btnLabel}>
            {playerImmune ? 'PROCEED · NO TRIBAL TONIGHT' : 'PROCEED TO TRIBAL COUNCIL'}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:        { flexGrow: 1, backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center', padding: 32 },
  eyebrow:     { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 6 },
  type:        { fontSize: 28, fontFamily: F.display, fontWeight: '800', color: C.ink, letterSpacing: -0.5, textAlign: 'center', marginBottom: 24 },
  result:      { width: '100%', borderWidth: 2, borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20 },
  resultIcon:  { fontSize: 36, marginBottom: 8 },
  resultTitle: { fontSize: 15, fontFamily: F.body, fontWeight: '800', letterSpacing: 1, textAlign: 'center', marginBottom: 4 },
  resultSub:   { fontSize: 13, fontFamily: F.body, color: C.inkMid },
  btn:         { width: '100%', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnLabel:    { fontSize: 12, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
});
