import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, CARD_ORDER } from '../../engine/src/index.ts';
import { CARD_ART } from '../src/assets/cardArt.ts';
import { CARD_EMBLEMS } from '../src/assets/cardEmblems.ts';

test('every card has an emblem', () => {
  for (const id of CARD_ORDER) assert.ok(CARD_EMBLEMS[id], `missing emblem for ${id}`);
});

test('card art is up to date: board pictures exist for cards whose demo acts on squares', () => {
  const missing = CARD_ORDER.filter((id) => !CARD_ART[id]);
  // Global effects (no square involved) fall back to the emblem.
  for (const id of missing) assert.ok(!CARDS[id]!.targets?.length, `${id} picks squares but has no art; run npm run gen:art`);
  assert.ok(Object.keys(CARD_ART).length >= 100);
  for (const [id, a] of Object.entries(CARD_ART)) {
    assert.ok(CARDS[id], `art for unknown card ${id}`);
    for (const [x, y] of a.pieces) assert.ok(x >= 0 && x < a.n && y >= 0 && y < a.n, `${id} piece outside crop`);
  }
});
