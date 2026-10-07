import type { BotDecision, BotLevel, GameState, Move, MoveReview } from '@engine';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (d: BotDecision) => void; reject: (e: Error) => void }>();

function get(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data.decision);
    };
  }
  return worker;
}

/** Ask the bot (off the main thread) for its decision. */
export function askBot(state: GameState, level: BotLevel): Promise<BotDecision> {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    get().postMessage({ id, state, level, seed: Math.floor(Math.random() * 2 ** 31) });
  });
}

let reviewer: Worker | null = null;
/** Score moves for the post-game review in a separate worker, reporting progress. */
export function reviewMoves(items: Array<{ state: GameState; move: Move }>, onProgress: (done: number, total: number) => void): Promise<Array<MoveReview | null>> {
  reviewer?.terminate();
  reviewer = new Worker(new URL('./review.ts', import.meta.url), { type: 'module' });
  const w = reviewer;
  return new Promise((resolve, reject) => {
    w.onmessage = (e) => {
      if (e.data.done) { resolve(e.data.done); w.terminate(); if (reviewer === w) reviewer = null; }
      else onProgress(e.data.progress, e.data.total);
    };
    w.onerror = (e) => reject(new Error(e.message));
    w.postMessage({ id: 1, items });
  });
}
