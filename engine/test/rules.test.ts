import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMove, cardReady, cloneState, fromPlacement, legalMoves, newGame, START_PLACEMENT, toPlacement, targetOptions,
} from '../src/index.ts';
import type { GameState } from '../src/index.ts';
import { P, mv } from './helpers.ts';

const chess = (placement = START_PLACEMENT): GameState => newGame({ noDraft: true, placement });

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

test('perft matches standard chess to depth 3', () => {
  const s = chess();
  assert.equal(perft(s, 1), 20);
  assert.equal(perft(s, 2), 400);
  assert.equal(perft(s, 3), 8902);
});

test('placement round-trips, including fairy pieces', () => {
  const p = '4k3/8/2a1c3/8/3M4/1l4g1/8/4K3';
  assert.equal(toPlacement(fromPlacement(p)), p);
});

test('fairy piece movement counts on an empty board', () => {
  const count = (t: string) => legalMoves(chess(`k7/8/8/8/3${t}4/8/8/7K`)).filter((m) => m.from === P('d4')).length;
  assert.equal(count('A'), 13 + 8); // bishop + knight
  assert.equal(count('C'), 14 + 8);
  assert.equal(count('M'), 27 + 8);
  assert.equal(count('L'), 8); // camel: all eight (1,3) leaps fit from d4
  assert.equal(count('G'), 8);
});

test('a king is never captured: a check made by a card must be answered first', () => {
  // White's card left Black in check during White's turn; White still may not take the king.
  const s = chess('4k3/8/8/8/4R3/8/8/4K3');
  assert.ok(!legalMoves(s).some((m) => m.to === P('e8')));
  assert.throws(() => applyMove(s, mv('e4', 'e8')));
});

test('a card may not leave its own king in check', () => {
  const s = chess('4k3/4r3/8/8/8/8/4N3/4K3');
  s.cards.w.hand.push('swap', 'march-order');
  // Moving the e2 knight away (by card) would expose the king to the e7 rook.
  assert.ok(!targetOptions(s, 'w', 'march-order', [P('e2')]).length, 'no safe destination');
  assert.ok(!cardReady(s, 'w', 'march-order'));
});

test('like real chess, a king may not walk into attack and a check must be answered', () => {
  const s = chess('4k3/8/8/8/8/8/3r4/4K3');
  assert.ok(!legalMoves(s).some((m) => m.from === P('e1') && m.to === P('e2')), 'e2 is attacked by the rook');
  assert.ok(legalMoves(s).some((m) => m.from === P('e1') && m.to === P('d2')), 'capturing the rook is fine');
  const c = chess('4k3/8/8/8/8/8/P7/r3K3');
  assert.ok(legalMoves(c).every((m) => m.from === P('e1')), 'in check from a1: only king moves help');
  assert.ok(!legalMoves(chess('4k3/8/8/8/8/8/8/R3K2r')).some((m) => m.castle), 'no castling out of check');
  assert.ok(!legalMoves(chess('4k3/8/8/8/8/8/5r2/R3K2R')).some((m) => m.castle === 'K'), 'no castling through check');
});

test('castling both sides, en passant, promotion choices', () => {
  const s = chess('r3k2r/8/8/8/8/8/8/R3K2R');
  const cs = legalMoves(s).filter((m) => m.castle);
  assert.equal(cs.length, 2);
  applyMove(s, mv('e1', 'c1', { castle: 'Q' }));
  assert.equal(s.board[P('d1')]?.type, 'R');
  assert.equal(s.board[P('c1')]?.type, 'K');

  const e = chess();
  for (const [a, b] of [['e2', 'e4'], ['a7', 'a6'], ['e4', 'e5'], ['d7', 'd5']] as const) applyMove(e, mv(a, b));
  const ep = legalMoves(e).find((m) => m.enPassant)!;
  assert.equal(ep.to, P('d6'));
  applyMove(e, ep);
  assert.equal(e.board[P('d5')], null);
  assert.equal(e.lost.b.at(-1), 'P');

  const p = chess('k7/7P/8/8/8/8/8/K7');
  assert.equal(legalMoves(p).filter((m) => m.promotion).length, 4);
});

test('checkmate wins and stalemate is a draw', () => {
  const m = chess('6k1/5ppp/8/8/8/8/8/R5K1');
  applyMove(m, mv('a1', 'a8'));
  assert.equal(m.winner, 'w');
  assert.equal(m.endReason, 'checkmate');
  const st = chess('7k/8/8/8/8/8/8/1Q4K1');
  applyMove(st, mv('b1', 'g6'));
  assert.equal(st.winner, 'draw');
  assert.equal(st.endReason, 'stalemate');
});

test('a card that escapes mate keeps the game going', () => {
  const m = chess('6k1/5ppp/8/8/8/8/8/R5K1');
  m.cards.b.hand.push('king-armor');
  applyMove(m, mv('a1', 'a8'));
  assert.equal(m.winner, null, 'black can still play king-armor');
});

test('threefold repetition and quiet-move limit draw', () => {
  const s = chess('4k3/8/8/8/8/8/8/4K1N1');
  for (let i = 0; i < 2; i++) {
    applyMove(s, mv('g1', 'f3')); applyMove(s, mv('e8', 'd8'));
    applyMove(s, mv('f3', 'g1')); applyMove(s, mv('d8', 'e8'));
  }
  assert.equal(s.winner, 'draw');
  assert.equal(s.endReason, 'repetition');

  const q = chess('4k3/8/8/8/8/8/8/4K1N1');
  q.quiet = 99;
  applyMove(q, mv('g1', 'f3'));
  assert.equal(q.endReason, 'quiet-limit');
});

test('short algebraic notation', async () => {
  const { notate } = await import('../src/index.ts');
  const s = chess();
  assert.deepEqual(notate(s, mv('g1', 'f3')), { piece: 'N', text: 'f3' });
  assert.deepEqual(notate(s, mv('e2', 'e4')), { piece: 'P', text: 'e4' });
  const t = chess('4k3/8/8/3p4/4P3/8/8/R3K2R');
  assert.deepEqual(notate(t, mv('e4', 'd5')), { piece: 'P', text: 'exd5' });
  assert.deepEqual(notate(t, mv('e1', 'g1', { castle: 'K' })), { piece: null, text: 'O-O' });
  const r = chess('4k3/8/8/8/8/8/4K3/R6R');
  assert.deepEqual(notate(r, mv('a1', 'd1')), { piece: 'R', text: 'ad1' });
  const k = chess('4k3/8/8/8/4R3/8/8/4K3');
  assert.deepEqual(notate(k, mv('e4', 'e8')), { piece: 'R', text: 'xe8#' });
});

test('demo solver returns the shortest plan', async () => {
  const { demoState, solveDemo, CARDS } = await import('../src/index.ts');
  const plan = solveDemo(demoState('conscript'), CARDS['conscript']!.demo.goal)!;
  assert.equal(plan.length, 2);
  assert.ok('card' in plan[0]! && plan[0].card === 'conscript');
  assert.ok('move' in plan[1]!);
});
