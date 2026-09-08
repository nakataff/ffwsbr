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

CREATE INDEX IF NOT EXISTS idx_checkin_sessions_code
  ON checkin_sessions (code);

CREATE INDEX IF NOT EXISTS idx_checkin_sessions_user
  ON checkin_sessions (user_key);
