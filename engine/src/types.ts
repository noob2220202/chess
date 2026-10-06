export type Color = 'w' | 'b';
export type PieceType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';
/** 0..63, index = rank * 8 + file. Rank 0 is White's home rank. */
export type Square = number;

export interface Piece {
  type: PieceType;
  color: Color;
  moved: boolean;
  /** Piece cannot be captured while state.ply < shieldUntil. */
  shieldUntil?: number;
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
  /** Passives stay here forever; actives stay until used. */
  hand: CardId[];
  used: CardId[];
  /** Cards offered and waiting for a pick (draft). */
  offer: CardId[] | null;
  moves: number;
  /** How many of the scheduled drafts this player has already taken. */
  draftsTaken: number;
}

export type Winner = Color | 'draw' | null;

export interface GameState {
  board: (Piece | null)[];
  turn: Color;
  ply: number;
  epSquare: Square | null;
  cards: Record<Color, PlayerCards>;
  winner: Winner;
  endReason: string | null;
}

export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const file = (s: Square): number => s & 7;
export const rank = (s: Square): number => s >> 3;
export const sq = (f: number, r: number): Square => r * 8 + f;
export const onBoard = (f: number, r: number): boolean => f >= 0 && f < 8 && r >= 0 && r < 8;

export function squareName(s: Square): string {
  return 'abcdefgh'[file(s)]! + String(rank(s) + 1);
}
export function parseSquare(n: string): Square {
  return sq(n.charCodeAt(0) - 97, Number(n[1]) - 1);
}
