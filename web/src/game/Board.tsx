import { useEffect, useMemo, useRef, useState } from 'react';
import type { Color, GameState, Move, PieceType, Square } from '@engine';
import { PIECE_NAME, file, findKing, inCheck, legalMoves, pseudoMoves, rank, squareName } from '@engine';
import { useSettings } from '../lib/settings.tsx';
import { PieceIcon, statusBadges } from './PieceIcon.tsx';

export interface Targeting { options: Square[]; picked: Square[] }
export interface Guide { squares: Square[]; label?: string }

export interface BoardProps {
  state: GameState;
  orientation: Color;
  /** Colour the viewer moves as right now, or null when the viewer cannot move. */
  actor: Color | null;
  lastMove?: { from: Square; to: Square } | null;
  targeting?: Targeting | null;
  guide?: Guide | null;
  onMove?: (m: Move) => void;
  onTarget?: (sq: Square) => void;
  onCancelTarget?: () => void;
}

const CENTER = [27, 28, 35, 36];
const END_MARK: Record<string, string> = { checkmate: '#', resign: '⚑', timeout: '⏱', abandon: '⚑', 'no-moves': '#', 'card-win': '✦', 'king-captured': '✕' };
type Arrow = { from: Square; to: Square; color: string };
const ARROW_COLORS = { g: 'rgba(21, 120, 27, 0.8)', r: 'rgba(190, 40, 30, 0.8)', b: 'rgba(0, 48, 136, 0.8)', y: 'rgba(225, 150, 0, 0.85)' };

export function Board({ state, orientation, actor, lastMove, targeting, guide, onMove, onTarget, onCancelTarget }: BoardProps) {
  const { s: settings } = useSettings();
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<Move[] | null>(null);
  const [drag, setDrag] = useState<{ from: Square; x: number; y: number; moved: boolean; touch: boolean } | null>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [marks, setMarks] = useState<Square[]>([]);
  const [rdrag, setRdrag] = useState<{ from: Square; color: string } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const downAt = useRef<{ x: number; y: number; sq: Square } | null>(null);

  const myMoves = useMemo(() => (actor && state.turn === actor && !state.winner ? legalMoves(state, actor) : []), [state, actor]);
  const selPiece = selected !== null ? state.board[selected] : null;
  const preview = useMemo(() => {
    if (selected === null || !selPiece) return [] as Move[];
    if (actor && selPiece.color === actor && state.turn === actor) return myMoves.filter((m) => m.from === selected);
    // The opponent's range: pseudo-legal is what matters for "what does this piece attack".
    return pseudoMoves(state, selPiece.color).filter((m) => m.from === selected);
  }, [selected, selPiece, myMoves, state, actor]);
  // King in check (or the mated king once the game is over).
  const checkSq = useMemo(() => {
    const c = state.winner ? (state.endReason === 'checkmate' ? (state.winner === 'w' ? 'b' : 'w') : null) : state.turn;
    return c && (state.endReason === 'checkmate' || inCheck(state, c)) ? findKing(state, c) : -1;
  }, [state]);
  const previewIsEnemy = !!selPiece && (selPiece.color !== actor || state.turn !== actor);

  useEffect(() => { setSelected(null); setPromo(null); setArrows([]); setMarks([]); }, [state]);
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
    setArrows([]); setMarks([]);
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
    if (e.button === 2) {
      const color = e.shiftKey ? ARROW_COLORS.r : e.altKey ? ARROW_COLORS.b : e.ctrlKey || e.metaKey ? ARROW_COLORS.y : ARROW_COLORS.g;
      setRdrag({ from: sq, color });
      return;
    }
    if (e.button !== 0) return;
    downAt.current = { x: e.clientX, y: e.clientY, sq };
    const p = state.board[sq];
    if (!targeting && !promo && p && actor && p.color === actor && state.turn === actor) {
      wrap.current?.setPointerCapture?.(e.pointerId);
      setSelected(sq);
      setDrag({ from: sq, x: e.clientX, y: e.clientY, moved: false, touch: e.pointerType === 'touch' });
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
    if (e.button === 2) {
      const r = rdrag;
      setRdrag(null);
      if (!r || sq === null) return;
      if (sq === r.from) setMarks((m) => (m.includes(sq) ? m.filter((x) => x !== sq) : [...m, sq]));
      else setArrows((a) => (a.some((x) => x.from === r.from && x.to === sq) ? a.filter((x) => !(x.from === r.from && x.to === sq)) : [...a, { from: r.from, to: sq, color: r.color }]));
      return;
    }
    const d = drag;
    setDrag(null);
    if (d && d.moved) {
      if (sq !== null && sq !== d.from) tryMove(sq);
      return;
    }
    if (d && sq === d.from) { setArrows([]); setMarks([]); return; }
    if (sq !== null && downAt.current?.sq === sq) click(sq);
  }

  const dests = new Map<Square, boolean>();
  for (const m of preview) dests.set(m.to, !!state.board[m.to] || !!m.enPassant);
  const effects = state.effects.filter((e) => e.until > state.ply && e.square !== undefined);
  const summit = state.cards.w.hand.includes('summit') || state.cards.b.hand.includes('summit');
  const guideSet = new Set(guide?.squares ?? []);

  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const s = fromDisplay(c, r);
      const light = (file(s) + rank(s)) % 2 === 1;
      const cls = ['sq', light ? 'light' : 'dark'];
      if (lastMove && (lastMove.from === s || lastMove.to === s)) cls.push('last');
      if (selected === s) cls.push('sel');
      if (targeting?.picked.includes(s)) cls.push('picked');
      else if (targeting?.options.includes(s)) cls.push('target');
      if (summit && CENTER.includes(s)) cls.push('center-zone');
      if (guideSet.has(s)) cls.push('guide');
      if (marks.includes(s)) cls.push('marked');
      if (checkSq === s) cls.push('check');
      const dest = dests.get(s);
      const eff = effects.filter((e) => e.square === s);
      squares.push(
        <div key={s} className={cls.join(' ')} data-sq={squareName(s)}>
          {c === 0 && <span className="coord r">{rank(s) + 1}</span>}
          {r === 7 && <span className="coord f">{'abcdefgh'[file(s)]}</span>}
          {eff.some((e) => e.card === 'mine') && <span className="mark mine" title="지뢰" />}
          {eff.some((e) => e.card === 'sanctuary') && <span className="mark sanct" title="성역" />}
          {eff.some((e) => e.card === 'quicksand') && <span className="mark sand" title="늪" />}
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
      // On touch, lift the piece above the finger so it stays visible.
      const lift = drag!.touch ? size * 0.75 : 0;
      style = { transform: `translate(${drag!.x - b.left - size / 2}px, ${drag!.y - b.top - size / 2 - lift}px) scale(${drag!.touch ? 1.45 : 1.08})` };
    }
    const badges = statusBadges(p, state.ply);
    // Game over: the losing king topples, the winner gets a crown; draws mark both kings.
    const over = p.type === 'K' && state.winner ? (state.winner === 'draw' ? 'even' : state.winner === p.color ? 'champ' : 'ko') : '';
    pieces.push(
      <div key={p.id} className={`piece ${badges.map((b) => `st-${b.kind}`).join(' ')}${dragging ? ' dragging' : ''}${over ? ` ${over}` : ''}`} style={style}
        title={`${p.color === 'w' ? '백' : '흑'} ${PIECE_NAME[p.type]}${badges.map((b) => ` · ${b.label}`).join('')}`}>
        <PieceIcon type={p.type} color={p.color} />
        {badges[0] && <span className={`st ${badges[0].kind}`}>{badges[0].turns}</span>}
        {over && <span className={`endmark ${over}`}>{over === 'champ' ? '♛' : over === 'even' ? '½' : END_MARK[state.endReason ?? ''] ?? '✕'}</span>}
      </div>,
    );
  }

  // Guide tag above the first guide square.
  let tag = null;
  if (guide?.label && guide.squares.length) {
    const { c, r } = toDisplay(guide.squares[0]!);
    const edge = c <= 1 ? ' edge-l' : c >= 6 ? ' edge-r' : '';
    tag = r === 0
      ? <div className={`guide-tag below${edge}`} style={{ left: `${(c + 0.5) * 12.5}%`, top: `${(r + 1) * 12.5}%` }}>{guide.label}</div>
      : <div className={`guide-tag${edge}`} style={{ left: `${(c + 0.5) * 12.5}%`, top: `${r * 12.5}%` }}>{guide.label}</div>;
  }

  const center = (s: Square) => { const { c, r } = toDisplay(s); return { x: c + 0.5, y: r + 0.5 }; };

  return (
    <div
      className={`board-wrap${settings.coords ? '' : ' hide-coords'}${settings.animate ? '' : ' no-anim'}`}
      ref={wrap}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { setDrag(null); setRdrag(null); }}
      onContextMenu={(e) => e.preventDefault()}
      role="grid"
      aria-label="체스판"
    >
      <div className="board">{squares}</div>
      <div className="pieces">{pieces}</div>
      {arrows.length > 0 && (
        <svg className="arrows" viewBox="0 0 8 8">
          <defs>
            {Object.entries(ARROW_COLORS).map(([k, col]) => (
              <marker key={k} id={`ah-${k}`} markerWidth="4" markerHeight="4" refX="2.05" refY="2" orient="auto">
                <path d="M0,0 V4 L3,2 Z" fill={col} />
              </marker>
            ))}
          </defs>
          {arrows.map((a, i) => {
            const f = center(a.from), t = center(a.to);
            const k = Object.entries(ARROW_COLORS).find(([, v]) => v === a.color)?.[0] ?? 'g';
            const dx = t.x - f.x, dy = t.y - f.y, len = Math.hypot(dx, dy);
            const ex = t.x - (dx / len) * 0.35, ey = t.y - (dy / len) * 0.35;
            return <line key={i} x1={f.x} y1={f.y} x2={ex} y2={ey} stroke={a.color} strokeWidth="0.16" strokeLinecap="round" markerEnd={`url(#ah-${k})`} />;
          })}
        </svg>
      )}
      {tag}
      {promo && <PromotionPicker color={state.turn} onPick={(t) => { const m = promo.find((x) => x.promotion === t)!; setPromo(null); onMove?.(m); }} onCancel={() => setPromo(null)} />}
    </div>
  );
}

function PromotionPicker({ color, onPick, onCancel }: { color: Color; onPick: (t: PieceType) => void; onCancel: () => void }) {
  return (
    <div className="backdrop" style={{ position: 'absolute', placeItems: 'center' }} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={onCancel}>
      <div className="surface pad" onClick={(e) => e.stopPropagation()}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>어떤 기물로 승진하시겠습니까?</div>
        <div className="row">
          {(['Q', 'R', 'B', 'N'] as const).map((t) => (
            <button key={t} className="btn" style={{ width: 64, height: 64, padding: 6, background: 'var(--sq-light)' }} onClick={() => onPick(t)} aria-label={PIECE_NAME[t]}>
              <img src={`/pieces/${color}${t}.svg`} alt="" style={{ width: 48, height: 48 }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
