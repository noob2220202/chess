import type { CardId, Color, Effect, GameState, Move, Piece, PieceType, Square } from './types.ts';

export type CardCategory = 'OPENING' | 'MIDDLE' | 'END';

/** Where a hook is coming from: a passive card in hand, or a live effect created by an active card. */
export interface Source { owner: Color; effect: Effect | null }

export interface MoveContext {
  move: Move;
  mover: Color;
  /** The moving piece after the move (already promoted). */
  piece: Piece;
  captured: Piece | null;
}

export interface TargetSpec {
  prompt: string;
  /** May this square be the next pick, given earlier picks? */
  ok: (s: GameState, owner: Color, at: Square, picked: Square[]) => boolean;
}

export interface Demo {
  /** FEN-like placement. White (the learner) is at the bottom. */
  board: string;
  /** Instruction shown while playing the demo. */
  text: string;
  /** Text shown after the goal is reached. */
  done: string;
  /** Cards held by White (default: the demoed card) and Black (default: none). */
  white?: CardId[];
  black?: CardId[];
  /** Optional state tweak after the board is set up (e.g. move counters, lost pieces). */
  setup?: (s: GameState) => void;
  /** Goal reached after the learner's action. */
  goal: (s: GameState, last: DemoAction) => boolean;
}
export type DemoAction =
  | { kind: 'move'; move: Move; piece: PieceType; captured: PieceType | null }
  | { kind: 'card'; id: CardId; sel: Square[] };

export interface CardDef {
  id: CardId;
  name: string;
  kind: 'passive' | 'active';
  category: CardCategory;
  /** Design rating 1..5 (half steps). Higher = rarer in drafts. Tuned from simulation data. */
  stars: number;
  description: string;
  /** Short rules clarification shown in the encyclopedia. */
  detail?: string;
  /** Excluded from the rated pool. */
  casualOnly?: boolean;
  demo: Demo;

  // ---- passive / effect hooks ----
  onAcquire?: (s: GameState, owner: Color) => void;
  /** Extra pseudo-moves for one of the source owner's pieces. Must not land on own pieces. */
  extraMoves?: (s: GameState, from: Square, piece: Piece, src: Source) => Move[];
  /** Veto any move by either side. */
  allowMove?: (s: GameState, m: Move, mover: Color, src: Source) => boolean;
  /** Veto captures of the source owner's pieces. Return true to protect. */
  protects?: (s: GameState, attackerSq: Square, targetSq: Square, src: Source) => boolean;
  /** Filter the full move list of `color` (e.g. forced captures). */
  filterMoves?: (s: GameState, color: Color, moves: Move[], src: Source) => Move[];
  afterMove?: (s: GameState, ctx: MoveContext, src: Source) => void;
  /** Called at the start of every turn (s.turn is the side about to move). */
  onTurnStart?: (s: GameState, src: Source) => void;
  /** Return true to cancel a capture of the owner's king (the attacker is removed instead). */
  saveKing?: (s: GameState, attackerSq: Square, src: Source) => boolean;
  /** Called after `mover` finishes a move (before the ply advances). Return true to let `mover` move again. */
  keepTurn?: (s: GameState, mover: Color, src: Source) => boolean;
  /** Return true to stop `color` from playing active cards. */
  blocksCards?: (s: GameState, color: Color, src: Source) => boolean;

  // ---- active ----
  targets?: TargetSpec[];
  /** Extra precondition before targeting. */
  canPlay?: (s: GameState, owner: Color) => boolean;
  activate?: (s: GameState, owner: Color, sel: Square[]) => void;
}

export const CARDS: Record<CardId, CardDef> = {};
export const CARD_ORDER: CardId[] = [];

export function register(...defs: CardDef[]): void {
  for (const d of defs) {
    if (CARDS[d.id]) throw new Error(`duplicate card ${d.id}`);
    CARDS[d.id] = d;
    CARD_ORDER.push(d.id);
  }
}

/** All hook sources currently in play: passives in hand and live effects. */
export function sources(s: GameState): Array<{ def: CardDef; src: Source }> {
  const out: Array<{ def: CardDef; src: Source }> = [];
  for (const owner of ['w', 'b'] as const) {
    for (const id of s.cards[owner].hand) {
      const def = CARDS[id];
      if (def && def.kind === 'passive') out.push({ def, src: { owner, effect: null } });
    }
  }
  for (const effect of s.effects) {
    if (effect.until <= s.ply) continue;
    const def = CARDS[effect.card];
    if (def) out.push({ def, src: { owner: effect.owner, effect } });
  }
  return out;
}

/** Draft weight: stronger cards appear less often. */
export const draftWeight = (stars: number): number => Math.max(3, Math.round(12 - 2 * stars));
