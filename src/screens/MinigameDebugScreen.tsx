import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootParamList } from '../navigation/types';
import TapGame from '../minigames/TapGame';
import MemoryGame from '../minigames/MemoryGame';
import HoldGame from '../minigames/HoldGame';
import FireGame from '../minigames/FireGame';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

type Props = StackScreenProps<RootParamList, 'MinigameDebug'>;
type GameKey = 'tap' | 'memory' | 'hold' | 'fire';
type Difficulty = 'easy' | 'medium' | 'hard';

const GAMES: { key: GameKey; label: string }[] = [
  { key: 'tap',    label: 'TAP RACE' },
  { key: 'memory', label: 'MEMORY' },
  { key: 'hold',   label: 'ENDURANCE' },
  { key: 'fire',   label: 'FIRE' },
];

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

export default function MinigameDebugScreen({ navigation }: Props) {
  const [selectedGame, setSelectedGame] = useState<GameKey | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<Difficulty>('medium');
  const [running, setRunning]           = useState(false);
  const [result, setResult]             = useState<boolean | null>(null);

  const handleResult = useCallback((won: boolean) => {
    setRunning(false);
    setResult(won);
  }, []);

  function launch() {
    if (!selectedGame) return;
    setResult(null);
    setRunning(true);
  }

  function playAgain() {
    setRunning(false);
    setResult(null);
  }

  if (selectedGame === 'fire' && running) {
    return <FireGame difficulty={selectedDiff} onResult={handleResult} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.root} bounces={false}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backLabel}>← BACK</Text>
        </Pressable>
        <Text style={styles.title}>MINIGAME DEBUG</Text>
        <View style={styles.headerSpacer} />
      </View>

      {result !== null ? (
        <View style={[styles.resultBox, { borderColor: result ? C.palm : C.coral }]}>
          <Text style={[styles.resultTitle, { color: result ? C.palm : C.coral }]}>
            {result ? 'YOU WON' : 'YOU LOST'}
          </Text>
          <Text style={styles.resultSub}>
            {selectedGame?.toUpperCase()} · {selectedDiff.toUpperCase()}
          </Text>
          <View style={styles.resultBtns}>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={playAgain}>
              <Text style={[styles.btnLabel, { color: C.ink }]}>PLAY AGAIN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: C.ink }]} onPress={() => navigation.goBack()}>
              <Text style={[styles.btnLabel, { color: C.bone }]}>EXIT</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : !running ? (
        <>
          <Text style={styles.sectionLabel}>GAME</Text>
          <View style={styles.pillRow}>
            {GAMES.map(g => (
              <Pressable
                key={g.key}
                style={[styles.pill, selectedGame === g.key && styles.pillSelected]}
                onPress={() => setSelectedGame(g.key)}
              >
                <Text style={[styles.pillText, selectedGame === g.key && styles.pillTextSelected]}>
                  {g.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>DIFFICULTY</Text>
          <View style={styles.pillRow}>
            {DIFFS.map(d => (
              <Pressable
                key={d}
                style={[styles.pill, selectedDiff === d && styles.pillSelected]}
                onPress={() => setSelectedDiff(d)}
              >
                <Text style={[styles.pillText, selectedDiff === d && styles.pillTextSelected]}>
                  {d.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.launchBtn, !selectedGame && styles.launchBtnDisabled]}
            onPress={launch}
            disabled={!selectedGame}
          >
            <Text style={styles.launchLabel}>▶  LAUNCH GAME</Text>
          </Pressable>
        </>
      ) : (
        <>
          {selectedGame === 'tap'    && <TapGame    difficulty={selectedDiff} onResult={handleResult} />}
          {selectedGame === 'memory' && <MemoryGame difficulty={selectedDiff} onResult={handleResult} />}
          {selectedGame === 'hold'   && <HoldGame   difficulty={selectedDiff} onResult={handleResult} />}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:             { flexGrow: 1, backgroundColor: C.sand, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 40 },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  backBtn:          { padding: 6 },
  backLabel:        { fontSize: 11, fontFamily: F.mono, color: C.inkMid, letterSpacing: 1 },
  title:            { fontSize: 13, fontFamily: F.mono, color: C.ink, letterSpacing: 2 },
  headerSpacer:     { width: 56 },
  sectionLabel:     { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 10, marginTop: 8 },
  pillRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  pill:             { borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: C.inkSoft },
  pillSelected:     { backgroundColor: C.ink, borderColor: C.ink },
  pillText:         { fontSize: 11, fontFamily: F.mono, color: C.inkMid, letterSpacing: 1 },
  pillTextSelected: { color: C.bone },
  launchBtn:        { marginTop: 8, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  launchBtnDisabled:{ backgroundColor: C.inkSoft },
  launchLabel:      { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  resultBox:        { borderWidth: 2, borderRadius: 14, padding: 24, alignItems: 'center', marginTop: 32 },
  resultTitle:      { fontSize: 22, fontFamily: F.display, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  resultSub:        { fontSize: 11, fontFamily: F.mono, color: C.inkMid, letterSpacing: 1.5, marginBottom: 24 },
  resultBtns:       { flexDirection: 'row', gap: 12, width: '100%' },
  btn:              { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnSecondary:     { borderWidth: 1.5, borderColor: C.inkSoft },
  btnLabel:         { fontSize: 11, fontFamily: F.body, fontWeight: '800', letterSpacing: 1 },
});
