// Throwaway verification harness: runs many NPC-only post-merge "seasons"
// through the pure engines (vote sim + advantage resolver + social ticks) and
// reports idol-play rates, wasted idols, tie/revote/rocks frequency, and any
// crashes. Run with: npx tsx scripts/headlessSeason.ts
import { buildRandomCastaways } from '../src/data/roster';
import { initRelationships, simulateMorningTick, simulateEveningTick, getRel } from '../src/engine/socialEngine';
import { simulateTribalVotes } from '../src/engine/voteEngine';
import { resolveTribal } from '../src/utils/advantageResolver';
import { tallyVotes, breakTie } from '../src/utils/voteSimulator';
import { seeded } from '../src/utils/seeded';
import type { Castaway } from '../src/data/roster';
import type { Alliance, Relationship } from '../src/store/slices/socialSlice';

const SEASONS = 50;
const CAST = 10;

let tribals = 0;
let idolPlays = 0;
let wastedIdols = 0; // idol played while zero real votes against the actor
let ties = 0;
let revotesSettled = 0;
let rocks = 0;
let crashes = 0;

for (let season = 0; season < SEASONS; season++) {
  try {
    const gameSeed = 1000 + season * 17;
    const cast: Castaway[] = buildRandomCastaways(Array(CAST).fill('tabu'), gameSeed);
    // NPC-only: reindex ids to 1..N so PLAYER_ID(0) is absent.
    cast.forEach((c, i) => { c.id = i + 1; });
    // Seed some idols and extra votes.
    const rng = seeded(gameSeed);
    for (const c of cast) {
      if (rng() < 0.3) { c.advantages.push('hii'); c.hasIdol = true; }
      if (rng() < 0.15) c.advantages.push('extra_vote');
    }
    let relationships: Record<string, Relationship> = initRelationships(cast, gameSeed);
    let alliances: Alliance[] = [];
    let day = 1;

    while (cast.filter(c => !c.eliminated).length > 3) {
      const alive = cast.filter(c => !c.eliminated);

      // Social ticks to keep relationships/alliances moving.
      for (const tick of [simulateMorningTick, simulateEveningTick]) {
        const res = tick({
          day, phase: 'day', castaways: alive, relationships, alliances,
          locations: [], gameSeed, playerTribeId: 'tabu', playerInCamp: false,
        });
        for (const { a, b, d } of res.relDeltas) {
          const key = `${a}>${b}`;
          const cur = relationships[key] ?? { affinity: 0, trust: 0.4, grudge: 0, lastEventDay: null };
          relationships[key] = {
            affinity: Math.max(-1, Math.min(1, cur.affinity + (d.affinity ?? 0))),
            trust: Math.max(0, Math.min(1, cur.trust + (d.trust ?? 0))),
            grudge: Math.max(0, Math.min(1, cur.grudge + (d.grudge ?? 0))),
            lastEventDay: d.lastEventDay ?? cur.lastEventDay,
          };
        }
        for (const op of res.allianceOps) {
          if (op.kind === 'create') alliances.push(op.alliance);
          if (op.kind === 'setTarget') alliances = alliances.map(a => a.id === op.id ? { ...a, targetId: op.targetId } : a);
          if (op.kind === 'removeMember') {
            alliances = alliances
              .map(a => a.id === op.id ? { ...a, memberIds: a.memberIds.filter(m => m !== op.memberId) } : a)
              .filter(a => a.memberIds.length >= 2);
          }
          if (op.kind === 'addMember') {
            alliances = alliances.map(a =>
              a.id === op.id && !a.memberIds.includes(op.memberId)
                ? { ...a, memberIds: [...a.memberIds, op.memberId] } : a);
          }
        }
      }

      // Random immunity winner.
      const immune = alive[Math.floor(seeded(gameSeed + day)() * alive.length)];
      const eligible = alive.filter(c => c.id !== immune.id).map(c => c.id);

      const ctx = simulateTribalVotes({
        voters: alive,
        eligibleTargets: eligible,
        playerVote: null,
        relationships, alliances, castaways: cast, day, gameSeed,
        scopeTag: 'merge',
      });
      tribals++;

      for (const play of ctx.npcPlays) {
        if (play.type === 'hii') {
          idolPlays++;
          const against = ctx.votes[play.actorId]?.length ?? 0;
          if (against === 0) wastedIdols++;
        }
      }
      // Consume played advantages.
      for (const c of ctx.consumed) {
        const holder = cast.find(x => x.id === c.holderId);
        if (holder) {
          const idx = holder.advantages.indexOf(c.type);
          if (idx !== -1) holder.advantages.splice(idx, 1);
          holder.hasIdol = holder.advantages.includes('hii');
        }
      }

      const result = resolveTribal(ctx.votes, ctx.npcPlays, cast, alive.length, day, { breakTies: false });
      let eliminatedId = result.eliminatedId;
      if (result.tieIds && result.tieIds.length > 1) {
        ties++;
        const tieIds = result.tieIds;
        const rctx = simulateTribalVotes({
          voters: alive.filter(c => !tieIds.includes(c.id)),
          eligibleTargets: tieIds,
          playerVote: null,
          relationships, alliances, castaways: cast, day, gameSeed,
          scopeTag: 'revote',
        });
        const tally = tallyVotes(rctx.votes);
        const castMap = new Map(cast.map(c => [c.id, c]));
        const trng = seeded(day * 7773);
        if (tally.length === 0) { eliminatedId = breakTie(tieIds, castMap, trng); rocks++; }
        else {
          const top = tally[0].count;
          const tops = tally.filter(t => t.count === top).map(t => t.id);
          if (tops.length === 1) { eliminatedId = tops[0]; revotesSettled++; }
          else { eliminatedId = breakTie(tops, castMap, trng); rocks++; }
        }
      }

      const boot = cast.find(c => c.id === eliminatedId);
      if (!boot) throw new Error(`season ${season} day ${day}: eliminated id ${eliminatedId} not found`);
      if (boot.eliminated) throw new Error(`season ${season} day ${day}: double-eliminated ${eliminatedId}`);
      boot.eliminated = true;
      boot.eliminatedDay = day;
      day++;
      if (day > 60) throw new Error(`season ${season}: did not converge`);
    }
  } catch (e) {
    crashes++;
    console.error(`CRASH season ${season}:`, e);
  }
}

console.log(`seasons:        ${SEASONS} (crashes: ${crashes})`);
console.log(`tribals:        ${tribals}`);
console.log(`idol plays:     ${idolPlays} (${(idolPlays / tribals * 100).toFixed(1)}% of tribals)`);
console.log(`wasted idols:   ${wastedIdols} (${idolPlays ? (wastedIdols / idolPlays * 100).toFixed(1) : 0}% of plays)`);
console.log(`ties → revote:  ${ties} (settled by revote: ${revotesSettled}, by rocks: ${rocks})`);
