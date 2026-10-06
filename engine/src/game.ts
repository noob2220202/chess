import type { CardId, Color, GameState, Move, Square } from './types.ts';
import { file, other, rank, sq } from "./types.ts";
import { findKing } from './board.ts';
import { CARDS, draftWeight } from './cards.ts';
import { legalMoves } from './moves.ts';
import type { Rng } from './rng.ts';
import { weightedPick } from './rng.ts';

/** Own-move counts at which a draft is offered (0 = before your first move). */
export const DRAFT_AT: readonly number[] = [0, 10, 20];
export const OFFER_SIZE = 3;
export const PLY_LIMIT = 400;

export function draftDue(s: GameState, color: Color = s.turn): boolean {
  const p = s.cards[color];
  return DRAFT_AT.filter((t) => t <= p.moves).length > p.draftsTaken;
}

/** Offer `OFFER_SIZE` distinct cards (weighted by rarity) that the player does not already own. */
export function beginDraft(s: GameState, rng: Rng, color: Color = s.turn): CardId[] {
  const p = s.cards[color];
  if (p.offer) return p.offer;
  const pool = Object.values(CARDS).filter((c) => !p.hand.includes(c.id) && !p.used.includes(c.id));
  const offer: CardId[] = [];
  while (offer.length < OFFER_SIZE && pool.length > 0) {
    const c = weightedPick(rng, pool, (x) => draftWeight(x.stars));
    offer.push(c.id);
    pool.splice(pool.indexOf(c), 1);
  }
  p.offer = offer;
  return offer;
}

export function pickCard(s: GameState, color: Color, id: CardId): void {
  const p = s.cards[color];
  if (!p.offer || !p.offer.includes(id)) throw new Error(`card ${id} is not on offer`);
  p.hand.push(id);
  p.offer = null;
  p.draftsTaken++;
}

export function canPlayCard(s: GameState, color: Color, id: CardId, sel: Square[]): boolean {
  const def = CARDS[id];
  return !s.winner && s.turn === color && !s.cards[color].offer && !!def && def.kind === 'active'
    && s.cards[color].hand.includes(id) && !!def.validate?.(s, color, sel);
}

/** Play an active card. Does not consume the turn. */
export function playCard(s: GameState, color: Color, id: CardId, sel: Square[]): void {
  if (!canPlayCard(s, color, id, sel)) throw new Error(`cannot play ${id}`);
  const p = s.cards[color];
  CARDS[id]!.activate!(s, color, sel);
  p.hand.splice(p.hand.indexOf(id), 1);
  p.used.push(id);
}

export function applyMove(s: GameState, m: Move): GameState {
  if (s.winner) throw new Error('game is over');
  if (s.cards[s.turn].offer || draftDue(s)) throw new Error('draft pending');
  const piece = s.board[m.from];
  if (!piece || piece.color !== s.turn) throw new Error('no own piece on source square');
  const mover = s.turn;
  const dir = mover === 'w' ? 1 : -1;

  let captured = s.board[m.to];
  if (m.enPassant) {
    const victimSq = sq(file(m.to), rank(m.to) - dir);
    captured = s.board[victimSq];
    s.board[victimSq] = null;
  }
  s.board[m.to] = piece;
  s.board[m.from] = null;
  piece.moved = true;
  if (m.promotion) piece.type = m.promotion;
  if (m.castle) {
    const rf = m.castle === 'K' ? m.to + 1 : m.to - 2;
    const rt = m.castle === 'K' ? m.to - 1 : m.to + 1;
    const rook = s.board[rf]!;
    rook.moved = true;
    s.board[rt] = rook;
    s.board[rf] = null;
  }
  s.epSquare = piece.type === 'P' && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : null;

  s.cards[mover].moves++;
  s.ply++;
  s.turn = other(mover);

  if (captured?.type === 'K') {
    s.winner = mover;
    s.endReason = 'king captured';
  } else if (findKing(s, s.turn) === -1) {
    // King removed by a card effect.
    s.winner = mover;
    s.endReason = 'king lost';
  } else if (legalMoves(s).length === 0) {
    s.winner = mover;
    s.endReason = 'no legal moves';
  } else if (s.ply >= PLY_LIMIT) {
    s.winner = 'draw';
    s.endReason = 'ply limit';
  }
  return s;
}

