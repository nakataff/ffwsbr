CREATE INDEX IF NOT EXISTS idx_awards_type_award_key
  ON awards (type, award_key);

CREATE INDEX IF NOT EXISTS idx_awards_user_day_type
  ON awards (user_key, day_key, type);

CREATE INDEX IF NOT EXISTS idx_awards_type_day_user
  ON awards (type, day_key, user_key);

CREATE INDEX IF NOT EXISTS idx_awards_type_month_user
  ON awards (type, month_key, user_key);

CREATE INDEX IF NOT EXISTS idx_awards_user_type_created
  ON awards (user_key, type, created_at);

ANALYZE;
