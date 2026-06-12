import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Portrait from '../atoms/Portrait';
import { initials } from '../../data/roster';
import { C } from '../../tokens/colors';
import { F } from '../../tokens/fonts';

export interface OpponentStatusRow {
  id: number;
  name: string;
  color: string;
  /** Short status pill text, e.g. "HANGING", "DROPPED 14.2s", "OUT R3". */
  status: string;
  /** Whether the row is still in contention (controls pill + row dimming). */
  active: boolean;
}

interface Props {
  rows: OpponentStatusRow[];
  maxVisible?: number;
}

// A compact status list for games where opponents drop out over time (endurance
// hangs, elimination rounds) rather than racing a progress bar.
export default function OpponentStatus({ rows, maxVisible = 8 }: Props) {
  return (
    <View style={styles.list}>
      {rows.slice(0, maxVisible).map(r => (
        <View key={r.id} style={[styles.row, !r.active && styles.rowOut]}>
          <Portrait color={r.color} initials={initials(r.name)} size={26} />
          <Text style={styles.name} numberOfLines={1}>{r.name.split(' ')[0]}</Text>
          <View style={[styles.pill, r.active ? styles.pillActive : styles.pillOut]}>
            <Text style={[styles.pillText, r.active ? styles.pillTextActive : styles.pillTextOut]}>
              {r.status}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list:           { width: '100%', gap: 6 },
  row:            { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowOut:         { opacity: 0.55 },
  name:           { flex: 1, fontSize: 11, fontFamily: F.mono, color: C.ink, letterSpacing: 1 },
  pill:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillActive:     { backgroundColor: C.palm },
  pillOut:        { backgroundColor: C.sandMid },
  pillText:       { fontSize: 9, fontFamily: F.mono, letterSpacing: 1 },
  pillTextActive: { color: C.bone },
  pillTextOut:    { color: C.inkSoft },
});
