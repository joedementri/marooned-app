import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import { C } from '../../tokens/colors';
import { F } from '../../tokens/fonts';

interface Props {
  name: string;
  voided: boolean;   // idoled-out votes shake and get struck through
  decisive: boolean; // the vote that seals the boot lands harder
}

// A single revealed vote parchment at tribal council.
export default function VoteParchment({ name, voided, decisive }: Props) {
  const scale = useSharedValue(0.85);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(decisive ? 1.1 : 1.06, { duration: 180 }),
      withSpring(1, { damping: 12 }),
    );
    if (voided) {
      shakeX.value = withSequence(
        withTiming(0, { duration: 250 }),
        withRepeat(withTiming(6, { duration: 60 }), 5, true),
        withTiming(0, { duration: 60 }),
      );
    }
  }, [name, voided, decisive, scale, shakeX]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: shakeX.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      style={[styles.parchment, decisive && styles.parchmentDecisive, animStyle]}
    >
      {voided && <Text style={styles.voidLabel}>✕ DOES NOT COUNT</Text>}
      <Text style={[styles.name, voided && styles.nameVoided]}>{name}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  parchment: {
    backgroundColor: '#f5e8c8',
    borderWidth: 2,
    borderColor: '#8a6a40',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  parchmentDecisive: { borderColor: C.torch, shadowOpacity: 0.7 },
  voidLabel: { fontSize: 10, fontFamily: F.mono, color: C.coral, letterSpacing: 2, marginBottom: 4 },
  name: { fontSize: 32, fontFamily: F.display, fontWeight: '800', color: '#2a1a0a', letterSpacing: -0.5 },
  nameVoided: { textDecorationLine: 'line-through', color: C.coral, opacity: 0.7 },
});
