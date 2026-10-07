/// <reference lib="webworker" />
import type { GameState, Move } from '@engine';
import { reviewMove } from '@engine';

/** Post-game review: score each played move against the best move, one position at a time. */
self.onmessage = (e: MessageEvent<{ id: number; items: Array<{ state: GameState; move: Move }> }>) => {
  const { id, items } = e.data;
  const out = [];
  for (let i = 0; i < items.length; i++) {
    let r = null;
    try { r = reviewMove(items[i]!.state, items[i]!.move); } catch { r = null; }
    out.push(r);
    (self as unknown as Worker).postMessage({ id, progress: i + 1, total: items.length });
  }
  (self as unknown as Worker).postMessage({ id, done: out });
};
