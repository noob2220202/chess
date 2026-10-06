import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CardId, Color, GameState, Move, PieceType, Square } from '@engine';
import { CARDS, PIECE_VALUE, cardReady, targetOptions } from '@engine';
import { josa } from '../lib/korean.ts';
import { useSettings } from '../lib/settings.tsx';
import { setSoundEnabled, sound } from '../lib/sound.ts';
import { Board, type Guide } from './Board.tsx';
import { CardView } from './CardView.tsx';
import { CATEGORY_HINT, CATEGORY_LABEL } from './cardMeta.ts';
import type { HistEntry } from './history.ts';
import { pieceSrc } from './PieceIcon.tsx';

export interface PlayerInfo { name: string; sub?: string; clockMs?: number | null; running?: boolean }

export interface GameScreenProps {
  history: HistEntry[];
  orientation: Color;
  actor: Color | null;
  /** The viewer's own colour (online, AI, tutorial); null for pass-and-play. */
  self?: Color | null;
  players: Record<Color, PlayerInfo>;
  onPick: (id: CardId) => void;
  onCard: (id: CardId, sel: Square[]) => void;
  onMove: (m: Move) => void;
  status?: ReactNode;
  controls?: ReactNode;
  overlay?: ReactNode;
  hideDraft?: boolean;
  /** Tutorial guidance. */
  guide?: Guide | null;
  guideCard?: CardId | null;
  /** Show the move list (hidden in short demos). */
  showMoves?: boolean;
}

export function formatClock(ms: number): string {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000), s = Math.floor((t % 60000) / 1000);
  if (t < 10_000) return `0:0${s}.${Math.floor((t % 1000) / 100)}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const catVar = (c: string) => `var(--cat-${c === 'OPENING' ? 'opening' : c === 'MIDDLE' ? 'middle' : 'end'})`;
const BASE: Record<PieceType, 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'> = { P: 'P', N: 'N', B: 'B', R: 'R', Q: 'Q', K: 'K', A: 'B', C: 'R', M: 'Q', L: 'N', G: 'P' };

function PlayerStrip({ color, info, state, onInspect }: { color: Color; info: PlayerInfo; state: GameState; onInspect: (id: CardId) => void }) {
  const opp: Color = color === 'w' ? 'b' : 'w';
  const taken = [...state.lost[opp]].filter((t) => t !== 'K').sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a]);
  const material = (c: Color) => state.board.reduce((n, p) => n + (p && p.color === c && p.type !== 'K' ? Math.round(PIECE_VALUE[p.type]) : 0), 0);
  const adv = material(color) - material(opp);
  const cards = state.cards[color];
  const turn = state.turn === color && !state.winner;
  const low = info.clockMs != null && info.clockMs < 20_000;
  return (
    <div className="player-strip">
      <div className="pic"><img src={pieceSrc(color, 'K')} alt="" /></div>
      <div className="who">
        <div className="row" style={{ gap: 0 }}>
          {turn && <span className="turn-dot" title="차례" />}
          <b>{info.name}</b>
          {info.sub && <span className="rt">{info.sub}</span>}
          <span className="cardpips" aria-label="카드">
            {cards.hand.map((id) => CARDS[id] && <button key={id} className="cardpip" title={CARDS[id]!.name} style={{ background: catVar(CARDS[id]!.category) }} onClick={() => onInspect(id)} />)}
            {cards.used.map((id) => CARDS[id] && <button key={id} className="cardpip used" title={`${CARDS[id]!.name} (사용함)`} style={{ background: catVar(CARDS[id]!.category) }} onClick={() => onInspect(id)} />)}
            {cards.offer && <span className="chip" style={{ marginLeft: 4 }}>카드 고르는 중</span>}
          </span>
        </div>
        <div className="caps">
          {taken.map((t, i) => <img key={i} src={pieceSrc(opp, BASE[t])} alt="" />)}
          {adv > 0 && <span className="adv">+{adv}</span>}
        </div>
      </div>
      {info.clockMs != null && <div className={`clock${info.running ? ' running' : ''}${low ? ' low' : ''}`}>{formatClock(info.clockMs)}</div>}
    </div>
  );
}

export function DraftModal({ offer, round, onPick }: { offer: CardId[]; round: number; onPick: (id: CardId) => void }) {
  const [sel, setSel] = useState<CardId | null>(null);
  const [peek, setPeek] = useState(false);
  const cat = CARDS[offer[0]!]?.category ?? 'OPENING';
  if (peek) {
    return (
      <div style={{ position: 'fixed', left: '50%', bottom: 90, transform: 'translateX(-50%)', zIndex: 61 }}>
        <button className="btn primary lg" onClick={() => setPeek(false)}>카드 고르기로 돌아가기</button>
      </div>
    );
  }
  return (
    <div className="modal-backdrop">
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="draft-title">
        <div className="eyebrow">드래프트 {round + 1}/3 · {CATEGORY_LABEL[cat]}</div>
        <h2 id="draft-title">증강 카드 한 장을 고르세요</h2>
        <p className="muted">{CATEGORY_HINT[cat]}. 패시브는 계속 적용되고, 액티브는 원할 때 한 번 쓸 수 있어요.</p>
        <div className="draft-cards">
          {offer.map((id) => <CardView key={id} def={CARDS[id]!} selected={sel === id} onClick={() => setSel(id)} />)}
        </div>
        {sel && CARDS[sel]!.detail && <p className="status-line" style={{ marginBottom: 12 }}>{CARDS[sel]!.detail}</p>}
        <div className="row between">
          <button className="btn ghost" onClick={() => setPeek(true)}>판 보기</button>
          <button className="btn primary lg" disabled={!sel} onClick={() => sel && onPick(sel)}>이 카드로 결정</button>
        </div>
      </div>
    </div>
  );
}

export function CardInfoModal({ id, onClose, children }: { id: CardId; onClose: () => void; children?: ReactNode }) {
  const d = CARDS[id]!;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="row top wrap" style={{ gap: 18 }}>
          <div style={{ width: 190 }}><CardView def={d} /></div>
          <div className="grow stack" style={{ minWidth: 200 }}>
            <h2>{d.name}</h2>
            <p>{d.description}</p>
            {d.detail && <p className="muted">{d.detail}</p>}
            {children}
            <div><button className="btn" onClick={onClose}>닫기</button></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lichess-style numbered move list with card events inline. */
function MoveList({ history, view, onSelect }: { history: HistEntry[]; view: number; onSelect: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rows: Array<{ n: number; w: number[]; b: number[] }> = [];
  let cur: { n: number; w: number[]; b: number[] } | null = null;
  history.forEach((e, i) => {
    if (e.kind === 'start' || !e.color) return;
    if (!cur || (e.color === 'w' && cur.w.some((j) => history[j]!.kind === 'move')) || (e.color === 'w' && cur.b.length)) {
      cur = { n: rows.length + 1, w: [], b: [] };
      rows.push(cur);
    }
    cur[e.color].push(i);
  });
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [history.length]);
  if (!rows.length) return <div className="moves" ref={ref}><div className="moves-empty">아직 둔 수가 없어요.</div></div>;
  const cell = (idx: number[]) => {
    if (!idx.length) return <span className="mv" />;
    const target = idx[idx.length - 1]!;
    return (
      <button className={`mv${idx.includes(view) ? ' cur' : ''}`} onClick={() => onSelect(target)}>
        {idx.map((i) => {
          const e = history[i]!;
          if (e.kind === 'pick') return <span key={i} className="ev pick" title="드래프트">{CARDS[e.card!]?.name}</span>;
          if (e.kind === 'card') return <span key={i} className="ev" title="카드 사용">{CARDS[e.card!]?.name}</span>;
          return (
            <span key={i} className="row" style={{ gap: 1 }}>
              {e.note?.piece && e.note.piece !== 'P' && <img src={pieceSrc(e.color!, BASE[e.note.piece])} alt={e.note.piece} />}
              {e.note?.text}
            </span>
          );
        })}
      </button>
    );
  };
  return (
    <div className="moves" ref={ref}>
      {rows.map((r) => (
        <div className="moves-row" key={r.n}>
          <span className="no">{r.n}</span>
          {cell(r.w)}
          {cell(r.b)}
        </div>
      ))}
    </div>
  );
}

export function GameScreen(p: GameScreenProps) {
  const { history, actor } = p;
  const { s: settings, open: openSettings } = useSettings();
  const liveIdx = history.length - 1;
  const [view, setView] = useState<number | null>(null);
  const [flip, setFlip] = useState(false);
  const [target, setTarget] = useState<{ id: CardId; picked: Square[] } | null>(null);
  const [confirm, setConfirm] = useState<CardId | null>(null);
  const [inspect, setInspect] = useState<CardId | null>(null);
  const live = history[liveIdx]!.state;
  const shownIdx = view ?? liveIdx;
  const shown = history[shownIdx]!;
  const viewing = view !== null && view !== liveIdx;
  const state = viewing ? shown.state : live;
  const canAct = viewing ? null : actor;

  useEffect(() => setSoundEnabled(settings.sound), [settings.sound]);
  useEffect(() => { setTarget(null); setConfirm(null); setView(null); }, [liveIdx]);
  // Sounds for new entries.
  const prevLen = useRef(history.length);
  useEffect(() => {
    if (history.length > prevLen.current) {
      const e = history[history.length - 1]!;
      if (e.state.winner) {
        const me = p.self ?? null;
        if (me && e.state.winner === me) sound.win(); else if (me && e.state.winner !== 'draw') sound.lose(); else sound.notify();
      } else if (e.kind === 'move') (e.captured ? sound.capture : sound.move)();
      else if (e.kind === 'card') sound.card();
      else if (e.kind === 'pick') sound.pick();
    }
    prevLen.current = history.length;
  }, [history, p.self]);
  // Keyboard navigation.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') setView((v) => Math.max(0, (v ?? liveIdx) - 1));
      else if (e.key === 'ArrowRight') setView((v) => { const n = Math.min(liveIdx, (v ?? liveIdx) + 1); return n === liveIdx ? null : n; });
      else if (e.key === 'f') setFlip((x) => !x);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [liveIdx]);

  const orientation: Color = flip ? (p.orientation === 'w' ? 'b' : 'w') : p.orientation;
  const options = useMemo(() => (target && canAct ? targetOptions(live, canAct, target.id, target.picked) : []), [target, live, canAct]);
  const top: Color = orientation === 'w' ? 'b' : 'w';
  const offer = actor ? live.cards[actor].offer : null;
  const myColor = p.self ?? actor ?? p.orientation;

  function startCard(id: CardId) {
    if (!canAct || !cardReady(live, canAct, id)) return;
    const def = CARDS[id]!;
    if (!def.targets?.length) setConfirm(id);
    else setTarget({ id, picked: [] });
  }
  function addTarget(sq: Square) {
    if (!target) return;
    const picked = [...target.picked, sq];
    if (picked.length === (CARDS[target.id]!.targets?.length ?? 0)) { setTarget(null); p.onCard(target.id, picked); }
    else setTarget({ ...target, picked });
  }

  const hand = live.cards[myColor];
  const targetPrompt = target ? CARDS[target.id]!.targets![target.picked.length]?.prompt : null;
  const go = (i: number) => setView(i >= liveIdx ? null : Math.max(0, i));

  return (
    <div className="game">
      <div className="game-board-col">
        <PlayerStrip color={top} info={p.players[top]} state={state} onInspect={setInspect} />
        <Board
          state={state}
          orientation={orientation}
          actor={target ? null : canAct}
          lastMove={shown.last}
          targeting={target && !viewing ? { options, picked: target.picked } : null}
          guide={viewing ? null : target ? (p.guide && p.guide.squares[target.picked.length] !== undefined ? { squares: [p.guide.squares[target.picked.length]!], label: p.guide.label } : null) : p.guideCard ? null : p.guide}
          onMove={p.onMove}
          onTarget={addTarget}
          onCancelTarget={() => setTarget(null)}
        />
        <PlayerStrip color={orientation} info={p.players[orientation]} state={state} onInspect={setInspect} />
      </div>

      <div className="game-status">
        {viewing && (
          <div className="viewing-banner">
            <span className="grow">{shownIdx}번째 기록을 보는 중이에요.</span>
            <button className="btn sm" onClick={() => setView(null)}>현재로</button>
          </div>
        )}
        {target ? (
          <div className="status-line info row">
            <span className="grow"><b>{CARDS[target.id]!.name}</b> · {targetPrompt}{options.length === 0 ? ' (고를 수 있는 칸이 없어요)' : ''}</span>
            <button className="btn sm" onClick={() => setTarget(null)}>취소</button>
          </div>
        ) : p.status}
      </div>

      <aside className="game-side">
        <div className="side-panel">
          <div className="hand">
            <div className="row between">
              <span className="eyebrow">{p.self || actor ? '내 카드' : `${myColor === 'w' ? '백' : '흑'} 카드`}</span>
              <span className="muted" style={{ fontSize: 12.5 }}>액티브: 한 차례에 한 장 · 차례를 쓰지 않음</span>
            </div>
            {hand.hand.length + hand.used.length === 0 ? (
              <div className="muted" style={{ fontSize: 13.5, padding: '6px 0' }}>아직 카드가 없어요. 내 0·10·20번째 수에 드래프트가 열려요.</div>
            ) : (
              <div className="hand-cards">
                {hand.hand.map((id) => {
                  const d = CARDS[id]!;
                  const ready = !!canAct && d.kind === 'active' && cardReady(live, canAct, id);
                  return (
                    <CardView key={id} def={d} compact selected={target?.id === id} guide={p.guideCard === id && !target}
                      disabled={d.kind === 'active' && !ready}
                      onClick={ready ? () => startCard(id) : () => setInspect(id)} />
                  );
                })}
                {hand.used.map((id) => <CardView key={id} def={CARDS[id]!} compact used onClick={() => setInspect(id)} />)}
              </div>
            )}
          </div>
        </div>

        {(p.showMoves ?? true) && (
          <div className="side-panel">
            <div className="side-tabs"><button className="on">기보<span className="count">{history.filter((e) => e.kind === 'move').length}</span></button></div>
            <MoveList history={history} view={shownIdx} onSelect={go} />
            <div className="nav-row">
              <button className="btn ghost" onClick={() => go(0)} aria-label="처음">⏮</button>
              <button className="btn ghost" onClick={() => go(shownIdx - 1)} aria-label="이전">◀</button>
              <button className="btn ghost" onClick={() => go(shownIdx + 1)} aria-label="다음">▶</button>
              <button className="btn ghost" onClick={() => setView(null)} aria-label="현재">⏭</button>
              <button className="btn ghost" onClick={() => setFlip((x) => !x)} title="판 뒤집기 (F)">⇅</button>
              <button className="btn ghost" onClick={openSettings} title="설정">⚙</button>
            </div>
            {p.controls && <div className="actions-row">{p.controls}</div>}
          </div>
        )}
        {!(p.showMoves ?? true) && p.controls && <div className="actions-row" style={{ padding: 0 }}>{p.controls}</div>}
      </aside>

      {offer && offer.length > 0 && !p.hideDraft && actor && !live.winner && (
        <DraftModal key={live.cards[actor].draftsTaken} offer={offer} round={live.cards[actor].draftsTaken} onPick={p.onPick} />
      )}
      {confirm && (
        <div className="modal-backdrop" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{josa(`“${CARDS[confirm]!.name}”`, '을/를')} 쓸까요?</h2>
            <p className="muted" style={{ margin: '6px 0 18px' }}>{CARDS[confirm]!.description}</p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setConfirm(null)}>취소</button>
              <button className="btn primary" onClick={() => { const id = confirm; setConfirm(null); p.onCard(id, []); }}>사용하기</button>
            </div>
          </div>
        </div>
      )}
      {inspect && <CardInfoModal id={inspect} onClose={() => setInspect(null)} />}
      {p.overlay}
    </div>
  );
}

export const REASON_TEXT: Record<string, string> = {
  'king-captured': '킹을 잡았어요', 'no-moves': '둘 수 있는 수가 없어요', 'card-win': '카드 효과로 승리', 'ply-limit': '300수에 도달했어요',
  'quiet-limit': '100수 동안 잡거나 폰을 움직이지 않았어요', repetition: '같은 국면이 세 번 나왔어요', resign: '기권', timeout: '시간 초과',
  agreement: '합의 무승부', abort: '대국 취소', abandon: '이탈', end: '종료',
};

export function ResultModal({ title, subtitle, delta, children }: { title: string; subtitle: string; delta?: number | null; children: ReactNode }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="result-banner stack">
          <div className="big">{title}</div>
          <div className="muted">{subtitle}</div>
          {delta != null && <div className={`delta ${delta >= 0 ? 'up' : 'down'}`}>레이팅 {delta >= 0 ? `+${delta}` : delta}</div>}
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: 10 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
