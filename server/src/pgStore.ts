import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { seasonReset } from './glicko2.ts';
import type { CardStatDelta, FriendLists, FriendRequestResult, GameRecord, LeaderRow, Rating, RatingUpdate, Store, User } from './store.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function migrate(pool: pg.Pool): Promise<void> {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const dir = path.resolve(here, '../migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const done = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [f]);
    if (done.rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function rowToRating(r: any): Rating {
  return {
    rating: r.rating, rd: r.rd, vol: r.vol, games: r.games, wins: r.wins, losses: r.losses, draws: r.draws,
    peak: r.peak, lastGameAt: iso(r.last_game_at),
  };
}

function rowToGame(r: any): GameRecord {
  return {
    id: r.id, mode: r.mode, rated: r.rated, season: r.season, whiteId: r.white_id, blackId: r.black_id,
    whiteName: r.white_name, blackName: r.black_name, seed: Number(r.seed), mirror: r.mirror,
    baseMs: r.base_ms, incMs: r.inc_ms, actions: r.actions, result: r.result, reason: r.reason,
    whiteBefore: r.white_before, whiteAfter: r.white_after, blackBefore: r.black_before, blackAfter: r.black_after,
    whiteCards: r.white_cards, blackCards: r.black_cards, createdAt: iso(r.created_at)!, endedAt: iso(r.ended_at),
  };
}

const GAME_SELECT = `SELECT g.*, wu.username AS white_name, bu.username AS black_name
  FROM games g JOIN users wu ON wu.id = g.white_id JOIN users bu ON bu.id = g.black_id`;

export class PgStore implements Store {
  readonly pool: pg.Pool;
  constructor(url: string) {
    this.pool = new pg.Pool({ connectionString: url, max: 10 });
  }
  async init(): Promise<void> { await migrate(this.pool); }

  async createUser(username: string, passwordHash: string): Promise<User | null> {
    try {
      const r = await this.pool.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at', [username, passwordHash]);
      const u = r.rows[0];
      return { id: u.id, username: u.username, createdAt: iso(u.created_at)! };
    } catch (e: any) {
      if (e.code === '23505') return null;
      throw e;
    }
  }
  async userByName(username: string) {
    const r = await this.pool.query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
    const u = r.rows[0];
    return u ? { id: u.id, username: u.username, createdAt: iso(u.created_at)!, passwordHash: u.password_hash } : null;
  }
  async createSession(userId: number, tokenHash: string, expiresAt: Date) {
    await this.pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, expiresAt]);
  }
  async sessionUser(tokenHash: string): Promise<User | null> {
    const r = await this.pool.query(
      `SELECT u.id, u.username, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`, [tokenHash]);
    const u = r.rows[0];
    return u ? { id: u.id, username: u.username, createdAt: iso(u.created_at)! } : null;
  }
  async deleteSession(tokenHash: string) { await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]); }

  async getRating(userId: number, season: number): Promise<Rating> {
    const r = await this.pool.query('SELECT * FROM ratings WHERE user_id = $1 AND season = $2', [userId, season]);
    if (r.rows[0]) return rowToRating(r.rows[0]);
    const prev = await this.pool.query(
      'SELECT * FROM ratings WHERE user_id = $1 AND season < $2 ORDER BY season DESC LIMIT 1', [userId, season]);
    const g = seasonReset(prev.rows[0] ? rowToRating(prev.rows[0]) : null);
    return { ...g, games: 0, wins: 0, losses: 0, draws: 0, peak: g.rating, lastGameAt: null };
  }

  async createGame(g: GameRecord) {
    await this.pool.query(
      `INSERT INTO games (id, mode, rated, season, white_id, black_id, seed, mirror, base_ms, inc_ms, actions, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [g.id, g.mode, g.rated, g.season, g.whiteId, g.blackId, g.seed, g.mirror, g.baseMs, g.incMs, JSON.stringify(g.actions), g.createdAt]);
  }

  async finishGame(g: GameRecord, ratings: RatingUpdate[], cards: CardStatDelta[]) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        `UPDATE games SET actions=$2, result=$3, reason=$4, white_before=$5, white_after=$6, black_before=$7, black_after=$8,
           white_cards=$9, black_cards=$10, ended_at=$11 WHERE id=$1`,
        [g.id, JSON.stringify(g.actions), g.result, g.reason, g.whiteBefore, g.whiteAfter, g.blackBefore, g.blackAfter,
          g.whiteCards, g.blackCards, g.endedAt]);
      for (const u of ratings) {
        const r = u.rating;
        await c.query(
          `INSERT INTO ratings (user_id, season, rating, rd, vol, games, wins, losses, draws, peak, last_game_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (user_id, season) DO UPDATE SET rating=$3, rd=$4, vol=$5, games=$6, wins=$7, losses=$8, draws=$9, peak=$10, last_game_at=$11`,
          [u.userId, u.season, r.rating, r.rd, r.vol, r.games, r.wins, r.losses, r.draws, r.peak, r.lastGameAt]);
      }
      for (const d of cards) {
        await c.query(
          `INSERT INTO card_stats (season, card_id, games, score) VALUES ($1,$2,1,$3)
           ON CONFLICT (season, card_id) DO UPDATE SET games = card_stats.games + 1, score = card_stats.score + $3`,
          [g.season, d.cardId, d.score]);
      }
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }

  async getGame(id: string) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const r = await this.pool.query(`${GAME_SELECT} WHERE g.id = $1`, [id]);
    return r.rows[0] ? rowToGame(r.rows[0]) : null;
  }
  async recentGames(userId: number, limit: number) {
    const r = await this.pool.query(
      `${GAME_SELECT} WHERE (g.white_id = $1 OR g.black_id = $1) AND g.result IS NOT NULL ORDER BY g.created_at DESC LIMIT $2`, [userId, limit]);
    return r.rows.map(rowToGame);
  }
  async leaderboard(season: number, minGames: number, limit: number): Promise<LeaderRow[]> {
    const r = await this.pool.query(
      `SELECT u.username, r.rating, r.rd, r.games, r.wins, r.losses, r.draws FROM ratings r JOIN users u ON u.id = r.user_id
       WHERE r.season = $1 AND r.games >= $2 ORDER BY r.rating DESC LIMIT $3`, [season, minGames, limit]);
    return r.rows;
  }
  async cardStats(season: number) {
    const r = await this.pool.query('SELECT card_id, games, score FROM card_stats WHERE season = $1', [season]);
    return r.rows.map((x) => ({ cardId: x.card_id, games: x.games, score: x.score }));
  }
  async userById(id: number): Promise<User | null> {
    const r = await this.pool.query('SELECT id, username, created_at FROM users WHERE id = $1', [id]);
    const u = r.rows[0];
    return u ? { id: u.id, username: u.username, createdAt: iso(u.created_at)! } : null;
  }
  async friendRequest(fromId: number, toId: number): Promise<FriendRequestResult> {
    if (fromId === toId) return 'self';
    const r = await this.pool.query(
      'SELECT requester_id, status FROM friendships WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)', [fromId, toId]);
    const row = r.rows[0];
    if (row?.status === 'accepted') return 'already-friends';
    if (row && row.requester_id === fromId) return 'already-sent';
    if (row) {
      await this.pool.query("UPDATE friendships SET status = 'accepted' WHERE requester_id = $1 AND addressee_id = $2", [toId, fromId]);
      return 'accepted';
    }
    await this.pool.query('INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2)', [fromId, toId]);
    return 'sent';
  }
  async respondFriend(userId: number, requesterId: number, accept: boolean) {
    const r = accept
      ? await this.pool.query("UPDATE friendships SET status = 'accepted' WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'", [requesterId, userId])
      : await this.pool.query("DELETE FROM friendships WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'", [requesterId, userId]);
    return (r.rowCount ?? 0) > 0;
  }
  async removeFriend(a: number, b: number) {
    await this.pool.query('DELETE FROM friendships WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)', [a, b]);
  }
  async friendLists(userId: number): Promise<FriendLists> {
    const r = await this.pool.query(
      `SELECT f.requester_id, f.addressee_id, f.status, u.id, u.username, u.created_at FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       WHERE f.requester_id = $1 OR f.addressee_id = $1 ORDER BY lower(u.username)`, [userId]);
    const out: FriendLists = { friends: [], incoming: [], outgoing: [] };
    for (const x of r.rows) {
      const u = { id: x.id, username: x.username, createdAt: iso(x.created_at)! };
      if (x.status === 'accepted') out.friends.push(u);
      else if (x.addressee_id === userId) out.incoming.push(u);
      else out.outgoing.push(u);
    }
    return out;
  }
  async areFriends(a: number, b: number) {
    const r = await this.pool.query(
      "SELECT 1 FROM friendships WHERE status = 'accepted' AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))", [a, b]);
    return (r.rowCount ?? 0) > 0;
  }
  async close() { await this.pool.end(); }
}
