import { test } from 'node:test';
import assert from 'node:assert/strict';
import { josa } from '../src/lib/korean.ts';

test('object particle follows the final consonant', () => {
  assert.equal(josa('나이트', '을/를'), '나이트를');
  assert.equal(josa('룩', '을/를'), '룩을');
  assert.equal(josa('방패', '을/를'), '방패를');
  assert.equal(josa('징병', '을/를'), '징병을');
  assert.equal(josa('“빙결”', '을/를'), '“빙결”을');
});

test('direction particle with square names', () => {
  assert.equal(josa('e3', '으로/로'), 'e3으로');
  assert.equal(josa('e6', '으로/로'), 'e6으로');
  assert.equal(josa('e1', '으로/로'), 'e1로');
  assert.equal(josa('e8', '으로/로'), 'e8로');
  assert.equal(josa('e4', '으로/로'), 'e4로');
  assert.equal(josa('성', '으로/로'), '성으로');
  assert.equal(josa('길', '으로/로'), '길로');
});

test('subject and topic particles', () => {
  assert.equal(josa('킹', '이/가'), '킹이');
  assert.equal(josa('대주교', '이/가'), '대주교가');
  assert.equal(josa('퀸', '은/는'), '퀸은');
});
