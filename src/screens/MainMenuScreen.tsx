import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootParamList } from '../navigation/types';
import { useSaveSlotStore, type SaveSlotMeta } from '../store/saveSlotStore';
import { useSaveSlots } from '../hooks/useSaveSlots';
import { useGameStore } from '../store/gameStore';
import { Pill } from '../components/atoms';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';
import { useTheme } from '../contexts/ThemeContext';

type Props = StackScreenProps<RootParamList, 'MainMenu'>;

const DIFFICULTY_COLORS: Record<string, string> = {
  easy:   C.palmLight,
  medium: C.sun,
  hard:   C.coral,
};

function formatSaveDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function SlotCard({
  index,
  meta,
  theme,
  onPressEmpty,
  onPressFilled,
  onDelete,
}: {
  index: number;
  meta: SaveSlotMeta;
  theme: { cardBg: string; cardBorder: string; text: string; textSoft: string };
  onPressEmpty: () => void;
  onPressFilled: () => void;
  onDelete: () => void;
}) {
  if (!meta.occupied) {
    return (
      <Pressable
        style={({ pressed }) => [styles.slot, styles.slotEmpty, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }, pressed && styles.slotPressed]}
        onPress={onPressEmpty}
      >
        <Text style={[styles.slotNewLabel, { color: theme.textSoft }]}>NEW GAME</Text>
        <Text style={[styles.slotNum, { color: theme.textSoft }]}>SLOT {index + 1}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.slot, styles.slotFilled, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }, pressed && styles.slotPressed]}
      onPress={onPressFilled}
      onLongPress={onDelete}
      delayLongPress={600}
    >
      <View style={styles.slotHeader}>
        <Text style={[styles.slotPlayerName, { color: theme.text }]} numberOfLines={1}>{meta.playerName}</Text>
        <Pill
          label={meta.difficulty}
          bg={DIFFICULTY_COLORS[meta.difficulty]}
          color={meta.difficulty === 'easy' ? C.ink : C.bone}
          size="sm"
        />
      </View>
      <Text style={[styles.slotDay, { color: theme.text }]}>DAY {meta.day}</Text>
      <Text style={[styles.slotDate, { color: theme.textSoft }]}>{formatSaveDate(meta.saveDate)}</Text>
    </Pressable>
  );
}

export default function MainMenuScreen({ navigation }: Props) {
  const slots = useSaveSlotStore(s => s.slots);
  const { loadGame, deleteSlot } = useSaveSlots();
  const theme = useTheme();

  async function handleSlotPress(index: number) {
    const ok = await loadGame(index);
    if (ok) {
      navigation.navigate('Game', { screen: 'Home' } as any);
    }
  }

  function handleDelete(index: number) {
    Alert.alert(
      'Delete Save?',
      `This will permanently erase ${slots[index].playerName}'s game. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSlot(index),
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.root, { backgroundColor: theme.screenBg }]} bounces={false}>
      <View style={styles.header}>
        <Pressable style={styles.debugBtn} onPress={() => navigation.navigate('MinigameDebug')} hitSlop={12}>
          <Text style={styles.debugLabel}>DEBUG</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>MAROONED</Text>
        <Pressable style={styles.gearBtn} onPress={() => navigation.navigate('Settings')} hitSlop={12}>
          <Text style={[styles.gear, { color: theme.textSoft }]}>⚙</Text>
        </Pressable>
      </View>
      <Text style={[styles.subtitle, { color: theme.textSoft }]}>SELECT A SAVE SLOT</Text>

      <View style={styles.grid}>
        {slots.map((meta, i) => (
          <SlotCard
            key={i}
            index={i}
            meta={meta}
            theme={theme}
            onPressEmpty={() => navigation.navigate('NewGameSetup', { slotIndex: i })}
            onPressFilled={() => handleSlotPress(i)}
            onDelete={() => handleDelete(i)}
          />
        ))}
      </View>

      <Text style={[styles.hint, { color: theme.textSoft }]}>Long-press a saved game to delete it</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:            { flexGrow: 1, backgroundColor: C.sand, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 40 },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  debugBtn:        { padding: 6 },
  debugLabel:      { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2 },
  title:           { fontFamily: F.display, fontSize: 36, color: C.ink, letterSpacing: -1 },
  gearBtn:         { padding: 6 },
  gear:            { fontSize: 22, color: C.inkMid },
  subtitle:        { fontFamily: F.body, fontSize: 10, color: C.inkMid, letterSpacing: 2, marginBottom: 32 },
  grid:            { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  slot:            { width: '47%', minHeight: 110, borderRadius: 14, borderWidth: 1.5, padding: 16 },
  slotEmpty:       { backgroundColor: C.bone, borderColor: C.inkSoft, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  slotFilled:      { backgroundColor: C.bone, borderColor: C.ink, shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  slotPressed:     { opacity: 0.75 },
  slotNewLabel:    { fontFamily: F.body, fontSize: 11, fontWeight: '700', color: C.inkMid, letterSpacing: 1.5 },
  slotNum:         { fontFamily: F.mono, fontSize: 9, color: C.inkSoft, marginTop: 4 },
  slotHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  slotPlayerName:  { fontFamily: F.display, fontSize: 15, color: C.ink, flex: 1, marginRight: 6 },
  slotDay:         { fontFamily: F.mono, fontSize: 13, color: C.ink },
  slotDate:        { fontFamily: F.body, fontSize: 9, color: C.inkSoft, marginTop: 4, letterSpacing: 0.5 },
  hint:            { fontFamily: F.body, fontSize: 10, color: C.inkSoft, textAlign: 'center', marginTop: 28, letterSpacing: 0.5 },
});
