import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../tokens/colors';

interface Props {
  bg?: string;
  style?: ViewStyle;
  children: React.ReactNode;
}

export default function ScreenShell({ bg = C.sand, style, children }: Props) {
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
});
