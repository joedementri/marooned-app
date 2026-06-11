import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Ellipse, Line, Rect, G } from 'react-native-svg';
import type { MinigameProps } from './types';
import { useChallengeBout } from './useChallengeBout';
import SpectateView from './SpectateView';
import ChallengeRail from '../components/game/ChallengeRail';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const CFG = {
  easy:   { throws: 5, catch: 34 },
  medium: { throws: 5, catch: 26 },
  hard:   { throws: 6, catch: 20 },
} as const;

const H = 230;
const MAX_PULL = 150;

export default function RingTossGame(props: MinigameProps) {
  const { player, mode, seed, finish } = useChallengeBout(props);
  const { difficulty } = props;
  const cfg = CFG[difficulty];
  const { width } = useWindowDimensions();
  const beamW = Math.min(width - 48, 360);
  const anchorX = beamW / 2;
  const anchorY = H - 28;
  const pegY = 48;
  const pegXs = [beamW * 0.22, beamW * 0.5, beamW * 0.78];

  const [pegHits, setPegHits] = useState<number[]>([0, 0, 0]);
  const [throwsLeft, setThrowsLeft] = useState(cfg.throws);
  const [hits, setHits] = useState(0);
  const [aim, setAim] = useState<number | null>(null);
  const [ring, setRing] = useState<{ x: number; y: number } | null>(null);
  const [running, setRunning] = useState(false);
  const flying = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (mode !== 'spectate' && player) setRunning(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        startRef.current = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY };
      },
      onPanResponderMove: (evt) => {
        if (flying.current) return;
        const dx = evt.nativeEvent.locationX - startRef.current.x;
        const landing = clamp(anchorX + (dx / MAX_PULL) * beamW * 0.9, 0, beamW);
        setAim(landing);
      },
      onPanResponderRelease: (evt) => {
        if (flying.current) return;
        const dx = evt.nativeEvent.locationX - startRef.current.x;
        const dy = evt.nativeEvent.locationY - startRef.current.y;
        const pull = Math.hypot(dx, dy);
        if (pull < 18) { setAim(null); return; }
        const landing = clamp(anchorX + (dx / MAX_PULL) * beamW * 0.9, 0, beamW);
        launch(landing);
      },
    })
  ).current;

  function launch(landingX: number) {
    flying.current = true;
    setAim(null);
    let p = 0;
    const flight = setInterval(() => {
      p += 0.06;
      const x = anchorX + (landingX - anchorX) * p;
      const y = anchorY + (pegY - anchorY) * p - Math.sin(p * Math.PI) * 50;
      setRing({ x, y });
      if (p >= 1) {
        clearInterval(flight);
        resolveThrow(landingX);
      }
    }, 16);
  }

  function resolveThrow(landingX: number) {
    let best = -1, bestD = Infinity;
    pegXs.forEach((px, i) => {
      const d = Math.abs(px - landingX);
      if (d < bestD) { bestD = d; best = i; }
    });
    const hit = best >= 0 && bestD < cfg.catch && pegHits[best] < 2;
    if (hit) {
      setPegHits(prev => { const n = [...prev]; n[best] += 1; return n; });
      setHits(h => h + 1);
    }
    setRing(null);
    flying.current = false;
    const left = throwsLeft - 1;
    setThrowsLeft(left);
    if (left <= 0) {
      const score = clamp((hit ? hits + 1 : hits) / cfg.throws, 0, 1);
      setRunning(false);
      setTimeout(() => finish({ score, timeMs: null }), 1000);
    }
  }

  if (mode === 'spectate' || !player) {
    return <SpectateView participants={props.participants} seed={seed} label="RING TOSS" onDone={() => finish()} />;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>RING TOSS</Text>
      <Text style={styles.sub}>Flick toward a post · {throwsLeft} rings left · {hits} on</Text>

      <View style={{ width: beamW, height: H }} {...pan.panHandlers}>
        <Svg width={beamW} height={H}>
          {/* sand ground */}
          <Rect x={0} y={H - 18} width={beamW} height={18} fill={C.sandMid} />
          {/* pegs */}
          {pegXs.map((px, i) => (
            <G key={i}>
              <Rect x={px - 4} y={pegY} width={8} height={H - pegY - 18} rx={3} fill={C.palmDeep} />
              <Ellipse cx={px} cy={pegY} rx={10} ry={5} fill={C.palm} />
              {Array.from({ length: pegHits[i] }).map((_, r) => (
                <Ellipse key={r} cx={px} cy={pegY + 16 + r * 14} rx={18} ry={7} fill="none" stroke={C.sun} strokeWidth={4} />
              ))}
            </G>
          ))}
          {/* aim preview */}
          {aim != null && (
            <Line x1={anchorX} y1={anchorY} x2={aim} y2={pegY} stroke={C.coral} strokeWidth={1.5} strokeDasharray="4 5" opacity={0.6} />
          )}
          {/* ring in hand or flying */}
          {ring ? (
            <Ellipse cx={ring.x} cy={ring.y} rx={16} ry={9} fill="none" stroke={C.coral} strokeWidth={5} />
          ) : (
            <Ellipse cx={anchorX} cy={anchorY} rx={16} ry={9} fill="none" stroke={C.coral} strokeWidth={5} />
          )}
        </Svg>
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
  sub:       { fontSize: 12, fontFamily: F.body, color: C.inkMid, marginBottom: 14 },
  railWrap:  { width: '100%', marginTop: 18 },
  railLabel: { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 8 },
});
