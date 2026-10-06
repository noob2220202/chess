import crypto from 'node:crypto';
import type { CardId, Color, GameState, Move, PieceType } from '../../engine/src/index.ts';
import {
  CARDS, applyMove, endGame, isLegal, newGame, other, pickCard, playCard, publicView, rankedPool, canPlayCard,
} from '../../engine/src/index.ts';
import type { QueueMode, TimeControl } from './config.ts';
import type { GameAction, GameRecord } from './store.ts';

export interface Seat { userId: number; username: string; rating: number; rd: number; provisional: boolean }

export interface GameView {
  id: string;
  mode: QueueMode;
  rated: boolean;
  /** Started from a friend challenge or invite code (not the matchmaking queue). */
  friendly: boolean;
  /** Player user ids, so clients can offer a rematch. */
  userIds: Record<Color, number>;
  you: Color | null;
  players: Record<Color, { username: string; rating: number; provisional: boolean }>;
  state: GameState;
  clocks: Record<Color, number>;
  /** Server timestamp when the current turn's clock started. */
  turnStartedAt: number;
  serverNow: number;
  increment: number;
  drawOffer: Color | null;
  /** Deadline for the first moves after which the game is aborted. */
  abortAt: number | null;
  result: { winner: Color | 'draw' | 'aborted'; reason: string; ratingDelta?: Record<Color, number> } | null;
  lastAction: GameAction | null;
}

export type ClientAction =
  | { type: 'pick'; id: string }
  | { type: 'card'; id: string; sel: number[] }
  | { type: 'move'; move: Move }
  | { type: 'resign' }
  | { type: 'draw'; action: 'offer' | 'accept' | 'decline' };

const PROMOS: PieceType[] = ['Q', 'R', 'B', 'N'];

/** Strictly parse an untrusted move object. */
export function parseMove(x: unknown): Move | null {
  if (!x || typeof x !== 'object') return null;
  const m = x as Record<string, unknown>;
  const sqOk = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 64;
  if (!sqOk(m.from) || !sqOk(m.to)) return null;
  const out: Move = { from: m.from as number, to: m.to as number };
  if (m.promotion !== undefined) {
    if (!PROMOS.includes(m.promotion as PieceType)) return null;
    out.promotion = m.promotion as PieceType;
  }
  if (m.castle !== undefined) {
    if (m.castle !== 'K' && m.castle !== 'Q') return null;
    out.castle = m.castle;
  }
  if (m.enPassant !== undefined) {
    if (m.enPassant !== true) return null;
    out.enPassant = true;
  }
  return out;
}

export interface RoomEvents {
  update(room: Room): void;
  end(room: Room): void;
}

/**
 * One authoritative game. All clocks are measured on the server.
 * The room never trusts the client's view of time or legality.
 */
export class Room {
  readonly id = crypto.randomUUID();
  readonly createdAt = Date.now();
  readonly seed = crypto.randomInt(0, 2 ** 31);
  readonly mode: QueueMode;
  readonly rated: boolean;
  readonly friendly: boolean;
  readonly seats: Record<Color, Seat>;
  readonly tc: TimeControl;
  readonly state: GameState;
  readonly actions: GameAction[] = [];
  clocks: Record<Color, number>;
  turnStartedAt: number;
  drawOffer: Color | null = null;
  result: GameView['result'] = null;
  private timer: NodeJS.Timeout | null = null;
  private events: RoomEvents;
  private abortMs: number;
  private now: () => number;

  constructor(mode: QueueMode, seats: Record<Color, Seat>, tc: TimeControl, events: RoomEvents, opts: { abortMs: number; now?: () => number; friendly?: boolean }) {
    this.mode = mode;
    this.friendly = opts.friendly ?? false;
    this.rated = mode === 'rated';
    this.seats = seats;
    this.tc = tc;
    this.events = events;
    this.abortMs = opts.abortMs;
    this.now = opts.now ?? Date.now;
    this.state = newGame({ seed: this.seed, mirror: this.rated, pool: this.rated ? rankedPool() : undefined });
    this.clocks = { w: tc.baseMs, b: tc.baseMs };
    this.turnStartedAt = this.now();
    this.schedule();
  }

  colorOf(userId: number): Color | null {
    if (this.seats.w.userId === userId) return 'w';
    if (this.seats.b.userId === userId) return 'b';
    return null;
  }

  get ended(): boolean { return this.result !== null; }

  /** Is the game still in the abort window (a side has not made its first move)? */
  private abortDeadline(): number | null {
    if (this.state.cards[this.state.turn].moves > 0 || this.state.ply >= 2) return null;
    return this.turnStartedAt + this.abortMs;
  }

  private remaining(c: Color, now = this.now()): number {
    return c === this.state.turn && !this.ended ? this.clocks[c] - (now - this.turnStartedAt) : this.clocks[c];
  }

  /** Check flags and the abort window. Returns true if the game ended. */
  tick(now = this.now()): boolean {
    if (this.ended) return true;
    const abortAt = this.abortDeadline();
    if (abortAt !== null && now >= abortAt) { this.finish('aborted', 'abort'); return true; }
    const t = this.state.turn;
    if (this.remaining(t, now) <= 0) {
      this.clocks[t] = 0;
      endGame(this.state, other(t), 'timeout');
      this.finish(other(t), 'timeout');
      return true;
    }
    return false;
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.ended) return;
    const now = this.now();
    const abortAt = this.abortDeadline();
    let at = now + Math.max(0, this.remaining(this.state.turn, now));
    if (abortAt !== null) at = Math.min(at, abortAt);
    this.timer = setTimeout(() => { if (this.tick()) return; this.schedule(); }, Math.max(10, at - now + 5));
    this.timer.unref?.();
  }

  /** Apply a player's action. Throws a user-facing Error on invalid input. */
  act(userId: number, a: ClientAction): void {
    const me = this.colorOf(userId);
    if (!me) throw new Error('이 대국의 참가자가 아니에요.');
    if (this.tick()) throw new Error('대국이 이미 끝났어요.');
    const s = this.state;
    const now = this.now();
    const at = now - this.createdAt;

    switch (a.type) {
      case 'resign': {
        if (s.ply < 2 && s.cards[me].moves === 0) { this.finish('aborted', 'abort'); return; }
        endGame(s, other(me), 'resign');
        this.finish(other(me), 'resign');
        return;
      }
      case 'draw': {
        if (a.action === 'offer') {
          if (this.drawOffer === other(me)) return this.agreeDraw();
          this.drawOffer = me;
        } else if (a.action === 'accept') {
          if (this.drawOffer !== other(me)) throw new Error('받을 무승부 제안이 없어요.');
          return this.agreeDraw();
        } else {
          if (this.drawOffer === other(me)) this.drawOffer = null;
        }
        this.events.update(this);
        return;
      }
      default:
        break;
    }

    if (s.turn !== me) throw new Error('상대 차례예요.');
    if (a.type === 'pick') {
      if (typeof a.id !== 'string') throw new Error('잘못된 카드예요.');
      try { pickCard(s, me, a.id); } catch { throw new Error('고를 수 없는 카드예요.'); }
      this.record({ t: 'pick', c: me, id: a.id, at });
    } else if (a.type === 'card') {
      if (typeof a.id !== 'string' || !Array.isArray(a.sel) || a.sel.length > 4 || !a.sel.every((x) => Number.isInteger(x) && x >= 0 && x < 64)) {
        throw new Error('잘못된 카드 사용이에요.');
      }
      if (!canPlayCard(s, me, a.id, a.sel)) throw new Error('지금은 그 카드를 쓸 수 없어요.');
      playCard(s, me, a.id, a.sel);
      this.record({ t: 'card', c: me, id: a.id, sel: a.sel, at });
    } else if (a.type === 'move') {
      const m = parseMove(a.move);
      if (!m) throw new Error('잘못된 수예요.');
      if (s.cards[me].offer) throw new Error('먼저 카드를 골라주세요.');
      if (!isLegal(s, m)) throw new Error('둘 수 없는 수예요.');
      this.clocks[me] = this.remaining(me, now) + this.tc.incMs;
      applyMove(s, m, true);
      this.turnStartedAt = now;
      if (this.drawOffer === other(me)) this.drawOffer = null; // moving declines an offer
      this.record({ t: 'move', c: me, move: m, at });
    } else {
      throw new Error('알 수 없는 동작이에요.');
    }

    if (s.winner) {
      this.finish(s.winner, s.endReason ?? 'end');
      return;
    }
    this.schedule();
    this.events.update(this);
  }

  private agreeDraw(): void {
    endGame(this.state, 'draw', 'agreement');
    this.finish('draw', 'agreement');
  }

  private record(a: GameAction): void { this.actions.push(a); }

  /** End the game (from rules, clock, resignation, or abort). */
  finish(winner: Color | 'draw' | 'aborted', reason: string): void {
    if (this.ended) return;
    const now = this.now();
    if (!this.result) {
      const t = this.state.turn;
      this.clocks[t] = Math.max(0, this.remaining(t, now));
    }
    this.result = { winner, reason };
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.events.end(this);
  }

  view(viewer: Color | null): GameView {
    const now = this.now();
    return {
      id: this.id, mode: this.mode, rated: this.rated, friendly: this.friendly, userIds: { w: this.seats.w.userId, b: this.seats.b.userId }, you: viewer,
      players: {
        w: { username: this.seats.w.username, rating: Math.round(this.seats.w.rating), provisional: this.seats.w.provisional },
        b: { username: this.seats.b.username, rating: Math.round(this.seats.b.rating), provisional: this.seats.b.provisional },
      },
      state: publicView(this.state, viewer),
      clocks: { ...this.clocks }, turnStartedAt: this.turnStartedAt, serverNow: now, increment: this.tc.incMs,
      drawOffer: this.drawOffer, abortAt: this.abortDeadline(), result: this.result,
      lastAction: this.actions.at(-1) ?? null,
    };
  }

  cardsOf(c: Color): CardId[] { return [...this.state.cards[c].hand, ...this.state.cards[c].used].filter((id) => CARDS[id]); }

  record0(season: number): GameRecord {
    return {
      id: this.id, mode: this.mode, rated: this.rated, season, whiteId: this.seats.w.userId, blackId: this.seats.b.userId,
      seed: this.seed, mirror: this.rated, baseMs: this.tc.baseMs, incMs: this.tc.incMs, actions: this.actions,
      result: null, reason: null, whiteBefore: null, whiteAfter: null, blackBefore: null, blackAfter: null,
      whiteCards: [], blackCards: [], createdAt: new Date(this.createdAt).toISOString(), endedAt: null,
    };
  }

  dispose(): void { if (this.timer) clearTimeout(this.timer); }
}

/** Rebuild the final state of a recorded game (replays, audits). */
export function replay(rec: Pick<GameRecord, 'seed' | 'mirror' | 'actions'>): GameState {
  const s = newGame({ seed: rec.seed, mirror: rec.mirror, pool: rec.mirror ? rankedPool() : undefined });
  for (const a of rec.actions) {
    if (a.t === 'pick') pickCard(s, a.c, a.id!);
    else if (a.t === 'card') playCard(s, a.c, a.id!, a.sel!);
    else applyMove(s, a.move as Move);
  }
  return s;
}
