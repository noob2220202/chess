import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1 };

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 32, PARAMS);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, s, k] = stored.split('$');
  if (alg !== 'scrypt' || !s || !k) return false;
  const want = Buffer.from(k, 'base64');
  const got = await scrypt(pw, Buffer.from(s, 'base64'), want.length, PARAMS);
  return crypto.timingSafeEqual(got, want);
}

export const newToken = (): string => crypto.randomBytes(32).toString('base64url');
export const hashToken = (t: string): string => crypto.createHash('sha256').update(t).digest('hex');

export const USERNAME_RE = /^[A-Za-z0-9_가-힣]{3,16}$/;
export function validateCredentials(username: unknown, password: unknown): string | null {
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) return '아이디는 3~16자의 한글, 영문, 숫자, _ 만 쓸 수 있어요.';
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return '비밀번호는 8자 이상이어야 해요.';
  return null;
}

/** Simple fixed-window rate limiter keyed by e.g. IP. */
export class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  private max: number;
  private windowMs: number;
  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
  }
  allow(key: string, now = Date.now()): boolean {
    const h = this.hits.get(key);
    if (!h || h.reset <= now) { this.hits.set(key, { n: 1, reset: now + this.windowMs }); return true; }
    h.n++;
    return h.n <= this.max;
  }
}
