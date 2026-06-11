import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { MinigameProps } from './types';
import { useChallengeBout } from './useChallengeBout';
import SpectateView from './SpectateView';
import ChallengeRail from '../components/game/ChallengeRail';
import StarField from '../components/graphics/StarField';
import { mulberry32 } from '../engine/rng';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const CFG = {
  easy:   { targetMs: 14000, drain: 0.010, accel: 1.0 },
  medium: { targetMs: 18000, drain: 0.013, accel: 1.4 },
  hard:   { targetMs: 22000, drain: 0.016, accel: 1.8 },
} as const;

export default function HangOnGame(props: MinigameProps) {
  const { player, mode, seed, finish } = useChallengeBout(props);
  const { difficulty } = props;
  const cfg = CFG[difficulty];
  const { width } = useWindowDimensions();
  const W = Math.min(width - 48, 360);

  const grip = useRef(1);
  const holding = useRef(false);
  const startRef = useRef(0);
  const nextDistract = useRef(2200);
  const distractActive = useRef(false);
  const distractDeadline = useRef(0);
  const rng = useRef(mulberry32((seed >>> 0) + 5));

  const [gripView, setGripView] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [distract, setDistract] = useState<{ x: number; y: number } | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (mode === 'spectate' || !player) return;
    setRunning(true);
    startRef.current = Date.now();
    const interval = setInterval(() => {
      const e = Date.now() - startRef.current;
      setElapsed(e);
      const accelFactor = 1 + (e / cfg.targetMs) * cfg.accel;
      let drain = cfg.drain * accelFactor * (holding.current ? 0.45 : 1.5);

      // Distraction lifecycle.
      if (!distractActive.current && e >= nextDistract.current) {
        distractActive.current = true;
        distractDeadline.current = e + 1600;
        setDistract({ x: 20 + rng.current() * (W - 80), y: 30 + rng.current() * 120 });
      } else if (distractActive.current && e >= distractDeadline.current) {
        // Missed it.
        distractActive.current = false;
        setDistract(null);
        nextDistract.current = e + 1800 + rng.current() * 1600;
        grip.current = clamp(grip.current - 0.12, 0, 1);
      }

      grip.current = clamp(grip.current - drain, 0, 1);
      setGripView(grip.current);

      if (grip.current <= 0) {
        clearInterval(interval);
        const score = clamp((e / cfg.targetMs) * 0.85, 0, 0.85);
        setRunning(false);
        setTimeout(() => finish({ score, timeMs: e }), 900);
        return;
      }
      if (e >= cfg.targetMs) {
        clearInterval(interval);
        const score = clamp(0.85 + grip.current * 0.15, 0, 1);
        setRunning(false);
        setTimeout(() => finish({ score, timeMs: e }), 900);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function tapDistract() {
    if (!distractActive.current) return;
    distractActive.current = false;
    setDistract(null);
    grip.current = clamp(grip.current + 0.14, 0, 1);
    nextDistract.current = elapsed + 1800 + rng.current() * 1600;
  }

  if (mode === 'spectate' || !player) {
    return <SpectateView participants={props.participants} seed={seed} label="ENDURANCE HANG" onDone={() => finish()} />;
  }

  const remaining = Math.max(0, cfg.targetMs - elapsed);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>HANG ON</Text>
      <Text style={styles.sub}>Hold your grip · tap the flashes · {(remaining / 1000).toFixed(0)}s to outlast</Text>

      <View style={[styles.arena, { width: W }]}>
        <View style={styles.starWrap}>
          <StarField count={40} seed={seed} />
        </View>
        {/* grip meter */}
        <View style={styles.gripMeter}>
          <View style={[styles.gripFill, { height: `${Math.round(gripView * 100)}%`, backgroundColor: gripView > 0.4 ? C.sun : C.coral }]} />
        </View>
        {distract && (
          <Pressable style={[styles.distract, { left: distract.x, top: distract.y }]} onPress={tapDistract}>
            <Text style={styles.distractText}>!</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [styles.gripBtn, pressed && styles.gripBtnActive]}
        onPressIn={() => { holding.current = true; }}
        onPressOut={() => { holding.current = false; }}
      >
        <Text style={styles.gripBtnLabel}>HOLD</Text>
      </Pressable>

      <View style={styles.railWrap}>
        <Text style={styles.railLabel}>THE FIELD</Text>
        <ChallengeRail participants={props.participants.filter(p => !p.isPlayer)} running={running} durationMs={cfg.targetMs} seed={seed} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { width: '100%', alignItems: 'center', paddingVertical: 8 },
  title:       { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  sub:         { fontSize: 12, fontFamily: F.body, color: C.inkMid, marginBottom: 14 },
  arena:       { height: 190, backgroundColor: C.night, borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: C.ink },
  starWrap:    { ...StyleSheet.absoluteFillObject },
  gripMeter:   { position: 'absolute', right: 14, top: 14, bottom: 14, width: 16, backgroundColor: '#ffffff18', borderRadius: 8, overflow: 'hidden', justifyContent: 'flex-end' },
  gripFill:    { width: '100%', borderRadius: 8 },
  distract:    { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bone },
  distractText:{ fontSize: 26, fontFamily: F.display, fontWeight: '800', color: C.bone },
  gripBtn:     { marginTop: 18, backgroundColor: C.ink, borderRadius: 16, paddingVertical: 22, paddingHorizontal: 64 },
  gripBtnActive:{ backgroundColor: C.torch },
  gripBtnLabel:{ fontSize: 16, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 3 },
  railWrap:    { width: '100%', marginTop: 20 },
  railLabel:   { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 8 },
});
