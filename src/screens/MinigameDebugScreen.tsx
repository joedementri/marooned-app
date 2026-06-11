import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootParamList } from '../navigation/types';
import { CHALLENGE_DEFS, CHALLENGE_BY_KEY } from '../data/challenges';
import ChallengeHost from '../minigames/ChallengeHost';
import type { ChallengeParticipant, MinigameResult, Difficulty } from '../minigames/types';
import { mulberry32 } from '../engine/rng';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

type Props = StackScreenProps<RootParamList, 'MinigameDebug'>;

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const COUNTS = [2, 4, 6];
const AI_COLORS = ['#7c2d2d', '#2d5a3d', '#0f4c5c', '#b03b5c', '#6b4a8a', '#c9491f'];

export default function MinigameDebugScreen({ navigation }: Props) {
  const [gameKey, setGameKey] = useState<string | null>(null);
  const [diff, setDiff] = useState<Difficulty>('medium');
  const [count, setCount] = useState(4);
  const [spectate, setSpectate] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MinigameResult | null>(null);
  const [runSeed, setRunSeed] = useState(1);

  const def = gameKey ? CHALLENGE_BY_KEY[gameKey] : null;
  const effectiveCount = def?.twoUp ? 2 : count;

  const participants = useMemo<ChallengeParticipant[]>(() => {
    const rng = mulberry32(runSeed * 7919 + 13);
    return Array.from({ length: effectiveCount }, (_, i) => ({
      id: i,
      name: i === 0 && !spectate ? 'You' : `AI ${i}`,
      color: i === 0 && !spectate ? '#3d5a7c' : AI_COLORS[i % AI_COLORS.length],
      isPlayer: i === 0 && !spectate,
      skill: 0.35 + rng() * 0.5,
    }));
  }, [effectiveCount, spectate, runSeed]);

  function launch() {
    if (!def) return;
    setResult(null);
    setRunSeed(s => s + 1);
    setRunning(true);
  }

  function handleComplete(r: MinigameResult) {
    setRunning(false);
    setResult(r);
  }

  if (running && def) {
    const host = (
      <ChallengeHost
        def={def}
        participants={participants}
        difficulty={diff}
        seed={runSeed * 101 + 7}
        mode={spectate ? 'spectate' : 'compete'}
        onComplete={handleComplete}
      />
    );
    if (def.fullScreen) return host;
    return (
      <View style={styles.playRoot}>
        <Pressable onPress={() => setRunning(false)} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backLabel}>← STOP</Text>
        </Pressable>
        {host}
      </View>
    );
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

      {result ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>RESULTS</Text>
          {result.rankings.map((r, i) => {
            const p = participants.find(x => x.id === r.id);
            return (
              <View key={r.id} style={styles.rankRow}>
                <Text style={styles.rankPos}>{i + 1}</Text>
                <Text style={[styles.rankName, r.id === result.winnerId && { color: C.palm }]}>
                  {p?.name ?? `#${r.id}`}{p?.isPlayer ? '  (you)' : ''}
                </Text>
                <Text style={styles.rankScore}>{Math.round(r.score * 100)}</Text>
              </View>
            );
          })}
          <View style={styles.resultBtns}>
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={launch}>
              <Text style={[styles.btnLabel, { color: C.ink }]}>PLAY AGAIN</Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: C.ink }]} onPress={() => setResult(null)}>
              <Text style={[styles.btnLabel, { color: C.bone }]}>BACK</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.sectionLabel}>GAME</Text>
          <View style={styles.pillRow}>
            {CHALLENGE_DEFS.map(g => (
              <Pressable
                key={g.key}
                style={[styles.pill, gameKey === g.key && styles.pillSelected]}
                onPress={() => setGameKey(g.key)}
              >
                <Text style={[styles.pillText, gameKey === g.key && styles.pillTextSelected]}>{g.displayName}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>DIFFICULTY</Text>
          <View style={styles.pillRow}>
            {DIFFS.map(d => (
              <Pressable key={d} style={[styles.pill, diff === d && styles.pillSelected]} onPress={() => setDiff(d)}>
                <Text style={[styles.pillText, diff === d && styles.pillTextSelected]}>{d.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>PARTICIPANTS {def?.twoUp ? '(fire is always 2)' : ''}</Text>
          <View style={styles.pillRow}>
            {COUNTS.map(n => (
              <Pressable key={n} style={[styles.pill, count === n && styles.pillSelected]} onPress={() => setCount(n)} disabled={def?.twoUp}>
                <Text style={[styles.pillText, count === n && styles.pillTextSelected]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>MODE</Text>
          <View style={styles.pillRow}>
            <Pressable style={[styles.pill, !spectate && styles.pillSelected]} onPress={() => setSpectate(false)}>
              <Text style={[styles.pillText, !spectate && styles.pillTextSelected]}>COMPETE</Text>
            </Pressable>
            <Pressable style={[styles.pill, spectate && styles.pillSelected]} onPress={() => setSpectate(true)}>
              <Text style={[styles.pillText, spectate && styles.pillTextSelected]}>SPECTATE</Text>
            </Pressable>
          </View>

          <Pressable style={[styles.launchBtn, !def && styles.launchBtnDisabled]} onPress={launch} disabled={!def}>
            <Text style={styles.launchLabel}>▶  LAUNCH GAME</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:             { flexGrow: 1, backgroundColor: C.sand, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 40 },
  playRoot:         { flex: 1, backgroundColor: C.sand, alignItems: 'center', paddingTop: 60, paddingHorizontal: 16 },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  backBtn:          { padding: 6 },
  backLabel:        { fontSize: 11, fontFamily: F.mono, color: C.inkMid, letterSpacing: 1 },
  title:            { fontSize: 13, fontFamily: F.mono, color: C.ink, letterSpacing: 2 },
  headerSpacer:     { width: 56 },
  sectionLabel:     { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 10, marginTop: 8 },
  pillRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  pill:             { borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: C.inkSoft },
  pillSelected:     { backgroundColor: C.ink, borderColor: C.ink },
  pillText:         { fontSize: 11, fontFamily: F.mono, color: C.inkMid, letterSpacing: 1 },
  pillTextSelected: { color: C.bone },
  launchBtn:        { marginTop: 8, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  launchBtnDisabled:{ backgroundColor: C.inkSoft },
  launchLabel:      { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  resultBox:        { borderWidth: 2, borderColor: C.ink, borderRadius: 14, padding: 20, marginTop: 16, backgroundColor: C.bone },
  resultTitle:      { fontSize: 16, fontFamily: F.display, fontWeight: '800', color: C.ink, letterSpacing: 1, marginBottom: 14 },
  rankRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.inkSoft },
  rankPos:          { width: 20, fontSize: 13, fontFamily: F.mono, color: C.inkSoft },
  rankName:         { flex: 1, fontSize: 14, fontFamily: F.body, fontWeight: '700', color: C.ink },
  rankScore:        { fontSize: 14, fontFamily: F.mono, color: C.inkMid },
  resultBtns:       { flexDirection: 'row', gap: 12, marginTop: 18 },
  btn:              { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnSecondary:     { borderWidth: 1.5, borderColor: C.inkSoft },
  btnLabel:         { fontSize: 11, fontFamily: F.body, fontWeight: '800', letterSpacing: 1 },
});
