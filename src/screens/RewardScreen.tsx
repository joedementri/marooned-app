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
import TapGame from '../minigames/TapGame';

type Props = StackScreenProps<GameParamList, 'Reward'>;

const CHALLENGE_TYPES = ['PUZZLE RACE', 'OBSTACLE COURSE', 'WATER CARRY', 'BALANCE BEAM', 'FIRE MAKING'];
const REWARDS = ['FOOD & COMFORT', 'FISHING GEAR', 'CAMP SUPPLIES', 'COFFEE & PASTRIES', 'LETTERS FROM HOME'];

export default function RewardScreen({ navigation }: Props) {
  const [won, setWon] = useState<boolean | null>(null);

  const { day, difficulty, playerTribeId, tribes, addFeedEntry, phase } = useGameStore(
    useShallow(s => ({
      day:           s.day,
      difficulty:    s.difficulty,
      playerTribeId: s.playerTribeId,
      tribes:        s.tribes,
      addFeedEntry:  s.addFeedEntry,
      phase:         s.phase,
    }))
  );
  const { advance } = usePhase();
  const { playSfx } = useAudio();
  const hap = useHaptics();

  const rng = seeded(day * 3131 + 7);
  const challengeType = CHALLENGE_TYPES[Math.floor(rng() * CHALLENGE_TYPES.length)];
  const reward = REWARDS[Math.floor(rng() * REWARDS.length)];
  const playerTribe = tribes.find(t => t.id === playerTribeId);
  const otherTribe  = tribes.find(t => t.id !== playerTribeId);

  const handleResult = useCallback((playerWon: boolean) => {
    if (playerWon) { hap.success(); playSfx('win'); }
    else           { hap.warning(); playSfx('lose'); }
    setWon(playerWon);
    addFeedEntry({
      id:   `reward-day${day}`,
      day,
      phase,
      text: playerWon
        ? `${playerTribe?.name ?? 'Your tribe'} won the reward challenge and claimed ${reward}.`
        : `${otherTribe?.name ?? 'The other tribe'} won the reward challenge.`,
      type: 'system',
    });
  }, [day, phase, playerTribe, otherTribe, reward, addFeedEntry, hap, playSfx]);

  function handleContinue() {
    advance();
    navigation.goBack();
  }

  return (
    <ScrollView contentContainerStyle={styles.root} bounces={false}>
      <Text style={styles.eyebrow}>REWARD CHALLENGE</Text>
      <Text style={styles.type}>{challengeType}</Text>

      {won === null && (
        <TapGame difficulty={difficulty} onResult={handleResult} />
      )}

      {won !== null && (
        <View style={[styles.result, { borderColor: won ? C.palm : C.coral }]}>
          <Text style={styles.resultIcon}>{won ? '🏆' : '💀'}</Text>
          <Text style={[styles.resultTitle, { color: won ? C.palm : C.coral }]}>
            {won ? 'YOUR TRIBE WINS' : 'YOUR TRIBE LOSES'}
          </Text>
          {won && (
            <Text style={styles.resultReward}>Reward: {reward}</Text>
          )}
          {!won && (
            <Text style={styles.resultReward}>
              {otherTribe?.name ?? 'The other tribe'} takes the reward.
            </Text>
          )}
        </View>
      )}

      {won !== null && (
        <TouchableOpacity style={styles.btn} onPress={handleContinue}>
          <Text style={styles.btnLabel}>CONTINUE TO DAY PHASE</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:         { flexGrow: 1, backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center', padding: 32 },
  eyebrow:      { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 6 },
  type:         { fontSize: 28, fontFamily: F.display, fontWeight: '800', color: C.ink, letterSpacing: -0.5, textAlign: 'center', marginBottom: 24 },
  result:       { width: '100%', borderWidth: 2, borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20 },
  resultIcon:   { fontSize: 36, marginBottom: 8 },
  resultTitle:  { fontSize: 16, fontFamily: F.body, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  resultReward: { fontSize: 13, fontFamily: F.body, color: C.inkMid, textAlign: 'center' },
  btn:          { width: '100%', backgroundColor: C.ink, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnLabel:     { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
});
