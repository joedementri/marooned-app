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

// npcTarget: percentage of 8s the NPC "holds" (player must exceed this)
const CONFIG = {
  easy:   { npcTarget: 55, gameDurationMs: 8000 },
  medium: { npcTarget: 65, gameDurationMs: 8000 },
  hard:   { npcTarget: 75, gameDurationMs: 8000 },
} as const;

export default function HoldGame({ difficulty, onResult }: Props) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [wonState, setWonState] = useState<boolean | null>(null);
  const [playerBarWidth, setPlayerBarWidth] = useState(0);
  const [timeLeft, setTimeLeft] = useState(8);

  const npcVal          = useSharedValue(0);
  const resolvedRef     = useRef(false);
  const holdStartRef    = useRef<number | null>(null);
  const accumulatedRef  = useRef(0);
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAll = () => {
    if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
    if (gameTimerRef.current)   clearTimeout(gameTimerRef.current);
    if (countdownRef.current)   clearInterval(countdownRef.current);
  };

  useEffect(() => () => clearAll(), []);

  const resolve = useCallback((won: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    clearAll();
    setPhase('done');
    setWonState(won);
    setTimeout(() => onResult(won), 1000);
  }, [onResult]);

  function startGame() {
    resolvedRef.current = false;
    accumulatedRef.current = 0;
    holdStartRef.current = null;
    setPlayerBarWidth(0);
    setWonState(null);
    setTimeLeft(8);
    setPhase('playing');

    const { npcTarget, gameDurationMs } = CONFIG[difficulty];

    npcVal.value = 0;
    npcVal.value = withTiming(npcTarget, { duration: gameDurationMs, easing: Easing.linear });

    // Update player bar display every 80ms
    updateIntervalRef.current = setInterval(() => {
      const heldSoFar = accumulatedRef.current +
        (holdStartRef.current !== null ? Date.now() - holdStartRef.current : 0);
      const pct = Math.min(100, (heldSoFar / gameDurationMs) * 100);
      setPlayerBarWidth(pct);
    }, 80);

    // Countdown display
    let remaining = 8;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setTimeLeft(remaining);
    }, 1000);

    // End game after duration
    gameTimerRef.current = setTimeout(() => {
      if (holdStartRef.current !== null) {
        accumulatedRef.current += Date.now() - holdStartRef.current;
        holdStartRef.current = null;
      }
      const finalPct = Math.min(100, (accumulatedRef.current / gameDurationMs) * 100);
      setPlayerBarWidth(finalPct);
      resolve(finalPct >= npcTarget);
    }, gameDurationMs);
  }

  function handlePressIn() {
    if (phase !== 'playing') return;
    holdStartRef.current = Date.now();
  }

  function handlePressOut() {
    if (phase !== 'playing' || holdStartRef.current === null) return;
    accumulatedRef.current += Date.now() - holdStartRef.current;
    holdStartRef.current = null;
  }

  const npcBarStyle = useAnimatedStyle(() => ({
    width: `${npcVal.value}%` as any,
  }));

  const { npcTarget } = CONFIG[difficulty];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ENDURANCE CHALLENGE</Text>
      <Text style={styles.sub}>Hold the button — outlast the NPC</Text>

      {phase === 'playing' && (
        <Text style={styles.countdown}>{timeLeft}s</Text>
      )}

      <View style={styles.bars}>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>NPC</Text>
          <View style={styles.barTrack}>
            <Animated.View style={[styles.npcFill, npcBarStyle]} />
            <View style={[styles.targetLine, { left: `${npcTarget}%` as any }]} />
          </View>
        </View>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>YOU</Text>
          <View style={styles.barTrack}>
            <View style={[styles.playerFill, { width: `${playerBarWidth}%` as any }]} />
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
        <Pressable
          style={({ pressed }) => [styles.holdBtn, pressed && styles.holdBtnActive]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Text style={styles.holdLabel}>HOLD</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { width: '100%', alignItems: 'center', paddingVertical: 12 },
  title:        { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  sub:          { fontSize: 12, fontFamily: F.body, color: C.inkSoft, marginBottom: 8 },
  countdown:    { fontSize: 32, fontFamily: F.display, fontWeight: '800', color: C.ink, marginBottom: 16 },
  bars:         { width: '100%', gap: 12, marginBottom: 24 },
  barRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel:     { fontSize: 10, fontFamily: F.mono, color: C.inkMid, width: 28, textAlign: 'right' },
  barTrack:     { flex: 1, height: 22, backgroundColor: C.sandMid, borderRadius: 11, overflow: 'hidden' },
  npcFill:      { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.coral, borderRadius: 11 },
  playerFill:   { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.palm, borderRadius: 11 },
  targetLine:   { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: C.ink, opacity: 0.4 },
  resultBox:    { borderWidth: 2, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 28, marginBottom: 16 },
  resultText:   { fontSize: 18, fontFamily: F.display, fontWeight: '800', letterSpacing: 1 },
  actionBtn:    { backgroundColor: C.ink, borderRadius: 12, paddingVertical: 18, paddingHorizontal: 52 },
  actionLabel:  { fontSize: 16, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 2 },
  holdBtn:      { width: 140, height: 140, borderRadius: 70, backgroundColor: C.ocean, alignItems: 'center', justifyContent: 'center' },
  holdBtnActive:{ backgroundColor: C.palm, transform: [{ scale: 0.94 }] },
  holdLabel:    { fontSize: 18, fontFamily: F.display, fontWeight: '800', color: C.bone, letterSpacing: 2 },
});
