import { CARDS } from '@engine';
import { APP_NAME } from '../brand.ts';
import { CardView } from '../game/CardView.tsx';
import { useOnline } from '../lib/online.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { getProgress } from '../lib/storage.ts';

const Icon = {
  learn: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8l10-5 10 5-10 5z" /><path d="M6 10v5c3 2 9 2 12 0v-5" /></svg>,
  bot: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 4v4M9 14h.01M15 14h.01" /></svg>,
  local: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><path d="M3 20c0-3 2-5 5-5s5 2 5 5M11 20c0-3 2-5 5-5s5 2 5 5" /></svg>,
  online: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>,
  rated: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /></svg>,
  cards: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><rect x="3" y="5" width="12" height="16" rx="2" /><path d="M9 3h10a2 2 0 0 1 2 2v12" /></svg>,
};

function Mode({ to, icon, color, title, text, badge }: { to: string; icon: React.ReactNode; color: string; title: string; text: string; badge?: string }) {
  return (
    <Link to={to} className="mode-card">
      <span className="mode-icon" style={{ background: color }}>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {badge && <span className="chip amber" style={{ alignSelf: 'flex-start' }}>{badge}</span>}
      <span className="go">→</span>
    </Link>
  );
}

export default function Home() {
  const { user, rating } = useOnline();
  const prog = getProgress();
  const fresh = prog.lessons.length === 0;
  return (
    <div className="main">
      <section className="hero">
        <div>
          <div className="eyebrow">체스 + 카드 드래프트</div>
          <h1>규칙을 <em>증강</em>하고<br />실력으로 증명하라</h1>
          <p className="lead">{APP_NAME}은 매 판 세 번의 드래프트로 증강 카드를 고르는 체스예요. 체크 없이 킹을 잡으면 승리. 미러 드래프트 레이팅전으로 공정하게 겨루세요.</p>
          <div className="row wrap">
            {fresh ? <button className="btn primary lg" onClick={() => navigate('/learn/basics')}>튜토리얼 시작</button>
              : <button className="btn primary lg" onClick={() => navigate('/play/online')}>레이팅전 하기</button>}
            <button className="btn lg" onClick={() => navigate('/play/ai')}>AI와 연습</button>
          </div>
          {user && rating && (
            <p className="muted" style={{ marginTop: 14, fontWeight: 650 }}>{user.username} · 레이팅 {rating.rating}{rating.provisional ? ' (배치 중)' : ''}</p>
          )}
        </div>
        <div className="hero-art" aria-hidden>
          <MiniBoard />
          <div className="hero-cards">
            <CardView def={CARDS['knight-king']!} compact />
            <CardView def={CARDS['amazon']!} compact />
          </div>
        </div>
      </section>

      <div className="mode-grid">
        <Mode to="/learn" icon={Icon.learn} color="var(--teal-soft)" title="튜토리얼" text="실제 보드에서 직접 두며 규칙과 카드를 배워요." badge={fresh ? '처음이라면 여기부터' : undefined} />
        <Mode to="/play/online" icon={Icon.rated} color="var(--amber)" title="레이팅전" text="미러 드래프트 · 10분+5초 · Glicko-2 레이팅" />
        <Mode to="/play/ai" icon={Icon.bot} color="var(--blue-soft)" title="AI 대전" text="세 단계 난이도의 AI와 오프라인 연습" />
        <Mode to="/play/local" icon={Icon.local} color="var(--violet-soft)" title="로컬 2인" text="한 기기에서 친구와 번갈아 두기" />
        <Mode to="/cards" icon={Icon.cards} color="var(--red-soft)" title="카드 백과" text="60장 모두 설명과 직접 해보기 제공" />
        <Mode to="/leaderboard" icon={Icon.online} color="var(--surface-2)" title="랭킹" text="이번 시즌 상위 플레이어" />
      </div>

      <section className="section">
        <h2>한 판은 이렇게 흘러가요</h2>
        <div className="feature-list">
          <div className="feature"><b>1. 오프닝 드래프트</b><span>첫 수 전에 오프닝 카드 3장 중 1장을 골라요.</span></div>
          <div className="feature"><b>2. 미들게임 드래프트</b><span>내 10번째 수에 두 번째 카드를 골라요.</span></div>
          <div className="feature"><b>3. 엔드게임 드래프트</b><span>내 20번째 수에 마지막 카드를 골라요.</span></div>
          <div className="feature"><b>4. 킹을 잡으면 승리</b><span>체크 알림은 없어요. 킹이 잡히는 순간 끝나요.</span></div>
        </div>
      </section>
    </div>
  );
}

function MiniBoard() {
  const pos: Record<number, string> = { 4: 'wK', 3: 'wQ', 12: 'wP', 11: 'wP', 21: 'wN', 60: 'bK', 52: 'bP', 51: 'bP', 42: 'bN', 33: 'wB', 37: 'bQ' };
  return (
    <div className="board-wrap" style={{ width: '82%' }}>
      <div className="board">
        {Array.from({ length: 64 }, (_, i) => {
          const r = 7 - Math.floor(i / 8), f = i % 8, s = r * 8 + f;
          return (
            <div key={i} className={`sq ${(r + f) % 2 ? 'light' : 'dark'}`}>
              {pos[s] && <img src={`/pieces/${pos[s]}.svg`} alt="" style={{ width: '100%', height: '100%' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
