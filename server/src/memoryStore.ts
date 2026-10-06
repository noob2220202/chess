import { seasonReset } from './glicko2.ts';
import type { CardStatDelta, GameRecord, LeaderRow, Rating, RatingUpdate, Store, User } from './store.ts';

/** In-memory store for tests and quick local runs without Postgres. */
export class MemoryStore implements Store {
  users: Array<User & { passwordHash: string }> = [];
  sessions = new Map<string, { userId: number; expiresAt: Date }>();
  ratings = new Map<string, Rating>();
  games = new Map<string, GameRecord>();
  cards = new Map<string, { games: number; score: number }>();

  async createUser(username: string, passwordHash: string) {
    if (this.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) return null;
    const u = { id: this.users.length + 1, username, createdAt: new Date().toISOString(), passwordHash };
    this.users.push(u);
    return { id: u.id, username: u.username, createdAt: u.createdAt };
  }
  async userByName(username: string) {
    return this.users.find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null;
  }
  async createSession(userId: number, tokenHash: string, expiresAt: Date) { this.sessions.set(tokenHash, { userId, expiresAt }); }
  async sessionUser(tokenHash: string) {
    const s = this.sessions.get(tokenHash);
    if (!s || s.expiresAt <= new Date()) return null;
    const u = this.users.find((x) => x.id === s.userId)!;
    return { id: u.id, username: u.username, createdAt: u.createdAt };
  }
  async deleteSession(tokenHash: string) { this.sessions.delete(tokenHash); }
  async getRating(userId: number, season: number): Promise<Rating> {
    const r = this.ratings.get(`${userId}:${season}`);
    if (r) return { ...r };
    let prev: Rating | null = null;
    for (let s = season - 1; s >= 0 && !prev; s--) prev = this.ratings.get(`${userId}:${s}`) ?? null;
    const g = seasonReset(prev);
    return { ...g, games: 0, wins: 0, losses: 0, draws: 0, peak: g.rating, lastGameAt: null };
  }
  async createGame(g: GameRecord) { this.games.set(g.id, structuredClone(g)); }
  async finishGame(g: GameRecord, ratings: RatingUpdate[], cards: CardStatDelta[]) {
    this.games.set(g.id, structuredClone(g));
    for (const u of ratings) this.ratings.set(`${u.userId}:${u.season}`, { ...u.rating });
    for (const c of cards) {
      const k = `${g.season}:${c.cardId}`;
      const e = this.cards.get(k) ?? { games: 0, score: 0 };
      this.cards.set(k, { games: e.games + 1, score: e.score + c.score });
    }
  }
  private named(g: GameRecord): GameRecord {
    const name = (id: number) => this.users.find((u) => u.id === id)?.username;
    return { ...structuredClone(g), whiteName: name(g.whiteId), blackName: name(g.blackId) };
  }
  async getGame(id: string) { const g = this.games.get(id); return g ? this.named(g) : null; }
  async recentGames(userId: number, limit: number) {
    return [...this.games.values()].filter((g) => g.result && (g.whiteId === userId || g.blackId === userId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map((g) => this.named(g));
  }
  async leaderboard(season: number, minGames: number, limit: number): Promise<LeaderRow[]> {
    const rows: LeaderRow[] = [];
    for (const [k, r] of this.ratings) {
      const [uid, s] = k.split(':').map(Number);
      if (s !== season || r.games < minGames) continue;
      const u = this.users.find((x) => x.id === uid)!;
      rows.push({ username: u.username, rating: r.rating, rd: r.rd, games: r.games, wins: r.wins, losses: r.losses, draws: r.draws });
    }
    return rows.sort((a, b) => b.rating - a.rating).slice(0, limit);
  }
  async cardStats(season: number) {
    return [...this.cards].filter(([k]) => k.startsWith(`${season}:`)).map(([k, v]) => ({ cardId: k.split(':')[1]!, ...v }));
  }
  async close() {}
}
