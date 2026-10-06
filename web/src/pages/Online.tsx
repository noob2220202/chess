import { useEffect, useRef, useState } from 'react';
import type { Color, Square } from '@engine';
import { describeCard, describeMove, describePick } from '../game/describe.ts';
import { GameScreen, REASON_TEXT, ResultModal } from '../game/GameScreen.tsx';
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
      <div className="main" style={{ maxWidth: 460 }}>
        <div className="page-head"><div><div className="eyebrow">온라인</div><h1>레이팅전</h1><p>로그인하면 바로 매칭을 시작할 수 있어요.</p></div></div>
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
    <div className="main" style={{ maxWidth: 820 }}>
      <div className="page-head">
        <div><div className="eyebrow">온라인 · 시즌 {o.season}</div><h1>대전 로비</h1><p>{o.status === 'online' ? '서버에 연결됨' : o.status === 'offline' ? '연결이 끊겨 다시 연결하는 중…' : '연결 중…'}</p></div>
        <Link to={`/u/${o.user!.username}`} className="btn sm">내 프로필</Link>
      </div>
      {r && (
        <div className="stat-grid" style={{ marginBottom: 22 }}>
          <div className="stat"><div className="v">{r.rating}{r.provisional ? '?' : ''}</div><div className="k">레이팅{r.provisional ? ` · 배치 ${r.games}/10` : ` · ±${r.rd}`}</div></div>
          <div className="stat"><div className="v">{r.games}</div><div className="k">레이팅전</div></div>
          <div className="stat"><div className="v">{r.wins}-{r.draws}-{r.losses}</div><div className="k">승-무-패</div></div>
          <div className="stat"><div className="v">{r.peak}</div><div className="k">최고 레이팅</div></div>
        </div>
      )}
      {o.queue ? (
        <div className="panel pad center">
          <div className="queue-pulse"><img src="/pieces/bN.svg" alt="" /></div>
          <h2>{o.queue.mode === 'rated' ? '레이팅전' : '일반전'} 상대를 찾는 중</h2>
          <p className="muted mono" style={{ margin: '6px 0 18px' }}>{Math.floor(waiting / 60)}:{String(waiting % 60).padStart(2, '0')}</p>
          <button className="btn" onClick={o.leaveQueue}>취소</button>
        </div>
      ) : (
        <div className="mode-grid">
          <button className="mode-card" onClick={() => o.joinQueue('rated')} disabled={o.status !== 'online'}>
            <span className="chip amber" style={{ alignSelf: 'flex-start' }}>레이팅</span>
            <h3>레이팅전</h3>
            <p>10분 + 5초 · 미러 드래프트 · 비슷한 실력과 매칭</p>
            <span className="go">→</span>
          </button>
          <button className="mode-card" onClick={() => o.joinQueue('casual')} disabled={o.status !== 'online'}>
            <span className="chip muted" style={{ alignSelf: 'flex-start' }}>친선</span>
            <h3>일반전</h3>
            <p>5분 + 3초 · 개별 드래프트 · 레이팅 변동 없음</p>
            <span className="go">→</span>
          </button>
        </div>
      )}
      <p className="muted" style={{ marginTop: 18, fontSize: 14 }}>처음이라면 <Link to="/learn/ranked">레이팅전 안내</Link>를 먼저 읽어보세요.</p>
    </div>
  );
}

function OnlineGame() {
  const o = useOnline();
  const g = o.game!;
  const [, setTick] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const lastKey = useRef<string>('');
  const prevState = useRef(g.state);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 200); return () => clearInterval(t); }, []);

  // Build a readable log from consecutive server updates.
  useEffect(() => {
    const a = g.lastAction;
    if (!a) { prevState.current = g.state; return; }
    const key = JSON.stringify(a);
    if (key !== lastKey.current) {
      lastKey.current = key;
      const before = prevState.current;
      const line = a.t === 'pick' ? describePick(a.c, a.id!) : a.t === 'card' ? describeCard(a.c, a.id!, (a as { sel?: Square[] }).sel ?? []) : describeMove({ ...before, turn: a.c }, a.move!);
      setLog((l) => [...l, a.t === 'pick' && a.c !== g.you ? `${a.c === 'w' ? '백' : '흑'}: 카드 선택` : line]);
    }
    prevState.current = g.state;
  }, [g]);

  const you = g.you ?? 'w';
  const opp: Color = you === 'w' ? 'b' : 'w';
  const serverNow = Date.now() + o.offset;
  const running = g.result ? null : g.state.turn;
  const clock = (c: Color) => (running === c ? g.clocks[c] - (serverNow - g.turnStartedAt) : g.clocks[c]);
  const actor = !g.result && g.state.turn === you ? you : null;
  const send = (m: Record<string, unknown>) => o.send({ ...m, gameId: g.id });

  const info = (c: Color) => ({
    name: g.players[c].username,
    sub: `${c === 'w' ? '백' : '흑'} · ${g.players[c].rating}${g.players[c].provisional ? '?' : ''}`,
    clockMs: clock(c),
    running: running === c,
  });

  let status: React.ReactNode;
  if (g.result) status = null;
  else if (g.abortAt && actor) status = <div className="status-line attn">{Math.max(0, Math.ceil((g.abortAt - serverNow) / 1000))}초 안에 첫 수를 두지 않으면 대국이 취소돼요.</div>;
  else if (g.drawOffer === opp) status = (
    <div className="status-line info row"><span className="grow">상대가 무승부를 제안했어요.</span>
      <button className="btn sm" onClick={() => send({ type: 'draw', action: 'decline' })}>거절</button>
      <button className="btn sm teal" onClick={() => send({ type: 'draw', action: 'accept' })}>수락</button></div>
  );
  else status = <div className={`status-line${actor ? ' attn' : ''}`}>{actor ? '내 차례예요.' : g.state.cards[opp].offer ? '상대가 카드를 고르는 중…' : '상대 차례예요.'} <span className="muted">· {g.rated ? '레이팅전' : '일반전'} · 수당 +{g.increment / 1000}초</span></div>;

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

  const last = g.lastAction?.t === 'move' && g.lastAction.move ? { from: g.lastAction.move.from, to: g.lastAction.move.to } : null;

  return (
    <div className="main wide">
      <GameScreen
        state={g.state}
        orientation={you}
        self={you}
        actor={actor}
        players={{ [you]: info(you), [opp]: info(opp) } as Record<Color, ReturnType<typeof info>>}
        lastMove={last}
        onPick={(id) => send({ type: 'pick', id })}
        onCard={(id, sel) => send({ type: 'card', id, sel })}
        onMove={(move) => send({ type: 'move', move })}
        status={status}
        log={log}
        overlay={overlay}
        controls={!g.result && (
          <>
            <button className="btn sm danger" onClick={() => { if (confirm(g.state.ply < 2 ? '대국을 취소할까요?' : '기권할까요?')) send({ type: 'resign' }); }}>{g.state.ply < 2 ? '취소' : '기권'}</button>
            <button className="btn sm" disabled={g.drawOffer === you} onClick={() => send({ type: 'draw', action: 'offer' })}>{g.drawOffer === you ? '무승부 제안함' : '무승부 제안'}</button>
            {o.status !== 'online' && <span className="chip red">재연결 중…</span>}
          </>
        )}
      />
    </div>
  );
}

export type { GameView };
