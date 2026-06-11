import React from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from '../../tokens/colors';

interface Props {
  color?: string;
  height?: number;
}

export default function WaveBand({ color = C.ocean, height = 48 }: Props) {
  const { width } = useWindowDimensions();
  const h = height;
  const w = width;

  // Two layered wave paths for depth
  const wave1 = `M0,${h * 0.55} C${w * 0.18},${h * 0.15} ${w * 0.38},${h * 0.85} ${w * 0.55},${h * 0.45} C${w * 0.72},${h * 0.05} ${w * 0.88},${h * 0.7} ${w},${h * 0.35} L${w},${h} L0,${h} Z`;
  const wave2 = `M0,${h * 0.75} C${w * 0.2},${h * 0.45} ${w * 0.42},${h * 0.95} ${w * 0.6},${h * 0.65} C${w * 0.78},${h * 0.35} ${w * 0.9},${h * 0.85} ${w},${h * 0.6} L${w},${h} L0,${h} Z`;

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Path d={wave1} fill={color} opacity={0.6} />
      <Path d={wave2} fill={color} opacity={0.9} />
    </Svg>
  );
}
