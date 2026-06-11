export type StatKey = 'trust' | 'loyalty' | 'suspicion' | 'mood' | 'strength' | 'mental' | 'social' | 'threat';

export interface StatMeta {
  label: string;
  hint: string;
  polarity: 'pos' | 'neg';
  color: string;
}

export const STAT_META: Record<StatKey, StatMeta> = {
  trust:     { label: 'Trust',     hint: 'Trusts you',         polarity: 'pos', color: '#2d8a5a' },
  loyalty:   { label: 'Loyalty',   hint: 'Loyalty to you',     polarity: 'pos', color: '#1d7a8c' },
  suspicion: { label: 'Suspicion', hint: 'Suspects you',       polarity: 'neg', color: '#c9491f' },
  mood:      { label: 'Mood',      hint: 'Camp morale',        polarity: 'pos', color: '#f4a83a' },
  strength:  { label: 'Strength',  hint: 'Physical',           polarity: 'pos', color: '#7c2d2d' },
  mental:    { label: 'Mental',    hint: 'Puzzle / strategy',  polarity: 'pos', color: '#6b4a8a' },
  social:    { label: 'Social',    hint: 'Charisma / network', polarity: 'pos', color: '#b03b5c' },
  threat:    { label: 'Threat',    hint: 'Others see them as', polarity: 'neg', color: '#0e1428' },
};