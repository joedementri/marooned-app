import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MinigameProps, ParticipantResult } from './types';
import { useChallengeBout } from './useChallengeBout';
import OpponentStatus from '../components/game/OpponentStatus';
import Glyph, { GLYPH_NAMES, type GlyphName } from '../components/graphics/glyphs';
import { mulberry32, hashSeed } from '../engine/rng';
import { aiRng, gauss } from './aiSim';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

// Round-elimination memory: every survivor repeats the pattern each round and
// the slowest is out, until one remains. The pattern starts at 3 symbols and
// grows by one per round (max 8). A mistake replays the pattern for another try
// — but the round clock keeps running, so fumbles make you slow.
const DIFF_MULT = { easy: 1.15, medium: 1.0, hard: 0.9 } as const;
const SHOW = { easy: { showMs: 700, gapMs: 280 }, medium: { showMs: 560, gapMs: 220 }, hard: { showMs: 430, gapMs: 170 } } as const;
const START_LEN = 3;
const MAX_LEN = 8;
const PLAYER_GRACE_MS = 8000;
const MONTAGE_MS = 2200;

type Phase = 'intro' | 'show' | 'input' | 'result' | 'montage' | 'done';

export default function SymbolMatchGame(props: MinigameProps) {
  const { player, mode, seed, finishRanked } = useChallengeBout(props);
  const { difficulty, participants } = props;
  const show = SHOW[difficulty];
  const diffMult = DIFF_MULT[difficulty];
  const live = mode !== 'spectate' && !!player;

  const byId = useMemo(() => new Map(participants.map(p => [p.id, p])), [participants]);

  const survivorsRef = useRef<number[]>(participants.map(p => p.id));
  const eliminatedRef = useRef<number[]>([]);
  const roundRef = useRef(0);
  const seqRef = useRef<number[]>([]);
  const roundStartRef = useRef(0);
  const inputPosRef = useRef(0);
  const playerAliveRef = useRef(live);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const [phase, setPhase] = useState<Phase>('intro');
  const [banner, setBanner] = useState<string | null>(null);
  const [litIndex, setLitIndex] = useState(-1);
  const [inputPos, setInputPos] = useState(0);
  const [round, setRound] = useState(0);
  const [elimVersion, setElimVersion] = useState(0); // bump to refresh status rows
  const [timerView, setTimerView] = useState(0);

  function later(ms: number, fn: () => void) {
    const t = setTimeout(() => { timersRef.current.delete(t); fn(); }, ms);
    timersRef.current.add(t);
    return t;
  }

  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  // Live per-round timer readout.
  useEffect(() => {
    if (phase !== 'input') return;
    const t = setInterval(() => setTimerView(Date.now() - roundStartRef.current), 200);
    return () => clearInterval(t);
  }, [phase]);

  const roundLen = (r: number) => Math.min(START_LEN + r, MAX_LEN);

  function genSeq(r: number): number[] {
    const rng = mulberry32(hashSeed(seed, 'memSeq', r));
    return Array.from({ length: roundLen(r) }, () => Math.floor(rng() * GLYPH_NAMES.length));
  }

  // Skill-driven round time for an AI, deterministic per (seed, id, round).
  function aiRoundTime(id: number, r: number): number {
    const p = byId.get(id)!;
    const rng = aiRng(seed, id, 'mem' + r);
    const perSymbol = (1500 - 900 * p.skill) * diffMult;
    let t = roundLen(r) * perSymbol * (1 + 0.2 * gauss(rng));
    if (rng() < 0.25 - 0.18 * p.skill) t += roundLen(r) * perSymbol * 0.8; // a fumble + retry
    return Math.max(900, Math.round(t));
  }

  function slowestAiTime(r: number): number {
    const ts = survivorsRef.current
      .filter(id => !(player && id === player.id))
      .map(id => aiRoundTime(id, r));
    return ts.length ? Math.max(...ts) : 10000;
  }

  function finishAll(winnerId: number) {
    setPhase('done');
    const order = [winnerId, ...[...eliminatedRef.current].reverse()];
    const n = order.length;
    const results: ParticipantResult[] = order.map((id, i) => ({
      id,
      score: n > 1 ? 0.3 + 0.7 * ((n - 1 - i) / (n - 1)) : 1,
      finished: true,
      timeMs: null,
    }));
    later(900, () => finishRanked(results));
  }

  // Eliminate the slowest of this round; returns the eliminated id.
  function resolveRound(r: number, playerTime: number | null): number {
    const times = new Map<number, number>();
    for (const id of survivorsRef.current) {
      if (player && id === player.id) times.set(id, playerTime ?? Number.POSITIVE_INFINITY);
      else times.set(id, aiRoundTime(id, r));
    }
    let out = -1, worst = -1;
    for (const [id, t] of times) {
      const p = byId.get(id)!;
      if (t > worst || (t === worst && out >= 0 && p.skill < byId.get(out)!.skill)) {
        worst = t; out = id;
      }
    }
    survivorsRef.current = survivorsRef.current.filter(id => id !== out);
    eliminatedRef.current.push(out);
    if (player && out === player.id) playerAliveRef.current = false;
    setElimVersion(v => v + 1);
    return out;
  }

  function afterRound(r: number, outId: number) {
    const outName = player && outId === player.id ? 'YOU ARE' : `${byId.get(outId)!.name.split(' ')[0].toUpperCase()} IS`;
    setBanner(`${outName} OUT — ROUND ${r + 1}`);
    setPhase('result');
    later(1700, () => {
      setBanner(null);
      if (survivorsRef.current.length <= 1) {
        finishAll(survivorsRef.current[0]);
      } else if (playerAliveRef.current) {
        startRound(r + 1);
      } else {
        runMontage(r + 1);
      }
    });
  }

  // AI-only rounds resolve as a quick montage until a winner remains.
  function runMontage(r: number) {
    setPhase('montage');
    setRound(r);
    roundRef.current = r;
    setBanner(`ROUND ${r + 1} — ${roundLen(r)} SYMBOLS`);
    later(MONTAGE_MS * 0.55, () => {
      const out = resolveRound(r, null);
      setBanner(`${byId.get(out)!.name.split(' ')[0].toUpperCase()} IS OUT`);
      later(MONTAGE_MS * 0.45, () => {
        setBanner(null);
        if (survivorsRef.current.length <= 1) finishAll(survivorsRef.current[0]);
        else runMontage(r + 1);
      });
    });
  }

  function playSeq(seq: number[]) {
    setPhase('show');
    setInputPos(0);
    inputPosRef.current = 0;
    let i = 0;
    const step = () => {
      if (i >= seq.length) {
        setLitIndex(-1);
        openInput();
        return;
      }
      setLitIndex(seq[i]);
      later(show.showMs, () => {
        setLitIndex(-1);
        i++;
        later(show.gapMs, step);
      });
    };
    later(500, step);
  }

  function openInput() {
    setPhase('input');
    const r = roundRef.current;
    if (roundStartRef.current === 0) {
      roundStartRef.current = Date.now();
      // Grace cap: fall too far behind the slowest opponent and the round is lost.
      const cap = slowestAiTime(r) + PLAYER_GRACE_MS;
      later(cap, () => {
        if (roundRef.current !== r || !playerAliveRef.current || resolvedRoundsRef.current.has(r)) return;
        resolvedRoundsRef.current.add(r);
        const out = resolveRound(r, null);
        afterRound(r, out);
      });
    }
  }

  // Guards the grace-cap timer against firing after the round resolved normally.
  const resolvedRoundsRef = useRef<Set<number>>(new Set());

  function startRound(r: number) {
    roundRef.current = r;
    roundStartRef.current = 0;
    setRound(r);
    setTimerView(0);
    const seq = genSeq(r);
    seqRef.current = seq;
    setPhase('intro');
    setBanner(`ROUND ${r + 1} — ${seq.length} SYMBOLS`);
    later(1300, () => {
      setBanner(null);
      playSeq(seq);
    });
  }

  function tap(glyphIdx: number) {
    if (phase !== 'input') return;
    const seq = seqRef.current;
    if (glyphIdx === seq[inputPosRef.current]) {
      inputPosRef.current += 1;
      setInputPos(inputPosRef.current);
      if (inputPosRef.current >= seq.length) {
        const r = roundRef.current;
        resolvedRoundsRef.current.add(r);
        const playerTime = Date.now() - roundStartRef.current;
        const out = resolveRound(r, playerTime);
        afterRound(r, out);
      }
    } else {
      // Mistake: flash, then the pattern replays — the clock keeps running.
      setBanner('WRONG — WATCH AGAIN');
      setPhase('result');
      later(700, () => {
        setBanner(null);
        playSeq(seqRef.current);
      });
    }
  }

  // Kick off.
  useEffect(() => {
    if (live) startRound(0);
    else runMontage(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // One elimination per round, so elimination order maps 1:1 to round numbers.
  const statusRows = participants.map(p => {
    const outIdx = eliminatedRef.current.indexOf(p.id);
    const isOut = outIdx >= 0;
    return {
      id: p.id,
      name: p.isPlayer ? 'YOU' : p.name,
      color: p.color,
      status: isOut ? `OUT R${outIdx + 1}` : 'IN',
      active: !isOut,
    };
  });

  const seqLen = seqRef.current.length || roundLen(round);
  const subText =
    phase === 'show' ? 'Memorize the totems…'
    : phase === 'input' ? `Repeat the sequence (${inputPos}/${seqLen}) · ${(timerView / 1000).toFixed(1)}s`
    : phase === 'montage' ? 'Watching the rounds play out…'
    : phase === 'done' ? 'Challenge decided'
    : `Round ${round + 1}`;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>SYMBOL RECALL</Text>
      <Text style={styles.sub}>{subText}</Text>

      <View>
        <View style={styles.grid}>
          {GLYPH_NAMES.map((g: GlyphName, idx) => {
            const lit = litIndex === idx;
            return (
              <Pressable
                key={g}
                style={[styles.cell, lit && styles.cellLit]}
                onPress={() => tap(idx)}
                disabled={phase !== 'input'}
              >
                <Glyph name={g} size={40} color={lit ? C.bone : C.ink} />
              </Pressable>
            );
          })}
        </View>
        {banner && (
          <View style={styles.banner} pointerEvents="none">
            <Text style={styles.bannerText}>{banner}</Text>
          </View>
        )}
      </View>

      <View style={styles.railWrap}>
        <Text style={styles.railLabel}>SURVIVORS · ROUND {round + 1}</Text>
        <OpponentStatus rows={statusRows} key={elimVersion} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { width: '100%', alignItems: 'center', paddingVertical: 8 },
  title:      { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  sub:        { fontSize: 12, fontFamily: F.body, color: C.inkMid, marginBottom: 18, minHeight: 16 },
  grid:       { width: 4 * 70 + 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  cell:       { width: 66, height: 66, backgroundColor: C.bone, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.inkSoft },
  cellLit:    { backgroundColor: C.sun, borderColor: C.ink },
  banner:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  bannerText: { fontSize: 15, fontFamily: F.display, fontWeight: '800', color: C.coral, letterSpacing: 1.5, backgroundColor: 'rgba(247,239,213,0.94)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, overflow: 'hidden', textAlign: 'center' },
  railWrap:   { width: '100%', marginTop: 22 },
  railLabel:  { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 8 },
});
