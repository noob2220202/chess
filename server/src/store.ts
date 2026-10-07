import type { Glicko } from './glicko2.ts';

export interface User { id: number; username: string; createdAt: string }
export interface Rating extends Glicko {
  games: number; wins: number; losses: number; draws: number; peak: number; lastGameAt: string | null;
}
export type GameResult = 'w' | 'b' | 'draw' | 'aborted';

export interface GameAction {
  t: 'pick' | 'card' | 'move';
  c: 'w' | 'b';
  id?: string;
  sel?: number[];
  move?: { from: number; to: number; promotion?: string; castle?: 'K' | 'Q'; enPassant?: boolean };
  /** Milliseconds since game start. */
  at: number;
}

export interface GameRecord {
  id: string; mode: string; rated: boolean; season: number;
  whiteId: number; blackId: number; whiteName?: string; blackName?: string;
  seed: number; mirror: boolean; baseMs: number; incMs: number;
  actions: GameAction[];
  result: GameResult | null; reason: string | null;
  whiteBefore: number | null; whiteAfter: number | null; blackBefore: number | null; blackAfter: number | null;
  whiteCards: string[]; blackCards: string[];
  createdAt: string; endedAt: string | null;
}

export interface RatingUpdate { userId: number; season: number; rating: Rating }
export interface CardStatDelta { cardId: string; score: number }

export interface LeaderRow { username: string; rating: number; rd: number; games: number; wins: number; losses: number; draws: number }

export type FriendRequestResult = 'sent' | 'accepted' | 'already-friends' | 'already-sent' | 'self';
export interface FriendLists { friends: User[]; incoming: User[]; outgoing: User[] }

export interface Store {
  createUser(username: string, passwordHash: string): Promise<User | null>;
  userByName(username: string): Promise<(User & { passwordHash: string }) | null>;
  createSession(userId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  sessionUser(tokenHash: string): Promise<User | null>;
  deleteSession(tokenHash: string): Promise<void>;
  /** Rating for the season; carries over (soft reset) from the latest earlier season, else default. */
  getRating(userId: number, season: number): Promise<Rating>;
  createGame(rec: GameRecord): Promise<void>;
  finishGame(rec: GameRecord, ratings: RatingUpdate[], cards: CardStatDelta[]): Promise<void>;
  getGame(id: string): Promise<GameRecord | null>;
  recentGames(userId: number, limit: number): Promise<GameRecord[]>;
  leaderboard(season: number, minGames: number, limit: number): Promise<LeaderRow[]>;
  cardStats(season: number): Promise<Array<{ cardId: string; games: number; score: number }>>;
  userById(id: number): Promise<User | null>;
  /** Send a friend request; if the other side already asked, this accepts it instead. */
  friendRequest(fromId: number, toId: number): Promise<FriendRequestResult>;
  /** Accept or decline a pending request from `requesterId` to `userId`. Returns false if none. */
  respondFriend(userId: number, requesterId: number, accept: boolean): Promise<boolean>;
  /** Remove a friendship or cancel a request, in either direction. */
  removeFriend(a: number, b: number): Promise<void>;
  friendLists(userId: number): Promise<FriendLists>;
  areFriends(a: number, b: number): Promise<boolean>;
  /** Delete an account: sessions, ratings and friendships go; past games stay under an anonymous name. */
  deleteUser(userId: number): Promise<void>;
  close(): Promise<void>;
}

/** Name shown for a deleted account. Parentheses are not allowed in real usernames, so it never collides. */
export const deletedName = (userId: number) => `(탈퇴${userId})`;
