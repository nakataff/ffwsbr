const RULES = Object.freeze({
  storyMentionPoints: 10,
  commentPoints: 2,
  storyMentionDailyLimit: 3,
  commentLimitPerMedia: 1,
});

const GRAPH_VERSION = 'v26.0';
const TIME_ZONE = 'America/Sao_Paulo';
const ALLOWED_ORIGINS = new Set([
  'https://centralfreefire.com.br',
  'https://www.centralfreefire.com.br',
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'Central Free Fire Instagram Community' }, 200, request);
    }

    if (url.pathname === '/webhook') {
      if (request.method === 'GET') return verifyWebhook(url, env);
      if (request.method === 'POST') return receiveWebhook(request, env);
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (url.pathname === '/api/ranking' && request.method === 'GET') {
      return getRanking(request, env, url);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    return json({ ok: false, error: 'Not found' }, 404, request);
  },
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.has(origin) || origin.startsWith('http://localhost:');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://centralfreefire.com.br',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(data, status = 200, request = null, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  };
  if (request) Object.assign(headers, corsHeaders(request));
  return new Response(JSON.stringify(data), { status, headers });
}

function normalizeTimestamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return Date.now();
  return n < 1_000_000_000_000 ? n * 1000 : n;
}

function dateKeys(timestamp = Date.now()) {
  const normalized = normalizeTimestamp(timestamp);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(normalized));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    monthKey: `${map.year}-${map.month}`,
    dayKey: `${map.year}-${map.month}-${map.day}`,
  };
}

function cleanUsername(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9._]/g, '')
    .slice(0, 64);
}

async function sha256(value) {
  const input = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function userKey(identity, username) {
  if (identity) return `ig_${String(identity).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}`;
  const digest = await sha256(String(username || '').toLowerCase());
  return `u_${digest.slice(0, 24)}`;
}

function fallbackUsername(identity) {
  const value = String(identity || 'usuario').replace(/[^a-zA-Z0-9]/g, '');
  return `usuario_${value.slice(-7) || 'ig'}`;
}

function verifyWebhook(url, env) {
  const mode = url.searchParams.get('hub.mode') || '';
  const token = url.searchParams.get('hub.verify_token') || '';
  const challenge = url.searchParams.get('hub.challenge') || '';

  if (!mode) {
    return json({ ok: true, service: 'Central Free Fire Instagram Webhook' });
  }

  if (mode === 'subscribe' && token && token === env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Webhook verification failed', { status: 403 });
}

async function validMetaSignature(rawBody, signature, appSecret) {
  if (!signature || !signature.startsWith('sha256=') || !appSecret) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, rawBody);
  const expected = 'sha256=' + [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return timingSafeStringEqual(expected, signature);
}

function timingSafeStringEqual(a, b) {
  const left = new TextEncoder().encode(String(a || ''));
  const right = new TextEncoder().encode(String(b || ''));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function receiveWebhook(request, env) {
  const rawBody = await request.arrayBuffer();
  const signature = request.headers.get('x-hub-signature-256') || '';

  if (!(await validMetaSignature(rawBody, signature, env.META_APP_SECRET))) {
    return new Response('Invalid signature', { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(new TextDecoder().decode(rawBody));
  } catch (_) {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!body || body.object !== 'instagram' || !Array.isArray(body.entry)) {
    return new Response('EVENT_RECEIVED', { status: 200 });
  }

  for (const entry of body.entry) {
    try {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change?.field === 'comments' && change.value) {
          await processComment(env, {
            field: change.field,
            value: change.value,
            time: entry.time,
          });
        } else {
          await logChangeShape(env, entry, change);
        }
      }

      if (entry?.field === 'comments' && entry.value) {
        await processComment(env, entry);
      }

      const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];
      for (const event of messaging) {
        const story = findStoryMention(event);
        if (story) await processStoryMention(env, event, story);
        else await logMessagingShape(env, event);
      }

      if (!changes.length && !messaging.length && entry?.field !== 'comments') {
        await logEntryShape(env, entry);
      }
    } catch (error) {
      console.error('Instagram event processing error', error);
    }
  }

  return new Response('EVENT_RECEIVED', { status: 200 });
}

async function processComment(env, entry) {
  const value = entry.value || {};
  const from = value.from || {};
  const media = value.media || {};
  const username = cleanUsername(from.username);
  const identity = String(from.id || username || '').trim();
  const mediaId = String(media.id || '').trim();
  const commentId = String(value.id || '').trim();

  if (!identity || (!mediaId && !commentId)) return;

  const key = await userKey(identity, username);
  const awardKey = `comment:${key}:${mediaId || commentId}`;
  await awardInteraction(env, {
    awardKey,
    userKey: key,
    identity,
    username: username || fallbackUsername(identity),
    type: 'comment',
    sourceId: mediaId || commentId,
    points: RULES.commentPoints,
    timestamp: normalizeTimestamp(entry.time),
  });
}

function findStoryMention(event) {
  const referral = event?.referral;
  if (referral && String(referral.source || '').toUpperCase() === 'STORY_MENTION') {
    return {
      storyId: String(referral?.story?.id || event?.message?.mid || event?.timestamp || ''),
      messageId: String(event?.message?.mid || ''),
    };
  }

  const message = event?.message || {};
  const attachments = Array.isArray(message.attachments)
    ? message.attachments
    : message.attachment
      ? [message.attachment]
      : [];

  const mention = attachments.find((item) =>
    ['story_mention', 'STORY_MENTION'].includes(String(item?.type || ''))
  );

  if (!mention) return null;
  const payload = mention.payload || {};
  return {
    storyId: String(payload.id || payload.story_id || message.mid || event.timestamp || ''),
    messageId: String(message.mid || ''),
  };
}

async function processStoryMention(env, event, story) {
  const identity = String(event?.sender?.id || '').trim();
  if (!identity) return;

  let username = cleanUsername(event?.sender?.username);
  if (!username && story.messageId) {
    username = await fetchMessageUsername(story.messageId, env.INSTAGRAM_ACCESS_TOKEN);
  }

  const timestamp = normalizeTimestamp(event.timestamp);
  const key = await userKey(identity, username);
  const { dayKey } = dateKeys(timestamp);

  const daily = await env.DB.prepare(
    'SELECT count FROM story_daily WHERE user_key = ?1 AND day_key = ?2'
  ).bind(key, dayKey).first();

  if (Number(daily?.count || 0) >= RULES.storyMentionDailyLimit) return;

  const awarded = await awardInteraction(env, {
    awardKey: `story:${key}:${story.storyId || story.messageId || timestamp}`,
    userKey: key,
    identity,
    username: username || fallbackUsername(identity),
    type: 'story',
    sourceId: story.storyId || story.messageId,
    points: RULES.storyMentionPoints,
    timestamp,
  });

  if (awarded) {
    await env.DB.prepare(`
      INSERT INTO story_daily (user_key, day_key, count)
      VALUES (?1, ?2, 1)
      ON CONFLICT(user_key, day_key) DO UPDATE SET count = count + 1
    `).bind(key, dayKey).run();
  }
}

async function fetchMessageUsername(messageId, accessToken) {
  if (!messageId || !accessToken) return '';
  try {
    const url = new URL(`https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(messageId)}`);
    url.searchParams.set('fields', 'id,from');
    url.searchParams.set('access_token', accessToken);
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!response.ok) return '';
    const data = await response.json();
    return cleanUsername(data?.from?.username);
  } catch (_) {
    return '';
  }
}

async function awardInteraction(env, event) {
  const { monthKey, dayKey } = dateKeys(event.timestamp);
  const now = Date.now();

  const inserted = await env.DB.prepare(`
    INSERT OR IGNORE INTO awards
      (award_key, user_key, username, type, source_id, points, day_key, month_key, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
  `).bind(
    event.awardKey,
    event.userKey,
    event.username,
    event.type,
    event.sourceId || '',
    event.points,
    dayKey,
    monthKey,
    now
  ).run();

  if (!inserted.meta?.changes) return false;

  const activeInsert = await env.DB.prepare(`
    INSERT OR IGNORE INTO active_days (user_key, day_key) VALUES (?1, ?2)
  `).bind(event.userKey, dayKey).run();
  const newDay = activeInsert.meta?.changes ? 1 : 0;
  const storyInc = event.type === 'story' ? 1 : 0;
  const commentInc = event.type === 'comment' ? 1 : 0;

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO users
        (user_key, instagram_id, username, points_all, story_mentions_all, comments_all, active_days_all, last_interaction_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      ON CONFLICT(user_key) DO UPDATE SET
        instagram_id = COALESCE(excluded.instagram_id, users.instagram_id),
        username = excluded.username,
        points_all = users.points_all + excluded.points_all,
        story_mentions_all = users.story_mentions_all + excluded.story_mentions_all,
        comments_all = users.comments_all + excluded.comments_all,
        active_days_all = users.active_days_all + excluded.active_days_all,
        last_interaction_at = MAX(users.last_interaction_at, excluded.last_interaction_at)
    `).bind(event.userKey, event.identity || null, event.username, event.points, storyInc, commentInc, newDay, event.timestamp),
    env.DB.prepare(`
      INSERT INTO monthly_users
        (month_key, user_key, username, points, story_mentions, comments, active_days, last_interaction_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      ON CONFLICT(month_key, user_key) DO UPDATE SET
        username = excluded.username,
        points = monthly_users.points + excluded.points,
        story_mentions = monthly_users.story_mentions + excluded.story_mentions,
        comments = monthly_users.comments + excluded.comments,
        active_days = monthly_users.active_days + excluded.active_days,
        last_interaction_at = MAX(monthly_users.last_interaction_at, excluded.last_interaction_at)
    `).bind(monthKey, event.userKey, event.username, event.points, storyInc, commentInc, newDay, event.timestamp),
  ]);

  return true;
}

async function getRanking(request, env, url) {
  const period = url.searchParams.get('period') === 'all' ? 'all' : 'month';
  const { monthKey } = dateKeys(Date.now());

  let result;
  if (period === 'all') {
    result = await env.DB.prepare(`
      SELECT user_key, username, points_all AS points,
             story_mentions_all AS storyMentions,
             comments_all AS comments,
             active_days_all AS activeDays,
             last_interaction_at AS lastInteractionAt
      FROM users
      ORDER BY points_all DESC, story_mentions_all DESC, comments_all DESC
      LIMIT 500
    `).all();
  } else {
    result = await env.DB.prepare(`
      SELECT user_key, username, points,
             story_mentions AS storyMentions,
             comments,
             active_days AS activeDays,
             last_interaction_at AS lastInteractionAt
      FROM monthly_users
      WHERE month_key = ?1
      ORDER BY points DESC, story_mentions DESC, comments DESC
      LIMIT 500
    `).bind(monthKey).all();
  }

  const users = {};
  let updatedAt = 0;
  for (const row of result.results || []) {
    users[row.user_key] = {
      username: row.username,
      points: Number(row.points || 0),
      storyMentions: Number(row.storyMentions || 0),
      comments: Number(row.comments || 0),
      activeDays: Number(row.activeDays || 0),
      lastInteractionAt: Number(row.lastInteractionAt || 0),
    };
    updatedAt = Math.max(updatedAt, Number(row.lastInteractionAt || 0));
  }

  return json(
    { updatedAt, rules: RULES, users },
    200,
    request,
    { 'Cache-Control': 'public, max-age=60' }
  );
}

async function logEntryShape(env, entry) {
  const summary = {
    entryKeys: Object.keys(entry || {}),
    hasChanges: Array.isArray(entry?.changes),
    changeFields: Array.isArray(entry?.changes)
      ? entry.changes.map((change) => String(change?.field || '')).filter(Boolean)
      : [],
    hasMessaging: Array.isArray(entry?.messaging),
    time: Number(entry?.time || 0),
  };

  await env.DB.prepare(
    'INSERT INTO raw_events (kind, payload, received_at) VALUES (?1, ?2, ?3)'
  ).bind('unrecognized_entry', JSON.stringify(summary), Date.now()).run();
}

async function logChangeShape(env, entry, change) {
  const value = change?.value || {};
  const summary = {
    field: String(change?.field || ''),
    valueKeys: Object.keys(value),
    fromKeys: Object.keys(value?.from || {}),
    mediaKeys: Object.keys(value?.media || {}),
    entryTime: Number(entry?.time || 0),
  };

  await env.DB.prepare(
    'INSERT INTO raw_events (kind, payload, received_at) VALUES (?1, ?2, ?3)'
  ).bind('unrecognized_change', JSON.stringify(summary), Date.now()).run();
}

async function logMessagingShape(env, event) {
  const message = event?.message || {};
  const attachments = Array.isArray(message.attachments)
    ? message.attachments
    : message.attachment
      ? [message.attachment]
      : [];

  const summary = {
    eventKeys: Object.keys(event || {}),
    messageKeys: Object.keys(message || {}),
    attachmentTypes: attachments.map((a) => String(a?.type || '')).filter(Boolean),
    hasReferral: Boolean(event?.referral),
    referralSource: String(event?.referral?.source || ''),
    referralType: String(event?.referral?.type || ''),
    messageId: String(message?.mid || ''),
    timestamp: Number(event?.timestamp || 0),
  };

  await env.DB.prepare(
    'INSERT INTO raw_events (kind, payload, received_at) VALUES (?1, ?2, ?3)'
  ).bind('unrecognized_message', JSON.stringify(summary), Date.now()).run();
}
