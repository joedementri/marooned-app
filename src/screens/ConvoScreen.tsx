import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { CONVO_TOPICS, openerLine } from '../data/convoTopics';
import type { ConvoTopic } from '../data/convoTopics';
import { initials } from '../data/roster';
import type { Castaway } from '../data/roster';
import type { StatKey } from '../data/statMeta';
import type { IntelEntry } from '../store/slices/intelSlice';
import { PLAYER_ID } from '../utils/voteSimulator';
import { gameRng } from '../engine/rng';
import { getRel } from '../engine/socialEngine';
import { answerQuery } from '../engine/intelEngine';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';
import Portrait from '../components/atoms/Portrait';

type Props = StackScreenProps<GameParamList, 'Convo'>;
type Stage = 'opener' | 'topics' | 'reply' | 'done' | 'ask' | 'ask_result' | 'pitch_result';

export default function ConvoScreen({ navigation, route }: Props) {
  const [stage, setStage] = useState<Stage>('opener');
  const [selectedTopic, setSelectedTopic] = useState<ConvoTopic | null>(null);
  const [statDeltas, setStatDeltas] = useState<Partial<Record<StatKey, number>>>({});
  const [askResult, setAskResult] = useState<IntelEntry | null>(null);
  const [pitchOutcome, setPitchOutcome] = useState<'accept' | 'reject' | null>(null);

  const castaway = useGameStore(s => s.castaways.find(c => c.id === route.params.castawayId));
  const day = useGameStore(s => s.day);
  const phase = useGameStore(s => s.phase);
  const castaways = useGameStore(s => s.castaways);
  const relationships = useGameStore(s => s.relationships);
  const alliances = useGameStore(s => s.alliances);
  const gameSeed = useGameStore(s => s.gameSeed);
  const setCastaways = useGameStore(s => s.setCastaways);
  const addFeedEntry = useGameStore(s => s.addFeedEntry);
  const applyRelDeltas = useGameStore(s => s.applyRelDeltas);
  const syncPlayerFacingStats = useGameStore(s => s.syncPlayerFacingStats);
  const upsertAlliance = useGameStore(s => s.upsertAlliance);
  const addIntel = useGameStore(s => s.addIntel);

  const selectTopic = useCallback((topic: ConvoTopic) => {
    if (!castaway) return;
    setSelectedTopic(topic);
    setStatDeltas(topic.hint);

    // Non-derived stats (mood/strength/etc) updated directly; the
    // relationship-derived ones (trust/loyalty/suspicion) flow through the graph.
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
        relationshipLog: [...c.relationshipLog, { day, note: `Discussed "${topic.label}"` }],
      };
    });
    setCastaways(updated);

    const h = topic.hint;
    const relDeltas = [];
    if (h.trust)     relDeltas.push({ a: castaway.id, b: PLAYER_ID, d: { trust: h.trust, lastEventDay: day } });
    if (h.loyalty)   relDeltas.push({ a: castaway.id, b: PLAYER_ID, d: { affinity: h.loyalty } });
    if (h.suspicion) relDeltas.push({ a: castaway.id, b: PLAYER_ID, d: { grudge: h.suspicion } });
    if (relDeltas.length) { applyRelDeltas(relDeltas); syncPlayerFacingStats(); }

    addFeedEntry({
      id: `convo-${castaway.id}-day${day}-${Date.now()}`,
      day, phase,
      text: `You talked with ${castaway.name.split(' ')[0]} about "${topic.label}".`,
      type: 'alliance',
    });
    setStage('reply');
  }, [castaway, day, castaways, setCastaways, addFeedEntry, phase, applyRelDeltas, syncPlayerFacingStats]);

  const askAbout = useCallback((subject: Castaway) => {
    if (!castaway) return;
    const rng = gameRng(gameSeed, `convo-ask-${castaway.id}-${subject.id}-d${day}`);
    const trustOfPlayer = getRel(relationships, castaway.id, PLAYER_ID).trust;
    const entry = answerQuery({ source: castaway, subject, castaways, relationships, alliances, trustOfPlayer, day, rng });
    addIntel([entry]);
    applyRelDeltas([{ a: castaway.id, b: PLAYER_ID, d: { trust: 0.02 } }]);
    syncPlayerFacingStats();
    setAskResult(entry);
    setStage('ask_result');
  }, [castaway, gameSeed, day, relationships, castaways, alliances, addIntel, applyRelDeltas, syncPlayerFacingStats]);

  const pitchAlliance = useCallback(() => {
    if (!castaway) return;
    const rng = gameRng(gameSeed, `convo-pitch-${castaway.id}-d${day}`);
    const r = getRel(relationships, castaway.id, PLAYER_ID);
    const warmth = r.trust * 0.6 + ((r.affinity + 1) / 2) * 0.4;
    const accept = warmth > 0.42 && rng() < 0.4 + r.trust * 0.5;
    if (accept) {
      const existing = alliances.find(a => a.memberIds.includes(castaway.id));
      if (existing) {
        upsertAlliance({
          ...existing,
          memberIds: existing.memberIds.includes(PLAYER_ID) ? existing.memberIds : [...existing.memberIds, PLAYER_ID],
          knownToPlayer: true,
        });
      } else {
        upsertAlliance({
          id: `all-player-${castaway.id}-d${day}`, name: 'Your Alliance',
          memberIds: [PLAYER_ID, castaway.id], strength: 0.5, createdDay: day, targetId: null, knownToPlayer: true,
        });
      }
      applyRelDeltas([{ a: castaway.id, b: PLAYER_ID, d: { trust: 0.06, affinity: 0.06, lastEventDay: day } }]);
      setPitchOutcome('accept');
    } else {
      applyRelDeltas([{ a: castaway.id, b: PLAYER_ID, d: { grudge: 0.05, trust: -0.03 } }]);
      setPitchOutcome('reject');
    }
    syncPlayerFacingStats();
    addFeedEntry({
      id: `pitch-${castaway.id}-d${day}-${Date.now()}`, day, phase,
      text: accept ? `${castaway.name.split(' ')[0]} agreed to work with you.` : `${castaway.name.split(' ')[0]} brushed off your alliance pitch.`,
      type: 'alliance',
    });
    setStage('pitch_result');
  }, [castaway, gameSeed, day, relationships, alliances, upsertAlliance, applyRelDeltas, syncPlayerFacingStats, addFeedEntry, phase]);

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
  const reply = selectedTopic ? selectedTopic.reply(castaway.archetype, castaway.stats.trust, castaway.stats.strength) : '';
  const askSubjects = castaways.filter(c => !c.eliminated && !c.onRedemptionIsland && c.id !== PLAYER_ID && c.id !== castaway.id);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backLabel}>‹ BACK</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Portrait color={castaway.color} initials={initials(castaway.name)} size={48} />
        <View style={styles.headerText}>
          <Text style={styles.castawayName}>{castaway.name}</Text>
          <Text style={styles.castawayMeta}>{castaway.job}</Text>
        </View>
      </View>

      {stage === 'opener' && (
        <>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              {alreadyTalkedToday
                ? `${castaway.name.split(' ')[0]} looks like they need some space. You've already spoken today.`
                : `"${openerLine(castaway.archetype)}"`}
            </Text>
          </View>
          {!alreadyTalkedToday ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStage('topics')}>
              <Text style={styles.primaryBtnLabel}>TALK</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.ghostBtnLabel}>LEAVE</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {stage === 'topics' && (
        <>
          <Text style={styles.topicsHint}>What do you want to talk about?</Text>
          {CONVO_TOPICS.map(topic => (
            <TouchableOpacity key={topic.id} style={styles.topicBtn} onPress={() => selectTopic(topic)}>
              <Text style={styles.topicLabel}>{topic.label}</Text>
              <Text style={styles.topicAsk}>{topic.ask}</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.sectionLabel}>INTEL & STRATEGY</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setStage('ask')}>
            <Text style={styles.actionLabel}>ASK ABOUT SOMEONE</Text>
            <Text style={styles.actionSub}>See what they'll tell you — they may not be honest.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={pitchAlliance}>
            <Text style={styles.actionLabel}>PROPOSE AN ALLIANCE</Text>
            <Text style={styles.actionSub}>Try to lock them in. A cold read can backfire.</Text>
          </TouchableOpacity>
        </>
      )}

      {stage === 'ask' && (
        <>
          <Text style={styles.topicsHint}>Ask {castaway.name.split(' ')[0]} about…</Text>
          {askSubjects.map(s => (
            <TouchableOpacity key={s.id} style={styles.subjectBtn} onPress={() => askAbout(s)}>
              <Portrait color={s.color} initials={initials(s.name)} size={32} />
              <Text style={styles.subjectName}>{s.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.ghostBtn} onPress={() => setStage('topics')}>
            <Text style={styles.ghostBtnLabel}>BACK</Text>
          </TouchableOpacity>
        </>
      )}

      {stage === 'ask_result' && askResult && (
        <>
          <View style={styles.bubble}>
            <Text style={styles.bubbleLabel}>{castaway.name.split(' ')[0].toUpperCase()}</Text>
            <Text style={styles.bubbleText}>"{askResult.text}"</Text>
          </View>
          <View style={[styles.confPill, confStyle(askResult.confidence)]}>
            <Text style={styles.confText}>{askResult.confidence.toUpperCase()} CONFIDENCE</Text>
          </View>
          <Text style={styles.intelNote}>Logged to your journal.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStage('done')}>
            <Text style={styles.primaryBtnLabel}>CONTINUE</Text>
          </TouchableOpacity>
        </>
      )}

      {stage === 'pitch_result' && (
        <>
          <View style={styles.bubble}>
            <Text style={styles.bubbleLabel}>{castaway.name.split(' ')[0].toUpperCase()}</Text>
            <Text style={styles.bubbleText}>
              {pitchOutcome === 'accept'
                ? `"Alright. You and me — let's work together."`
                : `"I'll think about it."`}
            </Text>
          </View>
          <Text style={[styles.intelNote, { color: pitchOutcome === 'accept' ? C.palm : C.coral }]}>
            {pitchOutcome === 'accept' ? 'You formed an alliance.' : 'They weren\'t ready to commit — and they\'re a little wary now.'}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStage('done')}>
            <Text style={styles.primaryBtnLabel}>CONTINUE</Text>
          </TouchableOpacity>
        </>
      )}

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

      {stage === 'done' && (
        <>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>You wrap up the conversation and head back to camp.</Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnLabel}>RETURN TO CAMP</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function confStyle(conf: IntelEntry['confidence']) {
  if (conf === 'high') return { backgroundColor: '#2d8a5a22', borderColor: C.palm };
  if (conf === 'medium') return { backgroundColor: '#f4a83a22', borderColor: C.sun };
  return { backgroundColor: '#e85a4f22', borderColor: C.coral };
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
  sectionLabel:    { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginTop: 14, marginBottom: 10 },
  actionBtn:       { backgroundColor: C.sandMid, borderWidth: 1.5, borderColor: C.inkMid, borderRadius: 12, padding: 14, marginBottom: 10 },
  actionLabel:     { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.ink, letterSpacing: 0.5, marginBottom: 3 },
  actionSub:       { fontSize: 11, fontFamily: F.body, color: C.inkMid, lineHeight: 15 },
  subjectBtn:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bone, borderWidth: 1, borderColor: C.sandMid, borderRadius: 10, padding: 10, marginBottom: 8 },
  subjectName:     { fontSize: 14, fontFamily: F.body, fontWeight: '700', color: C.ink },
  confPill:        { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 8 },
  confText:        { fontSize: 9, fontFamily: F.mono, color: C.ink, letterSpacing: 1 },
  intelNote:       { fontSize: 12, fontFamily: F.body, color: C.inkMid, marginBottom: 16 },
  deltaBlock:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  deltaText:       { fontSize: 11, fontFamily: F.mono, letterSpacing: 0.5 },
  primaryBtn:      { backgroundColor: C.ink, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  primaryBtnLabel: { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  ghostBtn:        { borderWidth: 1.5, borderColor: C.inkSoft, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  ghostBtnLabel:   { fontSize: 13, fontFamily: F.body, fontWeight: '700', color: C.inkMid, letterSpacing: 1 },
});
