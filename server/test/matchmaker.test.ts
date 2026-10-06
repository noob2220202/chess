import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairUp, windowFor } from '../src/matchmaker.ts';

const t = (userId: number, rating: number, wait: number, mode: 'rated' | 'casual' = 'rated') => ({ userId, rating, mode, joinedAt: 100_000 - wait });

test('rated pairs closest ratings inside the window', () => {
  const pairs = pairUp([t(1, 1500, 0), t(2, 1550, 0), t(3, 2100, 0), t(4, 1580, 0)], 100_000);
  assert.deepEqual(pairs.map(([a, b]) => [a.userId, b.userId].sort()), [[2, 4]]);
});

test('the window widens with waiting time', () => {
  assert.equal(pairUp([t(1, 1500, 0), t(2, 1900, 0)], 100_000).length, 0);
  assert.equal(pairUp([t(1, 1500, 20_000), t(2, 1900, 20_000)], 100_000).length, 1);
  assert.ok(windowFor(0) === 100 && windowFor(1e9) === 800);
});

test('casual is first come first served and modes never mix', () => {
  const pairs = pairUp([t(1, 1500, 5, 'casual'), t(2, 2500, 9, 'casual'), t(3, 1500, 1, 'rated')], 100_000);
  assert.deepEqual(pairs.map(([a, b]) => [a.userId, b.userId]), [[2, 1]]);
});
