import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { C } from '../../tokens/colors';
import { F } from '../../tokens/fonts';

export type GButtonVariant = 'primary' | 'ghost' | 'danger' | 'ocean';

interface Props {
  label: string;
  onPress: () => void;
  variant?: GButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
}

const BG: Record<GButtonVariant, string> = {
  primary: C.bone,
  ghost:   'transparent',
  danger:  C.coral,
  ocean:   C.ocean,
};

const LABEL_COLOR: Record<GButtonVariant, string> = {
  primary: C.ink,
  ghost:   C.inkMid,
  danger:  C.bone,
  ocean:   C.bone,
};

export default function GButton({ label, onPress, variant = 'primary', disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: BG[variant],
          borderColor: variant === 'ghost' ? C.inkSoft : C.ink,
          shadowColor: C.ink,
          shadowOpacity: variant === 'ghost' || pressed ? 0 : 1,
          transform: [{ translateY: pressed ? 3 : 0 }],
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, { color: LABEL_COLOR[variant] }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base:     { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', shadowOffset: { width: 0, height: 3 }, shadowRadius: 0 },
  disabled: { opacity: 0.4 },
  label:    { fontFamily: F.body, fontWeight: '700', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
});
