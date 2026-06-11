import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { AdvantageType } from '../../data/advantages';
import { ADVANTAGE_DEFS } from '../../data/advantages';
import { C } from '../../tokens/colors';
import { F } from '../../tokens/fonts';

const ADVANTAGE_ICONS: Record<AdvantageType, string> = {
  hii:                  '🏺',
  extra_vote:           '🗳️',
  steal_a_vote:         '🤲',
  safety_without_power: '🛡️',
  idol_nullifier:       '❌',
};

interface Props {
  type: AdvantageType;
  selected?: boolean;
  expired?: boolean;
  compact?: boolean;   // smaller display for HomeScreen inventory
  onPress?: () => void;
}

export default function AdvantageCard({ type, selected = false, expired = false, compact = false, onPress }: Props) {
  const def = ADVANTAGE_DEFS[type];

  if (compact) {
    return (
      <View style={[styles.compactCard, expired && styles.compactExpired]}>
        <Text style={styles.compactIcon}>{ADVANTAGE_ICONS[type]}</Text>
        <Text style={styles.compactName} numberOfLines={1}>{def.name}</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected, expired && styles.cardExpired]}
      onPress={onPress}
      disabled={expired || !onPress}
      activeOpacity={0.75}
    >
      <View style={styles.row}>
        <Text style={styles.icon}>{ADVANTAGE_ICONS[type]}</Text>
        <View style={styles.textBlock}>
          <Text style={[styles.name, expired && styles.strikethrough]}>{def.name}</Text>
          <Text style={styles.desc} numberOfLines={2}>{def.desc}</Text>
        </View>
        {selected && <Text style={styles.check}>✓</Text>}
        {expired && <Text style={styles.expiredBadge}>EXPIRED</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:          { backgroundColor: '#ffffff0f', borderWidth: 1.5, borderColor: '#ffffff22', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardSelected:  { borderColor: C.sun, backgroundColor: '#f4a83a1a' },
  cardExpired:   { opacity: 0.45 },
  row:           { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon:          { fontSize: 22 },
  textBlock:     { flex: 1, gap: 3 },
  name:          { fontSize: 13, fontFamily: F.body, fontWeight: '700', color: C.bone },
  strikethrough: { textDecorationLine: 'line-through', color: C.inkSoft },
  desc:          { fontSize: 11, fontFamily: F.body, color: C.inkSoft, lineHeight: 15 },
  check:         { fontSize: 18, color: C.sun },
  expiredBadge:  { fontSize: 9, fontFamily: F.mono, color: C.coral, letterSpacing: 1 },
  // compact
  compactCard:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff12', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  compactExpired:{ opacity: 0.4 },
  compactIcon:   { fontSize: 14 },
  compactName:   { fontSize: 10, fontFamily: F.body, fontWeight: '700', color: C.bone, letterSpacing: 0.3 },
});
