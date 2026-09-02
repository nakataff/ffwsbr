import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { getDatabase, ref, get, set, remove, update, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';

const ADMIN_EMAIL = 'admin@centralfreefire.com.br';
const config = window.CFF_CONFIG && window.CFF_CONFIG.firebase;
if (!config) throw new Error('Configuração do Firebase não encontrada.');

const app = getApps().length ? getApp() : initializeApp(config);
const auth = getAuth(app);
const database = getDatabase(app);

const $ = (selector) => document.querySelector(selector);
const loginSection = $('#admin-login');
const dashboard = $('#admin-dashboard');
const logoutButton = $('#admin-logout');
const loginForm = $('#admin-login-form');
const loginMessage = $('#admin-login-message');
const formMessage = $('#admin-form-message');
const newsForm = $('#admin-news-form');
const newsList = $('#admin-news-list');
const searchInput = $('#admin-news-search');
const liveForm = $('#admin-live-form');
const liveList = $('#admin-live-list');
let allLives = [];
let allNews = [];
let newsMetrics = {};
let pageAnalytics = [];
let slugTouched = false;
let currentNewsFilter = 'all';
let gaAccessToken = '';
let gaTokenClient = null;
let gaTokenExpiresAt = 0;
const GA_SETTINGS_KEY = 'cff-ga4-admin-settings-v1';
const LOCAL_NEWS_URL = 'noticias-painel.json?v=20260806-admin-v3';

function escapeHTML(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function slugify(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160);
}

function safeFirebaseKey(value) {
  return String(value || '').trim().replace(/[.#$/\[\]]/g, '_').slice(0, 180);
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Math.max(0, Number(value || 0)));
}

function formatDate(value) {
  const date = new Date(Number(value || 0));
  return Number.isNaN(date.getTime()) ? 'Sem data' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function dateInputValue(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
}

function todayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function setMessage(element, text, type = '') {
  element.textContent = text || '';
  element.classList.toggle('is-error', type === 'error');
  element.classList.toggle('is-success', type === 'success');
}

function isAdmin(user) {
  return Boolean(user && String(user.email || '').toLowerCase() === ADMIN_EMAIL);
}

function prepareContentAndImage(content, currentImage) {
  let src = String(content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  let image = String(currentImage || '').trim();
  src = src.replace(/\[IMG\s*:\s*([^\]]+)\]/i, (full, payload) => {
    const url = String(payload || '').split('|')[0].trim();
    if (!image) image = url;
    return '\n';
  });
  src = src.replace(/\[(?:P|PARAGRAFO|PARÁGRAFO|BR)\]/gi, '\n');
  src = src.split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
  return { content: src, image };
}

function normalizeNews(raw, id = '', source = 'admin') {
  const prepared = prepareContentAndImage(raw && raw.conteudo || '', raw && raw.imagem || '');
  return {
    id: String(raw && (raw.id || id) || '').trim(),
    titulo: String(raw && raw.titulo || '').trim(),
    imagem: prepared.image,
    resumo: String(raw && raw.resumo || '').trim(),
    conteudo: prepared.content,
    data: String(raw && raw.data || '').trim(),
    autor: String(raw && raw.autor || 'Central Free Fire').trim(),
    link_original: String(raw && (raw.link_original || raw.link) || '').trim(),
    destaque: Boolean(raw && raw.destaque),
    status: String(raw && raw.status || 'published'),
    ordem: raw && raw.ordem != null && Number.isFinite(Number(raw.ordem)) ? Number(raw.ordem) : null,
    createdAt: Number(raw && raw.createdAt || 0),
    updatedAt: Number(raw && raw.updatedAt || 0),
    source,
    origin: String(raw && (raw.origin || raw.source) || source)
  };
}

function sourceLabel(item) {
  if (item.source === 'draft') return 'Painel';
  if (item.source === 'admin') return 'Painel';
  if (item.source === 'sheet') return 'Planilha';
  return 'Arquivo do site';
}

function parseNewsTimestamp(value) {
  const text = String(value || '').trim();
  if (!text) return 0;
  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0));
  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0));
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function newsDateKey(item) {
  return Math.max(Number(item && item.updatedAt || 0), Number(item && item.createdAt || 0), parseNewsTimestamp(item && item.data));
}

function newsOrderKey(item) {
  return item && item.ordem != null && Number.isFinite(Number(item.ordem)) ? Number(item.ordem) : newsDateKey(item);
}

function compareNewsOrder(a, b) {
  return newsOrderKey(b) - newsOrderKey(a) || String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
}

function mergeDashboardNews(localNews, sheetNews, adminNews, drafts, hiddenNews) {
  const merged = new Map();
  localNews.forEach((item) => merged.set(item.id, item));
  sheetNews.forEach((item) => merged.set(item.id, item));
  adminNews.forEach((item) => merged.set(item.id, item));
  Object.keys(hiddenNews || {}).forEach((id) => { if (hiddenNews[id]) merged.delete(id); });
  drafts.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values()).sort(compareNewsOrder);
}

async function loadSheetNewsFile() {
  const sheetUrl = window.CFF_CONFIG && window.CFF_CONFIG.sheets && window.CFF_CONFIG.sheets.noticias;
  if (!sheetUrl) return [];
  const bucket = Math.floor(Date.now() / 300000);
  const response = await fetch(sheetUrl + (sheetUrl.includes('?') ? '&' : '?') + 'v=' + bucket, { cache: 'default' });
  if (!response.ok) throw new Error('Planilha indisponível');
  return sheetNews(await response.text()).map((item) => normalizeNews(item, item.id, 'sheet'));
}

async function loadDashboard() {
  $('#admin-refresh').disabled = true;
  try {
    const [newsSnap, draftsSnap, metricsSnap, analyticsSnap, hiddenSnap, localNews, sheetNewsItems] = await Promise.all([
      get(ref(database, 'adminNews')),
      get(ref(database, 'adminDrafts')),
      get(ref(database, 'newsMetrics')),
      get(ref(database, 'siteAnalytics/pages')),
      get(ref(database, 'adminHiddenNews')),
      loadLocalNewsFile().catch((error) => { console.warn('Arquivo local de notícias indisponível', error); return []; }),
      loadSheetNewsFile().catch((error) => { console.warn('Planilha de notícias indisponível', error); return []; })
    ]);
    const newsData = newsSnap.val() || {};
    const draftsData = draftsSnap.val() || {};
    const published = Object.keys(newsData).map((id) => normalizeNews({ ...newsData[id], status: 'published' }, id, 'admin'));
    const drafts = Object.keys(draftsData).map((id) => normalizeNews({ ...draftsData[id], status: 'draft' }, id, 'draft'));
    allNews = mergeDashboardNews(localNews, sheetNewsItems, published, drafts, hiddenSnap.val() || {});
    newsMetrics = metricsSnap.val() || {};
    const analyticsData = analyticsSnap.val() || {};
    pageAnalytics = Object.values(analyticsData).filter(Boolean).sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
    renderDashboard();
  } catch (error) {
    setMessage(formMessage, 'Não foi possível carregar todos os dados. Confira as regras do Firebase.', 'error');
    console.error(error);
  } finally {
    $('#admin-refresh').disabled = false;
  }
}

function renderDashboard() {
  const pageViews = pageAnalytics.reduce((sum, item) => sum + Number(item.views || 0), 0);
  const metricValues = Object.values(newsMetrics || {});
  const newsViews = metricValues.reduce((sum, item) => sum + Number(item && item.views || 0), 0);
  const newsLikes = metricValues.reduce((sum, item) => sum + Number(item && item.likes || 0), 0);
  $('#stat-page-views').textContent = formatNumber(pageViews);
  $('#stat-news-views').textContent = formatNumber(newsViews);
  $('#stat-news-likes').textContent = formatNumber(newsLikes);
  $('#stat-news-count').textContent = formatNumber(allNews.length);

  $('#admin-top-pages').innerHTML = pageAnalytics.length ? pageAnalytics.slice(0, 10).map((item, index) => `
    <div class="admin-ranking-row">
      <span class="admin-ranking-pos">${index + 1}</span>
      <div class="admin-ranking-copy"><strong>${escapeHTML(item.title || item.path || 'Página')}</strong><small>${escapeHTML(item.path || '')}</small></div>
      <span class="admin-ranking-value">${formatNumber(item.views)} views</span>
    </div>`).join('') : '<div class="admin-empty">Ainda não há visualizações registradas</div>';

  const latestUpdates = [...allNews].sort((a, b) => newsDateKey(b) - newsDateKey(a));
  $('#admin-latest-updates').innerHTML = latestUpdates.length ? latestUpdates.slice(0, 8).map((item) => `
    <div class="admin-update-row">
      <div class="admin-update-copy"><strong>${escapeHTML(item.titulo)}</strong><small>${item.status === 'draft' ? 'Rascunho' : 'Publicada'} • ${formatDate(item.updatedAt || item.createdAt)}</small></div>
      <button class="admin-btn admin-btn-ghost" type="button" data-edit-news="${escapeHTML(item.id)}">Editar</button>
    </div>`).join('') : '<div class="admin-empty">Nenhuma notícia encontrada</div>';

  renderNewsList();
}

function renderNewsList() {
  const query = String(searchInput.value || '').trim().toLowerCase();
  const publishedOrder = allNews.filter((item) => item.status !== 'draft').sort(compareNewsOrder);
  const publishedIndex = new Map(publishedOrder.map((item, index) => [item.id, index]));
  const filtered = allNews.filter((item) => {
    const matchesSearch = !query || item.titulo.toLowerCase().includes(query) || item.id.toLowerCase().includes(query) || item.autor.toLowerCase().includes(query);
    const matchesFilter = currentNewsFilter === 'all' ||
      (currentNewsFilter === 'published' && item.status !== 'draft') ||
      (currentNewsFilter === 'draft' && item.status === 'draft') ||
      (currentNewsFilter === 'featured' && item.destaque);
    return matchesSearch && matchesFilter;
  });
  const summary = $('#admin-news-list-summary');
  if (summary) summary.textContent = `${filtered.length} de ${allNews.length} notícia(s)`;
  newsList.innerHTML = filtered.length ? filtered.map((item) => {
    const metric = newsMetrics[item.id] || {};
    const isDraft = item.status === 'draft';
    return `<article class="admin-news-row" data-news-id="${escapeHTML(item.id)}">
      <img class="admin-news-thumb" src="${escapeHTML(item.imagem || 'central free fire.webp')}" alt="" loading="lazy" onerror="this.src='central free fire.webp'">
      <div class="admin-news-copy">
        <strong title="${escapeHTML(item.titulo)}">${escapeHTML(item.titulo)}</strong>
        <small>${escapeHTML(item.id)} • ${formatNumber(metric.views)} views • ${formatNumber(metric.likes)} curtidas</small>
        <div class="admin-news-meta"><span class="admin-chip ${isDraft ? 'is-draft' : ''}">${isDraft ? 'Rascunho' : 'Publicada'}</span>${item.destaque ? '<span class="admin-chip is-featured">Destaque</span>' : ''}<span class="admin-chip is-source">${sourceLabel(item)}</span></div>
      </div>
      <div class="admin-news-quick">
        ${!isDraft ? `<div class="admin-news-order" aria-label="Ordenar notícia"><button class="admin-order-btn" type="button" data-move-news="up" data-news-id="${escapeHTML(item.id)}" ${publishedIndex.get(item.id) === 0 ? 'disabled' : ''}>↑ Subir</button><button class="admin-order-btn" type="button" data-move-news="down" data-news-id="${escapeHTML(item.id)}" ${publishedIndex.get(item.id) === publishedOrder.length - 1 ? 'disabled' : ''}>↓ Descer</button></div>` : ''}
        <label class="admin-quick-check" title="Alterar destaque"><input type="checkbox" data-toggle-featured="${escapeHTML(item.id)}" ${item.destaque ? 'checked' : ''}><span>Destaque</span></label>
        <select class="admin-quick-status" data-change-status="${escapeHTML(item.id)}" aria-label="Status da notícia">
          <option value="published" ${isDraft ? '' : 'selected'}>Publicada</option>
          <option value="draft" ${isDraft ? 'selected' : ''}>Rascunho</option>
        </select>
      </div>
      <div class="admin-news-actions">${isDraft ? `<button class="admin-btn admin-btn-ghost" type="button" data-preview-news="${escapeHTML(item.id)}">Prévia</button>` : `<a class="admin-btn admin-btn-ghost" href="noticia.html?id=${encodeURIComponent(item.id)}" target="_blank" rel="noopener">Abrir</a>`}<button class="admin-btn admin-btn-primary" type="button" data-edit-news="${escapeHTML(item.id)}">Editar</button><button class="admin-btn admin-btn-danger" type="button" data-delete-news="${escapeHTML(item.id)}">Excluir</button></div>
    </article>`;
  }).join('') : '<div class="admin-empty">Nenhuma notícia encontrada com esse filtro</div>';
}

function clearForm() {
  newsForm.reset();
  $('#news-original-id').value = '';
  $('#news-origin').value = 'admin';
  $('#news-author').value = 'Central Free Fire';
  $('#news-status').value = 'published';
  $('#news-date').value = todayInputValue();
  $('#editor-title').textContent = 'Nova notícia';
  slugTouched = false;
  setMessage(formMessage, '');
}

function fillForm(item) {
  $('#news-original-id').value = item.id;
  $('#news-origin').value = item.origin || item.source || 'admin';
  $('#news-title').value = item.titulo;
  $('#news-slug').value = item.id;
  $('#news-date').value = dateInputValue(item.data);
  $('#news-image').value = item.imagem;
  $('#news-summary').value = item.resumo;
  $('#news-content').value = item.conteudo;
  $('#news-author').value = item.autor || 'Central Free Fire';
  $('#news-original-link').value = item.link_original;
  $('#news-status').value = item.status === 'draft' ? 'draft' : 'published';
  $('#news-featured').checked = item.destaque;
  $('#editor-title').textContent = 'Editar notícia';
  slugTouched = true;
  setMessage(formMessage, '');
  $('.admin-editor-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function readForm() {
  const titulo = $('#news-title').value.trim();
  const id = safeFirebaseKey(slugify($('#news-slug').value || titulo));
  const prepared = prepareContentAndImage($('#news-content').value, $('#news-image').value);
  if (!$('#news-image').value.trim() && prepared.image) $('#news-image').value = prepared.image;
  return {
    id,
    titulo,
    imagem: prepared.image,
    resumo: $('#news-summary').value.trim(),
    conteudo: prepared.content,
    data: $('#news-date').value || todayInputValue(),
    autor: $('#news-author').value.trim() || 'Central Free Fire',
    link_original: $('#news-original-link').value.trim(),
    destaque: $('#news-featured').checked,
    status: $('#news-status').value === 'draft' ? 'draft' : 'published',
    origin: $('#news-origin').value || 'admin'
  };
}

async function writeManagedNews(item, previous = null) {
  const preservedOrder = item && item.ordem != null && Number.isFinite(Number(item.ordem))
    ? Number(item.ordem)
    : previous && previous.ordem != null && Number.isFinite(Number(previous.ordem)) ? Number(previous.ordem) : null;
  const nowPayload = {
    ...item,
    ...(preservedOrder == null ? {} : { ordem: preservedOrder }),
    source: 'admin',
    origin: item.origin || previous && (previous.origin || previous.source) || 'admin',
    createdAt: previous && previous.createdAt ? previous.createdAt : serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  if (item.status === 'draft') {
    await Promise.all([
      set(ref(database, 'adminDrafts/' + item.id), nowPayload),
      remove(ref(database, 'adminNews/' + item.id)),
      set(ref(database, 'adminHiddenNews/' + item.id), true)
    ]);
  } else {
    await Promise.all([
      set(ref(database, 'adminNews/' + item.id), nowPayload),
      remove(ref(database, 'adminDrafts/' + item.id)),
      remove(ref(database, 'adminHiddenNews/' + item.id))
    ]);
  }
}

async function saveNews(event) {
  event.preventDefault();
  const submit = newsForm.querySelector('[type="submit"]');
  const originalId = $('#news-original-id').value.trim();
  const item = readForm();
  const previous = allNews.find((news) => news.id === originalId) || null;
  if (!item.id || !item.titulo || (!item.conteudo && !previous)) {
    setMessage(formMessage, 'Preencha título, slug e conteúdo.', 'error');
    return;
  }
  submit.disabled = true;
  setMessage(formMessage, 'Salvando...');
  try {
    await writeManagedNews(item, previous);
    if (originalId && originalId !== item.id) {
      await Promise.all([
        remove(ref(database, 'adminNews/' + originalId)),
        remove(ref(database, 'adminDrafts/' + originalId)),
        previous && ['local', 'sheet'].includes(previous.source) ? set(ref(database, 'adminHiddenNews/' + originalId), true) : remove(ref(database, 'adminHiddenNews/' + originalId))
      ]);
    }
    setMessage(formMessage, item.status === 'draft' ? 'Rascunho salvo.' : 'Notícia publicada no site.', 'success');
    $('#news-original-id').value = item.id;
    await loadDashboard();
  } catch (error) {
    setMessage(formMessage, 'Falha ao salvar. Confira seu login e as regras do banco.', 'error');
    console.error(error);
  } finally {
    submit.disabled = false;
  }
}

async function moveNews(id, direction, control) {
  const published = allNews.filter((item) => item.status !== 'draft').sort(compareNewsOrder);
  const index = published.findIndex((item) => item.id === id);
  const delta = direction === 'up' ? -1 : 1;
  const targetIndex = index + delta;
  if (index < 0 || targetIndex < 0 || targetIndex >= published.length) return;

  const item = published[index];
  const crossed = published[targetIndex];
  let nextOrder;
  if (delta < 0) {
    const higher = published[targetIndex - 1];
    const crossedKey = newsOrderKey(crossed);
    nextOrder = higher ? (newsOrderKey(higher) + crossedKey) / 2 : crossedKey + 1;
  } else {
    const lower = published[targetIndex + 1];
    const crossedKey = newsOrderKey(crossed);
    nextOrder = lower ? (crossedKey + newsOrderKey(lower)) / 2 : crossedKey - 1;
  }

  if (!Number.isFinite(nextOrder)) return;
  if (control) control.disabled = true;
  const row = newsList.querySelector(`[data-news-id="${CSS.escape(id)}"]`);
  if (row) row.classList.add('is-saving');
  try {
    await writeManagedNews({ ...item, ordem: nextOrder }, item);
    await loadDashboard();
  } catch (error) {
    alert('Não foi possível alterar a ordem da notícia.');
    console.error(error);
  } finally {
    if (control) control.disabled = false;
    if (row) row.classList.remove('is-saving');
  }
}

async function updateNewsFeatured(id, featured, control) {
  const item = allNews.find((news) => news.id === id);
  if (!item) return;
  control.disabled = true;
  try {
    await writeManagedNews({ ...item, destaque: featured }, item);
    await loadDashboard();
  } catch (error) {
    control.checked = !featured;
    alert('Não foi possível alterar o destaque.');
    console.error(error);
  } finally {
    control.disabled = false;
  }
}

async function updateNewsStatus(id, status, control) {
  const item = allNews.find((news) => news.id === id);
  if (!item) return;
  control.disabled = true;
  try {
    await writeManagedNews({ ...item, status: status === 'draft' ? 'draft' : 'published' }, item);
    await loadDashboard();
  } catch (error) {
    control.value = item.status === 'draft' ? 'draft' : 'published';
    alert('Não foi possível alterar o status.');
    console.error(error);
  } finally {
    control.disabled = false;
  }
}

async function deleteNews(id) {
  const item = allNews.find((news) => news.id === id);
  if (!item || !confirm(`Excluir a notícia "${item.titulo}"?`)) return;
  try {
    await Promise.all([
      remove(ref(database, 'adminNews/' + id)),
      remove(ref(database, 'adminDrafts/' + id)),
      set(ref(database, 'adminHiddenNews/' + id), true)
    ]);
    if ($('#news-original-id').value === id) clearForm();
    await loadDashboard();
  } catch (error) {
    alert('Não foi possível excluir a notícia.');
    console.error(error);
  }
}


function normalizeLive(raw, id = '') {
  const durationMinutes = raw && raw.duracaoMinutos != null
    ? Number(raw.duracaoMinutos)
    : Math.round(Number(raw && raw.duracao || 0) * 60);
  return {
    id: String(raw && (raw.id || id) || '').trim(),
    torneio: String(raw && (raw.torneio || raw.titulo || '') || '').trim(),
    faseDia: String(raw && (raw.faseDia || raw.fase_dia || '') || '').trim(),
    canal: String(raw && raw.canal || '').trim(),
    url: String(raw && raw.url || '').trim(),
    inicio: String(raw && (raw.inicio || raw.data_hora || '') || '').trim(),
    duracaoMinutos: Number.isFinite(durationMinutes) ? Math.max(0, Math.round(durationMinutes)) : 0,
    tipo: ['mobile', 'emulador', 'misto'].includes(String(raw && (raw.tipo || raw.categoria) || '').toLowerCase()) ? String(raw.tipo || raw.categoria).toLowerCase() : 'mobile',
    createdAt: Number(raw && raw.createdAt || 0),
    updatedAt: Number(raw && raw.updatedAt || 0)
  };
}

function parseLiveBRT(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}-03:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function liveStatus(item) {
  const start = parseLiveBRT(item.inicio);
  if (!start) return { key: 'invalid', label: 'SEM HORÁRIO', order: 3 };
  const end = new Date(start.getTime() + Math.max(1, item.duracaoMinutos) * 60000);
  const now = new Date();
  if (now >= start && now <= end) return { key: 'live', label: 'AO VIVO', order: 0 };
  if (now < start) return { key: 'upcoming', label: 'AGENDADA', order: 1 };
  return { key: 'ended', label: 'ENCERRADA', order: 2 };
}

function formatLiveDate(value) {
  const date = parseLiveBRT(value);
  if (!date) return 'Horário inválido';
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatLiveDuration(minutes) {
  const total = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${hours}h ${mins}min`;
  if (hours) return `${hours}h`;
  return `${mins}min`;
}

function clearLiveForm() {
  if (!liveForm) return;
  liveForm.reset();
  $('#live-original-id').value = '';
  $('#live-duration-hours').value = '3';
  $('#live-duration-minutes').value = '0';
  $('#live-type').value = 'mobile';
  $('#live-editor-title').textContent = 'Nova live';
  setMessage($('#admin-live-message'), '');
}

function fillLiveForm(item) {
  if (!item || !liveForm) return;
  $('#live-original-id').value = item.id;
  $('#live-tournament').value = item.torneio;
  $('#live-phase-day').value = item.faseDia;
  $('#live-channel').value = item.canal;
  $('#live-url').value = item.url;
  $('#live-start').value = item.inicio.slice(0, 16);
  $('#live-duration-hours').value = String(Math.floor(item.duracaoMinutos / 60));
  $('#live-duration-minutes').value = String(item.duracaoMinutos % 60);
  $('#live-type').value = item.tipo;
  $('#live-editor-title').textContent = 'Editar live';
  setMessage($('#admin-live-message'), '');
  liveForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function duplicateLiveForm(item) {
  if (!item || !liveForm) return;
  $('#live-original-id').value = '';
  $('#live-tournament').value = item.torneio;
  $('#live-phase-day').value = item.faseDia;
  $('#live-channel').value = item.canal;
  $('#live-url').value = item.url;
  $('#live-start').value = item.inicio.slice(0, 16);
  $('#live-duration-hours').value = String(Math.floor(item.duracaoMinutos / 60));
  $('#live-duration-minutes').value = String(item.duracaoMinutos % 60);
  $('#live-type').value = item.tipo;
  $('#live-editor-title').textContent = 'Duplicar live';
  setMessage($('#admin-live-message'), 'Cópia carregada. Ajuste fase/dia e data/hora antes de salvar.', 'success');
  liveForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => $('#live-phase-day')?.focus(), 250);
}

function readLiveForm() {
  const hours = Math.max(0, Number($('#live-duration-hours').value || 0));
  const minutes = Math.max(0, Math.min(59, Number($('#live-duration-minutes').value || 0)));
  return {
    torneio: $('#live-tournament').value.trim(),
    faseDia: $('#live-phase-day').value.trim(),
    canal: $('#live-channel').value.trim(),
    url: $('#live-url').value.trim(),
    inicio: $('#live-start').value.trim(),
    duracaoMinutos: Math.round(hours * 60 + minutes),
    tipo: $('#live-type').value
  };
}

function renderLiveList() {
  if (!liveList) return;
  const sorted = [...allLives].sort((a, b) => {
    const sa = liveStatus(a), sb = liveStatus(b);
    if (sa.order !== sb.order) return sa.order - sb.order;
    const ta = parseLiveBRT(a.inicio)?.getTime() || 0;
    const tb = parseLiveBRT(b.inicio)?.getTime() || 0;
    return sa.key === 'ended' ? tb - ta : ta - tb;
  });
  $('#admin-live-summary').textContent = `${sorted.length} live${sorted.length === 1 ? '' : 's'} cadastrada${sorted.length === 1 ? '' : 's'}`;
  liveList.innerHTML = sorted.length ? sorted.map((item) => {
    const status = liveStatus(item);
    const typeLabel = item.tipo === 'emulador' ? 'EMULADOR' : item.tipo === 'misto' ? 'MISTO' : 'MOBILE';
    return `<div class="admin-live-row">
      <span class="admin-live-status is-${status.key}">${status.label}</span>
      <div class="admin-live-copy"><strong>${escapeHTML(item.torneio)}</strong><small>${escapeHTML([item.faseDia, item.canal].filter(Boolean).join(' • '))}</small><span>${escapeHTML(formatLiveDate(item.inicio))} • ${escapeHTML(formatLiveDuration(item.duracaoMinutos))} • ${typeLabel}</span></div>
      <div class="admin-live-actions"><button class="admin-btn admin-btn-ghost" type="button" data-edit-live="${escapeHTML(item.id)}">Editar</button><button class="admin-btn admin-btn-ghost" type="button" data-duplicate-live="${escapeHTML(item.id)}">Duplicar</button><button class="admin-btn admin-btn-danger" type="button" data-delete-live="${escapeHTML(item.id)}">Excluir</button></div>
    </div>`;
  }).join('') : '<div class="admin-empty">Nenhuma live cadastrada no painel</div>';
}

async function loadAdminLives() {
  if (!liveList) return;
  try {
    const snap = await get(ref(database, 'adminLives'));
    const data = snap.val() || {};
    allLives = Object.keys(data).map((id) => normalizeLive(data[id], id)).filter((item) => item.id && item.torneio);
    renderLiveList();
  } catch (error) {
    liveList.innerHTML = '<div class="admin-empty">Não foi possível carregar as lives do painel</div>';
    setMessage($('#admin-live-message'), 'O Firebase recusou a leitura de adminLives. Confira as regras desse caminho.', 'error');
    console.error(error);
  }
}

async function saveLive(event) {
  event.preventDefault();
  const item = readLiveForm();
  if (!item.torneio || !item.canal || !item.inicio) return setMessage($('#admin-live-message'), 'Preencha torneio, canal e dia/hora.', 'error');
  if (item.duracaoMinutos <= 0) return setMessage($('#admin-live-message'), 'A duração precisa ser maior que zero.', 'error');
  const originalId = $('#live-original-id').value.trim();
  const id = originalId || safeFirebaseKey(`live-${Date.now()}-${slugify(item.torneio).slice(0, 55)}`);
  const previous = allLives.find((live) => live.id === originalId);
  const payload = {
    id,
    torneio: item.torneio,
    faseDia: item.faseDia,
    canal: item.canal,
    url: item.url,
    inicio: item.inicio,
    duracaoMinutos: item.duracaoMinutos,
    tipo: item.tipo,
    createdAt: previous && previous.createdAt ? previous.createdAt : serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const submit = liveForm.querySelector('[type="submit"]');
  submit.disabled = true;
  setMessage($('#admin-live-message'), 'Salvando live...');
  try {
    await set(ref(database, 'adminLives/' + id), payload);
    if (originalId && originalId !== id) await remove(ref(database, 'adminLives/' + originalId));
    setMessage($('#admin-live-message'), 'Live salva. A home atualiza automaticamente em até 1 minuto.', 'success');
    clearLiveForm();
    await loadAdminLives();
  } catch (error) {
    setMessage($('#admin-live-message'), 'Não foi possível salvar. Confira a permissão adminLives nas regras do Firebase.', 'error');
    console.error(error);
  } finally {
    submit.disabled = false;
  }
}

async function deleteLive(id) {
  const item = allLives.find((live) => live.id === id);
  if (!item || !confirm(`Excluir a live "${item.torneio}"?`)) return;
  try {
    await remove(ref(database, 'adminLives/' + id));
    if ($('#live-original-id').value === id) clearLiveForm();
    await loadAdminLives();
  } catch (error) {
    alert('Não foi possível excluir a live.');
    console.error(error);
  }
}

function parseTSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const char = src[i], next = src[i + 1];
    if (char === '"') { if (quoted && next === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (char === '\t' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') i++; row.push(cell.trim()); if (row.some((value) => value)) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  row.push(cell.trim()); if (row.some((value) => value)) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '_');
}

function sheetNews(text) {
  const rows = parseTSV(text);
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((cols, index) => {
    const raw = {}; headers.forEach((header, i) => { raw[header] = cols[i] || ''; });
    const titulo = String(raw.titulo || raw.title || raw.manchete || '').trim();
    const id = slugify(raw.id || raw.slug || titulo || 'noticia-' + (index + 1));
    return {
      id, titulo,
      imagem: String(raw.imagem || raw.image || raw.foto || raw.capa || '').trim(),
      resumo: String(raw.resumo || raw.subtitulo || raw.descricao || '').trim(),
      conteudo: String(raw.conteudo || raw.texto || raw.materia || raw.noticia || '').trim(),
      data: String(raw.data || raw.date || '').trim(),
      autor: String(raw.autor || raw.author || 'Central Free Fire').trim(),
      link_original: String(raw.link_original || raw.link || raw.url || '').trim(),
      destaque: ['true', 'sim', 's', '1', 'yes', 'destaque'].includes(String(raw.destaque || '').toLowerCase()),
      status: 'published'
    };
  }).filter((item) => item.id && item.titulo);
}

async function loadLocalNewsFile() {
  const response = await fetch(LOCAL_NEWS_URL, { cache: 'default' });
  if (!response.ok) throw new Error('Arquivo local de notícias indisponível');
  const data = await response.json();
  const list = Array.isArray(data) ? data : Object.values(data || {});
  return list.map((item) => normalizeNews(item, item && item.id, 'local')).filter((item) => item.id && item.titulo);
}

async function importLocalNews() {
  const button = $('#admin-import-local');
  if (!confirm('Importar para o painel as notícias que já estão dentro do arquivo do site?')) return;
  button.disabled = true;
  button.textContent = 'Importando...';
  try {
    const imported = await loadLocalNewsFile();
    const existing = new Set(allNews.filter((item) => item.source === 'admin' || item.source === 'draft').map((item) => item.id));
    const updates = {};
    imported.forEach((item) => {
      if (existing.has(item.id)) return;
      updates[item.id] = { ...item, source: 'admin', createdAt: item.createdAt || serverTimestamp(), updatedAt: serverTimestamp() };
    });
    const count = Object.keys(updates).length;
    if (count) {
      await update(ref(database, 'adminNews'), updates);
      await Promise.all(Object.keys(updates).map((id) => remove(ref(database, 'adminHiddenNews/' + id))));
    }
    alert(count ? `${count} notícia(s) importada(s) para o painel.` : 'As notícias do arquivo já estão cadastradas no painel.');
    await loadDashboard();
  } catch (error) {
    alert('Não foi possível importar o arquivo local de notícias.');
    console.error(error);
  } finally {
    button.disabled = false;
    button.textContent = 'Importar notícias do arquivo';
  }
}

async function importSheet() {
  const button = $('#admin-import-sheet');
  const sheetUrl = window.CFF_CONFIG && window.CFF_CONFIG.sheets && window.CFF_CONFIG.sheets.noticias;
  if (!sheetUrl) return alert('URL da planilha não encontrada.');
  if (!confirm('Importar para o painel as notícias da planilha que ainda não existem?')) return;
  button.disabled = true;
  button.textContent = 'Importando...';
  try {
    const response = await fetch(sheetUrl + (sheetUrl.includes('?') ? '&' : '?') + 'v=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Planilha indisponível');
    const imported = sheetNews(await response.text());
    const existing = new Set(allNews.filter((item) => item.source === 'admin' || item.source === 'draft').map((item) => item.id));
    const updates = {};
    imported.forEach((item) => {
      if (existing.has(item.id)) return;
      updates[item.id] = { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });
    const count = Object.keys(updates).length;
    if (count) {
      await update(ref(database, 'adminNews'), updates);
      await Promise.all(Object.keys(updates).map((id) => remove(ref(database, 'adminHiddenNews/' + id))));
    }
    alert(count ? `${count} notícia(s) importada(s).` : 'Todas as notícias da planilha já estão no painel.');
    await loadDashboard();
  } catch (error) {
    alert('Não foi possível importar a planilha.');
    console.error(error);
  } finally {
    button.disabled = false;
    button.textContent = 'Sincronizar planilha';
  }
}

function renderBody(text) {
  let src = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  src = src.replace(/\[(?:P|PARAGRAFO|PARÁGRAFO|BR)\]/gi, '\n');
  const tokenRegex = /\[IMG\s*:\s*([^\]]+)\]|\[(HEAD|H2|H3|H4|H)\s*:?\s*([^\]]*)\]/gi;
  let html = '', buffer = '', lastIndex = 0, match;
  const flush = () => {
    buffer.split(/\n+/).map((value) => value.trim()).filter(Boolean).forEach((value) => {
      html += '<p>' + escapeHTML(value) + '</p>';
    });
    buffer = '';
  };
  while ((match = tokenRegex.exec(src))) {
    buffer += src.slice(lastIndex, match.index);
    flush();
    if (match[1]) {
      const parts = String(match[1]).split('|');
      const url = parts.shift().trim();
      const caption = parts.join('|').trim();
      html += `<figure><img src="${escapeHTML(url)}" alt="">${caption ? `<figcaption>${escapeHTML(caption)}</figcaption>` : ''}</figure>`;
    } else if (match[2]) {
      const token = String(match[2]).toLowerCase();
      const level = token === 'h3' || token === 'h4' ? 'h3' : 'h2';
      const title = String(match[3] || '').trim();
      if (title) html += `<${level}>${escapeHTML(title)}</${level}>`;
    }
    lastIndex = tokenRegex.lastIndex;
  }
  buffer += src.slice(lastIndex);
  flush();
  return html || '<p>Sem conteúdo.</p>';
}

function formatSelectedText(type) {
  const textarea = $('#news-content');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end).trim();
  const tag = type === 'h3' ? 'H3' : 'H';
  const fallback = type === 'h3' ? 'SUBTÍTULO' : 'TÍTULO DO TÓPICO';
  const replacement = `[${tag}: ${selected || fallback}]`;
  textarea.setRangeText(replacement, start, end, 'select');
  textarea.focus();
}

function insertInlineImage() {
  const url = prompt('Cole o link da imagem que será inserida dentro do texto:');
  if (!url || !url.trim()) return;
  const textarea = $('#news-content');
  const start = textarea.selectionStart;
  const prefix = start > 0 && textarea.value[start - 1] !== '\n' ? '\n' : '';
  textarea.setRangeText(`${prefix}[IMG: ${url.trim()}]\n`, start, textarea.selectionEnd, 'end');
  textarea.focus();
}

function extractLeadHeading(content) {
  let src = String(content || '').trim();
  let headline = '';
  src = src.replace(/^\s*\[(?:HEAD|H2|H)\s*:?\s*([^\]]+)\]\s*/i, (full, title) => {
    headline = String(title || '').trim();
    return '';
  });
  return { headline, content: src };
}

function previewNews() {
  const item = readForm();
  const lead = extractLeadHeading(item.conteudo);
  const displayTitle = lead.headline || item.titulo || 'Título da notícia';
  $('#admin-preview-content').innerHTML = `${item.imagem ? `<img class="admin-preview-cover" src="${escapeHTML(item.imagem)}" alt="">` : ''}<p class="admin-eyebrow">Prévia da notícia</p><h1>${escapeHTML(displayTitle)}</h1>${item.resumo ? `<p class="admin-preview-summary">${escapeHTML(item.resumo)}</p>` : ''}<div class="admin-preview-meta">${escapeHTML(item.data)} • ${escapeHTML(item.autor)}</div><div>${renderBody(lead.content)}</div>`;
  $('#admin-preview-dialog').showModal();
}

function previewStoredNews(item) {
  const lead = extractLeadHeading(item.conteudo);
  const displayTitle = lead.headline || item.titulo || 'Título da notícia';
  $('#admin-preview-content').innerHTML = `${item.imagem ? `<img class="admin-preview-cover" src="${escapeHTML(item.imagem)}" alt="">` : ''}<p class="admin-eyebrow">Prévia da notícia</p><h1>${escapeHTML(displayTitle)}</h1>${item.resumo ? `<p class="admin-preview-summary">${escapeHTML(item.resumo)}</p>` : ''}<div class="admin-preview-meta">${escapeHTML(item.data)} • ${escapeHTML(item.autor)}</div><div>${renderBody(lead.content)}</div>`;
  $('#admin-preview-dialog').showModal();
}

function getGaSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(GA_SETTINGS_KEY) || '{}');
    return {
      clientId: String(stored.clientId || '').trim(),
      propertyId: String(stored.propertyId || '').replace(/\D/g, ''),
      period: ['7', '28', '90'].includes(String(stored.period)) ? String(stored.period) : '28'
    };
  } catch (_) {
    return { clientId: '', propertyId: '', period: '28' };
  }
}

function fillGaSettings() {
  const settings = getGaSettings();
  $('#ga-client-id').value = settings.clientId;
  $('#ga-property-id').value = settings.propertyId;
  $('#ga-period').value = settings.period;
}

function saveGaSettings(showMessage = true) {
  const settings = {
    clientId: $('#ga-client-id').value.trim(),
    propertyId: $('#ga-property-id').value.replace(/\D/g, ''),
    period: $('#ga-period').value
  };
  localStorage.setItem(GA_SETTINGS_KEY, JSON.stringify(settings));
  if (showMessage) setMessage($('#ga-message'), 'Configuração salva neste navegador.', 'success');
  return settings;
}

function loadGoogleIdentity() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = '1';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Não foi possível carregar o login do Google'));
    document.head.appendChild(script);
  });
}

async function gaApiRequest(method, body) {
  const settings = getGaSettings();
  if (!gaAccessToken) throw new Error('Conecte sua conta Google novamente.');
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${settings.propertyId}:${method}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${gaAccessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data && data.error && data.error.message ? data.error.message : 'Falha ao consultar o Google Analytics';
    throw new Error(message);
  }
  return data;
}

function gaMetric(report, index = 0) {
  return Number(report && report.rows && report.rows[0] && report.rows[0].metricValues && report.rows[0].metricValues[index] && report.rows[0].metricValues[index].value || 0);
}

async function loadGoogleAnalyticsData() {
  const settings = getGaSettings();
  if (!settings.propertyId) return setMessage($('#ga-message'), 'Informe o ID numérico da propriedade GA4.', 'error');
  const refresh = $('#ga-refresh');
  refresh.disabled = true;
  setMessage($('#ga-message'), 'Carregando dados oficiais do Google Analytics...');
  try {
    const [summary, topPages, realtime] = await Promise.all([
      gaApiRequest('runReport', {
        dateRanges: [{ startDate: `${settings.period}daysAgo`, endDate: 'today' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }]
      }),
      gaApiRequest('runReport', {
        dateRanges: [{ startDate: `${settings.period}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'pageTitle' }, { name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10
      }),
      gaApiRequest('runRealtimeReport', { metrics: [{ name: 'activeUsers' }] }).catch(() => ({ rows: [] }))
    ]);

    $('#ga-active-users').textContent = formatNumber(gaMetric(summary, 0));
    $('#ga-sessions').textContent = formatNumber(gaMetric(summary, 1));
    $('#ga-page-views').textContent = formatNumber(gaMetric(summary, 2));
    $('#ga-realtime-users').textContent = formatNumber(gaMetric(realtime, 0));

    const rows = Array.isArray(topPages.rows) ? topPages.rows : [];
    $('#ga-top-pages').innerHTML = rows.length ? rows.map((row, index) => {
      const dims = row.dimensionValues || [];
      const metrics = row.metricValues || [];
      const title = dims[0] && dims[0].value || 'Página';
      const path = dims[1] && dims[1].value || '';
      const views = metrics[0] && metrics[0].value || 0;
      const users = metrics[1] && metrics[1].value || 0;
      return `<div class="admin-ranking-row"><span class="admin-ranking-pos">${index + 1}</span><div class="admin-ranking-copy"><strong>${escapeHTML(title)}</strong><small>${escapeHTML(path)} • ${formatNumber(users)} usuários</small></div><span class="admin-ranking-value">${formatNumber(views)} views</span></div>`;
    }).join('') : '<div class="admin-empty">O Google Analytics ainda não retornou páginas para este período</div>';

    $('#ga-results').hidden = false;
    refresh.disabled = false;
    setMessage($('#ga-message'), `Dados atualizados • últimos ${settings.period} dias`, 'success');
  } catch (error) {
    if (/401|token|credential|authentication|unauthenticated/i.test(String(error.message || ''))) gaAccessToken = '';
    refresh.disabled = !gaAccessToken;
    setMessage($('#ga-message'), error.message || 'Não foi possível carregar o Analytics.', 'error');
    console.error(error);
  }
}

async function connectGoogleAnalytics() {
  const settings = saveGaSettings(false);
  if (!settings.clientId || !settings.propertyId) {
    setMessage($('#ga-message'), 'Preencha o OAuth Client ID e o ID numérico da propriedade.', 'error');
    return;
  }
  const button = $('#ga-connect');
  button.disabled = true;
  setMessage($('#ga-message'), 'Abrindo o acesso da sua conta Google...');
  try {
    await loadGoogleIdentity();
    gaTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: settings.clientId,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      callback: async (response) => {
        button.disabled = false;
        if (!response || response.error || !response.access_token) {
          setMessage($('#ga-message'), response && response.error_description || 'A conexão com o Google foi cancelada.', 'error');
          return;
        }
        gaAccessToken = response.access_token;
        gaTokenExpiresAt = Date.now() + Math.max(60, Number(response.expires_in || 3600) - 60) * 1000;
        $('#ga-refresh').disabled = false;
        button.textContent = 'Reconectar conta Google';
        await loadGoogleAnalyticsData();
      },
      error_callback: (error) => {
        button.disabled = false;
        setMessage($('#ga-message'), error && error.message || 'Não foi possível abrir o acesso do Google.', 'error');
      }
    });
    gaTokenClient.requestAccessToken({ prompt: gaAccessToken && Date.now() < gaTokenExpiresAt ? '' : 'consent' });
  } catch (error) {
    button.disabled = false;
    setMessage($('#ga-message'), error.message || 'Não foi possível conectar o Google Analytics.', 'error');
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = $('#admin-password').value;
  const submit = loginForm.querySelector('[type="submit"]');
  submit.disabled = true;
  setMessage(loginMessage, 'Validando acesso...');
  try {
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
    if (!isAdmin(credential.user)) throw new Error('Conta não autorizada');
    $('#admin-password').value = '';
    setMessage(loginMessage, '');
  } catch (error) {
    setMessage(loginMessage, 'Senha incorreta ou conta ainda não configurada no Firebase.', 'error');
  } finally {
    submit.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  const allowed = isAdmin(user);
  loginSection.hidden = allowed;
  dashboard.hidden = !allowed;
  logoutButton.hidden = !allowed;
  if (user && !allowed) await signOut(auth);
  if (allowed) { clearForm(); clearLiveForm(); await Promise.all([loadDashboard(), loadAdminLives()]); }
});

logoutButton.addEventListener('click', () => signOut(auth));
$('#admin-toggle-password').addEventListener('click', () => {
  const input = $('#admin-password');
  input.type = input.type === 'password' ? 'text' : 'password';
  $('#admin-toggle-password').textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar';
});
$('#admin-refresh').addEventListener('click', () => Promise.all([loadDashboard(), loadAdminLives()]));
$('#admin-new-news').addEventListener('click', clearForm);
$('#admin-import-local').addEventListener('click', importLocalNews);
$('#admin-import-sheet').addEventListener('click', importSheet);
$('#admin-preview-news').addEventListener('click', previewNews);
$('#admin-insert-image').addEventListener('click', insertInlineImage);
document.querySelectorAll('[data-editor-format]').forEach((button) => button.addEventListener('click', () => formatSelectedText(button.dataset.editorFormat)));
$('#ga-save-settings').addEventListener('click', () => saveGaSettings(true));
$('#ga-connect').addEventListener('click', connectGoogleAnalytics);
$('#ga-refresh').addEventListener('click', loadGoogleAnalyticsData);
$('#ga-period').addEventListener('change', () => { saveGaSettings(false); if (gaAccessToken) loadGoogleAnalyticsData(); });
fillGaSettings();
$('#admin-close-preview').addEventListener('click', () => $('#admin-preview-dialog').close());
if (liveForm) liveForm.addEventListener('submit', saveLive);
$('#admin-new-live')?.addEventListener('click', clearLiveForm);
$('#admin-clear-live')?.addEventListener('click', clearLiveForm);
newsForm.addEventListener('submit', saveNews);
searchInput.addEventListener('input', renderNewsList);
$('#admin-news-filter').addEventListener('change', (event) => { currentNewsFilter = event.target.value; renderNewsList(); });
$('#news-title').addEventListener('input', (event) => { if (!slugTouched) $('#news-slug').value = slugify(event.target.value); });
$('#news-slug').addEventListener('input', () => { slugTouched = true; });
document.addEventListener('click', (event) => {
  const editLive = event.target.closest('[data-edit-live]');
  if (editLive) { const item = allLives.find((live) => live.id === editLive.dataset.editLive); if (item) fillLiveForm(item); return; }
  const duplicateLive = event.target.closest('[data-duplicate-live]');
  if (duplicateLive) { const item = allLives.find((live) => live.id === duplicateLive.dataset.duplicateLive); if (item) duplicateLiveForm(item); return; }
  const deleteLiveButton = event.target.closest('[data-delete-live]');
  if (deleteLiveButton) { deleteLive(deleteLiveButton.dataset.deleteLive); return; }
  const move = event.target.closest('[data-move-news]');
  if (move) { moveNews(move.dataset.newsId, move.dataset.moveNews, move); return; }
  const edit = event.target.closest('[data-edit-news]');
  if (edit) { const item = allNews.find((news) => news.id === edit.dataset.editNews); if (item) fillForm(item); }
  const preview = event.target.closest('[data-preview-news]');
  if (preview) { const item = allNews.find((news) => news.id === preview.dataset.previewNews); if (item) previewStoredNews(item); }
  const del = event.target.closest('[data-delete-news]');
  if (del) deleteNews(del.dataset.deleteNews);
});

document.addEventListener('change', (event) => {
  const featured = event.target.closest('[data-toggle-featured]');
  if (featured) updateNewsFeatured(featured.dataset.toggleFeatured, featured.checked, featured);
  const status = event.target.closest('[data-change-status]');
  if (status) updateNewsStatus(status.dataset.changeStatus, status.value, status);
});
