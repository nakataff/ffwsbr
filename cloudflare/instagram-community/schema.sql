CREATE TABLE IF NOT EXISTS users (
  user_key TEXT PRIMARY KEY,
  instagram_id TEXT,
  username TEXT NOT NULL,
  points_all INTEGER NOT NULL DEFAULT 0,
  story_mentions_all INTEGER NOT NULL DEFAULT 0,
  comments_all INTEGER NOT NULL DEFAULT 0,
  active_days_all INTEGER NOT NULL DEFAULT 0,
  last_interaction_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS monthly_users (
  month_key TEXT NOT NULL,
  user_key TEXT NOT NULL,
  username TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  story_mentions INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  active_days INTEGER NOT NULL DEFAULT 0,
  last_interaction_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (month_key, user_key)
);

CREATE TABLE IF NOT EXISTS awards (
  award_key TEXT PRIMARY KEY,
  user_key TEXT NOT NULL,
  username TEXT NOT NULL,
  type TEXT NOT NULL,
  source_id TEXT,
  points INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  month_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS active_days (
  user_key TEXT NOT NULL,
  day_key TEXT NOT NULL,
  PRIMARY KEY (user_key, day_key)
);

CREATE TABLE IF NOT EXISTS story_daily (
  user_key TEXT NOT NULL,
  day_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_key, day_key)
);

CREATE TABLE IF NOT EXISTS checkin_sessions (
  session_id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  user_key TEXT,
  instagram_id TEXT,
  username TEXT,
  verified_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS raw_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  received_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monthly_points
  ON monthly_users (month_key, points DESC);

CREATE INDEX IF NOT EXISTS idx_users_points
  ON users (points_all DESC);

CREATE INDEX IF NOT EXISTS idx_awards_created_at
  ON awards (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkin_sessions_code
  ON checkin_sessions (code);

CREATE INDEX IF NOT EXISTS idx_checkin_sessions_user
  ON checkin_sessions (user_key);
