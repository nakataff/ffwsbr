-- Reduz full table scans do ranking e das rotinas semanais no Cloudflare D1.
-- Seguro para executar mais de uma vez.

CREATE INDEX IF NOT EXISTS idx_awards_created_at
  ON awards (created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_awards_day_user_type
  ON awards (day_key, user_key, type);

CREATE INDEX IF NOT EXISTS idx_active_days_day_user
  ON active_days (day_key, user_key);

CREATE INDEX IF NOT EXISTS idx_monthly_points
  ON monthly_users (month_key, points DESC);

CREATE INDEX IF NOT EXISTS idx_users_points
  ON users (points_all DESC);

ANALYZE;
