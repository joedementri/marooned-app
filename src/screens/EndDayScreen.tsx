import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import type { FeedEntry } from '../store/gameStore';
import { useSaveSlots } from '../hooks/useSaveSlots';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

type Props = StackScreenProps<GameParamList, 'EndDay'>;

const TYPE_COLOR: Record<string, string> = {
  alliance:  C.palm,
  vote:      C.coral,
  advantage: C.sun,
  tribal:    C.torch,
  merge:     C.ocean,
  system:    C.inkSoft,
};

const TYPE_LABEL: Record<string, string> = {
  alliance:  'ALLY',
  vote:      'VOTE',
  advantage: 'ADV',
  tribal:    'TRIBAL',
  merge:     'MERGE',
  system:    'SYS',
};

function EventCard({ entry }: { entry: FeedEntry }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,     { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(translateY,  { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.eventCard, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.eventTime}>
        {String(entry.day * 2).padStart(2, '0')}:00 · {TYPE_LABEL[entry.type] ?? '---'}
      </Text>
      <Text style={styles.eventText}>{entry.text}</Text>
    </Animated.View>
  );
}

export default function EndDayScreen({ navigation }: Props) {
  const { day, feed, castaways, playerName } = useGameStore(
    useShallow(s => ({
      day:        s.day,
      feed:       s.feed,
      castaways:  s.castaways,
      playerName: s.playerName,
    }))
  );
  const incrementDay = useGameStore(s => s.incrementDay);
  const { saveCurrentGame } = useSaveSlots();

  const todayFeed: FeedEntry[] = feed.filter(e => e.day === day);
  const alive      = castaways.filter(c => !c.eliminated).length;
  const eliminated = castaways.filter(c => c.eliminatedDay === day);

  const [revealCount, setRevealCount] = useState(0);

  useEffect(() => {
    if (revealCount < todayFeed.length) {
      const t = setTimeout(() => setRevealCount(n => n + 1), 700);
      return () => clearTimeout(t);
    }
  }, [revealCount, todayFeed.length]);

  const allRevealed = revealCount >= todayFeed.length;
  const [advancing, setAdvancing] = useState(false);

  async function handleNextDay() {
    if (advancing) return;
    setAdvancing(true);
    incrementDay();
    await saveCurrentGame();
    navigation.goBack();
  }

  return (
    <View style={styles.root}>
      {/* Night gradient header */}
      <View style={styles.header}>
        <Text style={styles.headerMono}>NIGHT · DAY {String(day).padStart(2, '0')}</Text>
        <Text style={styles.headerNarrative}>The camp{'\n'}goes quiet.</Text>
        <Text style={styles.headerMeta}>{alive} SURVIVORS REMAIN</Text>
      </View>

      {/* Moon */}
      <View style={styles.moonContainer}>
        <View style={styles.moon} />
      </View>

      {/* Torch snuff */}
      {eliminated.length > 0 && (
        <View style={styles.snuffBlock}>
          {eliminated.map(c => (
            <View key={c.id} style={styles.snuffRow}>
              <Text style={styles.snuffFlame}>🔥</Text>
              <Text style={styles.snuffName}>{c.name}'s torch has been snuffed.</Text>
            </View>
          ))}
        </View>
      )}

      {/* Animated event feed */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {todayFeed.length === 0 ? (
          <View style={styles.eventCard}>
            <Text style={styles.eventText}>A quiet night at camp.</Text>
          </View>
        ) : (
          todayFeed.slice(0, revealCount).map(entry => (
            <EventCard key={entry.id} entry={entry} />
          ))
        )}
      </ScrollView>

      {/* Wake CTA — appears after all events revealed */}
      <View style={styles.footer}>
        <Text style={styles.footerSub}>
          Good night, {playerName || 'Survivor'}.
        </Text>
        <TouchableOpacity
          style={[styles.nextBtn, (advancing || (!allRevealed && todayFeed.length > 0)) && styles.nextBtnDisabled]}
          onPress={handleNextDay}
          disabled={advancing || (!allRevealed && todayFeed.length > 0)}
        >
          <Text style={styles.nextBtnLabel}>☀  WAKE — DAY {day + 1}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: C.night },

  // Header
  header:          { paddingHorizontal: 28, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  headerMono:      { fontFamily: F.mono, fontSize: 11, color: 'rgba(247,239,213,0.6)', letterSpacing: 2, marginBottom: 6 },
  headerNarrative: { fontFamily: F.display, fontWeight: '800', fontSize: 30, color: C.bone, letterSpacing: -0.8, lineHeight: 36 },
  headerMeta:      { fontFamily: F.mono, fontSize: 10, color: 'rgba(247,239,213,0.5)', letterSpacing: 1, marginTop: 8 },

  // Moon
  moonContainer:   { alignItems: 'center', marginVertical: 20 },
  moon:            {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#f7efd5',
    shadowColor: '#f7efd5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 22,
    elevation: 10,
  },

  // Snuff
  snuffBlock:      { paddingHorizontal: 28, paddingBottom: 8 },
  snuffRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  snuffFlame:      { fontSize: 16 },
  snuffName:       { fontSize: 14, fontFamily: F.body, color: C.torch, fontWeight: '600' },

  // Events
  list:            { flex: 1 },
  listContent:     { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 20, gap: 10 },
  eventCard:       {
    backgroundColor: 'rgba(247,239,213,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(247,239,213,0.18)',
    borderRadius: 12,
    padding: 14,
  },
  eventTime:       { fontFamily: F.mono, fontSize: 9, color: 'rgba(247,239,213,0.5)', letterSpacing: 1.4, marginBottom: 4 },
  eventText:       { fontFamily: F.body, fontSize: 14, color: C.bone, lineHeight: 20 },

  // Footer
  footer:          { paddingHorizontal: 28, paddingTop: 16, paddingBottom: 40, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  footerSub:       { fontSize: 12, fontFamily: F.body, color: C.inkSoft, marginBottom: 14, textAlign: 'center', fontStyle: 'italic' },
  nextBtn:         { backgroundColor: C.ocean, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnLabel:    { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
});
