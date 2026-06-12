import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Rect, Line, G, Circle, Path, Ellipse, Polygon } from 'react-native-svg';
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

const H = 210;
const LOG_Y = H * 0.52;
const LOG_BROWN = '#6b4226';
const LOG_BROWN_DARK = '#4e2f1a';
const BAMBOO = '#a8924f';

// Sampled sine wave as an SVG path closing down to the bottom edge.
function wavePath(w: number, yBase: number, amp: number, phase: number, wavelength: number): string {
  let d = `M 0 ${yBase + amp * Math.sin(phase)}`;
  for (let x = 12; x <= w; x += 12) {
    d += ` L ${x} ${(yBase + amp * Math.sin(x / wavelength + phase)).toFixed(1)}`;
  }
  d += ` L ${w} ${H} L 0 ${H} Z`;
  return d;
}

export default function BalanceBeamGame(props: MinigameProps) {
  const { player, mode, seed, finish } = useChallengeBout(props);
  const { difficulty } = props;
  const cfg = CFG[difficulty];
  const { width } = useWindowDimensions();
  const beamW = Math.min(width - 48, 360);

  const markerX = useRef(beamW / 2);
  const dragStart = useRef(beamW / 2);
  const [markerView, setMarkerView] = useState(beamW / 2);
  const [windowView, setWindowView] = useState(beamW / 2);
  const [balanced, setBalanced] = useState(false);
  const [pct, setPct] = useState(0);
  const [tSec, setTSec] = useState(0);
  const [running, setRunning] = useState(false);
  const accum = useRef({ inside: 0, total: 0 });
  const startRef = useRef(0);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        // locationX is reliable at grant (the touch lands on the responder view
        // itself); afterwards we track displacement only, so moving over SVG
        // children can't retarget the coordinate space and jump the idol.
        const lx = evt.nativeEvent.locationX;
        dragStart.current = Math.abs(lx - markerX.current) > 60 ? clamp(lx, 0, beamW) : markerX.current;
        markerX.current = dragStart.current;
      },
      onPanResponderMove: (_evt, g) => {
        markerX.current = clamp(dragStart.current + g.dx, 0, beamW);
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
      setTSec(t);
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
  const idolFill = balanced ? C.palm : C.coral;
  const postXs = [10, beamW - 10];

  return (
    <View style={styles.root}>
      <Text style={styles.title}>BALANCE BEAM</Text>
      <Text style={styles.sub}>Drag the idol to stay inside the steady zone</Text>

      <View style={{ width: beamW, height: H }} {...pan.panHandlers}>
        <Svg width={beamW} height={H}>
          {/* layered water */}
          <Rect x={0} y={H - 48} width={beamW} height={48} fill={C.oceanDeep} />
          <Path d={wavePath(beamW, H - 46, 4, tSec * 1.1, 36)} fill={C.ocean} opacity={0.8} />
          <Path d={wavePath(beamW, H - 38, 3, -tSec * 1.6 + 2, 28)} fill={C.oceanLight} opacity={0.35} />

          {/* bamboo posts with tiki torches */}
          {postXs.map((px, i) => (
            <G key={i}>
              <Rect x={px - 4} y={LOG_Y - 64} width={8} height={H - 48 - (LOG_Y - 64)} rx={3} fill={BAMBOO} />
              <Line x1={px - 4} y1={LOG_Y - 40} x2={px + 4} y2={LOG_Y - 40} stroke={LOG_BROWN_DARK} strokeWidth={1.5} opacity={0.6} />
              <Line x1={px - 4} y1={LOG_Y - 14} x2={px + 4} y2={LOG_Y - 14} stroke={LOG_BROWN_DARK} strokeWidth={1.5} opacity={0.6} />
              {/* torch head wrap + flame */}
              <Rect x={px - 6} y={LOG_Y - 72} width={12} height={10} rx={3} fill={LOG_BROWN_DARK} />
              <Path
                d={`M ${px} ${LOG_Y - 92} Q ${px + 7} ${LOG_Y - 82} ${px} ${LOG_Y - 72} Q ${px - 7} ${LOG_Y - 82} ${px} ${LOG_Y - 92} Z`}
                fill={C.torch}
                opacity={0.75 + 0.25 * Math.sin(tSec * 9 + i * 2.4)}
              />
              <Path
                d={`M ${px} ${LOG_Y - 86} Q ${px + 4} ${LOG_Y - 79} ${px} ${LOG_Y - 73} Q ${px - 4} ${LOG_Y - 79} ${px} ${LOG_Y - 86} Z`}
                fill={C.sun}
                opacity={0.8 + 0.2 * Math.sin(tSec * 11 + i)}
              />
            </G>
          ))}

          {/* log beam with grain + end caps */}
          <Rect x={0} y={LOG_Y - 9} width={beamW} height={18} rx={8} fill={LOG_BROWN} />
          <Line x1={12} y1={LOG_Y - 3} x2={beamW - 12} y2={LOG_Y - 3} stroke={LOG_BROWN_DARK} strokeWidth={1} opacity={0.55} />
          <Line x1={20} y1={LOG_Y + 3} x2={beamW - 28} y2={LOG_Y + 3} stroke={LOG_BROWN_DARK} strokeWidth={1} opacity={0.4} />
          <Ellipse cx={4} cy={LOG_Y} rx={5} ry={9} fill={LOG_BROWN_DARK} />
          <Circle cx={4} cy={LOG_Y} r={3.5} fill={BAMBOO} opacity={0.6} />
          <Ellipse cx={beamW - 4} cy={LOG_Y} rx={5} ry={9} fill={LOG_BROWN_DARK} />
          <Circle cx={beamW - 4} cy={LOG_Y} r={3.5} fill={BAMBOO} opacity={0.6} />

          {/* steady zone */}
          <Rect
            x={windowView - tolPx} y={LOG_Y - 44} width={tolPx * 2} height={88}
            rx={6} fill={balanced ? C.palm : C.sun} opacity={0.22}
          />
          <Line x1={windowView} y1={LOG_Y - 44} x2={windowView} y2={LOG_Y + 44} stroke={balanced ? C.palm : C.sun} strokeWidth={1.5} opacity={0.6} />

          {/* tiki idol marker */}
          <G x={markerView} y={LOG_Y}>
            {/* body */}
            <Rect x={-11} y={-14} width={22} height={26} rx={4} fill={idolFill} stroke={C.ink} strokeWidth={2} />
            {/* carved mouth + belly lines */}
            <Line x1={-6} y1={4} x2={6} y2={4} stroke={C.ink} strokeWidth={2} />
            <Line x1={-6} y1={8} x2={6} y2={8} stroke={C.ink} strokeWidth={1} opacity={0.6} />
            {/* eyes */}
            <Circle cx={-5} cy={-6} r={2.6} fill={C.bone} />
            <Circle cx={5} cy={-6} r={2.6} fill={C.bone} />
            {/* headdress */}
            <Polygon points="-11,-14 0,-26 11,-14" fill={LOG_BROWN_DARK} stroke={C.ink} strokeWidth={1.5} />
            <Line x1={0} y1={-26} x2={0} y2={-14} stroke={C.bone} strokeWidth={1} opacity={0.5} />
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
        <ChallengeRail participants={props.participants.filter(p => !p.isPlayer)} running={running} durationMs={cfg.ms} seed={seed} />
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
