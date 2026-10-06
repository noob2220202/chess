import { useState } from 'react';
import { api, type PublicRating, type User } from '../lib/api.ts';
import { useOnline } from '../lib/online.tsx';
import { navigate } from '../lib/router.tsx';
import { hasServer } from '../lib/server.ts';

export function AuthForm({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { signIn } = useOnline();

  if (!hasServer()) {
    return (
      <div className="surface pad stack" style={{ gap: 8 }}>
        <b>온라인 서버가 아직 준비되지 않았어요</b>
        <p className="muted" style={{ fontSize: 14 }}>AI 대전, 튜토리얼, 카드 연습은 지금 바로 할 수 있어요.</p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await api<{ token: string; user: User; rating: PublicRating }>(`/api/auth/${mode}`, { body: { username, password } });
      signIn(r.token, r.user, r.rating);
      onDone?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
      <div className="seg" style={{ alignSelf: 'stretch', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>로그인</button>
        <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>회원가입</button>
      </div>
      <div className="field">
        <label htmlFor="u">아이디</label>
        <input id="u" className="input" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="3~16자 한글, 영문, 숫자, _" required />
      </div>
      <div className="field">
        <label htmlFor="p">비밀번호</label>
        <input id="p" className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" required />
      </div>
      {err && <p className="error-text" role="alert">{err}</p>}
      <button className="btn primary lg block" disabled={busy}>{busy ? '잠시만요…' : mode === 'login' ? '로그인' : '가입하고 시작하기'}</button>
      {mode === 'register' && <p className="muted center" style={{ fontSize: 13 }}>레이팅 1500에서 시작해요. 이메일 같은 개인정보는 받지 않아요.</p>}
    </form>
  );
}

export default function Login() {
  const next = new URLSearchParams(location.search).get('next') ?? '/play/online';
  return (
    <div className="page" style={{ maxWidth: 440 }}>
      <div className="center" style={{ margin: '12px 0 26px' }}>
        <img src="/icon-192.png" alt="" style={{ width: 72, height: 72, borderRadius: 18, margin: '0 auto 14px', boxShadow: 'var(--shadow-2)' }} />
        <h1 style={{ fontSize: 26, fontWeight: 850 }}>레이팅전에 참가하기</h1>
        <p className="muted" style={{ marginTop: 4 }}>온라인 대전에는 계정이 필요해요.</p>
      </div>
      <AuthForm onDone={() => navigate(next.startsWith('/') ? next : '/')} />
    </div>
  );
}
