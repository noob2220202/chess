import type { QueueMode } from './config.ts';

export interface Ticket { userId: number; mode: QueueMode; rating: number; joinedAt: number }

/** Rating window grows with waiting time so everyone eventually finds a game. */
export const windowFor = (waitMs: number): number => Math.min(800, 100 + (waitMs / 1000) * 20);

/**
 * Pair waiting players. Rated: closest ratings first, within both players' windows.
 * Casual: first come, first served.
 */
export function pairUp(tickets: Ticket[], now: number): Array<[Ticket, Ticket]> {
  const pairs: Array<[Ticket, Ticket]> = [];
  for (const mode of ['rated', 'casual'] as const) {
    const pool = tickets.filter((t) => t.mode === mode).sort((a, b) => (mode === 'rated' ? a.rating - b.rating : a.joinedAt - b.joinedAt));
    const used = new Set<number>();
    if (mode === 'casual') {
      for (let i = 0; i + 1 < pool.length; i += 2) pairs.push([pool[i]!, pool[i + 1]!]);
      continue;
    }
    // Greedy: repeatedly take the closest adjacent pair that both windows accept.
    const cands: Array<[number, number, number]> = [];
    for (let i = 0; i + 1 < pool.length; i++) cands.push([Math.abs(pool[i + 1]!.rating - pool[i]!.rating), i, i + 1]);
    cands.sort((a, b) => a[0] - b[0]);
    for (const [gap, i, j] of cands) {
      const a = pool[i]!, b = pool[j]!;
      if (used.has(a.userId) || used.has(b.userId)) continue;
      if (gap > Math.min(windowFor(now - a.joinedAt), windowFor(now - b.joinedAt))) continue;
      used.add(a.userId); used.add(b.userId);
      pairs.push([a, b]);
    }
  }
  return pairs;
}
