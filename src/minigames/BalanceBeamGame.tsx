import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Rect, Line, G, Circle } from 'react-native-svg';
import type { MinigameProps } from './types';
import { useChallengeBout } from './useChallengeBout';
import SpectateView from './SpectateView';
import ChallengeRail from '../components/game/ChallengeRail';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const CFG = {
  easy:   { ms: 10000, tol: 0.17, speed: 0.8, amp: 0.26 },
  medium: { ms: 12000, tol: 0.13, speed: 1.0, amp: 0.32 },
  hard:   { ms: 14000, tol: 0.10, speed: 1.25, amp: 0.36 },
} as const;

const H = 170;

export default function BalanceBeamGame(props: MinigameProps) {
  const { player, mode, seed, finish } = useChallengeBout(props);
  const { difficulty } = props;
  const cfg = CFG[difficulty];
  const { width } = useWindowDimensions();
  const beamW = Math.min(width - 48, 360);

  const markerX = useRef(beamW / 2);
  const [markerView, setMarkerView] = useState(beamW / 2);
  const [windowView, setWindowView] = useState(beamW / 2);
  const [balanced, setBalanced] = useState(false);
  const [pct, setPct] = useState(0);
  const [running, setRunning] = useState(false);
  const accum = useRef({ inside: 0, total: 0 });
  const startRef = useRef(0);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt) => {
        markerX.current = clamp(evt.nativeEvent.locationX, 0, beamW);
      },
    })
  ).current;

  useEffect(() => {
    if (mode === 'spectate' || !player) return;
    setRunning(true);
    startRef.current = Date.now();
    const tol = beamW * cfg.tol;
    const amp = beamW * cfg.amp;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const t = elapsed / 1000;
      const center = clamp(
        beamW / 2 + amp * Math.sin(t * cfg.speed) + amp * 0.4 * Math.sin(t * 2.3 + (seed % 7)),
        tol, beamW - tol,
      );
      const inside = Math.abs(markerX.current - center) < tol;
      accum.current.total += 1;
      if (inside) accum.current.inside += 1;
      setWindowView(center);
      setMarkerView(markerX.current);
      setBalanced(inside);
      setPct(accum.current.inside / Math.max(1, accum.current.total));

      if (elapsed >= cfg.ms) {
        clearInterval(interval);
        const score = clamp(accum.current.inside / Math.max(1, accum.current.total), 0, 1);
        setRunning(false);
        setTimeout(() => finish({ score, timeMs: null }), 900);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === 'spectate' || !player) {
    return <SpectateView participants={props.participants} seed={seed} label="BALANCE BEAM" onDone={() => finish()} />;
  }

  const tolPx = beamW * cfg.tol;
  const remaining = Math.max(0, cfg.ms - (Date.now() - startRef.current));

  return (
    <View style={styles.root}>
      <Text style={styles.title}>BALANCE BEAM</Text>
      <Text style={styles.sub}>Drag the idol to stay inside the steady zone</Text>

      <View style={{ width: beamW, height: H }} {...pan.panHandlers}>
        <Svg width={beamW} height={H}>
          {/* water */}
          <Rect x={0} y={H - 34} width={beamW} height={34} fill={C.oceanDeep} />
          <Rect x={0} y={H - 34} width={beamW} height={8} fill={C.ocean} opacity={0.7} />
          {/* beam */}
          <Rect x={0} y={H / 2 - 6} width={beamW} height={12} rx={4} fill={C.palmDeep} />
          <Line x1={0} y1={H / 2} x2={beamW} y2={H / 2} stroke={C.palmLight} strokeWidth={1} opacity={0.5} />
          {/* steady zone */}
          <Rect
            x={windowView - tolPx} y={H / 2 - 40} width={tolPx * 2} height={80}
            rx={6} fill={balanced ? C.palm : C.sun} opacity={0.22}
          />
          <Line x1={windowView} y1={H / 2 - 40} x2={windowView} y2={H / 2 + 40} stroke={balanced ? C.palm : C.sun} strokeWidth={1.5} opacity={0.6} />
          {/* idol marker */}
          <G>
            <Circle cx={markerView} cy={H / 2} r={16} fill={balanced ? C.palm : C.coral} stroke={C.ink} strokeWidth={2} />
            <Circle cx={markerView} cy={H / 2 - 3} r={5} fill={C.bone} />
          </G>
        </Svg>
      </View>

      <View style={styles.meterRow}>
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: C.palm }]} />
        </View>
        <Text style={styles.meterPct}>{Math.round(pct * 100)}%</Text>
      </View>
      <Text style={styles.timer}>{(remaining / 1000).toFixed(1)}s</Text>

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
  sub:       { fontSize: 12, fontFamily: F.body, color: C.inkMid, marginBottom: 14 },
  meterRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, width: '80%', marginTop: 14 },
  meterTrack:{ flex: 1, height: 12, borderRadius: 6, backgroundColor: C.sandMid, overflow: 'hidden' },
  meterFill: { height: 12, borderRadius: 6 },
  meterPct:  { width: 40, fontSize: 13, fontFamily: F.mono, color: C.ink, textAlign: 'right' },
  timer:     { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 1, marginTop: 6 },
  railWrap:  { width: '100%', marginTop: 20 },
  railLabel: { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 8 },
});
