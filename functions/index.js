'use strict';

const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

if (!getApps().length) initializeApp();

const VERIFY_TOKEN = defineSecret('META_WEBHOOK_VERIFY_TOKEN');
const APP_SECRET = defineSecret('META_APP_SECRET');
const INSTAGRAM_ACCESS_TOKEN = defineSecret('INSTAGRAM_ACCESS_TOKEN');

const REGION = 'southamerica-east1';
const TIME_ZONE = 'America/Sao_Paulo';
const GRAPH_VERSION = 'v24.0';

const RULES = Object.freeze({
  storyMentionPoints: 10,
  commentPoints: 2,
  storyMentionDailyLimit: 3,
  commentLimitPerMedia: 1
});

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function cleanUsername(value) {
  const clean = String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^\w.]/g, '')
    .slice(0, 64);
  return clean || '';
}

function fallbackUsername(identity) {
  const suffix = hash(identity).slice(0, 7);
  return `usuario_${suffix}`;
}

function dateKeys(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    monthKey: `${map.year}-${map.month}`,
    dayKey: `${map.year}-${map.month}-${map.day}`
  };
}

function safeTimingEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function validMetaSignature(req, appSecret) {
  const signature = String(req.get('x-hub-signature-256') || '');
  if (!signature.startsWith('sha256=') || !req.rawBody) return false;

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');

  return safeTimingEqual(signature, expected);
}

async function fetchMessageUsername(messageId, accessToken) {
  if (!messageId || !accessToken) return '';

  try {
    const url = new URL(
      `https://graph.instagram.com/${GRAPH_VERSION}/${encodeURIComponent(messageId)}`
    );
    url.searchParams.set('fields', 'id,from');
    url.searchParams.set('access_token', accessToken);

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7000)
    });

    if (!response.ok) {
      logger.warn('Falha ao resolver username no Instagram', {
        status: response.status,
        messageId: String(messageId).slice(0, 40)
      });
      return '';
    }

    const payload = await response.json();
    return cleanUsername(payload && payload.from && payload.from.username);
  } catch (error) {
    logger.warn('Erro ao resolver username no Instagram', {
      error: error && error.message ? error.message : String(error)
    });
    return '';
  }
}

async function resolveUserKey(db, identity, username) {
  const idValue = String(identity || '').trim();
  const userValue = cleanUsername(username).toLowerCase();

  const idAlias = idValue
    ? db.ref(`instagramCommunity/private/aliases/ids/${hash(idValue)}`)
    : null;
  const usernameAlias = userValue
    ? db.ref(`instagramCommunity/private/aliases/usernames/${hash(userValue)}`)
    : null;

  let key = '';

  if (usernameAlias) {
    const snap = await usernameAlias.get();
    if (snap.exists()) key = String(snap.val() || '');
  }

  if (!key && idAlias) {
    const snap = await idAlias.get();
    if (snap.exists()) key = String(snap.val() || '');
  }

  if (!key) {
    key = `u_${hash(idValue ? `id:${idValue}` : `username:${userValue}`).slice(0, 24)}`;
  }

  const updates = {};
  if (idAlias) updates[`instagramCommunity/private/aliases/ids/${hash(idValue)}`] = key;
  if (usernameAlias) {
    updates[`instagramCommunity/private/aliases/usernames/${hash(userValue)}`] = key;
  }

  if (Object.keys(updates).length) {
    await db.ref().update(updates);
  }

  return key;
}

async function claimOnce(db, eventKey, meta) {
  const ref = db.ref(`instagramCommunity/private/dedupe/${hash(eventKey)}`);
  let accepted = false;

  const result = await ref.transaction((current) => {
    if (current) return;
    accepted = true;
    return {
      at: Date.now(),
      type: meta.type || '',
      sourceId: String(meta.sourceId || '').slice(0, 180)
    };
  });

  return Boolean(result.committed && accepted);
}

async function claimStoryDailySlot(db, userKey, dayKey) {
  const ref = db.ref(
    `instagramCommunity/private/storyDaily/${dayKey}/${userKey}`
  );
  let accepted = false;

  const result = await ref.transaction((current) => {
    const count = Number(current) || 0;
    if (count >= RULES.storyMentionDailyLimit) return;
    accepted = true;
    return count + 1;
  });

  return Boolean(result.committed && accepted);
}

async function claimActiveDay(db, userKey, dayKey) {
  const ref = db.ref(
    `instagramCommunity/private/activeDays/${userKey}/${dayKey}`
  );
  let isNewDay = false;

  const result = await ref.transaction((current) => {
    if (current) return;
    isNewDay = true;
    return true;
  });

  return Boolean(result.committed && isNewDay);
}

function updateUserTransaction(ref, info) {
  return ref.transaction((current) => {
    const data =
      current && typeof current === 'object'
        ? { ...current }
        : {
            username: info.username,
            points: 0,
            storyMentions: 0,
            comments: 0,
            activeDays: 0,
            lastInteractionAt: 0
          };

    data.username = info.username || data.username || fallbackUsername(info.userKey);
    data.points = (Number(data.points) || 0) + info.points;
    data.storyMentions =
      (Number(data.storyMentions) || 0) + (info.type === 'story' ? 1 : 0);
    data.comments =
      (Number(data.comments) || 0) + (info.type === 'comment' ? 1 : 0);
    data.activeDays =
      (Number(data.activeDays) || 0) + (info.isNewDay ? 1 : 0);
    data.lastInteractionAt = Math.max(
      Number(data.lastInteractionAt) || 0,
      info.timestamp
    );

    return data;
  });
}

async function recordAcceptedInteraction(db, event) {
  const { monthKey, dayKey } = dateKeys(event.timestamp);

  const username =
    cleanUsername(event.username) || fallbackUsername(event.identity || event.eventKey);

  const userKey = await resolveUserKey(db, event.identity, username);
  const isNewDay = await claimActiveDay(db, userKey, dayKey);

  const info = {
    userKey,
    username,
    type: event.type,
    points: event.points,
    timestamp: event.timestamp,
    isNewDay
  };

  await Promise.all([
    updateUserTransaction(
      db.ref(`instagramCommunity/public/months/${monthKey}/users/${userKey}`),
      info
    ),
    updateUserTransaction(
      db.ref(`instagramCommunity/public/allTime/users/${userKey}`),
      info
    )
  ]);

  const now = Date.now();
  const publicUpdates = {};
  publicUpdates[`instagramCommunity/public/months/${monthKey}/updatedAt`] = now;
  publicUpdates[`instagramCommunity/public/months/${monthKey}/rules`] = RULES;
  publicUpdates['instagramCommunity/public/allTime/updatedAt'] = now;
  publicUpdates['instagramCommunity/public/allTime/rules'] = RULES;
  publicUpdates[
    `instagramCommunity/private/events/${monthKey}/${hash(event.eventKey)}`
  ] = {
    type: event.type,
    userKey,
    username,
    points: event.points,
    sourceId: String(event.sourceId || '').slice(0, 180),
    receivedAt: now
  };

  await db.ref().update(publicUpdates);
}

async function processComment(db, entry) {
  const value = entry && entry.value ? entry.value : {};
  const from = value && value.from ? value.from : {};
  const media = value && value.media ? value.media : {};

  const username = cleanUsername(from.username);
  const identity = String(from.id || username || '').trim();
  const commentId = String(value.id || '').trim();
  const mediaId = String(media.id || '').trim();

  if (!identity || (!commentId && !mediaId)) return;

  const eventKey = `comment:${identity}:${mediaId || commentId}`;
  const accepted = await claimOnce(db, eventKey, {
    type: 'comment',
    sourceId: mediaId || commentId
  });

  if (!accepted) return;

  await recordAcceptedInteraction(db, {
    type: 'comment',
    eventKey,
    identity,
    username,
    sourceId: mediaId || commentId,
    points: RULES.commentPoints,
    timestamp: Number(entry.time) || Date.now()
  });
}

function findStoryMention(messagingEvent) {
  const referral = messagingEvent && messagingEvent.referral;
  if (
    referral &&
    String(referral.source || '').toUpperCase() === 'STORY_MENTION'
  ) {
    return {
      storyId: String(
        (referral.story && referral.story.id) ||
          (messagingEvent.message && messagingEvent.message.mid) ||
          messagingEvent.timestamp ||
          ''
      ),
      messageId: String(
        (messagingEvent.message && messagingEvent.message.mid) || ''
      )
    };
  }

  const attachments =
    messagingEvent &&
    messagingEvent.message &&
    Array.isArray(messagingEvent.message.attachments)
      ? messagingEvent.message.attachments
      : [];

  const storyAttachment = attachments.find(
    (item) => String(item && item.type || '').toLowerCase() === 'story_mention'
  );

  if (storyAttachment) {
    const payload = storyAttachment.payload || {};
    return {
      storyId: String(
        payload.id ||
          payload.story_id ||
          (messagingEvent.message && messagingEvent.message.mid) ||
          messagingEvent.timestamp ||
          ''
      ),
      messageId: String(
        (messagingEvent.message && messagingEvent.message.mid) || ''
      )
    };
  }

  return null;
}

async function processStoryMention(db, messagingEvent, accessToken) {
  const story = findStoryMention(messagingEvent);
  if (!story) return;

  const sender = messagingEvent && messagingEvent.sender ? messagingEvent.sender : {};
  const identity = String(sender.id || '').trim();
  if (!identity) return;

  let username = cleanUsername(sender.username);

  if (!username && story.messageId) {
    username = await fetchMessageUsername(story.messageId, accessToken);
  }

  const timestamp = Number(messagingEvent.timestamp) || Date.now();
  const { dayKey } = dateKeys(timestamp);
  const eventKey = `story:${identity}:${story.storyId || story.messageId || timestamp}`;

  // Primeiro deduplica o evento. Assim, uma nova tentativa da Meta não consome
  // outra vaga do limite diário da mesma pessoa.
  const accepted = await claimOnce(db, eventKey, {
    type: 'story',
    sourceId: story.storyId || story.messageId
  });

  if (!accepted) return;

  const tempUserKey = await resolveUserKey(
    db,
    identity,
    username || fallbackUsername(identity)
  );

  const dailyAccepted = await claimStoryDailySlot(db, tempUserKey, dayKey);
  if (!dailyAccepted) return;

  await recordAcceptedInteraction(db, {
    type: 'story',
    eventKey,
    identity,
    username,
    sourceId: story.storyId || story.messageId,
    points: RULES.storyMentionPoints,
    timestamp
  });
}

async function processWebhookBody(body, accessToken) {
  if (!body || body.object !== 'instagram' || !Array.isArray(body.entry)) return;

  const db = getDatabase();
  const jobs = [];

  for (const entry of body.entry) {
    if (entry && entry.field === 'comments' && entry.value) {
      jobs.push(processComment(db, entry));
    }

    const messages = Array.isArray(entry && entry.messaging)
      ? entry.messaging
      : [];

    for (const messagingEvent of messages) {
      if (findStoryMention(messagingEvent)) {
        jobs.push(processStoryMention(db, messagingEvent, accessToken));
      }
    }
  }

  await Promise.allSettled(jobs).then((results) => {
    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error('Falha ao processar evento do Instagram', result.reason);
      }
    }
  });
}

exports.instagramWebhook = onRequest(
  {
    region: REGION,
    timeoutSeconds: 30,
    memory: '256MiB',
    cors: false,
    secrets: [VERIFY_TOKEN, APP_SECRET, INSTAGRAM_ACCESS_TOKEN]
  },
  async (req, res) => {
    if (req.method === 'GET') {
      const mode = String(req.query['hub.mode'] || '');
      const token = String(req.query['hub.verify_token'] || '');
      const challenge = String(req.query['hub.challenge'] || '');

      if (!mode) {
        res.status(200).json({
          ok: true,
          service: 'Central Free Fire Instagram Webhook'
        });
        return;
      }

      if (
        mode === 'subscribe' &&
        token &&
        safeTimingEqual(token, VERIFY_TOKEN.value())
      ) {
        res.status(200).send(challenge);
        return;
      }

      res.status(403).send('Webhook verification failed');
      return;
    }

    if (req.method !== 'POST') {
      res.set('Allow', 'GET, POST');
      res.status(405).send('Method Not Allowed');
      return;
    }

    if (!validMetaSignature(req, APP_SECRET.value())) {
      logger.warn('Webhook do Instagram rejeitado: assinatura inválida');
      res.status(401).send('Invalid signature');
      return;
    }

    try {
      await processWebhookBody(req.body, INSTAGRAM_ACCESS_TOKEN.value());
      res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      logger.error('Erro geral no webhook do Instagram', error);
      res.status(500).send('Internal Server Error');
    }
  }
);
