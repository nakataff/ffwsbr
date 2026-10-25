// Public payloads only: session/user-specific prediction responses never enter this cache.
export const OPTIMIZATION_VERSION = '20261016-saved-months-v1';
const states = new WeakMap();
function state(db) {
  if (!states.has(db)) states.set(db, { cache: new Map(), pending: new Map() });
  return states.get(db);
}

export async function cachedPublic(db, key, ttl, load, revisionSql = '') {
  const local = state(db), now = Date.now();
  const hit = local.cache.get(key);
  if (hit?.expiresAt > now) return hit.payload;
  if (local.pending.has(key)) return local.pending.get(key);
  const job = (async () => {
    let row;
    try {
      row = await db.prepare('SELECT payload, expires_at FROM community_response_cache WHERE cache_key=?1').bind(key).first();
    } catch (_) {
      // A cache outage must not turn an otherwise readable ranking into an error.
      return load();
    }
    if (row?.expires_at > Date.now()) {
      try {
        const payload = JSON.parse(row.payload);
        remember(local, key, payload, row.expires_at);
        return payload;
      } catch (_) { /* Rebuild a malformed/old cache entry. */ }
    }
    const revision = revisionSql ? Number((await db.prepare(revisionSql).first())?.version || 0) : 0;
    const payload = await load();
    const expiresAt = Date.now() + ttl;
    try {
      const args = [key, JSON.stringify(payload), expiresAt];
      if (revisionSql) args.push(revision);
      const saved = await db.prepare(`INSERT INTO community_response_cache (cache_key,payload,expires_at)
        SELECT ?1,?2,?3 ${revisionSql ? `WHERE (${revisionSql})=?4` : ''}
        ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload, expires_at=excluded.expires_at`)
        .bind(...args).run();
      // A correction during the rebuild must not republish an invalidated history.
      if (revisionSql && !saved.meta?.changes) return payload;
    } catch (_) { /* Cache writes are optional; preserve the successful query result. */ }
    remember(local, key, payload, expiresAt);
    return payload;
  })().finally(() => local.pending.delete(key));
  local.pending.set(key, job);
  return job;
}

function remember(local, key, payload, expiresAt) {
  if (local.cache.size >= 128) local.cache.delete(local.cache.keys().next().value);
  // Recheck durable invalidation at least once a minute, even for long-lived history keys.
  local.cache.set(key, { payload, expiresAt: Math.min(expiresAt, Date.now() + 60_000) });
}

export async function periodVersion(db, key) {
  const row = await db.prepare('SELECT version FROM community_period_versions WHERE period_key=?1').bind(key).first();
  return Number(row?.version || 0);
}

// A late write invalidates snapshots in SQLite, including manual SQL corrections.
// Conditional publishing prevents a concurrent rebuild from restoring an invalid snapshot.
export async function savePeriodSnapshot(db, table, column, key, periodKey, version, payload) {
  if (!['weekly_ranking_snapshots','monthly_ranking_snapshots'].includes(table)) throw new Error('Invalid snapshot table');
  const result = await db.prepare(`INSERT OR IGNORE INTO ${table} (${column},payload,created_at)
    SELECT ?1,?2,?3 WHERE COALESCE((SELECT version FROM community_period_versions WHERE period_key=?4),0)=?5`)
    .bind(key, JSON.stringify(payload), Date.now(), periodKey, version).run();
  return Boolean(result.meta?.changes);
}

export async function settleOnce(db, jobKey, signature, work) {
  const row = await db.prepare('SELECT signature,status,lease_until FROM prediction_settlements WHERE job_key=?1').bind(jobKey).first();
  if (row?.status === 'done' && row.signature === signature) return;
  const now = Date.now(), token = crypto.randomUUID();
  const lock = await db.prepare(`INSERT INTO prediction_settlements (job_key,signature,status,lease_token,lease_until,completed_at)
    VALUES (?1,?2,'running',?3,?4,0)
    ON CONFLICT(job_key) DO UPDATE SET signature=excluded.signature,status='running',lease_token=excluded.lease_token,
      lease_until=excluded.lease_until,completed_at=0
    WHERE prediction_settlements.lease_until<=?5 AND
      (prediction_settlements.status<>'done' OR prediction_settlements.signature<>excluded.signature)`)
    .bind(jobKey, signature, token, now + 120_000, now).run();
  if (!lock.meta?.changes) {
    const saved = await db.prepare('SELECT signature,status FROM prediction_settlements WHERE job_key=?1').bind(jobKey).first();
    if (saved?.status === 'done' && saved.signature === signature) return;
    throw new Error('Prediction settlement already in progress');
  }
  try {
    await work();
    const done = await db.prepare(`UPDATE prediction_settlements SET status='done',lease_until=0,completed_at=?1
      WHERE job_key=?2 AND lease_token=?3`).bind(Date.now(), jobKey, token).run();
    if (!done.meta?.changes) throw new Error('Prediction settlement lease changed');
  } catch (error) {
    await db.prepare('DELETE FROM prediction_settlements WHERE job_key=?1 AND lease_token=?2').bind(jobKey, token).run();
    throw error;
  }
}

const monday = value => `date(${value}, '-' || ((CAST(strftime('%w',${value}) AS INTEGER)+6)%7) || ' days')`;
const currentMonday = monday("date('now','-3 hours')");
function invalidation(ref) {
  const week = monday(`${ref}.day_key`), month = `substr(${ref}.day_key,1,7)`;
  return `
    INSERT INTO community_period_versions(period_key,version) SELECT 'week:'||${week},1 WHERE ${week}<${currentMonday}
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    INSERT INTO community_period_versions(period_key,version) SELECT 'month:'||${month},1 WHERE ${month}<strftime('%Y-%m','now','-3 hours')
      ON CONFLICT(period_key) DO UPDATE SET version=version+1;
    DELETE FROM weekly_ranking_snapshots WHERE week_key=${week};
    DELETE FROM monthly_ranking_snapshots WHERE month_key=${month};
    DELETE FROM community_response_cache WHERE cache_key='ranking:week:'||${week} OR cache_key='ranking:month:'||${month}
      OR cache_key LIKE 'history:%' OR cache_key LIKE 'closed-weeks:%';`;
}
function trigger(table, operation, refs) {
  return `CREATE TRIGGER IF NOT EXISTS cff_history_${table}_${operation.toLowerCase()}
    AFTER ${operation} ON ${table}
    WHEN ${refs.map(ref => `(${ref}.day_key<${currentMonday} OR substr(${ref}.day_key,1,7)<strftime('%Y-%m','now','-3 hours'))`).join(' OR ')}
    BEGIN ${refs.map(invalidation).join('\n')} END`;
}

// One small row per recorded month. Boundary repairs seek the covering index;
// normal reads never have to rediscover months/dates by scanning the award ledger.
const addMonth = `INSERT INTO ranking_month_catalog(month_key,first_day,last_day)
  VALUES(NEW.month_key,NEW.day_key,NEW.day_key)
  ON CONFLICT(month_key) DO UPDATE SET
    first_day=MIN(first_day,excluded.first_day),last_day=MAX(last_day,excluded.last_day);`;
const repairMonth = `UPDATE ranking_month_catalog SET
  first_day=COALESCE((SELECT day_key FROM awards WHERE month_key=OLD.month_key ORDER BY day_key LIMIT 1),''),
  last_day=COALESCE((SELECT day_key FROM awards WHERE month_key=OLD.month_key ORDER BY day_key DESC LIMIT 1),'')
  WHERE month_key=OLD.month_key AND (first_day=OLD.day_key OR last_day=OLD.day_key);
  DELETE FROM ranking_month_catalog WHERE month_key=OLD.month_key AND first_day='';`;
export const MONTH_CATALOG_SCHEMA = [
  'CREATE INDEX IF NOT EXISTS idx_awards_month_day ON awards(month_key,day_key)',
  'CREATE TABLE IF NOT EXISTS ranking_month_catalog(month_key TEXT PRIMARY KEY,first_day TEXT NOT NULL,last_day TEXT NOT NULL)',
  `CREATE TRIGGER IF NOT EXISTS cff_month_catalog_insert AFTER INSERT ON awards BEGIN ${addMonth} END`,
  `CREATE TRIGGER IF NOT EXISTS cff_month_catalog_delete AFTER DELETE ON awards BEGIN ${repairMonth} END`,
  `CREATE TRIGGER IF NOT EXISTS cff_month_catalog_update AFTER UPDATE OF month_key,day_key ON awards
    WHEN OLD.month_key IS NOT NEW.month_key OR OLD.day_key IS NOT NEW.day_key
    BEGIN ${repairMonth} ${addMonth} END`,
  // This guard runs before reading awards. The backfill and marker are installed
  // in the same D1 batch transaction, so retries/cold starts do not rescan history.
  `INSERT INTO ranking_month_catalog(month_key,first_day,last_day)
    SELECT month_key,MIN(day_key),MAX(day_key) FROM awards
    WHERE NOT EXISTS(SELECT 1 FROM community_period_versions WHERE period_key='migration:month-catalog-v1')
    GROUP BY month_key
    ON CONFLICT(month_key) DO UPDATE SET first_day=excluded.first_day,last_day=excluded.last_day`,
  "INSERT OR IGNORE INTO community_period_versions(period_key,version) VALUES('migration:month-catalog-v1',1)",
];

export async function monthCoverage(db, monthKey) {
  return db.prepare('SELECT first_day AS firstDay,last_day AS lastDay FROM ranking_month_catalog WHERE month_key=?1')
    .bind(monthKey).first();
}

export const OPTIMIZATION_SCHEMA = [
  'CREATE TABLE IF NOT EXISTS community_response_cache (cache_key TEXT PRIMARY KEY,payload TEXT NOT NULL,expires_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS community_period_versions (period_key TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 0)',
  ...MONTH_CATALOG_SCHEMA,
  'CREATE TABLE IF NOT EXISTS weekly_ranking_snapshots (week_key TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS monthly_ranking_snapshots (month_key TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at INTEGER NOT NULL)',
  "CREATE TABLE IF NOT EXISTS prediction_settlements (job_key TEXT PRIMARY KEY,signature TEXT NOT NULL,status TEXT NOT NULL,lease_token TEXT NOT NULL,lease_until INTEGER NOT NULL,completed_at INTEGER NOT NULL DEFAULT 0)",
  ...['awards','active_days'].flatMap(table => [trigger(table,'INSERT',['NEW']),trigger(table,'UPDATE',['OLD','NEW']),trigger(table,'DELETE',['OLD'])]),
];

export async function invalidatePublicRankings(db){
 state(db).cache.clear();
 await db.prepare("DELETE FROM community_response_cache WHERE cache_key LIKE 'ranking:%' OR cache_key LIKE 'history:%' OR cache_key LIKE 'closed-weeks:%'").run();
}
