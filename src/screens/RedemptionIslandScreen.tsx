import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import type { Castaway } from '../data/roster';
import { PLAYER_ID } from '../utils/voteSimulator';
import { seeded } from '../utils/seeded';
import { initials } from '../data/roster';
import HoldGame from '../minigames/HoldGame';
import Portrait from '../components/atoms/Portrait';
import { usePhase } from '../hooks/usePhase';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

type Props = StackScreenProps<GameParamList, 'RedemptionIsland'>;
type Stage = 'intro' | 'duel' | 'result';

function AutoDuelView({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.autoDuelBody}>
      <Text style={styles.narrative}>The duelists compete for survival…</Text>
      <Text style={styles.ellipsis}>· · ·</Text>
    </View>
  );
}

export default function RedemptionIslandScreen({ navigation }: Props) {
  const [stage, setStage] = useState<Stage>('intro');
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [loserId, setLoserId] = useState<number | null>(null);

  const {
    castaways, riQueue, day, difficulty,
    addFeedEntry, permanentEliminate, setGameMode,
  } = useGameStore(
    useShallow(s => ({
      castaways:          s.castaways,
      riQueue:            s.riQueue,
      day:                s.day,
      difficulty:         s.difficulty,
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
  const opponent = duelists.find(c => c.id !== PLAYER_ID);

  function simulateDuel() {
    if (duelists.length < 2) return;
    const rng = seeded(day * 3131 + duelists[0].id + duelists[1].id);
    const scoreA = duelists[0].stats.strength + duelists[0].stats.mental + rng() * 0.3;
    const scoreB = duelists[1].stats.strength + duelists[1].stats.mental + rng() * 0.3;
    const win = scoreA >= scoreB ? duelists[0] : duelists[1];
    const lose = scoreA >= scoreB ? duelists[1] : duelists[0];
    resolveResult(win.id, lose.id);
  }

  function handlePlayerResult(playerWon: boolean) {
    if (!opponent) return;
    if (playerWon) {
      resolveResult(PLAYER_ID, opponent.id);
    } else {
      resolveResult(opponent.id, PLAYER_ID);
    }
  }

  function resolveResult(winId: number, loseId: number) {
    setWinnerId(winId);
    setLoserId(loseId);
    permanentEliminate(loseId, day, [winId]);

    const loserName = loseId === PLAYER_ID
      ? 'You'
      : (castaways.find(c => c.id === loseId)?.name ?? 'Someone');
    const winnerName = winId === PLAYER_ID
      ? 'You'
      : (castaways.find(c => c.id === winId)?.name ?? 'Someone');

    addFeedEntry({
      id: `ri-duel-day${day}`,
      day,
      phase: 'redemption',
      text: loseId === PLAYER_ID
        ? 'You lost the Redemption Island duel. Your torch is snuffed.'
        : `${loserName} lost the Redemption Island duel. ${winnerName} survives.`,
      type: 'tribal',
    });

    if (loseId === PLAYER_ID) {
      setGameMode('ended');
    }
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

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>REDEMPTION ISLAND · DAY {day}</Text>
        <Text style={styles.title}>
          {stage === 'intro'  ? 'THE DUEL'  :
           stage === 'duel'   ? 'ENDURANCE' :
                                'SNUFFED'}
        </Text>
      </View>

      {/* ── INTRO ── */}
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
          <TouchableOpacity style={styles.ctaBtn} onPress={() => setStage('duel')}>
            <Text style={styles.ctaBtnLabel}>BEGIN THE DUEL</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── DUEL ── */}
      {stage === 'duel' && (
        <View style={styles.body}>
          {playerInDuel ? (
            <ScrollView contentContainerStyle={styles.bodyContent}>
              <Text style={styles.narrative}>Hold on as long as you can to survive.</Text>
              <HoldGame difficulty={difficulty} onResult={handlePlayerResult} />
            </ScrollView>
          ) : (
            <AutoDuelView onDone={simulateDuel} />
          )}
        </View>
      )}

      {/* ── RESULT ── */}
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
  header:       { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#ffffff18' },
  eyebrow:      { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  title:        { fontSize: 24, fontFamily: F.display, fontWeight: '800', color: C.bone, letterSpacing: -0.5 },
  body:         { flex: 1 },
  bodyContent:  { padding: 24, paddingBottom: 40 },
  narrative:    { fontSize: 14, fontFamily: F.body, color: C.bone, opacity: 0.85, lineHeight: 22, marginBottom: 28, textAlign: 'center' },
  versusRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 32 },
  duelistCard:  { alignItems: 'center', gap: 8, flex: 1 },
  duelistName:  { fontSize: 14, fontFamily: F.body, fontWeight: '700', color: C.bone, textAlign: 'center' },
  duelistJob:   { fontSize: 11, fontFamily: F.body, color: C.inkSoft, textAlign: 'center' },
  vs:           { fontSize: 20, fontFamily: F.display, fontWeight: '800', color: C.sun, paddingHorizontal: 8 },
  ctaBtn:       { backgroundColor: C.torch, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  ctaBtnLabel:  { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  resultBlock:  { alignItems: 'center', paddingVertical: 32, gap: 12 },
  fireGlyph:    { fontSize: 40, marginBottom: 8 },
  resultText:   { fontSize: 16, fontFamily: F.body, fontWeight: '700', color: C.torch, textAlign: 'center', lineHeight: 24 },
  resultSub:    { fontSize: 13, fontFamily: F.body, color: C.inkSoft, textAlign: 'center', marginBottom: 24 },
  autoDuelBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  ellipsis:     { fontSize: 28, color: C.inkSoft, marginTop: 16, letterSpacing: 8 },
});
