import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARDS, CARD_ORDER, applyMove, canPlayCard, cardReady, demoState, draftDue, fromPlacement, legalMoves,
  newGame, pickCard, playCard, publicView, rankedPool,
} from '../src/index.ts';
import { P, mv, solveDemo } from './helpers.ts';


test('there are 120 cards, 40 per draft round, with sane metadata', () => {
  assert.equal(CARD_ORDER.length, 120);
  for (const cat of ['OPENING', 'MIDDLE', 'END'] as const) {
    assert.equal(CARD_ORDER.filter((id) => CARDS[id]!.category === cat).length, 40, cat);
  }
  for (const id of CARD_ORDER) {
    const c = CARDS[id]!;
    assert.ok(c.stars >= 1 && c.stars <= 5, id);
    assert.ok(c.description.length > 5, id);
    if (c.kind === 'active') assert.ok(c.activate, `${id} needs activate`);
  }
  assert.equal(new Set(CARD_ORDER.map((id) => CARDS[id]!.name)).size, 120, 'names unique');
});

for (const id of CARD_ORDER) {
  test(`demo for "${id}" is solvable in at most two actions`, () => {
    const s = demoState(id);
    const sol = solveDemo(s, CARDS[id]!.demo.goal);
    assert.ok(sol, `no solution for ${id} demo`);
  });
}

test('mirror draft offers the same cards to both players; casual drafts differ', () => {
  const m = newGame({ seed: 11, mirror: true });
  assert.deepEqual(m.draftPlan.w, m.draftPlan.b);
  assert.deepEqual(m.draftPlan.w.map((r) => r.map((id) => CARDS[id]!.category)), [
    ['OPENING', 'OPENING', 'OPENING'], ['MIDDLE', 'MIDDLE', 'MIDDLE'], ['END', 'END', 'END'],
  ]);
  const c = newGame({ seed: 11 });
  assert.notDeepEqual(c.draftPlan.w, c.draftPlan.b);
  assert.deepEqual(newGame({ seed: 5, mirror: true }).draftPlan, newGame({ seed: 5, mirror: true }).draftPlan);
  assert.equal(rankedPool().length, CARD_ORDER.filter((id) => !CARDS[id]!.casualOnly).length);
});

test('draft flow: offer at moves 0/10/20, blocks moves until picked, hidden from opponent view', () => {
  const s = newGame({ seed: 3, mirror: true });
  assert.ok(s.cards.w.offer && s.cards.w.offer.length === 3);
  assert.throws(() => applyMove(s, mv('e2', 'e4')), /draft pending/);
  assert.throws(() => pickCard(s, 'b', s.cards.w.offer![0]!));
  const v = publicView(s, 'b');
  assert.deepEqual(v.cards.w.offer, []);
  assert.deepEqual(v.draftPlan, { w: [], b: [] });
  pickCard(s, 'w', s.cards.w.offer![0]!);
  assert.equal(s.cards.w.offer, null);
  // play until white has made 10 moves, always picking the first offer
  let guard = 0;
  while (!s.winner && s.cards.w.draftsTaken < 2 && guard++ < 200) {
    const me = s.turn;
    if (s.cards[me].offer) { pickCard(s, me, s.cards[me].offer![0]!); continue; }
    applyMove(s, legalMoves(s)[0]!);
  }
  if (!s.winner) assert.equal(s.cards.w.moves, 10);
  assert.ok(!draftDue(s, 'w'));
});

test('one active card per turn, and cards do not use the turn', () => {
  const s = fromPlacement('4k3/3p4/8/8/8/8/PP6/4K3');
  s.cards.w.hand.push('conscript', 'snipe');
  playCard(s, 'w', 'conscript', [P('a2')]);
  assert.equal(s.turn, 'w');
  assert.ok(!cardReady(s, 'w', 'snipe'), 'second card the same turn is refused');
  applyMove(s, mv('b2', 'b3'));
  applyMove(s, mv('e8', 'f8'));
  assert.ok(canPlayCard(s, 'w', 'snipe', [P('d7')]));
});

test('statuses: shield blocks capture, frozen blocks movement, disarmed blocks capture', () => {
  const s = fromPlacement('4k3/8/8/8/3r4/8/8/3QK3', 'b');
  s.board[P('d1')]!.status.shield = 6;
  assert.ok(!legalMoves(s).some((m) => m.to === P('d1')));
  s.board[P('d1')]!.status.shield = 0;
  assert.ok(legalMoves(s).some((m) => m.to === P('d1')));
  s.board[P('d4')]!.status.disarmed = 6;
  assert.ok(!legalMoves(s).some((m) => m.to === P('d1')));
  assert.ok(legalMoves(s).some((m) => m.from === P('d4')));
  s.board[P('d4')]!.status.frozen = 6;
  assert.ok(!legalMoves(s).some((m) => m.from === P('d4')));
});

test('provoke forces a capture on the next enemy turn only', () => {
  const s = fromPlacement('4k3/8/8/8/3p4/4P3/8/4K3');
  s.cards.w.hand.push('provoke');
  playCard(s, 'w', 'provoke', []);
  applyMove(s, mv('e1', 'f1'));
  assert.ok(legalMoves(s).every((m) => m.to === P('e3')), 'black must capture on e3');
  applyMove(s, mv('d4', 'e3'));
  applyMove(s, mv('f1', 'g1'));
  assert.ok(legalMoves(s).some((m) => m.from === P('e8')), 'effect expired');
});

test('mine must be planted on the enemy half and ignores kings', () => {
  const t = fromPlacement('4k3/8/8/8/8/8/8/4K3');
  t.cards.w.hand.push('mine');
  assert.ok(!canPlayCard(t, 'w', 'mine', [P('f1')]));
  playCard(t, 'w', 'mine', [P('e7')]);
  applyMove(t, mv('e1', 'e2'));
  applyMove(t, mv('e8', 'e7'));
  assert.equal(t.board[P('e7')]?.type, 'K');
});

test('mine triggers on a non-king enemy piece', () => {
  const t = fromPlacement('4k3/8/8/3n4/8/8/8/4K3');
  t.cards.w.hand.push('mine');
  playCard(t, 'w', 'mine', [P('e7')]);
  applyMove(t, mv('e1', 'e2'));
  applyMove(t, mv('d5', 'e7'));
  assert.equal(t.board[P('e7')], null);
  assert.equal(t.lost.b.at(-1), 'N');
  assert.equal(t.effects.length, 0);
});

test('second wind saves the king exactly once', () => {
  const s = fromPlacement('4k3/8/8/8/8/8/8/R3K2R');
  s.cards.b.hand.push('second-wind');
  applyMove(s, mv('a1', 'a8')); // not a capture
  applyMove(s, mv('e8', 'd8'));
  applyMove(s, mv('a8', 'd8')); // captures king -> saved, rook destroyed
  assert.equal(s.winner, null);
  assert.equal(s.board[P('d8')]?.type, 'K');
  assert.equal(s.board[P('a8')], null);
  applyMove(s, mv('d8', 'e8'));
  applyMove(s, mv('h1', 'h8'));
  applyMove(s, mv('e8', 'd8'));
  applyMove(s, mv('h8', 'd8'));
  assert.equal(s.winner, 'w');
});

test('summit wins only if the king survives a full enemy turn in the centre', () => {
  const s = fromPlacement('4k3/8/8/8/8/4K3/8/8');
  s.cards.w.hand.push('summit');
  applyMove(s, mv('e3', 'e4'));
  assert.equal(s.winner, null);
  applyMove(s, mv('e8', 'e7'));
  assert.equal(s.winner, 'w');
  assert.equal(s.endReason, 'card-win');
});

test('passives that change setup on acquire', () => {
  const s = newGame({ noDraft: true });
  s.cards.w.offer = ['archbishop'];
  pickCard(s, 'w', 'archbishop');
  assert.equal(s.board[P('c1')]?.type, 'A');
  assert.equal(s.board[P('b1')], null, 'queen-side knight absorbed');
  assert.equal(s.board[P('a2')]?.type, 'P', 'no file is opened');
});
