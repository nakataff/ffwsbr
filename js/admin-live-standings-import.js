import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';

const config = window.CFF_CONFIG?.firebase;
if (!config) throw new Error('Configuração do Firebase não encontrada.');

const app = getApps().length ? getApp() : initializeApp(config);
const database = getDatabase(app);

let currentLiveId = '';
let liveCache = null;
let loadingLives = null;

const $ = (selector, root = document) => root.querySelector(selector);
const norm = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

function hasTable(live) {
  const standings = live?.standings;
  if (!standings) return false;
  if (String(standings.rawCode || '').trim()) return true;
  if (Array.isArray(standings.teams) && standings.teams.length) return true;
  if (standings.teams && typeof standings.teams === 'object' && Object.keys(standings.teams).length) return true;
  return false;
}

function formatLiveLabel(live) {
  const parts = [String(live?.torneio || '').trim(), String(live?.faseDia || '').trim()].filter(Boolean);
  const raw = String(live?.inicio || '').trim();
  if (raw) {
    const date = new Date(raw.length === 16 ? raw + ':00-03:00' : raw);
    if (!Number.isNaN(date.getTime())) {
      parts.push(date.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(',', ' •'));
    }
  }
  return parts.join(' • ') || 'Transmissão com tabela';
}

async function loadLives(force = false) {
  if (!force && liveCache) return liveCache;
  if (loadingLives) return loadingLives;
  loadingLives = (async () => {
    const snap = await get(ref(database, 'adminLives'));
    liveCache = snap.val() || {};
    return liveCache;
  })().finally(() => { loadingLives = null; });
  return loadingLives;
}

function setStatus(text, kind = 'ok') {
  const status = $('#cff-standings-status');
  if (!status) return;
  status.textContent = text;
  status.className = `cff-standings-status${kind ? ` ${kind}` : ''}`;
}

function sourceTeams(standings) {
  return Array.isArray(standings?.teams) ? standings.teams : Object.values(standings?.teams || {});
}

function applyTeamNames(standings) {
  const byCode = new Map(sourceTeams(standings).map(team => [norm(team?.code), String(team?.name || '').trim()]));
  document.querySelectorAll('#cff-live-standings-modal .cff-name').forEach(input => {
    const saved = byCode.get(norm(input.dataset.code));
    if (!saved) return;
    input.value = saved;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function importSelected() {
  const select = $('#cff-standings-import-select');
  const sourceId = String(select?.value || '');
  if (!sourceId) return setStatus('Escolha uma live para importar.', 'warn');

  try {
    const lives = await loadLives();
    const source = lives[sourceId];
    const standings = source?.standings;
    if (!source || !hasTable(source)) throw new Error('A live escolhida não tem tabela salva.');

    const code = $('#cff-standings-code');
    const title = $('#cff-standings-label');
    const enabled = $('#cff-standings-enabled');
    const keep = $('#cff-standings-keep');
    if (!code || !title) throw new Error('Editor da tabela não está disponível.');

    code.value = String(standings.rawCode || '');
    title.value = String(standings.title || '');
    title.dataset.auto = title.value ? '0' : '1';
    if (enabled) enabled.checked = Boolean(standings.enabled);
    if (keep) keep.checked = Boolean(source.standingsKeepVisible);

    code.dispatchEvent(new Event('input', { bubbles: true }));
    const parse = $('#cff-standings-parse');
    if (parse) parse.click();

    window.setTimeout(() => {
      applyTeamNames(standings);
      setStatus(`Tabela importada de “${formatLiveLabel(source)}”. Revise e clique em Salvar tabela.`, 'ok');
    }, 80);
  } catch (error) {
    console.error('[Importar tabela da live]', error);
    setStatus(error?.message || 'Não foi possível importar a tabela.', 'error');
  }
}

async function populateImportOptions() {
  const select = $('#cff-standings-import-select');
  if (!select) return;
  select.disabled = true;
  select.innerHTML = '<option value="">Carregando tabelas...</option>';
  try {
    const lives = await loadLives(true);
    const current = lives[currentLiveId] || {};
    const currentTournament = norm(current.torneio);
    const options = Object.entries(lives)
      .filter(([id, live]) => id !== currentLiveId && hasTable(live))
      .sort(([, a], [, b]) => String(b?.inicio || '').localeCompare(String(a?.inicio || '')));

    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = options.length ? 'Selecione uma live anterior' : 'Nenhuma outra tabela encontrada';
    select.appendChild(placeholder);

    let preferred = '';
    options.forEach(([id, live]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = formatLiveLabel(live);
      select.appendChild(option);
      if (!preferred && currentTournament && norm(live?.torneio) === currentTournament) preferred = id;
    });
    if (preferred) select.value = preferred;
  } catch (error) {
    console.error('[Importar tabela da live]', error);
    select.innerHTML = '<option value="">Erro ao carregar tabelas</option>';
  } finally {
    select.disabled = false;
  }
}

function closeImportPanel() {
  const panel = $('#cff-standings-import-panel');
  if (panel) panel.hidden = true;
}

async function toggleImportPanel() {
  const panel = $('#cff-standings-import-panel');
  if (!panel) return;
  panel.hidden = !panel.hidden;
  if (!panel.hidden) await populateImportOptions();
}

function ensureUi() {
  const modal = $('#cff-live-standings-modal');
  const toolbar = modal?.querySelector('.cff-standings-toolbar');
  if (!modal || !toolbar || $('#cff-standings-import')) return;

  if (!$('#cff-standings-import-css')) {
    const style = document.createElement('style');
    style.id = 'cff-standings-import-css';
    style.textContent = `
      .cff-standings-import-panel[hidden]{display:none!important}
      .cff-standings-import-panel{display:flex;gap:8px;align-items:center;flex-wrap:wrap;width:100%;padding:10px 11px;border:1px solid rgba(0,200,255,.16);border-radius:10px;background:rgba(0,200,255,.045)}
      .cff-standings-import-panel select{min-width:min(420px,100%);flex:1;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#07101a;color:#fff;padding:10px 11px;font:inherit}
      @media(max-width:760px){.cff-standings-import-panel{align-items:stretch}.cff-standings-import-panel select,.cff-standings-import-panel .admin-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  const button = document.createElement('button');
  button.id = 'cff-standings-import';
  button.className = 'admin-btn admin-btn-ghost';
  button.type = 'button';
  button.textContent = 'Importar de outra live';
  button.title = 'Copiar a tabela salva de outro dia/transmissão';
  button.addEventListener('click', toggleImportPanel);
  toolbar.insertBefore(button, toolbar.querySelector('.cff-standings-status'));

  const panel = document.createElement('div');
  panel.id = 'cff-standings-import-panel';
  panel.className = 'cff-standings-import-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <select id="cff-standings-import-select" aria-label="Live de origem"><option value="">Selecione uma live anterior</option></select>
    <button id="cff-standings-import-confirm" class="admin-btn admin-btn-primary" type="button">Importar tabela</button>
    <button id="cff-standings-import-cancel" class="admin-btn admin-btn-ghost" type="button">Fechar</button>`;
  toolbar.appendChild(panel);
  $('#cff-standings-import-confirm', panel).addEventListener('click', importSelected);
  $('#cff-standings-import-cancel', panel).addEventListener('click', closeImportPanel);
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-standings-live]');
  if (!button) return;
  currentLiveId = String(button.dataset.standingsLive || '');
  window.setTimeout(() => {
    ensureUi();
    closeImportPanel();
  }, 0);
}, true);

const observer = new MutationObserver(() => ensureUi());
observer.observe(document.documentElement, { childList: true, subtree: true });
ensureUi();
