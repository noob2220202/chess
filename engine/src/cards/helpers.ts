import type { CardId, Color, GameState, Piece, PieceType, Square } from '../types.ts';
import { file, other, parseSquare, rank, relRank, sq } from '../types.ts';
import { hasStatus, makePiece } from '../board.ts';
import type { DemoAction, TargetSpec } from '../registry.ts';

export const S = parseSquare;
export const at = (s: GameState, x: Square): Piece | null => s.board[x] ?? null;
export const homeRank = (c: Color): number => (c === 'w' ? 0 : 7);
export const CENTER_ORDER = [3, 4, 2, 5, 1, 6, 0, 7];

export const own = (types?: PieceType[], extra?: (s: GameState, o: Color, x: Square) => boolean) =>
  (s: GameState, o: Color, x: Square): boolean => {
    const p = at(s, x);
    return !!p && p.color === o && (!types || types.includes(p.type)) && (!extra || extra(s, o, x));
  };
export const enemy = (types?: PieceType[], extra?: (s: GameState, o: Color, x: Square) => boolean) =>
  (s: GameState, o: Color, x: Square): boolean => {
    const p = at(s, x);
    return !!p && p.color === other(o) && !hasStatus(s, p, 'shield') && (!types || types.includes(p.type)) && (!extra || extra(s, o, x));
  };
export const empty = (extra?: (s: GameState, o: Color, x: Square) => boolean) =>
  (s: GameState, o: Color, x: Square): boolean => !at(s, x) && (!extra || extra(s, o, x));

export const NON_KING: PieceType[] = ['P', 'N', 'B', 'R', 'Q', 'A', 'C', 'M', 'L', 'G'];
export const NON_PAWN_KING: PieceType[] = ['N', 'B', 'R', 'Q', 'A', 'C', 'M', 'L', 'G'];
export const MINORS: PieceType[] = ['N', 'B', 'L', 'G'];
export const ROOKISH: PieceType[] = ['R', 'C'];

export const target = (prompt: string, ok: (s: GameState, o: Color, x: Square, picked: Square[]) => boolean): TargetSpec => ({ prompt, ok });

export function addEffect(s: GameState, card: CardId, owner: Color, plies: number, square?: Square): void {
  s.effects.push({ card, owner, until: s.ply + plies, ...(square === undefined ? {} : { square }) });
}

export function setStatus(s: GameState, x: Square, st: 'shield' | 'frozen' | 'disarmed', plies: number): void {
  const p = at(s, x);
  if (p) p.status[st] = Math.max(p.status[st] ?? 0, s.ply + plies);
}

/** Remove a piece, recording it as lost. */
export function destroy(s: GameState, x: Square): void {
  const p = at(s, x);
  if (!p) return;
  s.lost[p.color].push(p.type);
  s.board[x] = null;
}

export function summon(s: GameState, x: Square, type: PieceType, color: Color): void {
  const p = makePiece(s, type, color, true);
  if (type === 'P' && relRank(x, color) === 1) p.moved = false;
  s.board[x] = p;
}

/** First empty square on `color`'s rank `rr` (relative), searching from the centre out. */
export function centerEmpty(s: GameState, color: Color, rr: number): Square {
  const r = color === 'w' ? rr : 7 - rr;
  for (const f of CENTER_ORDER) if (!s.board[sq(f, r)]) return sq(f, r);
  return -1;
}

export const adjacent = (a: Square, b: Square): boolean =>
  a !== b && Math.abs(file(a) - file(b)) <= 1 && Math.abs(rank(a) - rank(b)) <= 1;
export const orthAdjacent = (a: Square, b: Square): boolean =>
  Math.abs(file(a) - file(b)) + Math.abs(rank(a) - rank(b)) === 1;
export const chebyshev = (a: Square, b: Square): number => Math.max(Math.abs(file(a) - file(b)), Math.abs(rank(a) - rank(b)));

/** Demo goal helpers. */
export const moved = (from: string, to: string) => (_s: GameState, a: DemoAction): boolean =>
  a.kind === 'move' && a.move.from === S(from) && a.move.to === S(to);
export const usedCard = (id: CardId) => (_s: GameState, a: DemoAction): boolean => a.kind === 'card' && a.id === id;
export const pieceAt = (x: string, type: PieceType, color: Color = 'w') => (s: GameState): boolean => {
  const p = at(s, S(x));
  return !!p && p.type === type && p.color === color;
};
