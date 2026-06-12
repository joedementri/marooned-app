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
import type { ChallengeParticipant, MinigameResult } from '../minigames/types';
import ChallengeHost from '../minigames/ChallengeHost';
import ConfettiBurst from '../components/game/ConfettiBurst';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';
import { useTheme } from '../contexts/ThemeContext';

type Props = StackScreenProps<GameParamList, 'Immunity'>;

export default function ImmunityScreen({ navigation }: Props) {
  const [playerImmune, setPlayerImmune] = useState<boolean | null>(null);
  const [winnerName, setWinnerName] = useState<string>('');

  const {
    day, difficulty, castaways, playerTribeId, tribes, edgeIds,
    gameMode, gameSeed, addFeedEntry, phase, setImmunityWinner, incrementImmunityWins,
  } = useGameStore(
    useShallow(s => ({
      day:               s.day,
      difficulty:        s.difficulty,
      castaways:         s.castaways,
      playerTribeId:     s.playerTribeId,
      tribes:            s.tribes,
      edgeIds:           s.edgeIds,
      gameMode:          s.gameMode,
      gameSeed:          s.gameSeed,
      addFeedEntry:      s.addFeedEntry,
      phase:             s.phase,
      setImmunityWinner: s.setImmunityWinner,
      incrementImmunityWins: s.incrementImmunityWins,
    }))
  );
  const { advance } = usePhase();
  const { playSfx } = useAudio();
  const hap = useHaptics();
  const theme = useTheme();

  const isTribeMode = gameMode === 'pre-merge';
  const def = useMemo(() => pickChallenge(gameRng(gameSeed, `imm-pick-d${day}`)), [gameSeed, day]);
  const seed = useMemo(() => hashSeed(gameSeed, `imm-d${day}`), [gameSeed, day]);

  const alive = useMemo(
    () => castaways.filter(c => !c.eliminated && !c.onRedemptionIsland && !edgeIds.includes(c.id)),
    [castaways, edgeIds]
  );

  // Map a tribe avatar's participant id back to its tribe.
  const tribeIdByPid = useMemo(() => new Map<number, string>(), []);

  const participants = useMemo<ChallengeParticipant[]>(() => {
    if (isTribeMode) {
      tribeIdByPid.clear();
      const active = tribes.filter(t => !t.id.includes('merge'));
      return active.map((t, i) => {
        const members = alive.filter(c => c.tribeId === t.id);
        const mean = members.length
          ? members.reduce((s, c) => s + challengeSkill(c, def.kind), 0) / members.length
          : 0.4;
        const isPlayerTribe = t.id === playerTribeId;
        const pid = isPlayerTribe ? PLAYER_ID : -(i + 1);
        tribeIdByPid.set(pid, t.id);
        return { id: pid, name: t.name, color: t.color, isPlayer: isPlayerTribe, skill: mean };
      });
    }
    return alive.map(c => ({
      id: c.id,
      name: c.id === PLAYER_ID ? 'You' : c.name,
      color: c.color,
      isPlayer: c.id === PLAYER_ID,
      skill: challengeSkill(c, def.kind),
    }));
  }, [isTribeMode, tribes, alive, playerTribeId, def.kind, tribeIdByPid]);

  const handleComplete = useCallback((result: MinigameResult) => {
    if (isTribeMode) {
      const winTribeId = tribeIdByPid.get(result.winnerId) ?? playerTribeId;
      const winTribe = tribes.find(t => t.id === winTribeId);
      const playerWon = winTribeId === playerTribeId;
      if (playerWon) { hap.success(); playSfx('win'); } else { hap.warning(); playSfx('lose'); }
      setPlayerImmune(playerWon);
      setWinnerName(winTribe?.name ?? '');
      setImmunityWinner(playerWon ? 0 : 1, winTribeId);
      addFeedEntry({
        id: `immunity-day${day}`, day, phase,
        text: `${winTribe?.name ?? 'A tribe'} wins immunity. They are safe from tonight's vote.`,
        type: 'system',
      });
    } else {
      const playerWon = result.winnerId === PLAYER_ID;
      if (playerWon) { hap.success(); playSfx('win'); } else { hap.warning(); playSfx('lose'); }
      setPlayerImmune(playerWon);
      setImmunityWinner(result.winnerId);
      if (playerWon) {
        incrementImmunityWins();
        setWinnerName('YOU');
        addFeedEntry({ id: `immunity-day${day}`, day, phase, text: 'You won individual immunity!', type: 'advantage' });
      } else {
        const w = castaways.find(c => c.id === result.winnerId);
        setWinnerName(w?.name ?? '');
        addFeedEntry({ id: `immunity-day${day}`, day, phase, text: `${w?.name ?? 'Someone'} wins individual immunity.`, type: 'system' });
      }
    }
  }, [isTribeMode, tribes, playerTribeId, castaways, day, phase, addFeedEntry, setImmunityWinner, incrementImmunityWins, hap, playSfx, tribeIdByPid]);

  function handleContinue() {
    advance();
    navigation.goBack();
  }

  // While the challenge is being played, render it outside a ScrollView so the
  // pan-based games don't fight the scroll gesture. Fire renders fully full-screen.
  if (playerImmune === null) {
    if (def.fullScreen) {
      return <ChallengeHost def={def} participants={participants} difficulty={difficulty} seed={seed} onComplete={handleComplete} />;
    }
    return (
      <View style={[styles.playRoot, { backgroundColor: theme.screenBg }]}>
        <Text style={styles.eyebrow}>{isTribeMode ? 'TRIBAL IMMUNITY' : 'INDIVIDUAL IMMUNITY'}</Text>
        <Text style={styles.type}>{def.displayName}</Text>
        <ChallengeHost def={def} participants={participants} difficulty={difficulty} seed={seed} onComplete={handleComplete} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.root, { backgroundColor: theme.screenBg }]} bounces={false}>
      {playerImmune && <ConfettiBurst />}
      <Text style={styles.eyebrow}>{isTribeMode ? 'TRIBAL IMMUNITY' : 'INDIVIDUAL IMMUNITY'}</Text>
      <Text style={styles.type}>{def.displayName}</Text>

      <View style={[styles.result, { borderColor: playerImmune ? C.palm : C.coral }]}>
        <Text style={styles.resultIcon}>{playerImmune ? '🛡️' : '⚔️'}</Text>
        <Text style={[styles.resultTitle, { color: playerImmune ? C.palm : C.coral }]}>
          {playerImmune
            ? isTribeMode ? 'YOUR TRIBE IS SAFE' : 'YOU WIN IMMUNITY'
            : isTribeMode ? 'YOUR TRIBE GOES TO TRIBAL' : 'YOU ARE VULNERABLE'}
        </Text>
        {!playerImmune && winnerName !== '' && (
          <Text style={styles.resultSub}>{winnerName} wins immunity.</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: playerImmune ? C.palm : C.coral }]}
        onPress={handleContinue}
      >
        <Text style={styles.btnLabel}>
          {playerImmune ? 'PROCEED · NO TRIBAL TONIGHT' : 'PROCEED TO TRIBAL COUNCIL'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:        { flexGrow: 1, backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center', padding: 24, paddingTop: 56 },
  playRoot:    { flex: 1, backgroundColor: C.sand, alignItems: 'center', paddingTop: 60, paddingHorizontal: 16 },
  eyebrow:     { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 6 },
  type:        { fontSize: 26, fontFamily: F.display, fontWeight: '800', color: C.ink, letterSpacing: -0.5, textAlign: 'center', marginBottom: 20 },
  result:      { width: '100%', borderWidth: 2, borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20 },
  resultIcon:  { fontSize: 36, marginBottom: 8 },
  resultTitle: { fontSize: 15, fontFamily: F.body, fontWeight: '800', letterSpacing: 1, textAlign: 'center', marginBottom: 4 },
  resultSub:   { fontSize: 13, fontFamily: F.body, color: C.inkMid },
  btn:         { width: '100%', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnLabel:    { fontSize: 12, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
});
