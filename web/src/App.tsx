import { APP_NAME, APP_NAME_EN } from './brand.ts';
import { Icon } from './lib/icons.tsx';
import { useOnline } from './lib/online.tsx';
import { Link, match, usePath } from './lib/router.tsx';
import { useSettings } from './lib/settings.tsx';
import { CardPage, CardStats, CardsIndex } from './pages/Cards.tsx';
import Home from './pages/Home.tsx';
import { LearnIndex, LessonPage } from './pages/Learn.tsx';
import Login from './pages/Login.tsx';
import Online from './pages/Online.tsx';
import PlayOffline from './pages/PlayOffline.tsx';
import { About, Leaderboard, Profile, Replay } from './pages/Social.tsx';

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

const NAV: Array<[string, keyof typeof Icon, string]> = [
  ['/', 'home', '홈'],
  ['/play/online', 'play', '온라인 대전'],
  ['/play/ai', 'bot', 'AI 대전'],
  ['/learn', 'learn', '배우기'],
  ['/cards', 'cards', '카드'],
  ['/leaderboard', 'rank', '랭킹'],
];

export default function App() {
  const path = usePath();
  const { user, rating, game } = useOnline();
  const { open } = useSettings();
  const inGame = game && !game.result && !path.startsWith('/play/online');
  const active = (to: string) => (to === '/' ? path === '/' : path.startsWith(to));
  return (
    <div className="shell">
      <aside className="sidebar" aria-label="주요 메뉴">
        <Link to="/" className="brand"><img src="/icon.svg" alt="" /><span>{APP_NAME}<small>{APP_NAME_EN}</small></span></Link>
        {NAV.map(([to, ic, label]) => (
          <Link key={to} to={to} className={`nav-item${active(to) ? ' active' : ''}`} title={label}>{Icon[ic]}<span>{label}</span></Link>
        ))}
        <div className="nav-sep" />
        <Link to="/play/local" className={`nav-item${active('/play/local') ? ' active' : ''}`} title="로컬 2인">{Icon.local}<span>로컬 2인</span></Link>
        <Link to="/cards/stats" className={`nav-item${active('/cards/stats') ? ' active' : ''}`} title="카드 통계">{Icon.stats}<span>카드 통계</span></Link>
        <div className="grow-space" />
        <button className="nav-item" onClick={open} title="설정">{Icon.settings}<span>설정</span></button>
        {user ? (
          <Link to={`/u/${user.username}`} className="account" title="내 프로필">
            <span className="avatar-dot">{user.username.slice(0, 1).toUpperCase()}</span>
            <span className="who"><b>{user.username}</b><span>{rating ? `${rating.rating}${rating.provisional ? '?' : ''}` : ''}</span></span>
          </Link>
        ) : (
          <Link to={`/login?next=${encodeURIComponent(path)}`} className="btn primary block" style={{ marginTop: 6 }}>로그인</Link>
        )}
      </aside>

      <div className="content">
        <header className="mobilebar">
          <Link to="/" className="brand"><img src="/icon.svg" alt="" />{APP_NAME}</Link>
          <span className="spacer" />
          <button className="btn ghost icon" onClick={open} aria-label="설정">{Icon.settings}</button>
          {user ? <Link to={`/u/${user.username}`} className="btn sm">{user.username}</Link> : <Link to="/login" className="btn sm primary" style={{ marginBottom: 0 }}>로그인</Link>}
        </header>
        {inGame && (
          <Link to="/play/online" className="status-line attn" style={{ display: 'block', textAlign: 'center', borderRadius: 0, color: 'inherit' }}>
            진행 중인 온라인 대국이 있어요 · 돌아가기 →
          </Link>
        )}
        <Routes path={path} />
        <footer className="site-foot"><Link to="/about">규칙 요약 · 크레딧 · 개인정보</Link></footer>
      </div>

      <nav className="tabbar" aria-label="하단 메뉴">
        <Link to="/" className={active('/') ? 'active' : ''}>{Icon.home}홈</Link>
        <Link to="/learn" className={active('/learn') ? 'active' : ''}>{Icon.learn}배우기</Link>
        <Link to="/play/online" className={active('/play') ? 'active' : ''}>{Icon.play}대전</Link>
        <Link to="/cards" className={active('/cards') ? 'active' : ''}>{Icon.cards}카드</Link>
        <Link to="/leaderboard" className={active('/leaderboard') ? 'active' : ''}>{Icon.rank}랭킹</Link>
      </nav>
    </div>
  );
}
