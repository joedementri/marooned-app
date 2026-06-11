import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { C } from '../../tokens/colors';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.bone,
    borderWidth: 1.5,
    borderColor: C.ink,
    borderRadius: 12,
    padding: 16,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
});
