import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, beginDraft, canPlayCard, cloneState, draftDue, findKing, legalMoves, makeRng, newGame, parseSquare as P, pickCard, playCard } from '../src/index.ts';
import type { GameState, Move } from '../src/index.ts';
import { runSim } from '../src/sim.ts';

const mv = (from: string, to: string, extra: Partial<Move> = {}): Move => ({ from: P(from), to: P(to), ...extra });
/** Fresh game with the scheduled drafts skipped (for pure-chess tests). */
function chess(): GameState {
  const s = newGame();
  for (const c of ['w', 'b'] as const) s.cards[c].draftsTaken = 3;
  return s;
}
function perft(s: GameState, d: number): number {
  if (d === 0) return 1;
  let n = 0;
  for (const m of legalMoves(s)) {
    const c = cloneState(s);
    applyMove(c, m);
    n += c.winner ? 1 : perft(c, d - 1);
  }
  return n;
}

test('perft from the start position matches chess (no check rule needed up to depth 3)', () => {
  const s = chess();
  assert.equal(perft(s, 1), 20);
  assert.equal(perft(s, 2), 400);
  assert.equal(perft(s, 3), 8902);
});

test('capturing the king wins', () => {
  const s = chess();
  s.board.fill(null);
  s.board[P('e1')] = { type: 'K', color: 'w', moved: true };
  s.board[P('e8')] = { type: 'K', color: 'b', moved: true };
  s.board[P('e4')] = { type: 'R', color: 'w', moved: true };
  applyMove(s, mv('e4', 'e8'));
  assert.equal(s.winner, 'w');
  assert.equal(s.endReason, 'king captured');
  assert.throws(() => applyMove(s, mv('e8', 'e7')));
});

test('castling both sides, en passant, promotion', () => {
  const s = chess();
  for (const sqr of ['f1', 'g1', 'b1', 'c1', 'd1']) s.board[P(sqr)] = null;
  assert.ok(legalMoves(s).some((m) => m.castle === 'K'));
  assert.ok(legalMoves(s).some((m) => m.castle === 'Q'));
  applyMove(s, mv('e1', 'g1', { castle: 'K' }));
  assert.equal(s.board[P('f1')]?.type, 'R');
  assert.equal(s.board[P('g1')]?.type, 'K');

  const e = chess();
  applyMove(e, mv('e2', 'e4')); applyMove(e, mv('a7', 'a6'));
  applyMove(e, mv('e4', 'e5')); applyMove(e, mv('d7', 'd5'));
  const ep = legalMoves(e).find((m) => m.enPassant);
  assert.ok(ep && ep.to === P('d6'));
  applyMove(e, ep);
  assert.equal(e.board[P('d5')], null);

  const p = chess();
  p.board.fill(null);
  p.board[P('e1')] = { type: 'K', color: 'w', moved: true };
  p.board[P('a1')] = { type: 'K', color: 'b', moved: true };
  p.board[P('h7')] = { type: 'P', color: 'w', moved: true };
  assert.equal(legalMoves(p).filter((m) => m.promotion).length, 4);
});

test('a side with no moves loses', () => {
  const s = chess();
  s.board.fill(null);
  s.board[P('a8')] = { type: 'K', color: 'b', moved: true };
  s.board[P('h1')] = { type: 'K', color: 'w', moved: true };
  s.board[P('b6')] = { type: 'Q', color: 'w', moved: true };
  s.board[P('c7')] = { type: 'R', color: 'w', moved: true };
  s.board[P('b7')] = { type: 'P', color: 'b', moved: true };
  // black king is boxed in only if every neighbour is blocked/occupied by shielded or own pieces
  s.board[P('b7')] = { type: 'P', color: 'w', moved: true, shieldUntil: 99 };
  s.board[P('b8')] = { type: 'N', color: 'w', moved: true, shieldUntil: 99 };
  s.board[P('a7')] = { type: 'N', color: 'w', moved: true, shieldUntil: 99 };
  s.board[P('b6')] = null; s.board[P('c7')] = null;
  s.turn = 'w';
  s.board[P('h1')] = { type: 'K', color: 'w', moved: true };
  applyMove(s, mv('h1', 'h2'));
  assert.equal(s.winner, 'w');
  assert.equal(s.endReason, 'no legal moves');
});

test('draft is due at own moves 0/10/20 and blocks play until picked', () => {
  const s = newGame();
  const rng = makeRng(7);
  assert.ok(draftDue(s));
  assert.throws(() => applyMove(s, mv('e2', 'e4')), /draft pending/);
  const offer = beginDraft(s, rng);
  assert.equal(offer.length, 3);
  assert.equal(new Set(offer).size, 3);
  assert.throws(() => pickCard(s, 'w', 'nope'));
  pickCard(s, 'w', offer[0]!);
  assert.ok(!draftDue(s));
  assert.deepEqual(s.cards.w.hand, [offer[0]]);
  s.cards.w.moves = 10;
  assert.ok(draftDue(s));
});

test('draft is deterministic for a seed', () => {
  assert.deepEqual(beginDraft(newGame(), makeRng(42)), beginDraft(newGame(), makeRng(42)));
});

test('passive: knight-king and sprint add moves', () => {
  const s = chess();
  s.cards.w.hand.push('knight-king', 'sprint');
  s.board[P('e1')] = null;
  s.board[P('e4')] = { type: 'K', color: 'w', moved: true };
  const tos = legalMoves(s).filter((m) => m.from === P('e4')).map((m) => m.to);
  assert.ok(tos.includes(P('f6')) && tos.includes(P('d6')));
  // pawn that already left its start rank can double-step
  s.board[P('a2')] = null;
  s.board[P('a3')] = { type: 'P', color: 'w', moved: true };
  assert.ok(legalMoves(s).some((m) => m.from === P('a3') && m.to === P('a5')));
});

test('actives: conscript, snipe, aegis do not consume the turn and are single-use', () => {
  const s = chess();
  s.cards.w.hand.push('conscript', 'snipe', 'aegis');
  assert.ok(!canPlayCard(s, 'w', 'conscript', [P('e1')]), 'must target a pawn');
  playCard(s, 'w', 'conscript', [P('a2')]);
  assert.equal(s.board[P('a2')]?.type, 'N');
  assert.equal(s.turn, 'w');
  assert.throws(() => playCard(s, 'w', 'conscript', [P('b2')]));

  playCard(s, 'w', 'snipe', [P('h7')]);
  assert.equal(s.board[P('h7')], null);

  playCard(s, 'w', 'aegis', [P('d1')]);
  s.board[P('d3')] = null;
  s.board[P('d4')] = { type: 'R', color: 'b', moved: true };
  s.board[P('d2')] = null;
  assert.ok(!legalMoves(s, 'b').some((m) => m.to === P('d1')), 'shielded queen cannot be captured');
  s.ply = 100; // shield expired
  assert.ok(legalMoves(s, 'b').some((m) => m.to === P('d1')));
  assert.deepEqual(s.cards.w.used.sort(), ['aegis', 'conscript', 'snipe']);
});

test('king always exists while game runs; simulator is reproducible and terminates', () => {
  const a = runSim(40, 5), b = runSim(40, 5);
  assert.deepEqual(a, b);
  assert.equal(a.white + a.black + a.draw, 40);
  const s = newGame();
  assert.notEqual(findKing(s, 'w'), -1);
});
