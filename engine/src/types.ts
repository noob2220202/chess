export type Color = 'w' | 'b';
/**
 * P N B R Q K: standard pieces.
 * A Archbishop (bishop + knight), C Chancellor (rook + knight), M Amazon (queen + knight),
 * L Camel (3,1 leaper), G Guard (moves like a king but is not royal).
 */
export type PieceType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | 'A' | 'C' | 'M' | 'L' | 'G';
/** 0..63, index = rank * 8 + file. Rank 0 is White's home rank. */
export type Square = number;

export type StatusId = 'shield' | 'frozen' | 'disarmed';

export interface Piece {
  id: number;
  type: PieceType;
  color: Color;
  moved: boolean;
  /** Status -> ply at which it expires (exclusive). */
  status: Partial<Record<StatusId, number>>;
}

export interface Move {
  from: Square;
  to: Square;
  promotion?: PieceType;
  castle?: 'K' | 'Q';
  enPassant?: boolean;
}

export type CardId = string;

export interface PlayerCards {
  /** Owned cards. Passives stay forever; actives leave when used. */
  hand: CardId[];
  used: CardId[];
  /** Cards currently offered for a pick. */
  offer: CardId[] | null;
  /** Own moves made so far. */
  moves: number;
  draftsTaken: number;
  /** Per-card counters (e.g. one-shot passives). */
  flags: Record<string, number>;
}

/** A timed/global effect created by an active card. */
export interface Effect {
  card: CardId;
  owner: Color;
  /** Ply at which the effect expires (exclusive). PERMANENT for no expiry. */
  until: number;
  square?: Square;
}

export type Winner = Color | 'draw' | null;

export interface GameState {
  board: (Piece | null)[];
  turn: Color;
  ply: number;
  epSquare: Square | null;
  cards: Record<Color, PlayerCards>;
  effects: Effect[];
  /** Pieces each colour has lost, most recent last. */
  lost: Record<Color, PieceType[]>;
  /** Draft plan per colour: one array of offered card ids per draft round. Hidden from clients. */
  draftPlan: Record<Color, CardId[][]>;
  /** Ply on which an active card was last played (one card per turn). */
  cardPly: number;
  /** Plies since the last capture or pawn move. */
  quiet: number;
  /** Position repetition counts. */
  seen: Record<string, number>;
  nextId: number;
  winner: Winner;
  endReason: EndReason | null;
  /** Sandbox (tutorial/demo) mode: the side to move never changes. */
  sandbox: boolean;
}

export type EndReason =
  | 'king-captured' | 'checkmate' | 'stalemate' | 'no-moves' | 'card-win' | 'ply-limit' | 'quiet-limit' | 'overtime' | 'repetition'
  | 'resign' | 'timeout' | 'abandon' | 'agreement';

export const PERMANENT = 1e9;
export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const file = (s: Square): number => s & 7;
export const rank = (s: Square): number => s >> 3;
export const sq = (f: number, r: number): Square => r * 8 + f;
export const onBoard = (f: number, r: number): boolean => f >= 0 && f < 8 && r >= 0 && r < 8;
/** Rank counted from `color`'s own side (0 = home rank). */
export const relRank = (s: Square, color: Color): number => (color === 'w' ? rank(s) : 7 - rank(s));
export const forward = (color: Color): number => (color === 'w' ? 1 : -1);

export function squareName(s: Square): string {
  return 'abcdefgh'[file(s)]! + String(rank(s) + 1);
}
export function parseSquare(n: string): Square {
  return sq(n.charCodeAt(0) - 97, Number(n[1]) - 1);
}
