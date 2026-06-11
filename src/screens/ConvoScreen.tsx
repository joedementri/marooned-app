import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { CONVO_TOPICS, openerLine } from '../data/convoTopics';
import type { ConvoTopic } from '../data/convoTopics';
import { initials } from '../data/roster';
import type { StatKey } from '../data/statMeta';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';
import Portrait from '../components/atoms/Portrait';

type Props = StackScreenProps<GameParamList, 'Convo'>;
type Stage = 'opener' | 'topics' | 'reply' | 'done';

export default function ConvoScreen({ navigation, route }: Props) {
  const [stage, setStage] = useState<Stage>('opener');
  const [selectedTopic, setSelectedTopic] = useState<ConvoTopic | null>(null);
  const [statDeltas, setStatDeltas] = useState<Partial<Record<StatKey, number>>>({});

  const castaway = useGameStore(s => s.castaways.find(c => c.id === route.params.castawayId));
  const day = useGameStore(s => s.day);
  const setCastaways = useGameStore(s => s.setCastaways);
  const castaways = useGameStore(s => s.castaways);
  const addFeedEntry = useGameStore(s => s.addFeedEntry);
  const phase = useGameStore(s => s.phase);

  const selectTopic = useCallback((topic: ConvoTopic) => {
    if (!castaway) return;
    setSelectedTopic(topic);
    setStatDeltas(topic.hint);

    // Apply stats, reveals, lastInteraction, and log in a single setCastaways call
    const reveals = new Set(topic.reveals);
    const updated = castaways.map(c => {
      if (c.id !== castaway.id) return c;
      const nextStats = { ...c.stats };
      (Object.keys(topic.hint) as Array<keyof typeof topic.hint>).forEach(k => {
        const val = topic.hint[k] ?? 0;
        nextStats[k] = Math.max(0, Math.min(1, nextStats[k] + val));
      });
      const nextRevealed = { ...c.revealed };
      reveals.forEach(key => { nextRevealed[key] = true; });
      return {
        ...c,
        stats: nextStats,
        revealed: nextRevealed,
        lastInteraction: day,
        relationshipLog: [
          ...c.relationshipLog,
          { day, note: `Discussed "${topic.label}"` },
        ],
      };
    });
    setCastaways(updated);

    addFeedEntry({
      id: `convo-${castaway.id}-day${day}-${Date.now()}`,
      day,
      phase,
      text: `You talked with ${castaway.name.split(' ')[0]} about "${topic.label}".`,
      type: 'alliance',
    });

    setStage('reply');
  }, [castaway, day, castaways, setCastaways, addFeedEntry, phase]);

  if (!castaway) {
    return (
      <View style={styles.root}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backLabel}>‹ BACK</Text>
        </TouchableOpacity>
        <Text style={styles.error}>Castaway not found.</Text>
      </View>
    );
  }

  const alreadyTalkedToday = castaway.lastInteraction === day && stage === 'opener';

  const reply = selectedTopic
    ? selectedTopic.reply(castaway.archetype, castaway.stats.trust, castaway.stats.strength)
    : '';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backLabel}>‹ BACK</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Portrait color={castaway.color} initials={initials(castaway.name)} size={48} />
        <View style={styles.headerText}>
          <Text style={styles.castawayName}>{castaway.name}</Text>
          <Text style={styles.castawayMeta}>{castaway.job}</Text>
        </View>
      </View>

      {/* Opener / warning */}
      {stage === 'opener' && (
        <>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              {alreadyTalkedToday
                ? `${castaway.name.split(' ')[0]} looks like they need some space. You've already spoken today.`
                : `"${openerLine(castaway.archetype)}"`}
            </Text>
          </View>
          {!alreadyTalkedToday && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStage('topics')}>
              <Text style={styles.primaryBtnLabel}>CHOOSE A TOPIC</Text>
            </TouchableOpacity>
          )}
          {alreadyTalkedToday && (
            <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.ghostBtnLabel}>LEAVE</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Topic list */}
      {stage === 'topics' && (
        <>
          <Text style={styles.topicsHint}>What do you want to talk about?</Text>
          {CONVO_TOPICS.map(topic => (
            <TouchableOpacity
              key={topic.id}
              style={styles.topicBtn}
              onPress={() => selectTopic(topic)}
            >
              <Text style={styles.topicLabel}>{topic.label}</Text>
              <Text style={styles.topicAsk}>{topic.ask}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Reply */}
      {stage === 'reply' && selectedTopic && (
        <>
          <View style={[styles.bubble, styles.bubblePlayer]}>
            <Text style={styles.bubbleLabel}>YOU</Text>
            <Text style={styles.bubbleText}>"{selectedTopic.ask}"</Text>
          </View>
          <View style={styles.bubble}>
            <Text style={styles.bubbleLabel}>{castaway.name.split(' ')[0].toUpperCase()}</Text>
            <Text style={styles.bubbleText}>"{reply}"</Text>
          </View>

          {/* Stat changes */}
          {Object.entries(statDeltas).filter(([, v]) => (v as number) !== 0).length > 0 && (
            <View style={styles.deltaBlock}>
              {(Object.entries(statDeltas) as [StatKey, number][])
                .filter(([, v]) => v !== 0)
                .map(([key, val]) => (
                  <Text key={key} style={[styles.deltaText, { color: val > 0 ? C.palm : C.coral }]}>
                    {val > 0 ? '▲' : '▼'} {key} {val > 0 ? `+${(val * 100).toFixed(0)}` : (val * 100).toFixed(0)}
                  </Text>
                ))}
            </View>
          )}

          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStage('done')}>
            <Text style={styles.primaryBtnLabel}>CONTINUE</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Done */}
      {stage === 'done' && (
        <>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              You wrap up the conversation and head back to camp.
            </Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnLabel}>RETURN TO CAMP</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: C.sand },
  content:         { padding: 24, paddingTop: 60, paddingBottom: 40 },
  back:            { marginBottom: 16 },
  backLabel:       { fontSize: 13, fontFamily: F.body, color: C.inkMid, fontWeight: '700' },
  error:           { fontSize: 13, fontFamily: F.body, color: C.coral },
  header:          { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 24 },
  headerText:      { flex: 1 },
  castawayName:    { fontSize: 18, fontFamily: F.display, fontWeight: '700', color: C.ink },
  castawayMeta:    { fontSize: 11, fontFamily: F.body, color: C.inkMid, marginTop: 2 },
  bubble:          { backgroundColor: C.bone, borderWidth: 1.5, borderColor: C.sandMid, borderRadius: 12, padding: 16, marginBottom: 14 },
  bubblePlayer:    { borderColor: C.ink },
  bubbleLabel:     { fontSize: 9, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 1.5, marginBottom: 4 },
  bubbleText:      { fontSize: 14, fontFamily: F.body, color: C.ink, lineHeight: 20, fontStyle: 'italic' },
  topicsHint:      { fontSize: 12, fontFamily: F.body, color: C.inkMid, marginBottom: 14 },
  topicBtn:        { backgroundColor: C.bone, borderWidth: 1.5, borderColor: C.ink, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: C.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 0 },
  topicLabel:      { fontSize: 13, fontFamily: F.body, fontWeight: '700', color: C.ink, marginBottom: 3 },
  topicAsk:        { fontSize: 11, fontFamily: F.body, color: C.inkMid, fontStyle: 'italic', lineHeight: 16 },
  deltaBlock:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  deltaText:       { fontSize: 11, fontFamily: F.mono, letterSpacing: 0.5 },
  primaryBtn:      { backgroundColor: C.ink, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  primaryBtnLabel: { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  ghostBtn:        { borderWidth: 1.5, borderColor: C.inkSoft, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  ghostBtnLabel:   { fontSize: 13, fontFamily: F.body, fontWeight: '700', color: C.inkMid, letterSpacing: 1 },
});
