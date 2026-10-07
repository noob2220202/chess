import type { CardId, Color, GameState, Move, Square } from '@engine';
import { captureSquare, cloneState, inCheck, notate, type Notation } from '@engine';

export interface HistEntry {
  kind: 'start' | 'move' | 'card' | 'pick';
  color: Color | null;
  /** State after this entry. */
  state: GameState;
  last: { from: Square; to: Square } | null;
  note?: Notation;
  card?: CardId;
  captured?: boolean;
  /** The move gave check. */
  check?: boolean;
  /** The move itself (for review). */
  move?: Move;
}

function withCheck(n: Notation, after: GameState): Notation {
  if (after.endReason === 'checkmate') return { ...n, text: n.text + '#' };
  return !after.winner && inCheck(after) ? { ...n, text: n.text + '+' } : n;
}

export const startEntry = (s: GameState): HistEntry => ({ kind: 'start', color: null, state: s, last: null });

/** Build the entry for a move, given the state before it and the state after it. */
export function moveEntry(before: GameState, m: Move, after: GameState): HistEntry {
  return {
    kind: 'move', color: before.turn, state: after, last: { from: m.from, to: m.to },
    note: withCheck(notate(before, m), after), captured: captureSquare(before, m) >= 0, check: !after.winner && inCheck(after), move: m,
  };
}
export function cardEntry(color: Color, id: CardId, after: GameState, last: HistEntry['last']): HistEntry {
  return { kind: 'card', color, card: id, state: after, last };
}
export function pickEntry(color: Color, id: CardId, after: GameState, last: HistEntry['last']): HistEntry {
  return { kind: 'pick', color, card: id, state: after, last };
}

/** Apply a mutation to a copy of the latest state and append the resulting entry. */
export function extend(h: HistEntry[], make: (s: GameState, prev: HistEntry) => HistEntry | ((s: GameState) => HistEntry)): HistEntry[] {
  const prev = h[h.length - 1]!;
  const s = cloneState(prev.state);
  const r = make(s, prev);
  return [...h, typeof r === 'function' ? r(s) : r];
}

export type Act =
  | { t: 'pick'; c: Color; id: CardId }
  | { t: 'card'; c: Color; id: CardId; sel: Square[] }
  | { t: 'move'; c: Color; move: Move };

/** Apply an action (throws if illegal) and return the extended history. */
export function applyAct(h: HistEntry[], a: Act, engine: {
  pickCard: (s: GameState, c: Color, id: CardId) => void;
  playCard: (s: GameState, c: Color, id: CardId, sel: Square[]) => void;
  applyMove: (s: GameState, m: Move) => void;
}): HistEntry[] {
  const prev = h[h.length - 1]!;
  const s = cloneState(prev.state);
  if (a.t === 'pick') { engine.pickCard(s, a.c, a.id); return [...h, pickEntry(a.c, a.id, s, prev.last)]; }
  if (a.t === 'card') { engine.playCard(s, a.c, a.id, a.sel); return [...h, cardEntry(a.c, a.id, s, prev.last)]; }
  engine.applyMove(s, a.move);
  return [...h, moveEntry(prev.state, a.move, s)];
}
