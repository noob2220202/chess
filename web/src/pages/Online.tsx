import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Flag, Handshake, Swords, Timer, Trophy, UserRound } from 'lucide-react';
import type { Color } from '@engine';
import { GameScreen, REASON_TEXT, ResultModal, type MenuItem } from '../game/GameScreen.tsx';
import { cardEntry, moveEntry, pickEntry, startEntry, type HistEntry } from '../game/history.ts';
import { useOnline, type GameView } from '../lib/online.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { useToast } from '../lib/toast.tsx';
import { AuthForm } from './Login.tsx';

export default function Online() {
  const o = useOnline();
  const toast = useToast();
  const lastErr = useRef<string | null>(null);
  useEffect(() => { if (o.lastError && o.lastError !== lastErr.current) toast(o.lastError, 'error'); lastErr.current = o.lastError; }, [o.lastError, toast]);

  if (!o.user) {
    return (
      <div className="page" style={{ maxWidth: 440 }}>
        <div className="head"><div className="eyebrow">온라인 대전</div><h1>로그인하고 대전하기</h1><p>아이디와 비밀번호만 있으면 바로 시작할 수 있어요.</p></div>
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
  const offline = o.status !== 'online';
  return (
    <div className="page narrow">
      <div className="head">
        <div className="eyebrow">시즌 {o.season}</div>
        <h1>온라인 대전</h1>
        <p className="status-pill">{offline ? <>서버에 다시 연결하는 중이에요…</> : <><i />서버에 연결되어 있어요</>}</p>
      </div>

      {o.queue ? (
        <div className="surface pad center" style={{ padding: '30px 20px' }}>
          <div className="queue-orb"><img src="/pieces/bN.svg" alt="" /></div>
          <h2>{o.queue.mode === 'rated' ? '레이팅전' : '일반전'} 상대를 찾고 있어요</h2>
          <p className="muted mono" style={{ margin: '8px 0 20px', fontSize: 18 }}>{Math.floor(waiting / 60)}:{String(waiting % 60).padStart(2, '0')}</p>
          <button className="btn" onClick={o.leaveQueue}>취소</button>
        </div>
      ) : (
        <>
          <button className="hero-play" onClick={() => o.joinQueue('rated')} disabled={offline}>
            <img className="art" src="/pieces/wQ.svg" alt="" />
            <span className="kicker">같은 카드로 겨루는</span>
            <span className="title">레이팅전</span>
            <span className="meta"><span>10분 + 5초</span><span>미러 드래프트</span><span>{r ? `내 레이팅 ${r.rating}${r.provisional ? '?' : ''}` : ''}</span></span>
            <span className="go"><Swords /></span>
          </button>
          <div className="list" style={{ marginTop: 12 }}>
            <button className="list-row" onClick={() => o.joinQueue('casual')} disabled={offline}>
              <span className="ic blue"><Timer /></span>
              <span className="grow"><b>일반전</b><small>5분 + 3초 · 각자 다른 카드 · 레이팅 변동 없음</small></span>
              <ChevronRight className="chev" />
            </button>
            <button className="list-row" onClick={() => navigate('/friends')}>
              <span className="ic violet"><UserRound /></span>
              <span className="grow"><b>친구와 대국</b><small>친구 목록에서 신청하거나 초대 코드 공유</small></span>
              <ChevronRight className="chev" />
            </button>
            <button className="list-row" onClick={() => navigate('/learn/ranked')}>
              <span className="ic slate"><Trophy /></span>
              <span className="grow"><b>레이팅전 안내</b><small>시간 규칙, 대국 취소, 레이팅 계산 방법</small></span>
              <ChevronRight className="chev" />
            </button>
          </div>
        </>
      )}

      {r && (
        <>
          <div className="section-h"><h2>내 기록</h2><Link to={`/u/${o.user!.username}`}>프로필 보기</Link></div>
          <div className="stat-grid">
            <div className="stat"><div className="v">{r.rating}{r.provisional ? '?' : ''}</div><div className="k">{r.provisional ? `배치 ${r.games}/10판` : `레이팅 ±${r.rd}`}</div></div>
            <div className="stat"><div className="v">{r.games}</div><div className="k">레이팅전</div></div>
            <div className="stat"><div className="v">{r.wins}·{r.draws}·{r.losses}</div><div className="k">승 · 무 · 패</div></div>
            <div className="stat"><div className="v">{r.peak}</div><div className="k">최고 레이팅</div></div>
          </div>
        </>
      )}
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

  let status: React.ReactNode = null;
  if (!g.result) {
    if (g.abortAt && actor) status = <div className="notice attn"><Timer /><span className="grow">{Math.max(0, Math.ceil((g.abortAt - serverNow) / 1000))}초 안에 첫 수를 두지 않으면 대국이 취소돼요.</span></div>;
    else if (g.drawOffer === opp) status = (
      <div className="notice info"><Handshake /><span className="grow">상대가 무승부를 제안했어요.</span>
        <button className="btn sm" onClick={() => send({ type: 'draw', action: 'decline' })}>거절</button>
        <button className="btn sm good" onClick={() => send({ type: 'draw', action: 'accept' })}>수락</button></div>
    );
    else if (!actor && g.state.cards[opp].offer) status = <div className="notice"><span className="spinner" />상대가 카드를 고르고 있어요…</div>;
    else if (o.status !== 'online') status = <div className="notice"><span className="spinner" />서버에 다시 연결하는 중이에요…</div>;
  }

  let overlay = null;
  if (g.result) {
    const w = g.result.winner;
    const outcome = w === 'draw' || w === 'aborted' ? 'draw' : w === you ? 'win' : 'lose';
    const title = w === 'aborted' ? '대국 취소' : w === 'draw' ? '무승부' : w === you ? '승리!' : '패배';
    overlay = (
      <ResultModal outcome={outcome} title={title} subtitle={REASON_TEXT[g.result.reason] ?? g.result.reason} delta={g.result.ratingDelta?.[you] ?? null}>
        <button className="btn" onClick={o.dismissGame}>로비로</button>
        {g.friendly && g.result.winner !== 'aborted'
          ? <button className="btn primary" onClick={() => { o.challenge(g.userIds[opp], g.mode); o.dismissGame(); navigate('/friends'); }}>재대국 신청</button>
          : <button className="btn primary" onClick={() => { const m = g.mode; o.dismissGame(); o.joinQueue(m); }}>다시 매칭</button>}
      </ResultModal>
    );
  }

  const menu: MenuItem[] = g.result ? [] : [
    { label: g.drawOffer === you ? '무승부 제안함' : '무승부 제안', icon: <Handshake />, disabled: g.drawOffer === you, onClick: () => send({ type: 'draw', action: 'offer' }) },
    { label: g.state.ply < 2 ? '대국 취소' : '기권', icon: <Flag />, danger: true, onClick: () => { if (confirm(g.state.ply < 2 ? '대국을 취소할까요?' : '기권할까요?')) send({ type: 'resign' }); } },
  ];

  return (
    <div className="page wide">
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
        menu={menu}
        title={`${g.friendly ? '친선 ' : ''}${g.rated ? '레이팅전' : '일반전'} · ${g.increment === 5000 ? '10+5' : '5+3'}`}
        onBack={() => navigate('/')}
      />
    </div>
  );
}
