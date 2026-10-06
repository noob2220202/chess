import type { Color, GameState, Move, Piece, PieceType, Square } from './types.ts';
import { file, forward, onBoard, rank, relRank, sq } from './types.ts';
import { hasStatus } from './board.ts';
import { sources } from './registry.ts';

type Delta = readonly [number, number];
export const KNIGHT: readonly Delta[] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
export const CAMEL: readonly Delta[] = [[1, 3], [3, 1], [3, -1], [1, -3], [-1, -3], [-3, -1], [-3, 1], [-1, 3]];
export const KING: readonly Delta[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
export const ORTHO: readonly Delta[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DIAG: readonly Delta[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const PROMOS: readonly PieceType[] = ['Q', 'R', 'B', 'N'];

/** May `color` land on `to` ignoring capture protection (empty or enemy-occupied)? */
export const landable = (s: GameState, color: Color, to: Square): boolean => {
  const t = s.board[to];
  return !t || t.color !== color;
};

export function leaps(s: GameState, from: Square, color: Color, deltas: readonly Delta[]): Move[] {
  const out: Move[] = [];
  for (const [df, dr] of deltas) {
    const f = file(from) + df, r = rank(from) + dr;
    if (onBoard(f, r) && landable(s, color, sq(f, r))) out.push({ from, to: sq(f, r) });
  }
  return out;
}

/**
 * Sliding moves. `passThrough` decides whether a piece on the way is transparent
 * (used by cards that let pieces pass through friendly units).
 */
export function slides(
  s: GameState, from: Square, color: Color, dirs: readonly Delta[],
  passThrough?: (p: Piece, at: Square, passed: number) => boolean,
): Move[] {
  const out: Move[] = [];
  for (const [df, dr] of dirs) {
    let f = file(from) + df, r = rank(from) + dr, passed = 0;
    while (onBoard(f, r)) {
      const to = sq(f, r);
      const t = s.board[to];
      if (!t) out.push({ from, to });
      else if (passThrough && passThrough(t, to, passed)) passed++;
      else {
        if (t.color !== color) out.push({ from, to });
        break;
      }
      f += df;
      r += dr;
    }
  }
  return out;
}

export function pawnPromotes(color: Color, to: Square): boolean {
  return relRank(to, color) === 7;
}

/** Push a pawn move, expanding promotions. */
export function pawnMove(out: Move[], from: Square, to: Square, color: Color, extra: Partial<Move> = {}): void {
  if (pawnPromotes(color, to)) for (const promotion of PROMOS) out.push({ from, to, promotion, ...extra });
  else out.push({ from, to, ...extra });
}

function pawnMoves(s: GameState, from: Square, p: Piece): Move[] {
  const out: Move[] = [];
  const dir = forward(p.color);
  const f = file(from), r = rank(from), r1 = r + dir;
  if (r1 < 0 || r1 > 7) return out;
  if (!s.board[sq(f, r1)]) {
    pawnMove(out, from, sq(f, r1), p.color);
    const r2 = r + 2 * dir;
    if (relRank(from, p.color) === 1 && !s.board[sq(f, r2)]) out.push({ from, to: sq(f, r2) });
  }
  for (const df of [-1, 1]) {
    const nf = f + df;
    if (nf < 0 || nf > 7) continue;
    const to = sq(nf, r1);
    const t = s.board[to];
    if (t && t.color !== p.color) pawnMove(out, from, to, p.color);
    else if (!t && s.epSquare === to) {
      const victim = s.board[sq(nf, r)];
      if (victim && victim.type === 'P' && victim.color !== p.color) out.push({ from, to, enPassant: true });
    }
  }
  return out;
}

function castles(s: GameState, from: Square, p: Piece): Move[] {
  const out: Move[] = [];
  const home = p.color === 'w' ? 4 : 60;
  if (p.moved || from !== home) return out;
  const rookOk = (at: Square) => {
    const x = s.board[at];
    return !!x && x.type === 'R' && x.color === p.color && !x.moved;
  };
  if (rookOk(home + 3) && !s.board[home + 1] && !s.board[home + 2]) out.push({ from, to: home + 2, castle: 'K' });
  if (rookOk(home - 4) && !s.board[home - 1] && !s.board[home - 2] && !s.board[home - 3]) out.push({ from, to: home - 2, castle: 'Q' });
  return out;
}

/** Base moves for a piece type (no card effects, no capture protection). */
export function baseMoves(s: GameState, from: Square, p: Piece): Move[] {
  const c = p.color;
  switch (p.type) {
    case 'P': return pawnMoves(s, from, p);
    case 'N': return leaps(s, from, c, KNIGHT);
    case 'B': return slides(s, from, c, DIAG);
    case 'R': return slides(s, from, c, ORTHO);
    case 'Q': return slides(s, from, c, [...ORTHO, ...DIAG]);
    case 'K': return [...leaps(s, from, c, KING), ...castles(s, from, p)];
    case 'A': return [...slides(s, from, c, DIAG), ...leaps(s, from, c, KNIGHT)];
    case 'C': return [...slides(s, from, c, ORTHO), ...leaps(s, from, c, KNIGHT)];
    case 'M': return [...slides(s, from, c, [...ORTHO, ...DIAG]), ...leaps(s, from, c, KNIGHT)];
    case 'L': return leaps(s, from, c, CAMEL);
    case 'G': return leaps(s, from, c, KING);
  }
}

/** Square of the piece a move would capture (handles en passant), or -1. */
export function captureSquare(s: GameState, m: Move): Square {
  if (m.enPassant) return sq(file(m.to), rank(m.from));
  const t = s.board[m.to];
  return t ? m.to : -1;
}

/** Can the piece on `from` capture the piece on `target` right now? */
export function canCapture(s: GameState, from: Square, target: Square): boolean {
  const a = s.board[from], t = s.board[target];
  if (!a || !t || a.color === t.color) return false;
  if (hasStatus(s, a, 'disarmed') || hasStatus(s, t, 'shield')) return false;
  for (const { def, src } of sources(s)) {
    if (src.owner === t.color && def.protects?.(s, from, target, src)) return false;
  }
  return true;
}

const moveKey = (m: Move) => `${m.from}.${m.to}.${m.promotion ?? ''}.${m.castle ?? ''}.${m.enPassant ? 1 : 0}`;

/** Moves for the piece on `from`, after all card effects. */
export function pieceMoves(s: GameState, from: Square): Move[] {
  const p = s.board[from];
  if (!p || hasStatus(s, p, 'frozen')) return [];
  const all = sources(s);
  const raw = baseMoves(s, from, p);
  for (const { def, src } of all) {
    if (src.owner === p.color && def.extraMoves) raw.push(...def.extraMoves(s, from, p, src));
  }
  const seen = new Set<string>();
  const out: Move[] = [];
  for (const m of raw) {
    const k = moveKey(m);
    if (seen.has(k)) continue;
    seen.add(k);
    const own = s.board[m.to];
    if (own && own.color === p.color) continue;
    const cap = captureSquare(s, m);
    if (cap >= 0 && !canCapture(s, from, cap)) continue;
    if (!all.every(({ def, src }) => !def.allowMove || def.allowMove(s, m, p.color, src))) continue;
    out.push(m);
  }
  return out;
}

/** Every move available to `color`. There is no check rule: capturing the king wins. */
export function legalMoves(s: GameState, color: Color = s.turn): Move[] {
  let out: Move[] = [];
  for (let i = 0; i < 64; i++) {
    const p = s.board[i];
    if (p && p.color === color) out.push(...pieceMoves(s, i));
  }
  for (const { def, src } of sources(s)) if (def.filterMoves) out = def.filterMoves(s, color, out, src);
  return out;
}

export const sameMove = (a: Move, b: Move): boolean => moveKey(a) === moveKey(b);

/** Squares attacked (capturable) by `color`. Used by bots and UI hints. */
export function attacks(s: GameState, color: Color): Set<Square> {
  const out = new Set<Square>();
  for (const m of legalMoves(s, color)) {
    const c = captureSquare(s, m);
    if (c >= 0) out.add(c);
  }
  return out;
}
