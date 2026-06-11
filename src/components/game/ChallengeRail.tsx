import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Portrait from '../atoms/Portrait';
import { initials } from '../../data/roster';
import type { ChallengeParticipant } from '../../minigames/types';
import { mulberry32 } from '../../engine/rng';
import { C } from '../../tokens/colors';
import { F } from '../../tokens/fonts';

interface Props {
  participants: ChallengeParticipant[]; // AI opponents (and optionally the player marker)
  running: boolean;
  durationMs?: number;
  seed: number;
  maxVisible?: number;
  /** Fired once the slowest opponent's bar reaches the finish line. */
  onAllSettled?: () => void;
}

// A vertical list of opponents whose progress bars fill at a stat-driven pace.
// Purely cosmetic — the authoritative result comes from challengeEngine — but it
// lets the player watch the field pull ahead or fall behind in real time. Capped
// so a large field doesn't overflow the screen.
export default function ChallengeRail({ participants, running, durationMs = 7000, seed, maxVisible = 6, onAllSettled }: Props) {
  const shown = participants.slice(0, maxVisible);
  return (
    <View style={styles.rail}>
      {shown.map((p, i) => (
        <RailRow
          key={p.id}
          participant={p}
          running={running}
          durationMs={durationMs}
          seed={seed + i}
          isLast={i === shown.length - 1}
          onSettled={i === shown.length - 1 ? onAllSettled : undefined}
        />
      ))}
    </View>
  );
}

function RailRow({
  participant, running, durationMs, seed, onSettled,
}: {
  participant: ChallengeParticipant;
  running: boolean;
  durationMs: number;
  seed: number;
  isLast: boolean;
  onSettled?: () => void;
}) {
  const fill = useSharedValue(0);

  useEffect(() => {
    if (!running) return;
    const rng = mulberry32(seed >>> 0);
    const jitter = 0.85 + rng() * 0.3;
    // Stronger opponents finish sooner.
    const dur = Math.max(1500, durationMs * (1.5 - participant.skill) * jitter);
    fill.value = withTiming(100, { duration: dur, easing: Easing.inOut(Easing.quad) });
    if (onSettled) {
      const t = setTimeout(onSettled, dur + 120);
      return () => clearTimeout(t);
    }
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const barStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` as any }));

  return (
    <View style={styles.row}>
      <Portrait color={participant.color} initials={initials(participant.name)} size={28} />
      <View style={styles.barCol}>
        <Text style={styles.name} numberOfLines={1}>{participant.name.split(' ')[0]}</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { backgroundColor: participant.color }, barStyle]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail:   { width: '100%', gap: 8 },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barCol: { flex: 1 },
  name:   { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 1, marginBottom: 3 },
  track:  { height: 10, borderRadius: 5, backgroundColor: C.sandMid, overflow: 'hidden' },
  fill:   { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 5 },
});
