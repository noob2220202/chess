import type { CardId, Color, GameState, Move, Square } from './types.ts';
import { other } from './types.ts';
import { PIECE_VALUE, cloneState, findKing } from './board.ts';
import { CARDS } from './registry.ts';
import { captureSquare, legalMoves } from './rules.ts';
import { applyMove, cardReady, pickCard, playCard, targetOptions } from './game.ts';
import type { Rng } from './rng.ts';
import { makeRng } from './rng.ts';

export type BotLevel = 1 | 2 | 3;
export type BotDecision =
  | { kind: 'pick'; id: CardId }
  | { kind: 'turn'; card: { id: CardId; sel: Square[] } | null; move: Move };

const WIN = 100000;
const CENTER_BONUS = [0, 0.02, 0.05, 0.08, 0.08, 0.05, 0.02, 0];

/** Static evaluation from `color`'s point of view. */
export function evaluate(s: GameState, color: Color): number {
  if (s.winner) return s.winner === 'draw' ? 0 : s.winner === color ? WIN : -WIN;
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.board[i];
    if (!p) continue;
    let v = PIECE_VALUE[p.type] + CENTER_BONUS[i & 7]! + CENTER_BONUS[i >> 3]!;
    if (p.type === 'P') v += 0.06 * (p.color === 'w' ? (i >> 3) - 1 : 6 - (i >> 3));
    score += p.color === color ? v : -v;
  }
  for (const c of ['w', 'b'] as const) {
    const unused = s.cards[c].hand.filter((id) => CARDS[id]?.kind === 'active').length;
    score += (c === color ? 1 : -1) * 0.6 * unused;
  }
  return score;
}

function orderMoves(s: GameState, moves: Move[]): Move[] {
  const key = (m: Move) => {
    const c = captureSquare(s, m);
    if (c < 0) return m.promotion ? 8 : 0;
    const v = s.board[c]!, a = s.board[m.from]!;
    return v.type === 'K' ? 1000 : 10 * PIECE_VALUE[v.type] - PIECE_VALUE[a.type];
  };
  return moves.map((m) => [key(m), m] as const).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
}

interface SearchCtx { nodes: number; limit: number }

function negamax(s: GameState, depth: number, alpha: number, beta: number, ctx: SearchCtx): number {
  const me = s.turn;
  if (s.winner || depth === 0 || ctx.nodes > ctx.limit) return evaluate(s, me);
  if (s.cards[me].offer) return evaluate(s, me); // a draft interrupts search; treat as leaf
  const moves = orderMoves(s, legalMoves(s));
  // Immediate king capture.
  for (const m of moves) {
    const c = captureSquare(s, m);
    if (c >= 0 && s.board[c]!.type === 'K') return WIN - 1;
  }
  let best = -Infinity;
  for (const m of moves) {
    ctx.nodes++;
    const c = cloneState(s);
    applyMove(c, m, true);
    // A card can give the same side another move; then the child score is already ours.
    const v = c.winner ? evaluate(c, me) : c.turn === me ? negamax(c, depth - 1, alpha, beta, ctx) : -negamax(c, depth - 1, -beta, -alpha, ctx);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  // Winning positions found deeper are worth slightly less (prefer faster wins).
  return best === -Infinity ? evaluate(s, me) : best > WIN / 2 ? best - 1 : best < -WIN / 2 ? best + 1 : best;
}

function bestMove(s: GameState, depth: number, ctx: SearchCtx, rng: Rng, noise: number): { move: Move; score: number } | null {
  const me = s.turn;
  const moves = orderMoves(s, legalMoves(s));
  let best: { move: Move; score: number } | null = null;
  for (const m of moves) {
    const c = cloneState(s);
    applyMove(c, m, true);
    let v = c.winner ? evaluate(c, me) : c.turn === me ? negamax(c, depth - 1, -Infinity, Infinity, ctx) : -negamax(c, depth - 1, -Infinity, Infinity, ctx);
    v += (rng() - 0.5) * noise;
    if (!best || v > best.score) best = { move: m, score: v };
  }
  return best;
}

function allSelections(s: GameState, color: Color, id: CardId, picked: Square[] = [], cap = 40): Square[][] {
  const n = CARDS[id]!.targets?.length ?? 0;
  if (picked.length === n) return [picked];
  const out: Square[][] = [];
  for (const x of targetOptions(s, color, id, picked)) {
    for (const sel of allSelections(s, color, id, [...picked, x], cap)) {
      out.push(sel);
      if (out.length >= cap) return out;
    }
  }
  return out;
}

export interface BotOptions { level: BotLevel; seed?: number; rng?: Rng }

const DEPTH: Record<BotLevel, number> = { 1: 1, 2: 2, 3: 3 };
const NOISE: Record<BotLevel, number> = { 1: 2.5, 2: 0.4, 3: 0.1 };
const NODE_LIMIT: Record<BotLevel, number> = { 1: 2000, 2: 25000, 3: 120000 };

/** Decide the bot's whole turn: a draft pick, or an optional card plus a move. */
export function decide(s: GameState, opts: BotOptions): BotDecision {
  const rng = opts.rng ?? makeRng(opts.seed ?? 1);
  const me = s.turn;
  const offer = s.cards[me].offer;
  if (offer && offer.length) {
    const scored = offer.map((id) => [CARDS[id]!.stars + rng() * (opts.level === 1 ? 3 : 1), id] as const);
    scored.sort((a, b) => b[0] - a[0]);
    return { kind: 'pick', id: scored[0]![1] };
  }
  const depth = DEPTH[opts.level], noise = NOISE[opts.level];
  const ctx: SearchCtx = { nodes: 0, limit: NODE_LIMIT[opts.level] };
  const base = bestMove(s, depth, ctx, rng, noise);
  let plan: BotDecision | null = base ? { kind: 'turn', card: null, move: base.move } : null;
  let planScore = base ? base.score : -Infinity;

  // Consider each playable active card at the root, with a shallower search after it.
  const cardBonus = -0.6; // using a card spends its stored value (mirrors evaluate)
  for (const id of s.cards[me].hand) {
    if (!cardReady(s, me, id)) continue;
    for (const sel of allSelections(s, me, id)) {
      const c = cloneState(s);
      playCard(c, me, id, sel);
      if (c.winner) return { kind: 'turn', card: { id, sel }, move: base?.move ?? legalMoves(s)[0]! };
      const r = bestMove(c, Math.max(1, depth - 1), { nodes: 0, limit: ctx.limit / 4 }, rng, noise);
      if (!r) continue;
      const score = r.score + cardBonus + 0.05;
      if (score > planScore + 0.15) { planScore = score; plan = { kind: 'turn', card: { id, sel }, move: r.move }; }
    }
  }
  if (!plan) throw new Error('bot has no move');
  return plan;
}

/** Apply a bot decision to the state. */
export function applyDecision(s: GameState, d: BotDecision): void {
  const me = s.turn;
  if (d.kind === 'pick') return pickCard(s, me, d.id);
  if (d.card) playCard(s, me, d.card.id, d.card.sel);
  if (!s.winner) applyMove(s, d.move);
}

export const kingsAlive = (s: GameState): boolean => findKing(s, 'w') >= 0 && findKing(s, 'b') >= 0;
void other;
