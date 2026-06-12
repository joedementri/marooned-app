import type { GameSettings } from '../store/gameStore';

// Rough season length for progress display: one boot per day from the full
// cast down to the finale, plus a buffer for twist re-entries (Redemption
// Island / Edge of Extinction return a player, extending the season).
export function estimateSeasonDays(s: GameSettings): number {
  const boots = Math.max(1, s.totalCastaways - s.finaleSize);
  return boots + 1 + (s.twist !== 'none' ? 2 : 0);
}
