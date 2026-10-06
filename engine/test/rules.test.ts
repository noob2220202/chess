import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMove, cloneState, fromPlacement, legalMoves, newGame, START_PLACEMENT, toPlacement,
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

test('capturing the king wins and ends the game', () => {
  const s = chess('4k3/8/8/8/4R3/8/8/4K3');
  applyMove(s, mv('e4', 'e8'));
  assert.equal(s.winner, 'w');
  assert.equal(s.endReason, 'king-captured');
  assert.throws(() => applyMove(s, mv('e8', 'e7')));
});

test('there is no check rule: a king may walk into attack', () => {
  const s = chess('4k3/8/8/8/8/8/3r4/4K3');
  assert.ok(legalMoves(s).some((m) => m.from === P('e1') && m.to === P('e2')));
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

test('a side with no legal moves loses', () => {
  // Black king on a8 boxed in by shielded white pieces it cannot capture.
  const t = chess('kN6/NN6/8/8/8/8/8/K7');
  for (const x of ['b8', 'a7', 'b7']) t.board[P(x)]!.status.shield = 99;
  applyMove(t, mv('a1', 'b1'));
  assert.equal(t.winner, 'w');
  assert.equal(t.endReason, 'no-moves');
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
