import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { usePhase } from '../hooks/usePhase';
import { useAudio } from '../hooks/useAudio';
import { useHaptics } from '../hooks/useHaptics';
import { PLAYER_ID } from '../utils/voteSimulator';
import { gameRng, hashSeed } from '../engine/rng';
import { challengeSkill } from '../engine/challengeEngine';
import { pickChallenge } from '../data/challenges';
import { REWARDS, applyRewardEffect } from '../data/rewards';
import type { ChallengeParticipant, MinigameResult } from '../minigames/types';
import ChallengeHost from '../minigames/ChallengeHost';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';
import { useTheme } from '../contexts/ThemeContext';

type Props = StackScreenProps<GameParamList, 'Reward'>;

export default function RewardScreen({ navigation }: Props) {
  const [won, setWon] = useState<boolean | null>(null);
  const [rewardNote, setRewardNote] = useState('');

  const store = useGameStore(
    useShallow(s => ({
      day: s.day, difficulty: s.difficulty, castaways: s.castaways,
      playerTribeId: s.playerTribeId, tribes: s.tribes, edgeIds: s.edgeIds,
      gameMode: s.gameMode, gameSeed: s.gameSeed, phase: s.phase,
      addFeedEntry: s.addFeedEntry,
    }))
  );
  const { day, difficulty, castaways, playerTribeId, tribes, edgeIds, gameMode, gameSeed, phase, addFeedEntry } = store;
  const { advance } = usePhase();
  const { playSfx } = useAudio();
  const hap = useHaptics();
  const theme = useTheme();

  const isTribeMode = gameMode === 'pre-merge';
  const def = useMemo(() => pickChallenge(gameRng(gameSeed, `rwd-pick-d${day}`)), [gameSeed, day]);
  const seed = useMemo(() => hashSeed(gameSeed, `rwd-d${day}`), [gameSeed, day]);
  const reward = useMemo(() => REWARDS[Math.floor(gameRng(gameSeed, `rwd-type-d${day}`)() * REWARDS.length)], [gameSeed, day]);

  const alive = useMemo(
    () => castaways.filter(c => !c.eliminated && !c.onRedemptionIsland && !edgeIds.includes(c.id)),
    [castaways, edgeIds]
  );
  const tribeIdByPid = useMemo(() => new Map<number, string>(), []);

  const participants = useMemo<ChallengeParticipant[]>(() => {
    if (isTribeMode) {
      tribeIdByPid.clear();
      const active = tribes.filter(t => !t.id.includes('merge'));
      return active.map((t, i) => {
        const members = alive.filter(c => c.tribeId === t.id);
        const mean = members.length ? members.reduce((s, c) => s + challengeSkill(c, def.kind), 0) / members.length : 0.4;
        const isPlayerTribe = t.id === playerTribeId;
        const pid = isPlayerTribe ? PLAYER_ID : -(i + 1);
        tribeIdByPid.set(pid, t.id);
        return { id: pid, name: t.name, color: t.color, isPlayer: isPlayerTribe, skill: mean };
      });
    }
    return alive.map(c => ({
      id: c.id, name: c.id === PLAYER_ID ? 'You' : c.name, color: c.color,
      isPlayer: c.id === PLAYER_ID, skill: challengeSkill(c, def.kind),
    }));
  }, [isTribeMode, tribes, alive, playerTribeId, def.kind, tribeIdByPid]);

  const handleComplete = useCallback((result: MinigameResult) => {
    const playerWon = isTribeMode
      ? (tribeIdByPid.get(result.winnerId) ?? playerTribeId) === playerTribeId
      : result.winnerId === PLAYER_ID;
    if (playerWon) { hap.success(); playSfx('win'); } else { hap.warning(); playSfx('lose'); }
    setWon(playerWon);

    // Resolve which castaways are on the winning side.
    const winTribeId = isTribeMode ? tribeIdByPid.get(result.winnerId) : undefined;
    const winnerMemberIds = isTribeMode
      ? alive.filter(c => c.tribeId === winTribeId).map(c => c.id)
      : [result.winnerId];

    // Winning side gets the reward's mechanical effect.
    const note = applyRewardEffect(reward, {
      playerWon, winnerMemberIds, store: useGameStore.getState(),
    });
    setRewardNote(note);

    const winLabel = isTribeMode
      ? (tribes.find(t => t.id === winTribeId)?.name ?? 'A tribe')
      : (result.winnerId === PLAYER_ID ? 'You' : (castaways.find(c => c.id === result.winnerId)?.name ?? 'Someone'));
    addFeedEntry({
      id: `reward-day${day}`, day, phase,
      text: `${winLabel} won the reward challenge (${reward.name}).`,
      type: 'system',
    });
  }, [isTribeMode, tribes, playerTribeId, castaways, alive, reward, day, phase, addFeedEntry, hap, playSfx, tribeIdByPid]);

  function handleContinue() {
    advance();
    navigation.goBack();
  }

  if (won === null) {
    if (def.fullScreen) {
      return <ChallengeHost def={def} participants={participants} difficulty={difficulty} seed={seed} onComplete={handleComplete} />;
    }
    return (
      <View style={[styles.playRoot, { backgroundColor: theme.screenBg }]}>
        <Text style={styles.eyebrow}>REWARD CHALLENGE</Text>
        <Text style={styles.type}>{def.displayName}</Text>
        <Text style={styles.prize}>Reward: {reward.name}</Text>
        <ChallengeHost def={def} participants={participants} difficulty={difficulty} seed={seed} onComplete={handleComplete} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.root, { backgroundColor: theme.screenBg }]} bounces={false}>
      <Text style={styles.eyebrow}>REWARD CHALLENGE</Text>
      <Text style={styles.type}>{def.displayName}</Text>
      <Text style={styles.prize}>Reward: {reward.name}</Text>

      <View style={[styles.result, { borderColor: won ? C.palm : C.coral }]}>
        <Text style={styles.resultIcon}>{won ? '🏆' : '💀'}</Text>
        <Text style={[styles.resultTitle, { color: won ? C.palm : C.coral }]}>
          {won ? (isTribeMode ? 'YOUR TRIBE WINS' : 'YOU WIN THE REWARD') : (isTribeMode ? 'YOUR TRIBE LOSES' : 'NO REWARD FOR YOU')}
        </Text>
        {rewardNote !== '' && <Text style={styles.resultReward}>{rewardNote}</Text>}
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleContinue}>
        <Text style={styles.btnLabel}>CONTINUE TO DAY PHASE</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:         { flexGrow: 1, backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center', padding: 24, paddingTop: 56 },
  playRoot:     { flex: 1, backgroundColor: C.sand, alignItems: 'center', paddingTop: 60, paddingHorizontal: 16 },
  eyebrow:      { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 6 },
  type:         { fontSize: 26, fontFamily: F.display, fontWeight: '800', color: C.ink, letterSpacing: -0.5, textAlign: 'center', marginBottom: 4 },
  prize:        { fontSize: 12, fontFamily: F.mono, color: C.inkMid, letterSpacing: 1, marginBottom: 20 },
  result:       { width: '100%', borderWidth: 2, borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20 },
  resultIcon:   { fontSize: 36, marginBottom: 8 },
  resultTitle:  { fontSize: 16, fontFamily: F.body, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  resultReward: { fontSize: 13, fontFamily: F.body, color: C.inkMid, textAlign: 'center', lineHeight: 19 },
  btn:          { width: '100%', backgroundColor: C.ink, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnLabel:     { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
});
