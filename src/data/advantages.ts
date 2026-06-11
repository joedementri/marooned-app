export type AdvantageType =
  | 'hii'
  | 'extra_vote'
  | 'steal_a_vote'
  | 'safety_without_power'
  | 'idol_nullifier';

export interface AdvantageDef {
  type: AdvantageType;
  name: string;
  desc: string;
  expiresAtFinal: number; // final N remaining (e.g. 6 means expires at final 6)
}

export const ADVANTAGE_DEFS: Record<AdvantageType, AdvantageDef> = {
  hii: {
    type: 'hii',
    name: 'Hidden Immunity Idol',
    desc: 'Negate all votes cast against you at tribal council.',
    expiresAtFinal: 6,
  },
  extra_vote: {
    type: 'extra_vote',
    name: 'Extra Vote',
    desc: 'Cast two votes at a single tribal council.',
    expiresAtFinal: 5,
  },
  steal_a_vote: {
    type: 'steal_a_vote',
    name: 'Steal-A-Vote',
    desc: 'Force a castaway to give you their vote, leaving them unable to vote.',
    expiresAtFinal: 6,
  },
  safety_without_power: {
    type: 'safety_without_power',
    name: 'Safety Without Power',
    desc: 'Leave tribal council before the vote — you are immune but cannot vote.',
    expiresAtFinal: 8,
  },
  idol_nullifier: {
    type: 'idol_nullifier',
    name: 'Idol Nullifier',
    desc: "Cancel a specific castaway's Hidden Immunity Idol play.",
    expiresAtFinal: 5,
  },
};

// Resolution order at tribal council
export const ADVANTAGE_RESOLUTION_ORDER: AdvantageType[] = [
  'safety_without_power',
  'steal_a_vote',
  'extra_vote',
  'idol_nullifier',
  'hii',
];