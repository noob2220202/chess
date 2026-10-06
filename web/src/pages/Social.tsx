import { useEffect, useMemo, useState } from 'react';
import type { GameState, Move } from '@engine';
import { CARDS, applyMove, cloneState, newGame, pickCard, playCard, rankedPool } from '@engine';
import { Board } from '../game/Board.tsx';
import { CardView } from '../game/CardView.tsx';
import { REASON_TEXT } from '../game/GameScreen.tsx';
import { api, type PublicRating } from '../lib/api.ts';
import { useOnline } from '../lib/online.tsx';
import { Link, navigate } from '../lib/router.tsx';

interface Row { rank: number; username: string; rating: number; rd: number; games: number; wins: number; losses: number; draws: number }

export function Leaderboard() {
  const [data, setData] = useState<{ season: number; rows: Row[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useOnline();
  useEffect(() => { api<{ season: number; rows: Row[] }>('/api/leaderboard').then(setData).catch((e) => setErr(e.message)); }, []);
  return (
    <div className="main" style={{ maxWidth: 820 }}>
      <div className="page-head">
        <div><div className="eyebrow">랭킹{data ? ` · 시즌 ${data.season}` : ''}</div><h1>리더보드</h1><p>배치 10판을 마친 플레이어만 표시돼요.</p></div>
        <Link to="/play/online" className="btn primary">레이팅전 하기</Link>
      </div>
      {err && <p className="error-text">{err}</p>}
      {!data && !err && <div className="spinner" />}
      {data && data.rows.length === 0 && (
        <div className="panel pad center stack"><b>아직 랭킹에 오른 플레이어가 없어요</b><span className="muted">레이팅전 10판을 마치면 첫 번째 주인공이 될 수 있어요.</span></div>
      )}
      {data && data.rows.length > 0 && (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>#</th><th>플레이어</th><th className="num">레이팅</th><th className="num">전적</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.username} style={user?.username === r.username ? { background: 'var(--amber-soft)' } : undefined}>
                  <td><span className={`rank-badge${r.rank <= 3 ? ` r${r.rank}` : ''}`}>{r.rank}</span></td>
                  <td><Link to={`/u/${r.username}`}>{r.username}</Link></td>
                  <td className="num"><b>{r.rating}</b> <span className="muted">±{r.rd}</span></td>
                  <td className="num">{r.wins}-{r.draws}-{r.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
  if (err) return <div className="main"><p className="error-text">{err}</p></div>;
  if (!d) return <div className="main"><div className="spinner" /></div>;
  const r = d.rating;
  const mine = o.user?.username === d.user.username;
  return (
    <div className="main" style={{ maxWidth: 900 }}>
      <div className="page-head">
        <div><div className="eyebrow">플레이어 · 시즌 {d.season}</div><h1>{d.user.username}</h1><p>{new Date(d.user.createdAt).toLocaleDateString('ko-KR')} 가입</p></div>
        {mine && <button className="btn sm" onClick={async () => { await o.signOut(); navigate('/'); }}>로그아웃</button>}
      </div>
      <div className="stat-grid" style={{ marginBottom: 26 }}>
        <div className="stat"><div className="v">{r.rating}{r.provisional ? '?' : ''}</div><div className="k">{r.provisional ? `배치 중 ${r.games}/10` : `레이팅 ±${r.rd}`}</div></div>
        <div className="stat"><div className="v">{r.peak}</div><div className="k">최고</div></div>
        <div className="stat"><div className="v">{r.games}</div><div className="k">레이팅전</div></div>
        <div className="stat"><div className="v">{r.games ? Math.round(((r.wins + r.draws / 2) / r.games) * 100) : 0}%</div><div className="k">승률 ({r.wins}-{r.draws}-{r.losses})</div></div>
      </div>
      <h2 style={{ fontSize: 22, marginBottom: 12 }}>최근 대국</h2>
      {d.games.length === 0 ? <p className="muted">아직 대국 기록이 없어요.</p> : (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>결과</th><th>상대</th><th>카드</th><th className="num">변동</th><th></th></tr></thead>
            <tbody>
              {d.games.map((g) => {
                const res = g.result === 'aborted' ? '취소' : g.result === 'draw' ? '무' : g.result === g.color ? '승' : '패';
                const opp = g.color === 'w' ? g.black : g.white;
                return (
                  <tr key={g.id}>
                    <td><span className={`chip ${res === '승' ? 'teal' : res === '패' ? 'red' : 'muted'}`}>{res}</span> <span className="muted" style={{ fontSize: 12 }}>{REASON_TEXT[g.reason] ?? g.reason}</span></td>
                    <td><Link to={`/u/${opp}`}>{opp}</Link> <span className="muted" style={{ fontSize: 12 }}>{g.rated ? '레이팅' : '일반'}</span></td>
                    <td style={{ fontSize: 13 }}>{g.cards.map((c) => CARDS[c]?.name).filter(Boolean).join(', ') || '—'}</td>
                    <td className="num">{g.delta === null ? '—' : <span className={`delta ${g.delta >= 0 ? 'up' : 'down'}`} style={{ fontSize: 15 }}>{g.delta >= 0 ? '+' : ''}{g.delta}</span>}</td>
                    <td>{g.result !== 'aborted' && <Link to={`/game/${g.id}`} className="btn sm">기보</Link>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
  if (err) return <div className="main"><p className="error-text">{err}</p></div>;
  if (!rec || !states.length) return <div className="main"><div className="spinner" /></div>;
  const cur = states[Math.min(i, states.length - 1)]!;
  const a = i > 0 ? rec.actions[i - 1] : null;
  return (
    <div className="main wide">
      <div className="page-head">
        <div><div className="eyebrow">기보 · {rec.rated ? '레이팅전' : '일반전'}</div><h1 style={{ fontSize: 28 }}>{rec.whiteName} vs {rec.blackName}</h1>
          <p>{rec.result === 'draw' ? '무승부' : `${rec.result === 'w' ? rec.whiteName : rec.blackName} 승리`} · {REASON_TEXT[rec.reason] ?? rec.reason}</p></div>
      </div>
      <div className="game">
        <div className="game-board-col"><Board state={cur.s} orientation="w" actor={null} lastMove={cur.last} /></div>
        <aside className="game-side">
          <div className="panel pad stack">
            <div className="row"><b className="grow">{i} / {states.length - 1}</b>{a && <span className="chip">{a.c === 'w' ? '백' : '흑'} · {a.t === 'move' ? '수' : a.t === 'pick' ? '카드 선택' : '카드 사용'}{a.id ? ` · ${CARDS[a.id]?.name}` : ''}</span>}</div>
            <input type="range" min={0} max={states.length - 1} value={i} onChange={(e) => setI(Number(e.target.value))} aria-label="기보 위치" />
            <div className="row">
              <button className="btn sm" onClick={() => setI(0)}>처음</button>
              <button className="btn sm" onClick={() => setI(Math.max(0, i - 1))}>이전</button>
              <button className="btn sm" onClick={() => setI(Math.min(states.length - 1, i + 1))}>다음</button>
              <button className="btn sm" onClick={() => setI(states.length - 1)}>끝</button>
            </div>
          </div>
          {(['w', 'b'] as const).map((c) => (
            <div key={c} className="stack" style={{ gap: 8 }}>
              <span className="eyebrow">{c === 'w' ? rec.whiteName : rec.blackName}의 카드</span>
              <div className="hand-cards">
                {[...cur.s.cards[c].hand, ...cur.s.cards[c].used].map((cid) => <CardView key={cid} def={CARDS[cid]!} compact used={cur.s.cards[c].used.includes(cid)} />)}
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

export function About() {
  return (
    <div className="main" style={{ maxWidth: 760 }}>
      <div className="page-head"><div><div className="eyebrow">정보</div><h1>규칙 요약 · 크레딧</h1></div></div>
      <div className="stack" style={{ gap: 18 }}>
        <div className="panel pad stack">
          <h3>핵심 규칙</h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>상대 킹을 잡으면 이겨요. 체크와 체크메이트 규칙은 없어요.</li>
            <li>내 0번째·10번째·20번째 수를 두기 직전에, 각각 오프닝·미들게임·엔드게임 카드 3장 중 1장을 골라요.</li>
            <li>액티브 카드는 차례를 쓰지 않고, 한 차례에 한 장만 쓸 수 있어요.</li>
            <li>둘 수 있는 수가 없으면 져요. 같은 국면이 세 번 나오거나, 양쪽 합쳐 100수 동안 기물을 잡지도 폰을 움직이지도 않거나, 300수에 도달하면 무승부예요.</li>
            <li>레이팅전은 두 사람이 같은 카드 중에서 고르는 미러 드래프트, 10분에 한 수당 5초 추가, Glicko-2 레이팅을 써요. 배치 10판을 마치면 랭킹에 올라요. 30초 안에 첫 수를 두지 않으면 대국이 취소돼요.</li>
          </ul>
        </div>
        <div className="panel pad stack">
          <h3>크레딧</h3>
          <p>체스 기물 그림: Colin M.L. Burnett (Cburnett), <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>. 특수 기물의 배지는 이 그림을 조합해 만들었어요.</p>
          <p className="muted">카드 이름, 효과, 그림, 앱 디자인은 이 프로젝트에서 직접 만들었어요.</p>
        </div>
        <div className="panel pad stack">
          <h3>개인정보</h3>
          <p className="muted">계정에는 아이디와 암호화한 비밀번호만 저장해요. 대국 기록과 카드 통계는 밸런스를 개선하는 데 써요. 튜토리얼 진행도와 설정은 이 기기에만 저장돼요.</p>
        </div>
      </div>
    </div>
  );
}
