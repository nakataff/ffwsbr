const RULES = Object.freeze({
  storyMentionPoints: 10,
  commentPoints: 2,
  checkinPoints: 1,
  storyMentionDailyLimit: 3,
  commentLimitPerMedia: 1,
  ffwsPredictionParticipationPoints: 1,
  ffwsPredictionNearestPoints: 5,
});

const GRAPH_VERSION = 'v26.0';
const TIME_ZONE = 'America/Sao_Paulo';
const CHECKIN_CODE_TTL_MS = 15 * 60 * 1000;
const SITE_BASE = 'https://centralfreefire.com.br/';
const PREDICTION_URL = 'https://central-free-fire-default-rtdb.firebaseio.com/ffwsLive/communityPrediction.json';
const LIVE_SECOND_URL = 'https://central-free-fire-default-rtdb.firebaseio.com/ffwsLive/2026-s2/segundaFase.json';
const DATES_URL = `${SITE_BASE}ffws-br-2026-s2/dates.json`;
const LOGOS_URL = `${SITE_BASE}team-data/logo-map.json`;
const SECOND_PHASE_TEAMS = Object.freeze([
  'LOS','LOUD SNICKERS','FLUXO W7M','INTZ','TEAM SOLID','RISE GAMING',
  'ALPHA7','RUSH GAMING','INFLUENCE RAGE','CPT VOX','AFROGAMES','SX TET'
]);
const FALLBACK_SECOND_DATES = Object.freeze([
  { round:1,date:'2026-09-19',time24:'13:00' },{ round:2,date:'2026-09-20',time24:'13:00' },
  { round:3,date:'2026-09-26',time24:'13:00' },{ round:4,date:'2026-09-27',time24:'13:00' },
  { round:5,date:'2026-10-03',time24:'13:00' },{ round:6,date:'2026-10-04',time24:'13:00' }
]);
const ALLOWED_ORIGINS = new Set([
  'https://centralfreefire.com.br',
  'https://www.centralfreefire.com.br',
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
    if (url.pathname === '/health') return json({ ok: true, service: 'Central Free Fire Instagram Community' }, 200, request);

    if (url.pathname === '/webhook') {
      if (request.method === 'GET') return verifyWebhook(url, env);
      if (request.method === 'POST') return receiveWebhook(request, env);
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (url.pathname === '/api/ranking' && request.method === 'GET') return getRanking(request, env, url);
    if (url.pathname === '/api/ranking/history' && request.method === 'GET') return getWeeklyHistory(request, env, url);
    if (url.pathname === '/api/predictions' && request.method === 'GET') return getPredictions(request, env, url, ctx);
    if (url.pathname === '/api/prediction' && request.method === 'GET') return getPredictionLegacy(request, env, url, ctx);
    if (url.pathname === '/api/prediction/vote' && request.method === 'POST') return votePrediction(request, env, ctx);
    if (url.pathname === '/api/prediction/ranking' && request.method === 'GET') return getPredictionRanking(request, env, url);
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
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(data, status = 200, request = null, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders };
  if (request) Object.assign(headers, corsHeaders(request));
  return new Response(JSON.stringify(data), { status, headers });
}

async function readJson(request) { try { return await request.json(); } catch (_) { return {}; } }
function normalizeTimestamp(value) { const n = Number(value); if (!Number.isFinite(n) || n <= 0) return Date.now(); return n < 1_000_000_000_000 ? n * 1000 : n; }

function dateKeys(timestamp = Date.now()) {
  const normalized = normalizeTimestamp(timestamp);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(normalized));
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
  const data = new Uint8Array(bytes); crypto.getRandomValues(data);
  return [...data].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomCheckinCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const data = new Uint8Array(6); crypto.getRandomValues(data);
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
  const left = new TextEncoder().encode(String(a || '')), right = new TextEncoder().encode(String(b || ''));
  if (left.length !== right.length) return false;
  let diff = 0; for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function receiveWebhook(request, env) {
  const rawBody = await request.arrayBuffer();
  const signature = request.headers.get('x-hub-signature-256') || '';
  if (!(await validMetaSignature(rawBody, signature, env.META_APP_SECRET))) return new Response('Invalid signature', { status: 401 });

  let body; try { body = JSON.parse(new TextDecoder().decode(rawBody)); } catch (_) { return new Response('Invalid JSON', { status: 400 }); }
  if (!body || body.object !== 'instagram' || !Array.isArray(body.entry)) return new Response('EVENT_RECEIVED', { status: 200 });

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
        if (story) await processStoryMention(env, event, story); else await logMessagingShape(env, event);
      }
      if (!changes.length && !messaging.length && entry?.field !== 'comments') await logEntryShape(env, entry);
    } catch (error) { console.error('Instagram event processing error', error); }
  }
  return new Response('EVENT_RECEIVED', { status: 200 });
}

async function processComment(env, entry) {
  const value = entry.value || {}, from = value.from || {}, media = value.media || {};
  const username = cleanUsername(from.username), identity = String(from.id || username || '').trim();
  const mediaId = String(media.id || '').trim(), commentId = String(value.id || '').trim();
  if (!identity || (!mediaId && !commentId)) return;
  const key = await userKey(identity, username);
  await awardInteraction(env, { awardKey: `comment:${key}:${mediaId || commentId}`, userKey: key, identity, username: username || fallbackUsername(identity), type: 'comment', sourceId: mediaId || commentId, points: RULES.commentPoints, timestamp: normalizeTimestamp(entry.time) });
}

function findStoryMention(event) {
  const referral = event?.referral;
  if (referral && String(referral.source || '').toUpperCase() === 'STORY_MENTION') return { storyId: String(referral?.story?.id || event?.message?.mid || event?.timestamp || ''), messageId: String(event?.message?.mid || '') };
  const message = event?.message || {};
  const attachments = Array.isArray(message.attachments) ? message.attachments : message.attachment ? [message.attachment] : [];
  const mention = attachments.find((item) => ['story_mention', 'STORY_MENTION'].includes(String(item?.type || '')));
  if (!mention) return null;
  const payload = mention.payload || {};
  return { storyId: String(payload.id || payload.story_id || message.mid || event.timestamp || ''), messageId: String(message.mid || '') };
}

async function processStoryMention(env, event, story) {
  const identity = String(event?.sender?.id || '').trim(); if (!identity) return;
  let username = cleanUsername(event?.sender?.username);
  if (!username && story.messageId) username = await fetchMessageUsername(story.messageId, env.INSTAGRAM_ACCESS_TOKEN);
  const timestamp = normalizeTimestamp(event.timestamp), key = await userKey(identity, username), { dayKey } = dateKeys(timestamp);
  const daily = await env.DB.prepare('SELECT count FROM story_daily WHERE user_key = ?1 AND day_key = ?2').bind(key, dayKey).first();
  if (Number(daily?.count || 0) >= RULES.storyMentionDailyLimit) return;
  const awarded = await awardInteraction(env, { awardKey: `story:${key}:${story.storyId || story.messageId || timestamp}`, userKey: key, identity, username: username || fallbackUsername(identity), type: 'story', sourceId: story.storyId || story.messageId, points: RULES.storyMentionPoints, timestamp });
  if (awarded) await env.DB.prepare(`INSERT INTO story_daily (user_key, day_key, count) VALUES (?1, ?2, 1) ON CONFLICT(user_key, day_key) DO UPDATE SET count = count + 1`).bind(key, dayKey).run();
}

async function fetchMessageUsername(messageId, accessToken) {
  if (!messageId || !accessToken) return '';
  try {
    const url = new URL(`https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(messageId)}`);
    url.searchParams.set('fields', 'id,from'); url.searchParams.set('access_token', accessToken);
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!response.ok) return '';
    const data = await response.json(); return cleanUsername(data?.from?.username);
  } catch (_) { return ''; }
}

async function processCheckinVerification(env, event) {
  const message = event?.message || {}; if (message?.is_echo) return false;
  const text = String(message?.text || '').trim().toUpperCase();
  const match = text.match(/\bNKT-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}\b/); if (!match) return false;
  const now = Date.now();
  const pending = await env.DB.prepare(`SELECT session_id FROM checkin_sessions WHERE code = ?1 AND verified_at IS NULL AND expires_at >= ?2 LIMIT 1`).bind(match[0], now).first();
  if (!pending?.session_id) return false;
  const identity = String(event?.sender?.id || '').trim(); if (!identity) return false;
  let username = cleanUsername(event?.sender?.username); const messageId = String(message?.mid || '');
  if (!username && messageId) username = await fetchMessageUsername(messageId, env.INSTAGRAM_ACCESS_TOKEN);
  const key = await userKey(identity, username);
  const result = await env.DB.prepare(`UPDATE checkin_sessions SET user_key = ?1, instagram_id = ?2, username = ?3, verified_at = ?4, expires_at = 0 WHERE session_id = ?5 AND verified_at IS NULL`).bind(key, identity, username || fallbackUsername(identity), now, pending.session_id).run();
  return Boolean(result.meta?.changes);
}

async function startCheckin(request, env) {
  const now = Date.now();
  await env.DB.prepare('DELETE FROM checkin_sessions WHERE verified_at IS NULL AND expires_at < ?1').bind(now - 60_000).run();
  for (let attempt = 0; attempt < 6; attempt++) {
    const sessionId = randomToken(24), code = randomCheckinCode(), expiresAt = now + CHECKIN_CODE_TTL_MS;
    const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO checkin_sessions (session_id, code, expires_at, created_at, last_used_at) VALUES (?1, ?2, ?3, ?4, 0)`).bind(sessionId, code, expiresAt, now).run();
    if (inserted.meta?.changes) return json({ ok: true, status: 'pending', session: sessionId, code, expiresAt, instagram: '@nakataff', checkinPoints: RULES.checkinPoints }, 200, request);
  }
  return json({ ok: false, error: 'Não foi possível gerar o código agora.' }, 503, request);
}

async function getCheckinSession(env, sessionId) {
  if (!sessionId || !/^[a-f0-9]{48}$/i.test(sessionId)) return null;
  return env.DB.prepare(`SELECT session_id, code, user_key, instagram_id, username, verified_at, expires_at, created_at, last_used_at FROM checkin_sessions WHERE session_id = ?1`).bind(sessionId).first();
}

async function checkinStatus(request, env, url) {
  const sessionId = String(url.searchParams.get('session') || '').trim();
  const row = await getCheckinSession(env, sessionId); if (!row) return json({ ok: false, status: 'missing' }, 404, request);
  const now = Date.now();
  if (!row.verified_at && Number(row.expires_at || 0) < now) return json({ ok: true, status: 'expired' }, 200, request);
  if (!row.verified_at || !row.user_key) return json({ ok: true, status: 'pending', code: row.code, expiresAt: Number(row.expires_at || 0), checkinPoints: RULES.checkinPoints }, 200, request);
  const { dayKey } = dateKeys(now), awardKey = `checkin:${row.user_key}:${dayKey}`;
  const award = await env.DB.prepare('SELECT 1 AS found FROM awards WHERE award_key = ?1 LIMIT 1').bind(awardKey).first();
  return json({ ok: true, status: 'verified', username: row.username, checkedInToday: Boolean(award?.found), dayKey, checkinPoints: RULES.checkinPoints }, 200, request);
}

async function doCheckin(request, env) {
  const body = await readJson(request), sessionId = String(body?.session || '').trim(), row = await getCheckinSession(env, sessionId);
  if (!row) return json({ ok: false, error: 'Sessão não encontrada.' }, 404, request);
  if (!row.verified_at || !row.user_key) return json({ ok: false, error: 'Vincule seu Instagram antes do check-in.' }, 403, request);
  const timestamp = Date.now(), { dayKey } = dateKeys(timestamp);
  const awarded = await awardInteraction(env, { awardKey: `checkin:${row.user_key}:${dayKey}`, userKey: row.user_key, identity: row.instagram_id || '', username: row.username || fallbackUsername(row.instagram_id), type: 'checkin', sourceId: dayKey, points: RULES.checkinPoints, timestamp });
  await env.DB.prepare('UPDATE checkin_sessions SET last_used_at = ?1 WHERE session_id = ?2').bind(timestamp, sessionId).run();
  return json({ ok: true, awarded, alreadyCheckedIn: !awarded, points: awarded ? RULES.checkinPoints : 0, username: row.username, dayKey }, 200, request);
}

function cleanOptionId(value, fallback = 'o') {
  const clean = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return clean || fallback;
}

function absoluteLogo(value) {
  const raw = String(value || '').trim(); if (!raw) return '';
  try { return new URL(raw, SITE_BASE).toString(); } catch (_) { return ''; }
}

function normalizePrediction(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim().slice(0, 100), question = String(raw.question || '').trim().slice(0, 180);
  const source = Array.isArray(raw.options) ? raw.options : Object.values(raw.options || {});
  const options = source.map((item, index) => ({ id: cleanOptionId(item?.id, `o${index + 1}`), label: String(item?.label || '').trim().slice(0, 100), logo: absoluteLogo(item?.logo) })).filter((item) => item.id && item.label).slice(0, 16);
  if (!id || question.length < 4 || options.length < 2) return null;
  const closesAt = Number(raw.closesAt || 0), participationPoints = Math.max(0, Math.min(20, Number(raw.participationPoints ?? 1) || 0)), correctPoints = Math.max(0, Math.min(50, Number(raw.correctPoints ?? 3) || 0));
  const correctOption = String(raw.correctOption || '').trim(), rawStatus = String(raw.status || 'open').toLowerCase();
  let status = rawStatus === 'settled' ? 'settled' : rawStatus === 'closed' ? 'closed' : 'open';
  if (status === 'open' && closesAt && Date.now() >= closesAt) status = 'closed';
  if (status === 'settled' && !options.some((item) => item.id === correctOption)) status = 'closed';
  return { id, category: 'custom', kind: 'choice', label: String(raw.label || 'Palpite extra').trim().slice(0, 80), question, options, closesAt, status, correctOption: status === 'settled' ? correctOption : '', participationPoints, correctPoints, createdAt: Number(raw.createdAt || 0), updatedAt: Number(raw.updatedAt || 0), settledAt: Number(raw.settledAt || 0), result: status === 'settled' ? { option: correctOption, teamLabel: options.find(o => o.id === correctOption)?.label || correctOption } : null };
}

async function fetchJson(url) {
  try { const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } }); return response.ok ? await response.json() : null; }
  catch (error) { console.error('Fetch JSON failed', url, error); return null; }
}

async function fetchManualPrediction() { return normalizePrediction(await fetchJson(PREDICTION_URL)); }

async function fetchSecondPhaseRounds() {
  const raw = await fetchJson(DATES_URL);
  const rounds = Array.isArray(raw?.rounds) ? raw.rounds.filter(r => r?.stage === 'segundaFase') : [];
  const source = rounds.length ? rounds : FALLBACK_SECOND_DATES;
  return source.map((r, i) => ({ round: Number(r.round || i + 1), date: String(r.date || ''), time24: String(r.time24 || '13:00'), closesAt: saoPauloTimestamp(r.date, r.time24 || '13:00') })).filter(r => r.round && r.closesAt).sort((a,b) => a.round - b.round);
}

async function fetchLogoMap() {
  const raw = await fetchJson(LOGOS_URL); return raw?.logos && typeof raw.logos === 'object' ? raw.logos : {};
}

function teamOptions(logos) {
  return SECOND_PHASE_TEAMS.map((team, index) => ({ id: cleanOptionId(team, `t${index + 1}`), label: team, logo: absoluteLogo(logos?.[team] || '') }));
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
      const team = String(row?.team || '').trim(); if (!team) continue;
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
  return { option: winners[0]?.option || '', teams: winners.map(r => r.option), team: winners[0]?.team || '', teamLabel: winners.map(r => r.team).join(' / '), points: target, closestError: null };
}

function autoPredictionPair(round, options, live) {
  const totals = dailyTotals(live, round.round), bestResult = extremeResult(options, totals, 'best'), worstResult = extremeResult(options, totals, 'worst');
  const base = { category: 'ffws', kind: 'team_points', label: `FFWS BR • Segunda Fase • Dia ${round.round}`, options, closesAt: round.closesAt, participationPoints: RULES.ffwsPredictionParticipationPoints, correctPoints: RULES.ffwsPredictionNearestPoints, day: round.round, date: round.date, pointsPrompt: 'Quantos pontos esse time vai fazer?' };
  const now = Date.now();
  return [
    { ...base, id: `ffws-2026-s2-d${round.round}-best`, question: `Qual equipe vai pontuar mais no Dia ${round.round}?`, metric: 'best', status: bestResult ? 'settled' : now >= round.closesAt ? 'closed' : 'open', result: bestResult },
    { ...base, id: `ffws-2026-s2-d${round.round}-worst`, question: `Qual vai ser a pior equipe do Dia ${round.round}?`, metric: 'worst', status: worstResult ? 'settled' : now >= round.closesAt ? 'closed' : 'open', result: worstResult },
  ];
}

async function automaticPredictionData() {
  const [rounds, logos, live] = await Promise.all([fetchSecondPhaseRounds(), fetchLogoMap(), fetchJson(LIVE_SECOND_URL)]);
  const options = teamOptions(logos), pairs = rounds.map(round => ({ round, predictions: autoPredictionPair(round, options, live || {}) }));
  return { rounds, pairs, options, live: live || {} };
}

function selectAutoPair(auto) {
  const now = Date.now();
  for (const item of auto.pairs) {
    if (item.round.closesAt > now) return item.predictions;
    if (item.round.closesAt <= now && item.predictions.some(p => p.status !== 'settled')) return item.predictions;
  }
  return auto.pairs.length ? auto.pairs[auto.pairs.length - 1].predictions : [];
}

function encodeVoteSource(predictionId, option, points) {
  return `${predictionId}|${option}|${points == null ? '' : Math.round(Number(points) || 0)}`;
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
  const row = await env.DB.prepare(`SELECT source_id FROM awards WHERE award_key = ?1 LIMIT 1`).bind(`prediction-vote:${predictionId}:${key}`).first();
  return row ? parseVoteSource(predictionId, row.source_id) : null;
}

async function predictionBonus(env, predictionId, key) {
  if (!predictionId || !key) return { won:false, points:0 };
  const row = await env.DB.prepare(`SELECT points, type FROM awards WHERE (award_key = ?1 OR award_key = ?2) LIMIT 1`).bind(`prediction-correct:${predictionId}:${key}`, `prediction-nearest:${predictionId}:${key}`).first();
  return { won: Boolean(row), points: Number(row?.points || 0), type: row?.type || '' };
}

async function settleManualPrediction(env, prediction) {
  if (!prediction || prediction.category !== 'custom' || prediction.status !== 'settled' || !prediction.correctOption || prediction.correctPoints <= 0) return;
  const result = await env.DB.prepare(`SELECT user_key, username, source_id FROM awards WHERE type = 'prediction_vote' AND award_key LIKE ?1 LIMIT 1500`).bind(`prediction-vote:${prediction.id}:%`).all();
  const timestamp = prediction.closesAt || prediction.settledAt || Date.now();
  for (let i = 0; i < (result.results || []).length; i += 25) {
    const chunk = result.results.slice(i, i + 25).filter(row => parseVoteSource(prediction.id, row.source_id)?.option === prediction.correctOption);
    await Promise.all(chunk.map(row => awardInteraction(env, { awardKey: `prediction-correct:${prediction.id}:${row.user_key}`, userKey: row.user_key, identity: '', username: row.username || 'usuario', type: 'prediction_correct', sourceId: prediction.id, points: prediction.correctPoints, timestamp })));
  }
}

async function settleAutoPrediction(env, prediction) {
  if (!prediction || prediction.category !== 'ffws' || prediction.status !== 'settled' || !prediction.result || prediction.correctPoints <= 0) return;
  const result = await env.DB.prepare(`SELECT user_key, username, source_id FROM awards WHERE type = 'prediction_vote' AND award_key LIKE ?1 LIMIT 2000`).bind(`prediction-vote:${prediction.id}:%`).all();
  const accepted = new Set(prediction.result.teams || []), candidates = [];
  for (const row of result.results || []) {
    const vote = parseVoteSource(prediction.id, row.source_id);
    if (!vote || !accepted.has(vote.option) || !Number.isFinite(Number(vote.points))) continue;
    candidates.push({ row, vote, error: Math.abs(Number(vote.points) - Number(prediction.result.points)) });
  }
  if (!candidates.length) return;
  const closestError = Math.min(...candidates.map(x => x.error)); prediction.result.closestError = closestError;
  const winners = candidates.filter(x => x.error === closestError), timestamp = prediction.closesAt || Date.now();
  for (let i = 0; i < winners.length; i += 25) {
    await Promise.all(winners.slice(i, i + 25).map(({row}) => awardInteraction(env, { awardKey: `prediction-nearest:${prediction.id}:${row.user_key}`, userKey: row.user_key, identity: '', username: row.username || 'usuario', type: 'prediction_nearest', sourceId: prediction.id, points: prediction.correctPoints, timestamp })));
  }
}

async function settleAllAvailable(env, manual, auto) {
  const jobs = [];
  if (manual?.status === 'settled') jobs.push(settleManualPrediction(env, manual));
  for (const item of auto.pairs || []) for (const prediction of item.predictions || []) if (prediction.status === 'settled') jobs.push(settleAutoPrediction(env, prediction));
  await Promise.allSettled(jobs);
}

async function resolvePrediction(predictionId, manual, auto) {
  if (manual?.id === predictionId) return manual;
  for (const item of auto.pairs || []) for (const prediction of item.predictions || []) if (prediction.id === predictionId) return prediction;
  return null;
}

async function buildPredictionsPayload(env, sessionId, ctx) {
  const [manual, auto] = await Promise.all([fetchManualPrediction(), automaticPredictionData()]);
  if (ctx?.waitUntil) ctx.waitUntil(settleAllAvailable(env, manual, auto));
  const predictions = [...selectAutoPair(auto)]; if (manual) predictions.push(manual);
  const row = sessionId ? await getCheckinSession(env, sessionId) : null, linked = Boolean(row?.verified_at && row?.user_key), votes = {};
  if (linked) {
    for (const prediction of predictions) {
      const vote = await predictionVoteFor(env, prediction.id, row.user_key);
      if (!vote) continue;
      const bonus = await predictionBonus(env, prediction.id, row.user_key);
      votes[prediction.id] = { ...vote, won: bonus.won, bonusPoints: bonus.points };
    }
  }
  return { ok:true, linked, username: linked ? row.username : '', predictions, votes };
}

async function getPredictions(request, env, url, ctx) {
  const sessionId = String(url.searchParams.get('session') || '').trim();
  return json(await buildPredictionsPayload(env, sessionId, ctx), 200, request);
}

async function getPredictionLegacy(request, env, url, ctx) {
  const all = await buildPredictionsPayload(env, String(url.searchParams.get('session') || '').trim(), ctx);
  const prediction = all.predictions.find(p => p.category === 'custom') || all.predictions[0] || null;
  const vote = prediction ? all.votes[prediction.id] : null;
  return json({ ok:true, prediction, linked:all.linked, username:all.username, vote:vote?.option || '', votePoints:vote?.points ?? null, correctAwarded:Boolean(vote?.won) }, 200, request);
}

async function votePrediction(request, env, ctx) {
  const body = await readJson(request), sessionId = String(body?.session || '').trim(), predictionId = String(body?.predictionId || '').trim(), option = String(body?.option || '').trim();
  const [manual, auto] = await Promise.all([fetchManualPrediction(), automaticPredictionData()]);
  const prediction = await resolvePrediction(predictionId, manual, auto);
  if (!prediction) return json({ ok:false, error:'Esse palpite não está mais disponível.' }, 404, request);
  if (prediction.status !== 'open' || (prediction.closesAt && Date.now() >= prediction.closesAt)) return json({ ok:false, error:'O prazo para esse palpite já terminou.' }, 409, request);
  if (!prediction.options.some(item => item.id === option)) return json({ ok:false, error:'Opção de palpite inválida.' }, 400, request);
  let guessedPoints = null;
  if (prediction.kind === 'team_points') {
    guessedPoints = Math.round(Number(body?.points));
    if (!Number.isFinite(guessedPoints) || guessedPoints < 0 || guessedPoints > 300) return json({ ok:false, error:'Digite uma previsão de pontos entre 0 e 300.' }, 400, request);
  }
  const row = await getCheckinSession(env, sessionId);
  if (!row?.verified_at || !row?.user_key) return json({ ok:false, error:'Vincule seu Instagram antes de palpitar.' }, 403, request);
  const existingVote = await predictionVoteFor(env, prediction.id, row.user_key);
  if (!existingVote) {
    await awardInteraction(env, { awardKey:`prediction-vote:${prediction.id}:${row.user_key}`, userKey:row.user_key, identity:row.instagram_id || '', username:row.username || fallbackUsername(row.instagram_id), type:'prediction_vote', sourceId:encodeVoteSource(prediction.id, option, guessedPoints), points:prediction.participationPoints, timestamp:Date.now() });
  }
  const all = await buildPredictionsPayload(env, sessionId, ctx);
  return json({ ok:true, alreadyVoted:Boolean(existingVote), participationAwarded:existingVote ? 0 : prediction.participationPoints, all }, 200, request);
}

async function getPredictionRanking(request, env, url) {
  const requested = String(url.searchParams.get('period') || 'week').toLowerCase(), period = ['week','month','all'].includes(requested) ? requested : 'week';
  const now = Date.now(), { monthKey } = dateKeys(now), week = weekKeys(now);
  let where = `a.type IN ('prediction_vote','prediction_correct','prediction_nearest')`, binds = [];
  if (period === 'week') { where += ' AND a.day_key BETWEEN ?1 AND ?2'; binds = [week.weekStartKey, week.weekEndKey]; }
  else if (period === 'month') { where += ' AND a.month_key = ?1'; binds = [monthKey]; }
  const statement = env.DB.prepare(`SELECT a.user_key, COALESCE(MAX(u.username),MAX(a.username)) AS username, SUM(a.points) AS points, SUM(CASE WHEN a.type='prediction_vote' THEN 1 ELSE 0 END) AS participations, SUM(CASE WHEN a.type IN ('prediction_correct','prediction_nearest') THEN 1 ELSE 0 END) AS wins, MAX(a.created_at) AS lastInteractionAt FROM awards a LEFT JOIN users u ON u.user_key=a.user_key WHERE ${where} GROUP BY a.user_key ORDER BY points DESC, wins DESC, participations DESC, username ASC LIMIT 100`);
  const result = binds.length ? await statement.bind(...binds).all() : await statement.all();
  const ranking = (result.results || []).map(row => ({ userKey:row.user_key, username:row.username, points:Number(row.points||0), participations:Number(row.participations||0), wins:Number(row.wins||0), lastInteractionAt:Number(row.lastInteractionAt||0) }));
  return json({ ok:true, period, ranking }, 200, request, { 'Cache-Control':'public, max-age=60' });
}

async function awardInteraction(env, event) {
  const { monthKey, dayKey } = dateKeys(event.timestamp), now = Date.now();
  const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO awards (award_key, user_key, username, type, source_id, points, day_key, month_key, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`).bind(event.awardKey, event.userKey, event.username, event.type, event.sourceId || '', event.points, dayKey, monthKey, now).run();
  if (!inserted.meta?.changes) return false;
  const activeInsert = await env.DB.prepare(`INSERT OR IGNORE INTO active_days (user_key, day_key) VALUES (?1, ?2)`).bind(event.userKey, dayKey).run();
  const newDay = activeInsert.meta?.changes ? 1 : 0, storyInc = event.type === 'story' ? 1 : 0, commentInc = event.type === 'comment' ? 1 : 0;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO users (user_key, instagram_id, username, points_all, story_mentions_all, comments_all, active_days_all, last_interaction_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(user_key) DO UPDATE SET instagram_id=COALESCE(excluded.instagram_id,users.instagram_id), username=excluded.username, points_all=users.points_all+excluded.points_all, story_mentions_all=users.story_mentions_all+excluded.story_mentions_all, comments_all=users.comments_all+excluded.comments_all, active_days_all=users.active_days_all+excluded.active_days_all, last_interaction_at=MAX(users.last_interaction_at,excluded.last_interaction_at)`).bind(event.userKey, event.identity || null, event.username, event.points, storyInc, commentInc, newDay, event.timestamp),
    env.DB.prepare(`INSERT INTO monthly_users (month_key, user_key, username, points, story_mentions, comments, active_days, last_interaction_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(month_key,user_key) DO UPDATE SET username=excluded.username, points=monthly_users.points+excluded.points, story_mentions=monthly_users.story_mentions+excluded.story_mentions, comments=monthly_users.comments+excluded.comments, active_days=monthly_users.active_days+excluded.active_days, last_interaction_at=MAX(monthly_users.last_interaction_at,excluded.last_interaction_at)`).bind(monthKey, event.userKey, event.username, event.points, storyInc, commentInc, newDay, event.timestamp),
  ]);
  return true;
}

async function getRanking(request, env, url) {
  const requested = String(url.searchParams.get('period') || 'week').toLowerCase(), period = ['week','month','all'].includes(requested) ? requested : 'week', now = Date.now(), { monthKey } = dateKeys(now);
  const requestedWeek = String(url.searchParams.get('week') || '').trim(), requestedWeekTimestamp = period === 'week' ? dayKeyTimestamp(requestedWeek) : null, weekInfo = weekKeys(requestedWeekTimestamp || now), { weekKey, weekStartKey, weekEndKey } = weekInfo;
  let result;
  if (period === 'all') result = await env.DB.prepare(`SELECT user_key, username, points_all AS points, story_mentions_all AS storyMentions, comments_all AS comments, active_days_all AS activeDays, last_interaction_at AS lastInteractionAt FROM users ORDER BY points_all DESC, story_mentions_all DESC, comments_all DESC LIMIT 500`).all();
  else if (period === 'month') result = await env.DB.prepare(`SELECT user_key, username, points, story_mentions AS storyMentions, comments, active_days AS activeDays, last_interaction_at AS lastInteractionAt FROM monthly_users WHERE month_key=?1 ORDER BY points DESC, story_mentions DESC, comments DESC LIMIT 500`).bind(monthKey).all();
  else result = await env.DB.prepare(`SELECT a.user_key, COALESCE(MAX(u.username),MAX(a.username)) AS username, SUM(a.points) AS points, SUM(CASE WHEN a.type='story' THEN 1 ELSE 0 END) AS storyMentions, SUM(CASE WHEN a.type='comment' THEN 1 ELSE 0 END) AS comments, COUNT(DISTINCT a.day_key) AS activeDays, MAX(a.created_at) AS lastInteractionAt FROM awards a LEFT JOIN users u ON u.user_key=a.user_key WHERE a.day_key BETWEEN ?1 AND ?2 GROUP BY a.user_key ORDER BY points DESC, storyMentions DESC, comments DESC, username ASC LIMIT 500`).bind(weekStartKey, weekEndKey).all();
  const users = {}; let updatedAt = 0;
  for (const row of result.results || []) { users[row.user_key] = { username:row.username, points:Number(row.points||0), storyMentions:Number(row.storyMentions||0), comments:Number(row.comments||0), activeDays:Number(row.activeDays||0), lastInteractionAt:Number(row.lastInteractionAt||0) }; updatedAt = Math.max(updatedAt, Number(row.lastInteractionAt||0)); }
  return json({ updatedAt, rules:RULES, period:{ type:period, weekKey, weekStart:weekStartKey, weekEnd:weekEndKey, monthKey, historical:period==='week'&&Boolean(requestedWeekTimestamp) }, users }, 200, request, { 'Cache-Control':'public, max-age=60' });
}

async function getWeeklyHistory(request, env, url) {
  const rawLimit = Number(url.searchParams.get('limit')), limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 24, 104)), now = Date.now(), currentWeek = weekKeys(now), cutoff = shiftDayKey(currentWeek.weekStartKey, -(limit + 2) * 7);
  const result = await env.DB.prepare(`SELECT a.day_key, a.user_key, COALESCE(MAX(u.username),MAX(a.username)) AS username, SUM(a.points) AS points, SUM(CASE WHEN a.type='story' THEN 1 ELSE 0 END) AS storyMentions, SUM(CASE WHEN a.type='comment' THEN 1 ELSE 0 END) AS comments, COUNT(DISTINCT a.day_key) AS activeDays, MAX(a.created_at) AS lastInteractionAt FROM awards a LEFT JOIN users u ON u.user_key=a.user_key WHERE a.day_key>=?1 GROUP BY a.day_key,a.user_key ORDER BY a.day_key DESC`).bind(cutoff).all();
  const weeks = new Map();
  for (const row of result.results || []) {
    const stamp = dayKeyTimestamp(row.day_key); if (!stamp) continue; const wk = weekKeys(stamp); if (wk.weekStartKey === currentWeek.weekStartKey) continue;
    if (!weeks.has(wk.weekStartKey)) weeks.set(wk.weekStartKey,{ weekKey:wk.weekKey, weekStart:wk.weekStartKey, weekEnd:wk.weekEndKey, users:new Map() });
    const week = weeks.get(wk.weekStartKey), existing = week.users.get(row.user_key) || { userKey:row.user_key, username:row.username||'usuario', points:0, storyMentions:0, comments:0, activeDays:new Set(), lastInteractionAt:0 };
    existing.username=row.username||existing.username; existing.points+=Number(row.points||0); existing.storyMentions+=Number(row.storyMentions||0); existing.comments+=Number(row.comments||0); existing.activeDays.add(row.day_key); existing.lastInteractionAt=Math.max(existing.lastInteractionAt,Number(row.lastInteractionAt||0)); week.users.set(row.user_key,existing);
  }
  const history = [...weeks.values()].sort((a,b)=>b.weekStart.localeCompare(a.weekStart)).slice(0,limit).map(week=>{ const ranked=[...week.users.values()].sort((a,b)=>b.points-a.points||b.storyMentions-a.storyMentions||b.comments-a.comments||a.username.localeCompare(b.username,'pt-BR')); const top=ranked[0]||null; return { weekKey:week.weekKey, weekStart:week.weekStart, weekEnd:week.weekEnd, participants:ranked.length, winner:top?{ userKey:top.userKey, username:top.username, points:top.points, storyMentions:top.storyMentions, comments:top.comments, activeDays:top.activeDays.size, lastInteractionAt:top.lastInteractionAt }:null }; }).filter(item=>item.winner);
  return json({ currentWeek:{ weekKey:currentWeek.weekKey, weekStart:currentWeek.weekStartKey, weekEnd:currentWeek.weekEndKey }, history }, 200, request, { 'Cache-Control':'public, max-age=300' });
}

async function logEntryShape(env, entry) {
  const summary = { entryKeys:Object.keys(entry||{}), hasChanges:Array.isArray(entry?.changes), changeFields:Array.isArray(entry?.changes)?entry.changes.map(change=>String(change?.field||'')).filter(Boolean):[], hasMessaging:Array.isArray(entry?.messaging), time:Number(entry?.time||0) };
  await env.DB.prepare('INSERT INTO raw_events (kind,payload,received_at) VALUES (?1,?2,?3)').bind('unrecognized_entry',JSON.stringify(summary),Date.now()).run();
}

async function logChangeShape(env, entry, change) {
  const value=change?.value||{}, summary={ field:String(change?.field||''), valueKeys:Object.keys(value), fromKeys:Object.keys(value?.from||{}), mediaKeys:Object.keys(value?.media||{}), entryTime:Number(entry?.time||0) };
  await env.DB.prepare('INSERT INTO raw_events (kind,payload,received_at) VALUES (?1,?2,?3)').bind('unrecognized_change',JSON.stringify(summary),Date.now()).run();
}

async function logMessagingShape(env, event) {
  const message=event?.message||{}, attachments=Array.isArray(message.attachments)?message.attachments:message.attachment?[message.attachment]:[], summary={ eventKeys:Object.keys(event||{}), messageKeys:Object.keys(message), attachmentTypes:attachments.map(a=>String(a?.type||'')).filter(Boolean), hasReferral:Boolean(event?.referral), referralSource:String(event?.referral?.source||''), referralType:String(event?.referral?.type||''), messageId:String(message?.mid||''), hasText:Boolean(message?.text), timestamp:Number(event?.timestamp||0) };
  await env.DB.prepare('INSERT INTO raw_events (kind,payload,received_at) VALUES (?1,?2,?3)').bind('unrecognized_message',JSON.stringify(summary),Date.now()).run();
}
