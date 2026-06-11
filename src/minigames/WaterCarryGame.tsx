import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Rect, G } from 'react-native-svg';
import type { MinigameProps } from './types';
import { useChallengeBout } from './useChallengeBout';
import SpectateView from './SpectateView';
import ChallengeRail from '../components/game/ChallengeRail';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const CFG = {
  easy:   { trips: 3, tol: 46, speed: 14, spill: 0.05 },
  medium: { trips: 3, tol: 36, speed: 11, spill: 0.07 },
  hard:   { trips: 3, tol: 28, speed: 9, spill: 0.09 },
} as const;

const H = 300;

export default function WaterCarryGame(props: MinigameProps) {
  const { player, mode, seed, finish } = useChallengeBout(props);
  const { difficulty } = props;
  const cfg = CFG[difficulty];
  const { width } = useWindowDimensions();
  const W = Math.min(width - 48, 340);
  const mid = W / 2;
  const amp = W * 0.26;
  const topY = 34;
  const bottomY = H - 40;

  const pathX = (y: number) => mid + amp * Math.sin(((y - topY) / (bottomY - topY)) * Math.PI * 2 + (seed % 5));

  const bucket = useRef({ x: pathX(topY), y: topY, lastX: pathX(topY), lastY: topY });
  const [view, setView] = useState({ x: pathX(topY), y: topY });
  const [water, setWater] = useState(1);
  const [trips, setTrips] = useState(0);
  const [deposited, setDeposited] = useState(0);
  const [onPath, setOnPath] = useState(true);
  const [running, setRunning] = useState(false);
  const waterRef = useRef(1);
  const depRef = useRef(0);
  const tripRef = useRef(0);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt) => {
        bucket.current.x = clamp(evt.nativeEvent.locationX, 0, W);
        bucket.current.y = clamp(evt.nativeEvent.locationY, topY, bottomY);
      },
    })
  ).current;

  useEffect(() => {
    if (mode === 'spectate' || !player) return;
    setRunning(true);
    const interval = setInterval(() => {
      const b = bucket.current;
      const speed = Math.hypot(b.x - b.lastX, b.y - b.lastY);
      const px = pathX(b.y);
      const off = Math.abs(b.x - px) > cfg.tol;
      setOnPath(!off);
      if (off || speed > cfg.speed) {
        waterRef.current = clamp(waterRef.current - cfg.spill, 0, 1);
        setWater(waterRef.current);
      }
      b.lastX = b.x; b.lastY = b.y;
      setView({ x: b.x, y: b.y });

      if (b.y >= bottomY - 6) {
        depRef.current += waterRef.current;
        tripRef.current += 1;
        setDeposited(depRef.current);
        setTrips(tripRef.current);
        if (tripRef.current >= cfg.trips) {
          clearInterval(interval);
          const score = clamp(depRef.current / cfg.trips, 0, 1);
          setRunning(false);
          setTimeout(() => finish({ score, timeMs: null }), 1000);
          return;
        }
        // refill and reset to the well
        waterRef.current = 1; setWater(1);
        b.x = pathX(topY); b.y = topY; b.lastX = b.x; b.lastY = b.y;
      }
    }, 50);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === 'spectate' || !player) {
    return <SpectateView participants={props.participants} seed={seed} label="WATER CARRY" onDone={() => finish()} />;
  }

  // Build the path polyline.
  const samples: string[] = [];
  for (let y = topY; y <= bottomY; y += 8) samples.push(`${pathX(y).toFixed(1)},${y}`);
  const pathD = `M ${samples.join(' L ')}`;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>WATER CARRY</Text>
      <Text style={styles.sub}>Follow the path · don't rush · {cfg.trips - trips} trips left</Text>

      <View style={{ width: W, height: H }} {...pan.panHandlers}>
        <Svg width={W} height={H}>
          <Path d={pathD} stroke={onPath ? C.ocean : C.coral} strokeWidth={cfg.tol * 2} strokeOpacity={0.16} fill="none" strokeLinecap="round" />
          <Path d={pathD} stroke={C.ocean} strokeWidth={2} strokeDasharray="2 7" fill="none" opacity={0.5} />
          {/* well */}
          <Circle cx={pathX(topY)} cy={topY} r={14} fill={C.oceanDeep} />
          {/* vessel */}
          <Rect x={pathX(bottomY) - 22} y={bottomY - 4} width={44} height={30} rx={4} fill={C.palmDeep} />
          <Rect x={pathX(bottomY) - 18} y={bottomY} width={36} height={Math.max(2, (deposited / cfg.trips) * 24)} fill={C.ocean} opacity={0.8} />
          {/* bucket */}
          <G>
            <Rect x={view.x - 13} y={view.y - 10} width={26} height={22} rx={3} fill={C.sandMid} stroke={C.ink} strokeWidth={1.5} />
            <Rect x={view.x - 11} y={view.y - 8 + (18 - water * 18)} width={22} height={water * 18} fill={C.ocean} />
          </G>
        </Svg>
      </View>

      <View style={styles.meterRow}>
        <Text style={styles.meterLabel}>BUCKET</Text>
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${Math.round(water * 100)}%`, backgroundColor: onPath ? C.ocean : C.coral }]} />
        </View>
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
  sub:       { fontSize: 12, fontFamily: F.body, color: C.inkMid, marginBottom: 12 },
  meterRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, width: '80%', marginTop: 12 },
  meterLabel:{ fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 1, width: 50 },
  meterTrack:{ flex: 1, height: 10, borderRadius: 5, backgroundColor: C.sandMid, overflow: 'hidden' },
  meterFill: { height: 10, borderRadius: 5 },
  railWrap:  { width: '100%', marginTop: 18 },
  railLabel: { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 8 },
});
