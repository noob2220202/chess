import { LESSON_RENAMES } from '../tutorial/lessons.ts';

/** localStorage wrapper that never throws (private mode, blocked storage). */
export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
export function remove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

const PROGRESS = 'aa.progress.v1';
export interface Progress { lessons: string[]; demos: string[] }
export function getProgress(): Progress {
  const p = load<Progress>(PROGRESS, { lessons: [], demos: [] });
  // Older, longer lessons were split; count them as their replacements.
  for (const [old, now] of Object.entries(LESSON_RENAMES)) {
    if (p.lessons.includes(old)) p.lessons = [...new Set([...p.lessons.filter((x) => x !== old), ...now])];
  }
  return p;
}
export function markProgress(kind: keyof Progress, id: string): void {
  const p = getProgress();
  if (!p[kind].includes(id)) p[kind].push(id);
  save(PROGRESS, p);
}
