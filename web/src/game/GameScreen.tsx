import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Ellipsis, Flag, Handshake, Layers, ListOrdered, Repeat, Settings as SettingsIcon, Timer, Trophy, X,
} from 'lucide-react';
import type { CardId, Color, GameState, Move, PieceType, Square } from '@engine';
import { CARDS, OVERTIME_PLY, OVERTIME_QUIET, PIECE_VALUE, cardReady, notate, targetOptions } from '@engine';
import { reviewMoves } from '../bot/client.ts';
import { josa } from '../lib/korean.ts';
import { useSettings } from '../lib/settings.tsx';
import { haptic, setSoundEnabled, sound } from '../lib/sound.ts';
import { Sheet, useInGame, useIsMobile } from '../lib/ui.tsx';
import { Board, type Guide } from './Board.tsx';
import { CardChip, CardView, rarity } from './CardView.tsx';
import { CATEGORY_HINT, CATEGORY_LABEL } from './cardMeta.ts';
import type { HistEntry } from './history.ts';
import { pieceSrc } from './PieceIcon.tsx';
import { Confetti, GameOverSheet, type GameResult } from './GameOver.tsx';

export type { GameResult } from './GameOver.tsx';

export interface PlayerInfo { name: string; sub?: string; clockMs?: number | null; running?: boolean }
export interface MenuItem { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }

export interface GameScreenProps {
  history: HistEntry[];
  orientation: Color;
  actor: Color | null;
  self?: Color | null;
  players: Record<Color, PlayerInfo>;
  onPick: (id: CardId) => void;
  onCard: (id: CardId, sel: Square[]) => void;
  onMove: (m: Move) => void;
  status?: ReactNode;
  /** Show status as a block above the board (tutorial coach) instead of a floating banner. */
  statusInline?: boolean;
  /** Game actions (resign, draw, exit...). Buttons on desktop, menu sheet on mobile. */
  menu?: MenuItem[];
  /** Frequent actions (undo, hint) shown directly in the phone action bar and the desktop side panel. */
  tools?: MenuItem[];
  overlay?: ReactNode;
  /** Game-over presentation (board finish, result sheet). */
  result?: GameResult | null;
  hideDraft?: boolean;
  guide?: Guide | null;
  guideCard?: CardId | null;
  showMoves?: boolean;
  /** Mobile header. */
  title?: string;
  onBack?: () => void;
}

export function formatClock(ms: number): string {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000), s = Math.floor((t % 60000) / 1000);
  if (t < 10_000) return `0:0${s}.${Math.floor((t % 1000) / 100)}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const BASE: Record<PieceType, 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'> = { P: 'P', N: 'N', B: 'B', R: 'R', Q: 'Q', K: 'K', A: 'B', C: 'R', M: 'Q', L: 'N', G: 'P' };

function PlayerStrip({ color, info, state, onInspect }: { color: Color; info: PlayerInfo; state: GameState; onInspect: (id: CardId) => void }) {
  const opp: Color = color === 'w' ? 'b' : 'w';
  const taken = [...state.lost[opp]].filter((t) => t !== 'K').sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a]);
  const material = (c: Color) => state.board.reduce((n, p) => n + (p && p.color === c && p.type !== 'K' ? Math.round(PIECE_VALUE[p.type]) : 0), 0);
  const adv = material(color) - material(opp);
  const cards = state.cards[color];
  const turn = state.turn === color && !state.winner;
  return (
    <div className="player-strip">
      <div className="pic"><img src={pieceSrc(color, 'K')} alt={color === 'w' ? '백' : '흑'} /></div>
      <div className="who">
        <div className="nm">
          {turn && <span className="turn-dot" aria-label="차례" />}
          <b>{info.name}</b>
          {info.sub && <span className="rt">{info.sub}</span>}
          <span className="pips">
            {cards.hand.map((id) => CARDS[id] && <button key={id} className={`pip c-${CARDS[id]!.category}`} title={CARDS[id]!.name} onClick={() => onInspect(id)} />)}
            {cards.used.map((id) => CARDS[id] && <button key={id} className={`pip used c-${CARDS[id]!.category}`} title={`${CARDS[id]!.name} (사용함)`} onClick={() => onInspect(id)} />)}
          </span>
          {cards.offer && <span className="chip">카드 고르는 중</span>}
        </div>
        <div className="caps">
          {taken.map((t, i) => <img key={i} src={pieceSrc(opp, BASE[t])} alt="" />)}
          {adv > 0 && <span className="adv">+{adv}</span>}
        </div>
      </div>
      {info.clockMs != null && <div className={`clock${info.running ? ' running' : ''}${info.clockMs < 20_000 ? ' low' : ''}`}>{formatClock(info.clockMs)}</div>}
    </div>
  );
}

export function DraftSheet({ offer, round, onPick }: { offer: CardId[]; round: number; onPick: (id: CardId) => void }) {
  const [sel, setSel] = useState<CardId | null>(null);
  const mobile = useIsMobile();
  const cat = CARDS[offer[0]!]?.category ?? 'OPENING';
  const d = sel ? CARDS[sel]! : null;
  return (
    <Sheet wide label="카드 드래프트">
      <div className="center">
        <div className="eyebrow">드래프트 {round + 1}/3 · {CATEGORY_LABEL[cat]}</div>
        <h2 style={{ marginTop: 4 }}>카드 한 장을 고르세요</h2>
        {!mobile && <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>{CATEGORY_HINT[cat]}</p>}
      </div>
      <div className="draft-row">
        {offer.map((id) => <CardView key={id} def={CARDS[id]!} selected={sel === id} onClick={() => { setSel(id); haptic('tap'); }} />)}
      </div>
      {mobile ? (
        <div className="draft-detail" aria-live="polite">
          {d ? (
            <div key={d.id} className="dd-in">
              <div className="dd-head">
                <b>{d.name}</b>
                <span className="chip">{d.kind === 'active' ? '액티브' : '패시브'}</span>
                <span className={`chip rar r${rarity(d.stars).tier}`}>{rarity(d.stars).label}</span>
              </div>
              <p>{d.description}</p>
              {d.detail && <p className="muted">{d.detail}</p>}
            </div>
          ) : (
            <p className="muted dd-empty">{CATEGORY_HINT[cat]}<br />카드를 눌러 설명을 확인하세요.</p>
          )}
        </div>
      ) : sel && CARDS[sel]!.detail && <p className="muted center" style={{ fontSize: 13.5, marginBottom: 12 }}>{CARDS[sel]!.detail}</p>}
      <button className="btn primary lg block" disabled={!sel} onClick={() => sel && onPick(sel)}>
        {sel ? `${josa(`“${CARDS[sel]!.name}”`, '으로/로')} 결정` : '카드를 눌러 고르세요'}
      </button>
    </Sheet>
  );
}

export function CardSheet({ id, onClose, onUse, useGuide }: { id: CardId; onClose: () => void; onUse?: () => void; useGuide?: boolean }) {
  const d = CARDS[id]!;
  const r = rarity(d.stars);
  return (
    <Sheet onClose={onClose} label={d.name}>
      <div className="card-sheet">
        <CardView def={d} />
        <div>
          <div className="eyebrow">{CATEGORY_LABEL[d.category]} · {d.kind === 'active' ? '액티브' : '패시브'} · {r.label}</div>
          <h2 style={{ margin: '4px 0 8px' }}>{d.name}</h2>
          <p style={{ fontSize: 15.5 }}>{d.description}</p>
          {d.detail && <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>{d.detail}</p>}
          <div className="actions">
            {onUse && <button className={`btn primary lg block${useGuide ? ' guide' : ''}`} onClick={onUse}>사용하기</button>}
            <button className="btn block" onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

export interface ReviewMark { kind: 'blunder' | 'mistake' | 'miss'; best: Move; bestText: string }
const MARK_LABEL: Record<ReviewMark['kind'], string> = { blunder: '큰 실수', mistake: '실수', miss: '이기는 수를 놓침' };

/** Numbered move list with figurines and card events inline. */
function MoveList({ history, view, onSelect, marks }: { history: HistEntry[]; view: number; onSelect: (i: number) => void; marks?: Record<number, ReviewMark> }) {
  const ref = useRef<HTMLDivElement>(null);
  const rows: Array<{ n: number; w: number[]; b: number[] }> = [];
  let cur: { n: number; w: number[]; b: number[] } | null = null;
  history.forEach((e, i) => {
    if (e.kind === 'start' || !e.color) return;
    const whiteMoved = cur?.w.some((j) => history[j]!.kind === 'move');
    if (!cur || (e.color === 'w' && (whiteMoved || cur.b.length > 0))) { cur = { n: rows.length + 1, w: [], b: [] }; rows.push(cur); }
    cur[e.color].push(i);
  });
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [history.length]);
  if (!rows.length) return <div className="moves" ref={ref}><div className="moves-empty">아직 둔 수가 없습니다.</div></div>;
  const cell = (idx: number[]) => {
    if (!idx.length) return <span className="mv" />;
    return (
      <button className={`mv${idx.includes(view) || idx.some((i) => i - 1 === view && marks?.[i]) ? ' cur' : ''}`}
        onClick={() => onSelect(idx.find((i) => marks?.[i]) ?? idx[idx.length - 1]!)}>
        {idx.map((i) => {
          const e = history[i]!;
          if (e.kind === 'pick') return <span key={i} className="ev pick">{CARDS[e.card!]?.name}</span>;
          if (e.kind === 'card') return <span key={i} className="ev">{CARDS[e.card!]?.name}</span>;
          return (
            <span key={i} className="row" style={{ gap: 1 }}>
              {e.note?.piece && e.note.piece !== 'P' && <img src={pieceSrc(e.color!, BASE[e.note.piece])} alt={e.note.piece} />}
              {e.note?.text}
              {marks?.[i] && <i className={`mk ${marks[i]!.kind}`}>{marks[i]!.kind === 'mistake' ? '?' : '??'}</i>}
            </span>
          );
        })}
      </button>
    );
  };
  return <div className="moves" ref={ref}>{rows.map((r) => <div className="moves-row" key={r.n}><span className="no">{r.n}</span>{cell(r.w)}{cell(r.b)}</div>)}</div>;
}

export function GameScreen(p: GameScreenProps) {
  useInGame();
  const { history, actor } = p;
  const mobile = useIsMobile();
  const { s: settings, open: openSettings } = useSettings();
  const liveIdx = history.length - 1;
  const [view, setView] = useState<number | null>(null);
  const [flip, setFlip] = useState(false);
  const [target, setTarget] = useState<{ id: CardId; picked: Square[] } | null>(null);
  const [confirm, setConfirm] = useState<CardId | null>(null);
  const [sheet, setSheet] = useState<null | { kind: 'card'; id: CardId } | { kind: 'moves' } | { kind: 'menu' }>(null);
  const live = history[liveIdx]!.state;
  const shownIdx = view ?? liveIdx;
  const shown = history[shownIdx]!;
  const viewing = view !== null && view !== liveIdx;
  const state = viewing ? shown.state : live;
  const canAct = viewing ? null : actor;

  useEffect(() => setSoundEnabled(settings.sound), [settings.sound]);
  useEffect(() => { setTarget(null); setConfirm(null); setView(null); setSheet((s) => (s?.kind === 'card' ? null : s)); }, [liveIdx]);

  // Let the final move land (and the mated king light up) before the result sheet covers the board.
  const hasOverlay = !!p.overlay || !!p.result;
  const [overlayReady, setOverlayReady] = useState(hasOverlay);
  const [collapsed, setCollapsed] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (!hasOverlay) { setOverlayReady(false); setCollapsed(false); return; }
    const ending = history[history.length - 1]?.kind === 'move';
    if (ending && p.result?.outcome === 'win') { setCelebrate(true); setTimeout(() => setCelebrate(false), 2300); }
    const t = setTimeout(() => setOverlayReady(true), ending ? 900 : 0);
    return () => clearTimeout(t);
  }, [hasOverlay]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevLen = useRef(history.length);
  useEffect(() => {
    if (history.length > prevLen.current) {
      const e = history[history.length - 1]!;
      if (e.state.winner) {
        const me = p.self ?? null;
        if (me && e.state.winner === me) { sound.win(); haptic('win'); } else if (me && e.state.winner !== 'draw') sound.lose(); else sound.notify();
      } else if (e.kind === 'move') { (e.check ? sound.check : e.captured ? sound.capture : sound.move)(); haptic(e.captured || e.check ? 'capture' : 'move'); }
      else if (e.kind === 'card') sound.card();
      else if (e.kind === 'pick') sound.pick();
    }
    prevLen.current = history.length;
  }, [history, p.self]);

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

  // Keep the guided element (card chip or square) on screen on small phones.
  useEffect(() => {
    if (!p.guide && !p.guideCard) return;
    const t = setTimeout(() => {
      if (mobile) {
        // The phone layout is pinned to the screen; only the card strip can scroll (sideways).
        document.querySelector('.m-hand .hchip.guide')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        return;
      }
      const el = document.querySelector('.hchip.guide, .tcg.guide, .sq.guide');
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < 60 || r.bottom > window.innerHeight - 80) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    return () => clearTimeout(t);
  }, [p.guide, p.guideCard, liveIdx, target, mobile]);

  const orientation: Color = flip ? (p.orientation === 'w' ? 'b' : 'w') : p.orientation;
  const options = useMemo(() => (target && canAct ? targetOptions(live, canAct, target.id, target.picked) : []), [target, live, canAct]);
  const top: Color = orientation === 'w' ? 'b' : 'w';
  const offer = actor ? live.cards[actor].offer : null;
  const myColor = p.self ?? actor ?? p.orientation;
  const hand = live.cards[myColor];
  const isReady = (id: CardId) => !!canAct && CARDS[id]?.kind === 'active' && cardReady(live, canAct, id);
  const go = (i: number) => setView(i >= liveIdx ? null : Math.max(0, i));

  function startCard(id: CardId) {
    if (!isReady(id)) return;
    setSheet(null);
    const def = CARDS[id]!;
    if (!def.targets?.length) setConfirm(id);
    else setTarget({ id, picked: [] });
  }
  function addTarget(sq: Square) {
    if (!target) return;
    const picked = [...target.picked, sq];
    haptic('tap');
    if (picked.length === (CARDS[target.id]!.targets?.length ?? 0)) { setTarget(null); p.onCard(target.id, picked); }
    else setTarget({ ...target, picked });
  }
  /** One tap uses a ready card; otherwise (or on long press) show its details. */
  function tapCard(id: CardId) {
    if (target?.id === id) return setTarget(null);
    if (isReady(id)) return startCard(id);
    setSheet({ kind: 'card', id });
  }
  const showCard = (id: CardId) => setSheet({ kind: 'card', id });

  // ---- post-game review
  const [marks, setMarks] = useState<Record<number, ReviewMark>>({});
  const [reviewing, setReviewing] = useState<{ done: number; total: number } | null>(null);
  const [reviewDone, setReviewDone] = useState<{ blunders: number; mistakes: number } | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const focusMark = focus !== null && view === focus - 1 ? marks[focus] ?? null : null;
  async function startReview() {
    setCollapsed(true);
    const idx = history.map((e, i) => i).filter((i) => i > 0 && history[i]!.kind === 'move' && history[i]!.move && (!p.self || history[i]!.color === p.self));
    if (!idx.length) return;
    setReviewing({ done: 0, total: idx.length });
    try {
      const res = await reviewMoves(idx.map((i) => ({ state: history[i - 1]!.state, move: history[i]!.move! })), (done, total) => setReviewing({ done, total }));
      const m: Record<number, ReviewMark> = {};
      let blunders = 0, mistakes = 0;
      res.forEach((r, k) => {
        if (!r) return;
        const i = idx[k]!, WIN = 50000;
        const drop = r.bestScore - r.playedScore;
        const kind: ReviewMark['kind'] | null = r.bestScore > WIN && r.playedScore < WIN ? 'miss' : drop >= 3 ? 'blunder' : drop >= 1.5 ? 'mistake' : null;
        if (!kind) return;
        m[i] = { kind, best: r.best, bestText: notate(history[i - 1]!.state, r.best).text };
        if (kind === 'mistake') mistakes++; else blunders++;
      });
      setMarks(m);
      setReviewDone({ blunders, mistakes });
      const first = idx.find((i) => m[i]);
      if (first !== undefined) { setFocus(first); setView(first - 1); }
    } finally {
      setReviewing(null);
    }
  }
  const markIdx = Object.keys(marks).map(Number).sort((a, b) => a - b);
  const jumpMark = (i: number) => { setFocus(i); setView(i - 1); setSheet(null); };
  const selectMove = (i: number) => (marks[i] ? jumpMark(i) : (setFocus(null), go(i)));

  const boardGuide = viewing ? (focusMark ? { squares: [focusMark.best.from, focusMark.best.to], label: '더 좋은 수' } : null)
    : target ? (p.guide && p.guide.squares[target.picked.length] !== undefined ? { squares: [p.guide.squares[target.picked.length]!], label: p.guide.label } : null)
      : p.guideCard ? null : p.guide;

  const board = (
    <Board
      state={state}
      orientation={orientation}
      actor={target ? null : canAct}
      lastMove={shown.last}
      targeting={target && !viewing ? { options, picked: target.picked } : null}
      guide={boardGuide}
      onMove={p.onMove}
      onTarget={addTarget}
      onCancelTarget={() => setTarget(null)}
    />
  );

  const extraMove = !viewing && !!canAct && live.effects.some((e) => e.card === 'double-time' && e.owner === canAct && live.ply === e.until - 1);
  const overtimeLeft = !live.winner && live.ply >= OVERTIME_PLY ? Math.max(1, Math.ceil((OVERTIME_QUIET - live.quiet) / 2)) : null;
  const overtimeNode = overtimeLeft !== null
    ? <div className="notice attn"><Timer /><span className="grow"><b>연장전</b> · {overtimeLeft}수 안에 잡기·폰 이동·카드 사용이 없으면 기물 점수로 판정합니다.</span></div>
    : null;
  const nextMark = focus !== null ? markIdx.find((i) => i > focus) : markIdx[0];
  const reviewNode = reviewing
    ? <div className="notice info"><span className="spinner" /><span className="grow">복기 분석 중 · {reviewing.done}/{reviewing.total}</span></div>
    : focusMark
      ? (
        <div className={`notice review ${focusMark.kind}`}>
          <span className={`mk ${focusMark.kind}`}>{focusMark.kind === 'mistake' ? '?' : '??'}</span>
          <span className="grow"><b>{history[focus!]!.note?.text}</b> {MARK_LABEL[focusMark.kind]} · 더 좋은 수 <b>{focusMark.bestText}</b></span>
          {nextMark !== undefined ? <button className="btn sm" onClick={() => jumpMark(nextMark)}>다음</button> : <button className="btn sm" onClick={() => { setFocus(null); setView(null); }}>끝</button>}
        </div>
      )
      : reviewDone && !viewing
        ? (
          <div className="notice info"><ListOrdered /><span className="grow">복기 완료 · 큰 실수 {reviewDone.blunders} · 실수 {reviewDone.mistakes}{reviewDone.blunders + reviewDone.mistakes ? '' : ' · 깔끔한 대국입니다'}</span>
            {markIdx.length > 0 && <button className="btn sm" onClick={() => jumpMark(markIdx[0]!)}>처음부터</button>}</div>
        )
        : null;
  const statusNode = reviewNode ?? ((viewing || target || p.status || extraMove || (!mobile && overtimeNode)) ? (
    <>
      {viewing && (
        <div className="notice info"><ListOrdered /><span className="grow">{shownIdx}번째 기록을 보고 있습니다</span><button className="btn sm" onClick={() => setView(null)}>현재로</button></div>
      )}
      {target ? (
        <div className="notice info">
          <Layers /><span className="grow"><b>{CARDS[target.id]!.name}</b> · {CARDS[target.id]!.targets![target.picked.length]?.prompt}{options.length === 0 ? ' (고를 수 있는 칸이 없습니다)' : ''}</span>
          <button className="btn sm" onClick={() => setTarget(null)}>취소</button>
        </div>
      ) : !viewing && (extraMove ? <div className="notice attn"><Layers /><span className="grow"><b>연속 행동</b> · 한 번 더 두세요. 이번 수로는 잡을 수 없습니다.</span></div> : (p.status ?? (mobile ? null : overtimeNode)))}
    </>
  ) : null);

  const handCards = [...hand.hand.map((id) => [id, false] as const), ...hand.used.map((id) => [id, true] as const)];
  const menuItems: MenuItem[] = [
    { label: '판 뒤집기', icon: <Repeat />, onClick: () => setFlip((x) => !x) },
    { label: '설정', icon: <SettingsIcon />, onClick: openSettings },
    ...(p.menu ?? []),
  ];

  const sheets = (
    <>
      {offer && offer.length > 0 && !p.hideDraft && actor && !live.winner && (
        <DraftSheet key={live.cards[actor].draftsTaken} offer={offer} round={live.cards[actor].draftsTaken} onPick={p.onPick} />
      )}
      {confirm && (
        <Sheet onClose={() => setConfirm(null)}>
          <h2>{josa(`“${CARDS[confirm]!.name}”`, '을/를')} 사용하시겠습니까?</h2>
          <p className="muted" style={{ margin: '8px 0 18px' }}>{CARDS[confirm]!.description}</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirm(null)}>취소</button>
            <button className="btn primary" onClick={() => { const id = confirm; setConfirm(null); p.onCard(id, []); }}>사용하기</button>
          </div>
        </Sheet>
      )}
      {sheet?.kind === 'card' && (
        <CardSheet id={sheet.id} onClose={() => setSheet(null)} onUse={hand.hand.includes(sheet.id) && isReady(sheet.id) ? () => startCard(sheet.id) : undefined} useGuide={p.guideCard === sheet.id} />
      )}
      {sheet?.kind === 'moves' && (
        <Sheet onClose={() => setSheet(null)} label="기보">
          <div className="row between" style={{ marginBottom: 8 }}><h2>기보</h2><button className="icon-btn" onClick={() => setSheet(null)} aria-label="닫기"><X /></button></div>
          <MoveList history={history} view={shownIdx} marks={marks} onSelect={(i) => { selectMove(i); setSheet(null); }} />
        </Sheet>
      )}
      {sheet?.kind === 'menu' && (
        <Sheet onClose={() => setSheet(null)} label="메뉴">
          <div className="sheet-menu">
            {menuItems.map((m) => (
              <button key={m.label} className={m.danger ? 'danger' : ''} disabled={m.disabled} onClick={() => { setSheet(null); m.onClick(); }}>{m.icon}{m.label}</button>
            ))}
          </div>
        </Sheet>
      )}
      {overlayReady && p.overlay}
      {overlayReady && p.result && !collapsed && (
        <GameOverSheet result={p.result} state={live} moves={history.filter((e) => e.kind === 'move').length}
          players={p.players} self={p.self ?? null}
          onViewBoard={() => setCollapsed(true)} onMoves={() => { setCollapsed(true); setSheet({ kind: 'moves' }); }}
          onReview={reviewDone ? undefined : startReview} />
      )}
      {overlayReady && p.result && collapsed && (
        <button className={`go-pill ${p.result.outcome}`} onClick={() => setCollapsed(false)}><Trophy />{p.result.title} · 결과 보기</button>
      )}
      {celebrate && <Confetti />}
    </>
  );

  if (mobile) {
    return (
      <div className={`m-game${p.statusInline ? ' coach-mode' : ''}`}>
        <div className="m-top">
          <button className="icon-btn" onClick={p.onBack ?? (() => history.length && window.history.back())} aria-label="뒤로"><ChevronLeft /></button>
          <span className="title ellipsis">{p.title ?? ''}{overtimeLeft !== null && <em className="ot-chip">연장전 · {overtimeLeft}수</em>}</span>
          <button className="icon-btn" onClick={openSettings} aria-label="설정"><SettingsIcon /></button>
          {!p.statusInline && statusNode && <div className="m-float">{statusNode}</div>}
        </div>
        {p.statusInline && <div className="m-status">{statusNode}</div>}
        <div className="m-board">
          <PlayerStrip color={top} info={p.players[top]} state={state} onInspect={(id) => setSheet({ kind: 'card', id })} />
          {board}
          <PlayerStrip color={orientation} info={p.players[orientation]} state={state} onInspect={(id) => setSheet({ kind: 'card', id })} />
        </div>
        <div className="m-hand">
          {handCards.length === 0 && <span className="empty">아직 카드가 없습니다. 내 0·10·20번째 수에 카드를 고릅니다.</span>}
          {handCards.map(([id, used]) => (
            <CardChip key={id} def={CARDS[id]!} used={used} ready={!used && isReady(id)} guide={p.guideCard === id && !target}
              selected={target?.id === id} onClick={() => tapCard(id)} onLongPress={() => showCard(id)} />
          ))}
        </div>
        <nav className="m-actions" aria-label="대국 메뉴">
          <button onClick={() => setSheet({ kind: 'moves' })} disabled={p.showMoves === false}><ListOrdered />기보</button>
          <button onClick={() => go(shownIdx - 1)} disabled={shownIdx === 0}><ChevronLeft />이전</button>
          <button onClick={() => go(shownIdx + 1)} disabled={!viewing}><ChevronRight />다음</button>
          {p.tools?.length
            ? p.tools.map((t) => <button key={t.label} onClick={t.onClick} disabled={t.disabled}>{t.icon}{t.label}</button>)
            : <button onClick={() => setFlip((x) => !x)}><Repeat />뒤집기</button>}
          <button onClick={() => setSheet({ kind: 'menu' })}><Ellipsis />메뉴</button>
        </nav>
        {sheets}
      </div>
    );
  }

  return (
    <div className="game">
      <div className="game-board-col">
        <PlayerStrip color={top} info={p.players[top]} state={state} onInspect={(id) => setSheet({ kind: 'card', id })} />
        {board}
        <PlayerStrip color={orientation} info={p.players[orientation]} state={state} onInspect={(id) => setSheet({ kind: 'card', id })} />
      </div>
      <div className="game-status">{statusNode}</div>
      <aside className="game-side">
        <div className="side-box">
          <div className="side-h"><span>{p.self || actor ? '내 카드' : `${myColor === 'w' ? '백' : '흑'} 카드`}</span><span style={{ fontWeight: 600, fontSize: 12.5 }}>액티브는 차례를 쓰지 않습니다</span></div>
          {handCards.length === 0 ? <div className="hand-empty">아직 카드가 없습니다. 내 0·10·20번째 수에 카드를 고릅니다.</div> : (
            <div className="hand-chips">
              {handCards.map(([id, used]) => (
                <CardChip key={id} def={CARDS[id]!} used={used} ready={!used && isReady(id)} guide={p.guideCard === id && !target}
                  selected={target?.id === id} onClick={() => tapCard(id)} onLongPress={() => showCard(id)} />
              ))}
            </div>
          )}
        </div>
        {(p.showMoves ?? true) ? (
          <div className="side-box">
            <div className="side-h"><span>기보</span><span className="mono">{history.filter((e) => e.kind === 'move').length}수</span></div>
            <MoveList history={history} view={shownIdx} marks={marks} onSelect={selectMove} />
            <div className="nav-row">
              <button className="icon-btn" onClick={() => go(0)} aria-label="처음"><ChevronFirst /></button>
              <button className="icon-btn" onClick={() => go(shownIdx - 1)} aria-label="이전"><ChevronLeft /></button>
              <button className="icon-btn" onClick={() => go(shownIdx + 1)} aria-label="다음"><ChevronRight /></button>
              <button className="icon-btn" onClick={() => setView(null)} aria-label="현재"><ChevronLast /></button>
              <button className="icon-btn" onClick={() => setFlip((x) => !x)} title="판 뒤집기 (F)"><Repeat /></button>
              <button className="icon-btn" onClick={openSettings} title="설정"><SettingsIcon /></button>
            </div>
            {(p.tools?.length || p.menu?.length) ? (
              <div className="ctrl-row">{[...(p.tools ?? []), ...(p.menu ?? [])].map((m) => <button key={m.label} className={`btn sm${m.danger ? ' danger' : ''}`} disabled={m.disabled} onClick={m.onClick}>{m.icon}{m.label}</button>)}</div>
            ) : null}
          </div>
        ) : p.menu && p.menu.length > 0 && (
          <div className="row wrap">{p.menu.map((m) => <button key={m.label} className={`btn sm${m.danger ? ' danger' : ''}`} onClick={m.onClick}>{m.icon}{m.label}</button>)}</div>
        )}
      </aside>
      {sheets}
    </div>
  );
}

export const REASON_TEXT: Record<string, string> = {
  'king-captured': '킹을 잡았습니다', checkmate: '체크메이트', overtime: '연장전 판정 · 기물 점수', stalemate: '스테일메이트 · 둘 수 있는 수가 없습니다', 'no-moves': '둘 수 있는 수가 없습니다', 'card-win': '카드 효과로 승리', 'ply-limit': '300수에 도달했습니다',
  'quiet-limit': '100수 동안 잡거나 폰을 움직이지 않았습니다', repetition: '같은 국면이 세 번 나왔습니다', resign: '기권', timeout: '시간 초과',
  agreement: '합의 무승부', abort: '대국 취소', abandon: '이탈', end: '종료',
};
