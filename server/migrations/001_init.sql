CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS ratings (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season       INTEGER NOT NULL,
  rating       DOUBLE PRECISION NOT NULL,
  rd           DOUBLE PRECISION NOT NULL,
  vol          DOUBLE PRECISION NOT NULL,
  games        INTEGER NOT NULL DEFAULT 0,
  wins         INTEGER NOT NULL DEFAULT 0,
  losses       INTEGER NOT NULL DEFAULT 0,
  draws        INTEGER NOT NULL DEFAULT 0,
  peak         DOUBLE PRECISION NOT NULL,
  last_game_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, season)
);
CREATE INDEX IF NOT EXISTS ratings_board ON ratings (season, rating DESC);

CREATE TABLE IF NOT EXISTS games (
  id          UUID PRIMARY KEY,
  mode        TEXT NOT NULL,
  rated       BOOLEAN NOT NULL,
  season      INTEGER NOT NULL,
  white_id    INTEGER NOT NULL REFERENCES users(id),
  black_id    INTEGER NOT NULL REFERENCES users(id),
  seed        BIGINT NOT NULL,
  mirror      BOOLEAN NOT NULL,
  base_ms     INTEGER NOT NULL,
  inc_ms      INTEGER NOT NULL,
  actions     JSONB NOT NULL DEFAULT '[]',
  result      TEXT,
  reason      TEXT,
  white_before DOUBLE PRECISION, white_after DOUBLE PRECISION,
  black_before DOUBLE PRECISION, black_after DOUBLE PRECISION,
  white_cards TEXT[] NOT NULL DEFAULT '{}',
  black_cards TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS games_white ON games (white_id, created_at DESC);
CREATE INDEX IF NOT EXISTS games_black ON games (black_id, created_at DESC);

CREATE TABLE IF NOT EXISTS card_stats (
  season  INTEGER NOT NULL,
  card_id TEXT NOT NULL,
  games   INTEGER NOT NULL DEFAULT 0,
  score   DOUBLE PRECISION NOT NULL DEFAULT 0,
  PRIMARY KEY (season, card_id)
);
