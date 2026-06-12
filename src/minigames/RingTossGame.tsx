import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Ellipse, Line, Rect, G, Text as SvgText } from 'react-native-svg';
import type { MinigameProps, ParticipantResult } from './types';
import { useChallengeBout } from './useChallengeBout';
import { aiRng } from './aiSim';
import { mulberry32, hashSeed } from '../engine/rng';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function clamp01(v: number) { return clamp(v, 0, 1); }

// Everyone throws 8 rings; difficulty tightens the catch radius. Center peg is
// the easy shot (+1), the outer pegs pay double (+2). Ties at the top go to a
// 3-ring tiebreak among the tied players (up to 3 rounds, then a seeded coin).
const CFG = {
  easy:   { catch: 34, aiBase: 0.45 },
  medium: { catch: 26, aiBase: 0.35 },
  hard:   { catch: 20, aiBase: 0.27 },
} as const;

const MAIN_RINGS = 8;
const TB_RINGS = 3;
const MAX_TB_ROUNDS = 3;
const H = 230;
const MAX_PULL = 150;
const PEG_PTS = [2, 1, 2]; // outer, center, outer
const MAX_SCORE = 17;      // 16 possible points + tiebreak fraction headroom

type Phase = 'main' | 'tiebreak' | 'done';

// One simulated ring: pick a target by confidence, then roll the hit.
function sampleRing(skill: number, rng: () => number, base: number): number {
  const aimOuter = rng() < 0.3 + 0.55 * skill;
  const hitP = clamp01(base + 0.45 * skill + (aimOuter ? -0.12 : 0));
  if (rng() >= hitP) return 0;
  return aimOuter ? 2 : 1;
}

export default function RingTossGame(props: MinigameProps) {
  const { player, mode, seed, finishRanked } = useChallengeBout(props);
  const { difficulty, participants } = props;
  const cfg = CFG[difficulty];
  const live = mode !== 'spectate' && !!player;
  const aiList = useMemo(() => participants.filter(p => !p.isPlayer), [participants]);

  const { width } = useWindowDimensions();
  const beamW = Math.min(width - 48, 360);
  const anchorX = beamW / 2;
  const anchorY = H - 28;
  const pegY = 48;
  const pegXs = [beamW * 0.22, beamW * 0.5, beamW * 0.78];

  // Per-AI deterministic streams; the main-phase 8 rings are sampled up front so
  // the scoreboard can reveal them in sync with the player's throws.
  const aiData = useRef<{ streams: Map<number, () => number>; main: Map<number, number[]> } | null>(null);
  if (!aiData.current) {
    const streams = new Map<number, () => number>();
    const main = new Map<number, number[]>();
    for (const p of aiList) {
      const rng = aiRng(seed, p.id, 'ring');
      streams.set(p.id, rng);
      main.set(p.id, Array.from({ length: MAIN_RINGS }, () => sampleRing(p.skill, rng, cfg.aiBase)));
    }
    aiData.current = { streams, main };
  }

  const [phase, setPhase] = useState<Phase>('main');
  const [thrown, setThrown] = useState(0);
  const [points, setPoints] = useState(0);
  const [tbThrown, setTbThrown] = useState(0);
  const [tbPoints, setTbPoints] = useState(0);
  const [tied, setTied] = useState<number[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [pegHits, setPegHits] = useState<number[]>([0, 0, 0]);
  const [aim, setAim] = useState<number | null>(null);
  const [ring, setRing] = useState<{ x: number; y: number } | null>(null);

  const phaseRef = useRef<Phase>('main');
  const thrownRef = useRef(0);
  const pointsRef = useRef(0);
  const tbThrownRef = useRef(0);
  const tbPointsRef = useRef(0);
  const tbRoundRef = useRef(0);
  const tiedRef = useRef<number[]>([]);
  const playerInTbRef = useRef(false);
  const totalsRef = useRef<Map<number, number>>(new Map());
  const tbScoreRef = useRef<Map<number, number>>(new Map());
  const aiTbRef = useRef<Map<number, number[]>>(new Map());
  const flying = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });

  function aiMainRevealed(id: number, upTo: number): number {
    const rings = aiData.current!.main.get(id) ?? [];
    return rings.slice(0, upTo).reduce((a, b) => a + b, 0);
  }

  function aiTbRevealed(id: number, upTo: number): number {
    const rings = aiTbRef.current.get(id) ?? [];
    return rings.slice(0, upTo).reduce((a, b) => a + b, 0);
  }

  function addTbScore(id: number, pts: number, round: number) {
    const prev = tbScoreRef.current.get(id) ?? 0;
    tbScoreRef.current.set(id, prev + pts * Math.pow(0.1, round));
  }

  function finishAll() {
    phaseRef.current = 'done';
    setPhase('done');
    const results: ParticipantResult[] = participants.map(p => {
      const pts = totalsRef.current.get(p.id) ?? 0;
      const tb = tbScoreRef.current.get(p.id) ?? 0;
      return { id: p.id, score: clamp01((pts + tb) / MAX_SCORE), finished: true, timeMs: null };
    });
    finishRanked(results);
  }

  // Resolve an AI-only tie synchronously: sample tiebreak rings round by round,
  // narrowing the tied set; a seeded coin settles anything left after 3 rounds.
  function resolveAiTie(tiedIds: number[], startRound: number) {
    let pool = tiedIds;
    for (let round = startRound; round <= MAX_TB_ROUNDS && pool.length > 1; round++) {
      const roundPts = new Map<number, number>();
      for (const id of pool) {
        const p = participants.find(q => q.id === id)!;
        const rng = aiData.current!.streams.get(id)!;
        let pts = 0;
        for (let i = 0; i < TB_RINGS; i++) pts += sampleRing(p.skill, rng, cfg.aiBase);
        roundPts.set(id, pts);
        addTbScore(id, pts, round);
      }
      const top = Math.max(...pool.map(id => roundPts.get(id)!));
      pool = pool.filter(id => roundPts.get(id) === top);
    }
    if (pool.length > 1) {
      const coin = mulberry32(hashSeed(seed, 'ring-coin'));
      const winner = pool[Math.floor(coin() * pool.length)];
      addTbScore(winner, 0.5, MAX_TB_ROUNDS + 1);
    }
  }

  function startTbRound(tiedIds: number[], round: number) {
    tiedRef.current = tiedIds;
    tbRoundRef.current = round;
    tbThrownRef.current = 0;
    tbPointsRef.current = 0;
    playerInTbRef.current = true;
    const tb = new Map<number, number[]>();
    for (const id of tiedIds) {
      if (player && id === player.id) continue;
      const p = participants.find(q => q.id === id)!;
      const rng = aiData.current!.streams.get(id)!;
      tb.set(id, Array.from({ length: TB_RINGS }, () => sampleRing(p.skill, rng, cfg.aiBase)));
    }
    aiTbRef.current = tb;
    phaseRef.current = 'tiebreak';
    setPhase('tiebreak');
    setTied(tiedIds);
    setTbThrown(0);
    setTbPoints(0);
    setPegHits([0, 0, 0]);
    setBanner(`TIEBREAK — ${TB_RINGS} RINGS`);
    setTimeout(() => setBanner(null), 1500);
  }

  function resolveMain() {
    const totals = totalsRef.current;
    for (const p of aiList) totals.set(p.id, aiMainRevealed(p.id, MAIN_RINGS));
    if (live && player) totals.set(player.id, pointsRef.current);

    const ids = participants.map(p => p.id);
    const top = Math.max(...ids.map(id => totals.get(id) ?? 0));
    const tiedIds = ids.filter(id => (totals.get(id) ?? 0) === top);

    if (tiedIds.length <= 1) { finishAll(); return; }

    if (live && player && tiedIds.includes(player.id)) {
      startTbRound(tiedIds, 1);
    } else {
      resolveAiTie(tiedIds, 1);
      setBanner('TIEBREAK!');
      setTimeout(() => { setBanner(null); finishAll(); }, 1600);
    }
  }

  function resolveTbRound() {
    const round = tbRoundRef.current;
    const pool = tiedRef.current;
    const roundPts = new Map<number, number>();
    for (const id of pool) {
      const pts = player && id === player.id ? tbPointsRef.current : aiTbRevealed(id, TB_RINGS);
      roundPts.set(id, pts);
      addTbScore(id, pts, round);
    }
    const top = Math.max(...pool.map(id => roundPts.get(id)!));
    const newTied = pool.filter(id => roundPts.get(id) === top);

    if (newTied.length === 1) { finishAll(); return; }
    const playerStillIn = !!player && newTied.includes(player.id);
    if (round < MAX_TB_ROUNDS && playerStillIn) {
      startTbRound(newTied, round + 1);
    } else if (round < MAX_TB_ROUNDS) {
      resolveAiTie(newTied, round + 1);
      setBanner('TIEBREAK!');
      setTimeout(() => { setBanner(null); finishAll(); }, 1400);
    } else {
      const coin = mulberry32(hashSeed(seed, 'ring-coin'));
      const winner = newTied[Math.floor(coin() * newTied.length)];
      addTbScore(winner, 0.5, MAX_TB_ROUNDS + 1);
      finishAll();
    }
  }

  function canThrow(): boolean {
    if (flying.current) return false;
    if (phaseRef.current === 'main') return live && thrownRef.current < MAIN_RINGS;
    if (phaseRef.current === 'tiebreak') return live && playerInTbRef.current && tbThrownRef.current < TB_RINGS;
    return false;
  }

  function resolveThrow(landingX: number) {
    let best = -1, bestD = Infinity;
    pegXs.forEach((px, i) => {
      const d = Math.abs(px - landingX);
      if (d < bestD) { bestD = d; best = i; }
    });
    const pts = best >= 0 && bestD < cfg.catch ? PEG_PTS[best] : 0;
    if (pts > 0) {
      setPegHits(prev => { const n = [...prev]; n[best] += 1; return n; });
    }
    setRing(null);
    flying.current = false;

    if (phaseRef.current === 'main') {
      pointsRef.current += pts;
      thrownRef.current += 1;
      setPoints(pointsRef.current);
      setThrown(thrownRef.current);
      if (thrownRef.current >= MAIN_RINGS) setTimeout(resolveMain, 900);
    } else if (phaseRef.current === 'tiebreak') {
      tbPointsRef.current += pts;
      tbThrownRef.current += 1;
      setTbPoints(tbPointsRef.current);
      setTbThrown(tbThrownRef.current);
      if (tbThrownRef.current >= TB_RINGS) setTimeout(resolveTbRound, 900);
    }
  }

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

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        startRef.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
      },
      onPanResponderMove: (_evt, g) => {
        if (!canThrow()) return;
        const landing = clamp(anchorX + (g.dx / MAX_PULL) * beamW * 0.9, 0, beamW);
        setAim(landing);
      },
      onPanResponderRelease: (_evt, g) => {
        if (!canThrow()) { setAim(null); return; }
        const pull = Math.hypot(g.dx, g.dy);
        if (pull < 18) { setAim(null); return; }
        const landing = clamp(anchorX + (g.dx / MAX_PULL) * beamW * 0.9, 0, beamW);
        launch(landing);
      },
    })
  ).current;

  // Spectate: reveal the field's rings on a timer, then resolve.
  useEffect(() => {
    if (live) return;
    const t = setInterval(() => {
      thrownRef.current += 1;
      setThrown(thrownRef.current);
      if (thrownRef.current >= MAIN_RINGS) {
        clearInterval(t);
        setTimeout(resolveMain, 700);
      }
    }, 600);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const inTb = phase === 'tiebreak';
  const ringsLeft = inTb ? TB_RINGS - tbThrown : MAIN_RINGS - thrown;
  const playerPts = inTb ? `${points} pts · TB +${tbPoints}` : `${points} pts`;

  const scoreboardRows = participants
    .filter(p => live ? !p.isPlayer : true)
    .map(p => {
      const revealed = phase === 'main' ? aiMainRevealed(p.id, thrown) : aiMainRevealed(p.id, MAIN_RINGS);
      const isTied = inTb && tied.includes(p.id);
      const tb = isTied && !p.isPlayer ? aiTbRevealed(p.id, tbThrown) : null;
      return { p, revealed, isTied, tb };
    })
    .sort((a, b) => b.revealed - a.revealed);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>RING TOSS</Text>
      {live ? (
        <Text style={styles.sub}>
          {inTb ? 'Tiebreak! ' : ''}Flick toward a post · {ringsLeft} rings left · {playerPts}
        </Text>
      ) : (
        <Text style={styles.sub}>Watching the rings fly… {thrown}/{MAIN_RINGS}</Text>
      )}

      <View style={{ width: beamW, height: H }} {...(live ? pan.panHandlers : {})}>
        <Svg width={beamW} height={H}>
          {/* sand ground */}
          <Rect x={0} y={H - 18} width={beamW} height={18} fill={C.sandMid} />
          {/* pegs */}
          {pegXs.map((px, i) => (
            <G key={i}>
              <Rect x={px - 4} y={pegY} width={8} height={H - pegY - 18} rx={3} fill={C.palmDeep} />
              <Ellipse cx={px} cy={pegY} rx={10} ry={5} fill={C.palm} />
              {/* point value badge */}
              <Circle cx={px} cy={pegY - 22} r={11} fill={C.bone} stroke={C.ink} strokeWidth={1.5} />
              <SvgText x={px} y={pegY - 18} fontSize={10} fontWeight="bold" fill={C.ink} textAnchor="middle">
                {`+${PEG_PTS[i]}`}
              </SvgText>
              {Array.from({ length: Math.min(pegHits[i], 4) }).map((_, r) => (
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
          ) : live && phase !== 'done' ? (
            <Ellipse cx={anchorX} cy={anchorY} rx={16} ry={9} fill="none" stroke={C.coral} strokeWidth={5} />
          ) : null}
        </Svg>
        {banner && (
          <View style={styles.banner} pointerEvents="none">
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        )}
      </View>

      <View style={styles.railWrap}>
        <Text style={styles.railLabel}>THE FIELD</Text>
        {scoreboardRows.map(({ p, revealed, isTied, tb }) => (
          <View key={p.id} style={[styles.scoreRow, isTied && styles.scoreRowTied]}>
            <View style={[styles.dot, { backgroundColor: p.color }]} />
            <Text style={styles.scoreName} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
            <Text style={styles.scorePts}>
              {revealed} pts{tb != null ? ` · TB +${tb}` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { width: '100%', alignItems: 'center', paddingVertical: 8 },
  title:        { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  sub:          { fontSize: 12, fontFamily: F.body, color: C.inkMid, marginBottom: 14 },
  banner:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  bannerText:   { fontSize: 22, fontFamily: F.display, color: C.coral, letterSpacing: 2, backgroundColor: 'rgba(247,239,213,0.92)', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10, overflow: 'hidden' },
  railWrap:     { width: '100%', marginTop: 18 },
  railLabel:    { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 8 },
  scoreRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6 },
  scoreRowTied: { backgroundColor: C.sandMid },
  dot:          { width: 12, height: 12, borderRadius: 6 },
  scoreName:    { flex: 1, fontSize: 11, fontFamily: F.mono, color: C.ink, letterSpacing: 1 },
  scorePts:     { fontSize: 11, fontFamily: F.mono, color: C.inkMid, letterSpacing: 1 },
});
