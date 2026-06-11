import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MinigameProps } from './types';
import { useChallengeBout } from './useChallengeBout';
import SpectateView from './SpectateView';
import ChallengeRail from '../components/game/ChallengeRail';
import Glyph, { GLYPH_NAMES, type GlyphName } from '../components/graphics/glyphs';
import { mulberry32 } from '../engine/rng';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

const CFG = {
  easy:   { len: 4, showMs: 700, gapMs: 280 },
  medium: { len: 5, showMs: 560, gapMs: 220 },
  hard:   { len: 6, showMs: 430, gapMs: 170 },
} as const;

export default function SymbolMatchGame(props: MinigameProps) {
  const { player, mode, seed, finish } = useChallengeBout(props);
  const { difficulty } = props;
  const cfg = CFG[difficulty];

  const sequence = useRef<number[]>(
    Array.from({ length: cfg.len }, (_, i) => Math.floor(mulberry32((seed >>> 0) + i * 7 + 1)() * GLYPH_NAMES.length)),
  ).current;

  const [phase, setPhase] = useState<'show' | 'input' | 'done'>('show');
  const [litIndex, setLitIndex] = useState<number>(-1);
  const [inputPos, setInputPos] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [running, setRunning] = useState(false);
  const startRef = useRef(0);

  useEffect(() => {
    if (mode === 'spectate' || !player) return;
    // Play back the sequence, then open input.
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (i >= sequence.length) {
        setLitIndex(-1);
        setPhase('input');
        setRunning(true);
        startRef.current = Date.now();
        return;
      }
      setLitIndex(sequence[i]);
      timer = setTimeout(() => {
        setLitIndex(-1);
        i++;
        timer = setTimeout(step, cfg.gapMs);
      }, cfg.showMs);
    };
    timer = setTimeout(step, 600);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === 'spectate' || !player) {
    return <SpectateView participants={props.participants} seed={seed} label="MEMORY BOARD" onDone={() => finish()} />;
  }

  function tap(glyphIdx: number) {
    if (phase !== 'input') return;
    if (glyphIdx === sequence[inputPos]) {
      const nextPos = inputPos + 1;
      setInputPos(nextPos);
      if (nextPos >= sequence.length) {
        const elapsed = Date.now() - startRef.current;
        const speed = clamp01(1 - elapsed / (sequence.length * 2200));
        setPhase('done');
        setTimeout(() => finish({ score: clamp01(0.8 + 0.2 * speed), timeMs: elapsed }), 900);
      }
    } else {
      // Partial credit for the correct prefix.
      const score = clamp01((inputPos / sequence.length) * 0.55);
      setWrong(true);
      setPhase('done');
      setTimeout(() => finish({ score, timeMs: null }), 900);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>SYMBOL RECALL</Text>
      <Text style={styles.sub}>
        {phase === 'show' ? 'Memorize the totems…' : phase === 'input' ? `Repeat the sequence (${inputPos}/${sequence.length})` : wrong ? 'Broken sequence' : 'Perfect recall!'}
      </Text>

      <View style={styles.grid}>
        {GLYPH_NAMES.map((g: GlyphName, idx) => {
          const lit = litIndex === idx;
          return (
            <Pressable
              key={g}
              style={[styles.cell, lit && styles.cellLit]}
              onPress={() => tap(idx)}
              disabled={phase !== 'input'}
            >
              <Glyph name={g} size={40} color={lit ? C.bone : C.ink} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.railWrap}>
        <Text style={styles.railLabel}>THE FIELD</Text>
        <ChallengeRail participants={props.participants.filter(p => !p.isPlayer)} running={running} seed={seed} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { width: '100%', alignItems: 'center', paddingVertical: 8 },
  title:     { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  sub:       { fontSize: 12, fontFamily: F.body, color: C.inkMid, marginBottom: 18, minHeight: 16 },
  grid:      { width: 4 * 70 + 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  cell:      { width: 66, height: 66, backgroundColor: C.bone, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.inkSoft },
  cellLit:   { backgroundColor: C.sun, borderColor: C.ink },
  railWrap:  { width: '100%', marginTop: 22 },
  railLabel: { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 8 },
});
