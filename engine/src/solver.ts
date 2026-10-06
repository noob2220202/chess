import type { CardId, GameState, Move, Square } from './types.ts';
import { cloneState } from './board.ts';
import type { DemoAction } from './registry.ts';
import { CARDS } from './registry.ts';
import { legalMoves } from './rules.ts';
import { cardReady, demoAct, targetOptions } from './game.ts';

export type LearnerAction = { move: Move } | { card: CardId; sel: Square[] };

function selections(s: GameState, id: CardId, picked: Square[] = []): Square[][] {
  const n = CARDS[id]!.targets?.length ?? 0;
  if (picked.length === n) return [picked];
  return targetOptions(s, s.turn, id, picked).flatMap((x) => selections(s, id, [...picked, x]));
}

/** Every learner action available in a sandbox: moves and complete card plays. */
export function learnerActions(s: GameState): LearnerAction[] {
  const out: LearnerAction[] = legalMoves(s).map((move) => ({ move }));
  for (const id of s.cards[s.turn].hand) {
    if (cardReady(s, s.turn, id)) for (const sel of selections(s, id)) out.push({ card: id, sel });
  }
  return out;
}

/**
 * Shortest sequence (up to `depth` actions) that reaches a demo goal.
 * Used by tests and by the tutorial to highlight what to do next.
 */
export function solveDemo(s: GameState, goal: (s: GameState, a: DemoAction) => boolean, depth = 2): LearnerAction[] | null {
  for (let d = 1; d <= depth; d++) {
    const r = search(s, goal, d);
    if (r) return r;
  }
  return null;
}

function search(s: GameState, goal: (s: GameState, a: DemoAction) => boolean, depth: number): LearnerAction[] | null {
  if (depth === 0) return null;
  for (const a of learnerActions(s)) {
    const c = cloneState(s);
    let rec: DemoAction;
    try { rec = demoAct(c, a); } catch { continue; }
    if (goal(c, rec)) return [a];
    if (c.winner || depth === 1) continue;
    const rest = search(c, goal, depth - 1);
    if (rest) return [a, ...rest];
  }
  return null;
}
