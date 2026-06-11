import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
} from 'react-native';
import { useSettingsStore, type Difficulty, type ThemeKey } from '../store/settingsStore';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';
import { useTheme } from '../contexts/ThemeContext';

type Props = { navigation: { goBack: () => void } };

const DIFFICULTIES: { key: Difficulty; label: string; desc: string }[] = [
  { key: 'easy',   label: 'EASY',   desc: 'Fewer NPC advantages. Slower threat growth.' },
  { key: 'medium', label: 'MEDIUM', desc: 'Balanced. The classic Survivor experience.' },
  { key: 'hard',   label: 'HARD',   desc: 'NPCs scheme harder. Stats decay faster.' },
];

const THEMES: { key: ThemeKey; label: string; swatch: string }[] = [
  { key: 'island', label: 'ISLAND', swatch: C.sand },
  { key: 'dusk',   label: 'DUSK',   swatch: C.torch },
  { key: 'night',  label: 'NIGHT',  swatch: C.nightMid },
];

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

export default function SettingsScreen({ navigation }: Props) {
  const {
    soundEnabled, setSoundEnabled,
    musicEnabled, setMusicEnabled,
    difficulty, setDifficulty,
    theme: themeKey, setTheme,
  } = useSettingsStore();
  const themeColors = useTheme();

  return (
    <ScrollView contentContainerStyle={[styles.root, { backgroundColor: themeColors.screenBg }]} bounces={false}>
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: themeColors.text }]}>SETTINGS</Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={[styles.closeBtn, { color: themeColors.textSoft }]}>✕ CLOSE</Text>
        </Pressable>
      </View>

      {/* Audio */}
      <SectionLabel label="AUDIO" />
      <View style={[styles.card, { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }]}>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: themeColors.text }]}>Sound Effects</Text>
          <Switch
            value={soundEnabled}
            onValueChange={setSoundEnabled}
            trackColor={{ true: C.ocean, false: C.sandMid }}
            thumbColor={C.bone}
          />
        </View>
        <View style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: themeColors.cardBorder }]}>
          <Text style={[styles.toggleLabel, { color: themeColors.text }]}>Music</Text>
          <Switch
            value={musicEnabled}
            onValueChange={setMusicEnabled}
            trackColor={{ true: C.ocean, false: C.sandMid }}
            thumbColor={C.bone}
          />
        </View>
      </View>

      {/* Difficulty */}
      <SectionLabel label="DEFAULT DIFFICULTY" />
      <View style={styles.diffRow}>
        {DIFFICULTIES.map(d => {
          const active = difficulty === d.key;
          return (
            <Pressable
              key={d.key}
              style={[styles.diffCard, { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }, active && styles.diffCardActive]}
              onPress={() => setDifficulty(d.key)}
            >
              <Text style={[styles.diffLabel, { color: themeColors.textSoft }, active && styles.diffLabelActive]}>{d.label}</Text>
              <Text style={[styles.diffDesc, { color: themeColors.textSoft }, active && styles.diffDescActive]}>{d.desc}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Theme */}
      <SectionLabel label="VISUAL THEME" />
      <View style={styles.themeRow}>
        {THEMES.map(t => {
          const active = themeKey === t.key;
          return (
            <Pressable
              key={t.key}
              style={styles.themeItem}
              onPress={() => setTheme(t.key)}
            >
              <View style={[
                styles.swatch,
                { backgroundColor: t.swatch },
                active && styles.swatchActive,
              ]} />
              <Text style={[styles.themeLabel, { color: themeColors.textSoft }, active && styles.themeLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:             { flexGrow: 1, backgroundColor: C.bone, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 48 },
  topRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  title:            { fontFamily: F.display, fontSize: 28, color: C.ink },
  closeBtn:         { fontFamily: F.body, fontSize: 12, color: C.inkMid, letterSpacing: 1 },
  sectionLabel:     { fontFamily: F.body, fontSize: 10, color: C.inkSoft, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, marginTop: 24 },
  card:             { backgroundColor: C.sand, borderRadius: 14, borderWidth: 1.5, borderColor: C.ink, overflow: 'hidden' },
  toggleRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  toggleLabel:      { fontFamily: F.body, fontSize: 14, color: C.ink },
  diffRow:          { gap: 10 },
  diffCard:         { backgroundColor: C.sand, borderRadius: 12, borderWidth: 1.5, borderColor: C.inkSoft, padding: 14 },
  diffCardActive:   { backgroundColor: C.ink, borderColor: C.ink, shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  diffLabel:        { fontFamily: F.body, fontSize: 12, fontWeight: '700', color: C.inkMid, letterSpacing: 1 },
  diffLabelActive:  { color: C.bone },
  diffDesc:         { fontFamily: F.body, fontSize: 12, color: C.inkSoft, marginTop: 4 },
  diffDescActive:   { color: C.sandMid },
  themeRow:         { flexDirection: 'row', gap: 20 },
  themeItem:        { alignItems: 'center', gap: 6 },
  swatch:           { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: C.inkSoft },
  swatchActive:     { borderColor: C.ink, shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  themeLabel:       { fontFamily: F.body, fontSize: 9, color: C.inkSoft, letterSpacing: 1 },
  themeLabelActive: { color: C.ink, fontWeight: '700' },
});
