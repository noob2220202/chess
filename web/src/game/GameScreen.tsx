import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CardId, Color, GameState, Move, Square } from '@engine';
import { CARDS, cardReady, targetOptions } from '@engine';
import { Board } from './Board.tsx';
import { CardView } from './CardView.tsx';
import { CATEGORY_HINT, CATEGORY_LABEL } from './cardMeta.ts';
import { pieceSrc } from './PieceIcon.tsx';

export interface PlayerInfo { name: string; sub?: string; clockMs?: number | null; running?: boolean }

export interface GameScreenProps {
  state: GameState;
  orientation: Color;
  actor: Color | null;
  players: Record<Color, PlayerInfo>;
  lastMove?: { from: Square; to: Square } | null;
  onPick: (id: CardId) => void;
  onCard: (id: CardId, sel: Square[]) => void;
  onMove: (m: Move) => void;
  status?: ReactNode;
  controls?: ReactNode;
  log?: string[];
  overlay?: ReactNode;
  hints?: Square[];
  /** Hide the draft modal (e.g. tutorial drives drafting itself). */
  hideDraft?: boolean;
  /** The viewer's own colour (online, AI, tutorial); null for pass-and-play. */
  self?: Color | null;
}

export function formatClock(ms: number): string {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000), s = Math.floor((t % 60000) / 1000);
  if (t < 10_000) return `${s}.${Math.floor((t % 1000) / 100)}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function PlayerBar({ color, info, state, onInspect }: { color: Color; info: PlayerInfo; state: GameState; onInspect: (id: CardId) => void }) {
  const cards = state.cards[color];
  const turn = state.turn === color && !state.winner;
  const low = info.clockMs !== undefined && info.clockMs !== null && info.clockMs < 20_000;
  return (
    <div className={`player-bar${turn ? ' turn' : ''}`}>
      <div className="avatar" style={{ background: color === 'w' ? 'var(--light-sq)' : 'var(--dark-sq)' }}>
        <img src={pieceSrc(color, 'K')} alt="" />
      </div>
      <div className="grow">
        <div className="name">{info.name}</div>
        <div className="sub">{info.sub ?? (color === 'w' ? '백' : '흑')}</div>
      </div>
      <div className="mini-hand" aria-label="보유 카드">
        {[...cards.hand.map((id) => [id, false] as const), ...cards.used.map((id) => [id, true] as const)].map(([id, used]) => {
          const d = CARDS[id];
          if (!d) return null;
          return (
            <button key={id} className={`mini-card${used ? ' used' : ''}`} title={d.name} onClick={() => onInspect(id)}
              style={{ background: `var(--cat-${d.category === 'OPENING' ? 'opening' : d.category === 'MIDDLE' ? 'middle' : 'end'})` }} />
          );
        })}
        {cards.offer && <span className="chip muted">고르는 중…</span>}
      </div>
      {info.clockMs !== undefined && info.clockMs !== null && (
        <div className={`clock${info.running ? ' running' : ''}${low && info.running ? ' low' : ''}`}>{formatClock(info.clockMs)}</div>
      )}
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
        <button className="btn primary lg" onClick={() => setPeek(false)}>카드 선택으로 돌아가기</button>
      </div>
    );
  }
  return (
    <div className="modal-backdrop">
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="draft-title">
        <div className="eyebrow">드래프트 {round + 1} / 3 · {CATEGORY_LABEL[cat]}</div>
        <h2 id="draft-title">증강 카드를 하나 고르세요</h2>
        <p className="muted">{CATEGORY_HINT[cat]}. 패시브는 계속 적용되고, 액티브는 원하는 때 한 번 쓸 수 있어요(턴 소모 없음).</p>
        <div className="draft-cards">
          {offer.map((id) => (
            <CardView key={id} def={CARDS[id]!} selected={sel === id} onClick={() => setSel(id)} />
          ))}
        </div>
        {sel && CARDS[sel]!.detail && <p className="status-line" style={{ marginBottom: 12 }}>{CARDS[sel]!.detail}</p>}
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn ghost" onClick={() => setPeek(true)}>보드 보기</button>
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
        <div className="row" style={{ alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ width: 200 }}><CardView def={d} /></div>
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

export function GameScreen(p: GameScreenProps) {
  const { state, actor } = p;
  const [target, setTarget] = useState<{ id: CardId; picked: Square[] } | null>(null);
  const [confirm, setConfirm] = useState<CardId | null>(null);
  const [inspect, setInspect] = useState<CardId | null>(null);
  useEffect(() => { setTarget(null); setConfirm(null); }, [state]);

  const myColor = p.self ?? actor ?? p.orientation;
  const options = useMemo(() => (target && actor ? targetOptions(state, actor, target.id, target.picked) : []), [target, state, actor]);
  const top: Color = p.orientation === 'w' ? 'b' : 'w';
  const offer = actor ? state.cards[actor].offer : null;

  function startCard(id: CardId) {
    if (!actor || !cardReady(state, actor, id)) return;
    const def = CARDS[id]!;
    if (!def.targets?.length) setConfirm(id);
    else setTarget({ id, picked: [] });
  }
  function addTarget(sq: Square) {
    if (!target) return;
    const picked = [...target.picked, sq];
    if (picked.length === (CARDS[target.id]!.targets?.length ?? 0)) {
      setTarget(null);
      p.onCard(target.id, picked);
    } else setTarget({ ...target, picked });
  }

  const hand = state.cards[myColor];
  const targetPrompt = target ? CARDS[target.id]!.targets![target.picked.length]?.prompt : null;

  return (
    <div className="game">
      <div className="game-board-col">
        <PlayerBar color={top} info={p.players[top]} state={state} onInspect={setInspect} />
        <Board
          state={state}
          orientation={p.orientation}
          actor={target ? null : actor}
          lastMove={p.lastMove}
          targeting={target ? { options, picked: target.picked } : null}
          hints={p.hints}
          onMove={p.onMove}
          onTarget={addTarget}
          onCancelTarget={() => setTarget(null)}
        />
        <PlayerBar color={p.orientation} info={p.players[p.orientation]} state={state} onInspect={setInspect} />
      </div>
      <div className="game-status">
        {target ? (
          <div className="status-line info row">
            <span className="grow"><b>{CARDS[target.id]!.name}</b> · {targetPrompt} 을(를) 보드에서 고르세요{options.length === 0 ? ' (선택 가능한 칸 없음)' : ''}</span>
            <button className="btn sm" onClick={() => setTarget(null)}>취소</button>
          </div>
        ) : p.status}
      </div>
      <aside className="game-side">
        <div className="hand">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow">{p.self || actor ? '내 카드' : `${myColor === 'w' ? '백' : '흑'} 카드`}</span>
            <span className="muted" style={{ fontSize: 13 }}>액티브는 한 차례에 한 장, 턴 소모 없음</span>
          </div>
          {hand.hand.length + hand.used.length === 0 ? (
            <div className="status-line muted">아직 카드가 없어요. 드래프트는 내 0·10·20번째 수에 열려요.</div>
          ) : (
            <div className="hand-cards">
              {hand.hand.map((id) => {
                const d = CARDS[id]!;
                const ready = !!actor && d.kind === 'active' && cardReady(state, actor, id);
                return (
                  <CardView key={id} def={d} compact selected={target?.id === id}
                    disabled={d.kind === 'active' && !ready}
                    onClick={ready ? () => startCard(id) : () => setInspect(id)} />
                );
              })}
              {hand.used.map((id) => <CardView key={id} def={CARDS[id]!} compact used onClick={() => setInspect(id)} />)}
            </div>
          )}
        </div>
        {p.controls && <div className="actions-row">{p.controls}</div>}
        {p.log && p.log.length > 0 && (
          <div className="panel soft" style={{ padding: 10 }}>
            <div className="eyebrow" style={{ margin: '2px 6px 8px' }}>기록</div>
            <div className="log">{p.log.slice().reverse().map((l, i) => <div key={i}>{l}</div>)}</div>
          </div>
        )}
      </aside>

      {offer && offer.length > 0 && !p.hideDraft && actor && !state.winner && (
        <DraftModal key={state.cards[actor].draftsTaken} offer={offer} round={state.cards[actor].draftsTaken} onPick={p.onPick} />
      )}
      {confirm && (
        <div className="modal-backdrop" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{CARDS[confirm]!.name} 사용</h2>
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
  'king-captured': '킹 포획', 'no-moves': '둘 수 있는 수가 없음', 'card-win': '카드 효과', 'ply-limit': '300수 제한',
  'quiet-limit': '100수 동안 포획·폰 이동 없음', repetition: '같은 국면 3회 반복', resign: '기권', timeout: '시간 초과',
  agreement: '합의 무승부', abort: '대국 취소', abandon: '이탈', end: '종료',
};

export function ResultModal({ title, subtitle, delta, children }: { title: string; subtitle: string; delta?: number | null; children: ReactNode }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="result-banner stack">
          <div className="big">{title}</div>
          <div className="muted">{subtitle}</div>
          {delta !== undefined && delta !== null && (
            <div className={`delta ${delta >= 0 ? 'up' : 'down'}`}>{delta >= 0 ? `+${delta}` : delta} 레이팅</div>
          )}
          <div className="row" style={{ justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
