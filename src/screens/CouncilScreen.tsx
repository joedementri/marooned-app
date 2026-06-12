import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useAudio } from '../hooks/useAudio';
import { useHaptics } from '../hooks/useHaptics';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { PLAYER_ID, tallyVotes, breakTie } from '../utils/voteSimulator';
import type { VoteMap } from '../utils/voteSimulator';
import { resolveTribal } from '../utils/advantageResolver';
import type { AdvantagePlay, TribalResult } from '../utils/advantageResolver';
import { simulateTribalVotes, predictVoterTarget } from '../engine/voteEngine';
import { getRel } from '../engine/socialEngine';
import type { AdvantageType } from '../data/advantages';
import { ADVANTAGE_DEFS } from '../data/advantages';
import { getFinalWords } from '../data/finalWords';
import { seeded } from '../utils/seeded';
import { initials } from '../data/roster';
import type { Castaway } from '../data/roster';
import type { ArchetypeKey } from '../data/archetypes';
import { usePhase } from '../hooks/usePhase';
import { useSaveSlots } from '../hooks/useSaveSlots';
import Portrait from '../components/atoms/Portrait';
import ParchmentCard from '../components/game/ParchmentCard';
import VoteParchment from '../components/game/VoteParchment';
import AdvantageCard from '../components/game/AdvantageCard';
import FireGame from '../minigames/FireGame';
import TribalCouncilScene from '../components/graphics/TribalCouncilScene';
import { challengeSkill } from '../engine/challengeEngine';
import { buildJuryRelScores } from '../utils/juryRelScores';
import type { RelDelta } from '../engine/socialEngine';
import type { IntelEntry } from '../store/slices/intelSlice';
import { hashSeed } from '../engine/rng';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';

type Props = StackScreenProps<GameParamList, 'Council'>;
type Stage =
  | 'talk'
  | 'whisper'
  | 'pre_vote'
  | 'vote'
  | 'post_vote'
  | 'idol_play'
  | 'parchment'
  | 'revote'
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
  const [narrationRef, setNarrationRef]   = useState<string[]>([]);
  const [tribalResult, setTribalResult]   = useState<TribalResult | null>(null);
  const [parchmentList, setParchmentList] = useState<Array<{ name: string; voided: boolean; targetId: number }>>([]);
  const [revealIndex, setRevealIndex]     = useState(0);

  // Whisper state — two whisper actions per tribal
  const [whispersLeft, setWhispersLeft]   = useState(2);
  const [shareWithId, setShareWithId]     = useState<number | null>(null);
  const [askAnswers, setAskAnswers]       = useState<Record<number, string>>({});

  // Idol-moment state — advantage drama shown line by line before the votes
  const [dramaLines, setDramaLines]       = useState<string[]>([]);
  const [dramaIdx, setDramaIdx]           = useState(0);

  // Revote state — true when a double deadlock was settled by rocks
  const [rocksDrawn, setRocksDrawn]       = useState(false);

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

  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { playSfx } = useAudio('council');
  const hap = useHaptics();

  const {
    castaways, day, phase, gameMode,
    playerName, playerTribeId, playerAdvantages, playerIdolCount,
    immunityWinnerId, difficulty, gameSettings,
    relationships, alliances, gameSeed, edgeIds, sharedPlans,
    applyRelDeltas, addIntel, syncPlayerFacingStats, setSharedPlan,
    addFeedEntry, eliminateCastaway, permanentEliminate, addJuryMember,
    removePlayerAdvantage, removeCastawayAdvantage, setPlayerIdolCount, setGameMode,
    applyTribalAftermathToStore, bumpPlayerThreat,
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
      sharedPlans:          s.sharedPlans,
      applyRelDeltas:       s.applyRelDeltas,
      addIntel:             s.addIntel,
      syncPlayerFacingStats: s.syncPlayerFacingStats,
      setSharedPlan:        s.setSharedPlan,
      addFeedEntry:         s.addFeedEntry,
      eliminateCastaway:    s.eliminateCastaway,
      permanentEliminate:   s.permanentEliminate,
      addJuryMember:        s.addJuryMember,
      removePlayerAdvantage: s.removePlayerAdvantage,
      removeCastawayAdvantage: s.removeCastawayAdvantage,
      setPlayerIdolCount:   s.setPlayerIdolCount,
      setGameMode:          s.setGameMode,
      applyTribalAftermathToStore: s.applyTribalAftermathToStore,
      bumpPlayerThreat:     s.bumpPlayerThreat,
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
    setStage('whisper');
  }

  function handleWhisperDone() {
    if (preVoteAdvantages.length > 0) {
      setStage('pre_vote');
    } else {
      setStage('vote');
    }
  }

  // ── Whisper actions ──────────────────────────────────────────────────────
  function nameOf(id: number): string {
    return id === PLAYER_ID ? playerName : (castaways.find(c => c.id === id)?.name.split(' ')[0] ?? '?');
  }

  // Tell an NPC who you're (supposedly) voting for. Loyal/high-trust allies
  // will lean toward that name at the vote — and after the votes are read,
  // they'll know whether you kept your word.
  function confirmSharePlan(targetId: number) {
    if (shareWithId === null || whispersLeft <= 0) return;
    setSharedPlan(shareWithId, targetId, day);
    applyRelDeltas([{ a: shareWithId, b: PLAYER_ID, d: { trust: 0.04, lastEventDay: day } }]);
    setShareWithId(null);
    setWhispersLeft(n => n - 1);
    hap.light();
  }

  // Ask an NPC who they're voting for. Honest or trusting castaways give a
  // real read of their lean; the rest name a decoy. Nobody admits to "you".
  function askPlan(npc: Castaway) {
    if (whispersLeft <= 0 || askAnswers[npc.id]) return;
    const eligible = [
      ...targets.map(t => t.id),
      ...(immuneId !== PLAYER_ID ? [PLAYER_ID] : []),
    ];
    const predicted = predictVoterTarget({
      voter: npc, eligibleTargets: eligible, relationships, alliances, castaways, day, sharedPlans,
    });
    const honest =
      predicted !== null && predicted !== PLAYER_ID &&
      (npc.personality.honesty > 0.45 || getRel(relationships, npc.id, PLAYER_ID).trust > 0.6);
    const rng = seeded(day * 9091 + npc.id * 53);
    let namedId = predicted;
    if (!honest) {
      const decoys = eligible.filter(id => id !== predicted && id !== npc.id && id !== PLAYER_ID);
      if (decoys.length > 0) namedId = decoys[Math.floor(rng() * decoys.length)];
    }
    if (namedId === null || namedId === PLAYER_ID) {
      setAskAnswers(prev => ({ ...prev, [npc.id]: "I'm still feeling it out." }));
      setWhispersLeft(n => n - 1);
      hap.light();
      return;
    }
    const answer = `I'm writing ${nameOf(namedId)} tonight.`;
    setAskAnswers(prev => ({ ...prev, [npc.id]: answer }));
    addIntel([{
      id: `whisper-d${day}-${npc.id}`,
      day,
      kind: 'told',
      sourceId: npc.id,
      subjectIds: [npc.id],
      claim: { type: 'vote-target', voterId: npc.id, targetId: namedId },
      text: `${npc.name.split(' ')[0]} says they're voting ${nameOf(namedId)} tonight.`,
      truthful: namedId === predicted,
      confidence: honest ? 'medium' : 'low',
    }]);
    setWhispersLeft(n => n - 1);
    hap.light();
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
      sharedPlans,
    });
  }

  function castVote(targetId: number) {
    if (stage !== 'vote') return;
    setPlayerVote(targetId);
    const ctx = runVoteSim(targetId);
    setRawVotesRef(ctx.votes);
    setNpcPlaysRef(ctx.npcPlays);
    setNpcConsumedRef(ctx.consumed);
    setNarrationRef(ctx.narration);
    if (postVoteAdvantages.length > 0) {
      setStage('post_vote');
    } else {
      runCouncil(targetId, ctx.votes, ctx.npcPlays, ctx.consumed, ctx.narration);
    }
  }

  function handlePostVoteDone() {
    if (rawVotesRef && playerVote !== null) {
      runCouncil(playerVote, rawVotesRef, npcPlaysRef, npcConsumedRef, narrationRef);
    }
  }

  function castVoteAndRun(playerVoteTarget: number | null) {
    const ctx = runVoteSim(playerVoteTarget);
    setRawVotesRef(ctx.votes);
    setNpcPlaysRef(ctx.npcPlays);
    setNpcConsumedRef(ctx.consumed);
    setNarrationRef(ctx.narration);
    runCouncil(playerVoteTarget, ctx.votes, ctx.npcPlays, ctx.consumed, ctx.narration);
  }

  function runCouncil(
    playerVoteTarget: number | null,
    rawVotes: VoteMap,
    npcPlays: AdvantagePlay[],
    npcConsumed: Array<{ holderId: number; type: AdvantageType }>,
    npcNarration: string[] = [],
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

    // Leave ties unresolved — a deadlock triggers a real revote stage.
    const result = resolveTribal(rawVotes, plays, castaways, aliveCount, day, { breakTies: false });
    setTribalResult(result);

    // Consume the advantages NPCs played.
    npcConsumed.forEach(c => removeCastawayAdvantage(c.holderId, c.type));

    if (playerPlays.includes('hii')) setPlayerIdolCount(playerIdolCount - 1);
    playerPlays
      .filter(p => p !== 'hii' && p !== 'safety_without_power')
      .forEach(p => removePlayerAdvantage(p));

    // Every advantage the player plays in front of the council marks them as
    // a strategic threat in the eyes of the remaining castaways.
    const playerPublicPlays = plays.filter(p => p.actorId === PLAYER_ID).length;
    if (playerPublicPlays > 0) bumpPlayerThreat(0.1 * playerPublicPlays);

    // Whispered plans come due. Votes are read aloud, so anyone the player
    // told a plan can tell whether the player kept their word.
    const planEntries = Object.entries(sharedPlans).filter(([, p]) => p.day === day);
    if (planEntries.length > 0) {
      const relDeltas: RelDelta[] = [];
      const lieIntel: IntelEntry[] = [];
      for (const [npcIdStr, plan] of planEntries) {
        const npcId = Number(npcIdStr);
        const npc = castaways.find(c => c.id === npcId);
        if (!npc || npc.eliminated || npcId === result.eliminatedId) continue;
        if (playerVoteTarget === plan.targetId) {
          relDeltas.push({ a: npcId, b: PLAYER_ID, d: { trust: 0.05, lastEventDay: day } });
        } else {
          relDeltas.push({
            a: npcId, b: PLAYER_ID,
            d: { trust: -0.25, grudge: 0.2, affinity: -0.1, lastEventDay: day },
          });
          lieIntel.push({
            id: `lie-d${day}-${npcId}`,
            day,
            kind: 'observation',
            sourceId: null,
            subjectIds: [npcId],
            claim: { type: 'relationship', a: npcId, b: PLAYER_ID, tone: 'feuding' },
            text: `${npc.name.split(' ')[0]} compared notes after tribal. They know you didn't vote the way you said.`,
            truthful: true,
            confidence: 'high',
          });
        }
      }
      if (relDeltas.length) { applyRelDeltas(relDeltas); syncPlayerFacingStats(); }
      if (lieIntel.length) addIntel(lieIntel);
    }

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

    const tied = result.tieIds != null && result.tieIds.length > 1;
    if (!tied) {
      finalizeBoot(result.eliminatedId, rawVotes, playerVoteTarget);
    }

    // Round-one parchments. On a tie there's no decisive vote; the reveal
    // effect routes to the revote stage instead of the snuff.
    setParchmentList(nameParchments(buildDramaticOrder(
      rawVotes,
      tied ? -1 : result.eliminatedId,
      result.idolPlayed,
      result.idolPlayerId,
      result.resolvedVotes,
    )));
    setRevealIndex(0);

    // Advantage drama gets its own beat before the votes are read.
    const lines: string[] = [];
    for (const p of plays) {
      if (p.actorId === PLAYER_ID && p.type !== 'safety_without_power') {
        lines.push(`You stand and play ${ADVANTAGE_DEFS[p.type].name}.`);
      }
    }
    lines.push(...npcNarration);
    if (lines.length > 0) {
      setDramaLines(lines);
      setDramaIdx(0);
      setStage('idol_play');
    } else {
      setStage('parchment');
    }
  }

  function nameParchments(list: Array<{ name: string; voided: boolean; targetId: number }>) {
    return list.map(p => ({
      ...p,
      name: p.targetId === PLAYER_ID
        ? playerName
        : (castaways.find(c => c.id === p.targetId)?.name ?? '?'),
    }));
  }

  // Everything that happens once a boot is actually decided: the elimination
  // itself, relationship fallout, jury bookkeeping, and the narrative feed.
  function finalizeBoot(eliminatedId: number, votesRecord: VoteMap, playerVoteTarget: number | null) {
    const votersAgainst = Object.entries(votesRecord)
      .filter(([k]) => Number(k) === eliminatedId)
      .flatMap(([, v]) => v);

    eliminateCastaway(eliminatedId, day, votersAgainst);

    // Update the relationship graph: allies of the booted resent the voters,
    // blindsided alliances fracture.
    applyTribalAftermathToStore(votesRecord, eliminatedId);

    if (gameMode === 'post-merge') {
      const boot = castaways.find(c => c.id === eliminatedId);
      if (boot) {
        const relScores = buildJuryRelScores(eliminatedId, castaways, relationships);
        addJuryMember({
          castawayId:         eliminatedId,
          eliminatedDay:      day,
          eliminatedBy:       votersAgainst,
          bitternessFactor:   playerVoteTarget === eliminatedId ? 0.8 : 0.3,
          relationshipScores: relScores,
        });
      }
    }

    const bootName = eliminatedId === PLAYER_ID
      ? 'You'
      : (castaways.find(c => c.id === eliminatedId)?.name ?? 'Someone');

    addFeedEntry({
      id:   `tribal-day${day}-boot${eliminatedId}`,
      day,
      phase,
      text: eliminatedId === PLAYER_ID
        ? 'The tribe has spoken. You have been voted out.'
        : `${bootName} has been voted out on Day ${day}.`,
      type: 'vote',
    });

    if (eliminatedId !== PLAYER_ID) {
      const boot = castaways.find(c => c.id === eliminatedId);
      if (boot) {
        const goesToTwist =
          (gameSettings.twist === 'redemption' && gameMode === 'pre-merge') ||
          (gameSettings.twist === 'edge' && (gameSettings.edgePreMerge || gameMode === 'post-merge'));
        addFeedEntry({
          id: `finalwords-day${day}-${boot.id}`,
          day,
          phase,
          text: `${boot.name.split(' ')[0]}'s final words: "${getFinalWords(boot.archetype, boot.id, day, goesToTwist)}"`,
          type: 'vote',
        });
      }
    }
  }

  // ── Revote: a deadlocked council votes again, only between the tied ──────
  function runRevote(playerRevote: number | null) {
    if (!tribalResult?.tieIds) return;
    const tieIds = tribalResult.tieIds;
    const revoters = councilMembers.filter(c => !tieIds.includes(c.id));
    const ctx = simulateTribalVotes({
      voters: revoters,
      eligibleTargets: tieIds,
      playerVote: tieIds.includes(PLAYER_ID) ? null : playerRevote,
      relationships,
      alliances,
      castaways,
      day,
      gameSeed,
      scopeTag: `revote-${gameMode === 'pre-merge' ? playerTribeId : 'merge'}`,
      sharedPlans,
    });
    // Advantages were spent in round one — the revote is votes only.
    const tally = tallyVotes(ctx.votes);
    const rng = seeded(day * 7_773);
    const castMap = new Map(castaways.map(c => [c.id, c]));
    let eliminatedId: number;
    let rocks = false;
    if (tally.length === 0) {
      eliminatedId = breakTie(tieIds, castMap, rng);
      rocks = true;
    } else {
      const top = tally[0].count;
      const tops = tally.filter(t => t.count === top).map(t => t.id);
      if (tops.length === 1) {
        eliminatedId = tops[0];
      } else {
        eliminatedId = breakTie(tops, castMap, rng);
        rocks = true;
      }
    }

    setRocksDrawn(rocks);
    if (rocks) {
      addFeedEntry({
        id: `rocks-day${day}`,
        day,
        phase,
        text: 'Deadlocked again — the boot came down to rocks.',
        type: 'vote',
      });
    }

    setTribalResult({ ...tribalResult, eliminatedId, tieIds: undefined, resolvedVotes: ctx.votes });
    finalizeBoot(eliminatedId, ctx.votes, playerRevote ?? playerVote);

    setParchmentList(nameParchments(buildDramaticOrder(ctx.votes, eliminatedId, false, null, ctx.votes)));
    setRevealIndex(0);
    setStage('parchment');
  }

  // ── Fire-making helpers ────────────────────────────────────────────────────
  // Shared by the player-pick and NPC-auto-pick paths. Must handle <2
  // competitors or the fire_making stage renders empty and the game softlocks.
  function resolveFireCompetitors(savedId: number) {
    const alive = castaways.filter(c => !c.eliminated && !c.onRedemptionIsland);
    const competitors = alive.filter(c => c.id !== immuneId && c.id !== savedId);
    if (competitors.length >= 2) {
      setFireCompetitors([competitors[0].id, competitors[1].id]);
    } else if (competitors.length === 1) {
      // No opponent to face — the lone non-saved castaway is eliminated
      // outright by the immunity holder's decision.
      handleFireResult(false, competitors[0].id, immuneId ?? savedId);
    } else {
      // Nobody left to send to fire — skip the council entirely.
      advance();
      navigation.goBack();
    }
  }

  function handleFireSavePick(savedId: number) {
    setFireSavedId(savedId);
    resolveFireCompetitors(savedId);
  }

  // Compute fire competitors once fireSavedId is set (for NPC auto-pick case)
  useEffect(() => {
    if (stage !== 'fire_making' || fireSavedId === null || fireCompetitors !== null) return;
    resolveFireCompetitors(fireSavedId);
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
        const relScores = buildJuryRelScores(loseId, castaways, relationships);
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

  // ── Idol-moment reveal timing ────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'idol_play') return;
    if (dramaIdx === 0) {
      hap.heavy();
      playSfx('idol');
    }
    if (dramaIdx >= dramaLines.length) {
      const t = setTimeout(() => setStage('parchment'), 1200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      hap.medium();
      setDramaIdx(n => n + 1);
    }, dramaIdx === 0 ? 600 : 1500);
    return () => clearTimeout(t);
  }, [stage, dramaIdx, dramaLines.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Parchment reveal timing — pacing tightens as the vote gets close ─────
  useEffect(() => {
    if (stage !== 'parchment') return;
    if (revealIndex >= parchmentList.length) {
      const deadlocked = tribalResult?.tieIds != null && tribalResult.tieIds.length > 1;
      const t = setTimeout(() => setStage(deadlocked ? 'revote' : 'snuffed'), 1800);
      return () => clearTimeout(t);
    }

    const isDecisive = revealIndex === parchmentList.length - 1;
    const halfRead = revealIndex >= parchmentList.length / 2;
    const counts = Object.values(runningTally).sort((a, b) => b - a);
    const margin = (counts[0] ?? 0) - (counts[1] ?? 0);

    let delay = revealIndex === 0 ? 900 : 1100;
    if (halfRead && margin <= 1) delay = 1800; // neck and neck — let it breathe
    if (isDecisive) {
      delay = 2600; // the vote that decides it gets a long beat...
      hap.warning();
    }

    revealTimer.current = setTimeout(() => {
      const next = parchmentList[revealIndex];
      if (isDecisive) {
        hap.heavy();
      } else if (next && !next.voided) {
        // A vote that pulls someone level with the leader stings a little more.
        const newCount = (runningTally[next.targetId] ?? 0) + 1;
        const tiesLeader = Object.entries(runningTally)
          .some(([id, n]) => Number(id) !== next.targetId && n === newCount);
        if (tiesLeader) hap.medium(); else hap.light();
      } else {
        hap.light();
      }
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
  const { saveCurrentGame } = useSaveSlots();

  function handleDone() {
    // Checkpoint the slot after every tribal so a crash can't undo the vote.
    saveCurrentGame().catch(() => {});
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
           stage === 'whisper'      ? 'WHISPERS IN THE DARK'  :
           stage === 'pre_vote'     ? 'PLAY AN ADVANTAGE?'    :
           stage === 'vote'         ? 'CAST YOUR VOTE'        :
           stage === 'post_vote'    ? 'BEFORE THE VOTES...'   :
           stage === 'idol_play'    ? 'A PLAY AT THE URN'     :
           stage === 'parchment'    ? "I'LL READ THE VOTES"   :
           stage === 'revote'       ? 'WE HAVE A TIE'         :
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
              {isFireMakingCouncil ? 'PROCEED TO FIRE MAKING' : 'CONTINUE'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── WHISPER ── */}
      {stage === 'whisper' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {shareWithId !== null ? (
            <>
              <Text style={styles.prompt}>
                Tell <Text style={{ color: C.sun }}>{nameOf(shareWithId)}</Text> who you're voting for:
              </Text>
              {targets.filter(c => c.id !== shareWithId).map(c => (
                <TouchableOpacity key={c.id} style={styles.targetCard} onPress={() => confirmSharePlan(c.id)}>
                  <Portrait color={c.color} initials={initials(c.name)} size={36} />
                  <View style={styles.targetInfo}>
                    <Text style={styles.targetName}>{c.name}</Text>
                    <Text style={styles.targetJob}>{c.job}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShareWithId(null)}>
                <Text style={styles.cancelBtnLabel}>CANCEL</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.jeffLine}>
                "I see whispering. THIS is what tribal council is all about."
              </Text>
              <Text style={styles.prompt}>
                {whispersLeft > 0
                  ? `${whispersLeft} whisper${whispersLeft === 1 ? '' : 's'} left — share your plan or read the room.`
                  : 'No whispers left. Time to vote.'}
              </Text>
              {councilMembers.map(c => {
                const plan = sharedPlans[c.id];
                const knowsPlan = plan?.day === day;
                return (
                  <View key={c.id} style={styles.targetCard}>
                    <Portrait color={c.color} initials={initials(c.name)} size={36} />
                    <View style={styles.targetInfo}>
                      <Text style={styles.targetName}>{c.name}</Text>
                      <Text style={[styles.targetJob, knowsPlan && { color: C.sun }]} numberOfLines={2}>
                        {knowsPlan
                          ? `Told them: "I'm voting ${nameOf(plan.targetId)}."`
                          : askAnswers[c.id]
                            ? `"${askAnswers[c.id]}"`
                            : c.job}
                      </Text>
                    </View>
                    {whispersLeft > 0 && (
                      <View style={styles.whisperBtns}>
                        {!knowsPlan && (
                          <TouchableOpacity style={styles.whisperBtn} onPress={() => setShareWithId(c.id)}>
                            <Text style={styles.whisperBtnLabel}>TELL</Text>
                          </TouchableOpacity>
                        )}
                        {!askAnswers[c.id] && (
                          <TouchableOpacity style={styles.whisperBtn} onPress={() => askPlan(c)}>
                            <Text style={styles.whisperBtnLabel}>ASK</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
              <TouchableOpacity style={styles.ctaBtn} onPress={handleWhisperDone}>
                <Text style={styles.ctaBtnLabel}>HEAD TO THE VOTE</Text>
              </TouchableOpacity>
            </>
          )}
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

      {/* ── IDOL / ADVANTAGE MOMENT ── */}
      {stage === 'idol_play' && (
        <View style={[styles.body, styles.dramaCenter]}>
          <Text style={styles.dramaGlyph}>🏺</Text>
          {dramaLines.slice(0, dramaIdx).map((line, i) => (
            <Text key={i} style={styles.dramaLine}>{line}</Text>
          ))}
          {dramaIdx < dramaLines.length && <Text style={styles.ellipsis}>· · ·</Text>}
        </View>
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
              <VoteParchment
                key={revealIndex}
                name={currentParchment.name}
                voided={currentParchment.voided}
                decisive={revealIndex === parchmentList.length}
              />
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

      {/* ── REVOTE ── */}
      {stage === 'revote' && tribalResult?.tieIds && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={styles.jeffLine}>
            "We have a tie between {tribalResult.tieIds.map(id => nameOf(id)).join(' and ')}.
            We're going to vote again — you can only vote for one of them.
            Tied castaways don't vote."
          </Text>
          {tribalResult.tieIds.includes(PLAYER_ID) ? (
            <>
              <Text style={styles.prompt}>
                You're in the tie. Your torch is in their hands now.
              </Text>
              <TouchableOpacity style={styles.ctaBtn} onPress={() => runRevote(null)}>
                <Text style={styles.ctaBtnLabel}>FACE THE REVOTE</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.prompt}>Cast your revote:</Text>
              {tribalResult.tieIds.filter(id => id !== PLAYER_ID).map(id => {
                const c = castaways.find(x => x.id === id);
                if (!c) return null;
                return (
                  <TouchableOpacity key={id} style={styles.targetCard} onPress={() => runRevote(id)}>
                    <Portrait color={c.color} initials={initials(c.name)} size={40} />
                    <View style={styles.targetInfo}>
                      <Text style={styles.targetName}>{c.name}</Text>
                      <Text style={styles.targetJob}>{c.job}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
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
            {rocksDrawn && (
              <Text style={styles.rocksNote}>Deadlocked twice — it came down to rocks.</Text>
            )}
            <Text style={styles.snuffText}>
              {tribalResult.eliminatedId === PLAYER_ID
                ? 'The tribe has spoken. You have been voted out.'
                : `${bootName()}, the tribe has spoken.`}
            </Text>
            {tribalResult.eliminatedId !== PLAYER_ID && (() => {
              const boot = castaways.find(c => c.id === tribalResult.eliminatedId);
              if (!boot) return null;
              const goesToTwist = boot.onRedemptionIsland || edgeIds.includes(boot.id);
              return (
                <Text style={styles.finalWords}>
                  "{getFinalWords(boot.archetype, boot.id, day, goesToTwist)}"
                </Text>
              );
            })()}
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
  dramaCenter:           { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  dramaGlyph:            { fontSize: 44, marginBottom: 6 },
  dramaLine:             { fontSize: 17, fontFamily: F.display, fontWeight: '700', color: C.sun, textAlign: 'center', lineHeight: 24 },

  whisperBtns:           { gap: 6 },
  whisperBtn:            { borderWidth: 1, borderColor: '#ffffff33', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12 },
  whisperBtnLabel:       { fontSize: 10, fontFamily: F.mono, fontWeight: '700', color: C.sun, letterSpacing: 1 },
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
  finalWords:            { fontSize: 13, fontFamily: F.body, fontStyle: 'italic', color: C.inkSoft, textAlign: 'center', lineHeight: 19, marginTop: 10, paddingHorizontal: 12 },
  rocksNote:             { fontSize: 11, fontFamily: F.mono, color: C.sun, letterSpacing: 1, marginBottom: 8, textAlign: 'center' },
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
