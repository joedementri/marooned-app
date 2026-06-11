import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import type { FireState, FireStage } from './fireMachine';
import { NEST_NEEDED } from './fireMachine';
import { C } from '../../tokens/colors';
import { F } from '../../tokens/fonts';

interface Props {
  state: FireState;
  width: number;
  height: number;
  label: string;
  color: string;
  flicker?: number; // 0..1 shared flicker phase
}

function stageLabel(s: FireStage): string {
  switch (s) {
    case 'nest':        return 'BUILD NEST';
    case 'shave':       return 'SHAVE MAGNESIUM';
    case 'strike':      return 'STRIKE FLINT';
    case 'ember':       return 'BLOW EMBER';
    case 'smallSticks': return 'SMALL STICKS';
    case 'largeSticks': return 'LARGE STICKS';
    case 'ropeBurn':    return 'BURN THE ROPE';
    case 'done':        return 'FLAG UP!';
  }
}

// One competitor's fire rig, drawn from the FireState. Pure/visual — all logic
// lives in fireMachine. Two of these sit side by side in the host.
export default function FireRig({ state, width, height, label, color, flicker = 1 }: Props) {
  const cx = width / 2;
  const poleTop = 24;
  const poleBot = height - 40;
  const leftX = width * 0.2;
  const rightX = width * 0.8;
  const ropeY = poleTop + 4;
  const baseY = poleBot - 6;
  const flameMax = baseY - ropeY - 10;
  const flameH = Math.max(0, (state.flameHeight / 100) * flameMax) * (0.9 + flicker * 0.1);
  const done = state.stage === 'done';
  const ropeGone = done || state.ropeBurn >= 100;

  return (
    <View style={[styles.rig, { width }]}>
      <View style={styles.header}>
        <Text style={[styles.name, { color }]} numberOfLines={1}>{label}</Text>
        <Text style={styles.stage}>{stageLabel(state.stage)}</Text>
      </View>

      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} fill={C.night} />
        {/* ground */}
        <Rect x={0} y={poleBot} width={width} height={height - poleBot} fill="#1c1208" />

        {/* poles */}
        <Rect x={leftX - 4} y={poleTop} width={8} height={poleBot - poleTop} rx={3} fill="#6b4226" />
        <Rect x={rightX - 4} y={poleTop} width={8} height={poleBot - poleTop} rx={3} fill="#6b4226" />

        {/* rope */}
        {!ropeGone && (
          <Line
            x1={leftX} y1={ropeY} x2={rightX} y2={ropeY}
            stroke={state.stage === 'ropeBurn' && state.ropeBurn > 50 ? '#888' : C.bone}
            strokeWidth={3}
            opacity={state.stage === 'ropeBurn' ? 1 - (state.ropeBurn / 100) * 0.6 : 1}
            strokeDasharray={state.stage === 'ropeBurn' && state.ropeBurn > 30 ? '8 5' : undefined}
          />
        )}

        {/* nest / kindling */}
        <Ellipse cx={cx} cy={baseY + 6} rx={26} ry={8} fill="#160e04" />
        {Array.from({ length: Math.min(state.nestPieces, NEST_NEEDED) }).map((_, i) => (
          <Rect key={i} x={cx - 20 + i * 6} y={baseY - 2} width={40} height={3} rx={1.5}
            fill="#5c3a1e" transform={`rotate(${-12 + i * 12},${cx},${baseY})`} />
        ))}

        {/* magnesium block during shave/strike */}
        {(state.stage === 'shave' || state.stage === 'strike') && (
          <G transform={`rotate(-20,${cx},${baseY - 14})`}>
            <Rect x={cx - 14} y={baseY - 18} width={28} height={9} rx={3} fill="#8c8c8c" />
            <Rect x={cx - 11} y={baseY - 16} width={22} height={4} rx={2} fill="#cfcfcf" opacity={0.6} />
          </G>
        )}

        {/* ember glow */}
        {state.stage === 'ember' && (
          <Circle cx={cx} cy={baseY - 4} r={5 + (state.emberHealth / 100) * 12} fill={C.torch} opacity={0.4} />
        )}

        {/* flame */}
        {flameH > 2 && (
          <G>
            <Path
              d={flamePath(cx, baseY, 30 * (0.9 + flicker * 0.1), flameH)}
              fill={C.torch}
            />
            <Path d={flamePath(cx, baseY, 20, flameH * 0.7)} fill={C.sun} />
            <Path d={flamePath(cx, baseY, 9, flameH * 0.4)} fill={C.bone} opacity={0.85} />
          </G>
        )}

        {/* flag on right pole — flips up when done */}
        <G>
          <Line
            x1={rightX} y1={poleTop}
            x2={rightX + (done ? 22 : 2)} y2={done ? poleTop : poleTop + 18}
            stroke="#e63946" strokeWidth={done ? 12 : 10}
            opacity={done ? 1 : 0.85}
          />
        </G>
      </Svg>

      <View style={styles.barRow}>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.round(state.ropeBurn)}%`, backgroundColor: color }]} />
        </View>
        <Text style={styles.barPct}>{Math.round(state.ropeBurn)}%</Text>
      </View>
    </View>
  );
}

// A simple symmetric flame teardrop anchored at (cx, baseY) rising by h with width w.
function flamePath(cx: number, baseY: number, w: number, h: number): string {
  const top = baseY - h;
  return `M ${cx} ${baseY} Q ${cx - w} ${baseY - h * 0.5} ${cx - w * 0.4} ${baseY - h * 0.7} Q ${cx - w * 0.2} ${top} ${cx} ${top} Q ${cx + w * 0.2} ${top} ${cx + w * 0.4} ${baseY - h * 0.7} Q ${cx + w} ${baseY - h * 0.5} ${cx} ${baseY} Z`;
}

const styles = StyleSheet.create({
  rig:      { alignItems: 'center' },
  header:   { width: '100%', alignItems: 'center', paddingVertical: 6 },
  name:     { fontSize: 12, fontFamily: F.mono, fontWeight: '700', letterSpacing: 1 },
  stage:    { fontSize: 9, fontFamily: F.mono, color: C.sun, letterSpacing: 1, marginTop: 2 },
  barRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, width: '88%', marginTop: 8 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.nightMid, overflow: 'hidden' },
  barFill:  { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  barPct:   { fontSize: 9, fontFamily: F.mono, color: C.inkSoft, width: 30, textAlign: 'right' },
});
