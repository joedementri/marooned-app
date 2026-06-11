import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

interface Props {
  difficulty: 'easy' | 'medium' | 'hard';
  onResult: (won: boolean) => void;
}

const CONFIG = {
  easy:   { npcMs: 10000, increment: 6 },
  medium: { npcMs: 8000,  increment: 5 },
  hard:   { npcMs: 6000,  increment: 4 },
} as const;

export default function TapGame({ difficulty, onResult }: Props) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [wonState, setWonState] = useState<boolean | null>(null);

  const playerVal  = useSharedValue(0);
  const npcVal     = useSharedValue(0);
  const resolvedRef = useRef(false);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolve = useCallback((won: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setPhase('done');
    setWonState(won);
    setTimeout(() => onResult(won), 1000);
  }, [onResult]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function startGame() {
    resolvedRef.current = false;
    playerVal.value = 0;
    npcVal.value = 0;
    setWonState(null);
    setPhase('playing');

    const { npcMs } = CONFIG[difficulty];
    npcVal.value = withTiming(100, { duration: npcMs, easing: Easing.linear });
    timerRef.current = setTimeout(() => resolve(false), npcMs);
  }

  function handleTap() {
    if (phase !== 'playing') return;
    const next = Math.min(100, playerVal.value + CONFIG[difficulty].increment);
    playerVal.value = next;
    if (next >= 100) {
      if (timerRef.current) clearTimeout(timerRef.current);
      resolve(true);
    }
  }

  const playerBarStyle = useAnimatedStyle(() => ({
    width: `${playerVal.value}%` as any,
  }));
  const npcBarStyle = useAnimatedStyle(() => ({
    width: `${npcVal.value}%` as any,
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TAP CHALLENGE</Text>
      <Text style={styles.sub}>Fill your bar before the NPC fills theirs</Text>

      <View style={styles.bars}>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>NPC</Text>
          <View style={styles.barTrack}>
            <Animated.View style={[styles.npcFill, npcBarStyle]} />
          </View>
        </View>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>YOU</Text>
          <View style={styles.barTrack}>
            <Animated.View style={[styles.playerFill, playerBarStyle]} />
          </View>
        </View>
      </View>

      {phase === 'done' && wonState !== null && (
        <View style={[styles.resultBox, { borderColor: wonState ? C.palm : C.coral }]}>
          <Text style={[styles.resultText, { color: wonState ? C.palm : C.coral }]}>
            {wonState ? 'YOU WIN!' : 'NPC WINS!'}
          </Text>
        </View>
      )}

      {phase === 'ready' && (
        <Pressable style={styles.actionBtn} onPress={startGame}>
          <Text style={styles.actionLabel}>START</Text>
        </Pressable>
      )}

      {phase === 'playing' && (
        <Pressable style={[styles.actionBtn, styles.tapActive]} onPress={handleTap}>
          <Text style={styles.actionLabel}>TAP!</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { width: '100%', alignItems: 'center', paddingVertical: 12 },
  title:      { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  sub:        { fontSize: 12, fontFamily: F.body, color: C.inkSoft, marginBottom: 20 },
  bars:       { width: '100%', gap: 12, marginBottom: 24 },
  barRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel:   { fontSize: 10, fontFamily: F.mono, color: C.inkMid, width: 28, textAlign: 'right' },
  barTrack:   { flex: 1, height: 22, backgroundColor: C.sandMid, borderRadius: 11, overflow: 'hidden' },
  npcFill:    { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.coral, borderRadius: 11 },
  playerFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.palm, borderRadius: 11 },
  resultBox:  { borderWidth: 2, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 28, marginBottom: 16 },
  resultText: { fontSize: 18, fontFamily: F.display, fontWeight: '800', letterSpacing: 1 },
  actionBtn:  { backgroundColor: C.ink, borderRadius: 12, paddingVertical: 18, paddingHorizontal: 52 },
  tapActive:  { backgroundColor: C.palm },
  actionLabel:{ fontSize: 16, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 2 },
});
