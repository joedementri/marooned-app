import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const COLORS = ['#e85a4f', '#f4a83a', '#5a9e6f', '#3d5a7c', '#c98a2a', '#f7efd5'];
const PIECES = 24;
const DURATION = 2200;

interface PieceSpec {
  x: number;       // 0..1 horizontal start
  drift: number;   // horizontal drift in px
  delay: number;
  fall: number;    // fall duration
  size: number;
  color: string;
  spin: number;    // total rotation deg
}

function Piece({ spec, screenH }: { spec: PieceSpec; screenH: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(spec.delay, withTiming(1, {
      duration: spec.fall,
      easing: Easing.in(Easing.quad),
    }));
  }, [t, spec]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -30 + t.value * (screenH + 60) },
      { translateX: t.value * spec.drift },
      { rotate: `${t.value * spec.spin}deg` },
    ],
    opacity: t.value < 0.85 ? 1 : (1 - t.value) / 0.15,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        {
          left: `${spec.x * 100}%` as any,
          width: spec.size,
          height: spec.size * 1.6,
          backgroundColor: spec.color,
        },
        style,
      ]}
    />
  );
}

// A short, dependency-free confetti celebration. Mount it when the moment
// happens; it cleans itself up after the burst.
export default function ConfettiBurst() {
  const [done, setDone] = useState(false);
  const screenH = Dimensions.get('window').height;

  const pieces = useMemo<PieceSpec[]>(() =>
    Array.from({ length: PIECES }, (_, i) => ({
      x: Math.random(),
      drift: (Math.random() - 0.5) * 120,
      delay: Math.random() * 400,
      fall: DURATION * (0.7 + Math.random() * 0.5),
      size: 6 + Math.random() * 6,
      color: COLORS[i % COLORS.length],
      spin: (Math.random() - 0.5) * 720,
    })), []);

  useEffect(() => {
    const t = setTimeout(() => setDone(true), 3000);
    return () => clearTimeout(t);
  }, []);

  if (done) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((spec, i) => (
        <Piece key={i} spec={spec} screenH={screenH} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, borderRadius: 2 },
});
