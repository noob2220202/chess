import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, fromPlacement, startSandbox } from '../../engine/src/index.ts';
import { solveDemo } from '../../engine/test/helpers.ts';
import { LESSONS, LESSON_RENAMES, UNITS } from '../src/tutorial/lessons.ts';

for (const lesson of LESSONS) {
  lesson.steps.forEach((step, i) => {
    test(`lesson ${lesson.id} step ${i + 1} (${step.title}) is playable`, () => {
      for (const id of [...(step.white ?? []), ...(step.black ?? []), ...(step.draft ?? [])]) assert.ok(CARDS[id], `unknown card ${id}`);
      if (!step.board) return;
      assert.ok(step.goal, 'board steps need a goal');
      const s = fromPlacement(step.board);
      s.cards.w.hand = [...(step.white ?? [])];
      s.cards.b.hand = [...(step.black ?? [])];
      step.setup?.(s);
      startSandbox(s);
      assert.ok(solveDemo(s, step.goal!), 'goal not reachable in two actions');
    });
  });
}

test('every lesson belongs to exactly one unit, in order', () => {
  const ids = UNITS.flatMap((u) => u.lessons);
  assert.deepEqual(ids, LESSONS.map((l) => l.id));
  for (const to of Object.values(LESSON_RENAMES)) for (const id of to) assert.ok(ids.includes(id), id);
});
