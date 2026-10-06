/// <reference lib="webworker" />
import type { BotLevel, GameState } from '@engine';
import { decide, makeRng } from '@engine';

self.onmessage = (e: MessageEvent<{ id: number; state: GameState; level: BotLevel; seed: number }>) => {
  const { id, state, level, seed } = e.data;
  try {
    const d = decide(state, { level, rng: makeRng(seed) });
    (self as unknown as Worker).postMessage({ id, decision: d });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
