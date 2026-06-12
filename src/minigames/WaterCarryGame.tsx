import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Rect, G, Line, Text as SvgText } from 'react-native-svg';
import type { MinigameProps } from './types';
import { useChallengeBout } from './useChallengeBout';
import SpectateView from './SpectateView';
import ChallengeRail from '../components/game/ChallengeRail';
import { aiRng, gauss } from './aiSim';
import type { AiOutcome } from '../engine/challengeEngine';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// Haul ocean water up the winding path and pour it into the jug until it
// reaches the fill line — however many trips that takes. Spilling (off the
// path, or moving too fast) costs bucket water. AI racers fill at a
// skill-driven rate; the rail bars are their literal fill races.
const CFG = {
  easy:   { capacity: 2.2, tol: 46, speed: 14, spill: 0.05, softCapMs: 75000,  diffMult: 0.9 },
  medium: { capacity: 2.8, tol: 36, speed: 11, spill: 0.07, softCapMs: 90000,  diffMult: 1.0 },
  hard:   { capacity: 3.4, tol: 28, speed: 9,  spill: 0.09, softCapMs: 105000, diffMult: 1.15 },
} as const;

const H = 320;

export default function WaterCarryGame(props: MinigameProps) {
  const { player, mode, seed, finish } = useChallengeBout(props);
  const { difficulty, participants } = props;
  const cfg = CFG[difficulty];
  const { width } = useWindowDimensions();
  const W = Math.min(width - 48, 340);
  const mid = W / 2;
  const amp = W * 0.24;
  const topY = 52;             // vessel / pour zone
  const bottomY = H - 56;      // top edge of the ocean band

  const pathX = (y: number) => mid + amp * Math.sin(((y - topY) / (bottomY - topY)) * Math.PI * 2 + (seed % 5));

  const aiList = useMemo(() => participants.filter(p => !p.isPlayer), [participants]);

  // Skill-driven fill race: simulate round trips until each AI's jug is full.
  const aiFinish = useRef<Map<number, number> | null>(null);
  if (!aiFinish.current) {
    const m = new Map<number, number>();
    for (const p of aiList) {
      const rng = aiRng(seed, p.id, 'water');
      let t = 0, filled = 0;
      while (filled < cfg.capacity && t < 200000) {
        const trip = Math.max(2500, (9000 - 4500 * p.skill) * (1 + 0.15 * gauss(rng)) * cfg.diffMult);
        const delivered = clamp(0.55 + 0.4 * p.skill + 0.12 * gauss(rng), 0.3, 1);
        t += trip;
        filled += delivered;
      }
      m.set(p.id, Math.round(t));
    }
    aiFinish.current = m;
  }

  const bucket = useRef({ x: pathX(bottomY), y: bottomY, lastX: pathX(bottomY), lastY: bottomY });
  const dragStart = useRef({ x: pathX(bottomY), y: bottomY });
  const waterRef = useRef(1);
  const vesselRef = useRef(0);
  const tripRef = useRef(0);
  const startRef = useRef(0);

  const [view, setView] = useState({ x: pathX(bottomY), y: bottomY });
  const [water, setWater] = useState(1);
  const [vesselFill, setVesselFill] = useState(0);
  const [trips, setTrips] = useState(0);
  const [onPath, setOnPath] = useState(true);
  const [tSec, setTSec] = useState(0);
  const [running, setRunning] = useState(false);

  function buildAiOutcomes(): AiOutcome[] {
    return aiList.map(p => {
      const t = aiFinish.current!.get(p.id)!;
      return { id: p.id, score: clamp(1.05 - t / cfg.softCapMs, 0, 1), timeMs: t };
    });
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragStart.current = { x: bucket.current.x, y: bucket.current.y };
      },
      onPanResponderMove: (_evt, g) => {
        bucket.current.x = clamp(dragStart.current.x + g.dx, 0, W);
        bucket.current.y = clamp(dragStart.current.y + g.dy, topY, bottomY + 30);
      },
    })
  ).current;

  useEffect(() => {
    if (mode === 'spectate' || !player) return;
    setRunning(true);
    startRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setTSec(elapsed / 1000);
      const b = bucket.current;
      const speed = Math.hypot(b.x - b.lastX, b.y - b.lastY);
      const inOcean = b.y >= bottomY - 4;
      const px = pathX(clamp(b.y, topY, bottomY));
      const off = Math.abs(b.x - px) > cfg.tol;
      setOnPath(!off || inOcean);

      // Spills only matter while actually carrying water on the path.
      if (waterRef.current > 0 && !inOcean && (off || speed > cfg.speed)) {
        waterRef.current = clamp(waterRef.current - cfg.spill, 0, 1);
        setWater(waterRef.current);
      }
      b.lastX = b.x; b.lastY = b.y;
      setView({ x: b.x, y: b.y });

      // Dip: the ocean refills the bucket.
      if (inOcean && waterRef.current < 1) {
        waterRef.current = 1;
        setWater(1);
      }

      // Pour: reaching the vessel empties the bucket into the jug.
      if (b.y <= topY + 8 && waterRef.current > 0) {
        vesselRef.current += waterRef.current;
        tripRef.current += 1;
        waterRef.current = 0;
        setVesselFill(vesselRef.current);
        setTrips(tripRef.current);
        setWater(0);
        if (vesselRef.current >= cfg.capacity) {
          clearInterval(interval);
          const score = clamp(1.05 - elapsed / cfg.softCapMs, 0, 1);
          setRunning(false);
          setTimeout(() => finish({ score, timeMs: elapsed }, buildAiOutcomes()), 1000);
          return;
        }
      }

      if (elapsed >= cfg.softCapMs) {
        clearInterval(interval);
        const score = clamp(0.4 * (vesselRef.current / cfg.capacity), 0, 1);
        setRunning(false);
        setTimeout(() => finish({ score, timeMs: null }, buildAiOutcomes()), 1000);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === 'spectate' || !player) {
    const durations: Record<number, number> = {};
    for (const [id, t] of aiFinish.current) durations[id] = Math.min(t / 4, 16000);
    return (
      <SpectateView
        participants={props.participants}
        seed={seed}
        label="WATER CARRY"
        durations={durations}
        onDone={() => finish(undefined, buildAiOutcomes())}
      />
    );
  }

  // Build the path polyline.
  const samples: string[] = [];
  for (let y = topY; y <= bottomY; y += 8) samples.push(`${pathX(y).toFixed(1)},${y}`);
  const pathD = `M ${samples.join(' L ')}`;

  const vesselX = pathX(topY);
  const vesselW = 52, vesselH = 38;
  const fillH = Math.min(1, vesselFill / cfg.capacity) * (vesselH - 8);
  const fillPct = Math.round(Math.min(1, vesselFill / cfg.capacity) * 100);
  const remaining = Math.max(0, cfg.softCapMs / 1000 - tSec);

  const railDurations: Record<number, number> = {};
  for (const [id, t] of aiFinish.current) railDurations[id] = t;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>WATER CARRY</Text>
      <Text style={styles.sub}>Haul water to the fill line · {fillPct}% full · trip {trips + 1} · {remaining.toFixed(0)}s</Text>

      <View style={{ width: W, height: H }} {...pan.panHandlers}>
        <Svg width={W} height={H}>
          {/* path */}
          <Path d={pathD} stroke={onPath ? C.ocean : C.coral} strokeWidth={cfg.tol * 2} strokeOpacity={0.16} fill="none" strokeLinecap="round" />
          <Path d={pathD} stroke={C.ocean} strokeWidth={2} strokeDasharray="2 7" fill="none" opacity={0.5} />

          {/* vessel (clear jug with fill line) */}
          <G>
            <Rect x={vesselX - vesselW / 2} y={topY - 26} width={vesselW} height={vesselH} rx={6}
              fill={C.oceanLight} fillOpacity={0.15} stroke={C.ink} strokeWidth={2} />
            {/* water inside */}
            <Rect x={vesselX - vesselW / 2 + 3} y={topY - 26 + (vesselH - 3) - fillH} width={vesselW - 6} height={fillH}
              fill={C.ocean} opacity={0.8} />
            {/* fill line */}
            <Line x1={vesselX - vesselW / 2 - 6} y1={topY - 26 + 8} x2={vesselX + vesselW / 2 + 6} y2={topY - 26 + 8}
              stroke={C.sun} strokeWidth={2} strokeDasharray="5 4" />
            <SvgText x={vesselX} y={topY - 30} fontSize={8} fill={C.inkMid} textAnchor="middle" fontWeight="bold">
              FILL LINE
            </SvgText>
          </G>

          {/* ocean */}
          <Rect x={0} y={bottomY + 4} width={W} height={H - bottomY - 4} fill={C.oceanDeep} />
          <Path
            d={`M 0 ${bottomY + 6 + 3 * Math.sin(tSec * 1.4)} ${Array.from({ length: Math.ceil(W / 14) + 1 }, (_, i) =>
              `L ${i * 14} ${(bottomY + 6 + 3 * Math.sin(i * 0.8 + tSec * 1.4)).toFixed(1)}`).join(' ')} L ${W} ${H} L 0 ${H} Z`}
            fill={C.ocean} opacity={0.85}
          />
          {[0.2, 0.5, 0.8].map((f, i) => (
            <Circle key={i} cx={W * f + 6 * Math.sin(tSec * 0.9 + i * 2)} cy={bottomY + 14 + i * 3} r={2.2} fill={C.oceanLight} opacity={0.7} />
          ))}

          {/* bucket */}
          <G>
            <Rect x={view.x - 13} y={view.y - 10} width={26} height={22} rx={3} fill={C.sandMid} stroke={C.ink} strokeWidth={1.5} />
            <Rect x={view.x - 11} y={view.y - 8 + (18 - water * 18)} width={22} height={water * 18} fill={C.ocean} />
            {/* handle */}
            <Path d={`M ${view.x - 13} ${view.y - 10} Q ${view.x} ${view.y - 22} ${view.x + 13} ${view.y - 10}`} stroke={C.ink} strokeWidth={1.5} fill="none" />
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
  sub:       { fontSize: 12, fontFamily: F.body, color: C.inkMid, marginBottom: 12 },
  meterRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, width: '80%', marginTop: 12 },
  meterLabel:{ fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 1, width: 50 },
  meterTrack:{ flex: 1, height: 10, borderRadius: 5, backgroundColor: C.sandMid, overflow: 'hidden' },
  meterFill: { height: 10, borderRadius: 5 },
  railWrap:  { width: '100%', marginTop: 18 },
  railLabel: { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 8 },
});
