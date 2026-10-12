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
