import type { Color, GameState, Move, Piece, PieceType, Square } from './types.ts';
import { file, onBoard, rank, sq } from './types.ts';

export const KNIGHT_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
export const KING_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];
export const ROOK_DIRS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const BISHOP_DIRS: ReadonlyArray<readonly [number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export const isShielded = (s: GameState, p: Piece): boolean => p.shieldUntil !== undefined && s.ply < p.shieldUntil;

/** A piece may land on `to` if empty, or if it holds a capturable enemy. */
export function canLand(s: GameState, color: Color, to: Square): boolean {
  const t = s.board[to];
  return t === null || t === undefined || (t.color !== color && t.type !== undefined && !isShielded(s, t));
}

/** Single-step (leaper) moves from a delta table. */
export function leapMoves(s: GameState, from: Square, color: Color, deltas: ReadonlyArray<readonly [number, number]>): Move[] {
  const out: Move[] = [];
  for (const [df, dr] of deltas) {
    const f = file(from) + df, r = rank(from) + dr;
    if (!onBoard(f, r)) continue;
    const to = sq(f, r);
    if (canLand(s, color, to)) out.push({ from, to });
  }
  return out;
}

/** Sliding moves along directions, stopping at the first piece. */
export function slideMoves(s: GameState, from: Square, color: Color, dirs: ReadonlyArray<readonly [number, number]>): Move[] {
  const out: Move[] = [];
  for (const [df, dr] of dirs) {
    let f = file(from) + df, r = rank(from) + dr;
    while (onBoard(f, r)) {
      const to = sq(f, r);
      const t = s.board[to];
      if (!t) out.push({ from, to });
      else {
        if (canLand(s, color, to)) out.push({ from, to });
        break;
      }
      f += df;
      r += dr;
    }
  }
  return out;
}

export function emptyCards() {
  return { hand: [], used: [], offer: null, moves: 0, draftsTaken: 0 };
}

export function newGame(): GameState {
  const board: (Piece | null)[] = new Array(64).fill(null);
  const back: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let f = 0; f < 8; f++) {
    board[sq(f, 0)] = { type: back[f]!, color: 'w', moved: false };
    board[sq(f, 1)] = { type: 'P', color: 'w', moved: false };
    board[sq(f, 6)] = { type: 'P', color: 'b', moved: false };
    board[sq(f, 7)] = { type: back[f]!, color: 'b', moved: false };
  }
  return {
    board, turn: 'w', ply: 0, epSquare: null,
    cards: { w: emptyCards(), b: emptyCards() },
    winner: null, endReason: null,
  };
}

export const cloneState = (s: GameState): GameState => structuredClone(s);

export function findKing(s: GameState, color: Color): Square | -1 {
  for (let i = 0; i < 64; i++) {
    const p = s.board[i];
    if (p && p.type === 'K' && p.color === color) return i;
  }
  return -1;
}

export function toAscii(s: GameState): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let line = '';
    for (let f = 0; f < 8; f++) {
      const p = s.board[sq(f, r)];
      line += p ? (p.color === 'w' ? p.type : p.type.toLowerCase()) : '.';
    }
    rows.push(line);
  }
  return rows.join('\n');
}
