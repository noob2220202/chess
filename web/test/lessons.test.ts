import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, fromPlacement, startSandbox } from '../../engine/src/index.ts';
import { solveDemo } from '../../engine/test/helpers.ts';
import { LESSONS } from '../src/tutorial/lessons.ts';

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
