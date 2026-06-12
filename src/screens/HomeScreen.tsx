import React, { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useAudio } from '../hooks/useAudio';
import { useGameStore } from '../store/gameStore';
import type { AdvantageType } from '../data/advantages';
import { usePhase } from '../hooks/usePhase';
import AdvantageCard from '../components/game/AdvantageCard';
import CampScene from '../components/graphics/CampScene';
import Portrait from '../components/atoms/Portrait';
import { initials } from '../data/roster';
import { PLAYER_ID } from '../utils/voteSimulator';
import { estimateSeasonDays } from '../utils/seasonLength';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeColors } from '../contexts/ThemeContext';
import type { Castaway } from '../data/roster';

type Props = StackScreenProps<GameParamList, 'Home'>;

// ── Sub-components ─────────────────────────────────────────

interface ActionTileProps {
  glyph: string;
  label: string;
  sub: string;
  onPress: () => void;
  accent: string;
  theme: ThemeColors;
  disabled?: boolean;
}

function ActionTile({ glyph, label, sub, onPress, accent, theme, disabled }: ActionTileProps) {
  return (
    <TouchableOpacity
      style={[styles.actionTile, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <View style={[styles.actionGlyphBox, { backgroundColor: accent }]}>
        <Text style={styles.actionGlyphText}>{glyph}</Text>
      </View>
      <Text style={[styles.actionLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.actionSub, { color: theme.textSoft }]}>{sub}</Text>
    </TouchableOpacity>
  );
}

interface StatColumnProps {
  label: string;
  value: number;
  theme: ThemeColors;
}

function StatColumn({ label, value, theme }: StatColumnProps) {
  return (
    <View style={styles.statCol}>
      <Text style={[styles.statColNum, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statColLabel, { color: theme.textSoft }]}>{label}</Text>
    </View>
  );
}

interface BoardRowProps {
  title: string;
  sub: string;
  castaways: Castaway[];
  statKey: 'loyalty' | 'threat';
  color: string;
  theme: ThemeColors;
  onPress: (id: number) => void;
}

function BoardRow({ title, sub, castaways, statKey, color, theme, onPress }: BoardRowProps) {
  return (
    <View style={styles.boardRow}>
      <View style={styles.boardRowHeader}>
        <Text style={[styles.boardRowTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.boardRowSub, { color: theme.textSoft }]}>{sub}</Text>
      </View>
      <View style={styles.boardRowCast}>
        {castaways.map(c => (
          <TouchableOpacity key={c.id} style={styles.boardCastItem} onPress={() => onPress(c.id)}>
            <Portrait color={c.color} initials={initials(c.name)} size={42} archetype={c.archetype} />
            <Text style={[styles.boardCastName, { color: theme.text }]} numberOfLines={1}>
              {c.name.split(' ')[0]}
            </Text>
            <Text style={[styles.boardCastStat, { color }]}>
              {Math.round(c.stats[statKey] * 100)}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────

export default function HomeScreen({ navigation }: Props) {
  const { phase, day, gameMode, advance } = usePhase();
  const { startMusic, stopMusic } = useAudio();
  const theme = useTheme();

  useFocusEffect(
    useCallback(() => {
      startMusic('camp');
      return () => { stopMusic(); };
    }, [startMusic, stopMusic]),
  );

  const {
    playerName, playerTribeId, tribes, feed, castaways,
    playerIdolCount, playerAdvantages, playerImmunityWins, edgeIds,
    gameSettings,
  } = useGameStore(
    useShallow(s => ({
      playerName:          s.playerName,
      playerTribeId:       s.playerTribeId,
      tribes:              s.tribes,
      feed:                s.feed,
      castaways:           s.castaways,
      playerIdolCount:     s.playerIdolCount,
      playerAdvantages:    s.playerAdvantages,
      playerImmunityWins:  s.playerImmunityWins,
      edgeIds:             s.edgeIds,
      gameSettings:        s.gameSettings,
    }))
  );

  // If the player is currently banished to the Edge, send them there.
  useFocusEffect(
    useCallback(() => {
      if (edgeIds.includes(PLAYER_ID)) navigation.navigate('Edge');
    }, [edgeIds, navigation]),
  );

  const allAdvantages: AdvantageType[] = [
    ...Array.from({ length: playerIdolCount }, () => 'hii' as AdvantageType),
    ...playerAdvantages,
  ];

  const tribe = tribes.find(t => t.id === playerTribeId);
  const alive = castaways.filter(c => !c.eliminated);
  const recentFeed = feed.slice(0, 4);
  const totalDays = estimateSeasonDays(gameSettings);
  const dayPct = Math.min(100, Math.round((day / totalDays) * 100));

  const npcsAlive  = alive.filter(c => c.id !== PLAYER_ID);
  const top3Loyal  = [...npcsAlive].sort((a, b) => b.stats.loyalty - a.stats.loyalty).slice(0, 3);
  const top3Threat = [...npcsAlive].sort((a, b) => b.stats.threat  - a.stats.threat).slice(0, 3);

  function handleCTA(target: 'advance' | 'endday') {
    if (target === 'endday') {
      navigation.navigate('EndDay');
    } else {
      advance();
    }
  }

  const canExplore = phase === 'morning' || phase === 'day' || phase === 'evening';

  return (
    <View style={[styles.root, { backgroundColor: theme.screenBg }]}>
      {/* Camp scene hero — sits at top, outside ScrollView so it doesn't scroll away */}
      <CampScene timeOfDay={theme.campTimeOfDay} height={190} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Day card + pills overlapping camp scene */}
        <View style={styles.campOverlay}>
          <View style={[styles.dayCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={[styles.dayMono, { color: theme.textSoft }]}>DAY</Text>
            <Text style={[styles.dayNum, { color: theme.text }]}>{String(day).padStart(2, '0')}</Text>
          </View>
          <View style={styles.topPills}>
            {tribe && (
              <View style={[styles.pill, { backgroundColor: tribe.color }]}>
                <Text style={styles.pillTxt}>{tribe.name.toUpperCase()}</Text>
              </View>
            )}
            <View style={[styles.pill, { backgroundColor: gameMode === 'post-merge' ? C.coral : C.palm }]}>
              <Text style={styles.pillTxt}>{alive.length} LEFT</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Settings')} hitSlop={10}>
              <Text style={[styles.gearIcon, { color: theme.textSoft }]}>⚙</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Standing stats card */}
        <View style={[styles.statsCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.statsTop}>
            <Text style={[styles.statsCrumb, { color: theme.textSoft }]}>YOUR STANDING</Text>
            <View style={styles.seasonBar}>
              <View style={[styles.seasonFill, { width: `${dayPct}%` as any }]} />
            </View>
            <Text style={[styles.seasonPct, { color: theme.textSoft }]}>{dayPct}% of season</Text>
          </View>
          <View style={[styles.statsBottom, { borderTopColor: theme.cardBorder }]}>
            <StatColumn label="IDOLS"   value={playerIdolCount}        theme={theme} />
            <View style={[styles.statDiv, { backgroundColor: theme.cardBorder }]} />
            <StatColumn label="ADV"     value={playerAdvantages.length} theme={theme} />
            <View style={[styles.statDiv, { backgroundColor: theme.cardBorder }]} />
            <StatColumn label="WINS"    value={playerImmunityWins}      theme={theme} />
          </View>
        </View>

        {/* Advantage inventory */}
        {allAdvantages.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.crumb, { color: theme.textSoft }]}>YOUR ADVANTAGES</Text>
            {allAdvantages.map((type, i) => (
              <AdvantageCard key={`${type}-${i}`} type={type} compact />
            ))}
          </View>
        )}

        {/* Primary CTA */}
        {phase === 'sleep' && (
          <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: theme.text }]} onPress={() => handleCTA('endday')}>
            <Text style={styles.ctaLabel}>☾  END THE DAY</Text>
          </TouchableOpacity>
        )}

        {/* Explore action tiles */}
        {canExplore && (
          <View style={styles.section}>
            <Text style={[styles.crumb, { color: theme.textSoft }]}>TODAY · DAY {String(day).padStart(2, '0')}</Text>
            <View style={styles.tilesGrid}>
              <ActionTile
                glyph="◐" label="Roster" sub="Talk to castaways"
                onPress={() => navigation.navigate('Roster')}
                accent={C.ocean} theme={theme}
              />
              <ActionTile
                glyph="✦" label="Search" sub="Hunt for idols"
                onPress={() => navigation.navigate('Island')}
                accent={C.palm} theme={theme}
              />
              <ActionTile
                glyph="✎" label="Journal" sub="Intel & alliances"
                onPress={() => navigation.navigate('Intel')}
                accent={C.inkMid} theme={theme}
              />
              {phase === 'morning' && (
                <ActionTile
                  glyph="▲" label="Reward" sub="Challenge at dawn"
                  onPress={() => advance()}
                  accent={C.sun} theme={theme}
                />
              )}
              {(phase === 'day' || phase === 'evening') && (
                <ActionTile
                  glyph="✜" label="Immunity" sub="Fight for safety"
                  onPress={() => advance()}
                  accent={C.coral} theme={theme}
                />
              )}
            </View>
          </View>
        )}

        {/* Phase CTA for challenge / tribal phases */}
        {(phase === 'reward' || phase === 'immunity') && (
          <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: theme.text }]} onPress={() => advance()}>
            <Text style={styles.ctaLabel}>
              {phase === 'reward' ? '▲  START REWARD CHALLENGE' : '✜  HEAD TO IMMUNITY'}
            </Text>
          </TouchableOpacity>
        )}
        {phase === 'evening' && (
          <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: C.coral }]} onPress={() => advance()}>
            <Text style={styles.ctaLabel}>🔥  ADVANCE TO TRIBAL</Text>
          </TouchableOpacity>
        )}
        {phase === 'tribal' && (
          <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: C.night }]} onPress={() => advance()}>
            <Text style={styles.ctaLabel}>🕯  ENTER TRIBAL COUNCIL</Text>
          </TouchableOpacity>
        )}

        {/* Board: most loyal + top threats */}
        {alive.length >= 3 && (
          <View style={styles.section}>
            <View style={styles.boardHeader}>
              <Text style={[styles.crumb, { color: theme.textSoft }]}>READ ON THE BOARD</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Roster')}>
                <Text style={[styles.boardLink, { color: C.coral }]}>FULL ROSTER →</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.boardCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <BoardRow
                title="MOST LOYAL"
                sub="To you"
                castaways={top3Loyal}
                statKey="loyalty"
                color={C.ocean}
                theme={theme}
                onPress={id => navigation.navigate('CastawayDetail', { castawayId: id })}
              />
              <View style={[styles.boardDivider, { backgroundColor: theme.cardBorder }]} />
              <BoardRow
                title="TOP THREATS"
                sub="To everyone"
                castaways={top3Threat}
                statKey="threat"
                color={C.coral}
                theme={theme}
                onPress={id => navigation.navigate('CastawayDetail', { castawayId: id })}
              />
            </View>
          </View>
        )}

        {/* Recent feed */}
        {recentFeed.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.crumb, { color: theme.textSoft }]}>RECENT</Text>
            <View style={[styles.feedCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              {recentFeed.map((entry, i) => (
                <View key={entry.id} style={[styles.feedRow, i < recentFeed.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.cardBorder }]}>
                  <View style={[styles.feedBar, { backgroundColor: feedBarColor(entry.type) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.feedText, { color: theme.text }]}>{entry.text}</Text>
                    <Text style={[styles.feedMeta, { color: theme.textSoft }]}>
                      DAY {String(entry.day).padStart(2, '0')} · {entry.type.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function feedBarColor(type: string): string {
  if (type === 'vote' || type === 'tribal') return C.coral;
  if (type === 'advantage') return C.sun;
  if (type === 'merge') return C.ocean;
  if (type === 'alliance') return C.palm;
  return C.inkSoft;
}

const styles = StyleSheet.create({
  root:            { flex: 1 },
  scroll:          { flex: 1, marginTop: -44 },
  content:         { paddingBottom: 48 },

  // Camp overlay
  campOverlay:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginBottom: 12 },
  dayCard:         { borderWidth: 1.5, borderRadius: 12, padding: '8px 12px' as any, paddingHorizontal: 12, paddingVertical: 8, shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  dayMono:         { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.4, fontWeight: '600' },
  dayNum:          { fontFamily: F.display, fontWeight: '800', fontSize: 32, lineHeight: 36, letterSpacing: -1 },
  topPills:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  pill:            { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pillTxt:         { fontFamily: F.body, fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.8 },
  gearIcon:        { fontSize: 20, marginLeft: 2 },

  // Stats card
  statsCard:       { marginHorizontal: 16, marginBottom: 16, borderWidth: 1.5, borderRadius: 14, overflow: 'hidden', shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  statsTop:        { padding: 12 },
  statsCrumb:      { fontFamily: F.mono, fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  seasonBar:       { height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  seasonFill:      { height: 4, backgroundColor: C.palm, borderRadius: 2 },
  seasonPct:       { fontFamily: F.mono, fontSize: 10 },
  statsBottom:     { flexDirection: 'row', borderTopWidth: 1 },
  statCol:         { flex: 1, paddingVertical: 10, alignItems: 'center' },
  statColNum:      { fontFamily: F.display, fontWeight: '800', fontSize: 22, lineHeight: 26 },
  statColLabel:    { fontFamily: F.mono, fontSize: 9, letterSpacing: 1, marginTop: 2 },
  statDiv:         { width: 1, marginVertical: 8 },

  // Sections
  section:         { marginBottom: 20, paddingHorizontal: 16 },
  crumb:           { fontFamily: F.mono, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },

  // CTA
  ctaBtn:          { marginHorizontal: 16, marginBottom: 16, borderRadius: 12, paddingVertical: 16, alignItems: 'center', shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 0 },
  ctaLabel:        { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },

  // Action tiles
  tilesGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionTile:      { width: '47%' as any, borderWidth: 1.5, borderRadius: 12, padding: 12, shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, position: 'relative', overflow: 'hidden' },
  actionGlyphBox:  { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  actionGlyphText: { fontFamily: F.mono, fontSize: 13, fontWeight: '700', color: '#fff' },
  actionLabel:     { fontFamily: F.display, fontWeight: '700', fontSize: 17, letterSpacing: -0.2, marginBottom: 2, marginTop: 4 },
  actionSub:       { fontFamily: F.body, fontSize: 11 },

  // Board
  boardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  boardLink:       { fontFamily: F.mono, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  boardCard:       { borderWidth: 1.5, borderRadius: 14, overflow: 'hidden', shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  boardRow:        { padding: 12 },
  boardRowHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  boardRowTitle:   { fontFamily: F.mono, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  boardRowSub:     { fontFamily: F.body, fontSize: 10 },
  boardRowCast:    { flexDirection: 'row', gap: 10 },
  boardCastItem:   { flex: 1, alignItems: 'center', gap: 4 },
  boardCastName:   { fontFamily: F.body, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  boardCastStat:   { fontFamily: F.mono, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  boardDivider:    { height: 1 },

  // Feed
  feedCard:        { borderWidth: 1.5, borderRadius: 14, overflow: 'hidden', shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  feedRow:         { flexDirection: 'row', gap: 10, padding: 12 },
  feedBar:         { width: 4, borderRadius: 2, alignSelf: 'stretch', marginTop: 2, marginBottom: 2 },
  feedText:        { fontSize: 13, fontFamily: F.body, lineHeight: 18 },
  feedMeta:        { fontFamily: F.mono, fontSize: 9, letterSpacing: 1, marginTop: 2 },
});
