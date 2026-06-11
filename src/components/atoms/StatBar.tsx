import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../tokens/colors';
import { F } from '../../tokens/fonts';

interface Props {
  label: string;
  value: number;       // 0–1
  fillColor?: string;
  hidden?: boolean;    // show redacted state instead of value
  tiny?: boolean;      // compact variant for grids
}

export default function StatBar({ label, value, fillColor = C.palm, hidden = false, tiny = false }: Props) {
  const pct = Math.min(1, Math.max(0, value));
  const barH = tiny ? 4 : 8;
  const labelW = tiny ? 52 : 72;
  const fontSize = tiny ? 9 : 10;

  return (
    <View style={[styles.row, { marginBottom: tiny ? 4 : 6 }]}>
      <Text style={[styles.label, { width: labelW, fontSize }]}>{label}</Text>
      <View style={[styles.track, { height: barH, borderRadius: barH / 2 }]}>
        {hidden ? (
          <View style={[styles.hiddenFill, { height: barH, borderRadius: barH / 2 }]} />
        ) : (
          <>
            <View style={{ flex: pct, backgroundColor: fillColor, height: barH, borderRadius: barH / 2 }} />
            <View style={{ flex: 1 - pct }} />
          </>
        )}
      </View>
      <Text style={[styles.pct, { fontSize }]}>
        {hidden ? '???' : Math.round(pct * 100)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label:      { fontFamily: F.body, color: C.inkMid, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: '600' },
  track:      { flex: 1, backgroundColor: C.sandMid, overflow: 'hidden', flexDirection: 'row' },
  hiddenFill: { flex: 1, backgroundColor: C.inkSoft, opacity: 0.35 },
  pct:        { width: 26, fontFamily: F.mono, color: C.inkSoft, textAlign: 'right' },
});
