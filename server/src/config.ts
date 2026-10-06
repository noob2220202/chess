import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export interface TimeControl { baseMs: number; incMs: number }
export type QueueMode = 'rated' | 'casual';

export const config = {
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: process.env.DATABASE_URL ?? '',
  staticDir: process.env.STATIC_DIR ?? path.resolve(here, '../../web/dist'),
  season: Number(process.env.SEASON ?? 1),
  /** Where /download sends people for the Android app. */
  apkUrl: process.env.APK_URL ?? 'https://github.com/noob2220202/chess/releases/download/app-latest/augment-arena.apk',
  sessionDays: 60,
  /** Ply count below which an unmoved player aborts the game instead of losing. */
  abortMs: Number(process.env.ABORT_MS ?? 30_000),
  timeControls: {
    rated: { baseMs: 10 * 60_000, incMs: 5_000 },
    casual: { baseMs: 5 * 60_000, incMs: 3_000 },
  } satisfies Record<QueueMode, TimeControl>,
  /** Games needed before a rating is shown as established. */
  provisionalGames: 10,
};
