import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import type { Castaway } from '../data/roster';
import type { AdvantageType } from '../data/advantages';
import { PLAYER_ID } from '../utils/voteSimulator';
import { gameRng, hashSeed, pickFrom } from '../engine/rng';
import { challengeSkill } from '../engine/challengeEngine';
import { pickChallenge } from '../data/challenges';
import type { ChallengeParticipant, MinigameResult } from '../minigames/types';
import ChallengeHost from '../minigames/ChallengeHost';
import { usePhase } from '../hooks/usePhase';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

type Props = StackScreenProps<GameParamList, 'Edge'>;
type Stage = 'arrive' | 'challenge' | 'result';

const SCAVENGE_ADVANTAGES: AdvantageType[] = ['extra_vote', 'idol_nullifier', 'steal_a_vote'];

export default function EdgeScreen({ navigation }: Props) {
  const [stage, setStage] = useState<Stage>('arrive');
  const [scavenges, setScavenges] = useState(0);
  const [scavengeNote, setScavengeNote] = useState('');
  const [won, setWon] = useState<boolean | null>(null);

  const store = useGameStore(
    useShallow(s => ({
      castaways: s.castaways, jury: s.jury, edgeIds: s.edgeIds, day: s.day,
      difficulty: s.difficulty, gameSeed: s.gameSeed, playerName: s.playerName,
      addFeedEntry: s.addFeedEntry, resolveReentry: s.resolveReentry,
      permanentEliminate: s.permanentEliminate, setGameMode: s.setGameMode,
      addPlayerAdvantage: s.addPlayerAdvantage, setPlayerIdolCount: s.setPlayerIdolCount,
      playerIdolCount: s.playerIdolCount,
    }))
  );
  const { castaways, jury, edgeIds, day, difficulty, gameSeed, playerName, addFeedEntry,
    resolveReentry, permanentEliminate, setGameMode, addPlayerAdvantage, setPlayerIdolCount, playerIdolCount } = store;
  const { advance } = usePhase();

  const def = useMemo(() => pickChallenge(gameRng(gameSeed, `edge-reentry-pick-d${day}`)), [gameSeed, day]);
  const seed = useMemo(() => hashSeed(gameSeed, `edge-reentry-d${day}`), [gameSeed, day]);

  // Opponents for the re-entry challenge: other Edge dwellers, topped up with the
  // most recent jurors so it's always a real race.
  const participants = useMemo<ChallengeParticipant[]>(() => {
    const edgeNpcs = edgeIds
      .filter(id => id !== PLAYER_ID)
      .map(id => castaways.find(c => c.id === id))
      .filter((c): c is Castaway => !!c);
    const fillers = jury
      .map(j => castaways.find(c => c.id === j.castawayId))
      .filter((c): c is Castaway => !!c && !edgeNpcs.some(e => e.id === c.id));
    const opponents = [...edgeNpcs, ...fillers].slice(0, 3);
    const player = castaways.find(c => c.id === PLAYER_ID);
    const list: ChallengeParticipant[] = [];
    if (player) list.push({ id: PLAYER_ID, name: 'You', color: '#3d5a7c', isPlayer: true, skill: challengeSkill(player, def.kind) });
    opponents.forEach(c => list.push({ id: c.id, name: c.name, color: c.color, isPlayer: false, skill: challengeSkill(c, def.kind) }));
    return list;
  }, [edgeIds, jury, castaways, def.kind]);

  function scavenge() {
    const n = scavenges + 1;
    setScavenges(n);
    const rng = gameRng(gameSeed, `edge-scav-d${day}-${n}`);
    const roll = rng();
    if (roll < 0.15) {
      setPlayerIdolCount(playerIdolCount + 1);
      setScavengeNote('You found a Hidden Immunity Idol buried on the Edge!');
    } else if (roll < 0.5) {
      const adv = pickFrom(SCAVENGE_ADVANTAGES, rng);
      addPlayerAdvantage(adv);
      setScavengeNote('You scavenged an advantage to bring back if you return.');
    } else {
      setScavengeNote('You searched the rocks but found nothing this time.');
    }
  }

  function startChallenge() {
    // Using your re-entry shot is a one-time thing.
    useGameStore.setState({ playerEdgeReentryUsed: true });
    setStage('challenge');
  }

  function handleComplete(result: MinigameResult) {
    const playerWon = result.winnerId === PLAYER_ID;
    setWon(playerWon);
    if (playerWon) {
      resolveReentry(PLAYER_ID);
      addFeedEntry({ id: `edge-player-return-d${day}`, day, phase: 'redemption', text: `${playerName} battles back from the Edge of Extinction!`, type: 'merge' });
    } else {
      const winnerName = castaways.find(c => c.id === result.winnerId)?.name ?? 'Someone';
      permanentEliminate(PLAYER_ID, day, [result.winnerId]);
      setGameMode('ended');
      addFeedEntry({ id: `edge-player-out-d${day}`, day, phase: 'redemption', text: `${winnerName} wins the re-entry challenge. ${playerName}'s game is over.`, type: 'tribal' });
    }
    setStage('result');
  }

  function finishWin() {
    advance();
    navigation.navigate('Home');
  }
  function finishLose() {
    navigation.getParent()?.navigate('MainMenu');
  }

  if (stage === 'challenge') {
    const host = (
      <ChallengeHost def={def} participants={participants} difficulty={difficulty} seed={seed} onComplete={handleComplete} />
    );
    if (def.fullScreen) return host;
    return (
      <View style={styles.playWrap}>
        <Text style={styles.eyebrow}>RE-ENTRY CHALLENGE</Text>
        {host}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>EDGE OF EXTINCTION · DAY {day}</Text>
        <Text style={styles.title}>
          {stage === 'arrive' ? 'BANISHED TO THE EDGE' : won ? 'BACK IN THE GAME' : 'THE EDGE CLAIMS YOU'}
        </Text>
      </View>

      {stage === 'arrive' && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
          <Text style={styles.narrative}>
            Your torch is snuffed — but this isn't over. On the Edge of Extinction you can
            scavenge for advantages and fight your way back into the game.
          </Text>
          <Text style={styles.sub}>Scavenges used: {scavenges} / 2</Text>
          {scavengeNote !== '' && <Text style={styles.note}>{scavengeNote}</Text>}
          {scavenges < 2 && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={scavenge}>
              <Text style={styles.secondaryLabel}>SCAVENGE THE EDGE</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.ctaBtn} onPress={startChallenge}>
            <Text style={styles.ctaLabel}>TAKE THE RE-ENTRY CHALLENGE</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {stage === 'result' && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
          <View style={styles.resultBlock}>
            <Text style={styles.glyph}>{won ? '🔥' : '💀'}</Text>
            <Text style={[styles.resultText, { color: won ? C.palm : C.coral }]}>
              {won ? 'You won the re-entry challenge and return to the game!' : 'You could not win your way back. Your journey ends here.'}
            </Text>
          </View>
          <TouchableOpacity style={styles.ctaBtn} onPress={won ? finishWin : finishLose}>
            <Text style={styles.ctaLabel}>{won ? 'RETURN TO CAMP' : 'YOUR JOURNEY ENDS'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.night },
  playWrap:      { flex: 1, backgroundColor: C.night, alignItems: 'center', paddingTop: 60, paddingHorizontal: 16 },
  flex:          { flex: 1 },
  header:        { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#ffffff18' },
  eyebrow:       { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  title:         { fontSize: 24, fontFamily: F.display, fontWeight: '800', color: C.bone, letterSpacing: -0.5 },
  body:          { padding: 24, paddingBottom: 40 },
  narrative:     { fontSize: 14, fontFamily: F.body, color: C.bone, opacity: 0.85, lineHeight: 22, marginBottom: 18 },
  sub:           { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 1, marginBottom: 10 },
  note:          { fontSize: 13, fontFamily: F.body, color: C.sun, marginBottom: 18, lineHeight: 19 },
  secondaryBtn:  { borderWidth: 1.5, borderColor: '#ffffff33', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 14 },
  secondaryLabel:{ fontSize: 12, fontFamily: F.body, fontWeight: '700', color: C.bone, letterSpacing: 1 },
  ctaBtn:        { backgroundColor: C.torch, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  ctaLabel:      { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  resultBlock:   { alignItems: 'center', paddingVertical: 28, gap: 12 },
  glyph:         { fontSize: 40 },
  resultText:    { fontSize: 16, fontFamily: F.body, fontWeight: '700', textAlign: 'center', lineHeight: 24 },
});
