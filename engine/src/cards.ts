import type { Color, GameState, Move, Piece, Square } from './types.ts';
import { file, other, rank, sq } from './types.ts';
import { KNIGHT_DELTAS, isShielded, leapMoves } from './board.ts';

export type CardCategory = 'OPENING' | 'MIDDLE' | 'END' | 'PIECE' | 'RULE';

export interface CardDef {
  id: string;
  name: string;
  kind: 'passive' | 'active';
  category: CardCategory;
  /** Initial design estimate 0.5..5. To be replaced by simulation-derived values. */
  stars: number;
  description: string;
  /** Passive: extra pseudo-legal moves for a piece owned by the card holder. */
  extraMoves?: (s: GameState, from: Square, piece: Piece) => Move[];
  /** Active: is the selection valid right now? Does not consume the turn. */
  validate?: (s: GameState, owner: Color, sel: Square[]) => boolean;
  activate?: (s: GameState, owner: Color, sel: Square[]) => void;
  /** Active: candidate selections (used by bots/simulation and UI hints). */
  options?: (s: GameState, owner: Color) => Square[][];
}

const squaresWhere = (s: GameState, f: (p: Piece, i: Square) => boolean): Square[] => {
  const out: Square[] = [];
  s.board.forEach((p, i) => { if (p && f(p, i)) out.push(i); });
  return out;
};

const knightKing: CardDef = {
  id: 'knight-king', name: '기사왕', kind: 'passive', category: 'MIDDLE', stars: 3.5,
  description: '아군 킹이 나이트처럼도 움직일 수 있습니다.',
  extraMoves: (s, from, p) => (p.type === 'K' ? leapMoves(s, from, p.color, KNIGHT_DELTAS) : []),
};

const sprint: CardDef = {
  id: 'sprint', name: '질주', kind: 'passive', category: 'OPENING', stars: 3,
  description: '아군 폰이 어느 위치에서든 두 칸 전진할 수 있습니다.',
  extraMoves: (s, from, p) => {
    if (p.type !== 'P') return [];
    const dir = p.color === 'w' ? 1 : -1;
    const startRank = p.color === 'w' ? 1 : 6;
    const r = rank(from);
    if (r === startRank) return []; // base rules already cover it
    const r2 = r + 2 * dir;
    if (r2 < 0 || r2 > 7) return [];
    const mid = sq(file(from), r + dir), to = sq(file(from), r2);
    return !s.board[mid] && !s.board[to] ? [{ from, to }] : [];
  },
};

const conscript: CardDef = {
  id: 'conscript', name: '징병', kind: 'active', category: 'PIECE', stars: 2.5,
  description: '아군 폰 하나를 나이트로 변경합니다. 턴을 소모하지 않습니다.',
  validate: (s, o, [a]) => a !== undefined && s.board[a]?.color === o && s.board[a]?.type === 'P',
  activate: (s, _o, [a]) => { s.board[a!]!.type = 'N'; },
  options: (s, o) => squaresWhere(s, (p) => p.color === o && p.type === 'P').map((x) => [x]),
};

const snipe: CardDef = {
  id: 'snipe', name: '저격', kind: 'active', category: 'MIDDLE', stars: 3,
  description: '상대 폰 하나를 제거합니다(보호 중인 기물은 불가). 턴을 소모하지 않습니다.',
  validate: (s, o, [a]) => {
    const p = a === undefined ? null : s.board[a];
    return !!p && p.color === other(o) && p.type === 'P' && !isShielded(s, p);
  },
  activate: (s, _o, [a]) => { s.board[a!] = null; },
  options: (s, o) => squaresWhere(s, (p) => p.color === other(o) && p.type === 'P' && !isShielded(s, p)).map((x) => [x]),
};

const aegis: CardDef = {
  id: 'aegis', name: '방패', kind: 'active', category: 'END', stars: 3,
  description: '아군 킹이 아닌 기물 하나가 6수(양측 합산) 동안 잡히지 않습니다.',
  validate: (s, o, [a]) => a !== undefined && s.board[a]?.color === o && s.board[a]?.type !== 'K',
  activate: (s, _o, [a]) => { s.board[a!]!.shieldUntil = s.ply + 6; },
  options: (s, o) => squaresWhere(s, (p) => p.color === o && p.type !== 'K').map((x) => [x]),
};

export const CARDS: Readonly<Record<string, CardDef>> = Object.fromEntries(
  [knightKing, sprint, conscript, snipe, aegis].map((c) => [c.id, c]),
);

/** Draft weight: stronger (higher-star) cards appear less often. Mirrors the reference site's 9..4 scale. */
export const draftWeight = (stars: number): number => (stars <= 2.5 ? 9 : Math.max(4, 9 - (stars - 2.5) * 2));
