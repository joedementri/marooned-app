import { useEffect, useRef, useState } from 'react';
import { fireReducer, initFireState, type FireState } from './fireMachine';
import { mulberry32 } from '../../engine/rng';

// Drives a FireState for an AI competitor: deliberate actions on a skill-paced
// cadence, plus seeded fumbles (failed strikes, ember deaths). Shares the same
// reducer the player uses, so the AI plays a real fire, not a timer.
export function useFireAi(skill: number, seed: number, running: boolean): FireState {
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
      ref.current = fireReducer(ref.current, { kind: 'tick', dt: STEP });
      acc += STEP;
      if (acc >= actEvery) {
        acc = 0;
        ref.current = aiAct(ref.current, skill, rng);
      }
      setState(ref.current);
      if (ref.current.stage === 'done') clearInterval(interval);
    }, STEP);

    return () => clearInterval(interval);
  }, [running, seed, skill]);

  return state;
}

function aiAct(s: FireState, skill: number, rng: () => number): FireState {
  switch (s.stage) {
    case 'nest':        return fireReducer(s, { kind: 'placePiece' });
    case 'shave':       return fireReducer(s, { kind: 'shave', quality: 0.4 + skill * 0.5 });
    case 'strike': {
      const q = rng() < 0.3 + skill * 0.55 ? 0.7 : 0.2; // fumble more when unskilled
      return fireReducer(s, { kind: 'strike', quality: q });
    }
    case 'ember':       return fireReducer(s, { kind: 'blow', strength: 0.4 + skill * 0.6 });
    case 'smallSticks': return fireReducer(s, { kind: 'addSmall' });
    case 'largeSticks': return fireReducer(s, { kind: 'holdLarge', dt: 240 });
    case 'ropeBurn':    return s.flameHeight < 82 ? fireReducer(s, { kind: 'fan' }) : s;
    default:            return s;
  }
}
