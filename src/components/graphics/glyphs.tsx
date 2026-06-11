import React from 'react';
import Svg, { Circle, Path, Polygon, Line, Rect, G } from 'react-native-svg';

// A small set of flat island symbols used by the puzzle/memory minigames. Drawn
// from primitives in a 100×100 viewBox so they scale cleanly and stay on-style.

export type GlyphName = 'sun' | 'wave' | 'palm' | 'fish' | 'shell' | 'flame' | 'skull' | 'totem';

export const GLYPH_NAMES: GlyphName[] = ['sun', 'wave', 'palm', 'fish', 'shell', 'flame', 'skull', 'totem'];

interface Props {
  name: GlyphName;
  size?: number;
  color?: string;
}

export default function Glyph({ name, size = 48, color = '#2a1a0a' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {render(name, color)}
    </Svg>
  );
}

function render(name: GlyphName, c: string) {
  switch (name) {
    case 'sun':
      return (
        <G stroke={c} strokeWidth={5} strokeLinecap="round">
          <Circle cx={50} cy={50} r={18} fill={c} />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * Math.PI) / 4;
            return (
              <Line key={i}
                x1={50 + Math.cos(a) * 28} y1={50 + Math.sin(a) * 28}
                x2={50 + Math.cos(a) * 40} y2={50 + Math.sin(a) * 40} />
            );
          })}
        </G>
      );
    case 'wave':
      return (
        <G stroke={c} strokeWidth={6} fill="none" strokeLinecap="round">
          <Path d="M12 42 Q30 26 50 42 T88 42" />
          <Path d="M12 64 Q30 48 50 64 T88 64" />
        </G>
      );
    case 'palm':
      return (
        <G stroke={c} strokeWidth={5} strokeLinecap="round" fill="none">
          <Path d="M50 88 Q52 60 50 38" strokeWidth={7} />
          <Path d="M50 38 Q30 26 16 32" />
          <Path d="M50 38 Q70 26 84 32" />
          <Path d="M50 38 Q34 22 28 14" />
          <Path d="M50 38 Q66 22 72 14" />
          <Circle cx={50} cy={36} r={4} fill={c} />
        </G>
      );
    case 'fish':
      return (
        <G fill={c}>
          <Path d="M20 50 Q44 30 70 50 Q44 70 20 50 Z" />
          <Polygon points="70,50 88,38 88,62" />
          <Circle cx={34} cy={47} r={3.5} fill="#fff" />
        </G>
      );
    case 'shell':
      return (
        <G stroke={c} strokeWidth={4} fill="none" strokeLinecap="round">
          <Path d="M50 78 Q14 64 22 30 Q50 16 78 30 Q86 64 50 78 Z" fill={c} stroke="none" />
          <Line x1={50} y1={30} x2={50} y2={74} stroke="#fff" />
          <Line x1={38} y1={33} x2={34} y2={70} stroke="#fff" />
          <Line x1={62} y1={33} x2={66} y2={70} stroke="#fff" />
        </G>
      );
    case 'flame':
      return (
        <Path d="M50 14 Q70 40 60 58 Q58 40 50 36 Q54 54 40 62 Q30 50 40 38 Q42 52 50 14 Z"
          fill={c} />
      );
    case 'skull':
      return (
        <G fill={c}>
          <Path d="M50 16 Q78 16 78 46 Q78 60 68 66 L68 78 Q50 86 32 78 L32 66 Q22 60 22 46 Q22 16 50 16 Z" />
          <Circle cx={38} cy={46} r={7} fill="#fff" />
          <Circle cx={62} cy={46} r={7} fill="#fff" />
          <Polygon points="50,54 45,66 55,66" fill="#fff" />
        </G>
      );
    case 'totem':
      return (
        <G fill={c}>
          <Rect x={32} y={16} width={36} height={68} rx={8} />
          <Polygon points="38,40 50,30 62,40" fill="#fff" />
          <Circle cx={42} cy={54} r={4} fill="#fff" />
          <Circle cx={58} cy={54} r={4} fill="#fff" />
          <Rect x={40} y={66} width={20} height={5} rx={2.5} fill="#fff" />
        </G>
      );
  }
}
