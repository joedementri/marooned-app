import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import type { Castaway } from '../data/roster';
import { PLAYER_ID } from '../utils/voteSimulator';
import { initials } from '../data/roster';
import { gameRng, hashSeed } from '../engine/rng';
import { challengeSkill } from '../engine/challengeEngine';
import { CHALLENGE_BY_KEY } from '../data/challenges';
import type { MinigameResult } from '../minigames/types';
import ChallengeHost from '../minigames/ChallengeHost';
import Portrait from '../components/atoms/Portrait';
import { usePhase } from '../hooks/usePhase';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

type Props = StackScreenProps<GameParamList, 'RedemptionIsland'>;
type Stage = 'intro' | 'duel' | 'result';

const DUEL_POOL = ['fire', 'hang', 'balance'];

export default function RedemptionIslandScreen({ navigation }: Props) {
  const [stage, setStage] = useState<Stage>('intro');
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [loserId, setLoserId] = useState<number | null>(null);

  const {
    castaways, riQueue, day, difficulty, gameSeed,
    addFeedEntry, permanentEliminate, setGameMode,
  } = useGameStore(
    useShallow(s => ({
      castaways:          s.castaways,
      riQueue:            s.riQueue,
      day:                s.day,
      difficulty:         s.difficulty,
      gameSeed:           s.gameSeed,
      addFeedEntry:       s.addFeedEntry,
      permanentEliminate: s.permanentEliminate,
      setGameMode:        s.setGameMode,
    }))
  );

  const { advance } = usePhase();

  const duelists = useMemo((): Castaway[] => {
    const ids = riQueue.slice(-2);
    return ids.map(id => castaways.find(c => c.id === id)).filter((c): c is Castaway => !!c);
  }, [riQueue, castaways]);

  const playerInDuel = duelists.some(c => c.id === PLAYER_ID);
  const duelDef = useMemo(() => {
    const key = DUEL_POOL[Math.floor(gameRng(gameSeed, `ri-pick-d${day}`)() * DUEL_POOL.length)];
    return CHALLENGE_BY_KEY[key];
  }, [gameSeed, day]);
  const duelSeed = useMemo(() => hashSeed(gameSeed, `ri-duel-d${day}`), [gameSeed, day]);

  function onDuelComplete(result: MinigameResult) {
    const winId = result.winnerId;
    const loseId = duelists.find(c => c.id !== winId)?.id ?? duelists[0]?.id ?? PLAYER_ID;
    resolveResult(winId, loseId);
  }

  function resolveResult(winId: number, loseId: number) {
    setWinnerId(winId);
    setLoserId(loseId);
    permanentEliminate(loseId, day, [winId]);

    const loserName = loseId === PLAYER_ID ? 'You' : (castaways.find(c => c.id === loseId)?.name ?? 'Someone');
    const winnerName = winId === PLAYER_ID ? 'You' : (castaways.find(c => c.id === winId)?.name ?? 'Someone');

    addFeedEntry({
      id: `ri-duel-day${day}`,
      day,
      phase: 'redemption',
      text: loseId === PLAYER_ID
        ? 'You lost the Redemption Island duel. Your torch is snuffed.'
        : `${loserName} lost the Redemption Island duel. ${winnerName} survives.`,
      type: 'tribal',
    });

    if (loseId === PLAYER_ID) setGameMode('ended');
    setStage('result');
  }

  function handleDone() {
    if (loserId === PLAYER_ID) {
      navigation.getParent()?.navigate('MainMenu');
      return;
    }
    advance();
    navigation.goBack();
  }

  const duelistA = duelists[0];
  const duelistB = duelists[1];

  // The duel itself is a minigame (player competes, or spectate for NPC vs NPC).
  if (stage === 'duel' && duelistA && duelistB) {
    const mk = (c: Castaway) => ({
      id: c.id,
      name: c.id === PLAYER_ID ? 'You' : c.name,
      color: c.id === PLAYER_ID ? '#3d5a7c' : c.color,
      isPlayer: c.id === PLAYER_ID,
      skill: challengeSkill(c, duelDef.kind),
    });
    const participants = [mk(duelistA), mk(duelistB)];
    const host = (
      <ChallengeHost
        def={duelDef}
        participants={participants}
        difficulty={difficulty}
        seed={duelSeed}
        mode={playerInDuel ? 'compete' : 'spectate'}
        onComplete={onDuelComplete}
      />
    );
    if (duelDef.fullScreen) return host;
    return (
      <View style={styles.playWrap}>
        <Text style={styles.eyebrow}>REDEMPTION ISLAND DUEL</Text>
        {host}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>REDEMPTION ISLAND · DAY {day}</Text>
        <Text style={styles.title}>{stage === 'intro' ? 'THE DUEL' : 'SNUFFED'}</Text>
      </View>

      {stage === 'intro' && duelistA && duelistB && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={styles.narrative}>
            Two survivors on Redemption Island must compete.{'\n'}
            The loser goes home for good. The winner lives to fight another day.
          </Text>
          <View style={styles.versusRow}>
            <View style={styles.duelistCard}>
              <Portrait color={duelistA.color} initials={initials(duelistA.name)} size={52} />
              <Text style={styles.duelistName}>{duelistA.id === PLAYER_ID ? 'YOU' : duelistA.name}</Text>
              <Text style={styles.duelistJob}>{duelistA.job || 'Survivor'}</Text>
            </View>
            <Text style={styles.vs}>VS</Text>
            <View style={styles.duelistCard}>
              <Portrait color={duelistB.color} initials={initials(duelistB.name)} size={52} />
              <Text style={styles.duelistName}>{duelistB.id === PLAYER_ID ? 'YOU' : duelistB.name}</Text>
              <Text style={styles.duelistJob}>{duelistB.job || 'Survivor'}</Text>
            </View>
          </View>
          <Text style={styles.duelType}>Duel: {duelDef.displayName}</Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => setStage('duel')}>
            <Text style={styles.ctaBtnLabel}>BEGIN THE DUEL</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {stage === 'result' && winnerId !== null && loserId !== null && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.resultBlock}>
            <Text style={styles.fireGlyph}>🔥</Text>
            {loserId === PLAYER_ID ? (
              <Text style={styles.resultText}>
                You have been eliminated from Redemption Island.{'\n'}Your torch is snuffed.
              </Text>
            ) : (
              <>
                <Text style={styles.resultText}>
                  {castaways.find(c => c.id === loserId)?.name ?? 'Someone'} has been eliminated.
                </Text>
                <Text style={styles.resultSub}>
                  {castaways.find(c => c.id === winnerId)?.name ?? 'Someone'} remains on Redemption Island.
                </Text>
              </>
            )}
          </View>
          <TouchableOpacity style={styles.ctaBtn} onPress={handleDone}>
            <Text style={styles.ctaBtnLabel}>
              {loserId === PLAYER_ID ? 'YOUR JOURNEY ENDS' : 'RETURN TO CAMP'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.night },
  playWrap:     { flex: 1, backgroundColor: C.night, alignItems: 'center', paddingTop: 60, paddingHorizontal: 16 },
  header:       { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#ffffff18' },
  eyebrow:      { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  title:        { fontSize: 24, fontFamily: F.display, fontWeight: '800', color: C.bone, letterSpacing: -0.5 },
  body:         { flex: 1 },
  bodyContent:  { padding: 24, paddingBottom: 40 },
  narrative:    { fontSize: 14, fontFamily: F.body, color: C.bone, opacity: 0.85, lineHeight: 22, marginBottom: 28, textAlign: 'center' },
  versusRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 20 },
  duelistCard:  { alignItems: 'center', gap: 8, flex: 1 },
  duelistName:  { fontSize: 14, fontFamily: F.body, fontWeight: '700', color: C.bone, textAlign: 'center' },
  duelistJob:   { fontSize: 11, fontFamily: F.body, color: C.inkSoft, textAlign: 'center' },
  duelType:     { fontSize: 11, fontFamily: F.mono, color: C.sun, letterSpacing: 1, textAlign: 'center', marginBottom: 24 },
  vs:           { fontSize: 20, fontFamily: F.display, fontWeight: '800', color: C.sun, paddingHorizontal: 8 },
  ctaBtn:       { backgroundColor: C.torch, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  ctaBtnLabel:  { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  resultBlock:  { alignItems: 'center', paddingVertical: 32, gap: 12 },
  fireGlyph:    { fontSize: 40, marginBottom: 8 },
  resultText:   { fontSize: 16, fontFamily: F.body, fontWeight: '700', color: C.torch, textAlign: 'center', lineHeight: 24 },
  resultSub:    { fontSize: 13, fontFamily: F.body, color: C.inkSoft, textAlign: 'center', marginBottom: 24 },
});
