import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { decide } from '../../engine/src/index.ts';
import { MemoryStore } from '../src/memoryStore.ts';
import { PgStore } from '../src/pgStore.ts';
import { createServer } from '../src/server.ts';
import type { Store } from '../src/store.ts';

class Client {
  ws: WebSocket;
  inbox: any[] = [];
  waiters: Array<{ pred: (m: any) => boolean; resolve: (m: any) => void }> = [];
  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      const w = this.waiters.findIndex((x) => x.pred(m));
      if (w >= 0) this.waiters.splice(w, 1)[0]!.resolve(m);
      else this.inbox.push(m);
      this.onMessage?.(m);
    });
  }
  onMessage?: (m: any) => void;
  open() { return new Promise((r) => this.ws.once('open', r)); }
  send(m: unknown) { this.ws.send(JSON.stringify(m)); }
  next(pred: (m: any) => boolean, ms = 10_000): Promise<any> {
    const i = this.inbox.findIndex(pred);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout waiting for message')), ms);
      this.waiters.push({ pred, resolve: (m) => { clearTimeout(t); resolve(m); } });
    });
  }
  close() { this.ws.close(); }
}

async function suite(name: string, makeStore: () => Promise<Store>) {
  test(`${name}: register, queue rated, play a full game, ratings update`, async () => {
    const store = await makeStore();
    const app = createServer({ store, staticDir: null, matchIntervalMs: 50, log: () => {} });
    await new Promise<void>((r) => app.server.listen(0, r));
    const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    const post = (p: string, body: unknown) => fetch(base + p, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
    try {
      const suffix = Math.random().toString(36).slice(2, 7);
      const names = [`alice_${suffix}`, `bob_${suffix}`];
      const tokens: string[] = [];
      for (const n of names) {
        const r = await post('/api/auth/register', { username: n, password: 'password123' });
        assert.equal(r.status, 200);
        tokens.push((await r.json()).token);
      }
      assert.equal((await post('/api/auth/register', { username: names[0], password: 'password123' })).status, 409);
      assert.equal((await post('/api/auth/login', { username: names[0], password: 'wrongpass1' })).status, 401);
      assert.equal((await post('/api/auth/register', { username: 'x', password: 'password123' })).status, 400);
      const me = await fetch(base + '/api/me', { headers: { authorization: `Bearer ${tokens[0]}` } });
      assert.equal((await me.json()).rating.rating, 1500);

      const wsUrl = base.replace('http', 'ws') + '/ws';
      const clients = names.map(() => new Client(wsUrl));
      await Promise.all(clients.map((c) => c.open()));
      await Promise.all(clients.map(async (c, i) => { c.send({ type: 'auth', token: tokens[i] }); await c.next((m) => m.type === 'welcome'); }));

      let seed = 1;
      const done = Promise.all(clients.map((c) => new Promise<any>((resolve) => {
        c.onMessage = (m) => {
          if (m.type !== 'game') return;
          const g = m.game;
          if (g.result) { if (g.result.winner !== 'aborted' && (g.result.ratingDelta || !g.rated)) resolve(g); return; }
          if (g.state.turn !== g.you) return;
          const d = decide(g.state, { level: 1, seed: seed++ });
          if (d.kind === 'pick') c.send({ type: 'pick', gameId: g.id, id: d.id });
          else {
            if (d.card) c.send({ type: 'card', gameId: g.id, id: d.card.id, sel: d.card.sel });
            c.send({ type: 'move', gameId: g.id, move: d.move });
          }
        };
      })));
      for (const c of clients) c.send({ type: 'queue', mode: 'rated' });
      const [g1] = await done;
      assert.ok(g1.result.winner === 'w' || g1.result.winner === 'b' || g1.result.winner === 'draw');
      assert.ok(g1.state.cards.w.used.length + g1.state.cards.w.hand.length >= 1, 'drafted at least one card');

      // Ratings and records are persisted.
      const prof = await (await fetch(`${base}/api/users/${names[0]}`)).json();
      assert.equal(prof.rating.games, 1);
      assert.equal(prof.games.length, 1);
      assert.notEqual(prof.rating.rating, 1500);
      const gameRec = await (await fetch(`${base}/api/games/${prof.games[0].id}`)).json();
      assert.ok(gameRec.game.actions.length > 2);
      const stats = await (await fetch(`${base}/api/cards/stats`)).json();
      assert.equal(stats.cards.length, 60);
      assert.ok(stats.cards.some((c: any) => c.games > 0));
      const board = await (await fetch(`${base}/api/leaderboard`)).json();
      assert.deepEqual(board.rows, [], 'provisional players are not on the leaderboard yet');
      for (const c of clients) c.close();
    } finally {
      await app.close();
      await store.close();
    }
  });
}

await suite('memory', async () => new MemoryStore());
if (process.env.TEST_DATABASE_URL) {
  await suite('postgres', async () => { const s = new PgStore(process.env.TEST_DATABASE_URL!); await s.init(); return s; });
} else {
  test('postgres integration (set TEST_DATABASE_URL to run)', { skip: true }, () => {});
}
