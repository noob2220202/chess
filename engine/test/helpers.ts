import type { CardId, GameState, Move, Square } from '../src/index.ts';
import { CARDS, cardReady, cloneState, demoAct, legalMoves, parseSquare, targetOptions } from '../src/index.ts';
import type { DemoAction } from '../src/index.ts';

export const P = parseSquare;
export const mv = (from: string, to: string, extra: Partial<Move> = {}): Move => ({ from: P(from), to: P(to), ...extra });

export function selections(s: GameState, id: CardId, picked: Square[] = []): Square[][] {
  const n = CARDS[id]!.targets?.length ?? 0;
  if (picked.length === n) return [picked];
  return targetOptions(s, s.turn, id, picked).flatMap((x) => selections(s, id, [...picked, x]));
}

type Act = { move: Move } | { card: CardId; sel: Square[] };
export function actions(s: GameState): Act[] {
  const out: Act[] = legalMoves(s).map((move) => ({ move }));
  for (const id of s.cards[s.turn].hand) {
    if (cardReady(s, s.turn, id)) for (const sel of selections(s, id)) out.push({ card: id, sel });
  }
  return out;
}

/** Is a demo goal reachable within `depth` learner actions? */
export function solveDemo(s: GameState, goal: (s: GameState, a: DemoAction) => boolean, depth = 2): Act[] | null {
  if (depth === 0) return null;
  for (const a of actions(s)) {
    const c = cloneState(s);
    let rec: DemoAction;
    try { rec = demoAct(c, a); } catch { continue; }
    if (goal(c, rec)) return [a];
    if (c.winner) continue;
    const rest = solveDemo(c, goal, depth - 1);
    if (rest) return [a, ...rest];
  }
  return null;
}
