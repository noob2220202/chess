import type { Color, GameState, Move, Piece, Square } from './types.ts';
import { file, other, rank, sq } from './types.ts';
import { BISHOP_DIRS, KING_DELTAS, KNIGHT_DELTAS, ROOK_DIRS, isShielded, leapMoves, slideMoves } from './board.ts';
import { CARDS } from './cards.ts';

const PROMO = ['Q', 'R', 'B', 'N'] as const;

function pushPawnMove(out: Move[], from: Square, to: Square, color: Color, extra: Partial<Move> = {}): void {
  const last = color === 'w' ? 7 : 0;
  if (rank(to) === last) for (const promotion of PROMO) out.push({ from, to, promotion, ...extra });
  else out.push({ from, to, ...extra });
}

function pawnMoves(s: GameState, from: Square, p: Piece): Move[] {
  const out: Move[] = [];
  const dir = p.color === 'w' ? 1 : -1;
  const startRank = p.color === 'w' ? 1 : 6;
  const f = file(from), r = rank(from);
  const r1 = r + dir;
  if (r1 < 0 || r1 > 7) return out;
  if (!s.board[sq(f, r1)]) {
    pushPawnMove(out, from, sq(f, r1), p.color);
    if (r === startRank && !s.board[sq(f, r + 2 * dir)]) out.push({ from, to: sq(f, r + 2 * dir) });
  }
  for (const df of [-1, 1]) {
    const nf = f + df;
    if (nf < 0 || nf > 7) continue;
    const to = sq(nf, r1);
    const t = s.board[to];
    if (t && t.color !== p.color && !isShielded(s, t)) pushPawnMove(out, from, to, p.color);
    else if (!t && s.epSquare === to) {
      const victim = s.board[sq(nf, r)];
      if (victim && victim.type === 'P' && victim.color !== p.color && !isShielded(s, victim)) {
        out.push({ from, to, enPassant: true });
      }
    }
  }
  return out;
}

function castleMoves(s: GameState, from: Square, p: Piece): Move[] {
  const out: Move[] = [];
  if (p.moved) return out;
  const home = p.color === 'w' ? 4 : 60;
  if (from !== home) return out;
  const rookAt = (sqr: Square) => {
    const x = s.board[sqr];
    return !!x && x.type === 'R' && x.color === p.color && !x.moved;
  };
  if (rookAt(home + 3) && !s.board[home + 1] && !s.board[home + 2]) out.push({ from, to: home + 2, castle: 'K' });
  if (rookAt(home - 4) && !s.board[home - 1] && !s.board[home - 2] && !s.board[home - 3]) out.push({ from, to: home - 2, castle: 'Q' });
  return out;
}

export function pieceMoves(s: GameState, from: Square): Move[] {
  const p = s.board[from];
  if (!p) return [];
  let moves: Move[];
  switch (p.type) {
    case 'P': moves = pawnMoves(s, from, p); break;
    case 'N': moves = leapMoves(s, from, p.color, KNIGHT_DELTAS); break;
    case 'B': moves = slideMoves(s, from, p.color, BISHOP_DIRS); break;
    case 'R': moves = slideMoves(s, from, p.color, ROOK_DIRS); break;
    case 'Q': moves = slideMoves(s, from, p.color, [...ROOK_DIRS, ...BISHOP_DIRS]); break;
    case 'K': moves = [...leapMoves(s, from, p.color, KING_DELTAS), ...castleMoves(s, from, p)]; break;
  }
  for (const id of s.cards[p.color].hand) {
    const extra = CARDS[id]?.extraMoves?.(s, from, p);
    if (extra) moves.push(...extra);
  }
  // Extra moves may duplicate base moves (and promotion variants are distinct), so dedupe.
  const seen = new Set<string>();
  return moves.filter((m) => {
    const k = `${m.from}-${m.to}-${m.promotion ?? ''}-${m.castle ?? ''}-${m.enPassant ? 1 : 0}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * All moves available to `color`. There is no check rule in this game: the king can be captured,
 * and capturing it wins. So generation is purely pseudo-legal.
 */
export function legalMoves(s: GameState, color: Color = s.turn): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < 64; i++) {
    const p = s.board[i];
    if (p && p.color === color) out.push(...pieceMoves(s, i));
  }
  return out;
}

