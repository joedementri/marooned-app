import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg from 'react-native-svg';
import type { MinigameProps } from './types';
import { useChallengeBout } from './useChallengeBout';
import SpectateView from './SpectateView';
import ChallengeRail from '../components/game/ChallengeRail';
import { mulberry32 } from '../engine/rng';
import { aiRng, gauss, lerp, clamp01 } from './aiSim';
import type { AiOutcome } from '../engine/challengeEngine';
import { ART, PUZZLE_SCENES, type PuzzleScene } from './puzzleArt';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

// A picture slide puzzle: an SVG scene sliced into tiles around one gap. Swipe
// anywhere on the board to slide the tile opposite the swipe into the gap
// (tapping a tile next to the gap works too). Bigger boards at higher
// difficulty, with CPU times stretched to match.
const CFG = {
  easy:   { n: 3, scrambles: 30,  budgetMs: 75000,  aiMin: 20000, aiMax: 48000 },
  medium: { n: 4, scrambles: 80,  budgetMs: 130000, aiMin: 45000, aiMax: 100000 },
  hard:   { n: 5, scrambles: 140, budgetMs: 200000, aiMin: 80000, aiMax: 170000 },
} as const;

function adjacent(a: number, b: number, n: number) {
  const dr = Math.abs(Math.floor(a / n) - Math.floor(b / n));
  const dc = Math.abs((a % n) - (b % n));
  return dr + dc === 1;
}

// Random gap-walk (no immediate backtracking) — always solvable.
function scrambledBoard(n: number, scrambles: number, rng: () => number): number[] {
  const size = n * n;
  const solved = [...Array(size - 1).keys()].map(v => v + 1).concat(0);
  const board = [...solved];
  let gap = size - 1;
  let prev = -1;
  for (let i = 0; i < scrambles; i++) {
    const neighbors = [...Array(size).keys()].filter(j => j !== prev && adjacent(j, gap, n));
    const pick = neighbors[Math.floor(rng() * neighbors.length)];
    [board[gap], board[pick]] = [board[pick], board[gap]];
    prev = gap;
    gap = pick;
  }
  if (board.every((v, i) => v === solved[i])) {
    // Walked back to solved — nudge once.
    const neighbors = [...Array(size).keys()].filter(j => adjacent(j, gap, n));
    const pick = neighbors[0];
    [board[gap], board[pick]] = [board[pick], board[gap]];
  }
  return board;
}

// One tile = the full scene seen through an offset viewBox. Memoized: a slide
// only changes tile positions, never their contents, so 5x5 stays cheap.
const PuzzleTile = React.memo(
  function PuzzleTile({ value, n, tilePx, scene }: { value: number; n: number; tilePx: number; scene: PuzzleScene }) {
    const cell = ART / n;
    const r = Math.floor((value - 1) / n);
    const c = (value - 1) % n;
    return (
      <Svg width={tilePx} height={tilePx} viewBox={`${c * cell} ${r * cell} ${cell} ${cell}`}>
        {scene.render()}
      </Svg>
    );
  },
  (a, b) => a.value === b.value && a.n === b.n && a.tilePx === b.tilePx && a.scene.key === b.scene.key,
);

export default function SlidePuzzleGame(props: MinigameProps) {
  const { player, mode, seed, finish } = useChallengeBout(props);
  const { difficulty, participants } = props;
  const cfg = CFG[difficulty];
  const n = cfg.n;
  const { width } = useWindowDimensions();

  const boardW = Math.min(width - 48, 340);
  const gapPx = 3;
  const tilePx = Math.floor((boardW - 12 - (n - 1) * gapPx) / n);

  const scene = useMemo(() => {
    const rng = mulberry32((seed >>> 0) + 2);
    return PUZZLE_SCENES[Math.floor(rng() * PUZZLE_SCENES.length)];
  }, [seed]);

  const aiList = useMemo(() => participants.filter(p => !p.isPlayer), [participants]);
  const aiTimes = useRef<Map<number, number> | null>(null);
  if (!aiTimes.current) {
    const m = new Map<number, number>();
    for (const p of aiList) {
      const rng = aiRng(seed, p.id, 'puzzle');
      const t = lerp(cfg.aiMax, cfg.aiMin, p.skill) * (1 + 0.15 * gauss(rng));
      m.set(p.id, Math.round(Math.min(cfg.budgetMs, Math.max(cfg.aiMin * 0.7, t))));
    }
    aiTimes.current = m;
  }

  function buildAiOutcomes(): AiOutcome[] {
    return aiList.map(p => {
      const t = aiTimes.current!.get(p.id)!;
      return { id: p.id, score: clamp01(1 - (t / cfg.budgetMs) * 0.7), timeMs: t };
    });
  }

  const [board, setBoard] = useState<number[]>(() => scrambledBoard(n, cfg.scrambles, mulberry32((seed >>> 0) + 1)));
  const [solved, setSolved] = useState(false);
  const [running, setRunning] = useState(false);
  const boardRef = useRef(board);
  const solvedRef = useRef(false);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (mode === 'spectate' || !player) return;
    startRef.current = Date.now();
    setRunning(true);
    const t = setTimeout(() => {
      if (solvedRef.current) return;
      const correct = boardRef.current.filter((v, i) => v !== 0 && v === i + 1).length;
      const score = 0.15 + 0.25 * (correct / (n * n - 1));
      finish({ score, timeMs: cfg.budgetMs }, buildAiOutcomes());
    }, cfg.budgetMs);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Slide the tile at position idx into the gap (if adjacent).
  function slide(idx: number) {
    if (solvedRef.current) return;
    const b = boardRef.current;
    const gap = b.indexOf(0);
    if (idx < 0 || idx >= b.length || !adjacent(idx, gap, n)) return;
    const next = [...b];
    [next[gap], next[idx]] = [next[idx], next[gap]];
    boardRef.current = next;
    setBoard(next);
    if (next.every((v, i) => (i === next.length - 1 ? v === 0 : v === i + 1))) {
      solvedRef.current = true;
      setSolved(true);
      const elapsed = Date.now() - startRef.current;
      const score = clamp01(1 - (elapsed / cfg.budgetMs) * 0.7);
      setTimeout(() => finish({ score, timeMs: elapsed }, buildAiOutcomes()), 1000);
    }
  }

  // Board-level swipe: the tile opposite the swipe direction slides into the
  // gap (swipe right = the tile left of the gap moves right). Taps fall
  // through to the tile Pressables.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, g) => Math.abs(g.dx) + Math.abs(g.dy) > 10,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_evt, g) => {
        const { dx, dy } = g;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
        const b = boardRef.current;
        const gap = b.indexOf(0);
        const row = Math.floor(gap / n), col = gap % n;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0 && col > 0) slide(gap - 1);        // swipe right → left neighbor moves right
          else if (dx < 0 && col < n - 1) slide(gap + 1); // swipe left → right neighbor moves left
        } else {
          if (dy > 0 && row > 0) slide(gap - n);        // swipe down → tile above drops in
          else if (dy < 0 && row < n - 1) slide(gap + n); // swipe up → tile below rises
        }
      },
    })
  ).current;

  if (mode === 'spectate' || !player) {
    const durations: Record<number, number> = {};
    for (const [id, t] of aiTimes.current) durations[id] = Math.min(t / 6, 16000);
    return (
      <SpectateView
        participants={props.participants}
        seed={seed}
        label="PUZZLE RACE"
        durations={durations}
        onDone={() => finish(undefined, buildAiOutcomes())}
      />
    );
  }

  const railDurations: Record<number, number> = {};
  for (const [id, t] of aiTimes.current) railDurations[id] = t;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>PUZZLE RACE</Text>
      <Text style={styles.sub}>Swipe the tiles to restore the picture</Text>

      {/* reference thumbnail */}
      <View style={styles.refRow}>
        <View style={styles.refBox}>
          <Svg width={72} height={72} viewBox={`0 0 ${ART} ${ART}`}>
            {scene.render()}
          </Svg>
        </View>
        <Text style={styles.refLabel}>MATCH{'\n'}THIS</Text>
      </View>

      <View
        style={[styles.board, { width: boardW, gap: gapPx }]}
        {...pan.panHandlers}
      >
        {board.map((val, i) => (
          <Pressable
            key={val === 0 ? 'gap' : val}
            style={[
              { width: tilePx, height: tilePx },
              styles.tile,
              val === 0 && styles.tileGap,
            ]}
            onPress={() => slide(i)}
            disabled={val === 0 || solved}
          >
            {val !== 0 && <PuzzleTile value={val} n={n} tilePx={tilePx} scene={scene} />}
            {val !== 0 && difficulty === 'easy' && <Text style={styles.tileNum}>{val}</Text>}
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
        <ChallengeRail
          participants={props.participants.filter(p => !p.isPlayer)}
          running={running}
          seed={seed}
          durations={railDurations}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { width: '100%', alignItems: 'center', paddingVertical: 8 },
  title:     { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  sub:       { fontSize: 12, fontFamily: F.body, color: C.inkMid, marginBottom: 10 },
  refRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  refBox:    { borderWidth: 1.5, borderColor: C.ink, borderRadius: 8, overflow: 'hidden', backgroundColor: C.bone },
  refLabel:  { fontSize: 9, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, lineHeight: 14 },
  board:     { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.sandMid, padding: 6, borderRadius: 14, borderWidth: 1.5, borderColor: C.ink },
  tile:      { borderRadius: 6, overflow: 'hidden', backgroundColor: C.bone, borderWidth: 1, borderColor: C.inkSoft },
  tileGap:   { backgroundColor: 'transparent', borderColor: 'transparent' },
  tileNum:   { position: 'absolute', top: 2, left: 4, fontSize: 9, fontFamily: F.mono, color: C.bone, textShadowColor: C.ink, textShadowRadius: 3 },
  solvedBox: { marginTop: 16, borderWidth: 2, borderColor: C.palm, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 24 },
  solvedText:{ fontSize: 18, fontFamily: F.display, fontWeight: '800', color: C.palm, letterSpacing: 1 },
  railWrap:  { width: '100%', marginTop: 22 },
  railLabel: { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 8 },
});
