import type { ArchetypeKey } from './archetypes';
import type { StatKey } from './statMeta';

export interface ConvoTopic {
  id: string;
  label: string;
  ask: string;
  hint: Partial<Record<StatKey, number>>;
  reply: (archetype: ArchetypeKey, trustLevel: number, strengthLevel: number) => string;
  reveals: string[];
}

export const CONVO_TOPICS: ConvoTopic[] = [
  {
    id: 't_alliance',
    label: 'Float an alliance',
    ask: "You and me — final five, locked in. We have the numbers if we move on Dion next.",
    hint: { trust: +0.08, loyalty: +0.12, suspicion: +0.04, threat: +0.02 },
    reply: (arch) =>
      arch === 'loyalist' || arch === 'underdog'
        ? "I'm in. I don't flip on people who come to me first."
        : arch === 'schemer' || arch === 'mastermind'
        ? '...Maybe. Who else are you talking to?'
        : "Final five is a long way off. I'll think about it.",
    reveals: ['archetype', 'loyalty'],
  },
  {
    id: 't_intel',
    label: "Ask what they've heard",
    ask: "Be straight with me — what are people saying about my name?",
    hint: { trust: +0.04, loyalty: +0.02, mental: +0.05, social: +0.03 },
    reply: (_arch, trust) =>
      trust > 0.55
        ? "Honestly? Vega thinks you're running things. Mira just nods at whatever Vega says."
        : "I haven't heard anything. People don't really talk to me about strategy.",
    reveals: ['social', 'trust'],
  },
  {
    id: 't_camp',
    label: 'Help with camp work',
    ask: "I'll grab firewood with you. We can talk on the walk.",
    hint: { trust: +0.06, loyalty: +0.04, mood: +0.05 },
    reply: () => "Yeah. I appreciate that — most people here don't pull weight.",
    reveals: ['mood'],
  },
  {
    id: 't_doubt',
    label: 'Plant doubt about someone',
    ask: "Watch Imara. She's collecting people. By merge she'll have eight.",
    hint: { trust: -0.04, suspicion: +0.10, loyalty: -0.02, mental: +0.04, threat: +0.05 },
    reply: (arch) =>
      arch === 'pessimist' || arch === 'schemer'
        ? "I've been watching her. You're right — she runs the boat."
        : "I don't know. Imara hasn't given me a reason yet.",
    reveals: ['suspicion', 'mental'],
  },
  {
    id: 't_compete',
    label: 'Test their challenge ability',
    ask: "You looked tired at the last challenge. You good for the next one?",
    hint: { strength: +0.08, mental: +0.05, threat: +0.03 },
    reply: (_arch, _trust, strength) =>
      strength > 0.6
        ? "I'll be fine. I've done worse on less sleep."
        : "I'll get through it. Endurance isn't my thing — puzzles are.",
    reveals: ['strength', 'mental'],
  },
];

export function openerLine(archetype: ArchetypeKey): string {
  if (archetype === 'lonewolf' || archetype === 'pessimist') return 'What do you want?';
  if (archetype === 'optimist' || archetype === 'charmer') return "Hey! Sit down. I was hoping you'd find me.";
  if (archetype === 'schemer' || archetype === 'mastermind') return "Make it quick. Mira's circling and I don't want her seeing us together.";
  return 'You needed to talk?';
}