import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Color, GameState, Move } from '@engine';
import { api, getToken, setToken, type PublicRating, type User } from './api.ts';

export interface GameView {
  id: string;
  mode: 'rated' | 'casual';
  rated: boolean;
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
  signIn(token: string, user: User, rating: PublicRating): void;
  signOut(): Promise<void>;
  send(msg: Record<string, unknown>): boolean;
  joinQueue(mode: 'rated' | 'casual'): void;
  leaveQueue(): void;
  dismissGame(): void;
  refreshMe(): Promise<void>;
}

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

  const connect = useCallback(() => {
    if (!token.current || ws.current) return;
    setStatus('connecting');
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const sock = new WebSocket(`${proto}://${location.host}/ws`);
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
    signIn(t, u, r) {
      token.current = t; setToken(t); setUser(u); setRating(r);
      ws.current?.close(); ws.current = null; connect();
    },
    async signOut() {
      await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
      token.current = null; setToken(null); setUser(null); setRating(null); setGame(null); setQueue(null);
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
  }), [status, user, rating, season, queue, game, offset, lastError, send, connect]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnline(): Online {
  const v = useContext(Ctx);
  if (!v) throw new Error('OnlineProvider missing');
  return v;
}
