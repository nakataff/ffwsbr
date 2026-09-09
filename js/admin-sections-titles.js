import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { getDatabase, ref, get, set, remove, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';

const VERSION = '20260909-admin-sections-titles-v1';
const ADMIN_EMAIL = 'admin@centralfreefire.com.br';
const config = window.CFF_CONFIG && window.CFF_CONFIG.firebase;
if (!config) throw new Error('Configuração do Firebase não encontrada.');

const app = getApps().length ? getApp() : initializeApp(config);
const auth = getAuth(app);
const database = getDatabase(app);
const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const slugify = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

let titles = [];
let activeSection = '';
let titlesLoaded = false;

function injectStyles() {
  if ($('#cff-admin-sections-style')) return;
  const style = document.createElement('style');
  style.id = 'cff-admin-sections-style';
  style.textContent = `
    .cff-admin-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:18px 0 16px;padding:6px;border:1px solid rgba(0,200,255,.16);border-radius:16px;background:rgba(5,13,25,.72);position:sticky;top:8px;z-index:20;backdrop-filter:blur(14px)}
    .cff-admin-tab{min-height:46px;border:1px solid transparent;border-radius:11px;background:transparent;color:#8fa9c8;font:950 .78rem/1 system-ui,sans-serif;letter-spacing:.8px;cursor:pointer;transition:.16s ease}
    .cff-admin-tab:hover{color:#fff;background:rgba(255,255,255,.035)}
    .cff-admin-tab.is-active{color:#001722;background:#00c8ff;border-color:#21d3ff;box-shadow:0 8px 30px rgba(0,200,255,.14)}
    .cff-admin-view[hidden]{display:none!important}.cff-admin-view{display:grid;gap:16px}
    .cff-admin-view>.admin-panel,.cff-admin-view>.admin-stat-grid,.cff-admin-view>.admin-dashboard-grid{margin:0}
    .cff-title-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:16px}
    .cff-title-form .admin-field-wide{grid-column:1/-1}
    .cff-title-block{border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px;background:rgba(255,255,255,.022)}
    .cff-title-block h3{margin:0 0 12px;color:#fff;font-size:.86rem;text-transform:uppercase;letter-spacing:.7px}
    .cff-title-grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .cff-title-grid-5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
    .cff-title-actions{display:flex;gap:9px;justify-content:flex-end;align-items:center;grid-column:1/-1}
    .cff-title-list{display:grid;gap:10px;margin-top:16px}
    .cff-title-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:13px 14px;border:1px solid rgba(255,255,255,.075);border-radius:13px;background:rgba(6,14,26,.7)}
    .cff-title-row-copy{min-width:0}.cff-title-row-copy strong{display:block;color:#fff;font-size:.9rem}.cff-title-row-copy span{display:block;color:#83a3c6;font-size:.73rem;margin-top:4px;line-height:1.45}.cff-title-row-copy small{display:block;color:#627f9f;font-size:.67rem;margin-top:5px}
    .cff-title-row-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
    .cff-title-badge{display:inline-flex;align-items:center;border:1px solid rgba(0,200,255,.2);background:rgba(0,200,255,.07);color:#7bdfff;border-radius:999px;padding:4px 8px;font-size:.66rem;font-weight:950;margin-right:5px}
    @media(max-width:900px){.cff-title-grid-5{grid-template-columns:repeat(2,minmax(0,1fr))}.cff-title-form{grid-template-columns:1fr 1fr}}
    @media(max-width:680px){.cff-admin-tabs{grid-template-columns:repeat(2,minmax(0,1fr));top:4px}.cff-admin-tab{min-height:42px;font-size:.72rem}.cff-title-form{grid-template-columns:1fr}.cff-title-grid-3,.cff-title-grid-5{grid-template-columns:1fr}.cff-title-row{grid-template-columns:1fr}.cff-title-row-actions{justify-content:flex-start}.cff-title-actions{justify-content:stretch}.cff-title-actions .admin-btn{flex:1}}
  `;
  document.head.appendChild(style);
}

function createView(key) {
  const view = document.createElement('div');
  view.className = 'cff-admin-view';
  view.dataset.adminView = key;
  view.hidden = true;
  return view;
}

function buildTitlesPanel() {
  const panel = document.createElement('section');
  panel.className = 'admin-panel cff-titles-panel';
  panel.innerHTML = `
    <div class="admin-panel-head admin-panel-head-wrap">
      <div><p class="admin-eyebrow">Títulos 2026</p><h2 id="cff-title-editor-heading">Adicionar resultado</h2><p class="admin-muted">Adicione o pódio do torneio e o ranking de MVP do 1º ao 5º. O ranking anual é atualizado automaticamente.</p></div>
      <button id="cff-title-new" class="admin-btn admin-btn-ghost" type="button">+ Novo resultado</button>
    </div>
    <form id="cff-title-form" class="cff-title-form">
      <input id="cff-title-original-id" type="hidden">
      <div class="admin-field"><label for="cff-title-name">Nome do torneio</label><input id="cff-title-name" maxlength="160" required placeholder="Ex.: Synk League"></div>
      <div class="admin-field"><label for="cff-title-date">Data da final</label><input id="cff-title-date" type="date" required></div>
      <div class="admin-field"><label for="cff-title-id">ID / slug</label><input id="cff-title-id" maxlength="120" placeholder="gerado automaticamente"></div>
      <div class="cff-title-block admin-field-wide"><h3>Pódio de equipes</h3><div class="cff-title-grid-3">
        <div class="admin-field"><label for="cff-title-top1">🥇 TOP 1</label><input id="cff-title-top1" maxlength="100" required placeholder="Equipe campeã"></div>
        <div class="admin-field"><label for="cff-title-top2">🥈 TOP 2</label><input id="cff-title-top2" maxlength="100" required placeholder="Vice-campeã"></div>
        <div class="admin-field"><label for="cff-title-top3">🥉 TOP 3</label><input id="cff-title-top3" maxlength="100" required placeholder="Terceiro lugar"></div>
      </div></div>
      <div class="cff-title-block admin-field-wide"><h3>Ranking de MVP</h3><div class="cff-title-grid-5">
        ${[1,2,3,4,5].map((pos) => `<div class="admin-field"><label for="cff-title-mvp${pos}">${pos}º MVP</label><input id="cff-title-mvp${pos}" maxlength="80" required placeholder="Jogador"></div>`).join('')}
      </div></div>
      <p id="cff-title-message" class="admin-message admin-field-wide" aria-live="polite"></p>
      <div class="cff-title-actions"><button id="cff-title-clear" class="admin-btn admin-btn-ghost" type="button">Limpar</button><button class="admin-btn admin-btn-primary" type="submit">Salvar resultado</button></div>
    </form>
    <div class="admin-live-list-head"><div><p class="admin-eyebrow">Resultados adicionados</p><h3>Títulos cadastrados pelo painel</h3></div><span id="cff-title-summary" class="admin-muted">Carregando...</span></div>
    <div id="cff-title-list" class="cff-title-list"><div class="admin-empty">Carregando resultados...</div></div>
  `;
  return panel;
}

function organizeDashboard() {
  const dashboard = $('#admin-dashboard');
  const welcome = dashboard && $('.admin-welcome', dashboard);
  if (!dashboard || !welcome || $('.cff-admin-tabs', dashboard)) return;

  injectStyles();
  const tabs = document.createElement('nav');
  tabs.className = 'cff-admin-tabs';
  tabs.setAttribute('aria-label', 'Seções do painel');
  const sections = [
    ['analytics', 'ANALYTICS'],
    ['lives', 'TRANSMISSÕES'],
    ['news', 'NOTÍCIAS'],
    ['titles', 'TÍTULOS']
  ];
  tabs.innerHTML = sections.map(([key, label]) => `<button class="cff-admin-tab" type="button" data-admin-tab="${key}">${label}</button>`).join('');

  const privatePanel = Array.from(dashboard.children).find((node) => node.classList && node.classList.contains('admin-panel') && node.textContent.includes('Controle de premiações'));
  (privatePanel || welcome).insertAdjacentElement('afterend', tabs);

  const views = Object.fromEntries(sections.map(([key]) => [key, createView(key)]));
  tabs.insertAdjacentElement('afterend', views.titles);
  tabs.insertAdjacentElement('afterend', views.news);
  tabs.insertAdjacentElement('afterend', views.lives);
  tabs.insertAdjacentElement('afterend', views.analytics);

  const statGrid = Array.from(dashboard.children).find((node) => node.classList && node.classList.contains('admin-stat-grid'));
  const dashGrid = Array.from(dashboard.children).find((node) => node.classList && node.classList.contains('admin-dashboard-grid'));
  const gaPanel = $('.admin-ga-panel', dashboard);
  const livePanel = $('.admin-live-panel', dashboard);
  const editorPanel = $('.admin-editor-panel', dashboard);
  const managementPanel = $('.admin-management-panel', dashboard);
  [statGrid, dashGrid, gaPanel].filter(Boolean).forEach((node) => views.analytics.appendChild(node));
  [livePanel].filter(Boolean).forEach((node) => views.lives.appendChild(node));
  [editorPanel, managementPanel].filter(Boolean).forEach((node) => views.news.appendChild(node));
  views.titles.appendChild(buildTitlesPanel());

  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-admin-tab]');
    if (button) selectSection(button.dataset.adminTab);
  });

  dashboard.addEventListener('click', (event) => {
    if (event.target.closest('[data-edit-news],#admin-new-news,#admin-import-local,#admin-import-sheet')) selectSection('news');
    if (event.target.closest('[data-edit-live],[data-duplicate-live],#admin-new-live')) selectSection('lives');
  }, true);

  bindTitleEvents();
  const saved = localStorage.getItem('cff_admin_section_v1');
  selectSection(['analytics','lives','news','titles'].includes(saved) ? saved : 'analytics');
}

function selectSection(key) {
  const dashboard = $('#admin-dashboard');
  if (!dashboard) return;
  activeSection = key;
  dashboard.querySelectorAll('[data-admin-view]').forEach((view) => { view.hidden = view.dataset.adminView !== key; });
  dashboard.querySelectorAll('[data-admin-tab]').forEach((button) => {
    const active = button.dataset.adminTab === key;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  try { localStorage.setItem('cff_admin_section_v1', key); } catch (_) {}
  if (key === 'titles' && auth.currentUser && !titlesLoaded) loadTitles();
}

function titleMessage(text, type = '') {
  const el = $('#cff-title-message');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('is-error', type === 'error');
  el.classList.toggle('is-success', type === 'success');
}

function clearTitleForm() {
  const form = $('#cff-title-form');
  if (!form) return;
  form.reset();
  $('#cff-title-original-id').value = '';
  $('#cff-title-id').value = '';
  $('#cff-title-editor-heading').textContent = 'Adicionar resultado';
  $('#cff-title-date').value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,10);
  titleMessage('');
}

function readTitleForm() {
  const name = $('#cff-title-name').value.trim();
  const originalId = $('#cff-title-original-id').value.trim();
  const typedId = $('#cff-title-id').value.trim();
  const id = originalId || slugify(typedId || `${name}-${$('#cff-title-date').value}`);
  return {
    id,
    name,
    date: $('#cff-title-date').value,
    winner: $('#cff-title-top1').value.trim(),
    runnerUp: $('#cff-title-top2').value.trim(),
    third: $('#cff-title-top3').value.trim(),
    mvpRanking: [1,2,3,4,5].map((position) => ({ position, player: $(`#cff-title-mvp${position}`).value.trim() })),
    originalId
  };
}

function renderTitles() {
  const list = $('#cff-title-list');
  const summary = $('#cff-title-summary');
  if (!list || !summary) return;
  const rows = [...titles].sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')) || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  summary.textContent = `${rows.length} resultado${rows.length === 1 ? '' : 's'}`;
  list.innerHTML = rows.length ? rows.map((item) => `
    <article class="cff-title-row">
      <div class="cff-title-row-copy">
        <strong>${esc(item.name)}</strong>
        <span><span class="cff-title-badge">TOP 1</span>${esc(item.winner)} &nbsp; <span class="cff-title-badge">TOP 2</span>${esc(item.runnerUp)} &nbsp; <span class="cff-title-badge">TOP 3</span>${esc(item.third)}</span>
        <small>${esc(item.date || 'Sem data')} • MVP: ${(item.mvpRanking || []).map((entry) => `${Number(entry.position)}º ${esc(entry.player)}`).join(' • ')}</small>
      </div>
      <div class="cff-title-row-actions"><button class="admin-btn admin-btn-ghost" type="button" data-title-edit="${esc(item.id)}">Editar</button><button class="admin-btn admin-btn-danger" type="button" data-title-delete="${esc(item.id)}">Excluir</button></div>
    </article>`).join('') : '<div class="admin-empty">Nenhum resultado adicionado pelo painel ainda.</div>';
}

function normalizeTitle(raw, id) {
  const ranking = Array.isArray(raw && raw.mvpRanking) ? raw.mvpRanking : Object.values(raw && raw.mvpRanking || {});
  return {
    id: String(raw && (raw.id || id) || id || ''),
    name: String(raw && raw.name || ''),
    date: String(raw && raw.date || ''),
    winner: String(raw && raw.winner || ''),
    runnerUp: String(raw && raw.runnerUp || ''),
    third: String(raw && raw.third || ''),
    mvpRanking: ranking.map((entry, index) => ({ position: Number(entry && entry.position || index + 1), player: String(entry && entry.player || '') })).filter((entry) => entry.position >= 1 && entry.position <= 5 && entry.player)
  };
}

async function loadTitles() {
  const list = $('#cff-title-list');
  if (!list || !auth.currentUser) return;
  try {
    const snap = await get(ref(database, 'adminTitles'));
    const data = snap.val() || {};
    titles = Object.keys(data).map((id) => normalizeTitle(data[id], id));
    titlesLoaded = true;
    renderTitles();
  } catch (error) {
    list.innerHTML = '<div class="admin-empty">Não foi possível carregar os títulos do painel.</div>';
    titleMessage('O Firebase recusou a leitura de adminTitles. Publique as regras atualizadas do banco.', 'error');
    console.error(error);
  }
}

async function saveTitle(event) {
  event.preventDefault();
  if (!auth.currentUser || String(auth.currentUser.email || '').toLowerCase() !== ADMIN_EMAIL) return titleMessage('Sessão administrativa inválida.', 'error');
  const item = readTitleForm();
  if (!item.id || !item.name || !item.date || !item.winner || !item.runnerUp || !item.third || item.mvpRanking.some((entry) => !entry.player)) return titleMessage('Preencha torneio, data, TOP 1, TOP 2, TOP 3 e os cinco jogadores do ranking de MVP.', 'error');
  if (new Set([item.winner.toLowerCase(), item.runnerUp.toLowerCase(), item.third.toLowerCase()]).size < 3) return titleMessage('TOP 1, TOP 2 e TOP 3 precisam ser equipes diferentes.', 'error');
  const previous = titles.find((row) => row.id === item.originalId);
  const payload = {
    id: item.id,
    name: item.name,
    date: item.date,
    winner: item.winner,
    runnerUp: item.runnerUp,
    third: item.third,
    mvp: [item.mvpRanking[0].player],
    mvpRanking: item.mvpRanking,
    createdAt: previous && previous.createdAt ? previous.createdAt : serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const submit = $('#cff-title-form [type="submit"]');
  submit.disabled = true;
  titleMessage('Salvando resultado...');
  try {
    await set(ref(database, `adminTitles/${item.id}`), payload);
    if (item.originalId && item.originalId !== item.id) await remove(ref(database, `adminTitles/${item.originalId}`));
    titleMessage('Resultado salvo e pronto para entrar no ranking anual.', 'success');
    clearTitleForm();
    await loadTitles();
  } catch (error) {
    titleMessage('Não foi possível salvar. Confira se as regras adminTitles foram publicadas no Firebase.', 'error');
    console.error(error);
  } finally {
    submit.disabled = false;
  }
}

function editTitle(id) {
  const item = titles.find((row) => row.id === id);
  if (!item) return;
  selectSection('titles');
  $('#cff-title-original-id').value = item.id;
  $('#cff-title-id').value = item.id;
  $('#cff-title-name').value = item.name;
  $('#cff-title-date').value = item.date;
  $('#cff-title-top1').value = item.winner;
  $('#cff-title-top2').value = item.runnerUp;
  $('#cff-title-top3').value = item.third;
  for (let pos = 1; pos <= 5; pos++) $('#cff-title-mvp' + pos).value = item.mvpRanking.find((entry) => entry.position === pos)?.player || '';
  $('#cff-title-editor-heading').textContent = 'Editar resultado';
  titleMessage('');
  $('#cff-title-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteTitle(id) {
  const item = titles.find((row) => row.id === id);
  if (!item || !confirm(`Excluir ${item.name} do ranking anual?`)) return;
  try {
    await remove(ref(database, `adminTitles/${id}`));
    titleMessage('Resultado excluído.', 'success');
    await loadTitles();
  } catch (error) {
    titleMessage('Não foi possível excluir o resultado.', 'error');
    console.error(error);
  }
}

function bindTitleEvents() {
  const form = $('#cff-title-form');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';
  form.addEventListener('submit', saveTitle);
  $('#cff-title-new').addEventListener('click', clearTitleForm);
  $('#cff-title-clear').addEventListener('click', clearTitleForm);
  $('#cff-title-name').addEventListener('input', () => {
    if (!$('#cff-title-original-id').value && !$('#cff-title-id').dataset.manual) $('#cff-title-id').value = slugify(`${$('#cff-title-name').value}-${$('#cff-title-date').value}`);
  });
  $('#cff-title-date').addEventListener('change', () => {
    if (!$('#cff-title-original-id').value && !$('#cff-title-id').dataset.manual) $('#cff-title-id').value = slugify(`${$('#cff-title-name').value}-${$('#cff-title-date').value}`);
  });
  $('#cff-title-id').addEventListener('input', () => { $('#cff-title-id').dataset.manual = '1'; });
  $('#cff-title-list').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-title-edit]');
    const del = event.target.closest('[data-title-delete]');
    if (edit) editTitle(edit.dataset.titleEdit);
    if (del) deleteTitle(del.dataset.titleDelete);
  });
  clearTitleForm();
}

function init() {
  organizeDashboard();
  onAuthStateChanged(auth, (user) => {
    if (user && String(user.email || '').toLowerCase() === ADMIN_EMAIL) {
      if (activeSection === 'titles') loadTitles();
    } else {
      titles = [];
      titlesLoaded = false;
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();

window.CFF_ADMIN_SECTIONS_VERSION = VERSION;
