import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Polygon, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { StackScreenProps } from '@react-navigation/stack';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { CLUE_FLAVOR, SEARCHES_PER_DAY_WARNING } from '../data/locations';
import type { Location } from '../data/locations';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';
import { useTheme } from '../contexts/ThemeContext';

type Props = StackScreenProps<GameParamList, 'Island'>;

interface SearchState {
  locationId: string;
  outcome: 'idol' | 'clue' | 'nothing';
  watched: boolean;
  clueText?: string;
}

export default function IslandScreen({ navigation }: Props) {
  const [lastSearch, setLastSearch] = useState<SearchState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const theme = useTheme();

  const { locations, searchesToday, playerIdolCount, playerCluesHeld, day } = useGameStore(
    useShallow(s => ({
      locations:       s.locations,
      searchesToday:   s.searchesToday,
      playerIdolCount: s.playerIdolCount,
      playerCluesHeld: s.playerCluesHeld,
      day:             s.day,
    }))
  );
  const searchLocation = useGameStore(s => s.searchLocation);
  const addFeedEntry   = useGameStore(s => s.addFeedEntry);
  const phase          = useGameStore(s => s.phase);

  const selectedLoc = locations.find(l => l.id === selectedId) ?? null;

  function handleSearch(loc: Location) {
    const result = searchLocation(loc.id);
    let clueText: string | undefined;

    if (result.outcome === 'clue') {
      const flavor = CLUE_FLAVOR[loc.id];
      if (flavor) {
        const idx = Math.min(loc.cluesHeld, flavor.length - 1);
        clueText = flavor[idx];
      }
    }

    setLastSearch({ locationId: loc.id, outcome: result.outcome, watched: result.watched, clueText });

    addFeedEntry({
      id:    `island-${loc.id}-day${day}-${Date.now()}`,
      day,
      phase,
      text:  result.outcome === 'idol'
        ? `You found a hidden immunity idol at ${loc.name}!`
        : result.outcome === 'clue'
        ? `You found a clue at ${loc.name}.`
        : `You searched ${loc.name} but found nothing.`,
      type:  result.outcome === 'idol' ? 'advantage' : 'system',
    });
  }

  function pinBg(loc: Location): string {
    if (!loc.unlocked)               return 'rgba(0,0,0,0.5)';
    if (selectedId === loc.id)       return C.coral;
    if (loc.payoff === 'IDOL')       return C.sun;
    return C.bone;
  }

  function pinGlyph(loc: Location): string {
    if (!loc.unlocked)               return '⬚';
    if (loc.payoff === 'IDOL')       return '◆';
    if (loc.payoff === 'CLUE')       return '?';
    return '○';
  }

  const isWatched = searchesToday >= SEARCHES_PER_DAY_WARNING;
  const searched = lastSearch !== null;

  return (
    <View style={[styles.root, { backgroundColor: theme.screenBg }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={[styles.backLabel, { color: theme.textSoft }]}>‹ BACK</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>IDOL HUNT</Text>
          <Text style={[styles.sub, { color: theme.textSoft }]}>
            Day {day} · {searchesToday} search{searchesToday !== 1 ? 'es' : ''} today
          </Text>
          {playerCluesHeld > 0 && (
            <Text style={styles.clueBoost}>
              {playerCluesHeld} CLUE{playerCluesHeld > 1 ? 'S' : ''} HELD · {Math.min(85, 35 + playerCluesHeld * 15)}% FIND ODDS
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {playerIdolCount > 0 && (
            <View style={styles.idolBadge}>
              <Text style={styles.idolBadgeText}>{playerIdolCount} IDOL{playerIdolCount > 1 ? 'S' : ''}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Search result */}
        {lastSearch && (
          <View style={[styles.resultBanner, { borderColor: outcomeColor(lastSearch.outcome), backgroundColor: outcomeColor(lastSearch.outcome) + '22' }]}>
            <Text style={[styles.resultTitle, { color: outcomeColor(lastSearch.outcome) }]}>
              {outcomeLabel(lastSearch.outcome)}
            </Text>
            {lastSearch.clueText && (
              <Text style={styles.resultClue}>"{lastSearch.clueText}"</Text>
            )}
            {lastSearch.watched && (
              <Text style={styles.resultWatched}>Someone saw you head out.</Text>
            )}
          </View>
        )}

        {/* Watched warning */}
        {isWatched && !lastSearch && (
          <View style={styles.warning}>
            <Text style={styles.warningText}>⚠ You're being watched. Someone noticed you searching.</Text>
          </View>
        )}

        {/* SVG Island Map */}
        <View style={[styles.mapContainer, { borderColor: theme.cardBorder }]}>
          {/* Ocean gradient background */}
          <Svg width="100%" height="100%" viewBox="0 0 400 260" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={C.oceanLight} />
                <Stop offset="1" stopColor={C.ocean} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="400" height="260" fill="url(#ocean)" />
            {/* Island silhouette */}
            <Path
              d="M60,180 Q40,120 90,80 Q140,40 200,55 Q260,30 310,80 Q360,120 340,200 Q310,260 240,260 Q160,275 100,250 Q50,230 60,180 Z"
              fill={C.palm}
            />
            <Path
              d="M70,180 Q55,135 95,95 Q150,65 200,75 Q250,55 295,95 Q330,135 320,190 Q295,235 240,240 Q170,250 110,230 Q70,210 70,180 Z"
              fill={C.palmLight}
              opacity={0.5}
            />
            {/* Mountain */}
            <Polygon points="180,90 220,70 250,110 200,130" fill={C.palmDeep} />
            <Polygon points="200,90 220,70 235,90" fill="rgba(255,255,255,0.25)" />
          </Svg>

          {/* Location pins */}
          {locations.map(loc => (
            <TouchableOpacity
              key={loc.id}
              style={[
                styles.pin,
                {
                  left: `${loc.mapX}%` as any,
                  top: `${loc.mapY}%` as any,
                  backgroundColor: pinBg(loc),
                  borderColor: selectedId === loc.id ? C.coral : C.ink,
                  borderStyle: loc.unlocked ? 'solid' : 'dashed',
                },
                selectedId === loc.id && styles.pinSelected,
              ]}
              onPress={() => loc.unlocked && setSelectedId(loc.id === selectedId ? null : loc.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pinGlyph, { color: loc.unlocked ? C.ink : 'rgba(255,255,255,0.8)' }]}>
                {pinGlyph(loc)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={[styles.legendPill, { backgroundColor: C.sun }]}><Text style={styles.legendTxt}>◆ IDOL</Text></View>
          <View style={[styles.legendPill, { backgroundColor: C.ocean }]}><Text style={[styles.legendTxt, { color: C.bone }]}>? CLUE</Text></View>
          <View style={[styles.legendPill, { backgroundColor: C.bone, borderWidth: 1, borderColor: C.inkSoft }]}><Text style={[styles.legendTxt, { color: C.ink }]}>○ COMMON</Text></View>
        </View>

        {/* Location detail card */}
        {selectedLoc ? (
          <View style={[styles.detailCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.detailHeader}>
              <View>
                <Text style={[styles.detailCrumb, { color: theme.textSoft }]}>LOCATION</Text>
                <Text style={[styles.detailName, { color: theme.text }]}>{selectedLoc.name}</Text>
              </View>
              <View style={[styles.payoffBadge, { backgroundColor: payoffColor(selectedLoc.payoff) }]}>
                <Text style={styles.payoffTxt}>{selectedLoc.payoff}</Text>
              </View>
            </View>

            <View style={styles.detailBars}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.barLabel, { color: theme.textSoft }]}>RISK</Text>
                <View style={styles.barTrack}>
                  <View style={{ flex: selectedLoc.risk, backgroundColor: riskColor(selectedLoc.risk), height: 4, borderRadius: 2 }} />
                  <View style={{ flex: 1 - selectedLoc.risk }} />
                </View>
              </View>
            </View>

            {selectedLoc.cluesHeld > 0 && (
              <Text style={styles.clueHint}>
                {selectedLoc.cluesHeld} clue{selectedLoc.cluesHeld > 1 ? 's' : ''} pointing here
              </Text>
            )}

            {selectedLoc.unlocked ? (
              <TouchableOpacity
                style={[styles.searchBtn, { backgroundColor: theme.text }, searched && lastSearch?.locationId === selectedLoc.id && { backgroundColor: C.inkSoft }]}
                onPress={() => handleSearch(selectedLoc)}
                disabled={!!(searched && lastSearch?.locationId === selectedLoc.id)}
              >
                <Text style={styles.searchBtnLabel}>
                  {searched && lastSearch?.locationId === selectedLoc.id ? 'SEARCHED ✓' : '✦  SEARCH HERE'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.lockedLabel, { color: theme.textSoft }]}>LOCKED — find a clue to unlock</Text>
            )}
          </View>
        ) : (
          <View style={[styles.noSelCard, { borderColor: theme.cardBorder }]}>
            <Text style={[styles.noSelText, { color: theme.textSoft }]}>
              Tap a location on the map.{'\n'}Greyed pins need a clue first.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function outcomeColor(outcome: 'idol' | 'clue' | 'nothing'): string {
  if (outcome === 'idol') return C.sun;
  if (outcome === 'clue') return C.ocean;
  return C.inkSoft;
}

function outcomeLabel(outcome: 'idol' | 'clue' | 'nothing'): string {
  if (outcome === 'idol') return '🏺 HIDDEN IMMUNITY IDOL FOUND';
  if (outcome === 'clue') return '📜 CLUE FOUND';
  return '— NOTHING FOUND';
}

function payoffColor(payoff: string): string {
  if (payoff === 'IDOL') return C.sun;
  if (payoff === 'CLUE') return C.ocean;
  return C.inkSoft;
}

function riskColor(risk: number): string {
  if (risk > 0.5) return C.coral;
  if (risk > 0.3) return C.torch;
  return C.palm;
}

const styles = StyleSheet.create({
  root:         { flex: 1, paddingTop: 60 },
  back:         { paddingHorizontal: 24, marginBottom: 6 },
  backLabel:    { fontSize: 13, fontFamily: F.body, fontWeight: '700' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 },
  title:        { fontSize: 28, fontFamily: F.display, fontWeight: '800', letterSpacing: -0.5 },
  sub:          { fontSize: 10, fontFamily: F.mono, letterSpacing: 1, marginTop: 2 },
  clueBoost:    { fontSize: 10, fontFamily: F.mono, color: C.ocean, letterSpacing: 0.5, marginTop: 3 },
  idolBadge:    { backgroundColor: C.sun, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  idolBadgeText:{ fontSize: 10, fontFamily: F.body, fontWeight: '700', color: C.ink, letterSpacing: 1 },

  scroll:       { flex: 1 },

  // Result / warning
  resultBanner: { marginHorizontal: 16, marginBottom: 10, borderWidth: 2, borderRadius: 10, padding: 12 },
  resultTitle:  { fontSize: 13, fontFamily: F.body, fontWeight: '800', letterSpacing: 0.5 },
  resultClue:   { fontSize: 12, fontFamily: F.body, color: C.inkMid, fontStyle: 'italic', marginTop: 4, lineHeight: 18 },
  resultWatched:{ fontSize: 11, fontFamily: F.body, color: C.coral, marginTop: 4 },
  warning:      { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#fff3cd', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.sun },
  warningText:  { fontSize: 12, fontFamily: F.body, color: '#856404' },

  // Map
  mapContainer: { marginHorizontal: 16, height: 220, borderRadius: 14, borderWidth: 1.5, overflow: 'hidden', marginBottom: 8, shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  pin:          { position: 'absolute', width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: -15 }, { translateY: -15 }] },
  pinSelected:  { shadowColor: C.coral, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6, elevation: 6 },
  pinGlyph:     { fontFamily: F.mono, fontSize: 11, fontWeight: '700' },

  // Legend
  legend:       { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  legendPill:   { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  legendTxt:    { fontFamily: F.mono, fontSize: 9, fontWeight: '700', color: C.ink, letterSpacing: 0.8 },

  // Detail card
  detailCard:   { marginHorizontal: 16, borderWidth: 1.5, borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  detailCrumb:  { fontFamily: F.mono, fontSize: 10, letterSpacing: 1 },
  detailName:   { fontFamily: F.display, fontSize: 19, fontWeight: '800', letterSpacing: -0.4, lineHeight: 24 },
  detailBars:   { flexDirection: 'row', gap: 10, marginBottom: 10 },
  barLabel:     { fontFamily: F.body, fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  barTrack:     { height: 4, backgroundColor: C.sandMid, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  clueHint:     { fontFamily: F.body, fontSize: 11, color: C.ocean, fontStyle: 'italic', marginBottom: 10 },
  payoffBadge:  { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  payoffTxt:    { fontSize: 8, fontFamily: F.mono, color: C.bone, fontWeight: '700', letterSpacing: 1 },
  searchBtn:    { borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  searchBtnLabel:{ fontSize: 12, fontFamily: F.body, fontWeight: '700', color: C.bone, letterSpacing: 1 },
  lockedLabel:  { fontSize: 11, fontFamily: F.body, fontStyle: 'italic', textAlign: 'center', paddingVertical: 6 },

  noSelCard:    { marginHorizontal: 16, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  noSelText:    { fontFamily: F.body, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
