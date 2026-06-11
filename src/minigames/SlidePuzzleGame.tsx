import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MinigameProps } from './types';
import { useChallengeBout } from './useChallengeBout';
import SpectateView from './SpectateView';
import ChallengeRail from '../components/game/ChallengeRail';
import Glyph, { GLYPH_NAMES } from '../components/graphics/glyphs';
import { mulberry32 } from '../engine/rng';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

const SOLVED = [1, 2, 3, 4, 5, 6, 7, 8, 0];

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function adjacent(a: number, b: number) {
  const dr = Math.abs(Math.floor(a / 3) - Math.floor(b / 3));
  const dc = Math.abs((a % 3) - (b % 3));
  return dr + dc === 1;
}

function scrambledBoard(scrambles: number, rng: () => number): number[] {
  const board = [...SOLVED];
  let gap = 8;
  for (let i = 0; i < scrambles; i++) {
    const neighbors = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(n => adjacent(n, gap));
    const pick = neighbors[Math.floor(rng() * neighbors.length)];
    [board[gap], board[pick]] = [board[pick], board[gap]];
    gap = pick;
  }
  return board;
}

export default function SlidePuzzleGame(props: MinigameProps) {
  const { player, mode, seed, finish } = useChallengeBout(props);
  const { difficulty } = props;

  const scrambles = difficulty === 'easy' ? 14 : difficulty === 'medium' ? 26 : 44;
  const budgetMs = difficulty === 'easy' ? 60000 : difficulty === 'medium' ? 50000 : 40000;

  const [board, setBoard] = useState<number[]>(() => scrambledBoard(scrambles, mulberry32((seed >>> 0) + 1)));
  const [solved, setSolved] = useState(false);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (mode === 'spectate' || !player) return;
    startRef.current = Date.now();
    setRunning(true);
    const t = setTimeout(() => {
      if (!solved) finish({ score: 0.15, timeMs: budgetMs });
    }, budgetMs);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === 'spectate' || !player) {
    return <SpectateView participants={props.participants} seed={seed} label="PUZZLE RACE" onDone={() => finish()} />;
  }

  function tap(i: number) {
    if (solved) return;
    const gap = board.indexOf(0);
    if (!adjacent(i, gap)) return;
    const next = [...board];
    [next[gap], next[i]] = [next[i], next[gap]];
    setBoard(next);
    if (next.every((v, idx) => v === SOLVED[idx])) {
      const elapsed = Date.now() - startRef.current;
      const score = clamp01(1 - (elapsed / budgetMs) * 0.7);
      setSolved(true);
      setTimeout(() => finish({ score, timeMs: elapsed }), 1000);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>SLIDE PUZZLE</Text>
      <Text style={styles.sub}>Restore the carved tiles to their order</Text>

      <View style={styles.board}>
        {board.map((val, i) => (
          <Pressable
            key={i}
            style={[styles.tile, val === 0 && styles.tileGap]}
            onPress={() => tap(i)}
            disabled={val === 0}
          >
            {val !== 0 && <Glyph name={GLYPH_NAMES[val - 1]} size={46} color={C.ink} />}
            {val !== 0 && <Text style={styles.tileNum}>{val}</Text>}
          </Pressable>
        ))}
      </View>

      {solved && (
        <View style={styles.solvedBox}>
          <Text style={styles.solvedText}>SOLVED!</Text>
        </View>
      )}

      <View style={styles.railWrap}>
        <Text style={styles.railLabel}>THE FIELD</Text>
        <ChallengeRail participants={props.participants.filter(p => !p.isPlayer)} running={running} seed={seed} />
      </View>
    </View>
  );
}

const TILE = 88;
const styles = StyleSheet.create({
  root:      { width: '100%', alignItems: 'center', paddingVertical: 8 },
  title:     { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  sub:       { fontSize: 12, fontFamily: F.body, color: C.inkMid, marginBottom: 18 },
  board:     { width: TILE * 3 + 16, flexDirection: 'row', flexWrap: 'wrap', gap: 4, backgroundColor: C.sandMid, padding: 6, borderRadius: 14, borderWidth: 1.5, borderColor: C.ink },
  tile:      { width: TILE, height: TILE, backgroundColor: C.bone, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.inkSoft },
  tileGap:   { backgroundColor: 'transparent', borderColor: 'transparent' },
  tileNum:   { position: 'absolute', top: 4, left: 6, fontSize: 10, fontFamily: F.mono, color: C.inkSoft },
  solvedBox: { marginTop: 16, borderWidth: 2, borderColor: C.palm, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 24 },
  solvedText:{ fontSize: 18, fontFamily: F.display, fontWeight: '800', color: C.palm, letterSpacing: 1 },
  railWrap:  { width: '100%', marginTop: 22 },
  railLabel: { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 8 },
});
