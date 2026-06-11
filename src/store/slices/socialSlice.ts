import type { StateCreator } from 'zustand';
import type { GameStore } from '../gameStore';
import type { Castaway } from '../../data/roster';
import { PLAYER_ID } from '../../utils/voteSimulator';
import {
  relKey,
  defaultRel,
  initRelationships,
  type RelDelta,
  type AllianceOp,
} from '../../engine/socialEngine';

// A directed relationship edge `a → b`: how castaway a feels about b.
export interface Relationship {
  affinity: number;       // -1..1 (dislike → like)
  trust: number;          // 0..1
  grudge: number;         // 0..1 (recent betrayals)
  lastEventDay: number | null;
}

export interface Alliance {
  id: string;
  name: string;
  memberIds: number[];      // may include PLAYER_ID (0)
  strength: number;         // 0..1 cohesion
  createdDay: number;
  targetId: number | null;  // current consensus boot
  knownToPlayer: boolean;   // membership or earned intel
}

export interface SocialSlice {
  relationships: Record<string, Relationship>; // directed, key `${a}>${b}`
  alliances: Alliance[];
  initSocial(castaways: Castaway[], gameSeed: number): void;
  applyRelDeltas(deltas: RelDelta[]): void;
  applyAllianceOps(ops: AllianceOp[]): void;
  upsertAlliance(a: Alliance): void;
  dissolveAlliance(id: string): void;
  setAllianceTarget(id: string, targetId: number | null): void;
  revealAllianceToPlayer(id: string): void;
  syncPlayerFacingStats(): void;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

export const createSocialSlice: StateCreator<GameStore, [], [], SocialSlice> = (set, get) => ({
  relationships: {},
  alliances: [],

  initSocial(castaways, gameSeed) {
    set({ relationships: initRelationships(castaways, gameSeed), alliances: [] });
  },

  applyRelDeltas(deltas) {
    if (deltas.length === 0) return;
    set(state => {
      const rels = { ...state.relationships };
      for (const { a, b, d } of deltas) {
        const key = relKey(a, b);
        const cur = rels[key] ?? defaultRel();
        rels[key] = {
          affinity: clamp(cur.affinity + (d.affinity ?? 0), -1, 1),
          trust: clamp(cur.trust + (d.trust ?? 0), 0, 1),
          grudge: clamp(cur.grudge + (d.grudge ?? 0), 0, 1),
          lastEventDay: d.lastEventDay ?? cur.lastEventDay,
        };
      }
      return { relationships: rels };
    });
  },

  applyAllianceOps(ops) {
    if (ops.length === 0) return;
    set(state => {
      let alliances = [...state.alliances];
      for (const op of ops) {
        switch (op.kind) {
          case 'create':
            if (!alliances.some(a => a.id === op.alliance.id)) alliances.push(op.alliance);
            break;
          case 'dissolve':
            alliances = alliances.filter(a => a.id !== op.id);
            break;
          case 'setTarget':
            alliances = alliances.map(a => a.id === op.id ? { ...a, targetId: op.targetId } : a);
            break;
          case 'strength':
            alliances = alliances
              .map(a => a.id === op.id ? { ...a, strength: clamp(a.strength + op.delta, 0, 1) } : a)
              .filter(a => a.strength > 0.05 || a.memberIds.includes(PLAYER_ID));
            break;
          case 'addMember':
            alliances = alliances.map(a =>
              a.id === op.id && !a.memberIds.includes(op.memberId)
                ? { ...a, memberIds: [...a.memberIds, op.memberId] }
                : a
            );
            break;
          case 'removeMember':
            alliances = alliances
              .map(a => a.id === op.id ? { ...a, memberIds: a.memberIds.filter(m => m !== op.memberId) } : a)
              .filter(a => a.memberIds.length >= 2);
            break;
        }
      }
      return { alliances };
    });
  },

  upsertAlliance(a) {
    set(state => {
      const exists = state.alliances.some(x => x.id === a.id);
      return {
        alliances: exists
          ? state.alliances.map(x => x.id === a.id ? a : x)
          : [...state.alliances, a],
      };
    });
  },

  dissolveAlliance(id) {
    set(state => ({ alliances: state.alliances.filter(a => a.id !== id) }));
  },

  setAllianceTarget(id, targetId) {
    set(state => ({ alliances: state.alliances.map(a => a.id === id ? { ...a, targetId } : a) }));
  },

  revealAllianceToPlayer(id) {
    set(state => ({ alliances: state.alliances.map(a => a.id === id ? { ...a, knownToPlayer: true } : a) }));
  },

  // Project each NPC's edge toward the player (npc → player) into that NPC's
  // player-facing `stats` so existing UI (StatBar, Roster, jury sim) keeps working.
  syncPlayerFacingStats() {
    set(state => {
      const rels = state.relationships;
      return {
        castaways: state.castaways.map(c => {
          if (c.id === PLAYER_ID) return c;
          const r = rels[relKey(c.id, PLAYER_ID)];
          if (!r) return c;
          // affinity -1..1 → loyalty 0..1; trust direct; grudge → suspicion.
          const trust = clamp(r.trust, 0, 1);
          const loyalty = clamp((r.affinity + 1) / 2, 0, 1);
          const suspicion = clamp(r.grudge * 0.7 + (1 - r.trust) * 0.3, 0, 1);
          return { ...c, stats: { ...c.stats, trust, loyalty, suspicion } };
        }),
      };
    });
  },
});
