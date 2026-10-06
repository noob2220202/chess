import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDecision, decide, fromPlacement, isLegal, newGame } from '../src/index.ts';
import { P } from './helpers.ts';

test('bot captures a hanging king at every level', () => {
  for (const level of [1, 2, 3] as const) {
    const s = fromPlacement('4k3/8/8/8/4R3/8/8/4K3');
    const d = decide(s, { level, seed: 1 });
    assert.equal(d.kind, 'turn');
    if (d.kind === 'turn') assert.deepEqual([d.move.from, d.move.to], [P('e4'), P('e8')]);
  }
});

test('bot avoids leaving its king en prise at level 2', () => {
  const s = fromPlacement('4k3/8/8/8/8/8/3r4/4K3');
  const d = decide(s, { level: 2, seed: 2 });
  assert.equal(d.kind, 'turn');
  if (d.kind === 'turn') assert.deepEqual([d.move.from, d.move.to], [P('e1'), P('d2')], 'takes the attacking rook');
});

test('bot uses a card when it wins material', () => {
  const s = fromPlacement('4k3/8/8/8/8/2r5/P7/4K3');
  s.cards.w.hand.push('conscript');
  const d = decide(s, { level: 2, seed: 3 });
  assert.equal(d.kind, 'turn');
  if (d.kind === 'turn') {
    assert.equal(d.card?.id, 'conscript');
    assert.deepEqual([d.move.from, d.move.to], [P('a2'), P('c3')]);
  }
});

test('bot drafts and plays complete legal games', () => {
  const s = newGame({ seed: 9, mirror: true });
  let n = 0;
  while (!s.winner && n++ < 400) {
    const d = decide(s, { level: 1, seed: n });
    if (d.kind === 'turn') assert.ok(d.card || isLegal(s, d.move));
    applyDecision(s, d);
  }
  assert.ok(s.winner);
});
