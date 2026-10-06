import type { GameState, Move, PieceType } from './types.ts';
import { file, rank, squareName } from './types.ts';
import { captureSquare, legalMoves } from './rules.ts';

export interface Notation {
  /** Moving piece, for figurine rendering (null for castling). */
  piece: PieceType | null;
  /** Text after the piece symbol, e.g. "xe5", "d4", "O-O", "=Q". */
  text: string;
}

/** Short algebraic notation for a move in `s` (call before applying it). */
export function notate(s: GameState, m: Move): Notation {
  const p = s.board[m.from];
  if (!p) return { piece: null, text: '?' };
  if (m.castle) return { piece: null, text: m.castle === 'K' ? 'O-O' : 'O-O-O' };
  const cs = captureSquare(s, m);
  const victim = cs >= 0 ? s.board[cs] : null;
  const x = victim ? 'x' : '';
  const to = squareName(m.to);
  const promo = m.promotion ? `=${m.promotion}` : '';
  const mate = victim?.type === 'K' ? '#' : '';
  if (p.type === 'P') {
    const pre = victim ? 'abcdefgh'[file(m.from)]! : '';
    return { piece: 'P', text: `${pre}${x}${to}${promo}${mate}` };
  }
  // Disambiguate between same-type pieces that can reach the same square.
  const rivals = legalMoves(s, p.color).filter((o) => o.to === m.to && o.from !== m.from && s.board[o.from]?.type === p.type);
  let dis = '';
  if (rivals.length) {
    const sameFile = rivals.some((o) => file(o.from) === file(m.from));
    const sameRank = rivals.some((o) => rank(o.from) === rank(m.from));
    dis = !sameFile ? 'abcdefgh'[file(m.from)]! : !sameRank ? String(rank(m.from) + 1) : squareName(m.from);
  }
  return { piece: p.type, text: `${dis}${x}${to}${promo}${mate}` };
}
