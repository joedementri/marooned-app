import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C } from '../../tokens/colors';
import { F } from '../../tokens/fonts';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export default function ScreenHeader({ title, subtitle, onBack }: Props) {
  return (
    <View style={styles.root}>
      {onBack && (
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { paddingTop: 16, paddingBottom: 20 },
  backBtn:   { marginBottom: 6 },
  backArrow: { fontSize: 20, color: C.ink, fontFamily: F.body },
  title:     { fontSize: 24, fontFamily: F.display, color: C.ink, letterSpacing: -0.5 },
  subtitle:  { fontSize: 11, fontFamily: F.body, color: C.inkMid, letterSpacing: 1.5, marginTop: 2, textTransform: 'uppercase' },
});
