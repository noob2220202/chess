import { useEffect, useMemo, useRef, useState } from 'react';
import type { Color, GameState, Move, PieceType, Square } from '@engine';
import { PIECE_NAME, file, legalMoves, rank, squareName } from '@engine';
import { PieceIcon, statusClasses } from './PieceIcon.tsx';

export interface Targeting { options: Square[]; picked: Square[] }

export interface BoardProps {
  state: GameState;
  orientation: Color;
  /** Colour the viewer moves as right now, or null when the viewer cannot move. */
  actor: Color | null;
  lastMove?: { from: Square; to: Square } | null;
  targeting?: Targeting | null;
  hints?: Square[];
  onMove?: (m: Move) => void;
  onTarget?: (sq: Square) => void;
  onCancelTarget?: () => void;
}

const CENTER = [27, 28, 35, 36];

export function Board({ state, orientation, actor, lastMove, targeting, hints, onMove, onTarget, onCancelTarget }: BoardProps) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<Move[] | null>(null);
  const [drag, setDrag] = useState<{ from: Square; x: number; y: number; moved: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const downAt = useRef<{ x: number; y: number; sq: Square } | null>(null);

  // Moves for the side to move (only computed when the viewer can act).
  const myMoves = useMemo(() => (actor && state.turn === actor && !state.winner ? legalMoves(state, actor) : []), [state, actor]);
  const selPiece = selected !== null ? state.board[selected] : null;
  // Preview moves: own piece -> real moves; enemy piece -> what it could do on its turn.
  const preview = useMemo(() => {
    if (selected === null || !selPiece) return [] as Move[];
    if (actor && selPiece.color === actor && state.turn === actor) return myMoves.filter((m) => m.from === selected);
    return legalMoves(state, selPiece.color).filter((m) => m.from === selected);
  }, [selected, selPiece, myMoves, state, actor]);
  const previewIsEnemy = !!selPiece && selPiece.color !== actor;

  useEffect(() => { setSelected(null); setPromo(null); }, [state]);
  useEffect(() => { if (targeting) setSelected(null); }, [targeting]);

  const toDisplay = (s: Square) => (orientation === 'w' ? { c: file(s), r: 7 - rank(s) } : { c: 7 - file(s), r: rank(s) });
  const fromDisplay = (c: number, r: number): Square => (orientation === 'w' ? (7 - r) * 8 + c : r * 8 + (7 - c));

  function squareAt(clientX: number, clientY: number): Square | null {
    const el = wrap.current;
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const c = Math.floor(((clientX - b.left) / b.width) * 8), r = Math.floor(((clientY - b.top) / b.height) * 8);
    if (c < 0 || c > 7 || r < 0 || r > 7) return null;
    return fromDisplay(c, r);
  }

  function tryMove(to: Square): boolean {
    if (selected === null || previewIsEnemy) return false;
    const ms = myMoves.filter((m) => m.from === selected && m.to === to);
    if (!ms.length) return false;
    if (ms.length > 1 && ms.some((m) => m.promotion)) { setPromo(ms); return true; }
    onMove?.(ms[0]!);
    setSelected(null);
    return true;
  }

  function click(sq: Square) {
    if (promo) return;
    if (targeting) {
      if (targeting.options.includes(sq)) onTarget?.(sq);
      else onCancelTarget?.();
      return;
    }
    if (tryMove(sq)) return;
    const p = state.board[sq];
    if (p && sq !== selected) setSelected(sq);
    else setSelected(null);
  }

  function onPointerDown(e: React.PointerEvent) {
    const sq = squareAt(e.clientX, e.clientY);
    if (sq === null) return;
    downAt.current = { x: e.clientX, y: e.clientY, sq };
    const p = state.board[sq];
    if (!targeting && !promo && p && actor && p.color === actor && state.turn === actor) {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      setSelected(sq);
      setDrag({ from: sq, x: e.clientX, y: e.clientY, moved: false });
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const d = downAt.current;
    const moved = drag.moved || (!!d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6);
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved });
  }
  function onPointerUp(e: React.PointerEvent) {
    const sq = squareAt(e.clientX, e.clientY);
    const d = drag;
    setDrag(null);
    if (d && d.moved) {
      if (sq !== null && sq !== d.from) tryMove(sq);
      return;
    }
    if (d && sq === d.from) return; // simple click on own piece: already selected
    if (sq !== null && downAt.current?.sq === sq) click(sq);
  }

  const dests = new Map<Square, boolean>();
  for (const m of preview) dests.set(m.to, !!state.board[m.to] || !!m.enPassant);
  const effects = state.effects.filter((e) => e.until > state.ply && e.square !== undefined);
  const summit = state.cards.w.hand.includes('summit') || state.cards.b.hand.includes('summit');

  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const s = fromDisplay(c, r);
      const light = (file(s) + rank(s)) % 2 === 1;
      const cls = ['sq', light ? 'light' : 'dark'];
      if (lastMove && (lastMove.from === s || lastMove.to === s)) cls.push('last');
      if (selected === s) cls.push('sel');
      if (targeting?.picked.includes(s)) cls.push('picked');
      else if (targeting?.options.includes(s) || hints?.includes(s)) cls.push('target');
      if (summit && CENTER.includes(s)) cls.push('center-zone');
      const dest = dests.get(s);
      const eff = effects.filter((e) => e.square === s);
      squares.push(
        <div key={s} className={cls.join(' ')} data-sq={squareName(s)}>
          {c === 0 && <span className="coord r">{rank(s) + 1}</span>}
          {r === 7 && <span className="coord f">{'abcdefgh'[file(s)]}</span>}
          {eff.some((e) => e.card === 'mine') && <span className="mark mine" title="지뢰" />}
          {eff.some((e) => e.card === 'sanctuary') && <span className="mark sanct" title="성역" />}
          {dest !== undefined && <span className={`${dest ? 'ring' : 'dot'}${previewIsEnemy ? ' enemy' : ''}`} />}
        </div>,
      );
    }
  }

  const pieces = [];
  for (let s = 0; s < 64; s++) {
    const p = state.board[s];
    if (!p) continue;
    const { c, r } = toDisplay(s);
    const dragging = drag?.moved && drag.from === s;
    let style: React.CSSProperties = { transform: `translate(${c * 100}%, ${r * 100}%)` };
    if (dragging && wrap.current) {
      const b = wrap.current.getBoundingClientRect();
      const size = b.width / 8;
      style = { transform: `translate(${drag!.x - b.left - size / 2}px, ${drag!.y - b.top - size / 2}px)` };
    }
    const st = statusClasses(p, state.ply);
    pieces.push(
      <div key={p.id} className={`piece ${st}${dragging ? ' dragging' : ''}`} style={style} title={`${p.color === 'w' ? '백' : '흑'} ${PIECE_NAME[p.type]}`}>
        <PieceIcon type={p.type} color={p.color} />
        {st.includes('st-disarmed') && <span className="x">✕</span>}
      </div>,
    );
  }

  return (
    <div
      className="board-wrap"
      ref={wrap}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      role="grid"
      aria-label="체스판"
    >
      <div className="board">{squares}</div>
      <div className="pieces">{pieces}</div>
      {promo && <PromotionPicker color={state.turn} onPick={(t) => { const m = promo.find((x) => x.promotion === t)!; setPromo(null); onMove?.(m); }} onCancel={() => setPromo(null)} />}
    </div>
  );
}

function PromotionPicker({ color, onPick, onCancel }: { color: Color; onPick: (t: PieceType) => void; onCancel: () => void }) {
  return (
    <div className="modal-backdrop" style={{ position: 'absolute', borderRadius: 10 }} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={onCancel}>
      <div className="panel pad" onClick={(e) => e.stopPropagation()}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>승진할 기물</div>
        <div className="row">
          {(['Q', 'R', 'B', 'N'] as const).map((t) => (
            <button key={t} className="btn" style={{ width: 64, height: 64, padding: 6 }} onClick={() => onPick(t)} aria-label={PIECE_NAME[t]}>
              <img src={`/pieces/${color}${t}.svg`} alt="" style={{ width: 48, height: 48 }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
