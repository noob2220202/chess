/** Deterministic seeded PRNG (mulberry32) so games and simulations are reproducible. */
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, xs: readonly T[]): T {
  return xs[Math.floor(rng() * xs.length)]!;
}

export function weightedPick<T>(rng: Rng, xs: readonly T[], w: (x: T) => number): T {
  const total = xs.reduce((a, x) => a + w(x), 0);
  let r = rng() * total;
  for (const x of xs) {
    r -= w(x);
    if (r < 0) return x;
  }
  return xs[xs.length - 1]!;
}
