import { useEffect, useState } from 'react';
import { Bot, ChevronRight, Download, GraduationCap, Layers, Share, Swords, Timer, UserRound, Users, X } from 'lucide-react';
import { CARDS, CARD_ORDER } from '@engine';
import { APP_NAME } from '../brand.ts';
import { CardView } from '../game/CardView.tsx';
import { api } from '../lib/api.ts';
import { useOnline } from '../lib/online.tsx';
import { useInstall } from '../lib/pwa.ts';
import { isNative } from '../lib/server.ts';
import { Link, navigate } from '../lib/router.tsx';
import { getProgress, load, save } from '../lib/storage.ts';
import { LESSONS } from '../tutorial/lessons.ts';

interface Row { rank: number; username: string; rating: number }

function dayIndex() {
  const d = new Date();
  return d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
}

function InstallRow() {
  const { mode, install } = useInstall();
  const [hidden, setHidden] = useState(() => load('aa.install.hidden', false));
  if (isNative() || hidden) return null;
  if (/Android/i.test(navigator.userAgent)) {
    return (
      <div className="install-bar">
        <img src="/icon-192.png" alt="" />
        <div className="grow">
          <b style={{ display: 'block' }}>Android 앱 받기</b>
          <span className="muted" style={{ fontSize: 13 }}>APK를 내려받아 설치하면 바로 이 서버에 연결됩니다</span>
        </div>
        <a className="btn sm primary" style={{ marginBottom: 0 }} href="/download"><Download />받기</a>
        <button className="icon-btn" aria-label="닫기" onClick={() => { save('aa.install.hidden', true); setHidden(true); }}><X /></button>
      </div>
    );
  }
  if (!mode) return null;
  return (
    <div className="install-bar">
      <img src="/icon-192.png" alt="" />
      <div className="grow">
        <b style={{ display: 'block' }}>앱으로 설치하기</b>
        <span className="muted" style={{ fontSize: 13 }}>{mode === 'ios' ? <>공유 버튼 <Share style={{ display: 'inline', width: 14, height: 14, verticalAlign: -2 }} /> → “홈 화면에 추가”를 눌러 주세요</> : '홈 화면에서 바로 열고, 오프라인에서도 AI와 둘 수 있습니다'}</span>
      </div>
      {mode === 'prompt' && <button className="btn sm primary" style={{ marginBottom: 0 }} onClick={install}><Download />설치</button>}
      <button className="icon-btn" aria-label="닫기" onClick={() => { save('aa.install.hidden', true); setHidden(true); }}><X /></button>
    </div>
  );
}

export default function Home() {
  const o = useOnline();
  const [top, setTop] = useState<Row[] | null>(null);
  const prog = getProgress();
  const nextLesson = LESSONS.find((l) => !prog.lessons.includes(l.id));
  const n = dayIndex();
  const daily = CARDS[CARD_ORDER[(n * 7919) % CARD_ORDER.length]!]!;
  const spotlight = Array.from({ length: 8 }, (_, i) => CARDS[CARD_ORDER[(n * 31 + i * 7) % CARD_ORDER.length]!]!);

  useEffect(() => {
    api<{ rows: Row[] }>('/api/leaderboard').then((r) => setTop(r.rows.slice(0, 5))).catch(() => setTop([]));
  }, []);

  const queue = (mode: 'rated' | 'casual') => {
    if (!o.user) return navigate('/login?next=/play/online');
    o.joinQueue(mode);
    navigate('/play/online');
  };
  const fresh = prog.lessons.length === 0;

  return (
    <div className="page">
      <InstallRow />
      <div className="hello">
        <div className="grow">
          <h1>{o.user ? `${o.user.username}님, 환영합니다` : `${APP_NAME}에 오신 걸 환영합니다`}</h1>
          <p>{o.user && o.rating ? `레이팅 ${o.rating.rating}${o.rating.provisional ? ` · 배치 ${o.rating.games}/10판` : ''}` : '체스에 증강 카드를 더한 전략 게임입니다.'}</p>
        </div>
      </div>

      <div className="home">
        <div>
          {fresh && (
            <div className="list" style={{ marginBottom: 14 }}>
              <button className="list-row" onClick={() => navigate('/learn')}>
                <span className="ic teal"><GraduationCap /></span>
                <span className="grow"><b>처음이라면 튜토리얼부터</b><small>짧은 레슨 {LESSONS.length}개로 규칙과 카드를 익힙니다</small></span>
                <ChevronRight className="chev" />
              </button>
            </div>
          )}

          <button className="hero-play" onClick={() => queue('rated')}>
            <img className="art" src="/pieces/wQ.svg" alt="" />
            <span className="kicker">같은 카드로 실력을 겨루는</span>
            <span className="title">레이팅전 시작</span>
            <span className="meta"><span>10분 + 5초</span><span>미러 드래프트</span></span>
            <span className="go"><Swords /></span>
          </button>
          <div className="sub-play">
            <button className="pill-play" onClick={() => queue('casual')}>
              <span className="ic blue"><Timer /></span>
              <span><b>일반전</b><small>5분 + 3초</small></span>
            </button>
            <button className="pill-play" onClick={() => navigate('/play/ai')}>
              <span className="ic violet"><Bot /></span>
              <span><b>AI 대전</b><small>오프라인 가능</small></span>
            </button>
          </div>

          <div className="list" style={{ marginTop: 14 }}>
            <button className="list-row" onClick={() => navigate('/friends')}>
              <span className="ic violet"><UserRound /></span>
              <span className="grow"><b>친구와 대국</b><small>친구에게 신청하거나 초대 코드로 바로 시작</small></span>
              {o.incoming.length + o.friendRequests > 0 && <em className="nbadge static">{o.incoming.length + o.friendRequests}</em>}
              <ChevronRight className="chev" />
            </button>
            <button className="list-row" onClick={() => navigate(nextLesson ? `/learn/${nextLesson.id}` : '/learn')}>
              <span className="ic teal"><GraduationCap /></span>
              <span className="grow"><b>{nextLesson ? '튜토리얼 이어가기' : '튜토리얼 복습'}</b><small>{nextLesson ? `다음: ${nextLesson.title}` : '모든 레슨을 마쳤습니다'} · {prog.lessons.length}/{LESSONS.length}</small></span>
              <ChevronRight className="chev" />
            </button>
            <button className="list-row" onClick={() => navigate('/cards')}>
              <span className="ic amber"><Layers /></span>
              <span className="grow"><b>카드 연습</b><small>{CARD_ORDER.length}장 중 {prog.demos.length}장 연습 완료</small></span>
              <ChevronRight className="chev" />
            </button>
            <button className="list-row" onClick={() => navigate('/play/local')}>
              <span className="ic rose"><Users /></span>
              <span className="grow"><b>로컬 2인</b><small>한 기기에서 친구와 번갈아 두기</small></span>
              <ChevronRight className="chev" />
            </button>
          </div>

          <div className="section-h"><h2>오늘의 카드</h2><Link to={`/cards/${daily.id}`}>직접 해보기</Link></div>
          <div className="row top" style={{ gap: 16 }}>
            <div style={{ width: 150, flex: 'none' }}><CardView def={daily} onClick={() => navigate(`/cards/${daily.id}`)} done={prog.demos.includes(daily.id)} /></div>
            <div className="grow stack" style={{ gap: 6, paddingTop: 4 }}>
              <b style={{ fontSize: 19 }}>{daily.name}</b>
              <p className="muted" style={{ fontSize: 14.5 }}>{daily.description}</p>
              <div><button className="btn sm" onClick={() => navigate(`/cards/${daily.id}`)}>보드에서 써 보기</button></div>
            </div>
          </div>

          <div className="section-h"><h2>카드 둘러보기</h2><Link to="/cards">전체 보기</Link></div>
          <div className="carousel">
            {spotlight.map((c) => <CardView key={c.id} def={c} onClick={() => navigate(`/cards/${c.id}`)} done={prog.demos.includes(c.id)} />)}
          </div>
        </div>

        <aside>
          <div className="section-h" style={{ marginTop: 0 }}><h2>랭킹</h2><Link to="/leaderboard">전체 보기</Link></div>
          <div className="list">
            {top === null && <div className="kv"><span className="spinner" /></div>}
            {top && top.length === 0 && <div className="kv"><span className="muted" style={{ fontSize: 14 }}>배치 10판을 마친 플레이어가 아직 없습니다.</span></div>}
            {top?.map((r) => (
              <div className="rank-row" key={r.username}>
                <span className={`medal${r.rank <= 3 ? ` m${r.rank}` : ''}`}>{r.rank}</span>
                <Link to={`/u/${r.username}`} className="grow ellipsis">{r.username}</Link>
                <b className="mono">{r.rating}</b>
              </div>
            ))}
          </div>
          {o.user && o.rating ? (
            <>
              <div className="section-h"><h2>내 기록</h2><Link to={`/u/${o.user.username}`}>프로필</Link></div>
              <div className="list">
                <div className="kv"><span className="muted">레이팅</span><b>{o.rating.rating}{o.rating.provisional ? '?' : ''}</b></div>
                <div className="kv"><span className="muted">승 · 무 · 패</span><b>{o.rating.wins} · {o.rating.draws} · {o.rating.losses}</b></div>
                <div className="kv"><span className="muted">최고 레이팅</span><b>{o.rating.peak}</b></div>
              </div>
            </>
          ) : (
            <div className="surface pad stack" style={{ marginTop: 14, gap: 10 }}>
              <b>레이팅전에 참가하세요</b>
              <p className="muted" style={{ fontSize: 14 }}>아이디와 비밀번호만 있으면 가입할 수 있습니다. 1500점에서 시작합니다.</p>
              <Link to="/login?next=/" className="btn primary block">로그인 / 가입</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
