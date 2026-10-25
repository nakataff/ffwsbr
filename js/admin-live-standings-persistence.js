import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getDatabase, ref, get, update } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';

const config = window.CFF_CONFIG?.firebase;
if (!config) throw new Error('Configuração do Firebase não encontrada.');

const app = getApps().length ? getApp() : initializeApp(config);
const database = getDatabase(app);
const liveList = document.querySelector('#admin-live-list');
let currentId = '';

function ensureControl() {
  const modal = document.getElementById('cff-live-standings-modal');
  if (!modal) return null;
  let input = document.getElementById('cff-standings-keep-visible');
  if (input) return input;

  const primary = document.getElementById('cff-standings-enabled')?.closest('label');
  if (!primary) return null;

  const label = document.createElement('label');
  label.className = 'cff-standings-toggle';
  label.style.marginTop = '-4px';
  label.innerHTML = '<input id="cff-standings-keep-visible" type="checkbox"> Manter a tabela visível entre os dias do campeonato';

  const note = document.createElement('div');
  note.id = 'cff-standings-keep-visible-note';
  note.style.cssText = 'margin:-4px 2px 14px;color:#7896b5;font-size:.72rem;line-height:1.35';
  note.textContent = 'Útil para finais em dias diferentes. A tabela continua na home fora do horário da live e some automaticamente quando todas as quedas do código estiverem concluídas.';

  primary.insertAdjacentElement('afterend', note);
  primary.insertAdjacentElement('afterend', label);
  return label.querySelector('input');
}

async function loadSetting(id) {
  const input = ensureControl();
  if (!input || !id) return;
  input.disabled = true;
  try {
    const snapshot = await get(ref(database, `adminLives/${id}/standingsKeepVisible`));
    input.checked = snapshot.val() === true;
  } catch (error) {
    console.warn('[Tabela persistente] Não foi possível carregar a opção:', error);
    input.checked = false;
  } finally {
    input.disabled = false;
  }
}

async function saveSetting() {
  const input = ensureControl();
  if (!input || !currentId) return;
  try {
    await update(ref(database, `adminLives/${currentId}`), { standingsKeepVisible: Boolean(input.checked) });
  } catch (error) {
    console.error('[Tabela persistente] Não foi possível salvar a opção:', error);
  }
}

if (liveList) {
  ensureControl();

  liveList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-standings-live]');
    if (!button) return;
    currentId = String(button.dataset.standingsLive || '');
    queueMicrotask(() => loadSetting(currentId));
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('#cff-standings-save')) {
      saveSetting();
      return;
    }
    if (event.target.closest('#cff-standings-remove') && currentId) {
      update(ref(database, `adminLives/${currentId}`), { standingsKeepVisible: false }).catch(() => {});
    }
  });
}
