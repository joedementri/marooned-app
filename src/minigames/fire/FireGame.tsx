import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { MinigameProps } from '../types';
import FireRig from './FireRig';
import { useFireAi } from './useFireAi';
import {
  fireReducer, initFireState, fireProgress, type FireState, type FireAction,
} from './fireMachine';
import { C } from '../../tokens/colors';
import { F } from '../../tokens/fonts';

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

// Split-screen fire-making. Exactly two participants; both rigs are always visible
// (player-vs-AI in compete mode, AI-vs-AI in spectate). The player drives their
// rig with gestures; the AI drives its own via useFireAi.
export default function FireGame(props: MinigameProps) {
  const { participants, seed, onComplete } = props;
  const { width, height } = useWindowDimensions();

  const p0 = participants[0];
  const p1 = participants[1];
  const rigW = (width - 36) / 2;
  const rigH = Math.min(height * 0.5, 320);

  const [running, setRunning] = useState(true);
  const [playerState, setPlayerState] = useState<FireState>(initFireState);
  const playerRef = useRef<FireState>(initFireState());
  const resolvedRef = useRef(false);

  const p0IsPlayer = p0?.isPlayer ?? false;
  const p1IsPlayer = p1?.isPlayer ?? false;

  const ai0 = useFireAi(p0?.skill ?? 0.5, seed + 1, running && !p0IsPlayer);
  const ai1 = useFireAi(p1?.skill ?? 0.5, seed + 2, running && !p1IsPlayer);

  const leftState = p0IsPlayer ? playerState : ai0;
  const rightState = p1IsPlayer ? playerState : ai1;
  const playerParticipant = p0IsPlayer ? p0 : p1IsPlayer ? p1 : null;

  function dispatchPlayer(action: FireAction) {
    const next = fireReducer(playerRef.current, action);
    playerRef.current = next;
    setPlayerState(next);
  }

  // Player decay tick.
  useEffect(() => {
    if (!running || !playerParticipant) return;
    const id = setInterval(() => dispatchPlayer({ kind: 'tick', dt: 120 }), 120);
    return () => clearInterval(id);
  }, [running, !!playerParticipant]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <PlayerControls state={playerState} dispatch={dispatchPlayer} />
      ) : (
        <View style={styles.spectate}>
          <Text style={styles.spectateText}>Two survivors race to make fire…</Text>
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

function PlayerControls({ state, dispatch }: { state: FireState; dispatch: (a: FireAction) => void }) {
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const shavePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, g) => {
        const len = Math.hypot(g.dx, g.dy);
        const speed = Math.min(1, Math.abs(g.vy) / 3);
        const quality = Math.min(1, (len / 140) * 0.5 + speed * 0.5);
        if (len > 14) dispatch({ kind: 'shave', quality });
      },
    })
  ).current;

  const strikePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, g) => {
        const total = Math.abs(g.dx) + Math.abs(g.dy) || 1;
        const diag = Math.min(g.dx, g.dy) > 0 ? 0 : Math.abs(g.dx) / total;
        const speed = Math.min(1, Math.abs(g.vx) / 3.5);
        const dist = Math.min(1, Math.abs(g.dx) / 150);
        const quality = Math.min(1, dist * 0.35 + speed * 0.5 + diag * 0.15);
        dispatch({ kind: 'strike', quality });
      },
    })
  ).current;

  function startHold() {
    if (holdTimer.current) return;
    holdTimer.current = setInterval(() => dispatch({ kind: 'holdLarge', dt: 100 }), 100);
  }
  function stopHold() {
    if (holdTimer.current) { clearInterval(holdTimer.current); holdTimer.current = null; }
  }
  useEffect(() => () => stopHold(), []);

  switch (state.stage) {
    case 'nest':
      return (
        <ControlBtn label={`PLACE TWINE  (${state.nestPieces}/3)`} onPress={() => dispatch({ kind: 'placePiece' })} hint="Tap to lay the twine nest" />
      );
    case 'shave':
      return (
        <View style={styles.padWrap} {...shavePan.panHandlers}>
          <Text style={styles.padLabel}>SHAVE THE MAGNESIUM</Text>
          <Text style={styles.padHint}>Swipe down across the block · {Math.round(state.shavings)}%</Text>
        </View>
      );
    case 'strike':
      return (
        <View style={[styles.padWrap, styles.padStrike]} {...strikePan.panHandlers}>
          <Text style={styles.padLabel}>STRIKE THE FLINT</Text>
          <Text style={styles.padHint}>Flick fast across the block · strike #{state.strikes}</Text>
        </View>
      );
    case 'ember':
      return <ControlBtn label="💨  BLOW" onPress={() => dispatch({ kind: 'blow', strength: 1 })} hint={`Keep the ember alive · ${Math.round(state.emberHealth)}%`} />;
    case 'smallSticks':
      return <ControlBtn label="🪵  ADD SMALL STICK" onPress={() => dispatch({ kind: 'addSmall' })} hint={`Build the flame · don't smother it · ${Math.round(state.flameHeight)}%`} />;
    case 'largeSticks':
      return (
        <Pressable
          style={({ pressed }) => [styles.controlBtn, pressed && styles.controlBtnActive]}
          onPressIn={startHold}
          onPressOut={stopHold}
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
  padWrap:     { marginHorizontal: 20, marginTop: 18, backgroundColor: '#ffffff0d', borderWidth: 1.5, borderColor: '#ffffff22', borderRadius: 14, paddingVertical: 26, alignItems: 'center' },
  padStrike:   { borderColor: C.sun },
  padLabel:    { fontSize: 15, fontFamily: F.display, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  padHint:     { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 1, marginTop: 6 },
  controlBtn:  { marginHorizontal: 20, marginTop: 18, backgroundColor: C.torch, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  controlBtnActive: { backgroundColor: C.sun },
  controlLabel:{ fontSize: 16, fontFamily: F.display, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  controlHint: { fontSize: 11, fontFamily: F.mono, color: '#ffffffcc', letterSpacing: 0.5, marginTop: 6 },
  overlay:     { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,20,40,0.55)' },
  resultTitle: { fontSize: 36, fontFamily: F.display, fontWeight: '800', letterSpacing: -1 },
});
