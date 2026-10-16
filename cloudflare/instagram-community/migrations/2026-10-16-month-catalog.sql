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
