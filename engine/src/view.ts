import type { Color, GameState } from './types.ts';
import { cloneState } from './board.ts';

/**
 * State as sent to a client. Hides the draft plan and the opponent's current offer
 * (an empty array signals "opponent is drafting").
 */
export function publicView(s: GameState, viewer: Color | null): GameState {
  const v = cloneState(s);
  v.draftPlan = { w: [], b: [] };
  v.seen = {};
  for (const c of ['w', 'b'] as const) {
    if (c !== viewer && v.cards[c].offer) v.cards[c].offer = [];
  }
  return v;
}
