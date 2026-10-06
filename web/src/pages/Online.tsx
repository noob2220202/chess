import { useEffect, useRef, useState } from 'react';
import type { Color } from '@engine';
import { GameScreen, REASON_TEXT, ResultModal } from '../game/GameScreen.tsx';
import { cardEntry, moveEntry, pickEntry, startEntry, type HistEntry } from '../game/history.ts';
import { useOnline, type GameView } from '../lib/online.tsx';
import { Link } from '../lib/router.tsx';
import { useToast } from '../lib/toast.tsx';
import { AuthForm } from './Login.tsx';

export default function Online() {
  const o = useOnline();
  const toast = useToast();
  const lastErr = useRef<string | null>(null);
  useEffect(() => { if (o.lastError && o.lastError !== lastErr.current) toast(o.lastError, 'error'); lastErr.current = o.lastError; }, [o.lastError, toast]);

  if (!o.user) {
    return (
      <div className="main" style={{ maxWidth: 440 }}>
        <div className="page-head"><div><div className="eyebrow">온라인 대전</div><h1>로그인이 필요해요</h1><p>로그인하면 바로 상대를 찾을 수 있어요.</p></div></div>
        {o.status === 'connecting' ? <div className="spinner" /> : <AuthForm />}
      </div>
    );
  }
  if (o.game) return <OnlineGame key={o.game.id} />;
  return <Lobby />;
}

function Lobby() {
  const o = useOnline();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const r = o.rating;
  const waiting = o.queue ? Math.max(0, Math.floor((now - o.queue.since) / 1000)) : 0;
  return (
    <div className="main" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">온라인 대전 · 시즌 {o.season}</div>
          <h1>상대 찾기</h1>
          <p>{o.status === 'online' ? '서버에 연결되어 있어요.' : o.status === 'offline' ? '연결이 끊겨서 다시 연결하는 중이에요…' : '서버에 연결하는 중이에요…'}</p>
        </div>
        <Link to={`/u/${o.user!.username}`} className="btn sm">내 프로필</Link>
      </div>
      {r && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat"><div className="v">{r.rating}{r.provisional ? '?' : ''}</div><div className="k">{r.provisional ? `배치 중 (${r.games}/10판)` : `레이팅 · 오차 ±${r.rd}`}</div></div>
          <div className="stat"><div className="v">{r.games}</div><div className="k">레이팅전 판수</div></div>
          <div className="stat"><div className="v">{r.wins}·{r.draws}·{r.losses}</div><div className="k">승 · 무 · 패</div></div>
          <div className="stat"><div className="v">{r.peak}</div><div className="k">최고 레이팅</div></div>
        </div>
      )}
      {o.queue ? (
        <div className="panel pad center">
          <div className="queue-pulse"><img src="/pieces/bN.svg" alt="" /></div>
          <h2>{o.queue.mode === 'rated' ? '레이팅전' : '일반전'} 상대를 찾고 있어요</h2>
          <p className="muted mono" style={{ margin: '6px 0 18px' }}>{Math.floor(waiting / 60)}:{String(waiting % 60).padStart(2, '0')}</p>
          <button className="btn" onClick={o.leaveQueue}>취소</button>
        </div>
      ) : (
        <div className="quick-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          <button className="quick feature" style={{ minHeight: 132 }} onClick={() => o.joinQueue('rated')} disabled={o.status !== 'online'}>
            <span className="tc">10+5</span><span className="lbl">레이팅전 · 같은 카드로 겨루기</span>
          </button>
          <button className="quick" style={{ minHeight: 132 }} onClick={() => o.joinQueue('casual')} disabled={o.status !== 'online'}>
            <span className="tc">5+3</span><span className="lbl">일반전 · 레이팅 변동 없음</span>
          </button>
        </div>
      )}
      <p className="muted" style={{ marginTop: 18, fontSize: 14 }}>처음이라면 <Link to="/learn/ranked">레이팅전 안내</Link>를 먼저 읽어 보세요.</p>
    </div>
  );
}

/** Accumulate a history from successive server views. */
function useServerHistory(g: GameView): HistEntry[] {
  const [hist, setHist] = useState<HistEntry[]>(() => [startEntry(g.state)]);
  const lastKey = useRef<string>(JSON.stringify(g.lastAction));
  useEffect(() => {
    const a = g.lastAction;
    const key = JSON.stringify(a);
    setHist((h) => {
      const prev = h[h.length - 1]!;
      if (!a || key === lastKey.current) return [...h.slice(0, -1), { ...prev, state: g.state }];
      lastKey.current = key;
      const entry = a.t === 'move' && a.move ? moveEntry({ ...prev.state, turn: a.c }, a.move, g.state)
        : a.t === 'card' ? cardEntry(a.c, a.id!, g.state, prev.last)
          : pickEntry(a.c, a.id!, g.state, prev.last);
      return [...h, entry];
    });
  }, [g]);
  return hist;
}

function OnlineGame() {
  const o = useOnline();
  const g = o.game!;
  const hist = useServerHistory(g);
  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 200); return () => clearInterval(t); }, []);

  const you = g.you ?? 'w';
  const opp: Color = you === 'w' ? 'b' : 'w';
  const serverNow = Date.now() + o.offset;
  const running = g.result ? null : g.state.turn;
  const clock = (c: Color) => (running === c ? g.clocks[c] - (serverNow - g.turnStartedAt) : g.clocks[c]);
  const actor = !g.result && g.state.turn === you ? you : null;
  const send = (m: Record<string, unknown>) => o.send({ ...m, gameId: g.id });
  const info = (c: Color) => ({ name: g.players[c].username, sub: `${g.players[c].rating}${g.players[c].provisional ? '?' : ''}`, clockMs: clock(c), running: running === c });

  let status: React.ReactNode;
  if (g.result) status = null;
  else if (g.abortAt && actor) status = <div className="status-line attn">{Math.max(0, Math.ceil((g.abortAt - serverNow) / 1000))}초 안에 첫 수를 두지 않으면 대국이 취소돼요.</div>;
  else if (g.drawOffer === opp) status = (
    <div className="status-line info row"><span className="grow">상대가 무승부를 제안했어요.</span>
      <button className="btn sm" onClick={() => send({ type: 'draw', action: 'decline' })}>거절</button>
      <button className="btn sm good" onClick={() => send({ type: 'draw', action: 'accept' })}>수락</button></div>
  );
  else status = (
    <div className={`status-line${actor ? ' attn' : ''}`}>
      {actor ? '내 차례예요.' : g.state.cards[opp].offer ? '상대가 카드를 고르고 있어요…' : '상대 차례예요.'}
      <span className="muted"> · {g.rated ? '레이팅전' : '일반전'} · 한 수에 +{g.increment / 1000}초</span>
    </div>
  );

  let overlay = null;
  if (g.result) {
    const w = g.result.winner;
    const title = w === 'aborted' ? '대국 취소' : w === 'draw' ? '무승부' : w === you ? '승리!' : '패배';
    overlay = (
      <ResultModal title={title} subtitle={REASON_TEXT[g.result.reason] ?? g.result.reason} delta={g.result.ratingDelta?.[you] ?? null}>
        <button className="btn" onClick={o.dismissGame}>로비로</button>
        <button className="btn primary" onClick={() => { const m = g.mode; o.dismissGame(); o.joinQueue(m); }}>다시 매칭</button>
      </ResultModal>
    );
  }

  return (
    <div className="main wide">
      <GameScreen
        history={hist}
        orientation={you}
        self={you}
        actor={actor}
        players={{ [you]: info(you), [opp]: info(opp) } as Record<Color, ReturnType<typeof info>>}
        onPick={(id) => send({ type: 'pick', id })}
        onCard={(id, sel) => send({ type: 'card', id, sel })}
        onMove={(move) => send({ type: 'move', move })}
        status={status}
        overlay={overlay}
        controls={!g.result && (
          <>
            <button className="btn sm danger" onClick={() => { if (confirm(g.state.ply < 2 ? '대국을 취소할까요?' : '기권할까요?')) send({ type: 'resign' }); }}>{g.state.ply < 2 ? '대국 취소' : '기권'}</button>
            <button className="btn sm" disabled={g.drawOffer === you} onClick={() => send({ type: 'draw', action: 'offer' })}>{g.drawOffer === you ? '무승부 제안함' : '무승부 제안'}</button>
            {o.status !== 'online' && <span className="chip bad">다시 연결하는 중…</span>}
          </>
        )}
      />
    </div>
  );
}
