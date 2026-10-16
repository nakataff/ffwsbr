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

CREATE INDEX IF NOT EXISTS idx_awards_type_award_key
  ON awards (type, award_key);

CREATE INDEX IF NOT EXISTS idx_awards_user_day_type
  ON awards (user_key, day_key, type);

CREATE INDEX IF NOT EXISTS idx_awards_day_user_type
  ON awards (day_key, user_key, type);

CREATE INDEX IF NOT EXISTS idx_active_days_day_user
  ON active_days (day_key, user_key);

CREATE INDEX IF NOT EXISTS idx_awards_type_day_user
  ON awards (type, day_key, user_key);

CREATE INDEX IF NOT EXISTS idx_awards_type_month_user
  ON awards (type, month_key, user_key);

CREATE INDEX IF NOT EXISTS idx_awards_user_type_created
  ON awards (user_key, type, created_at);

-- Cache compartilhado, snapshots corrigíveis e premiações idempotentes.
-- Pode ser executado mais de uma vez.

CREATE TABLE IF NOT EXISTS community_response_cache (cache_key TEXT PRIMARY KEY,payload TEXT NOT NULL,expires_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS community_period_versions (period_key TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS weekly_ranking_snapshots (week_key TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS monthly_ranking_snapshots (month_key TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS prediction_settlements (job_key TEXT PRIMARY KEY,signature TEXT NOT NULL,status TEXT NOT NULL,lease_token TEXT NOT NULL,lease_until INTEGER NOT NULL,completed_at INTEGER NOT NULL DEFAULT 0);

CREATE TRIGGER IF NOT EXISTS cff_history_awards_insert
    AFTER INSERT ON awards
    WHEN (NEW.day_key<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days') OR substr(NEW.day_key,1,7)<strftime('%Y-%m','now','-3 hours'))
    BEGIN
    INSERT INTO community_period_versions(period_key,version) SELECT 'week:'||date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days'),1 WHERE date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days')<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    INSERT INTO community_period_versions(period_key,version) SELECT 'month:'||substr(NEW.day_key,1,7),1 WHERE substr(NEW.day_key,1,7)<strftime('%Y-%m','now','-3 hours')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    DELETE FROM weekly_ranking_snapshots WHERE week_key=date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days');
    DELETE FROM monthly_ranking_snapshots WHERE month_key=substr(NEW.day_key,1,7);
    DELETE FROM community_response_cache WHERE cache_key='ranking:week:'||date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days') OR cache_key='ranking:month:'||substr(NEW.day_key,1,7)
      OR cache_key LIKE 'history:%' OR cache_key LIKE 'closed-weeks:%'; END;

CREATE TRIGGER IF NOT EXISTS cff_history_awards_update
    AFTER UPDATE ON awards
    WHEN (OLD.day_key<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days') OR substr(OLD.day_key,1,7)<strftime('%Y-%m','now','-3 hours')) OR (NEW.day_key<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days') OR substr(NEW.day_key,1,7)<strftime('%Y-%m','now','-3 hours'))
    BEGIN
    INSERT INTO community_period_versions(period_key,version) SELECT 'week:'||date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days'),1 WHERE date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days')<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    INSERT INTO community_period_versions(period_key,version) SELECT 'month:'||substr(OLD.day_key,1,7),1 WHERE substr(OLD.day_key,1,7)<strftime('%Y-%m','now','-3 hours')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    DELETE FROM weekly_ranking_snapshots WHERE week_key=date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days');
    DELETE FROM monthly_ranking_snapshots WHERE month_key=substr(OLD.day_key,1,7);
    DELETE FROM community_response_cache WHERE cache_key='ranking:week:'||date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days') OR cache_key='ranking:month:'||substr(OLD.day_key,1,7)
      OR cache_key LIKE 'history:%' OR cache_key LIKE 'closed-weeks:%';

    INSERT INTO community_period_versions(period_key,version) SELECT 'week:'||date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days'),1 WHERE date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days')<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    INSERT INTO community_period_versions(period_key,version) SELECT 'month:'||substr(NEW.day_key,1,7),1 WHERE substr(NEW.day_key,1,7)<strftime('%Y-%m','now','-3 hours')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    DELETE FROM weekly_ranking_snapshots WHERE week_key=date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days');
    DELETE FROM monthly_ranking_snapshots WHERE month_key=substr(NEW.day_key,1,7);
    DELETE FROM community_response_cache WHERE cache_key='ranking:week:'||date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days') OR cache_key='ranking:month:'||substr(NEW.day_key,1,7)
      OR cache_key LIKE 'history:%' OR cache_key LIKE 'closed-weeks:%'; END;

CREATE TRIGGER IF NOT EXISTS cff_history_awards_delete
    AFTER DELETE ON awards
    WHEN (OLD.day_key<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days') OR substr(OLD.day_key,1,7)<strftime('%Y-%m','now','-3 hours'))
    BEGIN
    INSERT INTO community_period_versions(period_key,version) SELECT 'week:'||date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days'),1 WHERE date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days')<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    INSERT INTO community_period_versions(period_key,version) SELECT 'month:'||substr(OLD.day_key,1,7),1 WHERE substr(OLD.day_key,1,7)<strftime('%Y-%m','now','-3 hours')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    DELETE FROM weekly_ranking_snapshots WHERE week_key=date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days');
    DELETE FROM monthly_ranking_snapshots WHERE month_key=substr(OLD.day_key,1,7);
    DELETE FROM community_response_cache WHERE cache_key='ranking:week:'||date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days') OR cache_key='ranking:month:'||substr(OLD.day_key,1,7)
      OR cache_key LIKE 'history:%' OR cache_key LIKE 'closed-weeks:%'; END;

CREATE TRIGGER IF NOT EXISTS cff_history_active_days_insert
    AFTER INSERT ON active_days
    WHEN (NEW.day_key<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days') OR substr(NEW.day_key,1,7)<strftime('%Y-%m','now','-3 hours'))
    BEGIN
    INSERT INTO community_period_versions(period_key,version) SELECT 'week:'||date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days'),1 WHERE date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days')<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    INSERT INTO community_period_versions(period_key,version) SELECT 'month:'||substr(NEW.day_key,1,7),1 WHERE substr(NEW.day_key,1,7)<strftime('%Y-%m','now','-3 hours')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    DELETE FROM weekly_ranking_snapshots WHERE week_key=date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days');
    DELETE FROM monthly_ranking_snapshots WHERE month_key=substr(NEW.day_key,1,7);
    DELETE FROM community_response_cache WHERE cache_key='ranking:week:'||date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days') OR cache_key='ranking:month:'||substr(NEW.day_key,1,7)
      OR cache_key LIKE 'history:%' OR cache_key LIKE 'closed-weeks:%'; END;

CREATE TRIGGER IF NOT EXISTS cff_history_active_days_update
    AFTER UPDATE ON active_days
    WHEN (OLD.day_key<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days') OR substr(OLD.day_key,1,7)<strftime('%Y-%m','now','-3 hours')) OR (NEW.day_key<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days') OR substr(NEW.day_key,1,7)<strftime('%Y-%m','now','-3 hours'))
    BEGIN
    INSERT INTO community_period_versions(period_key,version) SELECT 'week:'||date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days'),1 WHERE date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days')<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    INSERT INTO community_period_versions(period_key,version) SELECT 'month:'||substr(OLD.day_key,1,7),1 WHERE substr(OLD.day_key,1,7)<strftime('%Y-%m','now','-3 hours')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    DELETE FROM weekly_ranking_snapshots WHERE week_key=date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days');
    DELETE FROM monthly_ranking_snapshots WHERE month_key=substr(OLD.day_key,1,7);
    DELETE FROM community_response_cache WHERE cache_key='ranking:week:'||date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days') OR cache_key='ranking:month:'||substr(OLD.day_key,1,7)
      OR cache_key LIKE 'history:%' OR cache_key LIKE 'closed-weeks:%';

    INSERT INTO community_period_versions(period_key,version) SELECT 'week:'||date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days'),1 WHERE date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days')<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    INSERT INTO community_period_versions(period_key,version) SELECT 'month:'||substr(NEW.day_key,1,7),1 WHERE substr(NEW.day_key,1,7)<strftime('%Y-%m','now','-3 hours')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    DELETE FROM weekly_ranking_snapshots WHERE week_key=date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days');
    DELETE FROM monthly_ranking_snapshots WHERE month_key=substr(NEW.day_key,1,7);
    DELETE FROM community_response_cache WHERE cache_key='ranking:week:'||date(NEW.day_key, '-' || ((CAST(strftime('%w',NEW.day_key) AS INTEGER)+6)%7) || ' days') OR cache_key='ranking:month:'||substr(NEW.day_key,1,7)
      OR cache_key LIKE 'history:%' OR cache_key LIKE 'closed-weeks:%'; END;

CREATE TRIGGER IF NOT EXISTS cff_history_active_days_delete
    AFTER DELETE ON active_days
    WHEN (OLD.day_key<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days') OR substr(OLD.day_key,1,7)<strftime('%Y-%m','now','-3 hours'))
    BEGIN
    INSERT INTO community_period_versions(period_key,version) SELECT 'week:'||date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days'),1 WHERE date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days')<date(date('now','-3 hours'), '-' || ((CAST(strftime('%w',date('now','-3 hours')) AS INTEGER)+6)%7) || ' days')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    INSERT INTO community_period_versions(period_key,version) SELECT 'month:'||substr(OLD.day_key,1,7),1 WHERE substr(OLD.day_key,1,7)<strftime('%Y-%m','now','-3 hours')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    DELETE FROM weekly_ranking_snapshots WHERE week_key=date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days');
    DELETE FROM monthly_ranking_snapshots WHERE month_key=substr(OLD.day_key,1,7);
    DELETE FROM community_response_cache WHERE cache_key='ranking:week:'||date(OLD.day_key, '-' || ((CAST(strftime('%w',OLD.day_key) AS INTEGER)+6)%7) || ' days') OR cache_key='ranking:month:'||substr(OLD.day_key,1,7)
      OR cache_key LIKE 'history:%' OR cache_key LIKE 'closed-weeks:%'; END;

-- Stories require an authenticated review before earning points.
CREATE TABLE IF NOT EXISTS story_reviews (
 mention_key TEXT PRIMARY KEY,user_key TEXT NOT NULL,instagram_id TEXT NOT NULL,username TEXT NOT NULL,
 account_id TEXT NOT NULL DEFAULT '',story_id TEXT NOT NULL,message_id TEXT NOT NULL DEFAULT '',media_url TEXT NOT NULL DEFAULT '',
 event_at INTEGER NOT NULL,day_key TEXT NOT NULL,week_key TEXT NOT NULL,received_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 post_key TEXT NOT NULL DEFAULT '',post_url TEXT NOT NULL DEFAULT '',published_at INTEGER NOT NULL DEFAULT 0,
 verification TEXT NOT NULL DEFAULT '',reviewed_at INTEGER NOT NULL DEFAULT 0,reviewed_by TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',points INTEGER NOT NULL DEFAULT 5 CHECK(points=5));

DELETE FROM community_response_cache WHERE cache_key LIKE 'ranking:%' AND NOT EXISTS(SELECT 1 FROM community_period_versions WHERE period_key='policy:story-review-v1');

INSERT OR IGNORE INTO community_period_versions(period_key,version) VALUES('policy:story-review-v1',1);

CREATE INDEX IF NOT EXISTS idx_story_reviews_queue ON story_reviews(status,event_at,mention_key);

CREATE INDEX IF NOT EXISTS idx_story_reviews_user_week ON story_reviews(user_key,week_key,status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_story_review_post_once ON story_reviews(user_key,post_key) WHERE status='approved';

CREATE TRIGGER IF NOT EXISTS cff_story_review_guard BEFORE UPDATE ON story_reviews
 WHEN NEW.status='approved' AND OLD.status='pending' BEGIN
 SELECT CASE WHEN NEW.post_key='' OR NEW.post_url='' OR NEW.published_at<=0 OR NEW.verification NOT IN ('meta','manual')
 THEN RAISE(ABORT,'story_missing_post') END;
 SELECT CASE WHEN date(date(NEW.published_at/1000,'unixepoch','-3 hours'), '-' || ((CAST(strftime('%w',date(NEW.published_at/1000,'unixepoch','-3 hours')) AS INTEGER)+6)%7) || ' days')<>NEW.week_key OR NEW.published_at>NEW.event_at+300000
 THEN RAISE(ABORT,'story_wrong_week') END;
 SELECT CASE WHEN (SELECT COUNT(*) FROM awards WHERE user_key=NEW.user_key AND day_key=NEW.day_key AND type='story')>=3
 THEN RAISE(ABORT,'story_daily_limit') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM awards WHERE award_key=NEW.mention_key)
 THEN RAISE(ABORT,'story_already_awarded') END;
 END;

CREATE TRIGGER IF NOT EXISTS cff_story_review_credit AFTER UPDATE ON story_reviews
 WHEN NEW.status='approved' AND OLD.status='pending' BEGIN
 INSERT INTO awards(award_key,user_key,username,type,source_id,points,day_key,month_key,created_at)
 VALUES(NEW.mention_key,NEW.user_key,NEW.username,'story',NEW.post_key,NEW.points,NEW.day_key,substr(NEW.day_key,1,7),NEW.event_at);
 INSERT INTO users(user_key,instagram_id,username,points_all,story_mentions_all,comments_all,active_days_all,last_interaction_at)
 VALUES(NEW.user_key,NEW.instagram_id,NEW.username,NEW.points,1,0,
 CASE WHEN EXISTS(SELECT 1 FROM active_days WHERE user_key=NEW.user_key AND day_key=NEW.day_key) THEN 0 ELSE 1 END,NEW.event_at)
 ON CONFLICT(user_key) DO UPDATE SET instagram_id=excluded.instagram_id,username=excluded.username,
 points_all=users.points_all+excluded.points_all,story_mentions_all=users.story_mentions_all+1,
 active_days_all=users.active_days_all+excluded.active_days_all,last_interaction_at=MAX(users.last_interaction_at,excluded.last_interaction_at);
 INSERT INTO monthly_users(month_key,user_key,username,points,story_mentions,comments,active_days,last_interaction_at)
 VALUES(substr(NEW.day_key,1,7),NEW.user_key,NEW.username,NEW.points,1,0,
 CASE WHEN EXISTS(SELECT 1 FROM active_days WHERE user_key=NEW.user_key AND day_key=NEW.day_key) THEN 0 ELSE 1 END,NEW.event_at)
 ON CONFLICT(month_key,user_key) DO UPDATE SET username=excluded.username,points=monthly_users.points+excluded.points,
 story_mentions=monthly_users.story_mentions+1,active_days=monthly_users.active_days+excluded.active_days,
 last_interaction_at=MAX(monthly_users.last_interaction_at,excluded.last_interaction_at);
 INSERT OR IGNORE INTO active_days(user_key,day_key) VALUES(NEW.user_key,NEW.day_key);
 INSERT INTO story_daily(user_key,day_key,count) VALUES(NEW.user_key,NEW.day_key,1)
 ON CONFLICT(user_key,day_key) DO UPDATE SET count=count+1;
 END;

-- Community profile result archive (does not award points).
CREATE TABLE IF NOT EXISTS community_prediction_outcomes (prediction_id TEXT PRIMARY KEY,payload TEXT NOT NULL,closes_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_users_username_profile ON users (lower(username),last_interaction_at DESC);

-- Resumo persistente dos meses: preenchimento único e manutenção por alteração.
CREATE INDEX IF NOT EXISTS idx_awards_month_day ON awards(month_key,day_key);

CREATE TABLE IF NOT EXISTS ranking_month_catalog(month_key TEXT PRIMARY KEY,first_day TEXT NOT NULL,last_day TEXT NOT NULL);

CREATE TRIGGER IF NOT EXISTS cff_month_catalog_insert AFTER INSERT ON awards BEGIN INSERT INTO ranking_month_catalog(month_key,first_day,last_day)
  VALUES(NEW.month_key,NEW.day_key,NEW.day_key)
  ON CONFLICT(month_key) DO UPDATE SET
    first_day=MIN(first_day,excluded.first_day),last_day=MAX(last_day,excluded.last_day); END;

CREATE TRIGGER IF NOT EXISTS cff_month_catalog_delete AFTER DELETE ON awards BEGIN UPDATE ranking_month_catalog SET
  first_day=COALESCE((SELECT day_key FROM awards WHERE month_key=OLD.month_key ORDER BY day_key LIMIT 1),''),
  last_day=COALESCE((SELECT day_key FROM awards WHERE month_key=OLD.month_key ORDER BY day_key DESC LIMIT 1),'')
  WHERE month_key=OLD.month_key AND (first_day=OLD.day_key OR last_day=OLD.day_key);
  DELETE FROM ranking_month_catalog WHERE month_key=OLD.month_key AND first_day=''; END;

CREATE TRIGGER IF NOT EXISTS cff_month_catalog_update AFTER UPDATE OF month_key,day_key ON awards
    WHEN OLD.month_key IS NOT NEW.month_key OR OLD.day_key IS NOT NEW.day_key
    BEGIN UPDATE ranking_month_catalog SET
  first_day=COALESCE((SELECT day_key FROM awards WHERE month_key=OLD.month_key ORDER BY day_key LIMIT 1),''),
  last_day=COALESCE((SELECT day_key FROM awards WHERE month_key=OLD.month_key ORDER BY day_key DESC LIMIT 1),'')
  WHERE month_key=OLD.month_key AND (first_day=OLD.day_key OR last_day=OLD.day_key);
  DELETE FROM ranking_month_catalog WHERE month_key=OLD.month_key AND first_day=''; INSERT INTO ranking_month_catalog(month_key,first_day,last_day)
  VALUES(NEW.month_key,NEW.day_key,NEW.day_key)
  ON CONFLICT(month_key) DO UPDATE SET
    first_day=MIN(first_day,excluded.first_day),last_day=MAX(last_day,excluded.last_day); END;

INSERT INTO ranking_month_catalog(month_key,first_day,last_day)
    SELECT month_key,MIN(day_key),MAX(day_key) FROM awards
    WHERE NOT EXISTS(SELECT 1 FROM community_period_versions WHERE period_key='migration:month-catalog-v1')
    GROUP BY month_key
    ON CONFLICT(month_key) DO UPDATE SET first_day=excluded.first_day,last_day=excluded.last_day;

INSERT OR IGNORE INTO community_period_versions(period_key,version) VALUES('migration:month-catalog-v1',1);
