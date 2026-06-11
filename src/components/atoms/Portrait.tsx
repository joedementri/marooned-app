import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../tokens/colors';
import { F } from '../../tokens/fonts';
import { ARCHETYPES } from '../../data/archetypes';
import type { ArchetypeKey } from '../../data/archetypes';

interface Props {
  color: string;
  initials: string;
  size?: number;
  borderColor?: string;
  archetype?: ArchetypeKey;
  dim?: boolean;
}

export default function Portrait({
  color,
  initials,
  size = 48,
  borderColor = C.ink,
  archetype,
  dim = false,
}: Props) {
  const badgeSize = size * 0.30;
  const badgeOffset = -size * 0.06;

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.base,
          {
            width: size,
            height: size,
            borderRadius: size * 0.18,
            backgroundColor: color,
            borderColor,
          },
        ]}
      >
        <Text style={[styles.initials, { fontSize: size * 0.33 }]}>
          {initials.slice(0, 2).toUpperCase()}
        </Text>

        {/* Dim overlay for eliminated */}
        {dim && (
          <View style={[styles.dimOverlay, { borderRadius: size * 0.18 }]}>
            <Text style={[styles.dimX, { fontSize: size * 0.35 }]}>✕</Text>
          </View>
        )}
      </View>

      {/* Archetype glyph badge */}
      {archetype && !dim && (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: size * 0.1,
              backgroundColor: color,
              bottom: badgeOffset,
              right: badgeOffset,
            },
          ]}
        >
          <Text style={[styles.badgeText, { fontSize: size * 0.18 }]}>
            {ARCHETYPES[archetype].glyph}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base:       { borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials:   { fontFamily: F.display, color: C.bone, textAlign: 'center' },
  dimOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  dimX:       { color: '#fff', fontFamily: F.mono, fontWeight: '700' },
  badge:      { position: 'absolute', borderWidth: 1.5, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText:  { color: '#fff', fontFamily: F.mono, fontWeight: '700' },
});
