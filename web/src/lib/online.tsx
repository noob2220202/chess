import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Color, GameState, Move } from '@engine';
import { api, getToken, setToken, type PublicRating, type User } from './api.ts';
import { wsUrl } from './server.ts';

export interface Challenge {
  id: string;
  from: { id: number; username: string };
  to: number | null;
  toName: string | null;
  mode: 'rated' | 'casual';
  /** Set for open invites joined by code. */
  code: string | null;
  expires: number;
}

export interface GameView {
  id: string;
  mode: 'rated' | 'casual';
  rated: boolean;
  friendly: boolean;
  userIds: Record<Color, number>;
  you: Color | null;
  players: Record<Color, { username: string; rating: number; provisional: boolean }>;
  state: GameState;
  clocks: Record<Color, number>;
  turnStartedAt: number;
  serverNow: number;
  increment: number;
  drawOffer: Color | null;
  abortAt: number | null;
  result: { winner: Color | 'draw' | 'aborted'; reason: string; ratingDelta?: Record<Color, number> } | null;
  lastAction: { t: string; c: Color; id?: string; move?: Move } | null;
}

type Status = 'idle' | 'connecting' | 'online' | 'offline';
interface Online {
  status: Status;
  user: User | null;
  rating: PublicRating | null;
  season: number;
  queue: { mode: 'rated' | 'casual'; since: number } | null;
  game: GameView | null;
  /** serverTime - localTime, ms. */
  offset: number;
  lastError: string | null;
  /** Challenges sent to me. */
  incoming: Challenge[];
  /** Challenges and invite codes I created. */
  outgoing: Challenge[];
  /** Bumped whenever the friend list may have changed. */
  friendsVersion: number;
  /** Count of unanswered friend requests (refreshed by the friends page / notifications). */
  friendRequests: number;
  setFriendRequests(n: number): void;
  challenge(to: number, mode: 'rated' | 'casual'): void;
  invite(mode: 'rated' | 'casual'): void;
  accept(c: { id?: string; code?: string }): void;
  decline(id: string): void;
  cancel(id: string): void;
  onNotice(f: (n: Notice) => void): () => void;
  signIn(token: string, user: User, rating: PublicRating): void;
  signOut(): Promise<void>;
  send(msg: Record<string, unknown>): boolean;
  joinQueue(mode: 'rated' | 'casual'): void;
  leaveQueue(): void;
  dismissGame(): void;
  refreshMe(): Promise<void>;
}

export type Notice =
  | { kind: 'friend-request'; from: string }
  | { kind: 'challenge-closed'; reason: string; mine: boolean };

const Ctx = createContext<Online | null>(null);

export function OnlineProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('idle');
  const [user, setUser] = useState<User | null>(null);
  const [rating, setRating] = useState<PublicRating | null>(null);
  const [season, setSeason] = useState(1);
  const [queue, setQueue] = useState<Online['queue']>(null);
  const [game, setGame] = useState<GameView | null>(null);
  const [offset, setOffset] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const retry = useRef(0);
  const token = useRef<string | null>(getToken());
  const errorListeners = useRef(new Set<(m: string) => void>());
  const [incoming, setIncoming] = useState<Challenge[]>([]);
  const [outgoing, setOutgoing] = useState<Challenge[]>([]);
  const [friendsVersion, setFriendsVersion] = useState(0);
  const [friendRequests, setFriendRequests] = useState(0);
  const noticeListeners = useRef(new Set<(n: Notice) => void>());
  const outgoingIds = useRef(new Set<string>());
  const notify = (n: Notice) => noticeListeners.current.forEach((f) => f(n));

  const connect = useCallback(() => {
    if (!token.current || ws.current) return;
    setStatus('connecting');
    let sock: WebSocket;
    try { sock = new WebSocket(wsUrl()); } catch { setStatus('offline'); return; }
    ws.current = sock;
    sock.onopen = () => {
      retry.current = 0;
      sock.send(JSON.stringify({ type: 'auth', token: token.current }));
    };
    sock.onmessage = (ev) => {
      let m: any;
      try { m = JSON.parse(ev.data); } catch { return; }
      switch (m.type) {
        case 'welcome': setUser(m.user); setRating(m.rating); setSeason(m.season); setStatus('online'); break;
        case 'queued': setQueue({ mode: m.mode, since: m.since }); break;
        case 'unqueued': setQueue(null); break;
        case 'game':
          setOffset(m.game.serverNow - Date.now());
          setGame(m.game);
          break;
        case 'rating': setRating(m.rating); break;
        case 'friends': setFriendsVersion((v) => v + 1); break;
        case 'friend-request':
          setFriendRequests((n) => n + 1);
          notify({ kind: 'friend-request', from: m.from.username });
          break;
        case 'challenge':
          setIncoming((l) => [...l.filter((c) => c.id !== m.challenge.id), m.challenge]);
          break;
        case 'challenge-sent':
          outgoingIds.current.add(m.challenge.id);
          setOutgoing((l) => [...l.filter((c) => c.id !== m.challenge.id), m.challenge]);
          break;
        case 'challenge-closed': {
          const mine = outgoingIds.current.delete(m.id);
          setIncoming((l) => l.filter((c) => c.id !== m.id));
          setOutgoing((l) => l.filter((c) => c.id !== m.id));
          notify({ kind: 'challenge-closed', reason: m.reason, mine });
          break;
        }
        case 'error':
          if (m.code === 'auth') { token.current = null; setToken(null); setUser(null); setRating(null); sock.close(); }
          setLastError(m.message);
          errorListeners.current.forEach((f) => f(m.message));
          break;
      }
    };
    sock.onclose = () => {
      ws.current = null;
      setQueue(null);
      setIncoming([]);
      setOutgoing([]);
      outgoingIds.current.clear();
      if (!token.current) { setStatus('idle'); return; }
      setStatus('offline');
      const delay = Math.min(10_000, 500 * 2 ** retry.current++);
      setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    if (token.current) connect();
    const onVis = () => { if (document.visibilityState === 'visible' && token.current && !ws.current) connect(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [connect]);

  const send = useCallback((msg: Record<string, unknown>) => {
    const s = ws.current;
    if (!s || s.readyState !== WebSocket.OPEN) return false;
    s.send(JSON.stringify(msg));
    return true;
  }, []);

  const value = useMemo<Online>(() => ({
    status, user, rating, season, queue, game, offset, lastError,
    incoming, outgoing, friendsVersion, friendRequests, setFriendRequests,
    challenge(to, mode) { send({ type: 'challenge', to, mode }); },
    invite(mode) { send({ type: 'invite', mode }); },
    accept(c) { send({ type: 'challenge-accept', ...c }); if (c.id) setIncoming((l) => l.filter((x) => x.id !== c.id)); },
    decline(id) { send({ type: 'challenge-decline', id }); setIncoming((l) => l.filter((x) => x.id !== id)); },
    cancel(id) { send({ type: 'challenge-cancel', id }); },
    onNotice(f) { noticeListeners.current.add(f); return () => { noticeListeners.current.delete(f); }; },
    signIn(t, u, r) {
      token.current = t; setToken(t); setUser(u); setRating(r);
      ws.current?.close(); ws.current = null; connect();
    },
    async signOut() {
      await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
      token.current = null; setToken(null); setUser(null); setRating(null); setGame(null); setQueue(null); setIncoming([]); setOutgoing([]); setFriendRequests(0);
      ws.current?.close(); ws.current = null; setStatus('idle');
    },
    send,
    joinQueue(mode) { send({ type: 'queue', mode }); },
    leaveQueue() { send({ type: 'unqueue' }); },
    dismissGame() { setGame(null); },
    async refreshMe() {
      if (!token.current) return;
      const me = await api<{ user: User; rating: PublicRating; season: number }>('/api/me');
      setUser(me.user); setRating(me.rating); setSeason(me.season);
    },
  }), [status, user, rating, season, queue, game, offset, lastError, incoming, outgoing, friendsVersion, friendRequests, send, connect]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnline(): Online {
  const v = useContext(Ctx);
  if (!v) throw new Error('OnlineProvider missing');
  return v;
}
