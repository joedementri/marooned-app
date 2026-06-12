import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import ConfettiBurst from '../components/game/ConfettiBurst';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

type Props = StackScreenProps<GameParamList, 'Winner'>;

export default function WinnerScreen({ route, navigation }: Props) {
  const { winnerId, tally } = route.params;

  const { castaways, playerName, jury, resetGame, setGameMode } = useGameStore(
    useShallow(s => ({
      castaways:    s.castaways,
      playerName:   s.playerName,
      jury:         s.jury,
      resetGame:    s.resetGame,
      setGameMode:  s.setGameMode,
    }))
  );

  const playerWon = winnerId === 0;
  const winnerName = playerWon ? playerName : (castaways.find(c => c.id === winnerId)?.name ?? 'Unknown');

  const sortedTally = Object.entries(tally)
    .map(([id, count]) => ({
      id: Number(id),
      count,
      name: Number(id) === 0 ? playerName : (castaways.find(c => c.id === Number(id))?.name ?? '?'),
    }))
    .sort((a, b) => b.count - a.count);

  function handlePlayAgain() {
    setGameMode('ended');
    resetGame();
    navigation.popToTop();
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {playerWon && <ConfettiBurst />}
      {/* Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerEyebrow}>SOLE SURVIVOR</Text>
        <Text style={styles.winnerName} numberOfLines={2} adjustsFontSizeToFit>
          {winnerName}
        </Text>
        {playerWon ? (
          <Text style={styles.congratsText}>
            You outwitted, outplayed, and outlasted. The jury has spoken — you are the winner of MAROONED.
          </Text>
        ) : (
          <Text style={styles.congratsText}>
            The jury has spoken. {winnerName} wins MAROONED. Better luck next time.
          </Text>
        )}
      </View>

      {/* Jury vote tally */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>JURY VOTE TALLY</Text>
        {sortedTally.map((entry, i) => (
          <View key={entry.id} style={[styles.tallyRow, i === 0 && styles.tallyRowWinner]}>
            <Text style={styles.tallyRank}>
              {i === 0 ? '🏆' : `${i + 1}.`}
            </Text>
            <Text style={[styles.tallyName, i === 0 && styles.tallyNameWinner]}>
              {entry.name}{entry.id === 0 ? ' (You)' : ''}
            </Text>
            <View style={styles.tallyVoteRow}>
              {Array.from({ length: entry.count }).map((_, j) => (
                <View key={j} style={[styles.voteDot, i === 0 && styles.voteDotWinner]} />
              ))}
              {entry.count === 0 && <Text style={styles.zeroVotes}>0 votes</Text>}
            </View>
            <Text style={[styles.tallyCount, i === 0 && styles.tallyCountWinner]}>
              {entry.count}
            </Text>
          </View>
        ))}
      </View>

      {/* Jury member votes */}
      {jury.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HOW EACH JUROR VOTED</Text>
          {jury.map(j => {
            const jurorName = castaways.find(c => c.id === j.castawayId)?.name ?? '?';
            const votedForId = j.vote ?? -1;
            const votedForName = votedForId === 0 ? playerName : (castaways.find(c => c.id === votedForId)?.name ?? '?');
            return (
              <View key={j.castawayId} style={styles.jurorRow}>
                <Text style={styles.jurorName}>{jurorName}</Text>
                <Text style={styles.jurorArrow}>→</Text>
                <Text style={[styles.jurorVote, votedForId === winnerId && styles.jurorVoteWinner]}>
                  {votedForId === -1 ? '—' : votedForName}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handlePlayAgain}>
          <Text style={styles.primaryBtnLabel}>PLAY AGAIN</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.popToTop()}>
          <Text style={styles.secondaryBtnLabel}>MAIN MENU</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: C.night },
  content:           { paddingBottom: 60 },
  banner:            { backgroundColor: C.palmDeep, paddingHorizontal: 28, paddingTop: 70, paddingBottom: 36, alignItems: 'center', gap: 12 },
  bannerEyebrow:     { fontSize: 10, fontFamily: F.mono, color: C.sun, letterSpacing: 3 },
  winnerName:        { fontSize: 32, fontFamily: F.display, fontWeight: '800', color: C.bone, textAlign: 'center', letterSpacing: -0.5 },
  congratsText:      { fontSize: 14, fontFamily: F.body, color: C.bone, opacity: 0.8, textAlign: 'center', lineHeight: 22 },
  section:           { marginHorizontal: 24, marginTop: 28 },
  sectionLabel:      { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 12 },
  tallyRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#ffffff10' },
  tallyRowWinner:    { borderBottomColor: '#c98a2a44' },
  tallyRank:         { width: 28, fontSize: 14, textAlign: 'center' },
  tallyName:         { flex: 1, fontSize: 15, fontFamily: F.body, fontWeight: '600', color: C.bone },
  tallyNameWinner:   { color: C.sun, fontWeight: '800' },
  tallyVoteRow:      { flexDirection: 'row', gap: 4, flexWrap: 'wrap', maxWidth: 90 },
  voteDot:           { width: 10, height: 10, borderRadius: 5, backgroundColor: C.inkSoft },
  voteDotWinner:     { backgroundColor: C.sun },
  zeroVotes:         { fontSize: 11, color: C.inkSoft, fontFamily: F.body },
  tallyCount:        { width: 24, fontSize: 14, fontFamily: F.mono, color: C.bone, textAlign: 'right' },
  tallyCountWinner:  { color: C.sun, fontWeight: '800' },
  jurorRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#ffffff08' },
  jurorName:         { flex: 1, fontSize: 13, fontFamily: F.body, color: C.inkSoft },
  jurorArrow:        { fontSize: 12, color: C.inkSoft },
  jurorVote:         { fontSize: 13, fontFamily: F.body, fontWeight: '600', color: C.bone },
  jurorVoteWinner:   { color: C.sun },
  actions:           { marginHorizontal: 24, marginTop: 36, gap: 12 },
  primaryBtn:        { backgroundColor: C.sun, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnLabel:   { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.ink, letterSpacing: 1 },
  secondaryBtn:      { backgroundColor: 'transparent', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#ffffff22' },
  secondaryBtnLabel: { fontSize: 13, fontFamily: F.body, fontWeight: '700', color: C.inkSoft, letterSpacing: 1 },
});
