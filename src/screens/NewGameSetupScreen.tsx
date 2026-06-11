import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { DEFAULT_GAME_SETTINGS, type GameSettings } from '../store/gameStore';
import { useSaveSlotStore } from '../store/saveSlotStore';
import { useSaveSlots } from '../hooks/useSaveSlots';
import type { Difficulty } from '../store/settingsStore';
import { GButton } from '../components/atoms';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';
import { useTheme } from '../contexts/ThemeContext';

type Props = StackScreenProps<RootParamList, 'NewGameSetup'>;

const DIFFICULTIES: {
  key: Difficulty;
  label: string;
  tagline: string;
  desc: string;
  modifiers: string[];
}[] = [
  {
    key:       'easy',
    label:     'EASY',
    tagline:   'The island is kind.',
    desc:      'NPCs cooperate more, fewer advantages in play. Stats decay slowly.',
    modifiers: ['Slower threat growth', 'Fewer NPC idols', 'Less aggressive voting'],
  },
  {
    key:       'medium',
    label:     'MEDIUM',
    tagline:   'The classic Survivor experience.',
    desc:      'Balanced challenge. Alliances form and break naturally.',
    modifiers: ['Standard threat curve', 'Normal idol frequency', 'Realistic voting'],
  },
  {
    key:       'hard',
    label:     'BRUTAL',
    tagline:   'The island shows no mercy.',
    desc:      'NPCs scheme hard, stats decay faster, advantages are abundant.',
    modifiers: ['Fast threat escalation', 'More NPC idols', 'Cutthroat voting'],
  },
];

const DIFF_ACCENT: Record<Difficulty, string> = {
  easy:   C.palmLight,
  medium: C.sun,
  hard:   C.coral,
};

const MAX_CASTAWAYS = 30;

function snapToTribes(count: number, tribes: number): number {
  const rounded = Math.round(count / tribes) * tribes;
  return Math.max(tribes * 2, Math.min(MAX_CASTAWAYS, rounded));
}

function juryBounds(finaleSize: number, total: number) {
  const min = 3;
  const max = Math.max(3, total - finaleSize - 2);
  return { min, max };
}

export default function NewGameSetupScreen({ route, navigation }: Props) {
  const { slotIndex } = route.params;
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_GAME_SETTINGS });
  const theme = useTheme();

  const startNewGame = useGameStore(s => s.startNewGame);
  const updateSlot = useSaveSlotStore(s => s.updateSlot);
  const { saveCurrentGame } = useSaveSlots();

  async function handleStart() {
    const trimmed = name.trim();
    if (!trimmed) return;

    startNewGame({ slotIndex, playerName: trimmed, difficulty, settings });
    updateSlot(slotIndex, {
      playerName: trimmed,
      day: 1,
      difficulty,
      saveDate: new Date().toISOString(),
    });
    await saveCurrentGame();
    navigation.replace('Game', { screen: 'Home' } as any);
  }

  function updateSettings(patch: Partial<GameSettings>) {
    setSettings(prev => ({ ...prev, ...patch }));
  }

  function changeTribes(n: number) {
    const snapped = snapToTribes(settings.totalCastaways, n);
    const bounds = juryBounds(settings.finaleSize, snapped);
    updateSettings({
      numTribes: n,
      totalCastaways: snapped,
      jurySize: Math.min(Math.max(settings.jurySize, bounds.min), bounds.max),
    });
  }

  function changeCastaways(delta: number) {
    const next = settings.totalCastaways + delta * settings.numTribes;
    const clamped = Math.max(settings.numTribes * 2, Math.min(MAX_CASTAWAYS, next));
    const bounds = juryBounds(settings.finaleSize, clamped);
    updateSettings({
      totalCastaways: clamped,
      jurySize: Math.min(Math.max(settings.jurySize, bounds.min), bounds.max),
    });
  }

  function changeFinale(n: number) {
    const bounds = juryBounds(n, settings.totalCastaways);
    updateSettings({
      finaleSize: n,
      jurySize: Math.min(Math.max(settings.jurySize, bounds.min), bounds.max),
      finalTcStyle: n === 2 ? 'vote' : settings.finalTcStyle,
    });
  }

  function changeJury(delta: number) {
    const bounds = juryBounds(settings.finaleSize, settings.totalCastaways);
    const next = Math.min(Math.max(settings.jurySize + delta, bounds.min), bounds.max);
    updateSettings({ jurySize: next });
  }

  const jBounds = juryBounds(settings.finaleSize, settings.totalCastaways);
  const preMergeBoots = settings.totalCastaways - settings.jurySize - settings.finaleSize;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.root, { backgroundColor: theme.screenBg }]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backLabel}>← BACK</Text>
        </Pressable>

        <Text style={[styles.title, { color: theme.text }]}>NEW GAME</Text>
        <Text style={[styles.slotTag, { color: theme.textSoft }]}>SLOT {slotIndex + 1}</Text>

        {/* Name */}
        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>YOUR NAME</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, color: theme.text }]}
          value={name}
          onChangeText={setName}
          maxLength={20}
          placeholder="Enter survivor name…"
          placeholderTextColor={C.inkSoft}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="done"
        />
        <Text style={styles.charCount}>{name.trim().length} / 20</Text>

        {/* Difficulty */}
        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>DIFFICULTY</Text>
        <View style={styles.diffList}>
          {DIFFICULTIES.map(d => {
            const active = difficulty === d.key;
            const accent = DIFF_ACCENT[d.key];
            return (
              <Pressable
                key={d.key}
                style={[
                  styles.diffCard,
                  { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                  active && { borderColor: theme.text, shadowOpacity: 1 },
                ]}
                onPress={() => setDifficulty(d.key)}
              >
                <View style={styles.diffTop}>
                  <View style={[styles.diffDot, { backgroundColor: accent }]} />
                  <Text style={[styles.diffLabel, { color: theme.text }]}>{d.label}</Text>
                  {active && <Text style={[styles.diffCheck, { color: theme.text }]}>✓</Text>}
                </View>
                <Text style={[styles.diffTagline, { color: theme.text }]}>{d.tagline}</Text>
                <Text style={[styles.diffDesc, { color: theme.textSoft }]}>{d.desc}</Text>
                <View style={styles.modList}>
                  {d.modifiers.map(m => (
                    <Text key={m} style={[styles.modItem, { color: theme.textSoft }]}>· {m}</Text>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ────── GAME SETTINGS ────── */}
        <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />
        <Text style={[styles.sectionHeader, { color: theme.textSoft }]}>GAME SETTINGS</Text>

        {/* Number of Tribes */}
        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>STARTING TRIBES</Text>
        <View style={styles.segRow}>
          {[2, 3, 4].map(n => (
            <Pressable
              key={n}
              style={[
                styles.segBtn,
                { borderColor: theme.cardBorder },
                settings.numTribes === n && styles.segBtnActive,
              ]}
              onPress={() => changeTribes(n)}
            >
              <Text style={[styles.segLabel, settings.numTribes === n && styles.segLabelActive]}>
                {n}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Total Castaways */}
        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>TOTAL CASTAWAYS</Text>
        <View style={[styles.stepperRow, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => changeCastaways(-1)}
            disabled={settings.totalCastaways <= settings.numTribes * 2}
          >
            <Text style={[
              styles.stepperBtnLabel,
              { color: settings.totalCastaways <= settings.numTribes * 2 ? C.inkSoft : C.ink },
            ]}>−</Text>
          </Pressable>
          <View style={styles.stepperCenter}>
            <Text style={[styles.stepperValue, { color: theme.text }]}>{settings.totalCastaways}</Text>
            <Text style={[styles.stepperSub, { color: theme.textSoft }]}>
              {settings.totalCastaways - 1} NPCs + you
            </Text>
          </View>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => changeCastaways(1)}
            disabled={settings.totalCastaways >= MAX_CASTAWAYS}
          >
            <Text style={[
              styles.stepperBtnLabel,
              { color: settings.totalCastaways >= MAX_CASTAWAYS ? C.inkSoft : C.ink },
            ]}>+</Text>
          </Pressable>
        </View>

        {/* Finale Size */}
        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>FINALE</Text>
        <View style={styles.segRow}>
          {[2, 3].map(n => (
            <Pressable
              key={n}
              style={[
                styles.segBtn,
                { borderColor: theme.cardBorder },
                settings.finaleSize === n && styles.segBtnActive,
              ]}
              onPress={() => changeFinale(n)}
            >
              <Text style={[styles.segLabel, settings.finaleSize === n && styles.segLabelActive]}>
                FINAL {n}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Jury Size */}
        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>JURY SIZE</Text>
        <View style={[styles.stepperRow, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => changeJury(-1)}
            disabled={settings.jurySize <= jBounds.min}
          >
            <Text style={[
              styles.stepperBtnLabel,
              { color: settings.jurySize <= jBounds.min ? C.inkSoft : C.ink },
            ]}>−</Text>
          </Pressable>
          <View style={styles.stepperCenter}>
            <Text style={[styles.stepperValue, { color: theme.text }]}>{settings.jurySize}</Text>
            <Text style={[styles.stepperSub, { color: theme.textSoft }]}>
              Merge at {settings.jurySize + settings.finaleSize} alive
            </Text>
          </View>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => changeJury(1)}
            disabled={settings.jurySize >= jBounds.max}
          >
            <Text style={[
              styles.stepperBtnLabel,
              { color: settings.jurySize >= jBounds.max ? C.inkSoft : C.ink },
            ]}>+</Text>
          </Pressable>
        </View>

        {/* Last Tribal Council Style */}
        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>LAST TRIBAL COUNCIL</Text>
        <View style={styles.segRow}>
          {(['vote', 'fire'] as const).map(style => {
            const disabled = settings.finaleSize === 2 && style === 'fire';
            const active = settings.finalTcStyle === style;
            return (
              <Pressable
                key={style}
                style={[
                  styles.segBtn,
                  { borderColor: theme.cardBorder },
                  active && styles.segBtnActive,
                  disabled && styles.segBtnDisabled,
                ]}
                onPress={() => !disabled && updateSettings({ finalTcStyle: style })}
                disabled={disabled}
              >
                <Text style={[styles.segLabel, active && styles.segLabelActive]}>
                  {style === 'vote' ? 'VOTE' : 'FIRE MAKING'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {settings.finaleSize === 2 && (
          <Text style={[styles.settingNote, { color: theme.textSoft }]}>
            Fire making requires Final 3.
          </Text>
        )}

        {/* Return Twist */}
        <Text style={[styles.fieldLabel, { color: theme.textSoft }]}>RETURN TWIST</Text>
        <View style={styles.segRow}>
          {([['none', 'NONE'], ['redemption', 'REDEMPTION'], ['edge', 'EDGE']] as const).map(([key, label]) => {
            const active = settings.twist === key;
            return (
              <Pressable
                key={key}
                style={[styles.segBtn, { borderColor: theme.cardBorder }, active && styles.segBtnActive]}
                onPress={() => updateSettings({ twist: key })}
              >
                <Text style={[styles.segLabel, active && styles.segLabelActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.settingNote, { color: theme.textSoft }]}>
          {settings.twist === 'none' && 'Voted-out players are gone for good.'}
          {settings.twist === 'redemption' && 'Pre-merge boots duel on Redemption Island. The winner re-enters at the merge.'}
          {settings.twist === 'edge' && 'Boots live on the Edge of Extinction, scavenging advantages for a shot to return.'}
        </Text>
        {settings.twist === 'edge' && (
          <View style={[styles.toggleRow, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleLabel, { color: theme.text }]}>PRE-MERGE EDGE</Text>
              <Text style={[styles.toggleDesc, { color: theme.textSoft }]}>
                Send pre-merge boots to the Edge too, not just post-merge.
              </Text>
            </View>
            <Switch
              value={settings.edgePreMerge}
              onValueChange={v => updateSettings({ edgePreMerge: v })}
              trackColor={{ false: C.inkSoft, true: C.palmLight }}
              thumbColor={C.bone}
            />
          </View>
        )}

        {/* Summary */}
        <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.summaryTitle, { color: theme.textSoft }]}>SEASON BREAKDOWN</Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryKey, { color: theme.textSoft }]}>Cast</Text>
            <Text style={[styles.summaryVal, { color: theme.text }]}>
              {settings.totalCastaways} ({settings.numTribes} tribes of {settings.totalCastaways / settings.numTribes})
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryKey, { color: theme.textSoft }]}>Pre-merge boots</Text>
            <Text style={[styles.summaryVal, { color: theme.text }]}>{Math.max(0, preMergeBoots)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryKey, { color: theme.textSoft }]}>Jury</Text>
            <Text style={[styles.summaryVal, { color: theme.text }]}>{settings.jurySize}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryKey, { color: theme.textSoft }]}>Finale</Text>
            <Text style={[styles.summaryVal, { color: theme.text }]}>
              Final {settings.finaleSize}
              {settings.finalTcStyle === 'fire' ? ' · Fire Making at F4' : ''}
            </Text>
          </View>
          {settings.twist !== 'none' && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryKey, { color: theme.textSoft }]}>Twist</Text>
              <Text style={[styles.summaryVal, { color: C.sun }]}>
                {settings.twist === 'redemption' ? 'Redemption Island' : 'Edge of Extinction'}
              </Text>
            </View>
          )}
        </View>

        <GButton
          label="START GAME"
          onPress={handleStart}
          variant="danger"
          disabled={!name.trim()}
          style={styles.startBtn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:         { flexGrow: 1, backgroundColor: C.sand, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 48 },
  backBtn:      { marginBottom: 24 },
  backLabel:    { fontFamily: F.body, fontSize: 12, color: C.inkMid, letterSpacing: 1 },
  title:        { fontFamily: F.display, fontSize: 32, color: C.ink, letterSpacing: -0.5 },
  slotTag:      { fontFamily: F.mono, fontSize: 10, color: C.inkSoft, letterSpacing: 1, marginTop: 2, marginBottom: 32 },
  fieldLabel:   { fontFamily: F.body, fontSize: 10, color: C.inkSoft, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  input:        { backgroundColor: C.bone, borderWidth: 1.5, borderColor: C.ink, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontFamily: F.body, fontSize: 16, color: C.ink },
  charCount:    { fontFamily: F.mono, fontSize: 10, color: C.inkSoft, textAlign: 'right', marginTop: 4, marginBottom: 28 },

  diffList:     { gap: 12, marginBottom: 32 },
  diffCard:     { backgroundColor: C.bone, borderRadius: 14, borderWidth: 1.5, borderColor: C.inkSoft, padding: 16, shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0, shadowRadius: 0 },
  diffTop:      { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  diffDot:      { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  diffLabel:    { fontFamily: F.body, fontSize: 13, fontWeight: '700', color: C.ink, letterSpacing: 1, flex: 1 },
  diffCheck:    { fontFamily: F.mono, fontSize: 14, color: C.ink },
  diffTagline:  { fontFamily: F.display, fontSize: 14, color: C.ink, marginBottom: 4 },
  diffDesc:     { fontFamily: F.body, fontSize: 13, color: C.inkMid, lineHeight: 19, marginBottom: 8 },
  modList:      { gap: 2 },
  modItem:      { fontFamily: F.mono, fontSize: 11, color: C.inkSoft },

  divider:      { height: 1, backgroundColor: C.inkSoft, marginBottom: 24, opacity: 0.2 },
  sectionHeader:{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, letterSpacing: 2, marginBottom: 20 },

  // Segmented controls
  segRow:       { flexDirection: 'row', gap: 8, marginBottom: 24 },
  segBtn:       { flex: 1, borderWidth: 1.5, borderColor: C.inkSoft, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  segBtnActive: { borderColor: C.ink, backgroundColor: C.ink },
  segBtnDisabled:{ opacity: 0.35 },
  segLabel:     { fontFamily: F.body, fontSize: 12, fontWeight: '700', color: C.inkMid, letterSpacing: 0.5 },
  segLabelActive:{ color: C.bone },

  // Steppers
  stepperRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bone, borderWidth: 1.5, borderColor: C.inkSoft, borderRadius: 12, marginBottom: 24, overflow: 'hidden' },
  stepperBtn:   { width: 52, paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  stepperBtnLabel:{ fontFamily: F.display, fontSize: 24, color: C.ink },
  stepperCenter:{ flex: 1, alignItems: 'center', paddingVertical: 14 },
  stepperValue: { fontFamily: F.display, fontSize: 24, color: C.ink, fontWeight: '800' },
  stepperSub:   { fontFamily: F.mono, fontSize: 10, color: C.inkSoft, letterSpacing: 1, marginTop: 2 },

  // Redemption Island toggle
  toggleRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bone, borderWidth: 1.5, borderColor: C.inkSoft, borderRadius: 12, padding: 16, marginBottom: 8 },
  toggleInfo:   { flex: 1 },
  toggleLabel:  { fontFamily: F.body, fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 2 },
  toggleDesc:   { fontFamily: F.body, fontSize: 12, color: C.inkMid, lineHeight: 17 },

  settingNote:  { fontFamily: F.mono, fontSize: 10, color: C.inkSoft, letterSpacing: 1, marginTop: -18, marginBottom: 20 },

  // Summary card
  summaryCard:  { backgroundColor: C.bone, borderWidth: 1.5, borderColor: C.inkSoft, borderRadius: 12, padding: 16, marginTop: 16, marginBottom: 8 },
  summaryTitle: { fontFamily: F.mono, fontSize: 10, color: C.inkSoft, letterSpacing: 2, marginBottom: 12 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryKey:   { fontFamily: F.body, fontSize: 12, color: C.inkMid },
  summaryVal:   { fontFamily: F.body, fontSize: 12, fontWeight: '700', color: C.ink },

  startBtn:     { marginTop: 20 },
});
