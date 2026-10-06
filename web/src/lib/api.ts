import { load, remove, save } from './storage.ts';

const TOKEN = 'aa.token';
export const getToken = (): string | null => load<string | null>(TOKEN, null);
export const setToken = (t: string | null) => (t ? save(TOKEN, t) : remove(TOKEN));

export interface PublicRating { rating: number; rd: number; games: number; wins: number; losses: number; draws: number; peak: number; provisional: boolean }
export interface User { id: number; username: string; createdAt: string }

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없어요. 네트워크를 확인해 주세요.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `요청 실패 (${res.status})`);
  return data as T;
}
