import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

interface Props {
  difficulty: 'easy' | 'medium' | 'hard';
  onResult: (won: boolean) => void;
}

const TILE_COLORS = [C.palm, C.ocean, C.coral, C.sun, C.palmDeep, C.oceanDeep];
const SEQ_LENGTH = { easy: 4, medium: 5, hard: 6 } as const;
const SHOW_MS    = { easy: 700, medium: 550, hard: 400 } as const;
const GAP_MS     = { easy: 300, medium: 200, hard: 150 } as const;

type Phase = 'ready' | 'showing' | 'input' | 'success' | 'fail';

export default function MemoryGame({ difficulty, onResult }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [litTile, setLitTile] = useState<number | null>(null);
  const [playerStep, setPlayerStep] = useState(0);

  const sequenceRef    = useRef<number[]>([]);
  const resolvedRef    = useRef(false);
  const timeoutsRef    = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  useEffect(() => () => clearTimeouts(), []);

  const resolve = useCallback((won: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setTimeout(() => onResult(won), 900);
  }, [onResult]);

  function generateSequence(): number[] {
    const len = SEQ_LENGTH[difficulty];
    return Array.from({ length: len }, () => Math.floor(Math.random() * 6));
  }

  function startGame() {
    resolvedRef.current = false;
    clearTimeouts();
    const seq = generateSequence();
    sequenceRef.current = seq;
    setPlayerStep(0);
    setLitTile(null);
    setPhase('showing');

    const showMs = SHOW_MS[difficulty];
    const gapMs  = GAP_MS[difficulty];
    let offset = 500; // initial delay before first tile

    seq.forEach((tileIdx, i) => {
      const tOn = setTimeout(() => setLitTile(tileIdx), offset);
      timeoutsRef.current.push(tOn);
      offset += showMs;

      const tOff = setTimeout(() => setLitTile(null), offset);
      timeoutsRef.current.push(tOff);
      offset += gapMs;

      if (i === seq.length - 1) {
        const tInput = setTimeout(() => setPhase('input'), offset);
        timeoutsRef.current.push(tInput);
      }
    });
  }

  function handleTileTap(tileIdx: number) {
    if (phase !== 'input') return;

    const expected = sequenceRef.current[playerStep];
    if (tileIdx !== expected) {
      setPhase('fail');
      resolve(false);
      return;
    }

    // Brief flash on correct tap
    setLitTile(tileIdx);
    const t = setTimeout(() => setLitTile(null), 180);
    timeoutsRef.current.push(t);

    const nextStep = playerStep + 1;
    setPlayerStep(nextStep);

    if (nextStep === sequenceRef.current.length) {
      setPhase('success');
      resolve(true);
    }
  }

  const seqLen = SEQ_LENGTH[difficulty];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MEMORY CHALLENGE</Text>
      <Text style={styles.sub}>
        {phase === 'ready'   && 'Watch the sequence, then repeat it'}
        {phase === 'showing' && 'Watch carefully…'}
        {phase === 'input'   && `Repeat the sequence (${playerStep}/${seqLen})`}
        {phase === 'success' && 'Correct!'}
        {phase === 'fail'    && 'Wrong tile!'}
      </Text>

      <View style={styles.grid}>
        {TILE_COLORS.map((color, idx) => {
          const isLit = litTile === idx;
          return (
            <Pressable
              key={idx}
              style={[styles.tile, { backgroundColor: isLit ? color : C.sandMid }]}
              onPress={() => handleTileTap(idx)}
              disabled={phase !== 'input'}
            />
          );
        })}
      </View>

      {(phase === 'success' || phase === 'fail') && (
        <View style={[styles.resultBox, { borderColor: phase === 'success' ? C.palm : C.coral }]}>
          <Text style={[styles.resultText, { color: phase === 'success' ? C.palm : C.coral }]}>
            {phase === 'success' ? 'YOU WIN!' : 'WRONG ORDER!'}
          </Text>
        </View>
      )}

      {phase === 'ready' && (
        <Pressable style={styles.actionBtn} onPress={startGame}>
          <Text style={styles.actionLabel}>START</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { width: '100%', alignItems: 'center', paddingVertical: 12 },
  title:      { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  sub:        { fontSize: 12, fontFamily: F.body, color: C.inkSoft, marginBottom: 20, textAlign: 'center' },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', width: 216, gap: 8, marginBottom: 24 },
  tile:       { width: 64, height: 64, borderRadius: 10 },
  resultBox:  { borderWidth: 2, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 28, marginBottom: 16 },
  resultText: { fontSize: 18, fontFamily: F.display, fontWeight: '800', letterSpacing: 1 },
  actionBtn:  { backgroundColor: C.ink, borderRadius: 12, paddingVertical: 18, paddingHorizontal: 52 },
  actionLabel:{ fontSize: 16, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 2 },
});
