// Generates the intel an NPC gives the player when asked about someone. Honest
// NPCs (and ones who trust the player) tell the truth; others may fabricate a
// plausible lie. The lie/truth flag is recorded but never shown to the player —
// they only see a confidence level derived from the source's reputation.

import type { Castaway } from '../data/roster';
import type { Alliance, Relationship } from '../store/slices/socialSlice';
import type { IntelEntry, IntelClaim, IntelConfidence } from '../store/slices/intelSlice';
import { PLAYER_ID } from '../utils/voteSimulator';
import { getRel } from './socialEngine';
import { pickFrom as pickRng } from './rng';

function firstName(c: Castaway): string { return c.name.split(' ')[0]; }

function confidenceFor(honesty: number, trustOfPlayer: number): IntelConfidence {
  const score = honesty * 0.6 + trustOfPlayer * 0.4;
  if (score > 0.6) return 'high';
  if (score > 0.4) return 'medium';
  return 'low';
}

export interface QueryInput {
  source: Castaway;
  subject: Castaway;
  castaways: Castaway[];      // active roster (for plausible fabrication)
  relationships: Record<string, Relationship>;
  alliances: Alliance[];
  trustOfPlayer: number;     // source → player trust
  day: number;
  rng: () => number;
}

export function answerQuery(input: QueryInput): IntelEntry {
  const { source, subject, castaways, relationships, alliances, trustOfPlayer, day, rng } = input;

  const willLie = rng() > source.personality.honesty * (0.5 + trustOfPlayer * 0.5);
  const confidence = confidenceFor(source.personality.honesty, trustOfPlayer);

  // Find the real picture about the subject.
  const subjectAlliance = alliances.find(a => a.memberIds.includes(subject.id));
  const others = castaways.filter(c => c.id !== subject.id && c.id !== PLAYER_ID);

  let claim: IntelClaim;
  let text: string;

  if (!willLie) {
    if (subjectAlliance && subjectAlliance.targetId != null) {
      claim = { type: 'vote-target', voterId: subject.id, targetId: subjectAlliance.targetId };
      const tgt = castaways.find(c => c.id === subjectAlliance.targetId);
      text = `${firstName(source)} says ${firstName(subject)} is writing down ${tgt ? firstName(tgt) : 'someone'}.`;
    } else if (subjectAlliance) {
      claim = { type: 'alliance-exists', memberIds: subjectAlliance.memberIds };
      const memberNames = subjectAlliance.memberIds
        .filter(id => id !== PLAYER_ID)
        .map(id => firstName(castaways.find(c => c.id === id) ?? subject));
      text = `${firstName(source)} says ${firstName(subject)} is tight with ${memberNames.join(' and ')}.`;
    } else if (subject.advantages.length > 0) {
      claim = { type: 'has-advantage', holderId: subject.id, advantage: subject.advantages[0] };
      text = `${firstName(source)} thinks ${firstName(subject)} is holding something.`;
    } else {
      const close = others
        .map(o => ({ o, a: getRel(relationships, subject.id, o.id).affinity }))
        .sort((x, y) => y.a - x.a)[0];
      if (close) {
        claim = { type: 'relationship', a: subject.id, b: close.o.id, tone: close.a > 0 ? 'close' : 'feuding' };
        text = `${firstName(source)} says ${firstName(subject)} has been close with ${firstName(close.o)}.`;
      } else {
        claim = { type: 'relationship', a: subject.id, b: subject.id, tone: 'close' };
        text = `${firstName(source)} doesn't have much on ${firstName(subject)}.`;
      }
    }
  } else {
    // Fabricate something plausible but false.
    const fakeTarget = others.length > 0 ? pickRng(others, rng) : subject;
    const dice = rng();
    if (dice < 0.5) {
      claim = { type: 'vote-target', voterId: subject.id, targetId: fakeTarget.id };
      text = `${firstName(source)} says ${firstName(subject)} is gunning for ${firstName(fakeTarget)}.`;
    } else {
      const fakeMembers = [subject.id, fakeTarget.id];
      claim = { type: 'alliance-exists', memberIds: fakeMembers };
      text = `${firstName(source)} swears ${firstName(subject)} and ${firstName(fakeTarget)} are working together.`;
    }
  }

  return {
    id: `intel-told-${source.id}-${subject.id}-d${day}-${Math.floor(rng() * 1e6)}`,
    day,
    kind: 'told',
    sourceId: source.id,
    subjectIds: [subject.id],
    claim,
    text,
    truthful: !willLie,
    confidence,
  };
}
