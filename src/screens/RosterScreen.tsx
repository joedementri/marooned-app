import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { initials } from '../data/roster';
import type { Castaway } from '../data/roster';
import { PLAYER_ID } from '../utils/voteSimulator';
import { ARCHETYPES } from '../data/archetypes';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';
import { useTheme } from '../contexts/ThemeContext';
import Portrait from '../components/atoms/Portrait';
import StatBar from '../components/atoms/StatBar';

type Props = StackScreenProps<GameParamList, 'Roster'>;
type Filter = 'tribe' | 'all' | 'jury';

interface RosterCardProps {
  castaway: Castaway;
  tribeName: string;
  tribeColor: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}

function RosterCard({ castaway: c, tribeName, tribeColor, onPress, theme }: RosterCardProps) {
  const isPlayer = c.id === PLAYER_ID;
  const archRevealed = c.revealed.archetype;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: theme.cardBg, borderColor: isPlayer ? c.color : theme.cardBorder },
        c.eliminated && styles.cardElim,
      ]}
      onPress={isPlayer ? undefined : onPress}
      activeOpacity={isPlayer ? 1 : 0.8}
    >
      {/* Portrait */}
      <Portrait
        color={c.color}
        initials={initials(c.name)}
        size={50}
        archetype={isPlayer ? undefined : c.archetype}
        dim={c.eliminated}
      />

      {/* Name + meta */}
      <View style={{ marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
            {c.name.split(' ')[0]}
          </Text>
          {isPlayer && (
            <View style={[styles.youBadge, { backgroundColor: c.color }]}>
              <Text style={styles.youBadgeTxt}>YOU</Text>
            </View>
          )}
        </View>
        <Text style={[styles.cardMeta, { color: theme.textSoft }]} numberOfLines={1}>
          {isPlayer ? tribeName : `${c.age} · ${tribeName}`}
        </Text>
      </View>

      {/* Archetype pill */}
      <View style={{ marginTop: 6 }}>
        {isPlayer ? (
          <View style={[styles.archPill, { backgroundColor: c.color }]}>
            <Text style={styles.archPillTxt}>★ PLAYER</Text>
          </View>
        ) : archRevealed ? (
          <View style={[styles.archPill, { backgroundColor: c.color }]}>
            <Text style={styles.archPillTxt}>
              {ARCHETYPES[c.archetype].glyph} {ARCHETYPES[c.archetype].label.toUpperCase()}
            </Text>
          </View>
        ) : (
          <View style={styles.archPillUnread}>
            <Text style={styles.archPillUnreadTxt}>UNREAD</Text>
          </View>
        )}
      </View>

      {/* Stat bars or eliminated label */}
      {c.eliminated ? (
        <Text style={[styles.elimLabel, { color: theme.textSoft }]}>
          ✕ VOTED OUT · DAY {c.eliminatedDay}
        </Text>
      ) : !isPlayer ? (
        <View style={{ marginTop: 8, gap: 2 }}>
          <StatBar
            label="Loyalty"
            value={c.stats.loyalty}
            fillColor={C.ocean}
            hidden={!c.revealed.loyalty}
            tiny
          />
          <StatBar
            label="Threat"
            value={c.stats.threat}
            fillColor={C.coral}
            hidden={!c.revealed.threat}
            tiny
          />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function RosterScreen({ navigation }: Props) {
  const [filter, setFilter] = useState<Filter>('tribe');
  const theme = useTheme();

  const { castaways, playerTribeId, tribes, jury } = useGameStore(
    useShallow(s => ({
      castaways:     s.castaways,
      playerTribeId: s.playerTribeId,
      tribes:        s.tribes,
      jury:          s.jury,
    }))
  );

  const juryIds = new Set(jury.map(j => j.castawayId));

  const visible = castaways.filter(c => {
    if (filter === 'tribe') return !c.eliminated && c.tribeId === playerTribeId;
    if (filter === 'jury')  return juryIds.has(c.id);
    return !c.eliminated;
  });

  const FILTER_LABELS: { key: Filter; label: string }[] = [
    { key: 'tribe', label: 'MY TRIBE' },
    { key: 'all',   label: 'ALL' },
    { key: 'jury',  label: 'JURY' },
  ];

  function tribeColor(tribeId: string): string {
    return tribes.find(t => t.id === tribeId)?.color ?? C.inkSoft;
  }

  function tribeName(tribeId: string): string {
    return tribes.find(t => t.id === tribeId)?.name ?? tribeId;
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.screenBg }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={[styles.backLabel, { color: theme.textSoft }]}>‹ BACK</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: theme.text }]}>ROSTER</Text>
      <Text style={[styles.sub, { color: theme.textSoft }]}>{visible.length} CASTAWAYS</Text>

      {/* Filter pills */}
      <View style={styles.tabs}>
        {FILTER_LABELS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.tab,
              { borderColor: theme.cardBorder },
              filter === key && { backgroundColor: theme.text, borderColor: theme.text },
            ]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.tabLabel, { color: theme.textSoft }, filter === key && { color: theme.screenBg }]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {visible.map(c => (
            <RosterCard
              key={c.id}
              castaway={c}
              tribeName={tribeName(c.tribeId)}
              tribeColor={tribeColor(c.tribeId)}
              theme={theme}
              onPress={() => navigation.navigate('CastawayDetail', { castawayId: c.id })}
            />
          ))}
          {visible.length === 0 && (
            <Text style={[styles.empty, { color: theme.textSoft }]}>No castaways in this view.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1, paddingTop: 60 },
  back:             { paddingHorizontal: 24, marginBottom: 8 },
  backLabel:        { fontSize: 13, fontFamily: F.body, fontWeight: '700' },
  title:            { paddingHorizontal: 24, fontSize: 28, fontFamily: F.display, fontWeight: '800', letterSpacing: -0.5 },
  sub:              { paddingHorizontal: 24, fontSize: 10, fontFamily: F.mono, letterSpacing: 1, marginBottom: 14 },

  // Filter pills
  tabs:             { flexDirection: 'row', paddingHorizontal: 24, gap: 8, marginBottom: 14 },
  tab:              { borderWidth: 1.5, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  tabLabel:         { fontSize: 10, fontFamily: F.body, fontWeight: '700', letterSpacing: 1 },

  // 2-column grid
  grid:             { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 24, paddingTop: 4, paddingBottom: 40 },

  // Roster card
  card:             { width: '47%' as any, borderWidth: 1.5, borderRadius: 12, padding: 10, shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  cardElim:         { opacity: 0.55, shadowOpacity: 0 },
  cardName:         { fontSize: 15, fontFamily: F.display, fontWeight: '700', letterSpacing: -0.2 },
  cardMeta:         { fontSize: 10, fontFamily: F.body, marginTop: 1 },

  // Archetype pills
  archPill:         { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start' },
  archPillTxt:      { fontFamily: F.mono, fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 0.6 },
  archPillUnread:   { borderWidth: 1, borderColor: C.inkSoft, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start', borderStyle: 'dashed' },
  archPillUnreadTxt:{ fontFamily: F.mono, fontSize: 9, fontWeight: '700', color: C.inkSoft, letterSpacing: 0.6 },

  elimLabel:        { fontFamily: F.mono, fontSize: 9, letterSpacing: 0.6, marginTop: 6 },
  youBadge:         { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  youBadgeTxt:      { fontFamily: F.mono, fontSize: 8, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  empty:            { fontSize: 13, fontFamily: F.body, textAlign: 'center', marginTop: 40, width: '100%' as any },
});
