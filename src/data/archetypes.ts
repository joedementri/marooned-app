export type ArchetypeKey =
  | 'schemer' | 'loyalist' | 'provider' | 'athlete' | 'wildcard'
  | 'strategist' | 'mediator' | 'charmer' | 'lonewolf' | 'threat'
  | 'floater' | 'underdog' | 'pessimist' | 'optimist' | 'veteran'
  | 'mastermind';

export interface Archetype {
  label: string;
  glyph: string;
  desc: string;
}

export const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
  schemer:    { label: 'Schemer',    glyph: '◆', desc: 'Plays multiple sides. Will lie if useful.' },
  loyalist:   { label: 'Loyalist',   glyph: '◉', desc: 'Sticks with first ally. Slow to flip.' },
  provider:   { label: 'Provider',   glyph: '✦', desc: 'Earns trust through camp work.' },
  athlete:    { label: 'Athlete',    glyph: '▲', desc: 'Wins challenges. Often a target.' },
  wildcard:   { label: 'Wildcard',   glyph: '✕', desc: 'Unpredictable. Decisions feel emotional.' },
  strategist: { label: 'Strategist', glyph: '■', desc: 'Reads the board. Plays long-term.' },
  mediator:   { label: 'Mediator',   glyph: '◐', desc: 'Smooths conflict. Rarely targeted.' },
  charmer:    { label: 'Charmer',    glyph: '✺', desc: 'Builds bonds fast. Trust runs shallow.' },
  lonewolf:   { label: 'Lone Wolf',  glyph: '◇', desc: 'Avoids alliances. Hard to read.' },
  threat:     { label: 'Threat',     glyph: '▼', desc: 'Strong on all axes. Painted target.' },
  floater:    { label: 'Floater',    glyph: '○', desc: 'Drifts to the majority. Low threat.' },
  underdog:   { label: 'Underdog',   glyph: '△', desc: 'Plays scrappy. Hungry to prove.' },
  pessimist:  { label: 'Pessimist',  glyph: '▽', desc: 'Suspicious by default.' },
  optimist:   { label: 'Optimist',   glyph: '☼', desc: 'Trusts easily. Boosts camp morale.' },
  veteran:    { label: 'Veteran',    glyph: '✜', desc: 'Older. Wisdom over physicality.' },
  mastermind: { label: 'Mastermind', glyph: '✦', desc: 'Runs hidden alliances.' },
};