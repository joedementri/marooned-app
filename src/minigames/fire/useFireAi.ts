import { useEffect, useRef, useState } from 'react';
import { fireReducer, initFireState, type FireState, type FireTuning } from './fireMachine';
import { mulberry32 } from '../../engine/rng';

// Drives a FireState for an AI competitor: deliberate actions on a skill-paced
// cadence, plus seeded fumbles (failed strikes, hesitation that lets the decay
// win). Shares the same reducer the player uses, so the AI plays a real fire —
// including flame-outs and full restarts — not a timer.
export function useFireAi(skill: number, seed: number, running: boolean, tuning: FireTuning): FireState {
  const [state, setState] = useState<FireState>(initFireState);
  const ref = useRef<FireState>(initFireState());

  useEffect(() => {
    if (!running) return;
    ref.current = initFireState();
    const rng = mulberry32((seed >>> 0) + 99);
    const actEvery = Math.max(180, 620 - skill * 360); // stronger → acts sooner
    let acc = 0;
    const STEP = 120;

    const interval = setInterval(() => {
      ref.current = fireReducer(ref.current, { kind: 'tick', dt: STEP }, tuning);
      acc += STEP;
      if (acc >= actEvery) {
        acc = 0;
        ref.current = aiAct(ref.current, skill, rng, actEvery, tuning);
      }
      setState(ref.current);
      if (ref.current.stage === 'done') clearInterval(interval);
    }, STEP);

    return () => clearInterval(interval);
  }, [running, seed, skill]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

function aiAct(s: FireState, skill: number, rng: () => number, actEvery: number, t: FireTuning): FireState {
  // Hesitation: unskilled hands fumble and let the decay win sometimes. Never
  // during the ember — everyone blows for their life there (and it keeps a
  // low-skill AI from soft-locking in a restart loop).
  if (s.stage !== 'ember' && rng() < Math.max(0.05, 0.25 - 0.2 * skill)) return s;

  switch (s.stage) {
    case 'nest':        return fireReducer(s, { kind: 'placePiece' }, t);
    case 'shave':       return fireReducer(s, { kind: 'shaveHold', dt: actEvery }, t);
    case 'strike': {
      const q = Math.min(1, 0.25 + 0.5 * skill + 0.45 * rng());
      return fireReducer(s, { kind: 'strike', quality: q }, t);
    }
    case 'ember': {
      const strength = 0.4 + skill * 0.6;
      let next = fireReducer(s, { kind: 'blow', strength }, t);
      // Panic blowing when the ember is fading.
      if (next.stage === 'ember' && next.emberHealth < 50) {
        next = fireReducer(next, { kind: 'blow', strength }, t);
      }
      return next;
    }
    case 'smallSticks': return fireReducer(s, { kind: 'addSmall' }, t);
    case 'largeSticks': return fireReducer(s, { kind: 'holdLarge', dt: actEvery * 0.8 }, t);
    case 'ropeBurn':    return s.flameHeight < 82 ? fireReducer(s, { kind: 'fan' }, t) : s;
    default:            return s;
  }
}
