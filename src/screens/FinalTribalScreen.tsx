import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useAudio } from '../hooks/useAudio';
import { useHaptics } from '../hooks/useHaptics';
import { useShallow } from 'zustand/react/shallow';
import type { GameParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { simulateJuryVotes } from '../utils/juryVoteSimulator';
import { initials } from '../data/roster';
import Portrait from '../components/atoms/Portrait';
import ParchmentCard from '../components/game/ParchmentCard';
import TribalCouncilScene from '../components/graphics/TribalCouncilScene';
import { getRel } from '../engine/socialEngine';
import { C } from '../tokens/colors';
import { F } from '../tokens/fonts';
import { PLAYER_ID } from '../utils/voteSimulator';

type Props = StackScreenProps<GameParamList, 'FinalTribal'>;
type Stage = 'intro' | 'questions' | 'voting' | 'reveal' | 'winner';

// ─── Jury question bank ───────────────────────────────────────────────────────

interface JuryQuestion {
  text: string;
  responses: [string, string, string];
}

const QUESTION_BANK: JuryQuestion[] = [
  {
    text: 'Was your game built on strategy or relationships — and which one actually got you here?',
    responses: [
      'Strategy. Every move I made was calculated.',
      'Relationships. You can\'t win alone.',
      'Both — you fail without either.',
    ],
  },
  {
    text: 'Name one big move you made that you\'re genuinely proud of.',
    responses: [
      'I flipped at the right moment and it changed everything.',
      'I kept my allies safe even when it cost me.',
      'I found an idol without a single clue.',
    ],
  },
  {
    text: 'You voted me out. Tell me why I should still vote for you.',
    responses: [
      'It was game, not personal — and you knew that.',
      'Because I played honestly and respected you throughout.',
      'Because I made the best move available to me.',
    ],
  },
  {
    text: 'Did you play YOUR game, or did you let someone else call the shots?',
    responses: [
      'Mine. I set the agenda at every tribal.',
      'I played smart by listening — that IS my game.',
      'I adapted. Flexibility isn\'t weakness.',
    ],
  },
  {
    text: 'Who was the biggest threat left in the game, and why didn\'t you take them out?',
    responses: [
      'I tried — my alliance wouldn\'t move.',
      'Keeping threats ahead of me was intentional.',
      'I eliminated the right people at the right times.',
    ],
  },
  {
    text: 'What surprised you most about yourself out here?',
    responses: [
      'How calm I stayed under pressure.',
      'How much I cared about the people I played with.',
      'How far I was willing to go to win.',
    ],
  },
  {
    text: 'Convince me in one sentence why you deserve the title of Sole Survivor.',
    responses: [
      'I played the most complete game out here.',
      'I outlasted 17 people without compromising who I am.',
      'Nobody gave me anything — I earned every day.',
    ],
  },
  {
    text: 'Is there anything you did out here that you\'re not proud of?',
    responses: [
      'I was harder on people than I needed to be sometimes.',
      'No — every decision served the game.',
      'Yes, but I own it. This game demands difficult choices.',
    ],
  },
  {
    text: 'Compare yourself to your fellow finalists. Why you and not them?',
    responses: [
      'I had a clearer vision and executed it.',
      'I built better relationships across the entire game.',
      'My résumé speaks for itself.',
    ],
  },
];

// Assign questions: juror at index i gets QUESTION_BANK[i % QUESTION_BANK.length]
function getQuestion(jurorIndex: number): JuryQuestion {
  return QUESTION_BANK[jurorIndex % QUESTION_BANK.length];
}

// Juror reactions to response choices (mild flavor, not mechanically meaningful)
const REACTIONS = [
  ['Noted.', 'Fair enough.', 'I can respect that.'],
  ['Interesting.', 'Okay.', 'We\'ll see.'],
  ['*nods*', 'Hmm.', 'That lands.'],
  ['Appreciated.', 'Bold.', 'That\'s honest.'],
];

function getReaction(jurorIndex: number, responseIndex: number): string {
  return REACTIONS[jurorIndex % REACTIONS.length][responseIndex];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FinalTribalScreen({ navigation }: Props) {
  const [stage, setStage]           = useState<Stage>('intro');
  const [questionIdx, setQuestionIdx] = useState(0);   // which juror is speaking
  const [responseChosen, setResponseChosen] = useState<number | null>(null);
  const [parchments, setParchments] = useState<Array<{ name: string; forId: number }>>([]);
  const [flippedCount, setFlippedCount] = useState(0);
  const [juryResult, setJuryResult] = useState<{ votes: Record<number, number>; tally: Record<number, number>; winnerId: number } | null>(null);

  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { playSfx } = useAudio('council');
  const hap = useHaptics();

  const {
    castaways, jury, playerName, day, gameSettings, relationships,
    addFeedEntry, setGameMode, setJuryVote,
  } = useGameStore(
    useShallow(s => ({
      castaways:      s.castaways,
      jury:           s.jury,
      playerName:     s.playerName,
      day:            s.day,
      gameSettings:   s.gameSettings,
      relationships:  s.relationships,
      addFeedEntry:   s.addFeedEntry,
      setGameMode:    s.setGameMode,
      setJuryVote:    s.setJuryVote,
    }))
  );

  const alive = useMemo(() => castaways.filter(c => !c.eliminated && !c.onRedemptionIsland), [castaways]);
  const finalists = alive; // NPCs in final 3 (player is always id 0 at FinalTribal)

  // Simulate jury votes once, lazily
  const computeJuryResult = useCallback(() => {
    if (juryResult) return juryResult;
    // The player's "social score" with the jury is how warmly the jurors actually
    // regarded them — averaged trust + affinity across the jury's edges to the player.
    const playerSocialScore = jury.length > 0
      ? jury.reduce((sum, j) => {
          const r = getRel(relationships, j.castawayId, PLAYER_ID);
          return sum + Math.max(0, Math.min(1, (r.trust + (r.affinity + 1) / 2) / 2));
        }, 0) / jury.length
      : 0.6;
    const result = simulateJuryVotes(jury, finalists, true, playerSocialScore, day, castaways);
    // Persist votes to store
    Object.entries(result.votes).forEach(([jurorId, finalistId]) => {
      setJuryVote(Number(jurorId), finalistId);
    });
    return result;
  }, [juryResult, jury, finalists, day, setJuryVote, relationships, castaways]);

  // Build ordered parchment list: each jury vote = one parchment, winner's votes last
  function buildParchments(result: typeof juryResult) {
    if (!result) return [];
    const list: Array<{ name: string; forId: number }> = [];
    const winnerVotes: Array<{ name: string; forId: number }> = [];

    for (const [jurorId, finalistId] of Object.entries(result.votes)) {
      const name =
        finalistId === PLAYER_ID
          ? playerName
          : (castaways.find(c => c.id === finalistId)?.name ?? '?');
      const entry = { name, forId: finalistId };
      if (finalistId === result.winnerId) {
        winnerVotes.push(entry);
      } else {
        list.push(entry);
      }
    }
    // Shuffle non-winner votes for drama, winner votes come last
    list.sort(() => Math.random() - 0.5);
    return [...list, ...winnerVotes];
  }

  // ── Stage: voting ────────────────────────────────────────────────────────────
  function handleStartReveal() {
    const result = computeJuryResult();
    setJuryResult(result);
    const list = buildParchments(result);
    setParchments(list);
    setStage('reveal');
  }

  // ── Parchment reveal timing ──────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'reveal') return;
    if (flippedCount >= parchments.length) {
      const t = setTimeout(() => setStage('winner'), 1800);
      return () => clearTimeout(t);
    }
    const delay = flippedCount === 0 ? 1000 : 1500;
    revealTimerRef.current = setTimeout(() => {
      hap.medium();
      playSfx('parchment');
      setFlippedCount(n => n + 1);
    }, delay);
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, [stage, flippedCount, parchments.length]);

  // ── Stage: winner — navigate to WinnerScreen ─────────────────────────────────
  useEffect(() => {
    if (stage !== 'winner' || !juryResult) return;
    setGameMode('ended');
    addFeedEntry({
      id:   `winner-day${day}`,
      day,
      phase: 'sleep',
      text:  juryResult.winnerId === PLAYER_ID
        ? `${playerName} wins MAROONED!`
        : `${castaways.find(c => c.id === juryResult.winnerId)?.name ?? 'Someone'} wins MAROONED.`,
      type: 'system',
    });
    const t = setTimeout(() => {
      navigation.replace('Winner', {
        winnerId: juryResult.winnerId,
        tally:    juryResult.tally,
      });
    }, 600);
    return () => clearTimeout(t);
  }, [stage, juryResult]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Current juror ─────────────────────────────────────────────────────────────
  const currentJuror = jury[questionIdx];
  const currentJurorCastaway = currentJuror
    ? castaways.find(c => c.id === currentJuror.castawayId)
    : null;
  const currentQuestion = currentJuror ? getQuestion(questionIdx) : null;

  function handleResponse(responseIdx: number) {
    setResponseChosen(responseIdx);
  }

  function handleNextJuror() {
    setResponseChosen(null);
    if (questionIdx + 1 >= jury.length) {
      setStage('voting');
      setTimeout(handleStartReveal, 1200);
    } else {
      setQuestionIdx(i => i + 1);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <TribalCouncilScene
        attendees={alive.map(c => ({ id: c.id, name: c.id === PLAYER_ID ? playerName : c.name, color: c.color }))}
        snuffedId={null}
        height={120}
      />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>FINAL TRIBAL COUNCIL · DAY {day}</Text>
        <Text style={styles.title}>
          {stage === 'intro'     ? 'THE JURY HAS THE FLOOR'  :
           stage === 'questions' ? 'JURY Q&A'                :
           stage === 'voting'    ? 'THE JURY VOTES'          :
           stage === 'reveal'    ? 'READING THE VOTES'       :
                                   'SOLE SURVIVOR'}
        </Text>
      </View>

      {/* ── INTRO ── */}
      {stage === 'intro' && (
        <View style={styles.centeredBody}>
          <Text style={styles.bodyText}>
            The jury of {jury.length} has assembled.{'\n\n'}
            {jury.length + alive.length} survivors competed. Each juror will address the {alive.length} finalists before casting their vote for the winner of MAROONED.
          </Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => setStage('questions')}>
            <Text style={styles.ctaBtnLabel}>BEGIN Q&A</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── QUESTIONS ── */}
      {stage === 'questions' && currentJuror && currentJurorCastaway && currentQuestion && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* Progress */}
          <Text style={styles.progressLabel}>
            JUROR {questionIdx + 1} OF {jury.length}
          </Text>

          {/* Juror portrait + name */}
          <View style={styles.jurorCard}>
            <Portrait
              color={currentJurorCastaway.color}
              initials={initials(currentJurorCastaway.name)}
              size={52}
            />
            <View style={styles.jurorInfo}>
              <Text style={styles.jurorName}>{currentJurorCastaway.name}</Text>
              <Text style={styles.jurorSub}>
                Eliminated Day {currentJuror.eliminatedDay} · {currentJurorCastaway.archetype}
              </Text>
            </View>
          </View>

          {/* Question */}
          <View style={styles.questionBubble}>
            <Text style={styles.questionText}>"{currentQuestion.text}"</Text>
          </View>

          {/* Response options */}
          {responseChosen === null ? (
            <View style={styles.responseList}>
              <Text style={styles.responsePrompt}>Choose your response:</Text>
              {currentQuestion.responses.map((r, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.responseOption}
                  onPress={() => handleResponse(i)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.responseText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.reactionBlock}>
              <Text style={styles.playerResponseQuote}>
                "{currentQuestion.responses[responseChosen]}"
              </Text>
              <Text style={styles.jurorReaction}>
                {currentJurorCastaway.name}: {getReaction(questionIdx, responseChosen)}
              </Text>
              <TouchableOpacity style={styles.nextBtn} onPress={handleNextJuror}>
                <Text style={styles.nextBtnLabel}>
                  {questionIdx + 1 < jury.length ? 'NEXT JUROR' : 'THE JURY VOTES'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── VOTING (brief transition) ── */}
      {stage === 'voting' && (
        <View style={styles.centeredBody}>
          <Text style={styles.bodyText}>
            The jury casts their votes…
          </Text>
        </View>
      )}

      {/* ── REVEAL ── */}
      {stage === 'reveal' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={styles.jeffLine}>
            "Once the votes are read, the decision is final…"
          </Text>

          {/* Running tally */}
          {flippedCount > 0 && juryResult && (
            <View style={styles.runningTally}>
              {Object.entries(juryResult.tally).map(([idStr, count]) => {
                const id = Number(idStr);
                const name = id === PLAYER_ID ? playerName : (castaways.find(c => c.id === id)?.name ?? '?');
                const votes = parchments.slice(0, flippedCount).filter(p => p.forId === id).length;
                return (
                  <View key={id} style={styles.tallyRow}>
                    <Text style={styles.tallyName} numberOfLines={1}>{name}</Text>
                    <Text style={styles.tallyCount}>{votes}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Parchment grid */}
          <View style={styles.parchmentGrid}>
            {parchments.map((p, i) => (
              <ParchmentCard
                key={i}
                name={p.name}
                flipped={i < flippedCount}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── WINNER (briefly shown before redirect) ── */}
      {stage === 'winner' && (
        <View style={styles.centeredBody}>
          <Text style={styles.winnerFlash}>🏆</Text>
          <Text style={styles.bodyText}>The votes have been read.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:               { flex: 1, backgroundColor: C.night },
  header:             { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#ffffff18' },
  eyebrow:            { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 4 },
  title:              { fontSize: 22, fontFamily: F.display, fontWeight: '800', color: C.bone, letterSpacing: -0.5 },
  body:               { flex: 1 },
  bodyContent:        { padding: 24, paddingBottom: 40 },
  centeredBody:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  bodyText:           { fontSize: 15, fontFamily: F.body, color: C.bone, opacity: 0.85, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  ctaBtn:             { backgroundColor: C.torch, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center' },
  ctaBtnLabel:        { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  progressLabel:      { fontSize: 10, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 2, marginBottom: 20 },
  jurorCard:          { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  jurorInfo:          { flex: 1 },
  jurorName:          { fontSize: 17, fontFamily: F.body, fontWeight: '700', color: C.bone },
  jurorSub:           { fontSize: 11, fontFamily: F.body, color: C.inkSoft, marginTop: 2 },
  questionBubble:     { backgroundColor: '#ffffff0a', borderLeftWidth: 3, borderLeftColor: C.sun, borderRadius: 8, padding: 16, marginBottom: 24 },
  questionText:       { fontSize: 14, fontFamily: F.body, color: C.bone, lineHeight: 22, fontStyle: 'italic' },
  responsePrompt:     { fontSize: 11, fontFamily: F.mono, color: C.inkSoft, letterSpacing: 1.5, marginBottom: 12 },
  responseList:       { gap: 0 },
  responseOption:     { backgroundColor: '#ffffff0d', borderWidth: 1, borderColor: '#ffffff1a', borderRadius: 10, padding: 14, marginBottom: 10 },
  responseText:       { fontSize: 13, fontFamily: F.body, color: C.bone, lineHeight: 20 },
  reactionBlock:      { gap: 16 },
  playerResponseQuote:{ fontSize: 14, fontFamily: F.body, color: C.bone, lineHeight: 22, fontStyle: 'italic' },
  jurorReaction:      { fontSize: 13, fontFamily: F.body, color: C.sun, opacity: 0.85 },
  nextBtn:            { backgroundColor: C.torch, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  nextBtnLabel:       { fontSize: 13, fontFamily: F.body, fontWeight: '800', color: C.bone, letterSpacing: 1 },
  jeffLine:           { fontSize: 14, fontFamily: F.body, color: C.inkSoft, fontStyle: 'italic', textAlign: 'center', marginBottom: 20 },
  runningTally:       { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#ffffff08', borderRadius: 10, padding: 12, marginBottom: 20 },
  tallyRow:           { alignItems: 'center', gap: 4 },
  tallyName:          { fontSize: 11, fontFamily: F.body, color: C.bone, maxWidth: 90 },
  tallyCount:         { fontSize: 22, fontFamily: F.display, fontWeight: '800', color: C.sun },
  parchmentGrid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  winnerFlash:        { fontSize: 56, marginBottom: 16 },
});
