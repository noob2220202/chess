/**
 * Self-play simulator: estimates per-card win rates so card star ratings can be derived from data
 * instead of gut feeling.   usage: node src/sim.ts [games=2000] [seed=1]
 */
import type { Color, GameState, Move } from './types.ts';
import { other } from './types.ts';
import { newGame } from './board.ts';
import { CARDS } from './cards.ts';
import { legalMoves } from './moves.ts';
import { applyMove, beginDraft, canPlayCard, draftDue, pickCard, playCard } from './game.ts';
import type { Rng } from './rng.ts';
import { makeRng, pick } from './rng.ts';

const VALUE: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 1000 };

/** Greedy-random policy: take the most valuable capture, else a random move. */
export function choosePly(s: GameState, rng: Rng): Move {
  const moves = legalMoves(s);
  let best: Move[] = [];
  let bestV = 0;
  for (const m of moves) {
    const victim = m.enPassant ? 1 : (s.board[m.to]?.type ? VALUE[s.board[m.to]!.type]! : 0);
    if (victim > bestV) { bestV = victim; best = [m]; } else if (victim === bestV && victim > 0) best.push(m);
  }
  return pick(rng, best.length ? best : moves);
}

export interface GameResult { winner: Color | 'draw'; cards: Record<Color, string[]>; plies: number }

export function playGame(rng: Rng, cardUseProb = 0.35): GameResult {
  const s = newGame();
  const usedAny: Record<Color, Set<string>> = { w: new Set(), b: new Set() };
  while (!s.winner) {
    const me = s.turn;
    if (draftDue(s)) pickCard(s, me, pick(rng, beginDraft(s, rng)));
    for (const id of s.cards[me].hand) usedAny[me].add(id);
    if (rng() < cardUseProb) {
      for (const id of [...s.cards[me].hand]) {
        const def = CARDS[id];
        if (def?.kind !== 'active') continue;
        const opts = def.options?.(s, me).filter((sel) => canPlayCard(s, me, id, sel)) ?? [];
        if (opts.length) { playCard(s, me, id, pick(rng, opts)); break; }
      }
    }
    applyMove(s, choosePly(s, rng));
  }
  return { winner: s.winner, cards: { w: [...usedAny.w], b: [...usedAny.b] }, plies: s.ply };
}

/** Wilson 95% interval half-width for a win rate. */
const wilson = (w: number, n: number): number => (n ? 1.96 * Math.sqrt((w / n) * (1 - w / n) / n + 1 / (4 * n * n)) / (1 + 3.84 / n) : 0);

export function runSim(games: number, seed: number) {
  const rng = makeRng(seed);
  const stat: Record<string, { n: number; w: number }> = {};
  let white = 0, black = 0, draw = 0, plies = 0;
  for (let i = 0; i < games; i++) {
    const r = playGame(rng);
    plies += r.plies;
    if (r.winner === 'w') white++; else if (r.winner === 'b') black++; else draw++;
    for (const c of ['w', 'b'] as Color[]) {
      for (const id of r.cards[c]) {
        const e = (stat[id] ??= { n: 0, w: 0 });
        e.n++;
        if (r.winner === c) e.w++; else if (r.winner === 'draw') e.w += 0.5;
      }
    }
  }
  return { games, white, black, draw, avgPlies: plies / games, stat };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const games = Number(process.argv[2] ?? 2000), seed = Number(process.argv[3] ?? 1);
  const r = runSim(games, seed);
  console.log(`games=${r.games} white=${r.white} black=${r.black} draw=${r.draw} avgPlies=${r.avgPlies.toFixed(1)}`);
  console.log('card'.padEnd(14), 'n'.padStart(6), 'winrate'.padStart(8), '±95%'.padStart(7), 'stars');
  for (const [id, e] of Object.entries(r.stat).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n)) {
    console.log(id.padEnd(14), String(e.n).padStart(6), (e.w / e.n * 100).toFixed(1).padStart(7) + '%', ('±' + (wilson(e.w, e.n) * 100).toFixed(1)).padStart(7), CARDS[id]!.stars);
  }
  void other;
}
