import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import type { StackScreenProps } from '@react-navigation/stack';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { initials } from '../data/roster';
import type { Castaway } from '../data/roster';
import { STAT_META } from '../data/statMeta';
import type { StatKey } from '../data/statMeta';
import { ARCHETYPES } from '../data/archetypes';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';
import { useTheme } from '../contexts/ThemeContext';
import Portrait from '../components/atoms/Portrait';
import StatBar from '../components/atoms/StatBar';

type Props = StackScreenProps<GameParamList, 'CastawayDetail'>;

const STAT_ORDER: StatKey[] = ['trust', 'loyalty', 'suspicion', 'mood', 'strength', 'mental', 'social', 'threat'];

interface ConnRowProps {
  castaway: Castaway;
  label: string;
  labelColor: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}

function ConnRow({ castaway, label, labelColor, onPress, theme }: ConnRowProps) {
  return (
    <TouchableOpacity style={styles.connRow} onPress={onPress} activeOpacity={0.75}>
      <Portrait
        color={castaway.color}
        initials={initials(castaway.name)}
        size={38}
        archetype={castaway.archetype}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.connLabel, { color: labelColor }]}>{label}</Text>
        <Text style={[styles.connName, { color: theme.text }]}>{castaway.name.split(' ')[0]}</Text>
        <Text style={[styles.connMeta, { color: theme.textSoft }]}>{castaway.job}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function CastawayDetailScreen({ navigation, route }: Props) {
  const theme = useTheme();

  const { castaway, tribes, castaways, intel, alliances } = useGameStore(
    useShallow(s => ({
      castaway:  s.castaways.find(c => c.id === route.params.castawayId),
      tribes:    s.tribes,
      castaways: s.castaways,
      intel:     s.intel,
      alliances: s.alliances,
    }))
  );

  if (!castaway) {
    return (
      <View style={[styles.root, { backgroundColor: theme.screenBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={[styles.backLabel, { color: theme.textSoft }]}>‹ BACK</Text>
        </TouchableOpacity>
        <Text style={[styles.errorTxt, { color: C.coral }]}>Castaway not found.</Text>
      </View>
    );
  }

  const tribe = tribes.find(t => t.id === castaway.tribeId);
  const archRevealed = castaway.revealed.archetype;

  // Connections
  const alive = castaways.filter(c => c.id !== castaway.id && !c.eliminated);
  const closeAlly = [...alive].sort((a, b) => b.stats.loyalty   - a.stats.loyalty)[0];
  const rival     = [...alive].sort((a, b) => b.stats.suspicion - a.stats.suspicion)[0];

  const leftStats  = STAT_ORDER.slice(0, 4);
  const rightStats = STAT_ORDER.slice(4);

  const relatedIntel = intel.filter(e => e.subjectIds.includes(castaway.id)).slice(0, 4);
  const sharedAlliances = alliances.filter(a => a.knownToPlayer && a.memberIds.includes(castaway.id));

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.screenBg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={[styles.backLabel, { color: theme.textSoft }]}>‹ BACK</Text>
      </TouchableOpacity>

      {/* ── Hero card ── */}
      <View style={[styles.heroCard, { backgroundColor: castaway.color }]}>
        {/* Decorative SVG polygon pattern */}
        <Svg
          width={120}
          height={120}
          viewBox="0 0 100 100"
          style={styles.heroPoly}
        >
          <Polygon points="0,100 30,40 60,80 100,30 100,100" fill="rgba(255,255,255,0.6)" />
        </Svg>

        <View style={styles.heroContent}>
          <Portrait
            color={castaway.color}
            initials={initials(castaway.name)}
            size={72}
            archetype={castaway.archetype}
            borderColor="rgba(255,255,255,0.5)"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroMono}>
              CASTAWAY · {String(castaway.id).padStart(2, '0')}
            </Text>
            <Text style={styles.heroName}>{castaway.name}</Text>
            <Text style={styles.heroMeta}>{castaway.age} · {castaway.job}</Text>
          </View>
        </View>

        <View style={styles.heroPills}>
          {tribe && (
            <View style={styles.heroPill}>
              <Text style={styles.heroPillTxt}>{tribe.name.toUpperCase()}</Text>
            </View>
          )}
          {archRevealed ? (
            <View style={styles.heroPillDark}>
              <Text style={styles.heroPillTxt}>
                {ARCHETYPES[castaway.archetype].glyph} {ARCHETYPES[castaway.archetype].label.toUpperCase()}
              </Text>
            </View>
          ) : (
            <View style={styles.heroPillFaint}>
              <Text style={styles.heroPillFaintTxt}>ARCHETYPE LOCKED</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Archetype card ── */}
      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        {archRevealed ? (
          <>
            <Text style={[styles.cardCrumb, { color: theme.textSoft }]}>READ</Text>
            <Text style={[styles.cardBody, { color: theme.text }]}>
              <Text style={{ fontWeight: '700' }}>{ARCHETYPES[castaway.archetype].label}. </Text>
              {ARCHETYPES[castaway.archetype].desc}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.cardCrumb, { color: C.coral }]}>NOT YET READ</Text>
            <Text style={[styles.cardBody, { color: theme.text }]}>
              Talk to {castaway.name.split(' ')[0]} 2–3 more times to learn how they actually play.
            </Text>
          </>
        )}
      </View>

      {/* ── Stats ── */}
      {castaway.eliminated && (
        <View style={[styles.elimBanner, { backgroundColor: C.coral }]}>
          <Text style={styles.elimBannerTxt}>ELIMINATED · DAY {castaway.eliminatedDay}</Text>
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: theme.textSoft }]}>STATS</Text>
      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <View style={styles.statsGrid}>
          <View style={{ flex: 1 }}>
            {leftStats.map(key => (
              <StatBar
                key={key}
                label={STAT_META[key].label}
                value={castaway.stats[key]}
                fillColor={STAT_META[key].color}
                hidden={!castaway.revealed[key]}
                tiny
              />
            ))}
          </View>
          <View style={[styles.statsDivider, { backgroundColor: theme.cardBorder }]} />
          <View style={{ flex: 1 }}>
            {rightStats.map(key => (
              <StatBar
                key={key}
                label={STAT_META[key].label}
                value={castaway.stats[key]}
                fillColor={STAT_META[key].color}
                hidden={!castaway.revealed[key]}
                tiny
              />
            ))}
          </View>
        </View>
      </View>

      {/* ── Observed connections ── */}
      {(closeAlly || rival) && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.textSoft }]}>OBSERVED CONNECTIONS</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, padding: 0, overflow: 'hidden' }]}>
            {closeAlly && (
              <ConnRow
                castaway={closeAlly}
                label="CLOSE WITH"
                labelColor={C.ocean}
                theme={theme}
                onPress={() => navigation.navigate('CastawayDetail', { castawayId: closeAlly.id })}
              />
            )}
            {rival && rival.id !== closeAlly?.id && (
              <>
                <View style={[styles.connDivider, { backgroundColor: theme.cardBorder }]} />
                <ConnRow
                  castaway={rival}
                  label="WARY OF"
                  labelColor={C.coral}
                  theme={theme}
                  onPress={() => navigation.navigate('CastawayDetail', { castawayId: rival.id })}
                />
              </>
            )}
          </View>
        </>
      )}

      {/* ── Intel & alliances ── */}
      {(relatedIntel.length > 0 || sharedAlliances.length > 0) && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.textSoft }]}>WHAT YOU KNOW</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            {sharedAlliances.map(a => (
              <Text key={a.id} style={[styles.intelLine, { color: C.ocean }]}>
                ◆ In an alliance: {a.name} ({a.memberIds.length})
              </Text>
            ))}
            {relatedIntel.map(e => (
              <Text key={e.id} style={[styles.intelLine, { color: theme.text }]}>
                • {e.text} <Text style={{ color: theme.textSoft }}>({e.confidence})</Text>
              </Text>
            ))}
          </View>
        </>
      )}

      {/* ── Relationship log ── */}
      {castaway.relationshipLog.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.textSoft }]}>HISTORY</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            {castaway.relationshipLog.slice(-4).map((entry, i) => (
              <View key={i} style={styles.logRow}>
                <Text style={[styles.logDay, { color: theme.textSoft }]}>Day {entry.day}</Text>
                <Text style={[styles.logNote, { color: theme.text }]}>{entry.note}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── CTA buttons ── */}
      {!castaway.eliminated && (
        <View style={styles.ctaBlock}>
          <TouchableOpacity
            style={[styles.ctaPrimary, { backgroundColor: theme.text }]}
            onPress={() => navigation.navigate('Convo', { castawayId: castaway.id })}
          >
            <Text style={styles.ctaPrimaryLabel}>◐  PULL ASIDE</Text>
          </TouchableOpacity>
          <View style={styles.ctaGhostRow}>
            <TouchableOpacity
              style={[styles.ctaGhost, { borderColor: theme.cardBorder }]}
              onPress={() => navigation.navigate('Convo', { castawayId: castaway.id })}
            >
              <Text style={[styles.ctaGhostLabel, { color: theme.text }]}>✦  PITCH ALLIANCE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctaGhost, { borderColor: theme.cardBorder }]}
              onPress={() => navigation.navigate('Convo', { castawayId: castaway.id })}
            >
              <Text style={[styles.ctaGhostLabel, { color: theme.text }]}>◇  ASK AROUND</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1 },
  content:         { paddingBottom: 48 },
  back:            { paddingHorizontal: 24, paddingTop: 60, marginBottom: 12 },
  backLabel:       { fontSize: 13, fontFamily: F.body, fontWeight: '700' },
  errorTxt:        { fontSize: 13, fontFamily: F.body, paddingHorizontal: 24 },

  // Hero card
  heroCard:        { marginHorizontal: 16, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: C.ink, shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, overflow: 'hidden', marginBottom: 12 },
  heroPoly:        { position: 'absolute', top: -10, right: -10, opacity: 0.18 },
  heroContent:     { flexDirection: 'row', gap: 14, alignItems: 'flex-end', position: 'relative' },
  heroMono:        { fontFamily: F.mono, fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, marginBottom: 2 },
  heroName:        { fontFamily: F.display, fontSize: 24, fontWeight: '800', color: '#fff', lineHeight: 28, letterSpacing: -0.6 },
  heroMeta:        { fontFamily: F.body, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  heroPills:       { flexDirection: 'row', gap: 6, marginTop: 14, flexWrap: 'wrap' },
  heroPill:        { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  heroPillDark:    { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.3)' },
  heroPillFaint:   { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroPillTxt:     { fontFamily: F.mono, fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 1 },
  heroPillFaintTxt:{ fontFamily: F.mono, fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },

  // Card
  card:            { marginHorizontal: 16, marginBottom: 12, borderWidth: 1.5, borderRadius: 12, padding: 14 },
  cardCrumb:       { fontFamily: F.mono, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  cardBody:        { fontFamily: F.body, fontSize: 13, lineHeight: 19 },

  // Eliminated banner
  elimBanner:      { marginHorizontal: 16, marginBottom: 12, borderRadius: 8, padding: 8, alignItems: 'center' },
  elimBannerTxt:   { fontFamily: F.body, fontSize: 11, fontWeight: '700', color: C.bone, letterSpacing: 1 },

  // Section labels
  sectionLabel:    { paddingHorizontal: 16, fontSize: 10, fontFamily: F.mono, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },

  // Stats 2-col
  statsGrid:       { flexDirection: 'row', gap: 12 },
  statsDivider:    { width: 1 },

  // Connections
  connRow:         { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12 },
  connLabel:       { fontFamily: F.mono, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  connName:        { fontFamily: F.display, fontWeight: '700', fontSize: 14, lineHeight: 18 },
  connMeta:        { fontFamily: F.body, fontSize: 11, marginTop: 1 },
  connDivider:     { height: 1 },

  // Intel
  intelLine:       { fontFamily: F.body, fontSize: 12, lineHeight: 18, marginBottom: 6 },

  // Log
  logRow:          { flexDirection: 'row', gap: 10, marginBottom: 6 },
  logDay:          { fontSize: 10, fontFamily: F.mono, width: 42 },
  logNote:         { flex: 1, fontSize: 12, fontFamily: F.body },

  // CTAs
  ctaBlock:        { paddingHorizontal: 16, marginTop: 8, gap: 8 },
  ctaPrimary:      { borderRadius: 12, paddingVertical: 16, alignItems: 'center', shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 0 },
  ctaPrimaryLabel: { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  ctaGhostRow:     { flexDirection: 'row', gap: 8 },
  ctaGhost:        { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  ctaGhostLabel:   { fontSize: 12, fontFamily: F.body, fontWeight: '700', letterSpacing: 0.5 },
});
