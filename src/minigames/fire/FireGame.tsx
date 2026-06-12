import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import type { MinigameProps } from '../types';
import FireRig from './FireRig';
import { useFireAi } from './useFireAi';
import {
  fireReducer, initFireState, fireProgress, FIRE_TUNING,
  type FireState, type FireAction, type FireTuning,
} from './fireMachine';
import { C } from '../../tokens/colors';
import { F } from '../../tokens/fonts';

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

// Split-screen fire-making. Exactly two participants; both rigs are always visible
// (player-vs-AI in compete mode, AI-vs-AI in spectate). The player drives their
// rig with gestures; the AI drives its own via useFireAi. Lose the flame and
// it's a full restart from shaving — for either side.
export default function FireGame(props: MinigameProps) {
  const { participants, seed, onComplete } = props;
  const { width, height } = useWindowDimensions();
  const tuning = FIRE_TUNING[props.difficulty];

  const p0 = participants[0];
  const p1 = participants[1];
  const rigW = (width - 36) / 2;
  const rigH = Math.min(height * 0.5, 320);

  const [running, setRunning] = useState(true);
  const [playerState, setPlayerState] = useState<FireState>(initFireState);
  const [flameOutFlash, setFlameOutFlash] = useState(false);
  const playerRef = useRef<FireState>(initFireState());
  const resolvedRef = useRef(false);

  const p0IsPlayer = p0?.isPlayer ?? false;
  const p1IsPlayer = p1?.isPlayer ?? false;

  const ai0 = useFireAi(p0?.skill ?? 0.5, seed + 1, running && !p0IsPlayer, tuning);
  const ai1 = useFireAi(p1?.skill ?? 0.5, seed + 2, running && !p1IsPlayer, tuning);

  const leftState = p0IsPlayer ? playerState : ai0;
  const rightState = p1IsPlayer ? playerState : ai1;
  const playerParticipant = p0IsPlayer ? p0 : p1IsPlayer ? p1 : null;

  function dispatchPlayer(action: FireAction) {
    const next = fireReducer(playerRef.current, action, tuning);
    playerRef.current = next;
    setPlayerState(next);
  }

  // Player decay tick.
  useEffect(() => {
    if (!running || !playerParticipant) return;
    const id = setInterval(() => dispatchPlayer({ kind: 'tick', dt: 120 }), 120);
    return () => clearInterval(id);
  }, [running, !!playerParticipant]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flash a warning when the player's fire dies.
  useEffect(() => {
    if (playerState.flameOuts === 0) return;
    setFlameOutFlash(true);
    const t = setTimeout(() => setFlameOutFlash(false), 900);
    return () => clearTimeout(t);
  }, [playerState.flameOuts]);

  // Resolve when either rig finishes.
  useEffect(() => {
    if (resolvedRef.current) return;
    const leftDone = leftState.stage === 'done';
    const rightDone = rightState.stage === 'done';
    if (!leftDone && !rightDone) return;
    resolvedRef.current = true;
    const winnerId = leftDone ? p0.id : p1.id;
    setRunning(false);
    const make = (id: number, st: FireState) => ({
      id,
      score: id === winnerId ? 1 : clamp01(fireProgress(st) * 0.85),
      finished: id === winnerId,
      timeMs: null,
    });
    const rankings = [make(p0.id, leftState), make(p1.id, rightState)].sort((a, b) => b.score - a.score);
    setTimeout(() => onComplete({ rankings, winnerId }), 1400);
  }, [leftState.stage, rightState.stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const flicker = 0.85 + 0.15 * Math.sin(Date.now() / 130);
  const won = resolvedRef.current
    ? (leftState.stage === 'done' && p0IsPlayer) || (rightState.stage === 'done' && p1IsPlayer)
    : null;

  return (
    <View style={[styles.root, { width, height }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>FIRE-MAKING CHALLENGE · {props.difficulty.toUpperCase()}</Text>
        <Text style={styles.title}>BURN THROUGH THE ROPE</Text>
      </View>

      <View style={styles.rigs}>
        <FireRig state={leftState} width={rigW} height={rigH} label={p0?.name?.split(' ')[0] ?? 'A'} color={p0IsPlayer ? C.palm : p0?.color ?? C.coral} flicker={flicker} />
        <View style={styles.vsCol}><Text style={styles.vs}>VS</Text></View>
        <FireRig state={rightState} width={rigW} height={rigH} label={p1?.name?.split(' ')[0] ?? 'B'} color={p1IsPlayer ? C.palm : p1?.color ?? C.coral} flicker={1.7 - flicker} />
      </View>

      {playerParticipant ? (
        <PlayerControls state={playerState} dispatch={dispatchPlayer} tuning={tuning} />
      ) : (
        <View style={styles.spectate}>
          <Text style={styles.spectateText}>Two survivors race to make fire…</Text>
        </View>
      )}

      {flameOutFlash && (
        <View style={styles.flashWrap} pointerEvents="none">
          <Text style={styles.flashText}>FLAME OUT — BACK TO SHAVING!</Text>
        </View>
      )}

      {won !== null && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={[styles.resultTitle, { color: won ? C.sun : C.coral }]}>
            {playerParticipant ? (won ? 'ROPE BURNS!' : 'OUTPACED!') : 'FLAME DECIDES'}
          </Text>
        </View>
      )}
    </View>
  );
}

const MACHETE_PAD_H = 120;

function PlayerControls({ state, dispatch, tuning }: { state: FireState; dispatch: (a: FireAction) => void; tuning: FireTuning }) {
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const shaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { width } = useWindowDimensions();
  const padW = width - 40;

  const [macheteX, setMacheteX] = useState(0);
  const [spark, setSpark] = useState<{ q: number } | null>(null);

  // Machete strike: drag the blade across the pad and release fast. Quality
  // rewards speed, travel, and a level (horizontal) stroke.
  const strikePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => setMacheteX(g.dx),
      onPanResponderRelease: (_, g) => {
        setMacheteX(0);
        const speed = Math.min(1, Math.abs(g.vx) / 2.2);
        const length = Math.min(1, Math.abs(g.dx) / 120);
        const straight = 1 - Math.min(1, Math.abs(g.dy) / 60);
        const quality = Math.min(1, 0.45 * speed + 0.35 * length + 0.2 * straight);
        setSpark({ q: quality });
        setTimeout(() => setSpark(null), 350);
        dispatch({ kind: 'strike', quality });
      },
    })
  ).current;

  function startHold(action: () => void, store: React.MutableRefObject<ReturnType<typeof setInterval> | null>) {
    if (store.current) return;
    store.current = setInterval(action, 100);
  }
  function stopHold(store: React.MutableRefObject<ReturnType<typeof setInterval> | null>) {
    if (store.current) { clearInterval(store.current); store.current = null; }
  }
  useEffect(() => () => { stopHold(holdTimer); stopHold(shaveTimer); }, []);

  switch (state.stage) {
    case 'nest':
      return (
        <ControlBtn label={`PLACE TWINE  (${state.nestPieces}/3)`} onPress={() => dispatch({ kind: 'placePiece' })} hint="Tap to lay the twine nest" />
      );
    case 'shave':
      return (
        <Pressable
          style={({ pressed }) => [styles.controlBtn, styles.shaveBtn, pressed && styles.controlBtnActive]}
          onPressIn={() => startHold(() => dispatch({ kind: 'shaveHold', dt: 100 }), shaveTimer)}
          onPressOut={() => stopHold(shaveTimer)}
        >
          <Text style={styles.controlLabel}>🪙  HOLD TO SHAVE MAGNESIUM</Text>
          <Text style={styles.controlHint}>Silver dust piles onto the twine · {Math.round(state.shavings)}%</Text>
        </Pressable>
      );
    case 'strike': {
      const sparkLines = spark
        ? Array.from({ length: 2 + Math.round(spark.q * 4) }, (_, i) => i)
        : [];
      return (
        <View style={[styles.strikePad, { width: padW }]} {...strikePan.panHandlers}>
          <Text style={styles.padLabel}>STRIKE THE MACHETE</Text>
          <Text style={styles.padHint}>
            Flick the blade fast and level across the block · shavings {Math.round(state.shavings)}% · strike #{state.strikes}
          </Text>
          <Svg width={padW - 24} height={56}>
            {/* magnesium block at center */}
            <Rect x={(padW - 24) / 2 - 16} y={34} width={32} height={12} rx={3} fill="#8c8c8c" />
            <Rect x={(padW - 24) / 2 - 12} y={37} width={24} height={5} rx={2} fill="#cfcfcf" opacity={0.6} />
            {/* machete follows the drag */}
            <Svg x={Math.max(-padW / 3, Math.min(padW / 3, macheteX)) + (padW - 24) / 2 - 52} y={2}>
              <Path d="M 0 18 L 64 12 Q 78 14 80 22 Q 70 30 56 28 L 0 26 Z" fill="#cfd6da" stroke="#7a8288" strokeWidth={1.5} />
              <Rect x={-20} y={16} width={22} height={12} rx={4} fill="#5c3a1e" />
            </Svg>
            {/* spark burst */}
            {sparkLines.map(i => (
              <Line
                key={i}
                x1={(padW - 24) / 2} y1={34}
                x2={(padW - 24) / 2 + 18 * Math.cos((-20 - i * 28) * (Math.PI / 180))}
                y2={34 + 18 * Math.sin((-20 - i * 28) * (Math.PI / 180))}
                stroke={C.sun} strokeWidth={2.5} strokeLinecap="round"
              />
            ))}
          </Svg>
          {spark && spark.q <= tuning.strikeThreshold && (
            <Text style={styles.noSpark}>no spark — faster!</Text>
          )}
        </View>
      );
    }
    case 'ember':
      return <ControlBtn label="💨  BLOW" onPress={() => dispatch({ kind: 'blow', strength: 1 })} hint={`Keep the ember alive · ${Math.round(state.emberHealth)}%`} />;
    case 'smallSticks':
      return <ControlBtn label="🪵  ADD SMALL STICK" onPress={() => dispatch({ kind: 'addSmall' })} hint={`Build the flame · don't smother it · ${Math.round(state.flameHeight)}%`} />;
    case 'largeSticks':
      return (
        <Pressable
          style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnActive]}
          onPressIn={() => startHold(() => dispatch({ kind: 'holdLarge', dt: 100 }), holdTimer)}
          onPressOut={() => stopHold(holdTimer)}
        >
          <Text style={styles.controlLabel}>🪵  HOLD — STACK LOGS</Text>
          <Text style={styles.controlHint}>Hold to raise the flame · {Math.round(state.flameHeight)}%</Text>
        </Pressable>
      );
    case 'ropeBurn':
      return <ControlBtn label="🔥  FEED THE FIRE" onPress={() => dispatch({ kind: 'fan' })} hint={`Keep it high to burn the rope · ${Math.round(state.ropeBurn)}%`} />;
    default:
      return <View style={styles.spectate} />;
  }
}

function ControlBtn({ label, onPress, hint }: { label: string; onPress: () => void; hint: string }) {
  return (
    <Pressable style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnActive]} onPress={onPress}>
      <Text style={styles.controlLabel}>{label}</Text>
      <Text style={styles.controlHint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:        { backgroundColor: C.night, paddingTop: 50 },
  header:      { alignItems: 'center', paddingBottom: 8 },
  eyebrow:     { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2 },
  title:       { fontSize: 22, fontFamily: F.display, fontWeight: '800', color: C.bone, letterSpacing: -0.5, marginTop: 2 },
  rigs:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 12 },
  vsCol:       { alignSelf: 'center' },
  vs:          { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 1 },
  spectate:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  spectateText:{ fontSize: 13, fontFamily: F.body, color: C.inkSoft },
  padLabel:    { fontSize: 15, fontFamily: F.display, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  padHint:     { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 1, marginTop: 6, marginBottom: 8, textAlign: 'center' },
  strikePad:   { alignSelf: 'center', marginTop: 18, minHeight: MACHETE_PAD_H, backgroundColor: '#ffffff0d', borderWidth: 1.5, borderColor: C.sun, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' },
  noSpark:     { fontSize: 11, fontFamily: F.mono, color: C.coral, letterSpacing: 1, marginTop: 2 },
  shaveBtn:    { paddingVertical: 26 },
  controlBtn:  { marginHorizontal: 20, marginTop: 18, backgroundColor: C.torch, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  controlBtnActive: { backgroundColor: C.sun },
  controlLabel:{ fontSize: 16, fontFamily: F.display, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  controlHint: { fontSize: 11, fontFamily: F.mono, color: '#ffffffcc', letterSpacing: 0.5, marginTop: 6 },
  flashWrap:   { position: 'absolute', top: '38%', left: 0, right: 0, alignItems: 'center' },
  flashText:   { fontSize: 18, fontFamily: F.display, fontWeight: '800', color: C.coral, letterSpacing: 1, backgroundColor: 'rgba(14,20,40,0.88)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, overflow: 'hidden' },
  overlay:     { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,20,40,0.55)' },
  resultTitle: { fontSize: 36, fontFamily: F.display, fontWeight: '800', letterSpacing: -1 },
});
