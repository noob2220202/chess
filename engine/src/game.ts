import type { CardId, Color, EndReason, GameState, Move, Square } from './types.ts';
import { file, other, rank, sq } from './types.ts';
import { START_PLACEMENT, cloneState, findKing, fromPlacement, positionKey } from './board.ts';
import type { CardCategory, DemoAction } from './registry.ts';
import { CARDS, CARD_ORDER, draftWeight, sources } from './registry.ts';
import { captureSquare, legalMoves, sameMove } from './rules.ts';
import type { Rng } from './rng.ts';
import { makeRng, weightedPick } from './rng.ts';
import './cards/index.ts';

/** Own-move counts at which a draft round is offered. */
export const DRAFT_AT: readonly number[] = [0, 10, 20];
export const DRAFT_ROUNDS: readonly CardCategory[] = ['OPENING', 'MIDDLE', 'END'];
export const OFFER_SIZE = 3;
export const PLY_LIMIT = 300;
export const QUIET_LIMIT = 100;

export interface NewGameOptions {
  seed?: number;
  /** Both players are offered the same cards each round (rated play). */
  mirror?: boolean;
  /** Card pool. Defaults to all cards (rated: cards without casualOnly). */
  pool?: CardId[];
  /** Disable drafting (plain chess with king capture). */
  noDraft?: boolean;
  placement?: string;
}

export const rankedPool = (): CardId[] => CARD_ORDER.filter((id) => !CARDS[id]!.casualOnly);

/** Pick OFFER_SIZE distinct cards per round from the round's category, weighted by rarity. */
export function planDraft(rng: Rng, pool: CardId[]): CardId[][] {
  return DRAFT_ROUNDS.map((cat) => {
    const cands = pool.map((id) => CARDS[id]!).filter((c) => c.category === cat);
    const out: CardId[] = [];
    while (out.length < OFFER_SIZE && cands.length) {
      const c = weightedPick(rng, cands, (x) => draftWeight(x.stars));
      out.push(c.id);
      cands.splice(cands.indexOf(c), 1);
    }
    return out;
  });
}

export function newGame(opts: NewGameOptions = {}): GameState {
  const s = fromPlacement(opts.placement ?? START_PLACEMENT);
  if (!opts.noDraft) {
    const rng = makeRng(opts.seed ?? Math.floor(Math.random() * 2 ** 31));
    const pool = opts.pool ?? CARD_ORDER;
    const w = planDraft(rng, pool);
    s.draftPlan = { w, b: opts.mirror ? w.map((r) => [...r]) : planDraft(rng, pool) };
  }
  startTurn(s);
  return s;
}

export function draftDue(s: GameState, color: Color = s.turn): boolean {
  const p = s.cards[color];
  const r = p.draftsTaken;
  return r < s.draftPlan[color].length && r < DRAFT_AT.length && DRAFT_AT[r]! <= p.moves;
}

function finish(s: GameState, winner: Color | 'draw', reason: EndReason): void {
  if (s.winner) return;
  s.winner = winner;
  s.endReason = reason;
}

/** End the game from outside the rules (resign, timeout...). */
export function endGame(s: GameState, winner: Color | 'draw', reason: EndReason): void {
  finish(s, winner, reason);
}

/** Begin the turn of `s.turn`: limits, effect expiry, turn-start hooks, draft offer, stalemate. */
function startTurn(s: GameState): void {
  if (s.winner) return;
  if (!s.sandbox) {
    const key = positionKey(s);
    s.seen[key] = (s.seen[key] ?? 0) + 1;
    if (s.seen[key]! >= 3) return finish(s, 'draw', 'repetition');
    if (s.quiet >= QUIET_LIMIT) return finish(s, 'draw', 'quiet-limit');
    if (s.ply >= PLY_LIMIT) return finish(s, 'draw', 'ply-limit');
  }
  s.effects = s.effects.filter((e) => e.until > s.ply);
  for (const { def, src } of sources(s)) def.onTurnStart?.(s, src);
  if (s.winner) return;
  for (const c of ['w', 'b'] as const) if (findKing(s, c) < 0) return finish(s, other(c), 'card-win');
  if (draftDue(s)) {
    const p = s.cards[s.turn];
    p.offer = [...s.draftPlan[s.turn][p.draftsTaken]!];
    return;
  }
  checkNoMoves(s);
}

function checkNoMoves(s: GameState): void {
  if (!s.winner && !s.sandbox && legalMoves(s).length === 0) finish(s, other(s.turn), 'no-moves');
}

export function pickCard(s: GameState, color: Color, id: CardId): void {
  const p = s.cards[color];
  if (s.winner) throw new Error('game is over');
  if (s.turn !== color || !p.offer) throw new Error('no draft pending');
  if (!p.offer.includes(id)) throw new Error(`card ${id} is not on offer`);
  p.hand.push(id);
  p.offer = null;
  p.draftsTaken++;
  const def = CARDS[id]!;
  if (def.kind === 'passive') def.onAcquire?.(s, color);
  for (const c of ['w', 'b'] as const) if (findKing(s, c) < 0) return finish(s, other(c), 'card-win');
  checkNoMoves(s);
}

/** Squares valid as the next target of an active card, given earlier picks. */
export function targetOptions(s: GameState, color: Color, id: CardId, picked: Square[]): Square[] {
  const def = CARDS[id];
  const spec = def?.targets?.[picked.length];
  if (!spec) return [];
  const out: Square[] = [];
  for (let x = 0; x < 64; x++) if (spec.ok(s, color, x, picked)) out.push(x);
  return out;
}

/** Can the card be started (ignoring targets)? */
export function cardReady(s: GameState, color: Color, id: CardId): boolean {
  const def = CARDS[id];
  if (!def || def.kind !== 'active' || s.winner || s.turn !== color) return false;
  const p = s.cards[color];
  if (p.offer || !p.hand.includes(id) || s.cardPly === s.ply) return false;
  if (def.canPlay && !def.canPlay(s, color)) return false;
  if (sources(s).some(({ def: d, src }) => d.blocksCards?.(s, color, src))) return false;
  // At least one complete selection must exist.
  return hasCompletion(s, color, id, []);
}

function hasCompletion(s: GameState, color: Color, id: CardId, picked: Square[]): boolean {
  const n = CARDS[id]!.targets?.length ?? 0;
  if (picked.length === n) return true;
  return targetOptions(s, color, id, picked).some((x) => hasCompletion(s, color, id, [...picked, x]));
}

export function canPlayCard(s: GameState, color: Color, id: CardId, sel: Square[]): boolean {
  if (!cardReady(s, color, id)) return false;
  const n = CARDS[id]!.targets?.length ?? 0;
  if (sel.length !== n) return false;
  for (let i = 0; i < n; i++) if (!targetOptions(s, color, id, sel.slice(0, i)).includes(sel[i]!)) return false;
  return true;
}

/** Play an active card. It does not use up the turn, but only one card may be played per turn. */
export function playCard(s: GameState, color: Color, id: CardId, sel: Square[]): void {
  if (!canPlayCard(s, color, id, sel)) throw new Error(`cannot play ${id}`);
  const p = s.cards[color];
  CARDS[id]!.activate!(s, color, sel);
  p.hand.splice(p.hand.indexOf(id), 1);
  p.used.push(id);
  s.cardPly = s.ply;
  for (const c of ['w', 'b'] as const) if (findKing(s, c) < 0) return finish(s, other(c), 'card-win');
  checkNoMoves(s);
}

export function isLegal(s: GameState, m: Move): boolean {
  return legalMoves(s).some((x) => sameMove(x, m));
}

/** Apply a move. `trusted` skips the legality check (search code that generated the move itself). */
export function applyMove(s: GameState, m: Move, trusted = false): GameState {
  if (s.winner) throw new Error('game is over');
  const mover = s.turn;
  if (s.cards[mover].offer) throw new Error('draft pending');
  if (!trusted && !isLegal(s, m)) throw new Error('illegal move');
  const piece = s.board[m.from]!;
  const capSq = captureSquare(s, m);
  const captured = capSq >= 0 ? s.board[capSq]! : null;

  if (captured?.type === 'K') {
    const saved = sources(s).some(({ def, src }) => src.owner === captured.color && def.saveKing?.(s, m.from, src));
    if (saved) {
      s.lost[mover].push(piece.type);
      s.board[m.from] = null;
      return endTurn(s, mover, true);
    }
  }

  if (captured) {
    s.lost[captured.color].push(captured.type);
    s.board[capSq] = null;
  }
  s.board[m.to] = piece;
  s.board[m.from] = null;
  piece.moved = true;
  if (m.promotion) piece.type = m.promotion;
  if (m.castle) {
    const r = rank(m.to);
    const rf = m.castle === 'K' ? sq(7, r) : sq(0, r);
    const rt = m.castle === 'K' ? sq(5, r) : sq(3, r);
    const rook = s.board[rf]!;
    rook.moved = true;
    s.board[rt] = rook;
    s.board[rf] = null;
  }
  s.epSquare = piece.type === 'P' && Math.abs(m.to - m.from) === 16 ? sq(file(m.from), (rank(m.from) + rank(m.to)) / 2) : null;

  if (captured?.type === 'K') {
    finish(s, mover, 'king-captured');
    s.cards[mover].moves++;
    s.ply++;
    return s;
  }
  for (const { def, src } of sources(s)) def.afterMove?.(s, { move: m, mover, piece, captured }, src);
  return endTurn(s, mover, !!captured || piece.type === 'P');
}

function endTurn(s: GameState, mover: Color, irreversible: boolean): GameState {
  s.quiet = irreversible ? 0 : s.quiet + 1;
  const again = !s.sandbox && sources(s).some(({ def, src }) => def.keepTurn?.(s, mover, src));
  s.cards[mover].moves++;
  s.ply++;
  if (!s.sandbox && !again) s.turn = other(mover);
  startTurn(s);
  return s;
}

// ---------------------------------------------------------------------------
// Tutorial / encyclopedia demos

/** Turn a hand-built position into a sandbox (White always to move): applies passives' setup and starts the turn. */
export function startSandbox(s: GameState): GameState {
  s.sandbox = true;
  s.turn = 'w';
  for (const c of ['w', 'b'] as const) {
    for (const cid of s.cards[c].hand) {
      const d = CARDS[cid];
      if (d && d.kind === 'passive') d.onAcquire?.(s, c);
    }
  }
  startTurn(s);
  return s;
}

export function demoState(id: CardId): GameState {
  const def = CARDS[id];
  if (!def) throw new Error(`unknown card ${id}`);
  const s = fromPlacement(def.demo.board);
  s.cards.w.hand = [...(def.demo.white ?? [id])];
  s.cards.b.hand = [...(def.demo.black ?? [])];
  def.demo.setup?.(s);
  return startSandbox(s);
}

/** Apply a learner action to a demo state, returning the action record for goal checks. */
export function demoAct(s: GameState, a: { move: Move } | { card: CardId; sel: Square[] }): DemoAction {
  if ('move' in a) {
    const piece = s.board[a.move.from]!.type;
    const cs = captureSquare(s, a.move);
    const captured = cs >= 0 ? s.board[cs]!.type : null;
    applyMove(s, a.move);
    return { kind: 'move', move: a.move, piece: a.move.promotion ?? piece, captured };
  }
  playCard(s, 'w', a.card, a.sel);
  return { kind: 'card', id: a.card, sel: a.sel };
}

export { cloneState };
