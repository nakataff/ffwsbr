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
let allNews = [];
let newsMetrics = {};
let pageAnalytics = [];
let slugTouched = false;

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

function normalizeNews(raw, id = '') {
  return {
    id: String(raw && (raw.id || id) || '').trim(),
    titulo: String(raw && raw.titulo || '').trim(),
    imagem: String(raw && raw.imagem || '').trim(),
    resumo: String(raw && raw.resumo || '').trim(),
    conteudo: String(raw && raw.conteudo || '').trim(),
    data: String(raw && raw.data || '').trim(),
    autor: String(raw && raw.autor || 'Central Free Fire').trim(),
    link_original: String(raw && (raw.link_original || raw.link) || '').trim(),
    destaque: Boolean(raw && raw.destaque),
    status: String(raw && raw.status || 'published'),
    createdAt: Number(raw && raw.createdAt || 0),
    updatedAt: Number(raw && raw.updatedAt || 0)
  };
}

async function loadDashboard() {
  $('#admin-refresh').disabled = true;
  try {
    const [newsSnap, draftsSnap, metricsSnap, analyticsSnap] = await Promise.all([
      get(ref(database, 'adminNews')),
      get(ref(database, 'adminDrafts')),
      get(ref(database, 'newsMetrics')),
      get(ref(database, 'siteAnalytics/pages'))
    ]);
    const newsData = newsSnap.val() || {};
    const draftsData = draftsSnap.val() || {};
    const published = Object.keys(newsData).map((id) => normalizeNews({ ...newsData[id], status: 'published' }, id));
    const drafts = Object.keys(draftsData).map((id) => normalizeNews({ ...draftsData[id], status: 'draft' }, id));
    allNews = published.concat(drafts).sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
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

  $('#admin-latest-updates').innerHTML = allNews.length ? allNews.slice(0, 8).map((item) => `
    <div class="admin-update-row">
      <div class="admin-update-copy"><strong>${escapeHTML(item.titulo)}</strong><small>${item.status === 'draft' ? 'Rascunho' : 'Publicada'} • ${formatDate(item.updatedAt || item.createdAt)}</small></div>
      <button class="admin-btn admin-btn-ghost" type="button" data-edit-news="${escapeHTML(item.id)}">Editar</button>
    </div>`).join('') : '<div class="admin-empty">Nenhuma atualização pelo painel</div>';

  renderNewsList();
}

function renderNewsList() {
  const query = String(searchInput.value || '').trim().toLowerCase();
  const filtered = allNews.filter((item) => !query || item.titulo.toLowerCase().includes(query) || item.id.toLowerCase().includes(query));
  newsList.innerHTML = filtered.length ? filtered.map((item) => {
    const metric = newsMetrics[item.id] || {};
    return `<article class="admin-news-row">
      <img class="admin-news-thumb" src="${escapeHTML(item.imagem || 'central free fire.webp')}" alt="" onerror="this.src='central free fire.webp'">
      <div class="admin-news-copy"><strong>${escapeHTML(item.titulo)}</strong><small>${escapeHTML(item.id)} • ${formatNumber(metric.views)} views • ${formatNumber(metric.likes)} curtidas</small><div class="admin-news-meta"><span class="admin-chip ${item.status === 'draft' ? 'is-draft' : ''}">${item.status === 'draft' ? 'Rascunho' : 'Publicada'}</span>${item.destaque ? '<span class="admin-chip is-featured">Destaque</span>' : ''}</div></div>
      <div class="admin-news-actions"><a class="admin-btn admin-btn-ghost" href="noticia.html?id=${encodeURIComponent(item.id)}" target="_blank" rel="noopener">Abrir</a><button class="admin-btn admin-btn-ghost" type="button" data-edit-news="${escapeHTML(item.id)}">Editar</button><button class="admin-btn admin-btn-danger" type="button" data-delete-news="${escapeHTML(item.id)}">Excluir</button></div>
    </article>`;
  }).join('') : '<div class="admin-empty">Nenhuma notícia encontrada</div>';
}

function clearForm() {
  newsForm.reset();
  $('#news-original-id').value = '';
  $('#news-author').value = 'Central Free Fire';
  $('#news-status').value = 'published';
  $('#news-date').value = todayInputValue();
  $('#editor-title').textContent = 'Nova notícia';
  slugTouched = false;
  setMessage(formMessage, '');
}

function fillForm(item) {
  $('#news-original-id').value = item.id;
  $('#news-title').value = item.titulo;
  $('#news-slug').value = item.id;
  $('#news-date').value = /^\d{4}-\d{2}-\d{2}$/.test(item.data) ? item.data : '';
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
  return {
    id,
    titulo,
    imagem: $('#news-image').value.trim(),
    resumo: $('#news-summary').value.trim(),
    conteudo: $('#news-content').value.trim(),
    data: $('#news-date').value || todayInputValue(),
    autor: $('#news-author').value.trim() || 'Central Free Fire',
    link_original: $('#news-original-link').value.trim(),
    destaque: $('#news-featured').checked,
    status: $('#news-status').value === 'draft' ? 'draft' : 'published'
  };
}

async function saveNews(event) {
  event.preventDefault();
  const submit = newsForm.querySelector('[type="submit"]');
  const originalId = $('#news-original-id').value.trim();
  const item = readForm();
  if (!item.id || !item.titulo || !item.conteudo) {
    setMessage(formMessage, 'Preencha título, slug e conteúdo.', 'error');
    return;
  }
  submit.disabled = true;
  setMessage(formMessage, 'Salvando...');
  try {
    const previous = allNews.find((news) => news.id === originalId);
    const payload = {
      ...item,
      createdAt: previous && previous.createdAt ? previous.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const destination = item.status === 'draft' ? 'adminDrafts' : 'adminNews';
    const opposite = item.status === 'draft' ? 'adminNews' : 'adminDrafts';
    await set(ref(database, destination + '/' + item.id), payload);
    await remove(ref(database, opposite + '/' + item.id));
    if (originalId && originalId !== item.id) {
      await Promise.all([
        remove(ref(database, 'adminNews/' + originalId)),
        remove(ref(database, 'adminDrafts/' + originalId))
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

async function deleteNews(id) {
  const item = allNews.find((news) => news.id === id);
  if (!item || !confirm(`Excluir a notícia "${item.titulo}"?`)) return;
  try {
    await Promise.all([remove(ref(database, 'adminNews/' + id)), remove(ref(database, 'adminDrafts/' + id))]);
    if ($('#news-original-id').value === id) clearForm();
    await loadDashboard();
  } catch (error) {
    alert('Não foi possível excluir a notícia.');
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
    const existing = new Set(allNews.map((item) => item.id));
    const updates = {};
    imported.forEach((item) => {
      if (existing.has(item.id)) return;
      updates[item.id] = { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });
    const count = Object.keys(updates).length;
    if (count) await update(ref(database, 'adminNews'), updates);
    alert(count ? `${count} notícia(s) importada(s).` : 'Todas as notícias da planilha já estão no painel.');
    await loadDashboard();
  } catch (error) {
    alert('Não foi possível importar a planilha.');
    console.error(error);
  } finally {
    button.disabled = false;
    button.textContent = 'Importar da planilha';
  }
}

function renderBody(text) {
  const src = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const tokenRegex = /\[(P|PARAGRAFO|PARÁGRAFO|BR)\]|\[IMG\s*:\s*([^\]]+)\]|\[(HEAD|H2|H3|H)\s*:?\s*([^\]]*)\]/gi;
  let html = '', buffer = '', lastIndex = 0, match;
  const flush = () => { const value = buffer.trim(); if (value) html += '<p>' + escapeHTML(value).replace(/\n/g, '<br>') + '</p>'; buffer = ''; };
  while ((match = tokenRegex.exec(src))) {
    buffer += src.slice(lastIndex, match.index); flush();
    if (match[2]) {
      const parts = String(match[2]).split('|'); const url = parts.shift().trim(); const caption = parts.join('|').trim();
      html += `<figure><img src="${escapeHTML(url)}" alt="">${caption ? `<figcaption>${escapeHTML(caption)}</figcaption>` : ''}</figure>`;
    } else if (match[3]) {
      const level = String(match[3]).toLowerCase() === 'h3' ? 'h3' : 'h2';
      if (String(match[4] || '').trim()) html += `<${level}>${escapeHTML(String(match[4]).trim())}</${level}>`;
    }
    lastIndex = tokenRegex.lastIndex;
  }
  buffer += src.slice(lastIndex); flush();
  return html || '<p>Sem conteúdo.</p>';
}

function previewNews() {
  const item = readForm();
  $('#admin-preview-content').innerHTML = `${item.imagem ? `<img class="admin-preview-cover" src="${escapeHTML(item.imagem)}" alt="">` : ''}<p class="admin-eyebrow">Prévia da notícia</p><h1>${escapeHTML(item.titulo || 'Título da notícia')}</h1>${item.resumo ? `<p class="admin-preview-summary">${escapeHTML(item.resumo)}</p>` : ''}<div class="admin-preview-meta">${escapeHTML(item.data)} • ${escapeHTML(item.autor)}</div><div>${renderBody(item.conteudo)}</div>`;
  $('#admin-preview-dialog').showModal();
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
  if (allowed) { clearForm(); await loadDashboard(); }
});

logoutButton.addEventListener('click', () => signOut(auth));
$('#admin-toggle-password').addEventListener('click', () => {
  const input = $('#admin-password');
  input.type = input.type === 'password' ? 'text' : 'password';
  $('#admin-toggle-password').textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar';
});
$('#admin-refresh').addEventListener('click', loadDashboard);
$('#admin-new-news').addEventListener('click', clearForm);
$('#admin-import-sheet').addEventListener('click', importSheet);
$('#admin-preview-news').addEventListener('click', previewNews);
$('#admin-close-preview').addEventListener('click', () => $('#admin-preview-dialog').close());
newsForm.addEventListener('submit', saveNews);
searchInput.addEventListener('input', renderNewsList);
$('#news-title').addEventListener('input', (event) => { if (!slugTouched) $('#news-slug').value = slugify(event.target.value); });
$('#news-slug').addEventListener('input', () => { slugTouched = true; });
document.addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit-news]');
  if (edit) { const item = allNews.find((news) => news.id === edit.dataset.editNews); if (item) fillForm(item); }
  const del = event.target.closest('[data-delete-news]');
  if (del) deleteNews(del.dataset.deleteNews);
});
