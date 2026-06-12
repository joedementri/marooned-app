import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { MinigameProps } from './types';
import { useChallengeBout } from './useChallengeBout';
import OpponentStatus from '../components/game/OpponentStatus';
import StarField from '../components/graphics/StarField';
import { mulberry32 } from '../engine/rng';
import { aiRng, gauss } from './aiSim';
import type { AiOutcome } from '../engine/challengeEngine';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// Last one hanging wins. Grip drains slowly while holding and fast while
// released; tapping a distraction flash restores far more grip than the release
// costs, so letting go to grab it is the right play. AI hang times come from
// skill, not a generic timer.
const CFG = {
  easy:   { drain: 0.006, accel: 0.8, relMult: 1.8, restore: 0.20, window: 1700, aiBase: 16000 },
  medium: { drain: 0.008, accel: 1.1, relMult: 2.0, restore: 0.18, window: 1500, aiBase: 22000 },
  hard:   { drain: 0.010, accel: 1.4, relMult: 2.2, restore: 0.16, window: 1300, aiBase: 28000 },
} as const;

const HOLD_MULT = 0.5;
const SPECTATE_SPEED = 3;

type Phase = 'countdown' | 'running' | 'done';

export default function HangOnGame(props: MinigameProps) {
  const { player, mode, seed, finish } = useChallengeBout(props);
  const { difficulty, participants } = props;
  const cfg = CFG[difficulty];
  const live = mode !== 'spectate' && !!player;
  const { width } = useWindowDimensions();
  const W = Math.min(width - 48, 360);

  const aiList = useMemo(() => participants.filter(p => !p.isPlayer), [participants]);

  // Skill-driven hang durations, fixed up front.
  const aiDurs = useRef<Map<number, number> | null>(null);
  if (!aiDurs.current) {
    const m = new Map<number, number>();
    for (const p of aiList) {
      const rng = aiRng(seed, p.id, 'hang');
      m.set(p.id, Math.max(3000, Math.round(cfg.aiBase * (0.45 + 0.9 * p.skill) * (1 + 0.18 * gauss(rng)))));
    }
    aiDurs.current = m;
  }

  const grip = useRef(1);
  const holding = useRef(false);
  const startRef = useRef(0);
  const nextDistract = useRef(2200);
  const distractActive = useRef(false);
  const distractDeadline = useRef(0);
  const rng = useRef(mulberry32((seed >>> 0) + 5));

  const [phase, setPhase] = useState<Phase>('countdown');
  const [count, setCount] = useState(3);
  const [gripView, setGripView] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [distract, setDistract] = useState<{ x: number; y: number } | null>(null);

  function buildAiOutcomes(longest: number): AiOutcome[] {
    return aiList.map(p => {
      const dur = aiDurs.current!.get(p.id)!;
      return { id: p.id, score: clamp(dur / longest, 0, 1), timeMs: dur };
    });
  }

  // 3-2-1 countdown before anything drains or any AI clock starts.
  useEffect(() => {
    const t = setInterval(() => {
      setCount(c => {
        if (c <= 1) {
          clearInterval(t);
          setPhase('running');
          return 0;
        }
        return c - 1;
      });
    }, 800);
    return () => clearInterval(t);
  }, []);

  // Main loop (live): drain + distractions until grip empties.
  useEffect(() => {
    if (phase !== 'running' || !live) return;
    startRef.current = Date.now();
    const interval = setInterval(() => {
      const e = Date.now() - startRef.current;
      setElapsed(e);
      const accelFactor = 1 + (e / cfg.aiBase) * cfg.accel;
      const drain = cfg.drain * accelFactor * (holding.current ? HOLD_MULT : cfg.relMult);

      // Distraction lifecycle: missing one just forfeits the restore.
      if (!distractActive.current && e >= nextDistract.current) {
        distractActive.current = true;
        distractDeadline.current = e + cfg.window;
        setDistract({ x: 20 + rng.current() * (W - 80), y: 30 + rng.current() * 110 });
      } else if (distractActive.current && e >= distractDeadline.current) {
        distractActive.current = false;
        setDistract(null);
        nextDistract.current = e + 1800 + rng.current() * 1600;
      }

      grip.current = clamp(grip.current - drain, 0, 1);
      setGripView(grip.current);

      if (grip.current <= 0) {
        clearInterval(interval);
        setPhase('done');
        const durs = [...aiDurs.current!.values()];
        const longest = Math.max(e, ...durs);
        const score = clamp(e / longest, 0, 1);
        setTimeout(() => finish({ score, timeMs: e }, buildAiOutcomes(longest)), 1100);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spectate loop: replay the drop-out timeline at 3x.
  useEffect(() => {
    if (phase !== 'running' || live) return;
    startRef.current = Date.now();
    const durs = [...aiDurs.current!.values()];
    const longest = Math.max(...durs, 1);
    const interval = setInterval(() => {
      const e = (Date.now() - startRef.current) * SPECTATE_SPEED;
      setElapsed(e);
      if (e >= longest + 600) {
        clearInterval(interval);
        setPhase('done');
        setTimeout(() => finish(undefined, buildAiOutcomes(longest)), 700);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function tapDistract() {
    if (!distractActive.current) return;
    distractActive.current = false;
    setDistract(null);
    grip.current = clamp(grip.current + cfg.restore, 0, 1);
    nextDistract.current = elapsed + 1800 + rng.current() * 1600;
  }

  const statusRows = aiList.map(p => {
    const dur = aiDurs.current!.get(p.id)!;
    const dropped = phase !== 'countdown' && elapsed >= dur;
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      status: dropped ? `DROPPED ${(dur / 1000).toFixed(1)}s` : 'HANGING',
      active: !dropped,
    };
  });
  const remainCount = statusRows.filter(r => r.active).length + (live && phase !== 'done' ? 1 : 0);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>HANG ON</Text>
      <Text style={styles.sub}>
        {live
          ? `Outlast everyone · let go to tap the flashes · ${(elapsed / 1000).toFixed(1)}s`
          : `Watching the hang… ${(elapsed / 1000).toFixed(1)}s`}
      </Text>

      <View style={[styles.arena, { width: W }]}>
        <View style={styles.starWrap}>
          <StarField count={40} seed={seed} />
        </View>
        {live && (
          <View style={styles.gripMeterSlim}>
            <View style={[styles.gripFillSlim, { height: `${Math.round(gripView * 100)}%`, backgroundColor: gripView > 0.4 ? C.sun : C.coral }]} />
          </View>
        )}
        {distract && phase === 'running' && (
          <Pressable style={[styles.distract, { left: distract.x, top: distract.y }]} onPress={tapDistract}>
            <Text style={styles.distractText}>!</Text>
          </Pressable>
        )}
        {phase === 'countdown' && (
          <View style={styles.countdownWrap} pointerEvents="none">
            <Text style={styles.countdownText}>{count}</Text>
          </View>
        )}
        <Text style={styles.remainText}>{remainCount} REMAIN</Text>
      </View>

      {live && (
        <>
          <View style={[styles.gripBar, { width: W }]}>
            <View style={[styles.gripBarFill, { width: `${Math.round(gripView * 100)}%`, backgroundColor: gripView > 0.4 ? C.sun : C.coral }]} />
            <Text style={styles.gripBarLabel}>GRIP</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.gripBtn, pressed && styles.gripBtnActive]}
            onPressIn={() => { holding.current = true; }}
            onPressOut={() => { holding.current = false; }}
            disabled={phase !== 'running'}
          >
            <Text style={styles.gripBtnLabel}>HOLD</Text>
          </Pressable>
        </>
      )}

      <View style={styles.railWrap}>
        <Text style={styles.railLabel}>THE FIELD</Text>
        <OpponentStatus rows={statusRows} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { width: '100%', alignItems: 'center', paddingVertical: 8 },
  title:        { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  sub:          { fontSize: 12, fontFamily: F.body, color: C.inkMid, marginBottom: 14 },
  arena:        { height: 190, backgroundColor: C.night, borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: C.ink },
  starWrap:     { ...StyleSheet.absoluteFillObject },
  gripMeterSlim:{ position: 'absolute', right: 14, top: 14, bottom: 34, width: 10, backgroundColor: '#ffffff18', borderRadius: 5, overflow: 'hidden', justifyContent: 'flex-end' },
  gripFillSlim: { width: '100%', borderRadius: 5 },
  distract:     { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bone },
  distractText: { fontSize: 26, fontFamily: F.display, fontWeight: '800', color: C.bone },
  countdownWrap:{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  countdownText:{ fontSize: 86, fontFamily: F.display, fontWeight: '800', color: C.bone },
  remainText:   { position: 'absolute', left: 12, bottom: 8, fontSize: 10, fontFamily: F.mono, color: C.bone, letterSpacing: 2, opacity: 0.8 },
  gripBar:      { marginTop: 14, height: 22, borderRadius: 11, backgroundColor: C.sandMid, overflow: 'hidden', justifyContent: 'center' },
  gripBarFill:  { position: 'absolute', left: 0, top: 0, bottom: 0 },
  gripBarLabel: { alignSelf: 'center', fontSize: 10, fontFamily: F.mono, color: C.ink, letterSpacing: 3 },
  gripBtn:      { marginTop: 14, backgroundColor: C.ink, borderRadius: 16, paddingVertical: 22, paddingHorizontal: 64 },
  gripBtnActive:{ backgroundColor: C.torch },
  gripBtnLabel: { fontSize: 16, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 3 },
  railWrap:     { width: '100%', marginTop: 20 },
  railLabel:    { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 8 },
});
