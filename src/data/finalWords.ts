import type { ArchetypeKey } from './archetypes';
import { seeded } from '../utils/seeded';

// Parting words a castaway gives as their torch is snuffed, flavored by
// archetype. Twist variants are used when the boot isn't final (Redemption
// Island / Edge of Extinction).
const FINAL_WORDS: Record<ArchetypeKey, string[]> = {
  schemer: [
    "I played too hard, too fast. Respect to whoever sniffed me out.",
    "Every move was a gamble. Tonight the house won.",
  ],
  strategist: [
    "The math was right. The people weren't. That's Survivor.",
    "I saw it coming three votes ago — I just couldn't stop it.",
  ],
  provider: [
    "I kept the fire going and the bellies full. No regrets.",
    "Take care of the camp. Somebody has to.",
  ],
  charmer: [
    "You can't smile your way past every vote, apparently.",
    "I love every one of them. Even the ones who wrote my name.",
  ],
  mediator: [
    "I tried to keep the peace. The peace didn't keep me.",
    "No hard feelings. That's the game, and it's a beautiful one.",
  ],
  wildcard: [
    "Honestly? Even I didn't see that coming.",
    "Chaos giveth, chaos taketh away.",
  ],
  loyalist: [
    "I never wrote an ally's name down. I leave with that.",
    "My word was good. I hope they remember that at the end.",
  ],
  threat: [
    "Took all of them to get me out. I'll take that as a compliment.",
    "You don't carry a target this big without falling eventually.",
  ],
  mastermind: [
    "One blind spot. That's all it takes.",
    "The plan was perfect. The players weren't.",
  ],
  floater: [
    "I floated as far as the current would take me.",
    "Nobody saw me coming — turns out nobody had to.",
  ],
  optimist: [
    "What an adventure. I'd do every minute again.",
    "I'm leaving with a full heart. Go win it, guys.",
  ],
  lonewolf: [
    "I played alone. I lose alone. It's cleaner that way.",
    "No alliance to mourn me. That's how I wanted it.",
  ],
  pessimist: [
    "Called it. I literally called it on day one.",
    "The only thing I won out here was being right about this.",
  ],
  underdog: [
    "Nobody expected me to last this long. I did.",
    "Counted out from the start — I still scared them in the end.",
  ],
  athlete: [
    "I left everything on those challenges. No gas left, no regrets.",
    "They couldn't beat me on the course, so they beat me here.",
  ],
  veteran: [
    "Seen a hundred blindsides. Still didn't see mine.",
    "The game always evolves. Tonight it outran me.",
  ],
};

const TWIST_WORDS = [
  "This isn't over. Keep my torch warm.",
  "You voted me out — you didn't vote me gone.",
  "See you all soon. Count on it.",
];

export function getFinalWords(
  archetype: ArchetypeKey,
  castawayId: number,
  day: number,
  goesToTwist: boolean,
): string {
  const rng = seeded(castawayId * 7919 + day * 271);
  if (goesToTwist) return TWIST_WORDS[Math.floor(rng() * TWIST_WORDS.length)];
  const lines = FINAL_WORDS[archetype] ?? ["The tribe has spoken."];
  return lines[Math.floor(rng() * lines.length)];
}
