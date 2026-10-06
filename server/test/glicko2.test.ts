import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT, expected, inflate, rateGame, seasonReset, update } from '../src/glicko2.ts';

test('matches the worked example in Glickman (2012)', () => {
  const r = update({ rating: 1500, rd: 200, vol: 0.06 }, [
    { opponent: { rating: 1400, rd: 30, vol: 0.06 }, score: 1 },
    { opponent: { rating: 1550, rd: 100, vol: 0.06 }, score: 0 },
    { opponent: { rating: 1700, rd: 300, vol: 0.06 }, score: 0 },
  ]);
  assert.ok(Math.abs(r.rating - 1464.06) < 0.05, `rating ${r.rating}`);
  assert.ok(Math.abs(r.rd - 151.52) < 0.05, `rd ${r.rd}`);
  assert.ok(Math.abs(r.vol - 0.05999) < 0.0001, `vol ${r.vol}`);
});

test('a single game moves new players a lot and established players a little', () => {
  const [w, l] = rateGame(DEFAULT, DEFAULT, 1);
  assert.ok(w.rating > 1650 && l.rating < 1350);
  assert.ok(w.rd < 350);
  const est = { rating: 1500, rd: 60, vol: 0.06 };
  const [w2] = rateGame(est, est, 1);
  assert.ok(w2.rating - 1500 < 20);
  const [d1, d2] = rateGame(est, est, 0.5);
  assert.ok(Math.abs(d1.rating - 1500) < 0.01 && Math.abs(d2.rating - 1500) < 0.01);
});

test('upset wins are worth more than expected wins', () => {
  const lo = { rating: 1400, rd: 80, vol: 0.06 }, hi = { rating: 1700, rd: 80, vol: 0.06 };
  assert.ok(expected(hi, lo) > 0.8);
  const [upset] = rateGame(lo, hi, 1);
  const [normal] = rateGame(hi, lo, 1);
  assert.ok(upset.rating - lo.rating > normal.rating - hi.rating);
});

test('inactivity inflates RD (capped) and seasons soft reset', () => {
  const p = { rating: 1800, rd: 60, vol: 0.06 };
  assert.ok(inflate(p, 100).rd > 60);
  assert.equal(inflate(p, 1e9).rd, 350);
  assert.deepEqual(seasonReset({ rating: 1800, rd: 60, vol: 0.07 }), { rating: 1650, rd: 250, vol: 0.06 });
  assert.deepEqual(seasonReset(null), DEFAULT);
});
