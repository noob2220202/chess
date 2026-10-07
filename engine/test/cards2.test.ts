import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, cardReady, decide, applyDecision, fromPlacement, legalMoves, newGame, playCard } from '../src/index.ts';
import { P, mv } from './helpers.ts';

test('double-time: the same side moves twice, and the second move cannot capture', () => {
  const s = fromPlacement('4k3/8/8/8/3r4/8/8/3QK3');
  s.cards.w.hand.push('double-time');
  playCard(s, 'w', 'double-time', []);
  applyMove(s, mv('e1', 'f1'));
  assert.equal(s.turn, 'w', 'white moves again');
  assert.ok(!legalMoves(s).some((m) => m.to === P('d4')), 'second move may not capture');
  applyMove(s, mv('f1', 'g1'));
  assert.equal(s.turn, 'b');
  applyMove(s, mv('d4', 'd5'));
  assert.ok(legalMoves(s).some((m) => m.to === P('d5')), 'captures allowed again next turn');
});

test('silence stops the opponent from playing active cards for three turns', () => {
  const s = fromPlacement('4k3/8/8/8/8/8/8/4K3');
  s.cards.w.hand.push('silence');
  s.cards.b.hand.push('king-armor');
  playCard(s, 'w', 'silence', []);
  applyMove(s, mv('e1', 'd1'));
  const seq = [['e8', 'd8'], ['d1', 'e1'], ['d8', 'e8'], ['e1', 'd1'], ['e8', 'd8'], ['d1', 'e1']] as const;
  for (const [i, [f, t]] of seq.entries()) {
    if (i % 2 === 0) assert.ok(!cardReady(s, 'b', 'king-armor'), `blocked at black turn ${i / 2 + 1}`);
    applyMove(s, mv(f, t));
  }
  assert.ok(cardReady(s, 'b', 'king-armor'), 'silence wore off');
});

test('quicksand freezes the first enemy piece that steps on it', () => {
  const s = fromPlacement('4k3/8/8/8/8/8/r7/4K3', 'w');
  s.cards.w.hand.push('quicksand');
  playCard(s, 'w', 'quicksand', [P('c2')]);
  applyMove(s, mv('e1', 'f1'));
  applyMove(s, mv('a2', 'c2'));
  applyMove(s, mv('f1', 'g1'));
  assert.ok(!legalMoves(s).some((m) => m.from === P('c2')), 'rook is stuck');
});

test('counterattack destroys a pawn that captures, king-armor shields the king', () => {
  const s = fromPlacement('4k3/8/8/3n4/4P3/8/7r/4K3');
  s.cards.b.hand.push('counterattack');
  s.cards.w.hand.push('king-armor');
  applyMove(s, mv('e4', 'd5'));
  assert.equal(s.board[P('d5')], null);
  applyMove(s, mv('e8', 'f8'));
  playCard(s, 'w', 'king-armor', []);
  assert.ok(legalMoves(s).some((m) => m.from === P('e1') && m.to === P('e2')), 'a shielded king may step onto an attacked square');
});

test('bots finish games with the full card pool', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const s = newGame({ seed });
    let n = 0;
    while (!s.winner && n++ < 400) applyDecision(s, decide(s, { level: 1, seed: seed * 100 + n }));
    assert.ok(s.winner, `game ${seed} ended`);
  }
});
