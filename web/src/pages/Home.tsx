import { useEffect, useState } from 'react';
import { CARDS, CARD_ORDER } from '@engine';
import { APP_NAME } from '../brand.ts';
import { CardView } from '../game/CardView.tsx';
import { api } from '../lib/api.ts';
import { Icon } from '../lib/icons.tsx';
import { useOnline } from '../lib/online.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { getProgress } from '../lib/storage.ts';
import { LESSONS } from '../tutorial/lessons.ts';

interface Health { rooms: number; queue: number; online: number }
interface Row { rank: number; username: string; rating: number }

function cardOfTheDay() {
  const d = new Date();
  const n = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  return CARDS[CARD_ORDER[(n * 7919) % CARD_ORDER.length]!]!;
}

export default function Home() {
  const o = useOnline();
  const [health, setHealth] = useState<Health | null>(null);
  const [top, setTop] = useState<Row[] | null>(null);
  const prog = getProgress();
  const nextLesson = LESSONS.find((l) => !prog.lessons.includes(l.id));
  const daily = cardOfTheDay();

  useEffect(() => {
    api<Health>('/api/health').then(setHealth).catch(() => setHealth(null));
    api<{ rows: Row[] }>('/api/leaderboard').then((r) => setTop(r.rows.slice(0, 5))).catch(() => setTop([]));
  }, []);

  const queue = (mode: 'rated' | 'casual') => {
    if (!o.user) return navigate('/login?next=/play/online');
    o.joinQueue(mode);
    navigate('/play/online');
  };

  return (
    <div className="main">
      {prog.lessons.length === 0 && (
        <div className="welcome">
          <div className="grow">
            <h1>{APP_NAME}에 오신 걸 환영해요</h1>
            <p>체스에 증강 카드를 더한 게임이에요. 5분짜리 튜토리얼로 규칙부터 익혀 보세요.</p>
            <div className="row wrap" style={{ marginTop: 14 }}>
              <button className="btn primary lg" onClick={() => navigate('/learn/basics')}>튜토리얼 시작</button>
              <button className="btn lg" onClick={() => navigate('/play/ai?level=1&start=1')}>바로 AI와 두기</button>
            </div>
          </div>
          <div className="art"><CardView def={CARDS['amazon']!} compact /></div>
        </div>
      )}

      <div className="dash">
        <div>
          <div className="section-title" style={{ marginTop: 0 }}><h2>빠른 대전</h2>{health && <span className="muted" style={{ fontSize: 13 }}>접속 {health.online}명 · 진행 중 {health.rooms}판</span>}</div>
          <div className="quick-grid">
            <button className="quick feature" onClick={() => queue('rated')}>
              <span className="tc">10+5</span><span className="lbl">레이팅전</span>
            </button>
            <button className="quick" onClick={() => queue('casual')}>
              <span className="tc">5+3</span><span className="lbl">일반전</span>
            </button>
            <Link to="/play/ai?level=1&start=1" className="quick"><span className="ico">{Icon.bot}</span><span className="lbl">AI 입문</span></Link>
            <Link to="/play/ai?level=2&start=1" className="quick"><span className="ico">{Icon.bot}</span><span className="lbl">AI 보통</span></Link>
            <Link to="/play/ai?level=3&start=1" className="quick"><span className="ico">{Icon.bot}</span><span className="lbl">AI 고수</span></Link>
            <Link to="/play/local" className="quick"><span className="ico">{Icon.local}</span><span className="lbl">로컬 2인</span></Link>
            <Link to={nextLesson ? `/learn/${nextLesson.id}` : '/learn'} className="quick"><span className="ico">{Icon.learn}</span><span className="lbl">{nextLesson ? '튜토리얼 이어가기' : '튜토리얼'}</span></Link>
            <Link to="/cards" className="quick"><span className="ico">{Icon.cards}</span><span className="lbl">카드 연습</span></Link>
          </div>

          <div className="section-title"><h2>한 판은 이렇게 흘러가요</h2></div>
          <div className="feature-list">
            <div className="feature"><b>1. 오프닝 카드</b><span>첫 수를 두기 전에 카드 3장 중 1장을 골라요.</span></div>
            <div className="feature"><b>2. 미들게임 카드</b><span>내 10번째 수에서 두 번째 카드를 골라요.</span></div>
            <div className="feature"><b>3. 엔드게임 카드</b><span>내 20번째 수에서 마지막 카드를 골라요.</span></div>
            <div className="feature"><b>4. 킹을 잡으면 승리</b><span>체크 경고가 없어요. 킹이 잡히는 순간 끝나요.</span></div>
          </div>
        </div>

        <aside>
          <div className="widget">
            {o.user && o.rating ? (
              <>
                <div className="widget-head"><span>{o.user.username}</span><Link to={`/u/${o.user.username}`} style={{ fontSize: 13 }}>프로필</Link></div>
                <div className="widget-body">
                  <div className="kv"><span>레이팅</span><b>{o.rating.rating}{o.rating.provisional ? ` (배치 ${o.rating.games}/10)` : ''}</b></div>
                  <div className="kv"><span>승 · 무 · 패</span><b>{o.rating.wins} · {o.rating.draws} · {o.rating.losses}</b></div>
                  <div className="kv"><span>최고 레이팅</span><b>{o.rating.peak}</b></div>
                </div>
              </>
            ) : (
              <>
                <div className="widget-head">레이팅전에 참가하세요</div>
                <div className="widget-body stack" style={{ gap: 10 }}>
                  <p className="muted" style={{ fontSize: 14 }}>아이디와 비밀번호만으로 가입할 수 있어요. 1500점에서 시작해요.</p>
                  <Link to="/login?next=/" className="btn primary block">로그인 / 가입</Link>
                </div>
              </>
            )}
          </div>

          <div className="widget">
            <div className="widget-head"><span>오늘의 카드</span><Link to={`/cards/${daily.id}`} style={{ fontSize: 13 }}>직접 해보기</Link></div>
            <div className="widget-body"><CardView def={daily} onClick={() => navigate(`/cards/${daily.id}`)} done={prog.demos.includes(daily.id)} /></div>
          </div>

          <div className="widget">
            <div className="widget-head">학습 진도</div>
            <div className="widget-body stack" style={{ gap: 8 }}>
              <div className="row between" style={{ fontSize: 14 }}><span>레슨</span><b className="mono">{prog.lessons.length}/{LESSONS.length}</b></div>
              <div className="progress"><div style={{ width: `${(prog.lessons.length / LESSONS.length) * 100}%` }} /></div>
              <div className="row between" style={{ fontSize: 14, marginTop: 4 }}><span>카드 연습</span><b className="mono">{prog.demos.length}/{CARD_ORDER.length}</b></div>
              <div className="progress"><div style={{ width: `${(prog.demos.length / CARD_ORDER.length) * 100}%` }} /></div>
            </div>
          </div>

          <div className="widget">
            <div className="widget-head"><span>랭킹</span><Link to="/leaderboard" style={{ fontSize: 13 }}>전체 보기</Link></div>
            <div className="widget-body">
              {top === null && <div className="spinner" />}
              {top && top.length === 0 && <p className="muted" style={{ fontSize: 14 }}>배치 10판을 마친 플레이어가 아직 없어요.</p>}
              {top?.map((r) => (
                <div className="mini-rank" key={r.username}>
                  <span className="n">{r.rank}</span>
                  <Link to={`/u/${r.username}`} className="grow" style={{ color: 'var(--text)', fontWeight: 650 }}>{r.username}</Link>
                  <b className="mono">{r.rating}</b>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
