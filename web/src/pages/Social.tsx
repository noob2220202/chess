import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, LogOut, Swords, UserX } from 'lucide-react';
import type { GameState, Move } from '@engine';
import { CARDS, applyMove, cloneState, newGame, pickCard, playCard, rankedPool } from '@engine';
import { Board } from '../game/Board.tsx';
import { CardView } from '../game/CardView.tsx';
import { REASON_TEXT } from '../game/GameScreen.tsx';
import { api, type PublicRating } from '../lib/api.ts';
import { useOnline } from '../lib/online.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { useToast } from '../lib/toast.tsx';
import { Sheet } from '../lib/ui.tsx';

interface Row { rank: number; username: string; rating: number; rd: number; games: number; wins: number; losses: number; draws: number }

export function Leaderboard() {
  const [data, setData] = useState<{ season: number; rows: Row[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useOnline();
  useEffect(() => { api<{ season: number; rows: Row[] }>('/api/leaderboard').then(setData).catch((e) => setErr(e.message)); }, []);
  return (
    <div className="page narrow">
      <div className="head">
        <div className="eyebrow">{data ? `시즌 ${data.season}` : '랭킹'}</div>
        <h1>리더보드</h1>
        <p>배치 10판을 마친 플레이어만 표시됩니다.</p>
      </div>
      {err && <p className="error-text">{err}</p>}
      {!data && !err && <div className="spinner" />}
      {data && data.rows.length === 0 && (
        <div className="surface pad center stack" style={{ padding: '36px 20px' }}>
          <img src="/pieces/wK.svg" alt="" style={{ width: 64, margin: '0 auto' }} />
          <b style={{ fontSize: 17 }}>아직 랭킹에 오른 플레이어가 없습니다</b>
          <span className="muted">레이팅전 10판을 마치면 첫 번째 주인공이 될 수 있습니다.</span>
          <div><button className="btn primary" onClick={() => navigate('/play/online')}><Swords />레이팅전 하기</button></div>
        </div>
      )}
      {data && data.rows.length > 0 && (
        <div className="list">
          {data.rows.map((r) => (
            <button key={r.username} className="list-row" onClick={() => navigate(`/u/${r.username}`)} style={user?.username === r.username ? { background: 'var(--accent-soft)' } : undefined}>
              <span className={`medal${r.rank <= 3 ? ` m${r.rank}` : ''}`}>{r.rank}</span>
              <span className="grow"><b>{r.username}</b><small>{r.wins}승 {r.draws}무 {r.losses}패</small></span>
              <span className="mono" style={{ textAlign: 'right' }}><b style={{ fontSize: 17 }}>{r.rating}</b><small className="muted" style={{ display: 'block', fontSize: 12 }}>±{r.rd}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ProfileGame { id: string; mode: string; rated: boolean; white: string; black: string; result: string; reason: string; delta: number | null; color: 'w' | 'b'; cards: string[]; endedAt: string }
interface ProfileData { user: { username: string; createdAt: string }; rating: PublicRating; season: number; games: ProfileGame[] }

export function Profile({ name }: { name: string }) {
  const [d, setD] = useState<ProfileData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const o = useOnline();
  useEffect(() => { setD(null); api<ProfileData>(`/api/users/${encodeURIComponent(name)}`).then(setD).catch((e) => setErr(e.message)); }, [name]);
  if (err) return <div className="page"><p className="error-text">{err}</p></div>;
  if (!d) return <div className="page"><div className="spinner" /></div>;
  const r = d.rating;
  const mine = o.user?.username === d.user.username;
  return (
    <div className="page narrow">
      <div className="row" style={{ gap: 14, marginBottom: 20 }}>
        <span className="avatar" style={{ width: 60, height: 60, borderRadius: 18, fontSize: 26 }}>{d.user.username.slice(0, 1).toUpperCase()}</span>
        <div className="grow">
          <h1 style={{ fontSize: 26, fontWeight: 850 }} className="ellipsis">{d.user.username}</h1>
          <p className="muted" style={{ fontSize: 14 }}>{new Date(d.user.createdAt).toLocaleDateString('ko-KR')} 가입 · 시즌 {d.season}</p>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat"><div className="v">{r.rating}{r.provisional ? '?' : ''}</div><div className="k">{r.provisional ? `배치 ${r.games}/10판` : `레이팅 ±${r.rd}`}</div></div>
        <div className="stat"><div className="v">{r.peak}</div><div className="k">최고</div></div>
        <div className="stat"><div className="v">{r.games}</div><div className="k">레이팅전</div></div>
        <div className="stat"><div className="v">{r.games ? Math.round(((r.wins + r.draws / 2) / r.games) * 100) : 0}%</div><div className="k">승률</div></div>
      </div>
      <div className="section-h"><h2>최근 대국</h2></div>
      {d.games.length === 0 ? <p className="muted">아직 대국 기록이 없습니다.</p> : (
        <div className="list">
          {d.games.map((g) => {
            const res = g.result === 'aborted' ? '취소' : g.result === 'draw' ? '무' : g.result === g.color ? '승' : '패';
            const opp = g.color === 'w' ? g.black : g.white;
            return (
              <button key={g.id} className="list-row" disabled={g.result === 'aborted'} onClick={() => navigate(`/game/${g.id}`)}>
                <span className={`chip ${res === '승' ? 'good' : res === '패' ? 'bad' : ''}`} style={{ minWidth: 38, justifyContent: 'center' }}>{res}</span>
                <span className="grow">
                  <b className="ellipsis">vs {opp}</b>
                  <small className="ellipsis">{g.rated ? '레이팅전' : '일반전'} · {REASON_TEXT[g.reason] ?? g.reason}{g.cards.length ? ` · ${g.cards.map((c) => CARDS[c]?.name).filter(Boolean).join(', ')}` : ''}</small>
                </span>
                {g.delta !== null && <b className={`mono delta ${g.delta >= 0 ? 'up' : 'down'}`}>{g.delta >= 0 ? '+' : ''}{g.delta}</b>}
                {g.result !== 'aborted' && <ChevronRight className="chev" />}
              </button>
            );
          })}
        </div>
      )}
      {mine && <AccountSection />}
    </div>
  );
}

function AccountSection() {
  const o = useOnline();
  const toast = useToast();
  const [ask, setAsk] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function del(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api('/api/auth/delete', { body: { password: pw } });
      await o.signOut();
      toast('계정을 삭제했습니다.');
      navigate('/');
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <>
      <div className="section-h"><h2>계정</h2></div>
      <div className="list">
        <button className="list-row" onClick={async () => { await o.signOut(); navigate('/'); }}>
          <span className="ic slate"><LogOut /></span><span className="grow"><b>로그아웃</b></span>
        </button>
        <button className="list-row" onClick={() => { setAsk(true); setPw(''); setErr(null); }}>
          <span className="ic rose"><UserX /></span><span className="grow"><b>계정 삭제</b><small>레이팅과 친구 목록이 지워지며 되돌릴 수 없습니다</small></span>
        </button>
      </div>
      {ask && (
        <Sheet onClose={() => setAsk(false)} label="계정 삭제">
          <form className="stack" style={{ gap: 14 }} onSubmit={del}>
            <h2>계정을 삭제하시겠습니까?</h2>
            <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.65 }}>비밀번호, 레이팅, 친구 목록을 바로 지웁니다. 지난 대국 기록은 상대방의 기보를 위해 남지만, 아이디는 알아볼 수 없게 바뀝니다. 삭제한 계정은 되돌릴 수 없습니다.</p>
            <div className="field">
              <label htmlFor="del-pw">비밀번호 확인</label>
              <input id="del-pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required autoFocus />
            </div>
            {err && <p className="error-text" role="alert">{err}</p>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setAsk(false)}>취소</button>
              <button className="btn danger" disabled={busy || pw.length === 0}>{busy ? '삭제 중…' : '계정 삭제'}</button>
            </div>
          </form>
        </Sheet>
      )}
    </>
  );
}

interface Rec {
  id: string; mode: string; rated: boolean; seed: number; mirror: boolean; whiteName: string; blackName: string; result: string; reason: string;
  actions: Array<{ t: 'pick' | 'card' | 'move'; c: 'w' | 'b'; id?: string; sel?: number[]; move?: Move }>;
}

export function Replay({ id }: { id: string }) {
  const [rec, setRec] = useState<Rec | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [i, setI] = useState(0);
  useEffect(() => { api<{ game: Rec }>(`/api/games/${id}`).then((r) => { setRec(r.game); setI(r.game.actions.length); }).catch((e) => setErr(e.message)); }, [id]);
  const states = useMemo(() => {
    if (!rec) return [] as Array<{ s: GameState; last: { from: number; to: number } | null }>;
    let s = newGame({ seed: rec.seed, mirror: rec.mirror, pool: rec.mirror ? rankedPool() : undefined });
    const out = [{ s: cloneState(s), last: null as { from: number; to: number } | null }];
    for (const a of rec.actions) {
      s = cloneState(s);
      try {
        if (a.t === 'pick') pickCard(s, a.c, a.id!);
        else if (a.t === 'card') playCard(s, a.c, a.id!, a.sel!);
        else applyMove(s, a.move!);
      } catch { break; }
      out.push({ s, last: a.t === 'move' ? { from: a.move!.from, to: a.move!.to } : out[out.length - 1]!.last });
    }
    return out;
  }, [rec]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); if (e.key === 'ArrowRight') setI((x) => Math.min(states.length - 1, x + 1)); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [states.length]);
  if (err) return <div className="page"><p className="error-text">{err}</p></div>;
  if (!rec || !states.length) return <div className="page"><div className="spinner" /></div>;
  const cur = states[Math.min(i, states.length - 1)]!;
  const a = i > 0 ? rec.actions[i - 1] : null;
  return (
    <div className="page wide">
      <div className="head">
        <div className="eyebrow">기보 · {rec.rated ? '레이팅전' : '일반전'}</div>
        <h1 style={{ fontSize: 26 }}>{rec.whiteName} vs {rec.blackName}</h1>
        <p>{rec.result === 'draw' ? '무승부' : `${rec.result === 'w' ? rec.whiteName : rec.blackName} 승리`} · {REASON_TEXT[rec.reason] ?? rec.reason}</p>
      </div>
      <div className="game">
        <div className="game-board-col"><Board state={cur.s} orientation="w" actor={null} lastMove={cur.last} /></div>
        <div className="game-status">
          <div className="notice">
            <span className="grow"><b className="mono">{i}/{states.length - 1}</b>{a && <span className="muted"> · {a.c === 'w' ? '백' : '흑'} {a.t === 'move' ? '수' : a.t === 'pick' ? '카드 선택' : '카드 사용'}{a.id ? ` · ${CARDS[a.id]?.name}` : ''}</span>}</span>
          </div>
        </div>
        <aside className="game-side">
          <div className="side-box" style={{ padding: 14 }}>
            <input type="range" min={0} max={states.length - 1} value={i} onChange={(e) => setI(Number(e.target.value))} aria-label="기보 위치" style={{ width: '100%', accentColor: 'var(--accent)' }} />
            <div className="nav-row" style={{ boxShadow: 'none', padding: '6px 0 0' }}>
              <button className="icon-btn" onClick={() => setI(0)} aria-label="처음"><ChevronFirst /></button>
              <button className="icon-btn" onClick={() => setI(Math.max(0, i - 1))} aria-label="이전"><ChevronLeft /></button>
              <button className="icon-btn" onClick={() => setI(Math.min(states.length - 1, i + 1))} aria-label="다음"><ChevronRight /></button>
              <button className="icon-btn" onClick={() => setI(states.length - 1)} aria-label="끝"><ChevronLast /></button>
            </div>
          </div>
          {(['w', 'b'] as const).map((c) => (
            <div key={c} className="side-box">
              <div className="side-h">{c === 'w' ? rec.whiteName : rec.blackName}의 카드</div>
              <div className="hand-grid">
                {[...cur.s.cards[c].hand, ...cur.s.cards[c].used].map((cid) => <CardView key={cid} def={CARDS[cid]!} used={cur.s.cards[c].used.includes(cid)} />)}
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
