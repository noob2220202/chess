import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Eye, ListOrdered, SearchCheck } from 'lucide-react';
import type { CardId, Color, GameState, PieceType } from '@engine';
import { CARDS, PIECE_VALUE } from '@engine';
import { Sheet } from '../lib/ui.tsx';
import { CardChip } from './CardView.tsx';
import { pieceSrc } from './PieceIcon.tsx';

export interface GameResult {
  outcome: 'win' | 'lose' | 'draw';
  /** Headline, e.g. "승리", "백 승리", "대국 취소". */
  title: string;
  /** Why it ended, e.g. "체크메이트". */
  reason: string;
  /** Rating change for the viewer (online rated games). */
  delta?: number | null;
  /** Primary buttons (rematch, back to lobby...). */
  actions: ReactNode;
}

const BASE: Record<PieceType, 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'> = { P: 'P', N: 'N', B: 'B', R: 'R', Q: 'Q', K: 'K', A: 'B', C: 'R', M: 'Q', L: 'N', G: 'P' };

/** Rating change that counts up from zero. */
function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t0 = performance.now(), dur = 900;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v >= 0 ? `+${v}` : v}</>;
}

/** A short burst of confetti from the top of the screen. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#f2a93b', '#ffd666', '#76c56f', '#5aa7ea', '#c9a6ff', '#ffffff'];
    const parts = Array.from({ length: 110 }, () => ({
      x: innerWidth * (0.2 + Math.random() * 0.6), y: innerHeight * 0.32,
      vx: (Math.random() - 0.5) * 9, vy: -6 - Math.random() * 9,
      w: 5 + Math.random() * 6, h: 3 + Math.random() * 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      c: colors[Math.floor(Math.random() * colors.length)]!,
    }));
    const t0 = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      const age = (t - t0) / 1000;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - 1.4) / 0.6);
      for (const p of parts) {
        p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
        ctx.restore();
      }
      if (age < 2) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="confetti" aria-hidden />;
}

function Taken({ by, state }: { by: Color; state: GameState }) {
  const opp: Color = by === 'w' ? 'b' : 'w';
  const list = [...state.lost[opp]].filter((t) => t !== 'K').sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a]);
  if (!list.length) return <span className="muted">없음</span>;
  return <span className="go-taken">{list.map((t, i) => <img key={i} src={pieceSrc(opp, BASE[t])} alt="" />)}</span>;
}

function Cards({ ids }: { ids: CardId[] }) {
  if (!ids.length) return <span className="muted">없음</span>;
  return <div className="go-cards">{ids.filter((id) => CARDS[id]).map((id) => <CardChip key={id} def={CARDS[id]!} />)}</div>;
}

export interface GameOverProps {
  result: GameResult;
  state: GameState;
  moves: number;
  players: Record<Color, { name: string; sub?: string }>;
  /** Viewer's colour, null for local two-player games. */
  self: Color | null;
  onViewBoard: () => void;
  onMoves: () => void;
  /** Start the move-by-move review (absent once done). */
  onReview?: () => void;
}

export function GameOverSheet({ result, state, moves, players, self, onViewBoard, onMoves, onReview }: GameOverProps) {
  const winner = state.winner === 'w' || state.winner === 'b' ? state.winner : null;
  const score = (c: Color) => (winner ? (winner === c ? '1' : '0') : '½');
  const order: Color[] = self === 'b' ? ['b', 'w'] : ['w', 'b'];
  const cardsOf = (c: Color) => [...state.cards[c].used, ...state.cards[c].hand];
  const anyTaken = state.lost.w.some((t) => t !== 'K') || state.lost.b.some((t) => t !== 'K');
  const anyCards = cardsOf('w').length + cardsOf('b').length > 0;
  return (
    <Sheet label="대국 결과">
      <div className={`go ${result.outcome}`}>
        <div className="go-hero">
          <div className="go-kings" aria-hidden>
            {(['w', 'b'] as const).map((c) => (
              <img key={c} src={pieceSrc(c, 'K')} alt=""
                className={winner ? (winner === c ? 'up' : 'down') : 'even'} />
            ))}
          </div>
          <h2>{result.title}</h2>
          <div className="go-reason">{result.reason} · {Math.ceil(moves / 2)}수</div>
          {result.delta != null && (
            <div className={`go-delta ${result.delta >= 0 ? 'up' : 'down'}`}>레이팅 <b><CountUp to={result.delta} /></b></div>
          )}
        </div>

        <div className="go-players">
          {order.map((c, i) => (
            <div key={c} className={`gp${winner === c ? ' won' : ''}`} style={{ order: i === 0 ? 0 : 2 }}>
              <img src={pieceSrc(c, 'K')} alt={c === 'w' ? '백' : '흑'} />
              <b className="ellipsis">{players[c].name}</b>
              {players[c].sub && <small className="ellipsis">{players[c].sub}</small>}
            </div>
          ))}
          <div className="go-score" style={{ order: 1 }}>{score(order[0]!)}<i>–</i>{score(order[1]!)}</div>
        </div>

        {(anyTaken || anyCards) && (
          <div className="go-table">
            {anyTaken && <div className="go-row"><span className="k">잡은 기물</span>{order.map((c) => <div key={c} className="v"><Taken by={c} state={state} /></div>)}</div>}
            {anyCards && <div className="go-row"><span className="k">카드</span>{order.map((c) => <div key={c} className="v"><Cards ids={cardsOf(c)} /></div>)}</div>}
          </div>
        )}

        <div className="go-actions">{result.actions}</div>
        <div className="go-links">
          <button className="btn sm ghost" onClick={onViewBoard}><Eye />보드 보기</button>
          <button className="btn sm ghost" onClick={onMoves}><ListOrdered />기보</button>
          {onReview && <button className="btn sm ghost review-btn" onClick={onReview}><SearchCheck />복기</button>}
        </div>
      </div>
    </Sheet>
  );
}
