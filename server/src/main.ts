import { config } from './config.ts';
import { MemoryStore } from './memoryStore.ts';
import { PgStore } from './pgStore.ts';
import { createServer } from './server.ts';
import type { Store } from './store.ts';

let store: Store;
if (config.databaseUrl) {
  const pg = new PgStore(config.databaseUrl);
  await pg.init();
  store = pg;
} else {
  console.warn('DATABASE_URL is not set: using an in-memory store (data is lost on restart).');
  store = new MemoryStore();
}

const app = createServer({ store });
app.server.listen(config.port, () => console.log(`augment chess server on :${config.port} (season ${config.season})`));

const shutdown = async () => {
  console.log('shutting down');
  await app.close();
  await store.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
