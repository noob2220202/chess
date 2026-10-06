import { useState } from 'react';
import { api, type PublicRating, type User } from '../lib/api.ts';
import { useOnline } from '../lib/online.tsx';
import { navigate } from '../lib/router.tsx';

export function AuthForm({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { signIn } = useOnline();

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
    <form className="panel pad stack" style={{ gap: 16 }} onSubmit={submit}>
      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>로그인</button>
        <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>회원가입</button>
      </div>
      <div className="field">
        <label htmlFor="u">아이디</label>
        <input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="3~16자 한글·영문·숫자·_" required />
      </div>
      <div className="field">
        <label htmlFor="p">비밀번호</label>
        <input id="p" className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" required />
      </div>
      {err && <p className="error-text" role="alert">{err}</p>}
      <button className="btn primary lg block" disabled={busy}>{busy ? '잠시만요…' : mode === 'login' ? '로그인' : '가입하고 시작하기'}</button>
      {mode === 'register' && <p className="muted" style={{ fontSize: 13 }}>가입하면 레이팅 1500에서 시작해요. 이메일 등 개인정보는 받지 않아요.</p>}
    </form>
  );
}

export default function Login() {
  const next = new URLSearchParams(location.search).get('next') ?? '/play/online';
  return (
    <div className="main" style={{ maxWidth: 460 }}>
      <div className="page-head"><div><div className="eyebrow">계정</div><h1>레이팅전에 참가하기</h1><p>온라인 대전에는 계정이 필요해요.</p></div></div>
      <AuthForm onDone={() => navigate(next.startsWith('/') ? next : '/')} />
    </div>
  );
}
