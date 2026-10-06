import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Hash, MoreHorizontal, Send, Share2, Swords, Timer, Trophy, UserMinus, UserPlus, X } from 'lucide-react';
import { api } from '../lib/api.ts';
import { useOnline, type Challenge } from '../lib/online.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { useToast } from '../lib/toast.tsx';
import { Sheet } from '../lib/ui.tsx';
import { AuthForm } from './Login.tsx';

export interface Friend { id: number; username: string; rating: number; provisional: boolean; online: boolean; playing: boolean }
interface Lists { friends: Friend[]; incoming: Friend[]; outgoing: Friend[] }
type Mode = 'rated' | 'casual';

export const MODE_INFO: Record<Mode, { label: string; time: string; note: string }> = {
  casual: { label: '일반전', time: '5분 + 3초', note: '각자 다른 카드 · 레이팅 변동 없음' },
  rated: { label: '레이팅전', time: '10분 + 5초', note: '같은 카드로 겨뤄요 · 레이팅에 반영' },
};

function useFriends() {
  const o = useOnline();
  const [lists, setLists] = useState<Lists | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    api<Lists>('/api/friends').then((l) => { setLists(l); setError(null); o.setFriendRequests(l.incoming.length); }).catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.setFriendRequests]);
  useEffect(() => { if (o.user) reload(); }, [o.user, o.friendsVersion, o.status, reload]);
  // Online dots drift while the page is open; refresh now and then.
  useEffect(() => { if (!o.user) return; const t = setInterval(reload, 20_000); return () => clearInterval(t); }, [o.user, reload]);
  return { lists, error, reload };
}

function ModePicker({ title, onPick, onClose }: { title: string; onPick: (m: Mode) => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} label={title}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h2>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="닫기"><X /></button>
      </div>
      <div className="list">
        {(['casual', 'rated'] as const).map((m) => (
          <button key={m} className="list-row" onClick={() => onPick(m)}>
            <span className={`ic ${m === 'rated' ? 'amber' : 'blue'}`}>{m === 'rated' ? <Trophy /> : <Timer />}</span>
            <span className="grow"><b>{MODE_INFO[m].label} · {MODE_INFO[m].time}</b><small>{MODE_INFO[m].note}</small></span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.ceil((until - now) / 1000));
  return <span className="mono">{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>;
}

function InviteCard() {
  const o = useOnline();
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  const [code, setCode] = useState('');
  const mine = o.outgoing.find((c) => c.code);
  const offline = o.status !== 'online';

  async function share(c: Challenge) {
    const text = `증강전에서 한 판 둬요! 앱의 친구 → 초대 코드에 ${c.code}를 입력해 주세요. (${MODE_INFO[c.mode].label} ${MODE_INFO[c.mode].time})`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(c.code!); toast('코드를 복사했어요.'); }
    } catch { /* share sheet dismissed */ }
  }

  return (
    <div className="surface pad invite">
      {mine ? (
        <>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>내 초대 코드</b>
            <span className="chip accent">{MODE_INFO[mine.mode].label} · <Countdown until={mine.expires} /></span>
          </div>
          <button className="invite-code" onClick={() => navigator.clipboard?.writeText(mine.code!).then(() => toast('코드를 복사했어요.'))} aria-label="코드 복사">
            {mine.code!.split('').map((ch, i) => <span key={i}>{ch}</span>)}
          </button>
          <p className="muted" style={{ fontSize: 13.5, textAlign: 'center' }}>친구가 이 코드를 입력하면 바로 대국이 시작돼요.</p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn grow" onClick={() => o.cancel(mine.id)}>취소</button>
            <button className="btn grow" onClick={() => navigator.clipboard?.writeText(mine.code!).then(() => toast('코드를 복사했어요.'))}><Copy />복사</button>
            <button className="btn primary grow" onClick={() => share(mine)}><Share2 />공유</button>
          </div>
        </>
      ) : (
        <>
          <div className="row" style={{ gap: 12 }}>
            <span className="ic violet"><Hash /></span>
            <div className="grow"><b style={{ display: 'block' }}>초대 코드로 대국</b><small className="muted">친구 추가 없이 코드만 주고받으면 돼요</small></div>
          </div>
          <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (code.trim().length === 6) o.accept({ code: code.trim() }); }}>
            <input className="input grow code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="코드 6자리" aria-label="초대 코드" autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text" />
            <button className="btn" disabled={offline || code.trim().length !== 6}>참가</button>
          </form>
          <button className="btn primary block" disabled={offline} onClick={() => setPicking(true)}><Send />새 초대 코드 만들기</button>
        </>
      )}
      {picking && <ModePicker title="어떤 대국으로 초대할까요?" onClose={() => setPicking(false)} onPick={(m) => { o.invite(m); setPicking(false); }} />}
    </div>
  );
}

function FriendRow({ f, onChallenge, onRemove }: { f: Friend; onChallenge: () => void; onRemove: () => void }) {
  const [menu, setMenu] = useState(false);
  const o = useOnline();
  const pending = o.outgoing.find((c) => c.to === f.id);
  return (
    <div className="list-row friend">
      <span className="avatar-wrap">
        <span className="avatar">{f.username.slice(0, 1).toUpperCase()}</span>
        <i className={`presence${f.playing ? ' playing' : f.online ? ' on' : ''}`} />
      </span>
      <Link to={`/u/${f.username}`} className="grow" style={{ minWidth: 0, color: 'inherit' }}>
        <b className="ellipsis" style={{ display: 'block' }}>{f.username}</b>
        <small>{f.rating}{f.provisional ? '?' : ''} · {f.playing ? '대국 중' : f.online ? '접속 중' : '오프라인'}</small>
      </Link>
      {pending ? (
        <button className="btn sm" onClick={() => o.cancel(pending.id)}><Countdown until={pending.expires} /> 취소</button>
      ) : (
        <button className="btn sm primary" disabled={!f.online || f.playing || o.status !== 'online'} onClick={onChallenge}><Swords />대국</button>
      )}
      <button className="icon-btn" aria-label={`${f.username} 메뉴`} onClick={() => setMenu(true)}><MoreHorizontal /></button>
      {menu && (
        <Sheet onClose={() => setMenu(false)} label={f.username}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h2>{f.username}</h2>
            <button className="icon-btn" onClick={() => setMenu(false)} aria-label="닫기"><X /></button>
          </div>
          <div className="list">
            <button className="list-row" onClick={() => { setMenu(false); navigate(`/u/${f.username}`); }}><span className="ic slate"><Trophy /></span><span className="grow"><b>프로필 보기</b></span></button>
            <button className="list-row" onClick={() => { setMenu(false); if (confirm(`${f.username}님을 친구에서 삭제할까요?`)) onRemove(); }}><span className="ic rose"><UserMinus /></span><span className="grow"><b>친구 삭제</b></span></button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

export default function Friends() {
  const o = useOnline();
  const toast = useToast();
  const { lists, error, reload } = useFriends();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<Friend | null>(null);

  if (!o.user) {
    return (
      <div className="page" style={{ maxWidth: 440 }}>
        <div className="head"><div className="eyebrow">친구</div><h1>로그인하고 친구와 두기</h1><p>친구를 추가하거나 초대 코드로 바로 대국할 수 있어요.</p></div>
        {o.status === 'connecting' ? <div className="spinner" /> : <AuthForm />}
      </div>
    );
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ result: string }>('/api/friends/request', { body: { username: name.trim() } });
      toast(r.result === 'accepted' ? `${name.trim()}님과 친구가 됐어요!` : '친구 요청을 보냈어요.');
      setName('');
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }
  const act = (path: string, body: unknown, msg?: string) => api(path, { body }).then(() => { if (msg) toast(msg); reload(); }).catch((e) => toast((e as Error).message, 'error'));

  const friends = lists ? [...lists.friends].sort((a, b) => Number(b.online) - Number(a.online) || Number(a.playing) - Number(b.playing) || a.username.localeCompare(b.username)) : [];
  const onlineCount = friends.filter((f) => f.online).length;

  return (
    <div className="page narrow">
      <div className="head">
        <div className="eyebrow">친구</div>
        <h1>친구와 대국</h1>
        <p>{lists ? `친구 ${friends.length}명 · ${onlineCount}명 접속 중` : '친구 목록을 불러오는 중이에요…'}</p>
      </div>

      {o.outgoing.filter((c) => !c.code).map((c) => (
        <div className="notice info" key={c.id} style={{ marginBottom: 12 }}>
          <span className="spinner" />
          <span className="grow"><b>{c.toName ?? '상대'}</b>님의 응답을 기다리는 중 · {MODE_INFO[c.mode].label} · <Countdown until={c.expires} /></span>
          <button className="btn sm" onClick={() => o.cancel(c.id)}>취소</button>
        </div>
      ))}

      <InviteCard />

      <form className="row" style={{ gap: 8, marginTop: 14 }} onSubmit={add}>
        <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="친구 아이디로 추가" aria-label="친구 아이디"
          autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <button className="btn primary" disabled={busy || !name.trim()}><UserPlus />추가</button>
      </form>

      {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}

      {lists && lists.incoming.length > 0 && (
        <>
          <div className="section-h"><h2>받은 친구 요청 <span className="count-badge">{lists.incoming.length}</span></h2></div>
          <div className="list">
            {lists.incoming.map((f) => (
              <div className="list-row" key={f.id}>
                <span className="avatar">{f.username.slice(0, 1).toUpperCase()}</span>
                <span className="grow" style={{ minWidth: 0 }}><b className="ellipsis" style={{ display: 'block' }}>{f.username}</b><small>레이팅 {f.rating}{f.provisional ? '?' : ''}</small></span>
                <button className="icon-btn" aria-label="거절" onClick={() => act('/api/friends/respond', { userId: f.id, accept: false })}><X /></button>
                <button className="btn sm good" onClick={() => act('/api/friends/respond', { userId: f.id, accept: true }, `${f.username}님과 친구가 됐어요!`)}><Check />수락</button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-h"><h2>친구 목록</h2></div>
      {lists === null ? <div className="spinner" /> : friends.length === 0 ? (
        <div className="empty">
          <img src="/pieces/wN.svg" alt="" />
          <b>아직 친구가 없어요</b>
          <p className="muted">위에서 아이디로 친구를 추가하거나, 초대 코드를 만들어 보내 보세요.</p>
        </div>
      ) : (
        <div className="list">
          {friends.map((f) => <FriendRow key={f.id} f={f} onChallenge={() => setTarget(f)} onRemove={() => act('/api/friends/remove', { userId: f.id }, '친구를 삭제했어요.')} />)}
        </div>
      )}

      {lists && lists.outgoing.length > 0 && (
        <>
          <div className="section-h"><h2>보낸 친구 요청</h2></div>
          <div className="list">
            {lists.outgoing.map((f) => (
              <div className="list-row" key={f.id}>
                <span className="avatar muted-av">{f.username.slice(0, 1).toUpperCase()}</span>
                <span className="grow" style={{ minWidth: 0 }}><b className="ellipsis" style={{ display: 'block' }}>{f.username}</b><small>수락을 기다리는 중</small></span>
                <button className="btn sm" onClick={() => act('/api/friends/remove', { userId: f.id })}>취소</button>
              </div>
            ))}
          </div>
        </>
      )}

      {target && <ModePicker title={`${target.username}님에게 대국 신청`} onClose={() => setTarget(null)} onPick={(m) => { o.challenge(target.id, m); setTarget(null); toast(`${target.username}님에게 대국을 신청했어요.`); }} />}
    </div>
  );
}

const CLOSED_TEXT: Record<string, string> = {
  declined: '상대가 대국 신청을 거절했어요.',
  expired: '응답이 없어 대국 신청이 만료됐어요.',
  offline: '상대가 접속을 끊어 신청이 취소됐어요.',
};

/** App-wide: incoming challenge popup, friend notifications, and jumping into a game when it starts. */
export function ChallengeLayer({ path }: { path: string }) {
  const o = useOnline();
  const toast = useToast();
  const [seenGame, setSeenGame] = useState<string | null>(null);

  useEffect(() => o.onNotice((n) => {
    if (n.kind === 'friend-request') toast(`${n.from}님이 친구 요청을 보냈어요.`);
    else if (n.mine && CLOSED_TEXT[n.reason]) toast(CLOSED_TEXT[n.reason]!);
  }), [o, toast]);

  useEffect(() => {
    const g = o.game;
    if (!g || g.result || g.id === seenGame) return;
    setSeenGame(g.id);
    if (!path.startsWith('/play/online')) navigate('/play/online');
  }, [o.game, seenGame, path]);

  // Refresh the request badge after login.
  useEffect(() => {
    if (o.user) api<{ incoming: unknown[] }>('/api/friends').then((l) => o.setFriendRequests(l.incoming.length)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.user]);

  const c = o.incoming[0];
  if (!c || (o.game && !o.game.result)) return null;
  const info = MODE_INFO[c.mode];
  return (
    <Sheet label="대국 신청">
      <div className="challenge-pop">
        <div className="duel">
          <span className="avatar xl">{c.from.username.slice(0, 1).toUpperCase()}</span>
          <span className="vs"><Swords /></span>
          <span className="avatar xl me-av">{o.user?.username.slice(0, 1).toUpperCase()}</span>
        </div>
        <h2><b>{c.from.username}</b>님이 대국을 신청했어요</h2>
        <p className="muted">{info.label} · {info.time} · <Countdown until={c.expires} /></p>
        <div className="row" style={{ gap: 10, marginTop: 18 }}>
          <button className="btn lg grow" onClick={() => o.decline(c.id)}>거절</button>
          <button className="btn lg primary grow" onClick={() => o.accept({ id: c.id })}><Swords />수락</button>
        </div>
      </div>
    </Sheet>
  );
}
