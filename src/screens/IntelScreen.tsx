import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { initials } from '../data/roster';
import { PLAYER_ID } from '../utils/voteSimulator';
import type { IntelEntry } from '../store/slices/intelSlice';
import Portrait from '../components/atoms/Portrait';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

type Props = StackScreenProps<GameParamList, 'Intel'>;
type Tab = 'log' | 'alliances';

function ago(day: number, entryDay: number): string {
  const d = day - entryDay;
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}

function confColor(c: IntelEntry['confidence']): string {
  return c === 'high' ? C.palm : c === 'medium' ? C.sun : C.coral;
}

export default function IntelScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('log');
  const { intel, alliances, castaways, day, playerName } = useGameStore(
    useShallow(s => ({
      intel: s.intel, alliances: s.alliances, castaways: s.castaways, day: s.day, playerName: s.playerName,
    }))
  );

  const nameOf = (id: number) => (id === PLAYER_ID ? playerName : castaways.find(c => c.id === id)?.name ?? '?');
  const knownAlliances = alliances.filter(a => a.knownToPlayer);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>JOURNAL</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'log' && styles.tabActive]} onPress={() => setTab('log')}>
          <Text style={[styles.tabLabel, tab === 'log' && styles.tabLabelActive]}>INTEL LOG</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'alliances' && styles.tabActive]} onPress={() => setTab('alliances')}>
          <Text style={[styles.tabLabel, tab === 'alliances' && styles.tabLabelActive]}>ALLIANCES</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {tab === 'log' ? (
          intel.length === 0 ? (
            <Text style={styles.empty}>No intel yet. Talk to people and watch the camp.</Text>
          ) : (
            intel.map(entry => (
              <View key={entry.id} style={styles.card}>
                <View style={styles.cardTop}>
                  {entry.sourceId != null ? (
                    <Portrait
                      color={castaways.find(c => c.id === entry.sourceId)?.color ?? C.inkSoft}
                      initials={initials(nameOf(entry.sourceId))}
                      size={26}
                    />
                  ) : (
                    <View style={styles.eyeBadge}><Text style={styles.eyeGlyph}>👁</Text></View>
                  )}
                  <Text style={styles.cardText}>{entry.text}</Text>
                </View>
                <View style={styles.cardMeta}>
                  <View style={[styles.confDot, { backgroundColor: confColor(entry.confidence) }]} />
                  <Text style={styles.metaText}>{entry.confidence} · {entry.kind} · {ago(day, entry.day)}</Text>
                </View>
              </View>
            ))
          )
        ) : (
          knownAlliances.length === 0 ? (
            <Text style={styles.empty}>You don't know of any alliances yet.</Text>
          ) : (
            knownAlliances.map(a => (
              <View key={a.id} style={styles.card}>
                <Text style={styles.allianceName}>{a.name}</Text>
                <Text style={styles.allianceMembers}>
                  {a.memberIds.map(id => nameOf(id).split(' ')[0]).join(' · ')}
                </Text>
                <View style={styles.strengthRow}>
                  <Text style={styles.strengthLabel}>STRENGTH</Text>
                  <View style={styles.strengthTrack}>
                    <View style={[styles.strengthFill, { width: `${Math.round(a.strength * 100)}%` }]} />
                  </View>
                </View>
                {a.targetId != null && (
                  <Text style={styles.allianceTarget}>Eyeing: {nameOf(a.targetId).split(' ')[0]}</Text>
                )}
              </View>
            ))
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: C.sand },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  back:            { fontSize: 13, fontFamily: F.body, color: C.inkMid, fontWeight: '700' },
  title:           { fontSize: 18, fontFamily: F.display, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  tabs:            { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 12 },
  tab:             { flex: 1, borderWidth: 1.5, borderColor: C.inkSoft, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tabActive:       { backgroundColor: C.ink, borderColor: C.ink },
  tabLabel:        { fontSize: 11, fontFamily: F.mono, color: C.inkMid, letterSpacing: 1 },
  tabLabelActive:  { color: C.bone },
  body:            { padding: 24, paddingTop: 6, paddingBottom: 40 },
  empty:           { fontSize: 13, fontFamily: F.body, color: C.inkSoft, textAlign: 'center', marginTop: 40, lineHeight: 20 },
  card:            { backgroundColor: C.bone, borderWidth: 1.5, borderColor: C.sandMid, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardTop:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eyeBadge:        { width: 26, height: 26, borderRadius: 13, backgroundColor: C.sandMid, alignItems: 'center', justifyContent: 'center' },
  eyeGlyph:        { fontSize: 13 },
  cardText:        { flex: 1, fontSize: 13, fontFamily: F.body, color: C.ink, lineHeight: 18 },
  cardMeta:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginLeft: 36 },
  confDot:         { width: 8, height: 8, borderRadius: 4 },
  metaText:        { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 0.5 },
  allianceName:    { fontSize: 15, fontFamily: F.display, fontWeight: '800', color: C.ink, marginBottom: 4 },
  allianceMembers: { fontSize: 13, fontFamily: F.body, color: C.inkMid, marginBottom: 10 },
  strengthRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  strengthLabel:   { fontSize: 9, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 1, width: 60 },
  strengthTrack:   { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.sandMid, overflow: 'hidden' },
  strengthFill:    { height: 8, borderRadius: 4, backgroundColor: C.ocean },
  allianceTarget:  { fontSize: 11, fontFamily: F.mono, color: C.coral, letterSpacing: 0.5, marginTop: 8 },
});
