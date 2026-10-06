import { APP_NAME, APP_NAME_EN } from './brand.ts';
import { useOnline } from './lib/online.tsx';
import { Link, match, usePath } from './lib/router.tsx';
import { CardPage, CardStats, CardsIndex } from './pages/Cards.tsx';
import Home from './pages/Home.tsx';
import { LearnIndex, LessonPage } from './pages/Learn.tsx';
import Login from './pages/Login.tsx';
import Online from './pages/Online.tsx';
import PlayOffline from './pages/PlayOffline.tsx';
import { About, Leaderboard, Profile, Replay } from './pages/Social.tsx';

const TabIcon = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
  learn: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M2 8l10-5 10 5-10 5z" /><path d="M6 10v5c3 2 9 2 12 0v-5" /></svg>,
  play: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /></svg>,
  cards: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><rect x="3" y="5" width="12" height="16" rx="2" /><path d="M9 3h10a2 2 0 0 1 2 2v12" /></svg>,
  rank: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 20V10M12 20V4M18 20v-7" /></svg>,
};

function Routes({ path }: { path: string }) {
  let m: Record<string, string> | null;
  if (path === '/') return <Home />;
  if (path === '/learn') return <LearnIndex />;
  if ((m = match('/learn/:id', path))) return <LessonPage key={m.id} id={m.id!} />;
  if (path === '/cards') return <CardsIndex />;
  if (path === '/cards/stats') return <CardStats />;
  if ((m = match('/cards/:id', path))) return <CardPage id={m.id!} />;
  if (path === '/play/ai') return <PlayOffline kind="ai" />;
  if (path === '/play/local') return <PlayOffline kind="local" />;
  if (path === '/play/online' || path === '/play') return <Online />;
  if (path === '/leaderboard') return <Leaderboard />;
  if ((m = match('/u/:name', path))) return <Profile name={m.name!} />;
  if ((m = match('/game/:id', path))) return <Replay id={m.id!} />;
  if (path === '/login') return <Login />;
  if (path === '/about') return <About />;
  return (
    <div className="main center stack" style={{ paddingTop: 80 }}>
      <h1>페이지를 찾을 수 없어요</h1>
      <div><Link to="/" className="btn primary">홈으로</Link></div>
    </div>
  );
}

export default function App() {
  const path = usePath();
  const { user, rating, game } = useOnline();
  const inGame = game && !game.result && !path.startsWith('/play/online');
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label={`${APP_NAME} 홈`}>
          <img src="/icon.svg" alt="" />
          <span>{APP_NAME} <small>{APP_NAME_EN}</small></span>
        </Link>
        <nav className="nav" aria-label="주요 메뉴">
          <Link to="/play/online" activeClass="active">레이팅전</Link>
          <Link to="/play/ai" activeClass="active">AI 대전</Link>
          <Link to="/learn" activeClass="active">튜토리얼</Link>
          <Link to="/cards" activeClass="active">카드</Link>
          <Link to="/leaderboard" activeClass="active">랭킹</Link>
        </nav>
        <span className="spacer" />
        {user ? (
          <Link to={`/u/${user.username}`} className="btn sm">
            {user.username}{rating && <span className="mono" style={{ opacity: 0.7 }}>{rating.rating}{rating.provisional ? '?' : ''}</span>}
          </Link>
        ) : (
          <Link to={`/login?next=${encodeURIComponent(path)}`} className="btn sm dark">로그인</Link>
        )}
      </header>
      {inGame && (
        <Link to="/play/online" className="status-line attn" style={{ display: 'block', textAlign: 'center', borderRadius: 0, textDecoration: 'none', color: 'inherit' }}>
          진행 중인 온라인 대국이 있어요 · 돌아가기 →
        </Link>
      )}
      <Routes path={path} />
      <footer className="center muted" style={{ padding: '0 16px 110px', fontSize: 13 }}>
        <Link to="/about">규칙 요약 · 크레딧 · 개인정보</Link>
      </footer>
      <nav className="tabbar" aria-label="하단 메뉴">
        <Link to="/" activeClass="active">{TabIcon.home}홈</Link>
        <Link to="/learn" activeClass="active">{TabIcon.learn}배우기</Link>
        <Link to="/play/online" activeClass="active">{TabIcon.play}대전</Link>
        <Link to="/cards" activeClass="active">{TabIcon.cards}카드</Link>
        <Link to="/leaderboard" activeClass="active">{TabIcon.rank}랭킹</Link>
      </nav>
    </div>
  );
}
