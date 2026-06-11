import React, { useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootParamList } from '../navigation/types';
import { CampScene, type TimeOfDay } from '../components/graphics';
import { useAudio } from '../hooks/useAudio';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

type Props = StackScreenProps<RootParamList, 'Loading'>;

const TITLE = 'MAROONED';

function Letter({
  char,
  progress,
  idx,
  total,
}: {
  char: string;
  progress: SharedValue<number>;
  idx: number;
  total: number;
}) {
  const start = idx / total;
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [start, start + 0.25], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [start, start + 0.25],
          [22, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  return <Animated.Text style={[styles.titleLetter, animStyle]}>{char}</Animated.Text>;
}

export default function LoadingScreen({ navigation }: Props) {
  const { height } = useWindowDimensions();
  const [timeOfDay] = useState<TimeOfDay>('dusk');
  const progress = useSharedValue(0);
  useAudio('camp');
  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.7, 1], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    progress.value = withTiming(1, { duration: 1800 });
    const nav = setTimeout(() => navigation.replace('MainMenu'), 2500);
    return () => clearTimeout(nav);
  }, []);

  return (
    <View style={styles.root}>
      <CampScene timeOfDay={timeOfDay} height={height} />
      <View style={[StyleSheet.absoluteFill, styles.overlay]}>
        <View style={styles.titleRow}>
          {TITLE.split('').map((char, i) => (
            <Letter key={i} char={char} progress={progress} idx={i} total={TITLE.length} />
          ))}
        </View>
        <Animated.Text style={[styles.subtitle, subtitleStyle]}>A SURVIVAL GAME</Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.night },
  overlay:     { alignItems: 'center', justifyContent: 'center' },
  titleRow:    { flexDirection: 'row' },
  titleLetter: { fontFamily: F.display, fontSize: 44, color: C.bone, letterSpacing: 2 },
  subtitle:    { fontFamily: F.body, fontSize: 11, color: C.sand, letterSpacing: 4, marginTop: 10, textTransform: 'uppercase' },
});
