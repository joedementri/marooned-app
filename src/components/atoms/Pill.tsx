import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { C } from '../../tokens/colors';
import { F } from '../../tokens/fonts';

interface Props {
  label: string;
  bg?: string;
  color?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export default function Pill({ label, bg = C.sandMid, color = C.ink, size = 'md', style }: Props) {
  return (
    <View style={[styles.base, size === 'sm' ? styles.sm : styles.md, { backgroundColor: bg }, style]}>
      <Text style={[styles.label, size === 'sm' ? styles.smText : styles.mdText, { color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base:   { borderRadius: 100, alignSelf: 'flex-start' },
  sm:     { paddingHorizontal: 6, paddingVertical: 2 },
  md:     { paddingHorizontal: 10, paddingVertical: 4 },
  label:  { fontFamily: F.body, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  smText: { fontSize: 9 },
  mdText: { fontSize: 11 },
});
