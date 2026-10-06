/**
 * Glicko-2 (Glickman, 2012). Ratings use the Glicko scale (1500 / 350); internally converted.
 * We treat each game as its own rating period and inflate RD for idle time beforehand.
 */
export interface Glicko { rating: number; rd: number; vol: number }
export interface GameOutcome { opponent: Glicko; score: number }

export const DEFAULT: Glicko = { rating: 1500, rd: 350, vol: 0.06 };
const SCALE = 173.7178;
const TAU = 0.5;
const EPS = 1e-6;
export const MAX_RD = 350;
export const MIN_RD = 45;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const E = (mu: number, muj: number, phij: number) => 1 / (1 + Math.exp(-g(phij) * (mu - muj)));

export function update(p: Glicko, results: GameOutcome[]): Glicko {
  const mu = (p.rating - 1500) / SCALE, phi = p.rd / SCALE, sigma = p.vol;
  if (results.length === 0) {
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return { rating: p.rating, rd: Math.min(MAX_RD, phiStar * SCALE), vol: sigma };
  }
  let vInv = 0, deltaSum = 0;
  for (const r of results) {
    const muj = (r.opponent.rating - 1500) / SCALE, phij = r.opponent.rd / SCALE;
    const e = E(mu, muj, phij), gj = g(phij);
    vInv += gj * gj * e * (1 - e);
    deltaSum += gj * (r.score - e);
  }
  const v = 1 / vInv, delta = v * deltaSum;

  // Volatility (Illinois algorithm).
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x), d = phi * phi + v + ex;
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d * d) - (x - a) / (TAU * TAU);
  };
  let A = a, B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A), fB = f(B);
  while (Math.abs(B - A) > EPS) {
    const C = A + ((A - B) * fA) / (fB - fA), fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const newSigma = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * deltaSum;
  return {
    rating: newMu * SCALE + 1500,
    rd: Math.max(MIN_RD, Math.min(MAX_RD, newPhi * SCALE)),
    vol: newSigma,
  };
}

/** Grow RD for idle days (one "empty period" per day, as in Glicko-2 step 6). */
export function inflate(p: Glicko, idleDays: number): Glicko {
  if (idleDays <= 0) return p;
  const phi = p.rd / SCALE;
  const phi2 = Math.sqrt(phi * phi + idleDays * p.vol * p.vol);
  return { ...p, rd: Math.min(MAX_RD, phi2 * SCALE) };
}

/** Rate one game between a and b. scoreA: 1 win, 0.5 draw, 0 loss. */
export function rateGame(a: Glicko, b: Glicko, scoreA: number): [Glicko, Glicko] {
  return [update(a, [{ opponent: b, score: scoreA }]), update(b, [{ opponent: a, score: 1 - scoreA }])];
}

/** Soft reset for a new season. */
export function seasonReset(prev: Glicko | null): Glicko {
  if (!prev) return { ...DEFAULT };
  return { rating: 1500 + (prev.rating - 1500) * 0.5, rd: Math.max(prev.rd, 250), vol: 0.06 };
}

/** Win probability of a over b. */
export function expected(a: Glicko, b: Glicko): number {
  return E((a.rating - 1500) / SCALE, (b.rating - 1500) / SCALE, Math.sqrt(a.rd * a.rd + b.rd * b.rd) / SCALE);
}
