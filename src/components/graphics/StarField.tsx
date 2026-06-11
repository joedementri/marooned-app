import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C } from '../../tokens/colors';

interface Props {
  count?: number;
  color?: string;
  seed?: number;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export default function StarField({ count = 60, color = C.bone, seed = 42 }: Props) {
  const { width, height } = useWindowDimensions();

  const stars = useMemo(() => {
    const rand = lcg(seed);
    return Array.from({ length: count }, () => ({
      x: rand() * width,
      y: rand() * height * 0.65,
      r: rand() * 1.4 + 0.4,
      op: rand() * 0.5 + 0.3,
    }));
  }, [count, width, height, seed]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={color} opacity={s.op} />
        ))}
      </Svg>
    </View>
  );
}
