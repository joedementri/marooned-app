import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage =
  | 'ready' | 'striking' | 'blowing'
  | 'small_sticks' | 'large_sticks' | 'burning' | 'done';

type CpuStage =
  | 'idle' | 'striking' | 'blowing'
  | 'small_sticks' | 'large_sticks' | 'burning' | 'done';

interface Props {
  difficulty: 'easy' | 'medium' | 'hard';
  onResult: (won: boolean) => void;
}

// ─── CPU timing ───────────────────────────────────────────────────────────────
const CPU_TIMING = {
  easy:   { striking: 9000, blowing: 7000, small: 8000, large: 8000, burn: 16000 },
  medium: { striking: 5500, blowing: 4500, small: 5000, large: 5000, burn: 13000 },
  hard:   { striking: 3000, blowing: 3000, small: 3500, large: 3500, burn: 10000 },
} as const;

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

function stageName(s: Stage | CpuStage): string {
  switch (s) {
    case 'striking':     return 'STRIKING';
    case 'blowing':      return 'BLOWING';
    case 'small_sticks': return 'SMALL STICKS';
    case 'large_sticks': return 'LARGE STICKS';
    case 'burning':      return 'BURN THE ROPE!';
    case 'done':         return 'DONE';
    default:             return '—';
  }
}

// ─── Spark particle ───────────────────────────────────────────────────────────
type Spark = { id: number; angle: number; dist: number; bright: boolean };

function SparkDot({
  angle, dist, bright, originX, originY,
}: Spark & { originX: number; originY: number }) {
  const x  = useSharedValue(0);
  const y  = useSharedValue(0);
  const op = useSharedValue(1);

  useEffect(() => {
    const dur = 380 + Math.random() * 180;
    x.value  = withTiming(Math.cos(angle) * dist,       { duration: dur, easing: Easing.out(Easing.quad) });
    y.value  = withTiming(Math.sin(angle) * dist - 12,  { duration: dur, easing: Easing.out(Easing.quad) });
    op.value = withTiming(0, { duration: dur });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left:     originX + x.value - 2,
    top:      originY + y.value - 2,
    width:    bright ? 5 : 3,
    height:   bright ? 5 : 3,
    borderRadius: 3,
    backgroundColor: bright ? C.sun : C.torch,
    opacity: op.value,
  }));

  return <Animated.View pointerEvents="none" style={style} />;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FireGame({ difficulty, onResult }: Props) {
  const { width, height } = useWindowDimensions();

  // Layout constants
  const HEADER_H = 38;
  const CPU_H    = 108;
  const DIV_H    = 3;
  const ACT_H    = 106;
  const SCENE_H  = height - HEADER_H - ACT_H - DIV_H - CPU_H;

  // Scene geometry (proportional to screen)
  const POLE_W     = 10;
  const POLE_TOP_Y = 28;
  const POLE_BOT_Y = SCENE_H - 34;
  const LEFT_X     = width * 0.14;
  const RIGHT_X    = width * 0.86;
  const CX         = width / 2;
  const KINDLING_Y = POLE_BOT_Y - 10;
  const ROPE_Y     = POLE_TOP_Y + 6;
  const FLAME_MAX  = KINDLING_Y - ROPE_Y - 16;
  const MAG_X      = CX - 28;
  const MAG_Y      = KINDLING_Y - 16;

  // ─── Player state ─────────────────────────────────────────────────────────
  const [stage, setStage]             = useState<Stage>('ready');
  const stageRef                      = useRef<Stage>('ready');
  const [gameStarted, setGameStarted] = useState(false);
  const [strikeCount, setStrikeCount] = useState(0);
  const [emberPct, setEmberPct]       = useState(20);
  const [flamePct, setFlamePct]       = useState(0);
  const [ropePct, setRopePct]         = useState(0);
  const [feedback, setFeedback]       = useState('');
  const [won, setWon]                 = useState<boolean | null>(null);
  const [ropeDropped, setRopeDropped] = useState(false);
  const [sparks, setSparks]           = useState<Spark[]>([]);

  const emberRef    = useRef(20);
  const flameRef    = useRef(0);
  const ropeRef     = useRef(0);
  const resolvedRef = useRef(false);
  const sparkIdRef  = useRef(0);
  const feedbackTmr = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Reanimated shared values ─────────────────────────────────────────────
  const flamePctSV   = useSharedValue(0);     // smooth flame scale
  const flameFlicker = useSharedValue(1.0);   // continuous flicker
  const flagRot      = useSharedValue(90);    // 90=down, 0=horizontal (win)
  const cpuFlagRot   = useSharedValue(90);
  const cpuFlame     = useSharedValue(0);
  const cpuRope      = useSharedValue(0);
  const emberGlow    = useSharedValue(0.3);

  // ─── CPU state ────────────────────────────────────────────────────────────
  const [cpuStage, setCpuStage] = useState<CpuStage>('idle');

  // ─── Sync flamePct → shared value ────────────────────────────────────────
  useEffect(() => {
    flamePctSV.value = withTiming(flamePct, { duration: 100 });
  }, [flamePct]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Continuous flicker ───────────────────────────────────────────────────
  useEffect(() => {
    flameFlicker.value = withRepeat(
      withTiming(0.85, { duration: 310, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Ember glow pulse ─────────────────────────────────────────────────────
  useEffect(() => {
    if (stage === 'blowing') {
      emberGlow.value = withRepeat(
        withTiming(0.85, { duration: 380, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      );
    } else {
      emberGlow.value = 0;
    }
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Win/loss flag animations ─────────────────────────────────────────────
  useEffect(() => {
    if (won === true) {
      flagRot.value = withTiming(0, { duration: 600, easing: Easing.back(1.4) });
      setTimeout(() => setRopeDropped(true), 250);
    }
    if (won === false) {
      cpuFlagRot.value = withTiming(0, { duration: 600, easing: Easing.back(1.4) });
    }
  }, [won]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Animated styles ──────────────────────────────────────────────────────
  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleY: Math.max(0.01, (flamePctSV.value / 100) * (0.88 + flameFlicker.value * 0.12)) },
      { scaleX: 0.92 + flameFlicker.value * 0.08 },
    ],
    transformOrigin: 'bottom center',
  }));

  const emberGlowStyle = useAnimatedStyle(() => ({
    opacity: emberGlow.value,
  }));

  const flagStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${flagRot.value}deg` }],
    transformOrigin: 'left center',
  }));

  const cpuFlagStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${cpuFlagRot.value}deg` }],
    transformOrigin: 'left center',
  }));

  const cpuFlameStyle = useAnimatedStyle(() => ({
    height: Math.max(0, (cpuFlame.value / 100) * (CPU_H - 46)),
  }));

  const cpuRopeStyle = useAnimatedStyle(() => ({
    width: `${cpuRope.value}%` as any,
  }));

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const goToStage = useCallback((s: Stage) => {
    stageRef.current = s;
    setStage(s);
  }, []);

  const showFeedback = useCallback((msg: string) => {
    if (feedbackTmr.current) clearTimeout(feedbackTmr.current);
    setFeedback(msg);
    feedbackTmr.current = setTimeout(() => setFeedback(''), 1300);
  }, []);

  const resolve = useCallback((playerWon: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setWon(playerWon);
    goToStage('done');
    setTimeout(() => onResult(playerWon), 1400);
  }, [onResult, goToStage]);

  useEffect(() => () => {
    if (feedbackTmr.current) clearTimeout(feedbackTmr.current);
  }, []);

  // ─── PanResponder (machete swipe) ─────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => stageRef.current === 'striking',
      onMoveShouldSetPanResponder:  () => stageRef.current === 'striking',
      onPanResponderRelease: (_, g) => {
        if (stageRef.current !== 'striking') return;
        const { dx, dy, vx } = g;
        const total  = Math.abs(dx) + Math.abs(dy);
        const horiz  = total > 1 ? Math.abs(dx) / total : 0;
        const speed  = clamp(Math.abs(vx) / 4, 0, 1);
        const dist   = clamp(Math.abs(dx) / 150, 0, 1);
        const quality = clamp(dist * 0.35 + speed * 0.45 + horiz * 0.20, 0, 1);

        // Spawn sparks at magnesium position
        const count     = Math.floor(quality * 9 + 3);
        const newSparks = Array.from({ length: count }, (): Spark => ({
          id:     sparkIdRef.current++,
          angle:  -Math.PI * 0.9 + Math.random() * Math.PI * 1.1, // mostly upward fan
          dist:   22 + Math.random() * 48,
          bright: Math.random() < quality,
        }));
        setSparks(prev => [...prev, ...newSparks]);
        setTimeout(
          () => setSparks(prev => prev.filter(s => !newSparks.find(n => n.id === s.id))),
          700,
        );

        setStrikeCount(n => n + 1);

        const sparkChance = quality * 0.75 + 0.05;
        if (Math.random() < sparkChance) {
          showFeedback('SPARK HOLDS!');
          emberRef.current = 20;
          setEmberPct(20);
          setTimeout(() => {
            if (stageRef.current === 'striking') goToStage('blowing');
          }, 700);
        } else {
          showFeedback(
            quality > 0.65 ? 'SOLID STRIKE!' :
            quality > 0.35 ? 'WEAK STRIKE'   : 'POOR STRIKE',
          );
        }
      },
    })
  ).current;

  // ─── Ember decay ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'blowing') return;
    const id = setInterval(() => {
      const next = clamp(emberRef.current - 3);
      emberRef.current = next;
      setEmberPct(next);
      if (next <= 0) {
        showFeedback('EMBER DIED — RESTRIKE!');
        goToStage('striking');
      } else if (next >= 60) {
        flameRef.current = 15;
        setFlamePct(15);
        goToStage('small_sticks');
        showFeedback('TWINE IS CATCHING!');
      }
    }, 100);
    return () => clearInterval(id);
  }, [stage, goToStage, showFeedback]);

  // ─── Flame decay ──────────────────────────────────────────────────────────
  useEffect(() => {
    const active = stage === 'small_sticks' || stage === 'large_sticks' || stage === 'burning';
    if (!active) return;
    const decay = stage === 'burning' ? 4 : stage === 'large_sticks' ? 3 : 2;
    const id = setInterval(() => {
      const next = clamp(flameRef.current - decay);
      flameRef.current = next;
      setFlamePct(next);
      if (next <= 0 && stage !== 'burning') {
        showFeedback('FIRE OUT — RESTRIKE!');
        emberRef.current = 20;
        setEmberPct(20);
        flameRef.current = 0;
        ropeRef.current  = 0;
        setRopePct(0);
        goToStage('striking');
      }
    }, 100);
    return () => clearInterval(id);
  }, [stage, goToStage, showFeedback]);

  // ─── Rope burn ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'burning') return;
    const id = setInterval(() => {
      const delta = flameRef.current >= 75 ? 1 : -0.5;
      const next  = clamp(ropeRef.current + delta);
      ropeRef.current = next;
      setRopePct(next);
      if (next >= 100) resolve(true);
    }, 100);
    return () => clearInterval(id);
  }, [stage, resolve]);

  // ─── CPU simulation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameStarted) return;
    const t = CPU_TIMING[difficulty];
    setCpuStage('striking');
    cpuFlame.value = 0;
    cpuRope.value  = 0;

    const ids: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    const sched = (delay: number, fn: () => void) => {
      elapsed += delay;
      ids.push(setTimeout(fn, elapsed));
    };

    sched(t.striking, () => {
      setCpuStage('blowing');
      cpuFlame.value = withTiming(15, { duration: Math.round(t.blowing * 0.65), easing: Easing.out(Easing.quad) });
    });
    sched(t.blowing, () => {
      setCpuStage('small_sticks');
      cpuFlame.value = withTiming(55, { duration: Math.round(t.small * 0.75), easing: Easing.inOut(Easing.quad) });
    });
    sched(t.small, () => {
      setCpuStage('large_sticks');
      cpuFlame.value = withTiming(100, { duration: Math.round(t.large * 0.8), easing: Easing.inOut(Easing.quad) });
    });
    sched(t.large, () => {
      setCpuStage('burning');
      cpuRope.value = withTiming(100, { duration: t.burn, easing: Easing.linear });
    });
    sched(t.burn, () => {
      setCpuStage('done');
      resolve(false);
    });

    return () => ids.forEach(clearTimeout);
  }, [gameStarted, difficulty]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Player actions ───────────────────────────────────────────────────────
  function handleBlow() {
    if (stage !== 'blowing') return;
    const next = clamp(emberRef.current + 8);
    emberRef.current = next;
    setEmberPct(next);
  }

  function handleStick() {
    if (stage === 'burning') {
      const next = clamp(flameRef.current + 10);
      flameRef.current = next;
      setFlamePct(next);
      return;
    }
    if (stage !== 'small_sticks' && stage !== 'large_sticks') return;

    const flame      = flameRef.current;
    const minFlame   = stage === 'small_sticks' ? 8  : 10;
    const smotherAt  = stage === 'small_sticks' ? 45 : 70;
    const smotherDmg = stage === 'small_sticks' ? 15 : 20;
    const addAmt     = stage === 'small_sticks' ? 12 : 15;
    const nextThresh = stage === 'small_sticks' ? 55 : 100;

    if (flame < minFlame) { showFeedback('FLAME TOO LOW!'); return; }
    if (flame > smotherAt && Math.random() < 0.30) {
      const next = clamp(flame - smotherDmg);
      flameRef.current = next;
      setFlamePct(next);
      showFeedback('SMOTHERED!');
      return;
    }
    const next = clamp(flame + addAmt);
    flameRef.current = next;
    setFlamePct(next);
    if (next >= nextThresh) {
      flameRef.current = nextThresh;
      setFlamePct(nextThresh);
      if (stage === 'small_sticks') {
        goToStage('large_sticks');
        showFeedback('FLAME TAKING HOLD!');
      } else {
        ropeRef.current = 0;
        setRopePct(0);
        goToStage('burning');
        showFeedback('REACH THE ROPE!');
      }
    }
  }

  function handleStart() {
    setGameStarted(true);
    goToStage('striking');
  }

  // ─── Derived visual state ─────────────────────────────────────────────────
  const isBadFeedback = feedback.includes('OUT') || feedback.includes('DIED') ||
    feedback.includes('SMOTHER') || feedback.includes('LOW');

  const ropeColor = ropeDropped ? 'transparent'
    : stage === 'burning' && ropePct > 60 ? '#777'
    : stage === 'burning' ? '#aaa'
    : C.bone;
  const ropeOpacity = ropeDropped ? 0
    : stage === 'burning' ? 1 - (ropePct / 100) * 0.65
    : 1;

  const actionLabel =
    stage === 'blowing'      ? '💨  BLOW' :
    stage === 'small_sticks' ? '🪵  ADD STICKS' :
    stage === 'large_sticks' ? '🪵  ADD LOGS' :
    stage === 'burning'      ? '🔥  FEED FIRE' : '';

  const onAction = stage === 'blowing' ? handleBlow : handleStick;

  // ─── Ready screen ─────────────────────────────────────────────────────────
  if (stage === 'ready') {
    return (
      <View style={[styles.readyRoot, { width, height }]}>
        <Text style={styles.readyEyebrow}>FIRE-MAKING CHALLENGE</Text>
        <Text style={styles.readyTitle}>BURN THE ROPE</Text>
        <Text style={styles.readyBody}>
          Strike magnesium for a spark · Blow the ember to life ·
          Feed the flame until the rope burns through
        </Text>
        <Pressable style={styles.startBtn} onPress={handleStart}>
          <Text style={styles.startLabel}>START</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Main game ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { width, height }]}>

      {/* ══ PLAYER HEADER ═══════════════════════════════════════════════════ */}
      <View style={[styles.playerHeader, { height: HEADER_H }]}>
        <Text style={styles.youLabel}>YOU</Text>
        <Text style={styles.stageLabel}>{stageName(stage)}</Text>
        {stage === 'striking' && (
          <Text style={styles.strikeCountLabel}>#{strikeCount}</Text>
        )}
      </View>

      {/* ══ CAMPFIRE SCENE ══════════════════════════════════════════════════ */}
      <View style={{ height: SCENE_H, overflow: 'hidden' }}>

        {/* SVG: background, poles, rope, ground, rocks, kindling, magnesium */}
        <Svg width={width} height={SCENE_H}>

          {/* Night sky background */}
          <Rect x={0} y={0} width={width} height={SCENE_H} fill={C.night} />

          {/* Ground */}
          <Rect x={0} y={POLE_BOT_Y + 2} width={width} height={SCENE_H - POLE_BOT_Y} fill="#1c1208" />
          <Rect x={0} y={POLE_BOT_Y} width={width} height={3} fill="#2e1f0e" />

          {/* Left pole */}
          <Rect
            x={LEFT_X - POLE_W / 2} y={POLE_TOP_Y}
            width={POLE_W} height={POLE_BOT_Y - POLE_TOP_Y}
            rx={3} fill="#6b4226"
          />
          <Rect
            x={LEFT_X - POLE_W / 2 - 3} y={POLE_TOP_Y - 5}
            width={POLE_W + 6} height={7}
            rx={2} fill="#7d5030"
          />

          {/* Right pole */}
          <Rect
            x={RIGHT_X - POLE_W / 2} y={POLE_TOP_Y}
            width={POLE_W} height={POLE_BOT_Y - POLE_TOP_Y}
            rx={3} fill="#6b4226"
          />
          <Rect
            x={RIGHT_X - POLE_W / 2 - 3} y={POLE_TOP_Y - 5}
            width={POLE_W + 6} height={7}
            rx={2} fill="#7d5030"
          />

          {/* Rope */}
          {!ropeDropped && (
            <Line
              x1={LEFT_X} y1={ROPE_Y}
              x2={RIGHT_X} y2={ROPE_Y}
              stroke={ropeColor}
              strokeWidth={3.5}
              opacity={ropeOpacity}
              strokeDasharray={stage === 'burning' && ropePct > 35 ? '9,5' : undefined}
            />
          )}
          {/* Drooped rope after burning */}
          {ropeDropped && (
            <>
              <Line x1={LEFT_X}  y1={ROPE_Y} x2={CX - 18} y2={ROPE_Y + 22} stroke="#555" strokeWidth={2} opacity={0.5} />
              <Line x1={RIGHT_X} y1={ROPE_Y} x2={CX + 18} y2={ROPE_Y + 22} stroke="#555" strokeWidth={2} opacity={0.5} />
            </>
          )}

          {/* Fire pit rocks */}
          <Ellipse cx={CX - 18} cy={KINDLING_Y + 11} rx={13} ry={5} fill="#1e1208" />
          <Ellipse cx={CX + 18} cy={KINDLING_Y + 11} rx={13} ry={5} fill="#1e1208" />
          <Ellipse cx={CX}      cy={KINDLING_Y + 14} rx={16} ry={6} fill="#160e04" />

          {/* Kindling crisscross */}
          <Rect x={CX - 22} y={KINDLING_Y - 5}  width={44} height={4} rx={2} fill="#5c3a1e"
            transform={`rotate(-14,${CX},${KINDLING_Y})`} />
          <Rect x={CX - 22} y={KINDLING_Y - 10} width={44} height={3} rx={1} fill="#6b4226"
            transform={`rotate(14,${CX},${KINDLING_Y})`} />
          <Rect x={CX - 14} y={KINDLING_Y - 14} width={28} height={3} rx={1} fill="#7d5030"
            transform={`rotate(-6,${CX},${KINDLING_Y})`} />

          {/* Magnesium block (striking stage only) */}
          {stage === 'striking' && (
            <>
              <Rect
                x={MAG_X - 13} y={MAG_Y - 4}
                width={26} height={8} rx={3}
                fill="#8c8c8c"
                transform={`rotate(-22,${MAG_X},${MAG_Y})`}
              />
              <Rect
                x={MAG_X - 10} y={MAG_Y - 2}
                width={20} height={5} rx={2}
                fill="#c0c0c0" opacity={0.5}
                transform={`rotate(-22,${MAG_X},${MAG_Y})`}
              />
            </>
          )}

          {/* Ember glow in SVG (blowing stage) */}
          {stage === 'blowing' && (
            <Circle
              cx={CX} cy={KINDLING_Y - 5}
              r={6 + (emberPct / 100) * 12}
              fill={C.torch} opacity={0.35}
            />
          )}
        </Svg>

        {/* Animated ember pulse (separate from SVG to use Reanimated) */}
        {stage === 'blowing' && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.emberPulse,
              {
                left:   CX - 24,
                top:    KINDLING_Y - 24,
                width:  48,
                height: 48,
                borderRadius: 24,
              },
              emberGlowStyle,
            ]}
          />
        )}

        {/* Flame (Reanimated, bottom-anchored scale) */}
        {flamePct > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.flameAnchor,
              {
                left:   CX - 36,
                bottom: SCENE_H - KINDLING_Y,
                width:  72,
                height: FLAME_MAX,
              },
              flameStyle,
            ]}
          >
            <Svg width={72} height={FLAME_MAX} viewBox="0 0 72 200">
              {/* Outer flame */}
              <Path
                d="M36,2 Q54,28 54,76 Q54,128 36,168 Q18,128 18,76 Q18,28 36,2 Z"
                fill={C.torch}
              />
              {/* Mid flame */}
              <Path
                d="M36,28 Q50,52 50,88 Q50,124 36,154 Q22,124 22,88 Q22,52 36,28 Z"
                fill={C.sun}
              />
              {/* Core */}
              <Path
                d="M36,62 Q43,78 42,100 Q36,112 30,100 Q29,78 36,62 Z"
                fill={C.bone} opacity={0.85}
              />
            </Svg>
          </Animated.View>
        )}

        {/* Spark particles */}
        {sparks.map(s => (
          <SparkDot key={s.id} {...s} originX={MAG_X} originY={MAG_Y} />
        ))}

        {/* Flag on right pole (Reanimated rotation, pivot = left edge) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flagWrapper,
            { left: RIGHT_X + POLE_W / 2 - 1, top: POLE_TOP_Y - 1 },
            flagStyle,
          ]}
        >
          <View style={styles.flagBody} />
        </Animated.View>

        {/* Swipe capture zone (transparent, striking stage) */}
        {stage === 'striking' && (
          <View
            style={[StyleSheet.absoluteFillObject]}
            {...panResponder.panHandlers}
          />
        )}
      </View>

      {/* ══ ACTION AREA ═════════════════════════════════════════════════════ */}
      <View style={[styles.actionArea, { height: ACT_H }]}>

        {/* Rope burn bar (burning stage) */}
        {stage === 'burning' && (
          <View style={styles.ropeBarRow}>
            <View style={styles.ropeBarTrack}>
              <View style={[styles.ropeBarFill, { width: `${ropePct}%` as any }]} />
            </View>
            <Text style={styles.ropeBarPct}>{Math.round(ropePct)}%</Text>
          </View>
        )}

        {/* Striking hint */}
        {stage === 'striking' && (
          <Text style={styles.swipeHint}>← SWIPE FAST ACROSS THE MAGNESIUM →</Text>
        )}

        {/* Action button */}
        {actionLabel !== '' && stage !== 'done' && (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnActive]}
            onPress={onAction}
          >
            <Text style={styles.actionBtnLabel}>{actionLabel}</Text>
          </Pressable>
        )}

        {/* Feedback */}
        {!!feedback && (
          <Text style={[styles.feedbackText, { color: isBadFeedback ? C.coral : C.sun }]}>
            {feedback}
          </Text>
        )}
      </View>

      {/* ══ DIVIDER ═════════════════════════════════════════════════════════ */}
      <View style={[styles.divider, { height: DIV_H }]}>
        <Text style={styles.vsLabel}>VS</Text>
      </View>

      {/* ══ CPU PANEL ═══════════════════════════════════════════════════════ */}
      <View style={[styles.cpuSection, { height: CPU_H }]}>

        {/* CPU header row */}
        <View style={styles.cpuHeader}>
          <Text style={styles.cpuLabel}>CPU</Text>
          <Text style={styles.cpuStageText}>{stageName(cpuStage)}</Text>
          {cpuStage === 'burning' && (
            <View style={styles.cpuRopeTrack}>
              <Animated.View style={[styles.cpuRopeFill, cpuRopeStyle]} />
            </View>
          )}
        </View>

        {/* Mini campfire scene */}
        <View style={styles.cpuScene}>
          {/* Left mini pole */}
          <View style={styles.cpuPole} />

          {/* Fire column */}
          <View style={styles.cpuFireColumn}>
            <View style={styles.cpuFireTrack}>
              <Animated.View style={[styles.cpuFlameFill, cpuFlameStyle]} />
            </View>
          </View>

          {/* Right mini pole + flag */}
          <View style={styles.cpuRightPole}>
            <Animated.View pointerEvents="none" style={[styles.cpuFlag, cpuFlagStyle]} />
            <View style={styles.cpuPole} />
          </View>
        </View>
      </View>

      {/* ══ RESULT OVERLAY ══════════════════════════════════════════════════ */}
      {won !== null && (
        <View style={styles.resultOverlay}>
          <Text style={[styles.resultTitle, { color: won ? C.sun : C.coral }]}>
            {won ? 'ROPE BURNS!' : 'CPU WINS!'}
          </Text>
          <Text style={styles.resultSub}>
            {won ? 'Flag raised — you win immunity!' : 'The CPU finishes first!'}
          </Text>
        </View>
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Ready screen
  readyRoot:    { backgroundColor: C.night, alignItems: 'center', justifyContent: 'center', padding: 36 },
  readyEyebrow: { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 10 },
  readyTitle:   { fontSize: 34, fontFamily: F.display, fontWeight: '800', color: C.bone, letterSpacing: -1, textAlign: 'center', marginBottom: 16 },
  readyBody:    { fontSize: 13, fontFamily: F.body, color: C.inkSoft, textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  startBtn:     { backgroundColor: C.torch, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 56 },
  startLabel:   { fontSize: 16, fontFamily: F.display, fontWeight: '800', color: C.bone, letterSpacing: 2 },

  // Root
  root: { backgroundColor: C.night },

  // Player header
  playerHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.nightMid },
  youLabel:        { fontSize: 11, fontFamily: F.mono, color: C.palm, letterSpacing: 2, fontWeight: '700' },
  stageLabel:      { flex: 1, fontSize: 10, fontFamily: F.mono, color: C.sun, letterSpacing: 1 },
  strikeCountLabel:{ fontSize: 10, fontFamily: F.mono, color: C.inkSoft },

  // Scene overlays
  emberPulse:  { position: 'absolute', backgroundColor: C.torch },
  flameAnchor: { position: 'absolute' },
  flagWrapper: { position: 'absolute' },
  flagBody:    { width: 24, height: 15, backgroundColor: '#e63946', borderTopRightRadius: 2, borderBottomRightRadius: 2 },

  // Action area
  actionArea:    { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 4, justifyContent: 'center', gap: 6 },
  swipeHint:     { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 1, textAlign: 'center' },
  ropeBarRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ropeBarTrack:  { flex: 1, height: 6, backgroundColor: C.nightMid, borderRadius: 3, overflow: 'hidden' },
  ropeBarFill:   { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.sun, borderRadius: 3 },
  ropeBarPct:    { fontSize: 9, fontFamily: F.mono, color: C.inkMid, width: 30, textAlign: 'right' },
  actionBtn:     { backgroundColor: C.torch, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  actionBtnActive:{ backgroundColor: C.sun, transform: [{ scale: 0.97 }] },
  actionBtnLabel: { fontSize: 15, fontFamily: F.display, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  feedbackText:  { fontSize: 11, fontFamily: F.mono, letterSpacing: 1, textAlign: 'center' },

  // Divider
  divider: { backgroundColor: C.nightMid, alignItems: 'center', justifyContent: 'center' },
  vsLabel:  { fontSize: 8, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2 },

  // CPU panel
  cpuSection:    { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8 },
  cpuHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cpuLabel:      { fontSize: 11, fontFamily: F.mono, color: C.coral, letterSpacing: 2, fontWeight: '700' },
  cpuStageText:  { flex: 1, fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 1 },
  cpuRopeTrack:  { width: 72, height: 5, backgroundColor: C.nightMid, borderRadius: 3, overflow: 'hidden' },
  cpuRopeFill:   { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.coral, borderRadius: 3 },
  cpuScene:      { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  cpuPole:       { width: 7, height: 52, backgroundColor: '#6b4226', borderRadius: 2 },
  cpuFireColumn: { flex: 1, alignItems: 'center' },
  cpuFireTrack:  { width: '100%', height: 52, backgroundColor: C.nightMid, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  cpuFlameFill:  { width: '100%', backgroundColor: C.coral, borderRadius: 4 },
  cpuRightPole:  { alignItems: 'flex-start', gap: 0 },
  cpuFlag:       { width: 18, height: 11, backgroundColor: C.coral, borderRadius: 1, marginLeft: 0 },

  // Result overlay
  resultOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,20,40,0.92)', alignItems: 'center', justifyContent: 'center', zIndex: 99 },
  resultTitle:   { fontSize: 38, fontFamily: F.display, fontWeight: '800', letterSpacing: -1, textAlign: 'center' },
  resultSub:     { fontSize: 13, fontFamily: F.body, color: C.bone, marginTop: 10, opacity: 0.8, textAlign: 'center', paddingHorizontal: 32 },
});
