import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Color } from '../../engine/src/index.ts';
import { CARDS, CARD_ORDER } from '../../engine/src/index.ts';
import { RateLimiter, hashPassword, hashToken, newToken, validateCredentials, verifyPassword } from './auth.ts';
import { config, type QueueMode } from './config.ts';
import { inflate, rateGame } from './glicko2.ts';
import { pairUp, type Ticket } from './matchmaker.ts';
import { Room, type ClientAction } from './room.ts';
import type { Rating, Store, User } from './store.ts';

export interface ServerOptions {
  store: Store;
  season?: number;
  abortMs?: number;
  staticDir?: string | null;
  matchIntervalMs?: number;
  log?: (msg: string) => void;
}

const json = (res: http.ServerResponse, status: number, body: unknown) => {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(data) });
  res.end(data);
};

async function readBody(req: http.IncomingMessage, limit = 8 * 1024): Promise<any> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw Object.assign(new Error('payload too large'), { status: 413 });
    chunks.push(c as Buffer);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('invalid json'), { status: 400 }); }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws: wss:; worker-src 'self'; script-src 'self'",
};

export const publicRating = (r: Rating) => ({
  rating: Math.round(r.rating), rd: Math.round(r.rd), games: r.games, wins: r.wins, losses: r.losses, draws: r.draws,
  peak: Math.round(r.peak), provisional: r.games < config.provisionalGames,
});

export function createServer(opts: ServerOptions) {
  const store = opts.store;
  const season = opts.season ?? config.season;
  const abortMs = opts.abortMs ?? config.abortMs;
  const log = opts.log ?? ((m: string) => console.log(`[${new Date().toISOString()}] ${m}`));
  const authLimiter = new RateLimiter(20, 60_000);

  const sockets = new Map<number, Set<WebSocket>>();
  const users = new Map<WebSocket, User>();
  const rooms = new Map<string, Room>();
  const userRoom = new Map<number, string>();
  const queue = new Map<number, Ticket>();

  const send = (ws: WebSocket, msg: unknown) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };
  const sendUser = (userId: number, msg: unknown) => { for (const ws of sockets.get(userId) ?? []) send(ws, msg); };

  async function authUser(token: string | null | undefined): Promise<User | null> {
    if (!token || typeof token !== 'string' || token.length > 100) return null;
    return store.sessionUser(hashToken(token));
  }

  const bearer = (req: http.IncomingMessage) => {
    const h = req.headers.authorization;
    return h?.startsWith('Bearer ') ? h.slice(7) : null;
  };

  // ------------------------------------------------------------------ rooms
  const events = {
    update(room: Room) { broadcast(room); },
    end(room: Room) { void finalize(room); },
  };

  function broadcast(room: Room) {
    for (const c of ['w', 'b'] as Color[]) sendUser(room.seats[c].userId, { type: 'game', game: room.view(c) });
  }

  async function finalize(room: Room) {
    const rec = room.record0(season);
    const r = room.result!;
    rec.result = r.winner;
    rec.reason = r.reason;
    rec.endedAt = new Date().toISOString();
    rec.whiteCards = room.cardsOf('w');
    rec.blackCards = room.cardsOf('b');
    const updates = [];
    const cardDeltas = [];
    try {
      if (room.rated && r.winner !== 'aborted') {
        const [wr, br] = await Promise.all([store.getRating(room.seats.w.userId, season), store.getRating(room.seats.b.userId, season)]);
        const days = (x: Rating) => (x.lastGameAt ? (Date.now() - Date.parse(x.lastGameAt)) / 86_400_000 : 0);
        const scoreW = r.winner === 'w' ? 1 : r.winner === 'draw' ? 0.5 : 0;
        const [nw, nb] = rateGame(inflate(wr, days(wr)), inflate(br, days(br)), scoreW);
        const now = new Date().toISOString();
        const next = (old: Rating, n: typeof nw, score: number): Rating => ({
          ...n, games: old.games + 1, wins: old.wins + (score === 1 ? 1 : 0), losses: old.losses + (score === 0 ? 1 : 0),
          draws: old.draws + (score === 0.5 ? 1 : 0), peak: Math.max(old.peak, n.rating), lastGameAt: now,
        });
        updates.push({ userId: room.seats.w.userId, season, rating: next(wr, nw, scoreW) });
        updates.push({ userId: room.seats.b.userId, season, rating: next(br, nb, 1 - scoreW) });
        rec.whiteBefore = wr.rating; rec.whiteAfter = nw.rating; rec.blackBefore = br.rating; rec.blackAfter = nb.rating;
        r.ratingDelta = { w: Math.round(nw.rating) - Math.round(wr.rating), b: Math.round(nb.rating) - Math.round(br.rating) };
        for (const id of rec.whiteCards) cardDeltas.push({ cardId: id, score: scoreW });
        for (const id of rec.blackCards) cardDeltas.push({ cardId: id, score: 1 - scoreW });
      }
      await store.finishGame(rec, updates, cardDeltas);
    } catch (e) {
      log(`finalize ${room.id} failed: ${(e as Error).message}`);
    }
    broadcast(room);
    for (const c of ['w', 'b'] as Color[]) {
      const uid = room.seats[c].userId;
      if (userRoom.get(uid) === room.id) userRoom.delete(uid);
      if (room.rated) {
        const rating = await store.getRating(uid, season).catch(() => null);
        if (rating) sendUser(uid, { type: 'rating', rating: publicRating(rating) });
      }
    }
    room.dispose();
    setTimeout(() => rooms.delete(room.id), 60_000).unref();
    log(`game ${room.id} ${room.mode} ended ${r.winner} (${r.reason})`);
  }

  /** Start a game between two connected users. Returns false if either is unavailable. */
  async function startGame(mode: QueueMode, ua: number, ub: number, friendly = false): Promise<boolean> {
    const names = new Map<number, string>();
    for (const uid of [ua, ub]) {
      const ws = [...(sockets.get(uid) ?? [])][0];
      const u = ws ? users.get(ws) : undefined;
      if (!u || busy(uid)) { queue.delete(uid); return false; }
      names.set(uid, u.username);
    }
    queue.delete(ua);
    queue.delete(ub);
    const [ra, rb] = await Promise.all([store.getRating(ua, season), store.getRating(ub, season)]);
    const flip = crypto.randomInt(2) === 0;
    const seat = (uid: number, r: Rating) => ({ userId: uid, username: names.get(uid)!, rating: r.rating, rd: r.rd, provisional: r.games < config.provisionalGames });
    const w = flip ? seat(ua, ra) : seat(ub, rb), bl = flip ? seat(ub, rb) : seat(ua, ra);
    const room = new Room(mode, { w, b: bl }, config.timeControls[mode], events, { abortMs, friendly });
    rooms.set(room.id, room);
    userRoom.set(ua, room.id);
    userRoom.set(ub, room.id);
    for (const c of [...challenges.values()]) if ([c.from, c.to].includes(ua) || [c.from, c.to].includes(ub)) closeChallenge(c, 'started');
    await store.createGame(room.record0(season));
    log(`game ${room.id} ${mode}: ${w.username} vs ${bl.username}`);
    broadcast(room);
    return true;
  }

  const busy = (uid: number) => { const r = rooms.get(userRoom.get(uid) ?? ''); return !!r && !r.ended; };

  // ------------------------------------------------------------------ challenges (friend games + invite codes)
  interface Challenge { id: string; from: number; fromName: string; to: number | null; toName: string | null; mode: QueueMode; code: string | null; expires: number }
  const challenges = new Map<string, Challenge>();
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');

  function challengeView(c: Challenge) {
    return { id: c.id, from: { id: c.from, username: c.fromName }, to: c.to, toName: c.toName, mode: c.mode, code: c.code, expires: c.expires };
  }
  function closeChallenge(c: Challenge, reason: 'declined' | 'cancelled' | 'expired' | 'started' | 'offline') {
    if (!challenges.delete(c.id)) return;
    const msg = { type: 'challenge-closed', id: c.id, reason };
    sendUser(c.from, msg);
    if (c.to) sendUser(c.to, msg);
  }
  const challengeTimer = setInterval(() => {
    const now = Date.now();
    for (const c of [...challenges.values()]) if (c.expires <= now) closeChallenge(c, 'expired');
  }, 2000);
  challengeTimer.unref();

  let matching = false;
  async function matchTick() {
    if (matching) return;
    matching = true;
    try {
      const pairs = pairUp([...queue.values()], Date.now());
      for (const [a, b] of pairs) {
        for (const t of [a, b]) sendUser(t.userId, { type: 'unqueued', reason: 'matched' });
        await startGame(a.mode, a.userId, b.userId);
      }
    } catch (e) {
      log(`match tick failed: ${(e as Error).message}`);
    } finally {
      matching = false;
    }
  }
  const matchTimer = setInterval(matchTick, opts.matchIntervalMs ?? 1000);
  matchTimer.unref();

  // ------------------------------------------------------------------ http
  const staticDir = opts.staticDir === undefined ? config.staticDir : opts.staticDir;

  async function api(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.socket.remoteAddress || '?';
    const route = `${req.method} ${url.pathname}`;
    if (route === 'GET /api/health') return json(res, 200, { ok: true, app: 'augment-arena', season, rooms: [...rooms.values()].filter((r) => !r.ended).length, queue: queue.size, online: sockets.size, contact: config.contactEmail || null });
    if (route === 'POST /api/auth/register' || route === 'POST /api/auth/login') {
      if (!authLimiter.allow(ip)) return json(res, 429, { error: '잠시 후 다시 시도해 주세요.' });
      const body = await readBody(req);
      const err = validateCredentials(body.username, body.password);
      if (err) return json(res, 400, { error: err });
      let user: User | null;
      if (route.endsWith('register')) {
        user = await store.createUser(body.username, await hashPassword(body.password));
        if (!user) return json(res, 409, { error: '이미 사용 중인 아이디입니다.' });
      } else {
        const u = await store.userByName(body.username);
        if (!u || !(await verifyPassword(body.password, u.passwordHash))) return json(res, 401, { error: '아이디 또는 비밀번호가 맞지 않습니다.' });
        user = { id: u.id, username: u.username, createdAt: u.createdAt };
      }
      const token = newToken();
      await store.createSession(user.id, hashToken(token), new Date(Date.now() + config.sessionDays * 86_400_000));
      const rating = await store.getRating(user.id, season);
      return json(res, 200, { token, user, rating: publicRating(rating) });
    }
    if (route === 'POST /api/auth/logout') {
      const t = bearer(req);
      if (t) await store.deleteSession(hashToken(t));
      return json(res, 200, { ok: true });
    }
    if (route === 'POST /api/auth/delete') {
      if (!authLimiter.allow(ip)) return json(res, 429, { error: '잠시 후 다시 시도해 주세요.' });
      const user = await authUser(bearer(req));
      if (!user) return json(res, 401, { error: '로그인이 필요합니다.' });
      const body = await readBody(req);
      const u = await store.userByName(user.username);
      if (!u || typeof body.password !== 'string' || !(await verifyPassword(body.password, u.passwordHash))) return json(res, 401, { error: '비밀번호가 맞지 않습니다.' });
      if (userRoom.has(user.id)) return json(res, 409, { error: '진행 중인 대국을 마친 뒤 탈퇴할 수 있습니다.' });
      queue.delete(user.id);
      await store.deleteUser(user.id);
      for (const ws of sockets.get(user.id) ?? []) ws.close(4001, 'account deleted');
      log(`account deleted: ${user.id}`);
      return json(res, 200, { ok: true });
    }
    if (route === 'GET /api/me') {
      const user = await authUser(bearer(req));
      if (!user) return json(res, 401, { error: '로그인이 필요합니다.' });
      const rating = await store.getRating(user.id, season);
      return json(res, 200, { user, rating: publicRating(rating), season, activeGame: userRoom.get(user.id) ?? null });
    }
    if (url.pathname.startsWith('/api/friends')) {
      const me = await authUser(bearer(req));
      if (!me) return json(res, 401, { error: '로그인이 필요합니다.' });
      const notify = (...ids: number[]) => ids.forEach((id) => sendUser(id, { type: 'friends' }));
      if (route === 'GET /api/friends') {
        const lists = await store.friendLists(me.id);
        const decorate = async (u: User) => {
          const r = await store.getRating(u.id, season);
          return { id: u.id, username: u.username, rating: Math.round(r.rating), provisional: r.games < config.provisionalGames, online: sockets.has(u.id), playing: busy(u.id) };
        };
        return json(res, 200, {
          friends: await Promise.all(lists.friends.map(decorate)),
          incoming: await Promise.all(lists.incoming.map(decorate)),
          outgoing: await Promise.all(lists.outgoing.map(decorate)),
        });
      }
      if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
      const body = await readBody(req);
      if (route === 'POST /api/friends/request') {
        const target = typeof body.username === 'string' ? await store.userByName(body.username.trim()) : null;
        if (!target) return json(res, 404, { error: '그런 아이디의 플레이어가 없습니다.' });
        const r = await store.friendRequest(me.id, target.id);
        if (r === 'self') return json(res, 400, { error: '나 자신은 친구로 추가할 수 없습니다.' });
        if (r === 'already-friends') return json(res, 409, { error: '이미 친구입니다.' });
        if (r === 'already-sent') return json(res, 409, { error: '이미 친구 요청을 보냈습니다.' });
        notify(me.id, target.id);
        if (r === 'sent') sendUser(target.id, { type: 'friend-request', from: { id: me.id, username: me.username } });
        return json(res, 200, { result: r });
      }
      const other = Number(body.userId);
      if (!Number.isInteger(other)) return json(res, 400, { error: '잘못된 요청입니다.' });
      if (route === 'POST /api/friends/respond') {
        const ok = await store.respondFriend(me.id, other, body.accept === true);
        if (!ok) return json(res, 404, { error: '받은 친구 요청이 없습니다.' });
        notify(me.id, other);
        return json(res, 200, { ok: true });
      }
      if (route === 'POST /api/friends/remove') {
        await store.removeFriend(me.id, other);
        notify(me.id, other);
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: 'not found' });
    }
    if (route === 'GET /api/leaderboard') {
      const s = Number(url.searchParams.get('season') ?? season) || season;
      const rows = await store.leaderboard(s, config.provisionalGames, 100);
      return json(res, 200, { season: s, rows: rows.map((r, i) => ({ rank: i + 1, ...r, rating: Math.round(r.rating), rd: Math.round(r.rd) })) });
    }
    const um = url.pathname.match(/^\/api\/users\/([^/]+)$/);
    if (req.method === 'GET' && um) {
      const u = await store.userByName(decodeURIComponent(um[1]!));
      if (!u) return json(res, 404, { error: '없는 사용자입니다.' });
      const [rating, games] = await Promise.all([store.getRating(u.id, season), store.recentGames(u.id, 30)]);
      return json(res, 200, {
        user: { id: u.id, username: u.username, createdAt: u.createdAt }, rating: publicRating(rating), season,
        games: games.map((g) => ({
          id: g.id, mode: g.mode, rated: g.rated, white: g.whiteName, black: g.blackName, result: g.result, reason: g.reason,
          delta: g.rated && g.whiteAfter !== null ? Math.round(g.whiteId === u.id ? g.whiteAfter! - g.whiteBefore! : g.blackAfter! - g.blackBefore!) : null,
          color: g.whiteId === u.id ? 'w' : 'b', cards: g.whiteId === u.id ? g.whiteCards : g.blackCards, endedAt: g.endedAt,
        })),
      });
    }
    const gm = url.pathname.match(/^\/api\/games\/([^/]+)$/);
    if (req.method === 'GET' && gm) {
      const g = await store.getGame(gm[1]!);
      if (!g || !g.result) return json(res, 404, { error: '없는 대국입니다.' });
      return json(res, 200, { game: g });
    }
    if (route === 'GET /api/cards/stats') {
      const rows = await store.cardStats(season);
      const byId = new Map(rows.map((r) => [r.cardId, r]));
      return json(res, 200, {
        season,
        cards: CARD_ORDER.map((id) => {
          const r = byId.get(id);
          return { id, name: CARDS[id]!.name, stars: CARDS[id]!.stars, games: r?.games ?? 0, winRate: r && r.games ? r.score / r.games : null };
        }),
      });
    }
    return json(res, 404, { error: 'not found' });
  }

  function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
    if (!staticDir) return json(res, 404, { error: 'not found' });
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    let file = path.resolve(staticDir, rel);
    if (!file.startsWith(path.resolve(staticDir))) return json(res, 400, { error: 'bad path' });
    if (!rel || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(staticDir, 'index.html');
    if (!fs.existsSync(file)) return json(res, 404, { error: 'web build missing' });
    const ext = path.extname(file);
    const immutable = rel.startsWith('assets/');
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (url.pathname === '/download' || url.pathname === '/app.apk') {
        res.writeHead(302, { location: config.apkUrl, 'cache-control': 'no-store' });
        res.end();
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        // The mobile app (https://localhost) and other front-ends call the API cross-origin.
        // Auth uses bearer tokens, not cookies, so allowing any origin is safe.
        res.setHeader('access-control-allow-origin', req.headers.origin ?? '*');
        res.setHeader('vary', 'origin');
        res.setHeader('access-control-allow-headers', 'authorization, content-type');
        res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
        res.setHeader('access-control-max-age', '600');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
        await api(req, res, url);
      }
      else if (req.method === 'GET' || req.method === 'HEAD') serveStatic(req, res, url);
      else json(res, 405, { error: 'method not allowed' });
    } catch (e: any) {
      if (!res.headersSent) json(res, e.status ?? 500, { error: e.status ? e.message : '서버 오류가 발생했습니다.' });
      if (!e.status) log(`http error ${url.pathname}: ${e.stack ?? e}`);
    }
  });

  // ------------------------------------------------------------------ websocket
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/ws') return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket) => {
    let alive = true;
    ws.on('pong', () => { alive = true; });
    const ping = setInterval(() => {
      if (!alive) return ws.terminate();
      alive = false;
      ws.ping();
    }, 30_000);
    ping.unref();

    ws.on('message', async (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return send(ws, { type: 'error', message: '잘못된 메시지입니다.' }); }
      if (!msg || typeof msg.type !== 'string') return;
      const user = users.get(ws);
      try {
        if (msg.type === 'auth') {
          const u = await authUser(msg.token);
          if (!u) return send(ws, { type: 'error', code: 'auth', message: '로그인이 만료되었습니다.' });
          users.set(ws, u);
          if (!sockets.has(u.id)) sockets.set(u.id, new Set());
          sockets.get(u.id)!.add(ws);
          const rating = await store.getRating(u.id, season);
          send(ws, { type: 'welcome', user: u, rating: publicRating(rating), season });
          const rid = userRoom.get(u.id);
          const room = rid ? rooms.get(rid) : undefined;
          if (room && !room.ended) send(ws, { type: 'game', game: room.view(room.colorOf(u.id)) });
          const t = queue.get(u.id);
          if (t) send(ws, { type: 'queued', mode: t.mode, since: t.joinedAt });
          for (const c of challenges.values()) if (c.to === u.id || c.from === u.id) send(ws, { type: c.to === u.id ? 'challenge' : 'challenge-sent', challenge: challengeView(c) });
          return;
        }
        if (msg.type === 'ping') return send(ws, { type: 'pong', serverNow: Date.now() });
        if (!user) return send(ws, { type: 'error', code: 'auth', message: '로그인이 필요합니다.' });

        if (msg.type === 'queue') {
          const mode: QueueMode = msg.mode === 'rated' ? 'rated' : 'casual';
          const rid = userRoom.get(user.id);
          if (rid && rooms.get(rid) && !rooms.get(rid)!.ended) return send(ws, { type: 'error', message: '진행 중인 대국이 있습니다.' });
          const r = await store.getRating(user.id, season);
          queue.set(user.id, { userId: user.id, mode, rating: r.rating, joinedAt: Date.now() });
          sendUser(user.id, { type: 'queued', mode, since: Date.now() });
          return;
        }
        if (msg.type === 'challenge') {
          const mode: QueueMode = msg.mode === 'rated' ? 'rated' : 'casual';
          const to = Number(msg.to);
          if (!Number.isInteger(to) || to === user.id) return send(ws, { type: 'error', message: '잘못된 대국 신청입니다.' });
          const last = rooms.get(userRoom.get(user.id) ?? '');
          const rematch = !!last?.friendly && [last.seats.w.userId, last.seats.b.userId].includes(to);
          if (!rematch && !(await store.areFriends(user.id, to))) return send(ws, { type: 'error', message: '친구에게만 대국을 신청할 수 있습니다.' });
          if (!sockets.has(to)) return send(ws, { type: 'error', message: '친구가 지금 접속해 있지 않습니다.' });
          if (busy(to)) return send(ws, { type: 'error', message: '친구가 지금 대국 중입니다.' });
          if (busy(user.id)) return send(ws, { type: 'error', message: '진행 중인 대국이 있습니다.' });
          for (const c of [...challenges.values()]) if (c.from === user.id && c.to === to) closeChallenge(c, 'cancelled');
          const c: Challenge = { id: crypto.randomUUID(), from: user.id, fromName: user.username, to, toName: users.get([...sockets.get(to)!][0]!)?.username ?? null, mode, code: null, expires: Date.now() + 60_000 };
          challenges.set(c.id, c);
          sendUser(to, { type: 'challenge', challenge: challengeView(c) });
          sendUser(user.id, { type: 'challenge-sent', challenge: challengeView(c) });
          return;
        }
        if (msg.type === 'invite') {
          const mode: QueueMode = msg.mode === 'rated' ? 'rated' : 'casual';
          for (const c of [...challenges.values()]) if (c.from === user.id && c.code) closeChallenge(c, 'cancelled');
          let code = newCode();
          while ([...challenges.values()].some((c) => c.code === code)) code = newCode();
          const c: Challenge = { id: crypto.randomUUID(), from: user.id, fromName: user.username, to: null, toName: null, mode, code, expires: Date.now() + 10 * 60_000 };
          challenges.set(c.id, c);
          sendUser(user.id, { type: 'challenge-sent', challenge: challengeView(c) });
          return;
        }
        if (msg.type === 'challenge-accept') {
          const code = typeof msg.code === 'string' ? msg.code.trim().toUpperCase() : null;
          const c = code ? [...challenges.values()].find((x) => x.code === code) : challenges.get(String(msg.id));
          if (!c || (c.to !== null && c.to !== user.id)) return send(ws, { type: 'error', message: code ? '초대 코드를 찾을 수 없습니다. 코드가 만료됐을 수 있습니다.' : '대국 신청이 만료되었습니다.' });
          if (c.from === user.id) return send(ws, { type: 'error', message: '내가 만든 초대 코드입니다. 친구에게 보내 주세요.' });
          if (!sockets.has(c.from)) { closeChallenge(c, 'offline'); return send(ws, { type: 'error', message: '상대가 접속을 끊었습니다.' }); }
          challenges.delete(c.id);
          const ok = await startGame(c.mode, c.from, user.id, true);
          if (!ok) send(ws, { type: 'error', message: '지금은 대국을 시작할 수 없습니다. 둘 중 한 명이 대국 중입니다.' });
          sendUser(c.from, { type: 'challenge-closed', id: c.id, reason: ok ? 'started' : 'cancelled' });
          return;
        }
        if (msg.type === 'challenge-decline' || msg.type === 'challenge-cancel') {
          const c = challenges.get(String(msg.id));
          if (c && (c.to === user.id || c.from === user.id)) closeChallenge(c, msg.type === 'challenge-decline' ? 'declined' : 'cancelled');
          return;
        }
        if (msg.type === 'unqueue') {
          queue.delete(user.id);
          return sendUser(user.id, { type: 'unqueued', reason: 'cancelled' });
        }
        if (['pick', 'card', 'move', 'resign', 'draw'].includes(msg.type)) {
          const room = rooms.get(String(msg.gameId ?? userRoom.get(user.id) ?? ''));
          if (!room || room.ended) return send(ws, { type: 'error', message: '진행 중인 대국이 없습니다.' });
          try {
            room.act(user.id, msg as ClientAction);
          } catch (e) {
            send(ws, { type: 'error', message: (e as Error).message });
            send(ws, { type: 'game', game: room.view(room.colorOf(user.id)) });
          }
          return;
        }
        if (msg.type === 'sync') {
          const room = rooms.get(String(msg.gameId ?? userRoom.get(user.id) ?? ''));
          if (room) send(ws, { type: 'game', game: room.view(room.colorOf(user.id)) });
          return;
        }
      } catch (e) {
        log(`ws error: ${(e as Error).stack ?? e}`);
        send(ws, { type: 'error', message: '서버 오류가 발생했습니다.' });
      }
    });

    ws.on('close', () => {
      clearInterval(ping);
      const u = users.get(ws);
      users.delete(ws);
      if (!u) return;
      const set = sockets.get(u.id);
      set?.delete(ws);
      if (set && set.size === 0) {
        sockets.delete(u.id);
        queue.delete(u.id); // leaving the site leaves the queue; an active game keeps its clock running
        for (const c of [...challenges.values()]) if (c.from === u.id || c.to === u.id) closeChallenge(c, 'offline');
      }
    });
  });

  return {
    server,
    rooms,
    queue,
    matchNow: matchTick,
    async close() {
      clearInterval(matchTimer);
      clearInterval(challengeTimer);
      for (const r of rooms.values()) r.dispose();
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
