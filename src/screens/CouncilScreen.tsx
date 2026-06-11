import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useAudio } from '../hooks/useAudio';
import { useHaptics } from '../hooks/useHaptics';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { PLAYER_ID } from '../utils/voteSimulator';
import type { VoteMap } from '../utils/voteSimulator';
import { resolveTribal } from '../utils/advantageResolver';
import type { AdvantagePlay, TribalResult } from '../utils/advantageResolver';
import { simulateTribalVotes } from '../engine/voteEngine';
import type { AdvantageType } from '../data/advantages';
import { ADVANTAGE_DEFS } from '../data/advantages';
import { seeded } from '../utils/seeded';
import { initials } from '../data/roster';
import type { Castaway } from '../data/roster';
import type { ArchetypeKey } from '../data/archetypes';
import { usePhase } from '../hooks/usePhase';
import Portrait from '../components/atoms/Portrait';
import ParchmentCard from '../components/game/ParchmentCard';
import AdvantageCard from '../components/game/AdvantageCard';
import FireGame from '../minigames/FireGame';
import TribalCouncilScene from '../components/graphics/TribalCouncilScene';
import { challengeSkill } from '../engine/challengeEngine';
import { hashSeed } from '../engine/rng';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

type Props = StackScreenProps<GameParamList, 'Council'>;
type Stage =
  | 'talk'
  | 'pre_vote'
  | 'vote'
  | 'post_vote'
  | 'parchment'
  | 'snuffed'
  | 'fire_making'
  | 'fire_result';

const PRE_VOTE_ADVANTAGES: AdvantageType[] = ['extra_vote', 'steal_a_vote', 'safety_without_power'];
const POST_VOTE_ADVANTAGES: AdvantageType[] = ['hii', 'idol_nullifier'];
const NEEDS_TARGET: AdvantageType[] = ['steal_a_vote', 'idol_nullifier'];

const ARCHETYPE_QUOTES: Record<ArchetypeKey, string> = {
  schemer:     'Tonight will shake this game up.',
  strategist:  'The logical vote is clear to me.',
  provider:    "I'm just trying to keep this tribe strong.",
  charmer:     'I love everyone here. But tonight has to happen.',
  mediator:    "I hope we can move past this without hard feelings.",
  wildcard:    "Honestly? I haven't decided yet.",
  loyalist:    'My vote is locked. I stand by my people.',
  threat:      "Come at me if you want. I'm ready.",
  mastermind:  'Everything is going exactly as planned.',
  floater:     "I'm keeping my head down tonight.",
  optimist:    'I trust this group to do the right thing.',
  lonewolf:    "I don't need to explain myself to anyone.",
  pessimist:   "This never goes the way you think.",
  underdog:    "Nobody's counting on me. That's fine.",
  athlete:     "I play to win. Tonight I'm playing to stay.",
  veteran:     "I've seen this before. Nobody's as safe as they think.",
};

function buildDramaticOrder(
  rawVotes: VoteMap,
  eliminatedId: number,
  idolPlayed: boolean,
  idolPlayerId: number | null,
  resolvedVotes: VoteMap,
): Array<{ name: string; voided: boolean; targetId: number }> {
  const resolvedIds = new Set(Object.keys(resolvedVotes).map(Number));

  const voided: Array<{ name: string; voided: boolean; targetId: number }> = [];
  const elimVotes: Array<{ name: string; targetId: number }> = [];
  const otherVotes: Array<{ name: string; targetId: number }> = [];

  for (const [targetIdStr, voterIds] of Object.entries(rawVotes)) {
    const targetId = Number(targetIdStr);
    if (targetId === PLAYER_ID && voterIds.every(v => v === PLAYER_ID)) continue;

    const isVoidedGroup = idolPlayed && idolPlayerId === targetId && !resolvedIds.has(targetId);
    for (const _ of voterIds) {
      if (isVoidedGroup) {
        voided.push({ name: '', voided: true, targetId });
      } else if (targetId === eliminatedId) {
        elimVotes.push({ name: '', targetId });
      } else {
        otherVotes.push({ name: '', targetId });
      }
    }
  }

  otherVotes.sort(() => Math.random() - 0.5);
  const decisive = elimVotes.pop();

  const middle: Array<{ name: string; voided: boolean; targetId: number }> = [];
  const leadCount = Math.max(0, otherVotes.length - elimVotes.length);
  let o = 0;
  for (let i = 0; i < leadCount && o < otherVotes.length; i++) {
    middle.push({ ...otherVotes[o++], voided: false });
  }
  let e = 0;
  while (o < otherVotes.length || e < elimVotes.length) {
    if (o < otherVotes.length) middle.push({ ...otherVotes[o++], voided: false });
    if (e < elimVotes.length) middle.push({ ...elimVotes[e++], voided: false });
  }
  if (decisive) middle.push({ ...decisive, voided: false });

  return [...voided, ...middle];
}

export default function CouncilScreen({ navigation }: Props) {
  const [stage, setStage]                 = useState<Stage>('talk');
  const [playerPlays, setPlayerPlays]     = useState<AdvantageType[]>([]);
  const [pickingTargetFor, setPickingTargetFor] = useState<AdvantageType | null>(null);
  const [stealTarget, setStealTarget]     = useState<number | null>(null);
  const [nullifyTarget, setNullifyTarget] = useState<number | null>(null);
  const [playerSafe, setPlayerSafe]       = useState(false);
  const [playerVote, setPlayerVote]       = useState<number | null>(null);
  const [rawVotesRef, setRawVotesRef]     = useState<VoteMap | null>(null);
  const [npcPlaysRef, setNpcPlaysRef]     = useState<AdvantagePlay[]>([]);
  const [npcConsumedRef, setNpcConsumedRef] = useState<Array<{ holderId: number; type: AdvantageType }>>([]);
  const [tribalResult, setTribalResult]   = useState<TribalResult | null>(null);
  const [parchmentList, setParchmentList] = useState<Array<{ name: string; voided: boolean; targetId: number }>>([]);
  const [revealIndex, setRevealIndex]     = useState(0);

  // Fire-making state
  const [fireSavedId, setFireSavedId]         = useState<number | null>(null);
  const [fireCompetitors, setFireCompetitors] = useState<[number, number] | null>(null);
  const [fireWinnerId, setFireWinnerId]       = useState<number | null>(null);
  const [fireLoserId, setFireLoserId]         = useState<number | null>(null);

  const runningTally = useMemo(() => {
    const tally: Record<number, number> = {};
    for (let i = 0; i < revealIndex; i++) {
      const p = parchmentList[i];
      if (!p.voided) {
        tally[p.targetId] = (tally[p.targetId] ?? 0) + 1;
      }
    }
    return tally;
  }, [revealIndex, parchmentList]);

  const cardAnim = useRef(new Animated.Value(0)).current;
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { playSfx } = useAudio('council');
  const hap = useHaptics();

  const {
    castaways, day, phase, gameMode,
    playerName, playerTribeId, playerAdvantages, playerIdolCount,
    immunityWinnerId, difficulty, gameSettings,
    relationships, alliances, gameSeed, edgeIds,
    addFeedEntry, eliminateCastaway, permanentEliminate, addJuryMember,
    removePlayerAdvantage, removeCastawayAdvantage, setPlayerIdolCount, setGameMode,
    applyTribalAftermathToStore,
  } = useGameStore(
    useShallow(s => ({
      castaways:            s.castaways,
      day:                  s.day,
      phase:                s.phase,
      gameMode:             s.gameMode,
      playerName:           s.playerName,
      playerTribeId:        s.playerTribeId,
      playerAdvantages:     s.playerAdvantages,
      playerIdolCount:      s.playerIdolCount,
      immunityWinnerId:     s.immunityWinnerId,
      difficulty:           s.difficulty,
      gameSettings:         s.gameSettings,
      relationships:        s.relationships,
      alliances:            s.alliances,
      gameSeed:             s.gameSeed,
      edgeIds:              s.edgeIds,
      addFeedEntry:         s.addFeedEntry,
      eliminateCastaway:    s.eliminateCastaway,
      permanentEliminate:   s.permanentEliminate,
      addJuryMember:        s.addJuryMember,
      removePlayerAdvantage: s.removePlayerAdvantage,
      removeCastawayAdvantage: s.removeCastawayAdvantage,
      setPlayerIdolCount:   s.setPlayerIdolCount,
      setGameMode:          s.setGameMode,
      applyTribalAftermathToStore: s.applyTribalAftermathToStore,
    }))
  );

  const councilMembers = useMemo(() => {
    const alive = castaways.filter(c => !c.eliminated && !c.onRedemptionIsland && c.id !== PLAYER_ID);
    if (gameMode === 'pre-merge') return alive.filter(c => c.tribeId === playerTribeId);
    return alive;
  }, [castaways, gameMode, playerTribeId]);

  const immuneId = immunityWinnerId;
  const aliveCount = councilMembers.length + 1;

  const targets = useMemo(
    () => councilMembers.filter(c => c.id !== immuneId),
    [councilMembers, immuneId]
  );

  // Detect fire-making council: alive == finaleSize + 1 in post-merge with fire setting
  const isFireMakingCouncil = useMemo(() => {
    const alive = castaways.filter(c => !c.eliminated && !c.onRedemptionIsland);
    return (
      gameMode === 'post-merge' &&
      gameSettings.finalTcStyle === 'fire' &&
      alive.length === gameSettings.finaleSize + 1
    );
  }, [castaways, gameMode, gameSettings]);

  function isExpired(type: AdvantageType): boolean {
    return aliveCount < ADVANTAGE_DEFS[type].expiresAtFinal;
  }

  const allAdvantages: AdvantageType[] = useMemo(() => {
    const idols: AdvantageType[] = Array.from({ length: playerIdolCount }, () => 'hii' as AdvantageType);
    return [...idols, ...playerAdvantages];
  }, [playerIdolCount, playerAdvantages]);

  const preVoteAdvantages = useMemo(
    () => allAdvantages.filter(a => PRE_VOTE_ADVANTAGES.includes(a)),
    [allAdvantages]
  );
  const postVoteAdvantages = useMemo(
    () => allAdvantages.filter(a => POST_VOTE_ADVANTAGES.includes(a)),
    [allAdvantages]
  );

  const talkQuotes = useMemo(() => {
    const rng = seeded(day * 4321 + councilMembers.length);
    const shuffled = [...councilMembers].sort(() => rng() - 0.5);
    return shuffled.slice(0, Math.min(3, shuffled.length)).map(c => ({
      castaway: c,
      quote: ARCHETYPE_QUOTES[c.archetype] ?? 'The game never stops.',
    }));
  }, [councilMembers, day]);

  // ── Advantage helpers ────────────────────────────────────────────────────
  function togglePlay(type: AdvantageType) {
    if (isExpired(type)) return;
    if (NEEDS_TARGET.includes(type)) {
      setPickingTargetFor(type);
      return;
    }
    if (type === 'safety_without_power') {
      setPlayerPlays(prev =>
        prev.includes(type) ? prev.filter(p => p !== type) : [...prev, type]
      );
      setPlayerSafe(prev => !prev);
      return;
    }
    setPlayerPlays(prev =>
      prev.includes(type) ? prev.filter(p => p !== type) : [...prev, type]
    );
  }

  function confirmTarget(targetId: number) {
    if (pickingTargetFor === 'steal_a_vote') setStealTarget(targetId);
    if (pickingTargetFor === 'idol_nullifier') setNullifyTarget(targetId);
    setPlayerPlays(prev =>
      prev.includes(pickingTargetFor!) ? prev : [...prev, pickingTargetFor!]
    );
    setPickingTargetFor(null);
  }

  function isPlayed(type: AdvantageType): boolean {
    return playerPlays.includes(type);
  }

  // ── Stage transitions ─────────────────────────────────────────────────────
  function handleTalkDone() {
    if (isFireMakingCouncil) {
      // Auto-pick NPC's saved person if NPC is immune
      if (immuneId !== PLAYER_ID && immuneId !== null) {
        const nonImmune = castaways.filter(
          c => !c.eliminated && !c.onRedemptionIsland && c.id !== immuneId
        );
        const rng = seeded(day * 777);
        const saved = nonImmune[Math.floor(rng() * nonImmune.length)];
        if (saved) setFireSavedId(saved.id);
      }
      setStage('fire_making');
      return;
    }
    if (preVoteAdvantages.length > 0) {
      setStage('pre_vote');
    } else {
      setStage('vote');
    }
  }

  function handlePreVoteDone() {
    if (playerSafe) {
      castVoteAndRun(null);
    } else {
      setStage('vote');
    }
  }

  // Run the relationship/alliance-driven vote simulation. Returns the raw votes
  // plus the advantage plays NPCs decided to make and which of their advantages
  // got consumed.
  function runVoteSim(playerVoteTarget: number | null) {
    const eligibleTargets = [
      ...targets.map(t => t.id),
      ...(immuneId !== PLAYER_ID && !playerSafe ? [PLAYER_ID] : []),
    ];
    return simulateTribalVotes({
      voters:          councilMembers,
      eligibleTargets,
      playerVote:      playerSafe ? null : playerVoteTarget,
      relationships,
      alliances,
      castaways,
      day,
      gameSeed,
      scopeTag:        gameMode === 'pre-merge' ? playerTribeId : 'merge',
    });
  }

  function castVote(targetId: number) {
    if (stage !== 'vote') return;
    setPlayerVote(targetId);
    const ctx = runVoteSim(targetId);
    setRawVotesRef(ctx.votes);
    setNpcPlaysRef(ctx.npcPlays);
    setNpcConsumedRef(ctx.consumed);
    if (postVoteAdvantages.length > 0) {
      setStage('post_vote');
    } else {
      runCouncil(targetId, ctx.votes, ctx.npcPlays, ctx.consumed);
    }
  }

  function handlePostVoteDone() {
    if (rawVotesRef && playerVote !== null) {
      runCouncil(playerVote, rawVotesRef, npcPlaysRef, npcConsumedRef);
    }
  }

  function castVoteAndRun(playerVoteTarget: number | null) {
    const ctx = runVoteSim(playerVoteTarget);
    setRawVotesRef(ctx.votes);
    setNpcPlaysRef(ctx.npcPlays);
    setNpcConsumedRef(ctx.consumed);
    runCouncil(playerVoteTarget, ctx.votes, ctx.npcPlays, ctx.consumed);
  }

  function runCouncil(
    playerVoteTarget: number | null,
    rawVotes: VoteMap,
    npcPlays: AdvantagePlay[],
    npcConsumed: Array<{ holderId: number; type: AdvantageType }>,
  ) {
    const plays: AdvantagePlay[] = [];
    if (playerSafe) {
      plays.push({ actorId: PLAYER_ID, type: 'safety_without_power' });
    } else {
      if (playerPlays.includes('hii'))         plays.push({ actorId: PLAYER_ID, type: 'hii' });
      if (playerPlays.includes('extra_vote'))  plays.push({ actorId: PLAYER_ID, type: 'extra_vote' });
      if (playerPlays.includes('steal_a_vote') && stealTarget !== null)
        plays.push({ actorId: PLAYER_ID, type: 'steal_a_vote', targetId: stealTarget });
      if (playerPlays.includes('idol_nullifier') && nullifyTarget !== null)
        plays.push({ actorId: PLAYER_ID, type: 'idol_nullifier', targetId: nullifyTarget });
    }

    // NPC advantage plays decided by the vote engine.
    plays.push(...npcPlays);

    const result = resolveTribal(rawVotes, plays, castaways, aliveCount, day);
    setTribalResult(result);

    // Consume the advantages NPCs played.
    npcConsumed.forEach(c => removeCastawayAdvantage(c.holderId, c.type));

    if (playerPlays.includes('hii')) setPlayerIdolCount(playerIdolCount - 1);
    playerPlays
      .filter(p => p !== 'hii' && p !== 'safety_without_power')
      .forEach(p => removePlayerAdvantage(p));

    const list = buildDramaticOrder(
      rawVotes,
      result.eliminatedId,
      result.idolPlayed,
      result.idolPlayerId,
      result.resolvedVotes,
    );

    const named = list.map(p => {
      const name = p.targetId === PLAYER_ID
        ? playerName
        : (castaways.find(c => c.id === p.targetId)?.name ?? '?');
      return { ...p, name };
    });

    setParchmentList(named);
    setRevealIndex(0);

    eliminateCastaway(
      result.eliminatedId,
      day,
      Object.entries(rawVotes)
        .filter(([k]) => Number(k) === result.eliminatedId)
        .flatMap(([, v]) => v),
    );

    // Update the relationship graph: allies of the booted resent the voters,
    // blindsided alliances fracture.
    applyTribalAftermathToStore(rawVotes, result.eliminatedId);

    if (gameMode === 'post-merge') {
      const boot = castaways.find(c => c.id === result.eliminatedId);
      if (boot) {
        const relScores: Record<number, number> = {};
        castaways.forEach(c => { relScores[c.id] = c.stats.trust; });
        addJuryMember({
          castawayId:         result.eliminatedId,
          eliminatedDay:      day,
          eliminatedBy:       Object.entries(rawVotes)
            .filter(([k]) => Number(k) === result.eliminatedId)
            .flatMap(([, v]) => v),
          bitternessFactor:   playerVoteTarget === result.eliminatedId ? 0.8 : 0.3,
          relationshipScores: relScores,
        });
      }
    }

    const bootName = result.eliminatedId === PLAYER_ID
      ? 'You'
      : (castaways.find(c => c.id === result.eliminatedId)?.name ?? 'Someone');

    addFeedEntry({
      id:   `tribal-day${day}-boot${result.eliminatedId}`,
      day,
      phase,
      text: result.eliminatedId === PLAYER_ID
        ? 'The tribe has spoken. You have been voted out.'
        : `${bootName} has been voted out on Day ${day}.`,
      type: 'vote',
    });

    if (result.idolPlayed) {
      const idolPlayerName = result.idolPlayerId === PLAYER_ID
        ? playerName
        : (castaways.find(c => c.id === result.idolPlayerId)?.name ?? 'Someone');
      addFeedEntry({
        id: `idol-day${day}`,
        day,
        phase,
        text: `${idolPlayerName} played a Hidden Immunity Idol. Those votes did not count.`,
        type: 'advantage',
      });
    }

    setStage('parchment');
  }

  // ── Fire-making helpers ────────────────────────────────────────────────────
  function handleFireSavePick(savedId: number) {
    setFireSavedId(savedId);
    const alive = castaways.filter(c => !c.eliminated && !c.onRedemptionIsland);
    const competitors = alive.filter(c => c.id !== immuneId && c.id !== savedId);
    if (competitors.length >= 2) {
      setFireCompetitors([competitors[0].id, competitors[1].id]);
    } else if (competitors.length === 1) {
      // Only 1 competitor (edge case) — they automatically lose, no challenge
      handleFireResult(true, competitors[0].id, 0);
    }
  }

  // Compute fire competitors once fireSavedId is set (for NPC auto-pick case)
  useEffect(() => {
    if (stage !== 'fire_making' || fireSavedId === null || fireCompetitors !== null) return;
    const alive = castaways.filter(c => !c.eliminated && !c.onRedemptionIsland);
    const competitors = alive.filter(c => c.id !== immuneId && c.id !== fireSavedId);
    if (competitors.length >= 2) {
      setFireCompetitors([competitors[0].id, competitors[1].id]);
    }
  }, [stage, fireSavedId, fireCompetitors]); // eslint-disable-line react-hooks/exhaustive-deps

  // The fire-making bout itself (player-vs-NPC or NPC-vs-NPC spectate) is rendered
  // full-screen via the FireGame minigame — see the early return in the render.
  function onFireComplete(winnerId: number) {
    if (!fireCompetitors) return;
    const [fA, fB] = fireCompetitors;
    handleFireResult(winnerId === fA, fA, fB);
  }

  // winnerIsA: if true fA wins, if false fB wins; or pass winId/loseId directly
  function handleFireResult(winnerIsFirst: boolean, firstId: number, secondId: number) {
    const winId  = winnerIsFirst ? firstId : secondId;
    const loseId = winnerIsFirst ? secondId : firstId;

    setFireWinnerId(winId);
    setFireLoserId(loseId);

    permanentEliminate(loseId, day, [winId]);

    if (gameMode === 'post-merge') {
      const boot = castaways.find(c => c.id === loseId);
      if (boot) {
        const relScores: Record<number, number> = {};
        castaways.forEach(c => { relScores[c.id] = c.stats.trust; });
        addJuryMember({
          castawayId:         loseId,
          eliminatedDay:      day,
          eliminatedBy:       [winId],
          bitternessFactor:   0.4,
          relationshipScores: relScores,
        });
      }
    }

    const loserName = loseId === PLAYER_ID ? 'You' : (castaways.find(c => c.id === loseId)?.name ?? 'Someone');
    addFeedEntry({
      id:   `fire-day${day}`,
      day,
      phase,
      text: loseId === PLAYER_ID
        ? 'You lost the fire-making challenge. Your torch is snuffed.'
        : `${loserName} lost the fire-making challenge.`,
      type: 'vote',
    });

    setStage('fire_result');
  }

  // ── Parchment reveal timing ─────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'parchment') return;
    if (revealIndex >= parchmentList.length) {
      const t = setTimeout(() => setStage('snuffed'), 1800);
      return () => clearTimeout(t);
    }
    const delay = revealIndex === 0 ? 900 : 1400;
    revealTimer.current = setTimeout(() => {
      cardAnim.setValue(0);
      Animated.timing(cardAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      hap.medium();
      playSfx('parchment');
      setRevealIndex(n => n + 1);
    }, delay);
    return () => { if (revealTimer.current) clearTimeout(revealTimer.current); };
  }, [stage, revealIndex, parchmentList.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stage !== 'snuffed') return;
    hap.heavy();
    playSfx('torch');
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const { advance } = usePhase();

  function handleDone() {
    const eliminated = stage === 'fire_result' ? fireLoserId : tribalResult?.eliminatedId;
    if (eliminated === PLAYER_ID) {
      // Edge of Extinction: a voted-out player with a re-entry shot goes to the Edge.
      if (edgeIds.includes(PLAYER_ID)) {
        navigation.navigate('Edge');
        return;
      }
      setGameMode('ended');
      navigation.getParent()?.navigate('MainMenu');
      return;
    }
    advance();
    navigation.goBack();
  }

  function bootName(): string {
    if (!tribalResult) return '';
    if (tribalResult.eliminatedId === PLAYER_ID) return 'YOU';
    return castaways.find(c => c.id === tribalResult.eliminatedId)?.name ?? '';
  }

  const currentParchment = revealIndex > 0 ? parchmentList[revealIndex - 1] : null;

  const tallyEntries = useMemo(() => {
    if (!tribalResult) return [];
    const allCandidateIds = new Set(parchmentList.filter(p => !p.voided).map(p => p.targetId));
    return [...allCandidateIds].map(id => ({
      id,
      name: id === PLAYER_ID ? playerName : (castaways.find(c => c.id === id)?.name ?? '?'),
      count: runningTally[id] ?? 0,
    })).sort((a, b) => b.count - a.count);
  }, [runningTally, parchmentList, tribalResult, castaways, playerName]);

  // Players available for fire-making save (immune player picks one to protect)
  const firePickTargets = useMemo(() => {
    if (!isFireMakingCouncil || immuneId !== PLAYER_ID) return [];
    return castaways.filter(c => !c.eliminated && !c.onRedemptionIsland && c.id !== PLAYER_ID);
  }, [castaways, immuneId, isFireMakingCouncil]);

  // Fire-making bout (F4) is rendered full-screen via the FireGame minigame.
  if (stage === 'fire_making' && fireCompetitors !== null) {
    const [fA, fB] = fireCompetitors;
    const ca = castaways.find(c => c.id === fA);
    const cb = castaways.find(c => c.id === fB);
    if (ca && cb) {
      const mk = (c: Castaway) => ({
        id: c.id,
        name: c.id === PLAYER_ID ? playerName : c.name,
        color: c.id === PLAYER_ID ? '#3d5a7c' : c.color,
        isPlayer: c.id === PLAYER_ID,
        skill: challengeSkill(c, 'mixed'),
      });
      return (
        <FireGame
          difficulty={difficulty}
          participants={[mk(ca), mk(cb)]}
          mode={fireCompetitors.includes(PLAYER_ID) ? 'compete' : 'spectate'}
          seed={hashSeed(gameSeed, `f4-fire-d${day}`)}
          onComplete={(r) => onFireComplete(r.winnerId)}
        />
      );
    }
  }

  const sceneAttendees = [
    ...councilMembers.map(c => ({ id: c.id, name: c.name, color: c.color })),
    { id: PLAYER_ID, name: playerName, color: '#3d5a7c' },
  ];
  const sceneSnuffedId =
    stage === 'snuffed' ? (tribalResult?.eliminatedId ?? null) :
    stage === 'fire_result' ? fireLoserId : null;

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <TribalCouncilScene attendees={sceneAttendees} snuffedId={sceneSnuffedId} height={150} />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>TRIBAL COUNCIL · DAY {day}</Text>
        <Text style={styles.title}>
          {stage === 'talk'         ? 'THE COUNCIL SPEAKS'    :
           stage === 'pre_vote'     ? 'PLAY AN ADVANTAGE?'    :
           stage === 'vote'         ? 'CAST YOUR VOTE'        :
           stage === 'post_vote'    ? 'BEFORE THE VOTES...'   :
           stage === 'parchment'    ? "I'LL READ THE VOTES"   :
           stage === 'fire_making'  ? 'FIRE MAKING'           :
           stage === 'fire_result'  ? 'THE FLAME DECIDES'     :
                                      'TORCH SNUFFED'}
        </Text>
        {immuneId !== null && immuneId !== PLAYER_ID && (
          <Text style={styles.immuneSub}>
            {castaways.find(c => c.id === immuneId)?.name ?? ''} has immunity.
          </Text>
        )}
        {immuneId === PLAYER_ID && (
          <Text style={[styles.immuneSub, { color: C.palm }]}>You have immunity.</Text>
        )}
        {playerSafe && stage !== 'snuffed' && (
          <Text style={[styles.immuneSub, { color: C.sun }]}>Safety Without Power — you are safe.</Text>
        )}
      </View>

      {/* ── TALK ── */}
      {stage === 'talk' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={styles.jeffLine}>
            "Before we get to the vote, I want to hear from everyone."
          </Text>
          {talkQuotes.map(({ castaway, quote }) => (
            <View key={castaway.id} style={styles.quoteCard}>
              <Portrait color={castaway.color} initials={initials(castaway.name)} size={36} />
              <View style={styles.quoteBody}>
                <Text style={styles.quoteName}>{castaway.name}</Text>
                <Text style={styles.quoteText}>"{quote}"</Text>
              </View>
            </View>
          ))}
          {isFireMakingCouncil && (
            <View style={styles.fireNotice}>
              <Text style={styles.fireNoticeText}>
                🔥 Final 4 — tonight ends with fire making, not a vote.
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.ctaBtn} onPress={handleTalkDone}>
            <Text style={styles.ctaBtnLabel}>
              {isFireMakingCouncil ? 'PROCEED TO FIRE MAKING' : 'HEAD TO THE VOTE'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── PRE-VOTE ADVANTAGES ── */}
      {stage === 'pre_vote' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {pickingTargetFor !== null ? (
            <>
              <Text style={styles.prompt}>
                Select the target for{' '}
                <Text style={{ color: C.sun }}>{ADVANTAGE_DEFS[pickingTargetFor].name}</Text>:
              </Text>
              {councilMembers.filter(c => c.id !== PLAYER_ID).map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.targetCard}
                  onPress={() => confirmTarget(c.id)}
                >
                  <Portrait color={c.color} initials={initials(c.name)} size={36} />
                  <View style={styles.targetInfo}>
                    <Text style={styles.targetName}>{c.name}</Text>
                    <Text style={styles.targetJob}>{c.job}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPickingTargetFor(null)}>
                <Text style={styles.cancelBtnLabel}>CANCEL</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {preVoteAdvantages.length === 0 ? (
                <Text style={styles.noAdvantages}>No pre-vote advantages to play.</Text>
              ) : (
                <>
                  <Text style={styles.prompt}>Play a pre-vote advantage?</Text>
                  {preVoteAdvantages.map((type, i) => (
                    <AdvantageCard
                      key={`${type}-${i}`}
                      type={type}
                      selected={isPlayed(type)}
                      expired={isExpired(type)}
                      onPress={() => togglePlay(type)}
                    />
                  ))}
                </>
              )}
              <TouchableOpacity style={styles.ctaBtn} onPress={handlePreVoteDone}>
                <Text style={styles.ctaBtnLabel}>
                  {playerSafe ? 'LEAVE BEFORE VOTE' : 'PROCEED TO VOTE'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      {/* ── VOTE ── */}
      {stage === 'vote' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={styles.prompt}>Who do you vote to eliminate?</Text>
          {targets.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.targetCard, playerVote === c.id && styles.targetCardSelected]}
              onPress={() => castVote(c.id)}
            >
              <Portrait color={c.color} initials={initials(c.name)} size={40} />
              <View style={styles.targetInfo}>
                <Text style={styles.targetName}>{c.name}</Text>
                <Text style={styles.targetJob}>{c.job}</Text>
              </View>
              {playerVote === c.id && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── POST-VOTE ADVANTAGES ── */}
      {stage === 'post_vote' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={styles.jeffLine}>"Before I read the votes — does anyone want to play an advantage?"</Text>
          {pickingTargetFor !== null ? (
            <>
              <Text style={styles.prompt}>
                Nullify idol for{' '}
                <Text style={{ color: C.sun }}>{ADVANTAGE_DEFS[pickingTargetFor].name}</Text>:
              </Text>
              {councilMembers.filter(c => c.id !== PLAYER_ID).map(c => (
                <TouchableOpacity key={c.id} style={styles.targetCard} onPress={() => confirmTarget(c.id)}>
                  <Portrait color={c.color} initials={initials(c.name)} size={36} />
                  <View style={styles.targetInfo}>
                    <Text style={styles.targetName}>{c.name}</Text>
                    <Text style={styles.targetJob}>{c.job}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPickingTargetFor(null)}>
                <Text style={styles.cancelBtnLabel}>CANCEL</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {postVoteAdvantages.length === 0 ? (
                <Text style={styles.noAdvantages}>No post-vote advantages to play.</Text>
              ) : (
                <>
                  <Text style={styles.prompt}>Play a Hidden Immunity Idol?</Text>
                  {postVoteAdvantages.map((type, i) => (
                    <AdvantageCard
                      key={`${type}-${i}`}
                      type={type}
                      selected={isPlayed(type)}
                      expired={isExpired(type)}
                      onPress={() => togglePlay(type)}
                    />
                  ))}
                  {isPlayed('steal_a_vote') && stealTarget !== null && (
                    <Text style={styles.targetConfirm}>
                      Steal-A-Vote target: {castaways.find(c => c.id === stealTarget)?.name ?? '?'}
                    </Text>
                  )}
                  {isPlayed('idol_nullifier') && nullifyTarget !== null && (
                    <Text style={styles.targetConfirm}>
                      Nullifier target: {castaways.find(c => c.id === nullifyTarget)?.name ?? '?'}
                    </Text>
                  )}
                </>
              )}
              <TouchableOpacity style={styles.ctaBtn} onPress={handlePostVoteDone}>
                <Text style={styles.ctaBtnLabel}>READ THE VOTES</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      {/* ── PARCHMENT REVEAL ── */}
      {stage === 'parchment' && (
        <View style={styles.body}>
          {tribalResult?.idolPlayed && (
            <View style={styles.idolBanner}>
              <Text style={styles.idolBannerText}>
                🏺{' '}
                {tribalResult.idolPlayerId === PLAYER_ID
                  ? 'You played a Hidden Immunity Idol.'
                  : `${castaways.find(c => c.id === tribalResult.idolPlayerId)?.name ?? 'Someone'} played a Hidden Immunity Idol.`}
                {'\n'}Those votes will not count.
              </Text>
            </View>
          )}
          <View style={styles.parchmentCenter}>
            {currentParchment ? (
              <Animated.View style={[styles.parchmentBig, {
                opacity: cardAnim,
                transform: [{ scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
              }]}>
                <Text style={styles.parchmentVoidLabel}>
                  {currentParchment.voided ? '✕ DOES NOT COUNT' : ''}
                </Text>
                <Text style={[styles.parchmentName, currentParchment.voided && styles.parchmentNameVoided]}>
                  {currentParchment.name}
                </Text>
              </Animated.View>
            ) : (
              <View style={styles.parchmentPlaceholder}>
                <Text style={styles.parchmentPlaceholderText}>...</Text>
              </View>
            )}
            <Text style={styles.voteCounter}>{revealIndex} of {parchmentList.length}</Text>
          </View>
          {revealIndex > 0 && (
            <View style={styles.tallyLive}>
              {tallyEntries.map(entry => (
                <View key={entry.id} style={styles.tallyLiveRow}>
                  <Text style={styles.tallyLiveName}>{entry.name}</Text>
                  <View style={styles.tallyLiveDots}>
                    {Array.from({ length: entry.count }).map((_, i) => (
                      <View key={i} style={styles.tallyLiveDot} />
                    ))}
                  </View>
                  <Text style={styles.tallyLiveCount}>{entry.count}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── FIRE MAKING ── */}
      {stage === 'fire_making' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* Phase A: immunity holder picks who to save */}
          {fireSavedId === null && immuneId === PLAYER_ID && (
            <>
              <Text style={styles.jeffLine}>
                "You have immunity. Choose one person to join you in the finale."
              </Text>
              <Text style={styles.prompt}>The remaining two will make fire.</Text>
              {firePickTargets.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.targetCard}
                  onPress={() => handleFireSavePick(c.id)}
                >
                  <Portrait color={c.color} initials={initials(c.name)} size={40} />
                  <View style={styles.targetInfo}>
                    <Text style={styles.targetName}>{c.name}</Text>
                    <Text style={styles.targetJob}>{c.job}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Phase A: waiting for NPC auto-pick */}
          {fireSavedId === null && immuneId !== PLAYER_ID && (
            <View style={styles.autoFireWait}>
              <Text style={styles.narrative}>
                {castaways.find(c => c.id === immuneId)?.name ?? 'The immunity holder'} decides who to save…
              </Text>
              <Text style={styles.ellipsis}>· · ·</Text>
            </View>
          )}

          {/* Once competitors are set, the bout opens full-screen (see early return). */}
        </ScrollView>
      )}

      {/* ── FIRE RESULT ── */}
      {stage === 'fire_result' && fireWinnerId !== null && fireLoserId !== null && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.snuffBlock}>
            <Text style={styles.snuffFlame}>🔥</Text>
            {fireLoserId === PLAYER_ID ? (
              <Text style={styles.snuffText}>
                Your flame went out. Your torch is snuffed.
              </Text>
            ) : (
              <Text style={styles.snuffText}>
                {castaways.find(c => c.id === fireLoserId)?.name ?? 'Someone'} could not keep the flame alive.
              </Text>
            )}
          </View>
          <View style={styles.fireResultRow}>
            <Text style={styles.fireResultLabel}>FINALISTS</Text>
            {castaways
              .filter(c => !c.eliminated && !c.onRedemptionIsland)
              .map(c => (
                <Text key={c.id} style={styles.fireResultName}>
                  {c.id === PLAYER_ID ? playerName : c.name}
                </Text>
              ))}
          </View>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
              <Text style={styles.doneBtnLabel}>
                {fireLoserId === PLAYER_ID ? 'YOUR JOURNEY ENDS' : 'PROCEED TO FINALE'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ── SNUFFED ── */}
      {stage === 'snuffed' && tribalResult && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.snuffBlock}>
            <Text style={styles.snuffFlame}>🔥</Text>
            <Text style={styles.snuffText}>
              {tribalResult.eliminatedId === PLAYER_ID
                ? 'The tribe has spoken. You have been voted out.'
                : `${bootName()}, the tribe has spoken.`}
            </Text>
          </View>
          {Object.entries(tribalResult.resolvedVotes)
            .sort(([, a], [, b]) => b.length - a.length)
            .map(([targetIdStr, voterIds]) => {
              const targetId = Number(targetIdStr);
              const name = targetId === PLAYER_ID
                ? playerName
                : (castaways.find(c => c.id === targetId)?.name ?? '?');
              const isBooted = targetId === tribalResult.eliminatedId;
              return (
                <View key={targetIdStr} style={[styles.tallyRow, isBooted && styles.tallyRowBooted]}>
                  <Text style={[styles.tallyName, isBooted && styles.tallyNameBooted]}>{name}</Text>
                  <View style={styles.tallyDots}>
                    {voterIds.map((_, i) => (
                      <View key={i} style={[styles.voteDot, { backgroundColor: isBooted ? C.coral : C.inkSoft }]} />
                    ))}
                  </View>
                  <Text style={[styles.tallyCount, isBooted && { color: C.coral }]}>{voterIds.length}</Text>
                </View>
              );
            })}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
              <Text style={styles.doneBtnLabel}>
                {tribalResult.eliminatedId === PLAYER_ID ? 'YOUR JOURNEY ENDS' : 'RETURN TO CAMP'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:                  { flex: 1, backgroundColor: C.night },
  header:                { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#ffffff18' },
  eyebrow:               { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  title:                 { fontSize: 24, fontFamily: F.display, fontWeight: '800', color: C.bone, letterSpacing: -0.5 },
  immuneSub:             { fontSize: 11, fontFamily: F.body, color: C.sun, marginTop: 4, letterSpacing: 0.5 },

  body:                  { flex: 1 },
  bodyContent:           { padding: 24, paddingBottom: 40 },

  jeffLine:              { fontSize: 13, fontFamily: F.body, color: C.sun, fontStyle: 'italic', marginBottom: 20, lineHeight: 20 },

  quoteCard:             { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#ffffff0a', borderWidth: 1, borderColor: '#ffffff18', borderRadius: 12, padding: 14, marginBottom: 10 },
  quoteBody:             { flex: 1 },
  quoteName:             { fontSize: 12, fontFamily: F.body, fontWeight: '700', color: C.bone, marginBottom: 4, letterSpacing: 0.5 },
  quoteText:             { fontSize: 13, fontFamily: F.body, color: C.inkSoft, lineHeight: 19, fontStyle: 'italic' },

  fireNotice:            { backgroundColor: '#ff6b3518', borderLeftWidth: 3, borderLeftColor: C.torch, borderRadius: 8, padding: 14, marginBottom: 16 },
  fireNoticeText:        { fontSize: 13, fontFamily: F.body, color: C.torch, lineHeight: 20 },

  prompt:                { fontSize: 13, fontFamily: F.body, color: C.bone, opacity: 0.7, marginBottom: 16 },
  noAdvantages:          { fontSize: 14, fontFamily: F.body, color: C.inkSoft, textAlign: 'center', marginVertical: 24 },

  targetCard:            { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff0f', borderWidth: 1, borderColor: '#ffffff22', borderRadius: 12, padding: 12, marginBottom: 10 },
  targetCardSelected:    { borderColor: C.coral, backgroundColor: '#e85a4f22' },
  targetInfo:            { flex: 1 },
  targetName:            { fontSize: 15, fontFamily: F.body, fontWeight: '700', color: C.bone },
  targetJob:             { fontSize: 11, fontFamily: F.body, color: C.inkSoft, marginTop: 1 },
  checkmark:             { fontSize: 18, color: C.coral },
  targetConfirm:         { fontSize: 11, fontFamily: F.mono, color: C.sun, marginBottom: 8, letterSpacing: 0.5 },

  ctaBtn:                { backgroundColor: C.torch, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  ctaBtnLabel:           { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  cancelBtn:             { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#ffffff22' },
  cancelBtnLabel:        { fontSize: 12, fontFamily: F.body, fontWeight: '700', color: C.inkSoft, letterSpacing: 1 },

  idolBanner:            { backgroundColor: '#f4a83a18', borderLeftWidth: 3, borderLeftColor: C.sun, borderRadius: 8, padding: 14, margin: 16, marginBottom: 0 },
  idolBannerText:        { fontSize: 13, fontFamily: F.body, color: C.sun, lineHeight: 20 },

  parchmentCenter:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  parchmentBig:          { backgroundColor: '#f5e8c8', borderWidth: 2, borderColor: '#8a6a40', borderRadius: 16, paddingVertical: 28, paddingHorizontal: 32, alignItems: 'center', minWidth: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 8 },
  parchmentVoidLabel:    { fontSize: 10, fontFamily: F.mono, color: C.coral, letterSpacing: 2, marginBottom: 4 },
  parchmentName:         { fontSize: 32, fontFamily: F.display, fontWeight: '800', color: '#2a1a0a', letterSpacing: -0.5 },
  parchmentNameVoided:   { textDecorationLine: 'line-through', color: C.coral, opacity: 0.7 },
  parchmentPlaceholder:  { width: 200, height: 120, backgroundColor: '#ffffff0a', borderWidth: 2, borderColor: '#ffffff18', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  parchmentPlaceholderText: { fontSize: 24, color: C.inkSoft },
  voteCounter:           { marginTop: 16, fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2 },

  tallyLive:             { paddingHorizontal: 24, paddingBottom: 20 },
  tallyLiveRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  tallyLiveName:         { width: 90, fontSize: 12, fontFamily: F.body, color: C.bone, fontWeight: '600' },
  tallyLiveDots:         { flex: 1, flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  tallyLiveDot:          { width: 10, height: 10, borderRadius: 5, backgroundColor: C.torch },
  tallyLiveCount:        { width: 24, fontSize: 14, fontFamily: F.mono, color: C.bone, textAlign: 'right', fontWeight: '700' },

  snuffBlock:            { alignItems: 'center', paddingVertical: 24 },
  snuffFlame:            { fontSize: 36, marginBottom: 12 },
  snuffText:             { fontSize: 15, fontFamily: F.body, color: C.torch, fontWeight: '600', textAlign: 'center', lineHeight: 22 },
  tallyRow:              { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  tallyRowBooted:        { opacity: 0.85 },
  tallyName:             { flex: 1, fontSize: 14, fontFamily: F.body, color: C.bone, fontWeight: '600' },
  tallyNameBooted:       { textDecorationLine: 'line-through', color: C.coral },
  tallyDots:             { flexDirection: 'row', gap: 4, flexWrap: 'wrap', maxWidth: 80 },
  voteDot:               { width: 10, height: 10, borderRadius: 5 },
  tallyCount:            { width: 22, fontSize: 13, fontFamily: F.mono, color: C.bone, textAlign: 'right' },
  footer:                { marginTop: 28 },
  doneBtn:               { backgroundColor: C.torch, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  doneBtnLabel:          { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },

  // Fire-making styles
  autoFireWait:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  narrative:             { fontSize: 14, fontFamily: F.body, color: C.bone, opacity: 0.85, lineHeight: 22, marginBottom: 28, textAlign: 'center' },
  ellipsis:              { fontSize: 28, color: C.inkSoft, letterSpacing: 8 },
  fireResultRow:         { backgroundColor: '#ffffff08', borderRadius: 12, padding: 16, marginBottom: 24 },
  fireResultLabel:       { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 10 },
  fireResultName:        { fontSize: 15, fontFamily: F.body, fontWeight: '700', color: C.bone, marginBottom: 4 },
});
