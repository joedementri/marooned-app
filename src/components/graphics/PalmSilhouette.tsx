import React from 'react';
import { View } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { C } from '../../tokens/colors';

interface Props {
  color?: string;
  height?: number;
  flip?: boolean;
}

export default function PalmSilhouette({ color = C.palmDeep, height = 120, flip = false }: Props) {
  const w = height * 0.55;
  return (
    <View style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Svg width={w} height={height} viewBox="0 0 55 120">
        <G fill={color}>
          {/* Trunk: curves from bottom-center up-right to crown */}
          <Path d="M24,120 C26,95 29,72 33,52 C35,44 36,40 34,37 L32,37 C30,40 28,44 27,52 C24,72 22,95 22,120 Z" />
          {/* Right frond */}
          <Path d="M33,39 Q46,26 53,12 Q48,20 41,34 Z" />
          {/* Right-high frond */}
          <Path d="M33,38 Q44,20 46,5 Q42,14 36,34 Z" />
          {/* Center frond */}
          <Path d="M33,37 Q31,18 30,4 Q32,16 35,35 Z" />
          {/* Left-high frond */}
          <Path d="M32,38 Q20,20 18,5 Q22,14 30,34 Z" />
          {/* Left frond */}
          <Path d="M32,39 Q16,28 8,14 Q14,22 28,36 Z" />
          {/* Coconut cluster */}
          <Path d="M32,41 Q36,42 36,45 Q34,47 31,46 Q29,44 30,41 Z" />
        </G>
      </Svg>
    </View>
  );
}
