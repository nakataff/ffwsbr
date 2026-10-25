import {PROFILE_INSIGHTS_VERSION,PROFILE_INSIGHTS_SCHEMA,cleanHandle,captureOutcomes,profileInsights,peerScores} from './profile-insights.js';
import { STORY_REVIEW_VERSION, STORY_REVIEW_SCHEMA, queueStory, reviewStory, autoApproveStory, instagramPost } from './story-reviews.js';
import {STORY_PREVIEW_SCHEMA,storeStoryPreview,purgeExpiredStoryPreviews,previewLink,getSignedStoryPreview} from './story-previews.js';
import { OPTIMIZATION_VERSION, OPTIMIZATION_SCHEMA, cachedPublic, invalidatePublicRankings, monthCoverage, periodVersion, savePeriodSnapshot, settleOnce } from './optimizations.js';
const RULES = Object.freeze({
  storyMentionPoints: 5,
  storyApprovalRequired: false,
  storyAutoApproval: true,
  storyCurrentWeekOnly: false,
  storyLimitPerPost: null,
  storyLimitPerStory: 1,
  commentPoints: 2,
  checkinPoints: 1,
  storyMentionDailyLimit: 3,
  commentLimitPerMedia: 1,
  commentMediaMaxAgeDays: 7,
  ffwsPredictionParticipationPoints: 1,
  ffwsPredictionNearestPoints: 5,
  ffwsPredictionComboPoints: 3,
  ffwsPredictionMvpNearestPoints: 5,
  streak3Points: 3,
  streak5Points: 7,
  streak7Points: 15,
  posts5Points: 5,
  posts10Points: 5,
  completeMixPoints: 5,
  fastCommentPoints: 1,
  fastCommentMinutes: 20,
  googleAccountPoints: 20,
});

const GRAPH_VERSION = 'v26.0';
const TIME_ZONE = 'America/Sao_Paulo';
const CHECKIN_CODE_TTL_MS = 15 * 60 * 1000;
const SITE_BASE = 'https://centralfreefire.com.br/';
const FIREBASE_BASE = 'https://central-free-fire-default-rtdb.firebaseio.com';
const FIREBASE_WEB_API_KEY = 'AIzaSyAePlDtXqjyyyJRCxnveoh1B6ZzqnyRknE';
const ADMIN_EMAIL = 'admin@centralfreefire.com.br';
const PREDICTION_URL = `${FIREBASE_BASE}/ffwsLive/communityPrediction.json`;
const REWARDS_URL = `${FIREBASE_BASE}/ffwsLive/communityRewards.json`;
const LIVE_SECOND_URL = `${FIREBASE_BASE}/ffwsLive/2026-s2/segundaFase.json`;
const DATES_URL = `${SITE_BASE}ffws-br-2026-s2/dates.json`;
const LOGOS_URL = `${SITE_BASE}team-data/logo-map.json`;
const PLAYERS_URL = `${SITE_BASE}ffws-br-2026-s2/players.json`;
const ACTIVE_TYPES = new Set(['comment', 'story', 'checkin', 'prediction_vote', 'bonus_code']);
const SECOND_PHASE_TEAMS = Object.freeze([
  'LOS','LOUD SNICKERS','FLUXO W7M','INTZ','TEAM SOLID','RISE GAMING',
  'ALPHA7','RUSH GAMING','INFLUENCE RAGE','CPT VOX','AFROGAMES','SX TET'
]);
const FALLBACK_SECOND_DATES = Object.freeze([
  { round:1,date:'2026-09-19',time24:'13:00' },{ round:2,date:'2026-09-20',time24:'13:00' },
  { round:3,date:'2026-09-26',time24:'13:00' },{ round:4,date:'2026-09-27',time24:'13:00' },
  { round:5,date:'2026-10-03',time24:'13:00' },{ round:6,date:'2026-10-04',time24:'13:00' }
]);
const DEFAULT_MISSION = Object.freeze({
  active: true,
  label: 'Missão semanal',
  commentsTarget: 3,
  checkinsTarget: 2,
  storiesTarget: 1,
  points: 10,
});
const ALLOWED_ORIGINS = new Set([
  'https://centralfreefire.com.br',
  'https://www.centralfreefire.com.br',
]);

let rewardsCache = { at: 0, data: null };
let predictionSettlementSweep = { at: 0, signature: '', pending: null };
const RANKING_CACHE_TTL_MS = 300_000;
let performanceIndexesReady = false;
let performanceIndexesPromise = null;

const PERFORMANCE_INDEXES = Object.freeze([
  ...OPTIMIZATION_SCHEMA,
  ...PROFILE_INSIGHTS_SCHEMA,
  ...STORY_REVIEW_SCHEMA,
  ...STORY_PREVIEW_SCHEMA,
  'CREATE TABLE IF NOT EXISTS monthly_ranking_snapshots (month_key TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS idx_awards_created_at ON awards (created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_awards_type_award_key ON awards (type, award_key)',
  'CREATE INDEX IF NOT EXISTS idx_awards_user_day_type ON awards (user_key, day_key, type)',
  'CREATE INDEX IF NOT EXISTS idx_awards_type_day_user ON awards (type, day_key, user_key)',
  'CREATE INDEX IF NOT EXISTS idx_awards_type_month_user ON awards (type, month_key, user_key)',
  'CREATE INDEX IF NOT EXISTS idx_awards_user_type_created ON awards (user_key, type, created_at)',
  'CREATE INDEX IF NOT EXISTS idx_awards_day_user_type ON awards (day_key, user_key, type)',
  'CREATE INDEX IF NOT EXISTS idx_active_days_day_user ON active_days (day_key, user_key)',
  'CREATE INDEX IF NOT EXISTS idx_monthly_points ON monthly_users (month_key, points DESC)',
  'CREATE INDEX IF NOT EXISTS idx_users_points ON users (points_all DESC)',
  'CREATE INDEX IF NOT EXISTS idx_users_username_nocase ON users (username COLLATE NOCASE)',
]);

export default {
  async scheduled(controller,env,ctx){ctx.waitUntil((async()=>{if(await ensurePerformanceIndexes(env))await purgeExpiredStoryPreviews(env.DB);})());},
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
    if (url.pathname === '/health') return json({ ok: true, service: 'Central Free Fire Instagram Community', version: OPTIMIZATION_VERSION, storyReviewVersion: STORY_REVIEW_VERSION, profileInsightsVersion: PROFILE_INSIGHTS_VERSION }, 200, request);

    if (url.pathname.startsWith('/api/') || (url.pathname === '/webhook' && request.method === 'POST')) {
      if (!(await ensurePerformanceIndexes(env))) return json({ok:false,error:"Serviço temporariamente indisponível."},503,request);
    }

    if (url.pathname === '/webhook') {
      if (request.method === 'GET') return verifyWebhook(url, env);
      if (request.method === 'POST') return receiveWebhook(request, env, ctx);
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (url.pathname === '/api/ranking' && request.method === 'GET') return publicRankingResponse(request, env, url);
    if (url.pathname === '/api/ranking/history' && request.method === 'GET') return getWeeklyHistory(request, env, url);
    if (url.pathname === '/api/ranking/months' && request.method === 'GET') return getMonthlyHistory(request, env, url);
    if (url.pathname === '/api/community/profile' && request.method === 'GET') return getCommunityProfile(request,env,url);
    if (url.pathname === '/api/community/peers' && request.method === 'GET') return getCommunityPeers(request,env,url);
    if (url.pathname === '/api/achievements/profile' && request.method === 'GET') return getAchievementProfile(request, env, url);
    if (url.pathname === '/api/predictions' && request.method === 'GET') return getPredictions(request, env, url, ctx);
    if (url.pathname === '/api/prediction' && request.method === 'GET') return getPredictionLegacy(request, env, url, ctx);
    if (url.pathname === '/api/prediction/vote' && request.method === 'POST') return votePrediction(request, env, ctx);
    if (url.pathname === '/api/prediction/ranking' && request.method === 'GET') return getPredictionRanking(request, env, url);
    if (url.pathname === '/api/prediction/profile' && request.method === 'GET') return getPredictionProfile(request, env, url);
    if (url.pathname === '/api/admin/stories' && request.method === 'GET') return getAdminStories(request,env,url);
    if (url.pathname === '/api/admin/story-preview' && request.method === 'GET') return getSignedStoryPreview(request,env,url);
    if (url.pathname === '/api/admin/story-posts' && request.method === 'GET') return getAdminStoryPosts(request,env,url);
    if (url.pathname === '/api/admin/stories/review-batch' && request.method === 'POST') return reviewAdminStoryBatch(request,env);
    if (url.pathname === '/api/admin/stories/review' && request.method === 'POST') return reviewAdminStory(request,env);
    if (url.pathname === '/api/admin/prediction-votes' && request.method === 'GET') return getAdminPredictionVotes(request, env);
    if (url.pathname === '/api/rewards/status' && request.method === 'GET') return getRewardStatus(request, env, url);
    if (url.pathname === '/api/rewards/code' && request.method === 'POST') return claimRewardCode(request, env);
    if (url.pathname === '/api/account/google-bonus' && request.method === 'POST') return claimGoogleAccountBonus(request, env);
    if (url.pathname === '/api/checkin/start' && request.method === 'POST') return startCheckin(request, env);
    if (url.pathname === '/api/checkin/status' && request.method === 'GET') return checkinStatus(request, env, url);
    if (url.pathname === '/api/checkin' && request.method === 'POST') return doCheckin(request, env);

    return json({ ok: false, error: 'Not found' }, 404, request);
  },
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.has(origin) || origin.startsWith('http://localhost:');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://centralfreefire.com.br',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function json(data, status = 200, request = null, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders };
  if (request) Object.assign(headers, corsHeaders(request));
  return new Response(JSON.stringify(data), { status, headers });
}

async function ensurePerformanceIndexes(env) {
  if (performanceIndexesReady) return true;
  if (!performanceIndexesPromise) {
    performanceIndexesPromise = (async () => {
      // Cold instances only check one durable marker. Apply the additive schema
      // once per release, including its backfill, in a single atomic D1 batch.
      const schemaKey = 'schema:' + OPTIMIZATION_VERSION + ':' + STORY_REVIEW_VERSION + ':story-previews-v1';
      let applied;
      try {
        applied = await env.DB.prepare('SELECT version FROM community_period_versions WHERE period_key=?1')
          .bind(schemaKey).first();
      } catch (_) { /* The very first deployment may not have the marker table. */ }
      if (!applied?.version) {
        await env.DB.batch([
          ...PERFORMANCE_INDEXES.map((sql) => env.DB.prepare(sql)),
          env.DB.prepare('INSERT OR IGNORE INTO community_period_versions(period_key,version) VALUES(?1,1)').bind(schemaKey),
        ]);
      }
      performanceIndexesReady = true;
      return true;
    })().catch((error) => {
      performanceIndexesPromise = null;
      console.error('D1 performance indexes could not be ensured', error);
      return false;
    });
  }
  return performanceIndexesPromise;
}

async function readJson(request) {
  try { return await request.json(); } catch (_) { return {}; }
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
  return { monthKey: `${map.year}-${map.month}`, dayKey: `${map.year}-${map.month}-${map.day}` };
}

function shiftDayKey(dayKey, days) {
  const [year, month, day] = String(dayKey || '').split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Number(days || 0), 12));
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
}

function weekKeys(timestamp = Date.now()) {
  const { dayKey } = dateKeys(timestamp);
  const [year, month, day] = dayKey.split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day, 12));
  const mondayOffset = (calendar.getUTCDay() + 6) % 7;
  const weekStartKey = shiftDayKey(dayKey, -mondayOffset);
  return { weekKey: weekStartKey, weekStartKey, weekEndKey: shiftDayKey(weekStartKey, 6) };
}

function dayKeyTimestamp(dayKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dayKey || ''))) return null;
  const [year, month, day] = String(dayKey).split('-').map(Number);
  const value = Date.UTC(year, month - 1, day, 15, 0, 0);
  return Number.isFinite(value) ? value : null;
}

function validMonthKey(value) {
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(String(value || ''));
}

function monthKeyBounds(monthKey) {
  if (!validMonthKey(monthKey)) return null;
  const [year, month] = monthKey.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0, 12));
  return {
    monthKey,
    firstDay: `${monthKey}-01`,
    lastDay: `${monthKey}-${String(last.getUTCDate()).padStart(2, '0')}`,
  };
}

function saoPauloTimestamp(date, time = '13:00') {
  const cleanDate = String(date || '').trim();
  const cleanTime = /^\d{2}:\d{2}$/.test(String(time || '')) ? time : '13:00';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return 0;
  const n = Date.parse(`${cleanDate}T${cleanTime}:00-03:00`);
  return Number.isFinite(n) ? n : 0;
}

function cleanUsername(value) {
  return String(value || '').trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9._]/g, '').slice(0, 64);
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

function randomToken(bytes = 24) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return [...data].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomCheckinCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const data = new Uint8Array(6);
  crypto.getRandomValues(data);
  return `NKT-${[...data].map((b) => chars[b % chars.length]).join('')}`;
}

function verifyWebhook(url, env) {
  const mode = url.searchParams.get('hub.mode') || '';
  const token = url.searchParams.get('hub.verify_token') || '';
  const challenge = url.searchParams.get('hub.challenge') || '';
  if (!mode) return json({ ok: true, service: 'Central Free Fire Instagram Webhook' });
  if (mode === 'subscribe' && token && token === env.META_WEBHOOK_VERIFY_TOKEN) return new Response(challenge, { status: 200 });
  return new Response('Webhook verification failed', { status: 403 });
}

async function validMetaSignature(rawBody, signature, appSecret) {
  if (!signature || !signature.startsWith('sha256=') || !appSecret) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
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

async function receiveWebhook(request, env, ctx) {
  const rawBody = await request.arrayBuffer();
  const signature = request.headers.get('x-hub-signature-256') || '';
  if (!(await validMetaSignature(rawBody, signature, env.META_APP_SECRET))) return new Response('Invalid signature', { status: 401 });

  let body;
  try { body = JSON.parse(new TextDecoder().decode(rawBody)); }
  catch (_) { return new Response('Invalid JSON', { status: 400 }); }

  if (!body || body.object !== 'instagram' || !Array.isArray(body.entry)) return new Response('EVENT_RECEIVED', { status: 200 });

  let processingFailed=false;
  for (const entry of body.entry) {
    try {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change?.field === 'comments' && change.value) await processComment(env, { field: change.field, value: change.value, time: entry.time });
        else await logChangeShape(env, entry, change);
      }

      if (entry?.field === 'comments' && entry.value) await processComment(env, entry);

      const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];
      for (const event of messaging) {
        if (await processCheckinVerification(env, event)) continue;
        const story = findStoryMention(event);
        if (story) await processStoryMention(env, event, {...story,accountId:String(event?.recipient?.id||entry.id||'')},ctx);
        else await logMessagingShape(env, event);
      }

      if (!changes.length && !messaging.length && entry?.field !== 'comments') await logEntryShape(env, entry);
    } catch (error) {
      processingFailed=true;
      console.error('Instagram event processing error', error);
    }
  }

  return new Response(processingFailed?'RETRY':'EVENT_RECEIVED', { status: processingFailed?503:200 });
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

  const timestamp = normalizeTimestamp(entry.time);

  // O ranking premia interação recorrente com conteúdo recente.
  // Comentários em posts/Reels com mais de 7 dias não geram pontos.
  // Se não for possível confirmar a data da mídia, não pontua (fail closed)
  // para evitar que uma falha de consulta vire brecha de farm.
  if (mediaId) {
    const inlinePublishedAt = Date.parse(String(media.timestamp || media.created_time || ''));
    const publishedAt = Number.isFinite(inlinePublishedAt)
      ? inlinePublishedAt
      : await fetchMediaTimestamp(mediaId, env.INSTAGRAM_ACCESS_TOKEN);
    const maxAgeMs = RULES.commentMediaMaxAgeDays * 24 * 60 * 60 * 1000;
    const ageMs = publishedAt ? timestamp - publishedAt : Number.POSITIVE_INFINITY;
    if (!publishedAt || ageMs < -5 * 60 * 1000 || ageMs > maxAgeMs) {
      try {
        await env.DB.prepare('INSERT INTO raw_events (kind, payload, received_at) VALUES (?1, ?2, ?3)')
          .bind('comment_rejected_media_age', JSON.stringify({
            mediaId,
            commentId,
            username: username || fallbackUsername(identity),
            eventAt: timestamp,
            mediaPublishedAt: publishedAt || 0,
            maxAgeDays: RULES.commentMediaMaxAgeDays,
          }), Date.now()).run();
      } catch (_) {}
      return;
    }
  } else {
    // Sem mediaId não é possível validar a idade da publicação.
    return;
  }

  const key = await userKey(identity, username);
  const awarded = await awardInteraction(env, {
    awardKey: `comment:${key}:${mediaId || commentId}`,
    userKey: key,
    identity,
    username: username || fallbackUsername(identity),
    type: 'comment',
    sourceId: mediaId || commentId,
    points: RULES.commentPoints,
    timestamp,
  });

  if (awarded && mediaId) await maybeAwardFastComment(env, {
    userKey: key,
    identity,
    username: username || fallbackUsername(identity),
    mediaId,
    timestamp,
  });
}

function findStoryMention(event) {
  const referral = event?.referral;
  if (referral && String(referral.source || '').toUpperCase() === 'STORY_MENTION') {
    return {
      storyId: String(referral?.story?.id || event?.message?.mid || event?.timestamp || ''),
      messageId: String(event?.message?.mid || ''),
      mediaUrl: String(referral?.story?.url || ''),
    };
  }

  const message = event?.message || {};
  const attachments = Array.isArray(message.attachments) ? message.attachments : message.attachment ? [message.attachment] : [];
  const mention = attachments.find((item) => ['story_mention', 'STORY_MENTION'].includes(String(item?.type || '')));
  if (!mention) return null;
  const payload = mention.payload || {};
  return {
    storyId: String(payload.id || payload.story_id || message.mid || event.timestamp || ''),
    messageId: String(message.mid || ''),
    mediaUrl: String(payload.url || ''),
  };
}

async function processStoryMention(env, event, story, ctx) {
  const identity=String(event?.sender?.id||'').trim();if(!identity||!story.storyId)return;
  const timestamp=Number(event.timestamp);if(!Number.isFinite(timestamp)||timestamp<=0)return;
  const eventAt=normalizeTimestamp(timestamp);if(eventAt>Date.now()+300000)return;
  let username=cleanUsername(event?.sender?.username);
  const key=await userKey(identity,username),mentionKey=`story:${key}:${story.storyId}`;
  const known=await env.DB.prepare('SELECT * FROM story_reviews WHERE mention_key=?1').bind(mentionKey).first();if(known){if(known.status==='pending'){const result=await autoApproveStory(env.DB,mentionKey);if(result.error)throw Error(result.error);await finishStoryReviews(env,[result]);if(result.row?.status==='approved'&&result.row.media_url)ctx?.waitUntil(storeStoryPreview(env,result.row));}return;}
  if(!username&&story.messageId)username=await fetchMessageUsername(story.messageId,env.INSTAGRAM_ACCESS_TOKEN);
  if(!username){const user=await env.DB.prepare('SELECT username FROM users WHERE user_key=?1').bind(key).first();username=cleanUsername(user?.username)}
  const {dayKey}=dateKeys(eventAt),{weekStartKey}=weekKeys(eventAt);
  await queueStory(env.DB,{key:mentionKey,userKey:key,identity,username:username||fallbackUsername(identity),accountId:story.accountId,
    storyId:story.storyId,messageId:story.messageId,mediaUrl:story.mediaUrl,timestamp:eventAt,dayKey,weekKey:weekStartKey});
  const result=await autoApproveStory(env.DB,mentionKey);if(result.error)throw Error(result.error);await finishStoryReviews(env,[result]);
  if(result.row?.status==='approved'&&result.row.media_url)ctx?.waitUntil(storeStoryPreview(env,result.row));
}

async function fetchInstagramGraphJson(objectId, fields, accessToken, signal) {
  if (!objectId || !accessToken) return null;
  const bases = ['https://graph.instagram.com', 'https://graph.facebook.com'];
  for (const base of bases) {
    try {
      const url = new URL(`${base}/${GRAPH_VERSION}/${encodeURIComponent(objectId)}`);
      url.searchParams.set('fields', fields);
      url.searchParams.set('access_token', accessToken);
      const response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, ...(signal?{signal}:{}) });
      if (!response.ok) continue;
      const data = await response.json();
      if (data && !data.error) return data;
    } catch (_) {}
  }
  return null;
}

async function diagnoseMetaRequest(base, objectId, fields, accessToken) {
  const result = {
    base: base.includes('facebook.com') ? 'facebook' : 'instagram',
    status: 0,
    ok: false,
    username: '',
    error: null,
  };
  if (!objectId || !accessToken) {
    result.error = { message: !objectId ? 'missing_object_id' : 'missing_access_token' };
    return result;
  }
  try {
    const url = new URL(`${base}/${GRAPH_VERSION}/${encodeURIComponent(objectId)}`);
    url.searchParams.set('fields', fields);
    url.searchParams.set('access_token', accessToken);
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    result.status = response.status;
    let data = null;
    try { data = await response.json(); } catch (_) {}
    result.ok = Boolean(response.ok && data && !data.error);
    result.username = cleanUsername(data?.username || data?.from?.username);
    if (data?.error) {
      result.error = {
        message: String(data.error.message || '').slice(0, 220),
        type: String(data.error.type || '').slice(0, 80),
        code: Number(data.error.code || 0) || 0,
        subcode: Number(data.error.error_subcode || 0) || 0,
      };
    } else if (!response.ok) {
      result.error = { message: `HTTP ${response.status}` };
    }
  } catch (error) {
    result.error = { message: String(error?.message || error || 'fetch_failed').slice(0, 220) };
  }
  return result;
}

async function buildCheckinDiagnostic(identity, messageId, accessToken) {
  const identityAttempts = [];
  for (const base of ['https://graph.instagram.com', 'https://graph.facebook.com']) {
    identityAttempts.push(await diagnoseMetaRequest(base, identity, 'id,name,username', accessToken));
  }
  const messageAttempts = [];
  if (messageId) {
    for (const base of ['https://graph.instagram.com', 'https://graph.facebook.com']) {
      messageAttempts.push(await diagnoseMetaRequest(base, messageId, 'id,from', accessToken));
    }
  }
  return {
    senderIdSuffix: String(identity || '').slice(-8),
    senderIdLength: String(identity || '').length,
    identity: identityAttempts,
    message: messageAttempts,
    at: Date.now(),
  };
}

async function saveCheckinDiagnostic(env, diagnostic, sessionId = '') {
  try {
    const payload = JSON.stringify({ sessionId: String(sessionId || '').slice(0, 64), ...diagnostic });
    await env.DB.prepare('INSERT INTO raw_events (kind, payload, received_at) VALUES (?1, ?2, ?3)')
      .bind('checkin_debug', payload, Date.now()).run();
  } catch (_) {}
}

async function fetchMessageUsername(messageId, accessToken) {
  const data = await fetchInstagramGraphJson(messageId, 'id,from', accessToken);
  return cleanUsername(data?.from?.username);
}

async function fetchInstagramUsername(identity, accessToken) {
  const data = await fetchInstagramGraphJson(identity, 'id,name,username', accessToken);
  return cleanUsername(data?.username);
}
async function fetchMediaTimestamp(mediaId, accessToken) {
  if (!mediaId || !accessToken) return 0;
  const data = await fetchInstagramGraphJson(mediaId, 'timestamp', accessToken);
  const value = Date.parse(String(data?.timestamp || ''));
  return Number.isFinite(value) ? value : 0;
}

async function maybeAwardFastComment(env, event) {
  const { dayKey } = dateKeys(event.timestamp);
  const awardKey = `bonus-fast:${event.userKey}:${dayKey}`;
  const existing = await env.DB.prepare('SELECT 1 AS found FROM awards WHERE award_key = ?1 LIMIT 1').bind(awardKey).first();
  if (existing?.found) return false;

  const publishedAt = await fetchMediaTimestamp(event.mediaId, env.INSTAGRAM_ACCESS_TOKEN);
  if (!publishedAt) return false;
  const diff = Number(event.timestamp) - publishedAt;
  if (diff < 0 || diff > RULES.fastCommentMinutes * 60 * 1000) return false;

  return awardInteraction(env, {
    awardKey,
    userKey: event.userKey,
    identity: event.identity || '',
    username: event.username || 'usuario',
    type: 'bonus_flash',
    sourceId: event.mediaId,
    points: RULES.fastCommentPoints,
    timestamp: event.timestamp,
  });
}

async function processCheckinVerification(env, event) {
  const message = event?.message || {};
  if (message?.is_echo) return false;
  const text = String(message?.text || '').trim().toUpperCase();
  const match = text.match(/\bNKT-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}\b/);
  if (!match) return false;

  const now = Date.now();
  const pending = await env.DB.prepare(`
    SELECT session_id
    FROM checkin_sessions
    WHERE code = ?1 AND verified_at IS NULL AND expires_at >= ?2
    LIMIT 1
  `).bind(match[0], now).first();
  if (!pending?.session_id) return false;

  const identity = String(event?.sender?.id || '').trim();
  if (!identity) return false;

  let username = cleanUsername(event?.sender?.username);
  const messageId = String(message?.mid || '');

  // 1) Alguns webhooks não trazem sender.username. Tenta recuperar pelo ID da mensagem.
  if (!username && messageId) username = await fetchMessageUsername(messageId, env.INSTAGRAM_ACCESS_TOKEN);

  // 2) Se a mensagem também não devolver o @, consulta diretamente o Instagram-scoped ID do remetente.
  if (!username) username = await fetchInstagramUsername(identity, env.INSTAGRAM_ACCESS_TOKEN);

  const key = await userKey(identity, username);

  // 3) Último fallback: reaproveita um @ real já conhecido para este mesmo Instagram ID.
  if (!username) {
    const knownAward = await env.DB.prepare(`
      SELECT username
      FROM awards
      WHERE user_key = ?1
        AND username IS NOT NULL
        AND username != ''
        AND username NOT LIKE 'usuario_%'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(key).first();
    username = cleanUsername(knownAward?.username);
  }

  if (!username) {
    const knownSession = await env.DB.prepare(`
      SELECT username
      FROM checkin_sessions
      WHERE instagram_id = ?1
        AND username IS NOT NULL
        AND username != ''
        AND username NOT LIKE 'usuario_%'
      ORDER BY verified_at DESC
      LIMIT 1
    `).bind(identity).first();
    username = cleanUsername(knownSession?.username);
  }

  if (!username) {
    const diagnostic = await buildCheckinDiagnostic(identity, messageId, env.INSTAGRAM_ACCESS_TOKEN);
    await saveCheckinDiagnostic(env, diagnostic, pending.session_id);
    console.log('[checkin-debug]', JSON.stringify(diagnostic));
  }

  const result = await env.DB.prepare(`
    UPDATE checkin_sessions
    SET user_key = ?1, instagram_id = ?2, username = ?3, verified_at = ?4, expires_at = 0
    WHERE session_id = ?5 AND verified_at IS NULL
  `).bind(key, identity, username || fallbackUsername(identity), now, pending.session_id).run();
  return Boolean(result.meta?.changes);
}

async function startCheckin(request, env) {
  const now = Date.now();
  await env.DB.prepare('DELETE FROM checkin_sessions WHERE verified_at IS NULL AND expires_at < ?1').bind(now - 60_000).run();

  for (let attempt = 0; attempt < 6; attempt++) {
    const sessionId = randomToken(24);
    const code = randomCheckinCode();
    const expiresAt = now + CHECKIN_CODE_TTL_MS;
    const inserted = await env.DB.prepare(`
      INSERT OR IGNORE INTO checkin_sessions (session_id, code, expires_at, created_at, last_used_at)
      VALUES (?1, ?2, ?3, ?4, 0)
    `).bind(sessionId, code, expiresAt, now).run();

    if (inserted.meta?.changes) {
      return json({ ok: true, status: 'pending', session: sessionId, code, expiresAt, instagram: '@nakataff', checkinPoints: RULES.checkinPoints }, 200, request);
    }
  }

  return json({ ok: false, error: 'Não foi possível gerar o código agora.' }, 503, request);
}

async function getCheckinSession(env, sessionId) {
  if (!sessionId || !/^[a-f0-9]{48}$/i.test(sessionId)) return null;
  return env.DB.prepare(`
    SELECT session_id, code, user_key, instagram_id, username, verified_at, expires_at, created_at, last_used_at
    FROM checkin_sessions
    WHERE session_id = ?1
  `).bind(sessionId).first();
}

async function checkinStatus(request, env, url) {
  const sessionId = String(url.searchParams.get('session') || '').trim();
  const row = await getCheckinSession(env, sessionId);
  if (!row) return json({ ok: false, status: 'missing' }, 404, request);

  const now = Date.now();
  if (!row.verified_at && Number(row.expires_at || 0) < now) return json({ ok: true, status: 'expired' }, 200, request);
  if (!row.verified_at || !row.user_key) {
    return json({ ok: true, status: 'pending', code: row.code, expiresAt: Number(row.expires_at || 0), checkinPoints: RULES.checkinPoints }, 200, request);
  }

  let resolvedUsername = cleanUsername(row.username);
  if ((!resolvedUsername || /^usuario_/i.test(resolvedUsername)) && row.instagram_id) {
    resolvedUsername = await fetchInstagramUsername(row.instagram_id, env.INSTAGRAM_ACCESS_TOKEN);

    if (!resolvedUsername && row.user_key) {
      const knownAward = await env.DB.prepare(`
        SELECT username
        FROM awards
        WHERE user_key = ?1
          AND username IS NOT NULL
          AND username != ''
          AND username NOT LIKE 'usuario_%'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(row.user_key).first();
      resolvedUsername = cleanUsername(knownAward?.username);
    }

    if (!resolvedUsername && row.instagram_id) {
      const knownSession = await env.DB.prepare(`
        SELECT username
        FROM checkin_sessions
        WHERE instagram_id = ?1
          AND username IS NOT NULL
          AND username != ''
          AND username NOT LIKE 'usuario_%'
        ORDER BY verified_at DESC
        LIMIT 1
      `).bind(row.instagram_id).first();
      resolvedUsername = cleanUsername(knownSession?.username);
    }

    if (resolvedUsername) {
      await env.DB.prepare('UPDATE checkin_sessions SET username = ?1 WHERE session_id = ?2').bind(resolvedUsername, sessionId).run();
      if (row.user_key) {
        await env.DB.prepare("UPDATE users SET username = ?1 WHERE user_key = ?2 AND (username = '' OR username LIKE 'usuario_%')").bind(resolvedUsername, row.user_key).run();
        await env.DB.prepare("UPDATE monthly_users SET username = ?1 WHERE user_key = ?2 AND (username = '' OR username LIKE 'usuario_%')").bind(resolvedUsername, row.user_key).run();
        await env.DB.prepare("UPDATE awards SET username = ?1 WHERE user_key = ?2 AND (username = '' OR username LIKE 'usuario_%')").bind(resolvedUsername, row.user_key).run();
      }
    }
  }

  let debug = null;
  if (!resolvedUsername || /^usuario_/i.test(resolvedUsername)) {
    debug = await buildCheckinDiagnostic(row.instagram_id, '', env.INSTAGRAM_ACCESS_TOKEN);
    await saveCheckinDiagnostic(env, debug, sessionId);
  }

  const { dayKey } = dateKeys(now);
  const awardKey = `checkin:${row.user_key}:${dayKey}`;
  const award = await env.DB.prepare('SELECT 1 AS found FROM awards WHERE award_key = ?1 LIMIT 1').bind(awardKey).first();
  return json({ ok: true, status: 'verified', username: resolvedUsername || row.username, checkedInToday: Boolean(award?.found), dayKey, checkinPoints: RULES.checkinPoints, debug }, 200, request);
}

async function doCheckin(request, env) {
  const body = await readJson(request);
  const sessionId = String(body?.session || '').trim();
  const row = await getCheckinSession(env, sessionId);
  if (!row) return json({ ok: false, error: 'Sessão não encontrada.' }, 404, request);
  if (!row.verified_at || !row.user_key) return json({ ok: false, error: 'Vincule seu Instagram antes do check-in.' }, 403, request);

  const timestamp = Date.now();
  const { dayKey } = dateKeys(timestamp);
  const awarded = await awardInteraction(env, {
    awardKey: `checkin:${row.user_key}:${dayKey}`,
    userKey: row.user_key,
    identity: row.instagram_id || '',
    username: row.username || fallbackUsername(row.instagram_id),
    type: 'checkin',
    sourceId: dayKey,
    points: RULES.checkinPoints,
    timestamp,
  });

  await env.DB.prepare('UPDATE checkin_sessions SET last_used_at = ?1 WHERE session_id = ?2').bind(timestamp, sessionId).run();
  return json({ ok: true, awarded, alreadyCheckedIn: !awarded, points: awarded ? RULES.checkinPoints : 0, username: row.username, dayKey }, 200, request);
}

function cleanOptionId(value, fallback = 'o') {
  const clean = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return clean || fallback;
}

function absoluteLogo(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try { return new URL(raw, SITE_BASE).toString(); } catch (_) { return ''; }
}

function normalizePrediction(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim().slice(0, 100);
  const question = String(raw.question || '').trim().slice(0, 180);
  const source = Array.isArray(raw.options) ? raw.options : Object.values(raw.options || {});
  const options = source
    .map((item, index) => ({
      id: cleanOptionId(item?.id, `o${index + 1}`),
      label: String(item?.label || '').trim().slice(0, 100),
      logo: absoluteLogo(item?.logo),
    }))
    .filter((item) => item.id && item.label)
    .slice(0, 16);
  if (!id || question.length < 4 || options.length < 2) return null;

  const closesAt = Number(raw.closesAt || 0);
  const participationPoints = Math.max(0, Math.min(20, Number(raw.participationPoints ?? 1) || 0));
  const correctPoints = Math.max(0, Math.min(50, Number(raw.correctPoints ?? 3) || 0));
  const correctOption = String(raw.correctOption || '').trim();
  const rawStatus = String(raw.status || 'open').toLowerCase();
  let status = rawStatus === 'settled' ? 'settled' : rawStatus === 'closed' ? 'closed' : 'open';
  if (status === 'open' && closesAt && Date.now() >= closesAt) status = 'closed';
  if (status === 'settled' && !options.some((item) => item.id === correctOption)) status = 'closed';

  return {
    id,
    category: 'custom',
    kind: 'choice',
    label: String(raw.label || 'Palpite extra').trim().slice(0, 80),
    question,
    options,
    closesAt,
    status,
    correctOption: status === 'settled' ? correctOption : '',
    participationPoints,
    correctPoints,
    createdAt: Number(raw.createdAt || 0),
    updatedAt: Number(raw.updatedAt || 0),
    settledAt: Number(raw.settledAt || 0),
    result: status === 'settled' ? { option: correctOption, teamLabel: options.find(o => o.id === correctOption)?.label || correctOption } : null,
  };
}

async function fetchJson(url) {
  try {
    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
    return response.ok ? await response.json() : null;
  } catch (error) {
    console.error('Fetch JSON failed', url, error);
    return null;
  }
}

async function fetchManualPrediction() {
  return normalizePrediction(await fetchJson(PREDICTION_URL));
}

async function fetchSecondPhaseRounds() {
  const raw = await fetchJson(DATES_URL);
  const rounds = Array.isArray(raw?.rounds) ? raw.rounds.filter(r => r?.stage === 'segundaFase') : [];
  const source = rounds.length ? rounds : FALLBACK_SECOND_DATES;
  return source
    .map((r, i) => ({ round: Number(r.round || i + 1), date: String(r.date || ''), time24: String(r.time24 || '13:00'), closesAt: saoPauloTimestamp(r.date, r.time24 || '13:00') }))
    .filter(r => r.round && r.closesAt)
    .sort((a,b) => a.round - b.round);
}

async function fetchLogoMap() {
  const raw = await fetchJson(LOGOS_URL);
  return raw?.logos && typeof raw.logos === 'object' ? raw.logos : {};
}

function teamOptions(logos) {
  return SECOND_PHASE_TEAMS.map((team, index) => ({ id: cleanOptionId(team, `t${index + 1}`), label: team, logo: absoluteLogo(logos?.[team] || '') }));
}

function predictionNorm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}

function playerOptions(payload) {
  const players = Array.isArray(payload?.players) ? payload.players : [];
  const allowed = new Set(SECOND_PHASE_TEAMS.map(predictionNorm));
  return players
    .filter(player => allowed.has(predictionNorm(player?.team)))
    .map((player, index) => ({
      id: String(player?.id || cleanOptionId(`${player?.name || 'player'}-${player?.team || index + 1}`, `p${index + 1}`)).slice(0, 80),
      label: String(player?.name || '').trim(),
      team: String(player?.team || '').trim(),
      aliases: [player?.sourceName, ...(Array.isArray(player?.aliases) ? player.aliases : [])].filter(Boolean).map(String),
    }))
    .filter(player => player.id && player.label)
    .slice(0, 100);
}

function dailyTotals(live, day) {
  const drops = live?.drops?.[day] || live?.drops?.[String(day)] || {};
  const entries = Object.values(drops).filter(Boolean);
  if (entries.length < 6) return null;
  const totals = new Map();

  for (const drop of entries.slice(0, 6)) {
    const teams = Array.isArray(drop?.teams) ? drop.teams : [];
    if (teams.length < 12) return null;
    for (const row of teams) {
      const team = String(row?.team || '').trim();
      if (!team) continue;
      totals.set(team, (totals.get(team) || 0) + Number(row?.points || 0));
    }
  }

  if (totals.size < 12) return null;
  return totals;
}

function extremeResult(options, totals, mode) {
  if (!totals) return null;
  const rows = options.map(o => ({ option: o.id, team: o.label, points: Number(totals.get(o.label) || 0) }));
  const target = mode === 'worst' ? Math.min(...rows.map(r => r.points)) : Math.max(...rows.map(r => r.points));
  const winners = rows.filter(r => r.points === target);
  return {
    option: winners[0]?.option || '',
    teams: winners.map(r => r.option),
    team: winners[0]?.team || '',
    teamLabel: winners.map(r => r.team).join(' / '),
    points: target,
    closestError: null,
  };
}

function dailyPlayerResult(live, day, options) {
  const drops = live?.drops?.[day] || live?.drops?.[String(day)] || {};
  const entries = Object.values(drops).filter(Boolean);
  if (entries.length < 6) return null;

  const optionByAlias = new Map();
  for (const option of options) {
    const aliases = [option.label, ...option.aliases].map(predictionNorm).filter(Boolean);
    for (const alias of aliases) {
      optionByAlias.set(`${alias}__${predictionNorm(option.team)}`, option);
      if (!optionByAlias.has(alias)) optionByAlias.set(alias, option);
    }
  }

  const totals = new Map();
  for (const drop of entries.slice(0, 6)) {
    const rows = Array.isArray(drop?.players) ? drop.players : [];
    if (!rows.length) return null;
    for (const row of rows) {
      const nameKey = predictionNorm(row?.name || row?.player || row?.jogador);
      const teamKey = predictionNorm(row?.team || row?.equipe);
      const option = optionByAlias.get(`${nameKey}__${teamKey}`) || optionByAlias.get(nameKey);
      if (!option) continue;
      totals.set(option.id, (totals.get(option.id) || 0) + Number(row?.kills || row?.abates || 0));
    }
  }

  if (!totals.size) return null;
  const maxKills = Math.max(...totals.values());
  const winners = options.filter(option => Number(totals.get(option.id) || 0) === maxKills);
  if (!winners.length) return null;
  return {
    option: winners[0].id,
    options: winners.map(player => player.id),
    player: winners[0].label,
    playerLabel: winners.map(player => player.label).join(' / '),
    points: maxKills,
    closestError: null,
  };
}

function autoPredictionPair(round, teamOpts, playerOpts, live) {
  const totals = dailyTotals(live, round.round);
  const bestResult = extremeResult(teamOpts, totals, 'best');
  const worstResult = extremeResult(teamOpts, totals, 'worst');
  const mvpResult = dailyPlayerResult(live, round.round, playerOpts);
  const now = Date.now();
  const common = {
    category: 'ffws',
    label: `FFWS BR • Segunda Fase • Dia ${round.round}`,
    closesAt: round.closesAt,
    participationPoints: RULES.ffwsPredictionParticipationPoints,
    day: round.round,
    date: round.date,
  };
  return [
    {
      ...common,
      id: `ffws-2026-s2-d${round.round}-best`,
      kind: 'team_points',
      metric: 'best',
      question: `Qual equipe vai pontuar mais no Dia ${round.round}?`,
      options: teamOpts,
      correctPoints: RULES.ffwsPredictionNearestPoints,
      comboPoints: RULES.ffwsPredictionComboPoints,
      pointsPrompt: 'Quantos pontos esse time vai fazer?',
      status: bestResult ? 'settled' : now >= round.closesAt ? 'closed' : 'open',
      result: bestResult,
    },
    {
      ...common,
      id: `ffws-2026-s2-d${round.round}-worst`,
      kind: 'team_points',
      metric: 'worst',
      question: `Qual vai ser a pior equipe do Dia ${round.round}?`,
      options: teamOpts,
      correctPoints: RULES.ffwsPredictionNearestPoints,
      comboPoints: RULES.ffwsPredictionComboPoints,
      pointsPrompt: 'Quantos pontos esse time vai fazer?',
      status: worstResult ? 'settled' : now >= round.closesAt ? 'closed' : 'open',
      result: worstResult,
    },
    {
      ...common,
      id: `ffws-2026-s2-d${round.round}-mvp`,
      kind: 'player_kills',
      metric: 'mvp',
      question: `Quem será o MVP do Dia ${round.round}?`,
      options: playerOpts,
      correctPoints: RULES.ffwsPredictionMvpNearestPoints,
      comboPoints: 0,
      pointsPrompt: 'Quantos abates ele fará?',
      status: mvpResult ? 'settled' : now >= round.closesAt ? 'closed' : 'open',
      result: mvpResult,
    },
  ];
}

let predictionMetaCache = { at: 0, rounds: null, logos: null, roster: null, pending: null };
let predictionLiveCache = { at: 0, data: null, pending: null };

async function predictionMeta() {
  const now = Date.now();
  if (predictionMetaCache.rounds && now - predictionMetaCache.at < 5 * 60 * 1000) return predictionMetaCache;
  if (predictionMetaCache.pending) return predictionMetaCache.pending;
  predictionMetaCache.pending = Promise.all([
    fetchSecondPhaseRounds(),
    fetchLogoMap(),
    fetchJson(PLAYERS_URL),
  ]).then(([rounds, logos, roster]) => {
    predictionMetaCache = { at: Date.now(), rounds, logos, roster: roster || {}, pending: null };
    return predictionMetaCache;
  }).catch(error => {
    predictionMetaCache.pending = null;
    throw error;
  });
  return predictionMetaCache.pending;
}

async function predictionLive() {
  const now = Date.now();
  if (predictionLiveCache.data && now - predictionLiveCache.at < 8 * 1000) return predictionLiveCache.data;
  if (predictionLiveCache.pending) return predictionLiveCache.pending;
  predictionLiveCache.pending = fetchJson(LIVE_SECOND_URL).then(data => {
    predictionLiveCache = { at: Date.now(), data: data || {}, pending: null };
    return predictionLiveCache.data;
  }).catch(error => {
    predictionLiveCache.pending = null;
    throw error;
  });
  return predictionLiveCache.pending;
}

async function automaticPredictionData() {
  const [meta, live] = await Promise.all([predictionMeta(), predictionLive()]);
  const teams = teamOptions(meta.logos || {});
  const players = playerOptions(meta.roster || {});
  const pairs = (meta.rounds || []).map(round => ({ round, predictions: autoPredictionPair(round, teams, players, live || {}) }));
  return { rounds: meta.rounds || [], pairs, options: teams, playerOptions: players, live: live || {} };
}

function selectAutoWeekend(auto) {
  const groups = new Map();
  for (const item of auto.pairs || []) {
    const block = Math.ceil(Number(item?.round?.round || 0) / 2);
    if (!groups.has(block)) groups.set(block, []);
    groups.get(block).push(item);
  }
  const ordered = [...groups.values()].map(items => items.sort((a,b) => Number(a.round.round) - Number(b.round.round)));
  const now = Date.now();
  const upcoming = ordered.find(items => items.some(item => Number(item?.round?.closesAt || 0) > now));
  if (upcoming) return upcoming;
  const unresolved = ordered.slice().reverse().find(items => items.some(item => (item.predictions || []).some(prediction => prediction.status !== 'settled')));
  return unresolved || ordered[ordered.length - 1] || [];
}

function selectAutoPair(auto) {
  const weekend = selectAutoWeekend(auto);
  const now = Date.now();
  const active = weekend.find(item => Number(item?.round?.closesAt || 0) > now)
    || weekend.find(item => (item.predictions || []).some(prediction => prediction.status !== 'settled'))
    || weekend[weekend.length - 1];
  return active?.predictions || [];
}

function encodeVoteSource(predictionId, option, points) {
  return `${predictionId}|${option}|${points == null ? '' : Math.round(Number(points) || 0)}`;
}

function awardKeyPrefixBounds(prefix) {
  const start = String(prefix || '');
  return [start, start + '\uffff'];
}

function parseVoteSource(predictionId, sourceId) {
  const source = String(sourceId || '');
  if (source.startsWith(`${predictionId}|`)) {
    const [, option = '', pointText = ''] = source.split('|');
    return { option, points: pointText === '' ? null : Number(pointText) };
  }
  if (source.startsWith(`${predictionId}:`)) return { option: source.slice(predictionId.length + 1), points: null };
  return null;
}

async function predictionVoteFor(env, predictionId, key) {
  if (!predictionId || !key) return null;
  const row = await env.DB.prepare('SELECT source_id FROM awards WHERE award_key = ?1 LIMIT 1').bind(`prediction-vote:${predictionId}:${key}`).first();
  return row ? parseVoteSource(predictionId, row.source_id) : null;
}

async function predictionBonus(env, predictionId, key) {
  if (!predictionId || !key) return { won: false, points: 0 };
  const row = await env.DB.prepare(`
    SELECT points, type
    FROM awards
    WHERE (award_key = ?1 OR award_key = ?2)
    LIMIT 1
  `).bind(`prediction-correct:${predictionId}:${key}`, `prediction-nearest:${predictionId}:${key}`).first();
  return { won: Boolean(row), points: Number(row?.points || 0), type: row?.type || '' };
}

async function publicPredictionVotes(env, predictions) {
  const out = {};
  const now = Date.now();
  for (const prediction of predictions || []) {
    if (!prediction?.id || !prediction?.closesAt || now < Number(prediction.closesAt)) continue;
    const [startKey,endKey] = awardKeyPrefixBounds(`prediction-vote:${prediction.id}:`);
    const result = await cachedPublic(env.DB, `public-votes:${prediction.id}`, 300_000, () => env.DB.prepare(`
      SELECT a.user_key, COALESCE(u.username,a.username) AS username, a.source_id, a.created_at
      FROM awards a
      LEFT JOIN users u ON u.user_key=a.user_key
      WHERE a.type='prediction_vote' AND a.award_key >= ?1 AND a.award_key < ?2
      ORDER BY a.created_at ASC
      LIMIT 1000
    `).bind(startKey,endKey).all());

    out[prediction.id] = (result.results || []).map(row => {
      const vote = parseVoteSource(prediction.id, row.source_id) || {};
      const option = (prediction.options || []).find(item => item.id === vote.option);
      return {
        username: String(row.username || 'usuario'),
        option: String(vote.option || ''),
        optionLabel: String(option?.label || vote.option || '—'),
        team: String(option?.team || ''),
        points: vote.points == null ? null : Number(vote.points),
        createdAt: Number(row.created_at || 0),
      };
    });
  }
  return out;
}

async function settleManualPrediction(env, prediction) {
  if (!prediction || prediction.category !== 'custom' || prediction.status !== 'settled' || !prediction.correctOption || prediction.correctPoints <= 0) return;
  const result = { results: await allPredictionVotes(env, prediction.id) };
  const timestamp = prediction.closesAt || prediction.settledAt || Date.now();

  for (let i = 0; i < (result.results || []).length; i += 25) {
    const chunk = result.results.slice(i, i + 25).filter(row => parseVoteSource(prediction.id, row.source_id)?.option === prediction.correctOption);
    await Promise.all(chunk.map(row => awardInteraction(env, {
      awardKey: `prediction-correct:${prediction.id}:${row.user_key}`,
      userKey: row.user_key,
      identity: '',
      username: row.username || 'usuario',
      type: 'prediction_correct',
      sourceId: prediction.id,
      points: prediction.correctPoints,
      timestamp,
    })));
  }
}

async function settleAutoPrediction(env, prediction) {
  if (!prediction || prediction.category !== 'ffws' || prediction.status !== 'settled' || !prediction.result || prediction.correctPoints <= 0) return;
  const result = { results: await allPredictionVotes(env, prediction.id) };

  const accepted = new Set(prediction.result.teams || prediction.result.options || (prediction.result.option ? [prediction.result.option] : []));
  const candidates = [];
  for (const row of result.results || []) {
    const vote = parseVoteSource(prediction.id, row.source_id);
    if (!vote || !accepted.has(vote.option) || !Number.isFinite(Number(vote.points))) continue;
    candidates.push({ row, vote, error: Math.abs(Number(vote.points) - Number(prediction.result.points)) });
  }
  if (!candidates.length) return;

  const closestError = Math.min(...candidates.map(x => x.error));
  prediction.result.closestError = closestError;
  const winners = candidates.filter(x => x.error === closestError);
  const timestamp = prediction.closesAt || Date.now();

  for (let i = 0; i < winners.length; i += 25) {
    await Promise.all(winners.slice(i, i + 25).map(({ row }) => awardInteraction(env, {
      awardKey: `prediction-nearest:${prediction.id}:${row.user_key}`,
      userKey: row.user_key,
      identity: '',
      username: row.username || 'usuario',
      type: 'prediction_nearest',
      sourceId: prediction.id,
      points: prediction.correctPoints,
      timestamp,
    })));
  }
}

async function settleAutoCombo(env, predictions) {
  const list = Array.isArray(predictions) ? predictions : [];
  const best = list.find(p => p?.metric === 'best');
  const worst = list.find(p => p?.metric === 'worst');
  if (!best || !worst || best.status !== 'settled' || worst.status !== 'settled' || !best.result || !worst.result) return;

  const [bestRows, worstRows] = await Promise.all([
    allPredictionVotes(env,best.id).then(results=>({results})),
    allPredictionVotes(env,worst.id).then(results=>({results})),
  ]);

  const bestAccepted = new Set(best.result.teams || (best.result.option ? [best.result.option] : []));
  const worstAccepted = new Set(worst.result.teams || (worst.result.option ? [worst.result.option] : []));
  const worstByUser = new Map((worstRows.results || []).map(row => [row.user_key, row]));
  const winners = [];

  for (const row of bestRows.results || []) {
    const bestVote = parseVoteSource(best.id, row.source_id);
    if (!bestVote || !bestAccepted.has(bestVote.option)) continue;
    const other = worstByUser.get(row.user_key);
    if (!other) continue;
    const worstVote = parseVoteSource(worst.id, other.source_id);
    if (!worstVote || !worstAccepted.has(worstVote.option)) continue;
    winners.push({ userKey: row.user_key, username: row.username || other.username || 'usuario' });
  }

  const timestamp = Math.max(Number(best.closesAt || 0), Number(worst.closesAt || 0)) || Date.now();
  for (let i = 0; i < winners.length; i += 25) {
    await Promise.all(winners.slice(i, i + 25).map(row => awardInteraction(env, {
      awardKey: `prediction-combo:${best.day || 'day'}:${row.userKey}`,
      userKey: row.userKey,
      identity: '',
      username: row.username,
      type: 'prediction_combo',
      sourceId: `${best.id}|${worst.id}`,
      points: RULES.ffwsPredictionComboPoints,
      timestamp,
    })));
  }
}

async function allPredictionVotes(env, id) {
  const [start,end] = awardKeyPrefixBounds(`prediction-vote:${id}:`);
  const rows=[];let cursor='';
  while (true) {
    const result=await env.DB.prepare(`SELECT award_key,user_key,username,source_id FROM awards
      WHERE type='prediction_vote' AND award_key>=?1 AND award_key<?2 AND award_key>?3
      ORDER BY award_key LIMIT 1000`).bind(start,end,cursor).all();
    const page=result.results||[];rows.push(...page);
    if(page.length<1000)return rows;
    cursor=page[page.length-1].award_key;
  }
}

function predictionResultSignature(p) {
  return JSON.stringify({id:p.id,kind:p.kind,metric:p.metric,correctOption:p.correctOption,
    correctPoints:p.correctPoints,closesAt:p.closesAt,settledAt:p.settledAt,
    result:{option:p.result?.option,points:p.result?.points,
      teams:[...(p.result?.teams||[])].sort(),options:[...(p.result?.options||[])].sort()}});
}
function settlementJobs(env, manual, auto) {
  const jobs=[];
  if(manual?.status==='settled')jobs.push({key:`manual:${manual.id}`,signature:predictionResultSignature(manual),work:()=>settleManualPrediction(env,manual)});
  for(const item of auto?.pairs||[]) {
    const list=item.predictions||[];
    for(const p of list)if(p?.status==='settled')jobs.push({key:`auto:${p.id}`,signature:predictionResultSignature(p),work:()=>settleAutoPrediction(env,p)});
    const best=list.find(p=>p.metric==='best'),worst=list.find(p=>p.metric==='worst');
    if(best?.status==='settled'&&worst?.status==='settled')jobs.push({key:`combo:${best.id}|${worst.id}`,
      signature:JSON.stringify([predictionResultSignature(best),predictionResultSignature(worst),RULES.ffwsPredictionComboPoints]),
      work:()=>settleAutoCombo(env,list)});
  }
  return jobs;
}
async function settleAllAvailable(env, manual, auto) {
  await captureOutcomes(env.DB,[manual,...(auto?.pairs||[]).flatMap(item=>item.predictions||[])]);
  const results=await Promise.allSettled(settlementJobs(env,manual,auto).map(job=>settleOnce(env.DB,job.key,job.signature,job.work)));
  const failed=results.find(result=>result.status==='rejected');
  if(failed)throw failed.reason;
}
function maybeSettleAllAvailable(env, manual, auto) {
  const signature=JSON.stringify(settlementJobs(env,manual,auto).map(({key,signature})=>[key,signature]).sort());
  if(signature==='[]')return Promise.resolve();
  const now=Date.now();
  if(predictionSettlementSweep.signature===signature&&now-predictionSettlementSweep.at<15*60*1000)return predictionSettlementSweep.pending||Promise.resolve();
  if(predictionSettlementSweep.pending)return predictionSettlementSweep.pending;
  predictionSettlementSweep.signature=signature;
  predictionSettlementSweep.pending=settleAllAvailable(env,manual,auto).then(()=>{
    predictionSettlementSweep.at=Date.now();
  }).catch(error=>{
    predictionSettlementSweep.at=0;predictionSettlementSweep.signature='';
    throw error;
  }).finally(()=>{predictionSettlementSweep.pending=null});
  return predictionSettlementSweep.pending;
}
async function invalidatePredictionSettlement(env,id) {
  const escaped=String(id).replace(/[\\%_]/g,'\\$&');
  await env.DB.prepare(`DELETE FROM prediction_settlements WHERE job_key=?1 OR job_key=?2
    OR job_key LIKE ?3 ESCAPE '\\' OR job_key LIKE ?4 ESCAPE '\\'`)
    .bind(`manual:${id}`,`auto:${id}`,`combo:${escaped}|%`,`combo:%|${escaped}`).run();
  predictionSettlementSweep.at=0;predictionSettlementSweep.signature='';
}

async function resolvePrediction(predictionId, manual, auto) {
  if (manual?.id === predictionId) return manual;
  for (const item of auto.pairs || []) {
    for (const prediction of item.predictions || []) {
      if (prediction.id === predictionId) return prediction;
    }
  }
  return null;
}

async function buildPredictionsPayload(env, sessionId, ctx) {
  const [manual, auto] = await Promise.all([fetchManualPrediction(), automaticPredictionData()]);
  if (ctx?.waitUntil) ctx.waitUntil(maybeSettleAllAvailable(env, manual, auto));

  const weekend = selectAutoWeekend(auto);
  const activePredictions = [...selectAutoPair(auto)];
  if (manual) activePredictions.push(manual);
  const weekendPredictions = weekend.flatMap(item => item.predictions || []);
  const allVisible = [...weekendPredictions, ...(manual ? [manual] : [])];

  const row = sessionId ? await getCheckinSession(env, sessionId) : null;
  const linked = Boolean(row?.verified_at && row?.user_key);
  const votes = {};

  if (linked) {
    for (const prediction of allVisible) {
      const vote = await predictionVoteFor(env, prediction.id, row.user_key);
      if (!vote) continue;
      const bonus = await predictionBonus(env, prediction.id, row.user_key);
      votes[prediction.id] = { ...vote, won: bonus.won, bonusPoints: bonus.points };
    }
  }

  const publicVotes = await publicPredictionVotes(env, weekendPredictions);
  const days = weekend.map(item => ({
    day: Number(item?.round?.round || 0),
    date: String(item?.round?.date || ''),
    closesAt: Number(item?.round?.closesAt || 0),
    status: (item.predictions || []).every(p => p.status === 'settled') ? 'settled'
      : Date.now() >= Number(item?.round?.closesAt || 0) ? 'closed' : 'open',
    predictions: item.predictions || [],
  }));

  return {
    ok: true,
    linked,
    username: linked ? row.username : '',
    predictions: activePredictions,
    days,
    votes,
    publicVotes,
  };
}

async function getPredictions(request, env, url, ctx) {
  const sessionId = String(url.searchParams.get('session') || '').trim();
  return json(await buildPredictionsPayload(env, sessionId, ctx), 200, request);
}

async function getPredictionLegacy(request, env, url, ctx) {
  const all = await buildPredictionsPayload(env, String(url.searchParams.get('session') || '').trim(), ctx);
  const prediction = all.predictions.find(p => p.category === 'custom') || all.predictions[0] || null;
  const vote = prediction ? all.votes[prediction.id] : null;
  return json({ ok: true, prediction, linked: all.linked, username: all.username, vote: vote?.option || '', votePoints: vote?.points ?? null, correctAwarded: Boolean(vote?.won) }, 200, request);
}

async function votePrediction(request, env, ctx) {
  const body = await readJson(request);
  const sessionId = String(body?.session || '').trim();
  const predictionId = String(body?.predictionId || '').trim();
  const option = String(body?.option || '').trim();
  const [manual, auto] = await Promise.all([fetchManualPrediction(), automaticPredictionData()]);
  const prediction = await resolvePrediction(predictionId, manual, auto);

  if (!prediction) return json({ ok: false, error: 'Esse palpite não está mais disponível.' }, 404, request);
  if (prediction.status !== 'open' || (prediction.closesAt && Date.now() >= prediction.closesAt)) return json({ ok: false, error: 'O prazo para esse palpite já terminou.' }, 409, request);
  if (!prediction.options.some(item => item.id === option)) return json({ ok: false, error: 'Opção de palpite inválida.' }, 400, request);

  let guessedPoints = null;
  if (prediction.kind === 'team_points' || prediction.kind === 'player_kills') {
    guessedPoints = Math.round(Number(body?.points));
    const maxGuess = prediction.kind === 'player_kills' ? 60 : 300;
    if (!Number.isFinite(guessedPoints) || guessedPoints < 0 || guessedPoints > maxGuess) {
      const label = prediction.kind === 'player_kills' ? 'abates' : 'pontos';
      return json({ ok: false, error: `Digite uma previsão de ${label} entre 0 e ${maxGuess}.` }, 400, request);
    }
  }

  const row = await getCheckinSession(env, sessionId);
  if (!row?.verified_at || !row?.user_key) return json({ ok: false, error: 'Vincule seu Instagram antes de palpitar.' }, 403, request);

  const existingVote = await predictionVoteFor(env, prediction.id, row.user_key);
let voteUpdated = false;
if (!existingVote) {
  await awardInteraction(env, {
    awardKey: `prediction-vote:${prediction.id}:${row.user_key}`,
    userKey: row.user_key,
    identity: row.instagram_id || '',
    username: row.username || fallbackUsername(row.instagram_id),
    type: 'prediction_vote',
    sourceId: encodeVoteSource(prediction.id, option, guessedPoints),
    points: prediction.participationPoints,
    timestamp: Date.now(),
  });
} else {
  const sameOption = existingVote.option === option;
  const samePoints = prediction.kind !== 'team_points' || Number(existingVote.points) === Number(guessedPoints);
  if (!sameOption || !samePoints) {
    const updated = await env.DB.prepare(`
      UPDATE awards
      SET source_id = ?1, username = ?2, created_at = ?3
      WHERE award_key = ?4 AND user_key = ?5 AND type = 'prediction_vote'
    `).bind(
      encodeVoteSource(prediction.id, option, guessedPoints),
      row.username || fallbackUsername(row.instagram_id),
      Date.now(),
      `prediction-vote:${prediction.id}:${row.user_key}`,
      row.user_key,
    ).run();
    voteUpdated = Boolean(updated.meta?.changes);
  }
}

if (!existingVote || voteUpdated) await invalidatePredictionSettlement(env,prediction.id);
const all = await buildPredictionsPayload(env, sessionId, ctx);
return json({
  ok: true,
  alreadyVoted: Boolean(existingVote),
  voteUpdated,
  participationAwarded: existingVote ? 0 : prediction.participationPoints,
  all,
}, 200, request);
}

async function getPredictionRanking(request, env, url) {
  const requested = String(url.searchParams.get('period') || 'week').toLowerCase();
  const period = ['week','month','all'].includes(requested) ? requested : 'week';
  const now = Date.now();
  const { monthKey } = dateKeys(now);
  const week = weekKeys(now);
  let where = `a.type IN ('prediction_vote','prediction_correct','prediction_nearest','prediction_combo')`;
  let binds = [];

  if (period === 'week') {
    where += ' AND a.day_key BETWEEN ?1 AND ?2';
    binds = [week.weekStartKey, week.weekEndKey];
  } else if (period === 'month') {
    where += ' AND a.month_key = ?1';
    binds = [monthKey];
  }

  const statement = env.DB.prepare(`
    SELECT a.user_key,
           COALESCE(MAX(u.username),MAX(a.username)) AS username,
           SUM(a.points) AS points,
           SUM(CASE WHEN a.type='prediction_vote' THEN 1 ELSE 0 END) AS participations,
           SUM(CASE WHEN a.type IN ('prediction_correct','prediction_nearest') THEN 1 ELSE 0 END) AS wins,
           MAX(a.created_at) AS lastInteractionAt
    FROM awards a
    LEFT JOIN users u ON u.user_key=a.user_key
    WHERE ${where}
    GROUP BY a.user_key
    ORDER BY points DESC, wins DESC, participations DESC, username ASC
    LIMIT 100
  `);
  const result = binds.length ? await statement.bind(...binds).all() : await statement.all();
  const ranking = (result.results || []).map(row => ({
    userKey: row.user_key,
    username: row.username,
    points: Number(row.points || 0),
    participations: Number(row.participations || 0),
    wins: Number(row.wins || 0),
    lastInteractionAt: Number(row.lastInteractionAt || 0),
  }));
  return json({ ok: true, period, ranking }, 200, request, { 'Cache-Control': 'public, max-age=60' });
}

async function getPredictionProfile(request, env, url) {
  const key = String(url.searchParams.get('userKey') || '').trim().slice(0, 120);
  if (!key || !/^[a-zA-Z0-9_-]+$/.test(key)) return json({ ok: false, error: 'Perfil inválido.' }, 400, request);

  const [auto, user, voteRows] = await Promise.all([
    automaticPredictionData(),
    env.DB.prepare('SELECT username FROM users WHERE user_key = ?1 LIMIT 1').bind(key).first(),
    env.DB.prepare(`
      SELECT source_id, created_at
      FROM awards
      WHERE user_key = ?1 AND type = 'prediction_vote'
      ORDER BY created_at ASC
      LIMIT 500
    `).bind(key).all(),
  ]);

  const allPredictions = [];
  for (const item of auto.pairs || []) {
    for (const prediction of item.predictions || []) allPredictions.push(prediction);
  }
  const predictionById = new Map(allPredictions.map(p => [p.id, p]));
  const knownIds = [...predictionById.keys()].sort((a,b) => b.length - a.length);
  const votes = new Map();

  for (const row of voteRows.results || []) {
    const predictionId = predictionIdFromSource(row.source_id, knownIds);
    const prediction = predictionById.get(predictionId);
    if (!prediction) continue;
    const parsed = parseVoteSource(predictionId, row.source_id);
    if (!parsed) continue;
    votes.set(predictionId, { ...parsed, votedAt: Number(row.created_at || 0) });
  }

  const now = Date.now();
  const days = (auto.pairs || []).map(item => {
    const day = Number(item?.round?.round || 0);
    const closesAt = Number(item?.round?.closesAt || 0);
    const revealed = Boolean(closesAt && now >= closesAt);
    const predictions = (item.predictions || [])
      .filter(p => ['best','worst','mvp'].includes(p.metric))
      .map(prediction => {
        if (!revealed) {
          return {
            id: prediction.id,
            metric: prediction.metric,
            kind: prediction.kind,
            revealed: false,
            vote: null,
            result: null,
          };
        }

        const stored = votes.get(prediction.id) || null;
        const option = stored ? (prediction.options || []).find(o => o.id === stored.option) : null;
        const accepted = new Set(
          prediction?.result?.teams ||
          prediction?.result?.options ||
          (prediction?.result?.option ? [prediction.result.option] : [])
        );
        const resultOption = prediction?.result?.option
          ? (prediction.options || []).find(o => o.id === prediction.result.option)
          : null;

        return {
          id: prediction.id,
          metric: prediction.metric,
          kind: prediction.kind,
          revealed: true,
          vote: stored ? {
            option: stored.option,
            optionLabel: String(option?.label || stored.option || '—'),
            team: String(option?.team || ''),
            points: stored.points == null ? null : Number(stored.points),
            votedAt: Number(stored.votedAt || 0),
            correctSelection: Boolean(prediction.result && accepted.has(stored.option)),
            exactValue: Boolean(
              prediction.result &&
              Number.isFinite(Number(stored.points)) &&
              Number(stored.points) === Number(prediction.result.points)
            ),
          } : null,
          result: prediction.result ? {
            option: String(prediction.result.option || ''),
            optionLabel: String(
              prediction.result.teamLabel ||
              prediction.result.playerLabel ||
              resultOption?.label ||
              prediction.result.option ||
              '—'
            ),
            points: Number.isFinite(Number(prediction.result.points)) ? Number(prediction.result.points) : null,
          } : null,
        };
      });

    return {
      day,
      date: String(item?.round?.date || ''),
      closesAt,
      revealed,
      predictions,
    };
  });

  let username = String(user?.username || '').trim();
  if (!username) {
    const row = await env.DB.prepare(`
      SELECT username FROM awards
      WHERE user_key = ?1 AND username IS NOT NULL AND username != ''
      ORDER BY created_at DESC LIMIT 1
    `).bind(key).first();
    username = String(row?.username || 'usuario');
  }

  return json({ ok: true, userKey: key, username, days }, 200, request, { 'Cache-Control': 'public, max-age=20' });
}

async function verifyFirebaseUserToken(request) {
  const header = String(request.headers.get('Authorization') || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const idToken = match[1];
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const user = Array.isArray(data?.users) ? data.users[0] : null;
    if (!user?.localId) return null;
    const providers = Array.isArray(user.providerUserInfo) ? user.providerUserInfo.map(x => String(x?.providerId || '')) : [];
    if (!providers.includes('google.com')) return null;
    return { uid: String(user.localId), email: String(user.email || ''), idToken };
  } catch (_) {
    return null;
  }
}

async function verifyAdminFirebaseToken(request) {
  const header = String(request.headers.get('Authorization') || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const idToken = match[1];

  // Prefer Firebase Realtime Database itself as the verifier. The
  // adminDrafts node is readable only by the configured admin email,
  // so a 200 response proves both that the ID token is valid and that
  // its email claim has administrative access. This also avoids
  // failures caused by browser/referrer restrictions on the Firebase
  // Web API key when Identity Toolkit is called server-side.
  try {
    const verifyUrl = `${FIREBASE_BASE}/adminDrafts.json?shallow=true&auth=${encodeURIComponent(idToken)}`;
    const response = await fetch(verifyUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.ok) return { email: ADMIN_EMAIL, verifiedBy: 'rtdb' };
  } catch (error) {
    console.error('Firebase RTDB admin verification failed', error);
  }

  // Compatibility fallback for projects where the Web API key also
  // accepts server-side Identity Toolkit requests.
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const user = Array.isArray(data?.users) ? data.users[0] : null;
    const email = String(user?.email || '').toLowerCase();
    return email === ADMIN_EMAIL ? user : null;
  } catch (_) {
    return null;
  }
}


function publicStoryReview(row){return {key:row.mention_key,catalogKey:row.account_id+':'+row.week_key,username:row.username,storyId:row.story_id,messageId:row.message_id,mediaUrl:row.media_url,eventAt:row.event_at,weekStart:row.week_key,status:row.status,postUrl:row.post_url,publishedAt:row.published_at,verification:row.verification,note:row.note,reviewedAt:row.reviewed_at,reviewedBy:row.reviewed_by}}
async function getAdminStories(request,env,url){
 const admin=await verifyAdminFirebaseToken(request);if(!admin)return json({ok:false,error:'Acesso administrativo inválido.'},401,request);
 const status=['pending','approved','rejected'].includes(url.searchParams.get('status'))?url.searchParams.get('status'):'approved';
 const cursor=String(url.searchParams.get('cursor')||'');const before=Number(cursor.split('|')[0])||Number.MAX_SAFE_INTEGER,after=cursor.slice(cursor.indexOf('|')+1);
 const result=await env.DB.prepare(`SELECT r.*,t.expires_at AS preview_expires FROM story_reviews r LEFT JOIN story_thumbnails t ON t.mention_key=r.mention_key AND t.expires_at>?4 WHERE r.status=?1 AND (r.event_at<?2 OR (r.event_at=?2 AND r.mention_key>?3)) ORDER BY r.event_at DESC,r.mention_key ASC LIMIT 51`).bind(status,before,after,Date.now()).all();
 const rows=(result.results||[]).slice(0,50),last=rows.at(-1),counts=await env.DB.prepare("SELECT status,COUNT(*) AS count FROM story_reviews GROUP BY status").all();
 const stories=await Promise.all(rows.map(async row=>({...publicStoryReview(row),previewUrl:row.preview_expires?await previewLink(row.mention_key,Number(row.preview_expires),env.META_APP_SECRET):'',previewArchived:!!row.preview_expires})));
 return json({ok:true,stories,counts:Object.fromEntries((counts.results||[]).map(r=>[r.status,Number(r.count)])),cursor:result.results?.length>50?`${last.event_at}|${last.mention_key}`:'',rules:{points:5,dailyLimit:3,approvalRequired:false,autoApproval:true,currentWeekOnly:false}},200,request);
}
const storyPostCaches=new WeakMap();
async function ownStoryPosts(env,row){
 if(!row.account_id||!env.INSTAGRAM_ACCESS_TOKEN)return {available:false,posts:[],weekPosts:[]};
 let cache=storyPostCaches.get(env.DB);if(!cache){cache=new Map();storyPostCaches.set(env.DB,cache);}
 let entry=cache.get(row.account_id);
 if(!entry||entry.until<Date.now()){
  if(cache.size>=8)cache.delete(cache.keys().next().value);
  entry={until:Date.now()+120000};
  entry.promise=(async()=>{
   const data=await fetchInstagramGraphJson(row.account_id,'media.limit(100){id,permalink,timestamp,caption}',env.INSTAGRAM_ACCESS_TOKEN,AbortSignal.timeout(12000));
   if(!Array.isArray(data?.media?.data)){entry.until=Date.now()+10000;return null;}
   return data.media.data.map(p=>{const link=instagramPost(p.permalink),publishedAt=Date.parse(p.timestamp||'');return link&&Number.isFinite(publishedAt)?{id:String(p.id),...link,publishedAt,label:String(p.caption||'Publicação sem legenda').slice(0,140)}:null}).filter(Boolean);
  })();cache.set(row.account_id,entry);
 }
 const allPosts=await entry.promise;if(!allPosts)return {available:false,posts:[],weekPosts:[]};
 const weekPosts=allPosts.filter(p=>weekKeys(p.publishedAt).weekStartKey===row.week_key);
 return {available:true,posts:weekPosts.filter(p=>p.publishedAt<=row.event_at+300000),weekPosts,allPosts};
}
async function getAdminStoryPosts(request,env,url){
 const admin=await verifyAdminFirebaseToken(request);if(!admin)return json({ok:false,error:'Acesso administrativo inválido.'},401,request);
 const row=await env.DB.prepare('SELECT * FROM story_reviews WHERE mention_key=?1').bind(String(url.searchParams.get('key')||'')).first();if(!row)return json({ok:false,error:'Story não encontrado.'},404,request);
 const catalog=await ownStoryPosts(env,row);return json({ok:true,available:catalog.available,catalogKey:row.account_id+':'+row.week_key,posts:catalog.posts,weekPosts:catalog.weekPosts},200,request);
}
async function decideAdminStory(env,row,decision,body,actor){
 let post=null;
 if(decision==='approved'&&row.status==='pending'){
  if(body.auto===true){if(body.confirmSamePost!==true)return {status:400,error:'Confirme a conferência dos stories selecionados.'};return autoApproveStory(env.DB,row.mention_key);}
  if(body.confirmSamePost!==true)return {status:400,error:'Confira se o story mostra a publicação escolhida antes de aprovar.'};
  const link=instagramPost(body.postUrl);if(!link)return {status:400,error:'Informe o link da publicação original no Instagram.'};
  const catalog=await ownStoryPosts(env,row),found=(catalog.allPosts||catalog.posts).find(p=>p.key===link.key);
  if(found)post={...found,verification:'meta'};
  else{
   const publishedAt=Date.parse(String(body.publishedAt||''));
   if(body.confirmDate!==true||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:00-03:00$/.test(String(body.publishedAt||''))||!Number.isFinite(publishedAt)||dateKeys(publishedAt).dayKey!==String(body.publishedAt).slice(0,10))return {status:400,error:'A data não foi encontrada automaticamente. Confira no Instagram e informe a data e hora de publicação.'};
   post={...link,publishedAt,verification:'manual'};
  }
 }
 return reviewStory(env.DB,row.mention_key,decision,post,actor,body.note);
}
async function finishStoryReviews(env,results){
 const changed=new Map();for(const result of results)if(result.row&&(result.row.status==='approved'||result.reversed)&&!result.alreadyReviewed&&!result.error)changed.set(result.row.user_key+'|'+result.row.week_key,result.row);
 for(const row of changed.values())try{await evaluateWeeklyBonuses(env,{userKey:row.user_key,identity:row.instagram_id,username:row.username,timestamp:row.event_at})}catch(error){console.error('Story weekly bonus retry pending',error)}
 if(changed.size)try{await invalidatePublicRankings(env.DB);}catch(error){console.error('Story ranking refresh pending',error);return true;}
 return false;
}
async function reviewAdminStory(request,env){
 const admin=await verifyAdminFirebaseToken(request);if(!admin)return json({ok:false,error:'Acesso administrativo inválido.'},401,request);
 const body=await readJson(request)||{},key=String(body.key||''),decision=body.decision==='approve'?'approved':body.decision==='reject'?'rejected':'';
 if(!decision)return json({ok:false,error:'Escolha aprovar ou rejeitar.'},400,request);
 const row=await env.DB.prepare('SELECT * FROM story_reviews WHERE mention_key=?1').bind(key).first();if(!row)return json({ok:false,error:'Story não encontrado.'},404,request);
 const result=await decideAdminStory(env,row,decision,body,String(admin.email||ADMIN_EMAIL));
 if(result.error)return json({ok:false,error:result.error},result.status,request);
 const refreshPending=await finishStoryReviews(env,[result]);
 return json({ok:true,alreadyReviewed:result.alreadyReviewed,points:result.row.status==='approved'?5:0,reversed:!!result.reversed,story:publicStoryReview(result.row),refreshPending},200,request);
}
async function reviewAdminStoryBatch(request,env){
 const admin=await verifyAdminFirebaseToken(request);if(!admin)return json({ok:false,error:'Acesso administrativo inválido.'},401,request);
 const body=await readJson(request)||{},keys=body.keys,decision=body.decision==='approve'?'approved':body.decision==='reject'?'rejected':'';
 if(!decision||!Array.isArray(keys)||!keys.length||keys.length>20||keys.some(k=>typeof k!=='string'||!k||k.length>300)||new Set(keys).size!==keys.length)return json({ok:false,error:'Selecione de 1 a 20 stories diferentes e escolha aprovar ou rejeitar.'},400,request);
 if(decision==='approved'&&(body.confirmSamePost!==true||(body.auto!==true&&!instagramPost(body.postUrl))))return json({ok:false,error:'Escolha o post original e confirme a conferência dos stories selecionados.'},400,request);
 const loaded=await env.DB.prepare('SELECT * FROM story_reviews WHERE mention_key IN (SELECT value FROM json_each(?1))').bind(JSON.stringify(keys)).all(),rows=new Map((loaded.results||[]).map(row=>[row.mention_key,row])),results=[];
 for(const key of keys){
  const row=rows.get(key);if(!row){results.push({key,status:404,error:'Story não encontrado.'});continue;}
  try{results.push({key,...await decideAdminStory(env,row,decision,body,String(admin.email||ADMIN_EMAIL))});}
  catch(error){console.error('Story batch item failed',error?.message);results.push({key,status:503,error:'Não foi possível salvar este story. Tente novamente; ele não será pontuado duas vezes.'});}
 }
 const refreshPending=await finishStoryReviews(env,results);
 return json({ok:true,refreshPending,results:results.map(r=>({key:r.key,ok:!r.error,status:r.status,...(r.error?{error:r.error}:{alreadyReviewed:!!r.alreadyReviewed,points:r.row.status==='approved'?5:0,reversed:!!r.reversed,story:publicStoryReview(r.row)})}))},200,request);
}

function predictionIdFromSource(sourceId, knownIds = []) {
  const source = String(sourceId || '');
  const pipe = source.indexOf('|');
  if (pipe > 0) return source.slice(0, pipe);
  for (const id of knownIds) if (source.startsWith(`${id}:`)) return id;
  const colon = source.indexOf(':');
  return colon > 0 ? source.slice(0, colon) : source;
}

async function getAdminPredictionVotes(request, env) {
  const admin = await verifyAdminFirebaseToken(request);
  if (!admin) return json({ ok: false, error: 'Acesso administrativo inválido.' }, 401, request);

  const [manual, auto, voteRows, bonusRows] = await Promise.all([
    fetchManualPrediction(),
    automaticPredictionData(),
    env.DB.prepare(`
      SELECT a.user_key, COALESCE(u.username,a.username) AS username, a.source_id, a.points, a.created_at
      FROM awards a
      LEFT JOIN users u ON u.user_key=a.user_key
      WHERE a.type='prediction_vote'
      ORDER BY a.created_at DESC
      LIMIT 2500
    `).all(),
    env.DB.prepare(`
      SELECT user_key, source_id, points, type
      FROM awards
      WHERE type IN ('prediction_correct','prediction_nearest')
      ORDER BY created_at DESC
      LIMIT 2500
    `).all(),
  ]);

  const allPredictions = [];
  for (const item of auto.pairs || []) for (const prediction of item.predictions || []) allPredictions.push(prediction);
  if (manual) allPredictions.push(manual);
  const meta = new Map(allPredictions.map(p => [p.id, p]));
  const knownIds = [...meta.keys()].sort((a,b) => b.length - a.length);
  const bonusMap = new Map();
  for (const row of bonusRows.results || []) bonusMap.set(`${row.source_id}:${row.user_key}`, { points: Number(row.points || 0), type: row.type || '' });

  const groups = new Map();
  for (const row of voteRows.results || []) {
    const predictionId = predictionIdFromSource(row.source_id, knownIds);
    const prediction = meta.get(predictionId) || null;
    const parsed = prediction ? parseVoteSource(predictionId, row.source_id) : (() => {
      const parts = String(row.source_id || '').split('|');
      return { option: parts[1] || '', points: parts[2] === '' || parts[2] == null ? null : Number(parts[2]) };
    })();
    if (!groups.has(predictionId)) {
      groups.set(predictionId, {
        id: predictionId,
        label: prediction?.label || 'Palpite anterior',
        question: prediction?.question || predictionId,
        kind: prediction?.kind || 'choice',
        status: prediction?.status || 'historical',
        closesAt: Number(prediction?.closesAt || 0),
        result: prediction?.result || null,
        options: Array.isArray(prediction?.options) ? prediction.options : [],
        votes: [],
      });
    }
    const group = groups.get(predictionId);
    const optionLabel = prediction?.options?.find(o => o.id === parsed?.option)?.label || parsed?.option || '—';
    const bonus = bonusMap.get(`${predictionId}:${row.user_key}`) || null;
    const resultPoints = Number(prediction?.result?.points);
    const error = Number.isFinite(Number(parsed?.points)) && Number.isFinite(resultPoints) ? Math.abs(Number(parsed.points) - resultPoints) : null;
    group.votes.push({
      userKey: row.user_key,
      username: row.username || 'usuario',
      option: parsed?.option || '',
      optionLabel,
      guessedPoints: parsed?.points == null ? null : Number(parsed.points),
      participationPoints: Number(row.points || 0),
      votedAt: Number(row.created_at || 0),
      won: Boolean(bonus),
      bonusPoints: Number(bonus?.points || 0),
      error,
    });
  }

  const predictions = [...groups.values()]
    .map(group => ({ ...group, voteCount: group.votes.length }))
    .sort((a,b) => Math.max(...b.votes.map(v => v.votedAt),0) - Math.max(...a.votes.map(v => v.votedAt),0));

  return json({ ok: true, admin: String(admin.email || ADMIN_EMAIL), totalVotes: predictions.reduce((sum,p) => sum + p.voteCount, 0), predictions }, 200, request);
}

function normalizeRewardConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const missionRaw = source.mission && typeof source.mission === 'object' ? source.mission : {};
  const mission = {
    active: missionRaw.active !== false,
    label: String(missionRaw.label || DEFAULT_MISSION.label).trim().slice(0, 80) || DEFAULT_MISSION.label,
    commentsTarget: Math.max(1, Math.min(30, Number(missionRaw.commentsTarget) || DEFAULT_MISSION.commentsTarget)),
    checkinsTarget: Math.max(1, Math.min(7, Number(missionRaw.checkinsTarget) || DEFAULT_MISSION.checkinsTarget)),
    storiesTarget: Math.max(1, Math.min(21, Number(missionRaw.storiesTarget) || DEFAULT_MISSION.storiesTarget)),
    points: Math.max(1, Math.min(50, Number(missionRaw.points) || DEFAULT_MISSION.points)),
  };

  const codeRaw = source.surpriseCode && typeof source.surpriseCode === 'object' ? source.surpriseCode : {};
  const surpriseCode = {
    id: String(codeRaw.id || '').trim().slice(0, 100),
    label: String(codeRaw.label || 'Código surpresa da Central FF').trim().slice(0, 100),
    codeHash: String(codeRaw.codeHash || '').trim().toLowerCase(),
    points: Math.max(1, Math.min(50, Number(codeRaw.points) || 3)),
    endsAt: Number(codeRaw.endsAt || 0),
    active: Boolean(codeRaw.active) && Number(codeRaw.endsAt || 0) > Date.now(),
  };

  return { mission, surpriseCode };
}

async function getRewardConfig(force = false) {
  if (!force && rewardsCache.data && Date.now() - rewardsCache.at < 15_000) return rewardsCache.data;
  const data = normalizeRewardConfig(await fetchJson(REWARDS_URL));
  rewardsCache = { at: Date.now(), data };
  return data;
}

async function weeklySnapshot(env, userKeyValue, timestamp = Date.now()) {
  const week = weekKeys(timestamp);
  const stats = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN type='comment' THEN 1 ELSE 0 END) AS comments,
      COUNT(DISTINCT CASE WHEN type='comment' THEN source_id END) AS distinctPosts,
      SUM(CASE WHEN type='story' THEN 1 ELSE 0 END) AS stories,
      SUM(CASE WHEN type='checkin' THEN 1 ELSE 0 END) AS checkins,
      SUM(CASE WHEN type='prediction_vote' THEN 1 ELSE 0 END) AS predictions,
      MAX(CASE WHEN type='bonus_streak_3' THEN 1 ELSE 0 END) AS bonusStreak3,
      MAX(CASE WHEN type='bonus_streak_5' THEN 1 ELSE 0 END) AS bonusStreak5,
      MAX(CASE WHEN type='bonus_streak_7' THEN 1 ELSE 0 END) AS bonusStreak7,
      MAX(CASE WHEN type='bonus_posts_5' THEN 1 ELSE 0 END) AS bonusPosts5,
      MAX(CASE WHEN type='bonus_posts_10' THEN 1 ELSE 0 END) AS bonusPosts10,
      MAX(CASE WHEN type='bonus_mix' THEN 1 ELSE 0 END) AS bonusMix,
      MAX(CASE WHEN type='bonus_mission' THEN 1 ELSE 0 END) AS bonusMission,
      MAX(CASE WHEN type='bonus_flash' THEN 1 ELSE 0 END) AS bonusFlash,
      MAX(CASE WHEN type='bonus_code' THEN 1 ELSE 0 END) AS bonusCode,
      (
        SELECT COUNT(*)
        FROM active_days ad
        WHERE ad.user_key=?1 AND ad.day_key BETWEEN ?2 AND ?3
      ) AS activeDays
    FROM awards
    WHERE user_key=?1 AND day_key BETWEEN ?2 AND ?3
  `).bind(userKeyValue, week.weekStartKey, week.weekEndKey).first();

  return {
    week,
    progress: {
      activeDays: Number(stats?.activeDays || 0),
      comments: Number(stats?.comments || 0),
      distinctPosts: Number(stats?.distinctPosts || 0),
      stories: Number(stats?.stories || 0),
      checkins: Number(stats?.checkins || 0),
      predictions: Number(stats?.predictions || 0),
    },
    bonuses: {
      streak3: Boolean(stats?.bonusStreak3),
      streak5: Boolean(stats?.bonusStreak5),
      streak7: Boolean(stats?.bonusStreak7),
      posts5: Boolean(stats?.bonusPosts5),
      posts10: Boolean(stats?.bonusPosts10),
      mix: Boolean(stats?.bonusMix),
      mission: Boolean(stats?.bonusMission),
      flash: Boolean(stats?.bonusFlash),
      code: Boolean(stats?.bonusCode),
    },
  };
}

async function awardWeeklyBonus(env, base, type, keySuffix, points) {
  const week = weekKeys(base.timestamp);
  return awardInteraction(env, {
    awardKey: `bonus:${keySuffix}:${week.weekStartKey}:${base.userKey}`,
    userKey: base.userKey,
    identity: base.identity || '',
    username: base.username || 'usuario',
    type,
    sourceId: week.weekStartKey,
    points,
    timestamp: base.timestamp,
  });
}

async function evaluateWeeklyBonuses(env, base) {
  if (!base?.userKey) return;
  const config = await getRewardConfig(false);
  const snapshot = await weeklySnapshot(env, base.userKey, base.timestamp);
  const p = snapshot.progress;
  const jobs = [];

  if (p.activeDays >= 3) jobs.push(awardWeeklyBonus(env, base, 'bonus_streak_3', 'streak3', RULES.streak3Points));
  if (p.activeDays >= 5) jobs.push(awardWeeklyBonus(env, base, 'bonus_streak_5', 'streak5', RULES.streak5Points));
  if (p.activeDays >= 7) jobs.push(awardWeeklyBonus(env, base, 'bonus_streak_7', 'streak7', RULES.streak7Points));
  if (p.distinctPosts >= 5) jobs.push(awardWeeklyBonus(env, base, 'bonus_posts_5', 'posts5', RULES.posts5Points));
  if (p.distinctPosts >= 10) jobs.push(awardWeeklyBonus(env, base, 'bonus_posts_10', 'posts10', RULES.posts10Points));
  if (p.comments >= 1 && p.stories >= 1 && p.checkins >= 1) jobs.push(awardWeeklyBonus(env, base, 'bonus_mix', 'mix', RULES.completeMixPoints));

  const mission = config.mission;
  if (mission.active && p.distinctPosts >= mission.commentsTarget && p.checkins >= mission.checkinsTarget && p.stories >= mission.storiesTarget) {
    jobs.push(awardWeeklyBonus(env, base, 'bonus_mission', 'mission', mission.points));
  }

  await Promise.allSettled(jobs);
}

async function claimGoogleAccountBonus(request, env) {
  const firebaseUser = await verifyFirebaseUserToken(request);
  if (!firebaseUser) return json({ ok: false, error: 'Entre com sua conta Google novamente.' }, 401, request);

  let session = '';
  try {
    const response = await fetch(`${FIREBASE_BASE}/userAccounts/${encodeURIComponent(firebaseUser.uid)}/community/session.json?auth=${encodeURIComponent(firebaseUser.idToken)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.ok) session = String((await response.json()) || '').trim();
  } catch (_) {}

  if (!/^[a-f0-9]{48}$/i.test(session)) {
    return json({ ok: true, awarded: false, alreadyClaimed: false, pendingInstagram: true, points: RULES.googleAccountPoints }, 200, request);
  }

  const row = await getCheckinSession(env, session);
  if (!row?.verified_at || !row?.user_key) {
    return json({ ok: true, awarded: false, alreadyClaimed: false, pendingInstagram: true, points: RULES.googleAccountPoints }, 200, request);
  }

  const awarded = await awardInteraction(env, {
    awardKey: `bonus-google-account:${firebaseUser.uid}`,
    userKey: row.user_key,
    identity: row.instagram_id || '',
    username: row.username || fallbackUsername(row.instagram_id),
    type: 'bonus_google_account',
    sourceId: firebaseUser.uid,
    points: RULES.googleAccountPoints,
    timestamp: Date.now(),
  });

  return json({
    ok: true,
    awarded,
    alreadyClaimed: !awarded,
    pendingInstagram: false,
    points: RULES.googleAccountPoints,
    username: row.username || '',
  }, 200, request);
}

async function getRewardStatus(request, env, url) {
  const sessionId = String(url.searchParams.get('session') || '').trim();
  const config = await getRewardConfig(false);
  const row = sessionId ? await getCheckinSession(env, sessionId) : null;
  const linked = Boolean(row?.verified_at && row?.user_key);
  const publicCode = config.surpriseCode.active ? {
    active: true,
    id: config.surpriseCode.id,
    label: config.surpriseCode.label,
    points: config.surpriseCode.points,
    endsAt: config.surpriseCode.endsAt,
  } : { active: false };

  if (!linked) {
    const currentWeek = weekKeys(Date.now());
    return json({
      ok: true,
      linked: false,
      weekStart: currentWeek.weekStartKey,
      weekEnd: currentWeek.weekEndKey,
      mission: config.mission,
      surpriseCode: publicCode,
    }, 200, request);
  }

  await evaluateWeeklyBonuses(env, {
    userKey: row.user_key,
    identity: row.instagram_id || '',
    username: row.username || fallbackUsername(row.instagram_id),
    timestamp: Date.now(),
  });

  const snapshot = await weeklySnapshot(env, row.user_key, Date.now());
  const storyReview=await env.DB.prepare("SELECT COUNT(*) AS pending FROM story_reviews WHERE user_key=?1 AND week_key=?2 AND status='pending'").bind(row.user_key,snapshot.week.weekStartKey).first();
  return json({
    ok: true,
    linked: true,
    username: row.username,
    weekStart: snapshot.week.weekStartKey,
    weekEnd: snapshot.week.weekEndKey,
    storyReview: {pending:Number(storyReview?.pending||0),approvalRequired:false,autoApproval:true},
    progress: snapshot.progress,
    bonuses: snapshot.bonuses,
    mission: config.mission,
    surpriseCode: publicCode,
    rules: {
      streak3Points: RULES.streak3Points,
      streak5Points: RULES.streak5Points,
      streak7Points: RULES.streak7Points,
      posts5Points: RULES.posts5Points,
      posts10Points: RULES.posts10Points,
      completeMixPoints: RULES.completeMixPoints,
      fastCommentPoints: RULES.fastCommentPoints,
      fastCommentMinutes: RULES.fastCommentMinutes,
      googleAccountPoints: RULES.googleAccountPoints,
    },
  }, 200, request);
}

async function claimRewardCode(request, env) {
  const body = await readJson(request);
  const sessionId = String(body?.session || '').trim();
  const code = String(body?.code || '').trim().toUpperCase();
  if (code.length < 3 || code.length > 40) return json({ ok: false, error: 'Código inválido.' }, 400, request);

  const row = await getCheckinSession(env, sessionId);
  if (!row?.verified_at || !row?.user_key) return json({ ok: false, error: 'Vincule seu Instagram antes de resgatar.' }, 403, request);

  const config = await getRewardConfig(true);
  const item = config.surpriseCode;
  if (!item.active || !item.id || !item.codeHash || Date.now() >= item.endsAt) return json({ ok: false, error: 'Não há código surpresa ativo agora.' }, 409, request);

  const digest = await sha256(code);
  if (!timingSafeStringEqual(digest.toLowerCase(), item.codeHash.toLowerCase())) return json({ ok: false, error: 'Código incorreto.' }, 400, request);

  const awarded = await awardInteraction(env, {
    awardKey: `bonus-code:${item.id}:${row.user_key}`,
    userKey: row.user_key,
    identity: row.instagram_id || '',
    username: row.username || fallbackUsername(row.instagram_id),
    type: 'bonus_code',
    sourceId: item.id,
    points: item.points,
    timestamp: Date.now(),
  });

  if (awarded) {
    await evaluateWeeklyBonuses(env, {
      userKey: row.user_key,
      identity: row.instagram_id || '',
      username: row.username || fallbackUsername(row.instagram_id),
      timestamp: Date.now(),
    });
  }

  return json({ ok: true, awarded, alreadyClaimed: !awarded, points: awarded ? item.points : 0, username: row.username }, 200, request);
}

async function awardInteraction(env, event) {
  const timestamp = normalizeTimestamp(event.timestamp);
  const { monthKey, dayKey } = dateKeys(timestamp);
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
    Number(event.points || 0),
    dayKey,
    monthKey,
    now
  ).run();
  if (!inserted.meta?.changes) return false;

  let newDay = 0;
  if (ACTIVE_TYPES.has(event.type)) {
    const activeInsert = await env.DB.prepare(`
      INSERT OR IGNORE INTO active_days (user_key, day_key)
      VALUES (?1, ?2)
    `).bind(event.userKey, dayKey).run();
    newDay = activeInsert.meta?.changes ? 1 : 0;
  }

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
    `).bind(event.userKey, event.identity || null, event.username, Number(event.points || 0), storyInc, commentInc, newDay, timestamp),
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
    `).bind(monthKey, event.userKey, event.username, Number(event.points || 0), storyInc, commentInc, newDay, timestamp),
  ]);
  // Current public rankings may lag by at most five minutes; new awards do not defeat the shared cache.

  if (!String(event.type || '').startsWith('bonus_')) {
    try {
      await evaluateWeeklyBonuses(env, {
        userKey: event.userKey,
        identity: event.identity || '',
        username: event.username,
        timestamp,
      });
    } catch (error) {
      console.error('Weekly bonus evaluation failed', error);
    }
  }

  return true;
}

async function computeMonthlySnapshot(env, monthKey) {
  const bounds = monthKeyBounds(monthKey);
  if (!bounds) return null;
  const result = await env.DB.prepare(`
    WITH month_awards AS (
      SELECT a.user_key,
             COALESCE(MAX(u.username), MAX(a.username)) AS username,
             SUM(a.points) AS points,
             SUM(CASE WHEN a.type='story' THEN 1 ELSE 0 END) AS storyMentions,
             SUM(CASE WHEN a.type='comment' THEN 1 ELSE 0 END) AS comments,
             MAX(a.created_at) AS lastInteractionAt
      FROM awards a
      LEFT JOIN users u ON u.user_key = a.user_key
      WHERE a.month_key = ?1
      GROUP BY a.user_key
    ),
    month_active AS (
      SELECT user_key, COUNT(*) AS activeDays
      FROM active_days
      WHERE day_key BETWEEN ?2 AND ?3
      GROUP BY user_key
    )
    SELECT m.user_key,
           m.username,
           m.points,
           m.storyMentions,
           m.comments,
           COALESCE(d.activeDays, 0) AS activeDays,
           m.lastInteractionAt
    FROM month_awards m
    LEFT JOIN month_active d ON d.user_key = m.user_key
    ORDER BY m.points DESC, activeDays DESC, m.storyMentions DESC, m.comments DESC, m.username ASC
    LIMIT 500
  `).bind(monthKey, bounds.firstDay, bounds.lastDay).all();

  const coverage = await monthCoverage(env.DB, monthKey);

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
  const ranked = Object.entries(users);
  const winnerEntry = ranked[0] || null;
  return {
    month: monthKey,
    participants: ranked.length,
    firstDay: String(coverage?.firstDay || ''),
    lastDay: String(coverage?.lastDay || ''),
    updatedAt,
    winner: winnerEntry ? { userKey: winnerEntry[0], ...winnerEntry[1] } : null,
    users,
  };
}

async function computeWeeklySnapshot(env,weekStart) {
  const week=weekKeys(dayKeyTimestamp(weekStart));
  const result=await env.DB.prepare(`
      WITH week_awards AS (
        SELECT user_key,
               MAX(username) AS username,
               SUM(points) AS points,
               SUM(CASE WHEN type='story' THEN 1 ELSE 0 END) AS storyMentions,
               SUM(CASE WHEN type='comment' THEN 1 ELSE 0 END) AS comments,
               MAX(created_at) AS lastInteractionAt
        FROM awards
        WHERE day_key BETWEEN ?1 AND ?2
        GROUP BY user_key
      ),
      week_active AS (
        SELECT user_key, COUNT(*) AS activeDays
        FROM active_days
        WHERE day_key BETWEEN ?1 AND ?2
        GROUP BY user_key
      )
      SELECT w.user_key,
             COALESCE(u.username, w.username) AS username,
             w.points,
             w.storyMentions,
             w.comments,
             COALESCE(a.activeDays, 0) AS activeDays,
             w.lastInteractionAt
      FROM week_awards w
      LEFT JOIN users u ON u.user_key = w.user_key
      LEFT JOIN week_active a ON a.user_key = w.user_key
      ORDER BY w.points DESC, activeDays DESC, w.storyMentions DESC, w.comments DESC, username ASC
    `).bind(week.weekStartKey,week.weekEndKey).all();
  const rows=result.results||[],users={};let updatedAt=0;
  for(const row of rows.slice(0,500)) {
    users[row.user_key]={username:row.username,points:Number(row.points||0),storyMentions:Number(row.storyMentions||0),
      comments:Number(row.comments||0),activeDays:Number(row.activeDays||0),lastInteractionAt:Number(row.lastInteractionAt||0)};
    updatedAt=Math.max(updatedAt,Number(row.lastInteractionAt||0));
  }
  const first=rows[0];
  return {...week,participants:rows.length,updatedAt,users,winner:first?{userKey:first.user_key,...users[first.user_key]}:null};
}
async function getOrCreateWeeklySnapshot(env,weekStart) {
  for(let attempt=0;attempt<2;attempt++) {
    const row=await env.DB.prepare('SELECT payload FROM weekly_ranking_snapshots WHERE week_key=?1').bind(weekStart).first();
    if(row?.payload){try{return JSON.parse(row.payload)}catch(_){}}
    const version=await periodVersion(env.DB,'week:'+weekStart);
    const snapshot=await computeWeeklySnapshot(env,weekStart);
    if(await savePeriodSnapshot(env.DB,'weekly_ranking_snapshots','week_key',weekStart,'week:'+weekStart,version,snapshot))return snapshot;
  }
  return computeWeeklySnapshot(env,weekStart);
}
async function closedWeekKeys(env,limit) {
  const current=weekKeys().weekStartKey;
  return cachedPublic(env.DB,`closed-weeks:${current}:${limit||'all'}`,86_400_000,async()=>{
    const cutoff=limit?shiftDayKey(current,-(limit+2)*7):'0000-01-01';
    const result=await env.DB.prepare(`SELECT DISTINCT date(day_key,'-'||((CAST(strftime('%w',day_key) AS INTEGER)+6)%7)||' days') AS weekStart
      FROM awards WHERE day_key>=?1 AND day_key<?2 ORDER BY weekStart DESC`).bind(cutoff,current).all();
    const keys=(result.results||[]).map(row=>row.weekStart);
    return limit?keys.slice(0,limit):keys;
  });
}
async function weeklySummaries(env,limit) {
  const keys=await closedWeekKeys(env,limit),rows=[];
  for(let i=0;i<keys.length;i+=8)rows.push(...await Promise.all(keys.slice(i,i+8).map(key=>getOrCreateWeeklySnapshot(env,key))));
  return rows.filter(row=>row.winner).map(row=>({weekKey:row.weekKey,weekStart:row.weekStartKey,weekEnd:row.weekEndKey,participants:row.participants,winner:row.winner}));
}
async function weeklyWinnerCount(env,userKey,username) {
  const rows=await cachedPublic(env.DB,`history:${weekKeys().weekStartKey}:all`,900_000,()=>weeklySummaries(env,0));
  return {wins:rows.filter(row=>row.winner.userKey===userKey||String(row.winner.username||'').toLowerCase()===username).length};
}

async function getOrCreateMonthlySnapshot(env, monthKey) {
  if(!validMonthKey(monthKey)||monthKey>=dateKeys(Date.now()).monthKey)return null;
  for(let attempt=0;attempt<2;attempt++) {
    const existing=await env.DB.prepare('SELECT payload FROM monthly_ranking_snapshots WHERE month_key=?1').bind(monthKey).first();
    if(existing?.payload){try{return JSON.parse(existing.payload)}catch(_){}}
    const version=await periodVersion(env.DB,'month:'+monthKey);
    const snapshot=await computeMonthlySnapshot(env,monthKey);
    if(!snapshot)return null;
    if(await savePeriodSnapshot(env.DB,'monthly_ranking_snapshots','month_key',monthKey,'month:'+monthKey,version,snapshot))return snapshot;
  }
  return computeMonthlySnapshot(env,monthKey);
}

async function closedMonthKeys(env, limit = 60) {
  const currentMonth = dateKeys(Date.now()).monthKey;
  const rows = await env.DB.prepare(`
    SELECT month_key AS monthKey
    FROM ranking_month_catalog
    WHERE month_key < ?1
    ORDER BY month_key DESC
    LIMIT ?2
  `).bind(currentMonth, Math.max(1, Math.min(Number(limit) || 60, 60))).all();
  return (rows.results || []).map(row => String(row.monthKey || '')).filter(validMonthKey);
}

async function monthlySummaries(env) {
  const currentMonth = dateKeys(Date.now()).monthKey;
  return cachedPublic(env.DB, `history:months:${currentMonth}`, 86_400_000, async () => {
    const months = await closedMonthKeys(env, 60), snapshots = [];
    for (let i = 0; i < months.length; i += 8) {
      snapshots.push(...await Promise.all(months.slice(i, i + 8).map(month => getOrCreateMonthlySnapshot(env, month))));
    }
    return snapshots.filter(Boolean).map(snapshot => ({
      month: snapshot.month,
      participants: Number(snapshot.participants || 0),
      firstDay: String(snapshot.firstDay || ''),
      lastDay: String(snapshot.lastDay || ''),
      winner: snapshot.winner || null,
      frozen: true,
    }));
  }, "SELECT COALESCE(SUM(version),0) AS version FROM community_period_versions WHERE period_key LIKE 'month:%'");
}

async function publicRankingResponse(request,env,url) {
  const period=String(url.searchParams.get('period')||'week').toLowerCase();
  const month=String(url.searchParams.get('month')||dateKeys().monthKey);
  if(period==='month'&&!validMonthKey(month))return getRanking(request,env,url);
  const week=weekKeys(dayKeyTimestamp(url.searchParams.get('week'))||Date.now()).weekStartKey;
  const normalized=['week','month','all'].includes(period)?period:'week';
  const key=`ranking:${normalized}:${normalized==='week'?week:normalized==='month'?month:'all'}`;
  const payload=await cachedPublic(env.DB,key,RANKING_CACHE_TTL_MS,async()=>{
    const response=await getRanking(request,env,url);
    if(!response.ok)throw new Error('Ranking could not be cached');
    return response.json();
  });
  // week= marks an historical request even if its actual week is the current week.
  const historical=normalized==='week'?Boolean(dayKeyTimestamp(url.searchParams.get('week'))):normalized==='month'?month!==dateKeys().monthKey:false;
  return json({...payload,period:{...payload.period,historical}},200,request,{'Cache-Control':'public, max-age=300'});
}

async function getRanking(request, env, url) {
  const requested = String(url.searchParams.get('period') || 'week').toLowerCase();
  const period = ['week', 'month', 'all'].includes(requested) ? requested : 'week';
  const now = Date.now();
  const currentMonthKey = dateKeys(now).monthKey;
  const requestedMonth = String(url.searchParams.get('month') || '').trim();
  if (period === 'month' && requestedMonth && !validMonthKey(requestedMonth)) {
    return json({ ok: false, error: 'Mês inválido. Use YYYY-MM.' }, 400, request);
  }
  const monthKey = period === 'month' && requestedMonth ? requestedMonth : currentMonthKey;
  const monthBounds = monthKeyBounds(monthKey);
  const requestedWeek = String(url.searchParams.get('week') || '').trim();
  const requestedWeekTimestamp = period === 'week' ? dayKeyTimestamp(requestedWeek) : null;
  const weekInfo = weekKeys(requestedWeekTimestamp || now);
  const { weekKey, weekStartKey, weekEndKey } = weekInfo;

  if(period==='week'&&weekStartKey<weekKeys(now).weekStartKey) {
    const snapshot=await getOrCreateWeeklySnapshot(env,weekStartKey);
    return json({updatedAt:snapshot.updatedAt,rules:RULES,period:{type:'week',weekKey,weekStart:weekStartKey,weekEnd:weekEndKey,
      monthKey,historical:true,frozen:true,firstRecordedDay:'',lastRecordedDay:''},users:snapshot.users},200,request,{'Cache-Control':'public, max-age=300'});
  }

  if (period === 'month' && monthKey < currentMonthKey) {
    const snapshot = await getOrCreateMonthlySnapshot(env, monthKey);
    if (snapshot) {
      const payload = {
        updatedAt: Number(snapshot.updatedAt || 0),
        rules: RULES,
        period: {
          type: 'month',
          weekKey,
          weekStart: weekStartKey,
          weekEnd: weekEndKey,
          monthKey,
          historical: true,
          frozen: true,
          firstRecordedDay: String(snapshot.firstDay || ''),
          lastRecordedDay: String(snapshot.lastDay || ''),
        },
        users: snapshot.users || {},
      };
      return json(payload, 200, request, { 'Cache-Control': 'public, max-age=300' });
    }
  }

  let result;
  if (period === 'all') {
    result = await env.DB.prepare(`
      SELECT user_key, username, points_all AS points,
             story_mentions_all AS storyMentions,
             comments_all AS comments,
             active_days_all AS activeDays,
             last_interaction_at AS lastInteractionAt
      FROM users
      ORDER BY points_all DESC, active_days_all DESC, story_mentions_all DESC, comments_all DESC
      LIMIT 500
    `).all();
  } else if (period === 'month') {
    result = await env.DB.prepare(`
      WITH month_awards AS (
        SELECT a.user_key,
               COALESCE(MAX(u.username), MAX(a.username)) AS username,
               SUM(a.points) AS points,
               SUM(CASE WHEN a.type='story' THEN 1 ELSE 0 END) AS storyMentions,
               SUM(CASE WHEN a.type='comment' THEN 1 ELSE 0 END) AS comments,
               MAX(a.created_at) AS lastInteractionAt
        FROM awards a
        LEFT JOIN users u ON u.user_key = a.user_key
        WHERE a.month_key = ?1
        GROUP BY a.user_key
      ),
      month_active AS (
        SELECT user_key, COUNT(*) AS activeDays
        FROM active_days
        WHERE day_key BETWEEN ?2 AND ?3
        GROUP BY user_key
      )
      SELECT m.user_key,
             m.username,
             m.points,
             m.storyMentions,
             m.comments,
             COALESCE(d.activeDays, 0) AS activeDays,
             m.lastInteractionAt
      FROM month_awards m
      LEFT JOIN month_active d ON d.user_key = m.user_key
      ORDER BY m.points DESC, activeDays DESC, m.storyMentions DESC, m.comments DESC, m.username ASC
      LIMIT 500
    `).bind(monthKey, monthBounds.firstDay, monthBounds.lastDay).all();
  } else {
    result = await env.DB.prepare(`
      WITH week_awards AS (
        SELECT user_key,
               MAX(username) AS username,
               SUM(points) AS points,
               SUM(CASE WHEN type='story' THEN 1 ELSE 0 END) AS storyMentions,
               SUM(CASE WHEN type='comment' THEN 1 ELSE 0 END) AS comments,
               MAX(created_at) AS lastInteractionAt
        FROM awards
        WHERE day_key BETWEEN ?1 AND ?2
        GROUP BY user_key
      ),
      week_active AS (
        SELECT user_key, COUNT(*) AS activeDays
        FROM active_days
        WHERE day_key BETWEEN ?1 AND ?2
        GROUP BY user_key
      )
      SELECT w.user_key,
             COALESCE(u.username, w.username) AS username,
             w.points,
             w.storyMentions,
             w.comments,
             COALESCE(a.activeDays, 0) AS activeDays,
             w.lastInteractionAt
      FROM week_awards w
      LEFT JOIN users u ON u.user_key = w.user_key
      LEFT JOIN week_active a ON a.user_key = w.user_key
      ORDER BY w.points DESC, activeDays DESC, w.storyMentions DESC, w.comments DESC, username ASC
      LIMIT 500
    `).bind(weekStartKey, weekEndKey).all();
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

  let firstRecordedDay = '';
  let lastRecordedDay = '';
  if (period === 'month') {
    const coverage = await monthCoverage(env.DB, monthKey);
    firstRecordedDay = String(coverage?.firstDay || '');
    lastRecordedDay = String(coverage?.lastDay || '');
  }

  const payload = {
    updatedAt,
    rules: RULES,
    period: {
      type: period,
      weekKey,
      weekStart: weekStartKey,
      weekEnd: weekEndKey,
      monthKey,
      historical: (period === 'week' && Boolean(requestedWeekTimestamp)) || (period === 'month' && monthKey !== currentMonthKey),
      firstRecordedDay,
      lastRecordedDay,
    },
    users,
  };

  return json(payload, 200, request, { 'Cache-Control': 'public, max-age=60' });
}


async function getMonthlyHistory(request, env, url) {
  const rawLimit = Number(url.searchParams.get('limit') || 24);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 24, 60));
  const history = (await monthlySummaries(env)).slice(0, limit);
  return json({ ok: true, frozen: true, history }, 200, request, { 'Cache-Control': 'public, max-age=3600' });
}

async function getAchievementProfile(request, env, url) {
  const username = cleanUsername(url.searchParams.get('username') || '').toLowerCase();
  if (!username) return json({ ok: false, error: 'Perfil inválido.' }, 400, request);

  let user = await env.DB.prepare(`
    SELECT user_key, username, points_all, story_mentions_all, comments_all, active_days_all
    FROM users
    WHERE lower(username)=?1
    ORDER BY last_interaction_at DESC
    LIMIT 1
  `).bind(username).first();

  if (!user?.user_key) {
    const fallback = await env.DB.prepare(`
      SELECT user_key, MAX(username) AS username
      FROM awards
      WHERE lower(username)=?1
      GROUP BY user_key
      ORDER BY MAX(created_at) DESC
      LIMIT 1
    `).bind(username).first();
    if (!fallback?.user_key) return json({ ok: true, username, found: false, metrics: {} }, 200, request, { 'Cache-Control': 'public, max-age=120' });
    user = { user_key: fallback.user_key, username: fallback.username, points_all: 0, story_mentions_all: 0, comments_all: 0, active_days_all: 0 };
  }

  const userKey = String(user.user_key);
  const currentWeek = weekKeys(Date.now());
  const [prediction, checkins, weeklyWinners, months] = await Promise.all([
    env.DB.prepare(`
      SELECT
        SUM(CASE WHEN type='prediction_vote' THEN 1 ELSE 0 END) AS votes,
        SUM(CASE WHEN type IN ('prediction_correct','prediction_nearest') THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN type='prediction_combo' THEN 1 ELSE 0 END) AS combos
      FROM awards
      WHERE user_key=?1
    `).bind(userKey).first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM awards WHERE user_key=?1 AND type='checkin'").bind(userKey).first(),
    weeklyWinnerCount(env,userKey,username),
    monthlySummaries(env),
  ]);

  const monthWins = months.filter(s => s?.winner?.userKey === userKey || String(s?.winner?.username||'').toLowerCase() === username).length;

  const metrics = {
    total_points: Number(user.points_all || 0),
    week_wins: Number(weeklyWinners?.wins || 0),
    month_wins: monthWins,
    prediction_wins: Number(prediction?.wins || 0),
    prediction_votes: Number(prediction?.votes || 0),
    prediction_combo: Number(prediction?.combos || 0),
    active_days: Number(user.active_days_all || 0),
    comments: Number(user.comments_all || 0),
    stories: Number(user.story_mentions_all || 0),
    checkins: Number(checkins?.total || 0),
  };

  return json({
    ok: true,
    found: true,
    userKey,
    username: String(user.username || username),
    metrics,
    frozenMonths: months.length,
  }, 200, request, { 'Cache-Control': 'public, max-age=120' });
}

async function getWeeklyHistory(request,env,url) {
  const rawLimit=Number(url.searchParams.get('limit') || 24);
  const limit=Math.max(1,Math.min(Number.isFinite(rawLimit)?Math.floor(rawLimit):24,104));
  const current=weekKeys();
  const history=await cachedPublic(env.DB,`history:${current.weekStartKey}:${limit}`,900_000,()=>weeklySummaries(env,limit));
  return json({currentWeek:{weekKey:current.weekKey,weekStart:current.weekStartKey,weekEnd:current.weekEndKey},history},200,request,{'Cache-Control':'public, max-age=300'});
}

async function logEntryShape(env, entry) {
  const summary = {
    entryKeys: Object.keys(entry || {}),
    hasChanges: Array.isArray(entry?.changes),
    changeFields: Array.isArray(entry?.changes) ? entry.changes.map(change => String(change?.field || '')).filter(Boolean) : [],
    hasMessaging: Array.isArray(entry?.messaging),
    time: Number(entry?.time || 0),
  };
  await env.DB.prepare('INSERT INTO raw_events (kind,payload,received_at) VALUES (?1,?2,?3)').bind('unrecognized_entry', JSON.stringify(summary), Date.now()).run();
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
  await env.DB.prepare('INSERT INTO raw_events (kind,payload,received_at) VALUES (?1,?2,?3)').bind('unrecognized_change', JSON.stringify(summary), Date.now()).run();
}

async function logMessagingShape(env, event) {
  const message = event?.message || {};
  const attachments = Array.isArray(message.attachments) ? message.attachments : message.attachment ? [message.attachment] : [];
  const summary = {
    eventKeys: Object.keys(event || {}),
    messageKeys: Object.keys(message),
    attachmentTypes: attachments.map(a => String(a?.type || '')).filter(Boolean),
    hasReferral: Boolean(event?.referral),
    referralSource: String(event?.referral?.source || ''),
    referralType: String(event?.referral?.type || ''),
    messageId: String(message?.mid || ''),
    hasText: Boolean(message?.text),
    timestamp: Number(event?.timestamp || 0),
  };
  await env.DB.prepare('INSERT INTO raw_events (kind,payload,received_at) VALUES (?1,?2,?3)').bind('unrecognized_message', JSON.stringify(summary), Date.now()).run();
}

async function getCommunityProfile(request,env,url){
 const username=cleanHandle(url.searchParams.get('username'));if(!username)return json({ok:false,error:'Perfil inválido.'},400,request);
 try{
  // Bootstrap known closed rounds even when the scoring settlement was completed earlier.
  await cachedPublic(env.DB,'profile-outcomes-bootstrap:v1',300000,async()=>{const [manual,auto]=await Promise.all([fetchManualPrediction(),automaticPredictionData()]);await captureOutcomes(env.DB,[manual,...(auto?.pairs||[]).flatMap(item=>item.predictions||[])]);return {ok:true};});
  const payload=await profileInsights(env.DB,username,parseVoteSource);return json(payload,200,request,{'Cache-Control':'public, max-age=60'});
 }catch(error){console.error('Community profile unavailable',error?.message);return json({ok:false,error:'Não foi possível carregar o perfil agora.'},503,request);}
}
async function getCommunityPeers(request,env,url){
 const raw=String(url.searchParams.get('usernames')||'').split(',');const period=url.searchParams.get('period')||'week';
 if(!raw.length||raw.length>100||raw.some(s=>!cleanHandle(s))||!['week','month','all'].includes(period))return json({ok:false,error:'Perfis ou período inválidos.'},400,request);
 try{return json({ok:true,...await peerScores(env.DB,raw,period)},200,request,{'Cache-Control':'public, max-age=60'});}catch{return json({ok:false,error:'Não foi possível comparar agora.'},503,request);}
}
