/**
 * Bot-vs-bot simulator: per-card win rates for balance tuning.
 * usage: node src/sim.ts [games=200] [level=1] [seed=1] [--mirror]
 */
import type { CardId, Color } from './types.ts';
import { CARDS, CARD_ORDER } from './registry.ts';
import { newGame } from './game.ts';
import type { BotLevel } from './bot.ts';
import { applyDecision, decide } from './bot.ts';
import { makeRng } from './rng.ts';

export interface SimResult {
  games: number; white: number; black: number; draw: number; avgPlies: number;
  stat: Record<CardId, { n: number; score: number }>;
  reasons: Record<string, number>;
}

export function runSim(games: number, level: BotLevel, seed: number, mirror = false): SimResult {
  const rng = makeRng(seed);
  const r: SimResult = { games, white: 0, black: 0, draw: 0, avgPlies: 0, stat: {}, reasons: {} };
  for (let g = 0; g < games; g++) {
    const s = newGame({ seed: Math.floor(rng() * 2 ** 31), mirror });
    while (!s.winner) applyDecision(s, decide(s, { level, rng }));
    r.avgPlies += s.ply / games;
    r.reasons[s.endReason!] = (r.reasons[s.endReason!] ?? 0) + 1;
    if (s.winner === 'w') r.white++; else if (s.winner === 'b') r.black++; else r.draw++;
    for (const c of ['w', 'b'] as Color[]) {
      for (const id of [...s.cards[c].hand, ...s.cards[c].used]) {
        const e = (r.stat[id] ??= { n: 0, score: 0 });
        e.n++;
        e.score += s.winner === c ? 1 : s.winner === 'draw' ? 0.5 : 0;
      }
    }
  }
  return r;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [games = '200', level = '1', seed = '1'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const t0 = Date.now();
  const r = runSim(Number(games), Number(level) as BotLevel, Number(seed), process.argv.includes('--mirror'));
  console.log(`games=${r.games} white=${r.white} black=${r.black} draw=${r.draw} avgPlies=${r.avgPlies.toFixed(1)} time=${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log('reasons', JSON.stringify(r.reasons));
  const rows = CARD_ORDER.filter((id) => r.stat[id]).map((id) => ({ id, ...r.stat[id]!, wr: r.stat[id]!.score / r.stat[id]!.n }));
  rows.sort((a, b) => b.wr - a.wr);
  console.log(JSON.stringify(rows.map((x) => ({ id: x.id, n: x.n, wr: +x.wr.toFixed(3), stars: CARDS[x.id]!.stars }))));
}
