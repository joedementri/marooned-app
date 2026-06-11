import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ChallengeRail from '../components/game/ChallengeRail';
import type { ChallengeParticipant } from './types';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

interface Props {
  participants: ChallengeParticipant[];
  seed: number;
  label?: string;
  onDone: () => void;
}

// Generic watch-only view for AI-vs-AI challenges (e.g. an off-screen duel the
// player isn't competing in). The real result is computed by challengeEngine; this
// just shows the field racing and fires onDone when it settles.
export default function SpectateView({ participants, seed, label = 'CHALLENGE', onDone }: Props) {
  const [running] = useState(true);
  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>{label}</Text>
      <Text style={styles.sub}>Watching the challenge play out…</Text>
      <ChallengeRail participants={participants} running={running} seed={seed} onAllSettled={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { width: '100%', padding: 24, gap: 6 },
  eyebrow: { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2 },
  sub:     { fontSize: 13, fontFamily: F.body, color: C.inkMid, marginBottom: 16 },
});
