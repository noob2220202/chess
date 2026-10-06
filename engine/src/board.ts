import type { Color, GameState, Piece, PieceType, PlayerCards, Square } from './types.ts';
import { sq } from './types.ts';

export const PIECE_VALUE: Readonly<Record<PieceType, number>> = {
  P: 1, N: 3, B: 3.2, R: 5, Q: 9, K: 0, A: 7, C: 8, M: 12, L: 2.5, G: 3,
};
export const PIECE_NAME: Readonly<Record<PieceType, string>> = {
  P: '폰', N: '나이트', B: '비숍', R: '룩', Q: '퀸', K: '킹',
  A: '대주교', C: '재상', M: '아마존', L: '낙타', G: '근위병',
};
export const isMinor = (t: PieceType): boolean => t === 'N' || t === 'B' || t === 'L' || t === 'G';

export function emptyCards(): PlayerCards {
  return { hand: [], used: [], offer: null, moves: 0, draftsTaken: 0, flags: {} };
}

export function blankState(): GameState {
  return {
    board: new Array(64).fill(null), turn: 'w', ply: 0, epSquare: null,
    cards: { w: emptyCards(), b: emptyCards() }, effects: [], lost: { w: [], b: [] },
    draftPlan: { w: [], b: [] }, cardPly: -1, quiet: 0, seen: {}, nextId: 1,
    winner: null, endReason: null, sandbox: false,
  };
}

export function makePiece(s: GameState, type: PieceType, color: Color, moved = true): Piece {
  return { id: s.nextId++, type, color, moved, status: {} };
}

export function put(s: GameState, at: Square, type: PieceType, color: Color, moved = true): Piece {
  const p = makePiece(s, type, color, moved);
  s.board[at] = p;
  return p;
}

const LETTERS = 'PNBRQKACMLG';

/** Board from a FEN-like placement ("rnbqkbnr/pppppppp/8/..."), with fairy letters A C M L G. */
export function fromPlacement(placement: string, turn: Color = 'w'): GameState {
  const s = blankState();
  s.turn = turn;
  const rows = placement.split('/');
  if (rows.length !== 8) throw new Error('placement needs 8 ranks');
  rows.forEach((row, i) => {
    const r = 7 - i;
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += Number(ch); continue; }
      const up = ch.toUpperCase();
      if (!LETTERS.includes(up)) throw new Error(`bad piece letter ${ch}`);
      const color: Color = ch === up ? 'w' : 'b';
      const type = up as PieceType;
      const at = sq(f, r);
      const home = color === 'w' ? 0 : 7;
      const unmoved = (type === 'P' && r === (color === 'w' ? 1 : 6))
        || (type === 'K' && at === sq(4, home))
        || (type === 'R' && (at === sq(0, home) || at === sq(7, home)));
      put(s, at, type, color, !unmoved);
      f++;
    }
    if (f !== 8) throw new Error(`rank ${r + 1} has ${f} files`);
  });
  return s;
}

export const START_PLACEMENT = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

export function toPlacement(s: GameState): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = s.board[sq(f, r)];
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p.color === 'w' ? p.type : p.type.toLowerCase();
    }
    rows.push(row + (empty ? empty : ''));
  }
  return rows.join('/');
}

/** Fast deep copy (state is plain JSON data). */
export function cloneState(s: GameState): GameState {
  return {
    ...s,
    board: s.board.map((p) => (p ? { ...p, status: { ...p.status } } : null)),
    cards: { w: cloneCards(s.cards.w), b: cloneCards(s.cards.b) },
    effects: s.effects.map((e) => ({ ...e })),
    lost: { w: [...s.lost.w], b: [...s.lost.b] },
    draftPlan: { w: s.draftPlan.w.map((r) => [...r]), b: s.draftPlan.b.map((r) => [...r]) },
    seen: { ...s.seen },
  };
}
const cloneCards = (c: PlayerCards): PlayerCards => ({
  ...c, hand: [...c.hand], used: [...c.used], offer: c.offer ? [...c.offer] : null, flags: { ...c.flags },
});

export function findKing(s: GameState, color: Color): Square {
  for (let i = 0; i < 64; i++) {
    const p = s.board[i];
    if (p && p.type === 'K' && p.color === color) return i;
  }
  return -1;
}

export const hasStatus = (s: GameState, p: Piece, st: 'shield' | 'frozen' | 'disarmed'): boolean =>
  (p.status[st] ?? 0) > s.ply;

export function positionKey(s: GameState): string {
  return toPlacement(s) + ' ' + s.turn;
}
