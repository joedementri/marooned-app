import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { C } from '../../tokens/colors';
import { F } from '../../tokens/fonts';

interface Props {
  name: string;
  flipped: boolean;
  voided?: boolean;
}

// Y-axis card flip: face-down shows parchment back, face-up reveals the name.
export default function ParchmentCard({ name, flipped, voided = false }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (flipped) {
      progress.value = withTiming(1, { duration: 550 });
    }
  }, [flipped, progress]);

  // Front face (parchment back): rotates 0→180 and fades out at midpoint
  const frontStyle = useAnimatedStyle(() => ({
    opacity: progress.value < 0.5 ? 1 : 0,
    transform: [{ rotateY: `${progress.value * 180}deg` }],
  }));

  // Back face (name revealed): starts at -180, rotates to 0 and fades in at midpoint
  const backStyle = useAnimatedStyle(() => ({
    opacity: progress.value >= 0.5 ? 1 : 0,
    transform: [{ rotateY: `${(progress.value - 1) * 180}deg` }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, styles.front, frontStyle]}>
        <Text style={styles.frontGlyph}>M</Text>
      </Animated.View>
      <Animated.View style={[styles.card, styles.back, voided && styles.backVoided, backStyle]}>
        <Text
          style={[styles.voteName, voided && styles.voteNameVoided]}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {name}
        </Text>
        {voided && <Text style={styles.voidedLabel}>VOID</Text>}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { width: 76, height: 104, margin: 5 },
  card:           { position: 'absolute', width: '100%', height: '100%', borderRadius: 8, alignItems: 'center', justifyContent: 'center', padding: 6 },
  front:          { backgroundColor: '#c9b98c', borderWidth: 1.5, borderColor: '#a09060' },
  back:           { backgroundColor: '#f5eed8', borderWidth: 1.5, borderColor: '#b0924a' },
  backVoided:     { backgroundColor: '#c0b8a8', borderColor: '#888' },
  frontGlyph:     { fontSize: 22, fontFamily: F.display, color: '#8a7a50', fontWeight: '800' },
  voteName:       { fontSize: 13, fontFamily: F.body, fontWeight: '700', color: C.ink, textAlign: 'center' },
  voteNameVoided: { textDecorationLine: 'line-through', color: C.inkSoft },
  voidedLabel:    { fontSize: 8, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 1, marginTop: 3 },
});
