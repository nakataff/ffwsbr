import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getDatabase, ref, get, update } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';

const config = window.CFF_CONFIG && window.CFF_CONFIG.firebase;
if (!config) throw new Error('Configuração do Firebase não encontrada.');

const app = getApps().length ? getApp() : initializeApp(config);
const database = getDatabase(app);
const liveList = document.querySelector('#admin-live-list');

if (liveList) {
  let liveStates = new Map();
  let currentLiveId = '';
  let currentLive = null;
  let parsed = null;
  let currentNames = new Map();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const num = (value, fallback = 0) => {
    const n = Number(String(value ?? '').trim().replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  };
  const normalizeCode = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const safeName = (value, fallback = '') => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80) || fallback;

  function injectStyles() {
    if (document.getElementById('cff-live-standings-admin-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-live-standings-admin-css';
    style.textContent = `
      .cff-standings-modal[hidden]{display:none!important}
      .cff-standings-modal{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:18px;background:rgba(2,7,14,.78);backdrop-filter:blur(8px)}
      .cff-standings-dialog{width:min(1040px,100%);max-height:min(900px,94vh);overflow:auto;border:1px solid rgba(0,200,255,.24);border-radius:18px;background:#0a111d;box-shadow:0 28px 80px rgba(0,0,0,.46);color:#eaf6ff}
      .cff-standings-head{position:sticky;top:0;z-index:2;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 22px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(10,17,29,.97);backdrop-filter:blur(10px)}
      .cff-standings-head h2{margin:2px 0 4px;font-size:1.35rem}.cff-standings-head p{margin:0;color:#7f9ab7;font-size:.8rem}
      .cff-standings-close{border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#111c2b;color:#dbeeff;width:38px;height:38px;cursor:pointer;font-size:1.1rem}
      .cff-standings-body{padding:20px 22px 22px}
      .cff-standings-toggle{display:flex;align-items:center;gap:10px;padding:12px 14px;margin-bottom:14px;border:1px solid rgba(0,200,255,.18);border-radius:11px;background:rgba(0,200,255,.06);font-weight:900}
      .cff-standings-toggle input{width:18px;height:18px}
      .cff-standings-fields{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:12px;margin-bottom:12px}
      .cff-standings-field{display:grid;gap:6px}.cff-standings-field label{font-size:.72rem;font-weight:900;text-transform:uppercase;color:#8aa6c2;letter-spacing:.4px}
      .cff-standings-field input,.cff-standings-field textarea{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#07101b;color:#fff;padding:11px 12px;font:inherit;outline:none}
      .cff-standings-field textarea{min-height:260px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.78rem;line-height:1.45}
      .cff-standings-field input:focus,.cff-standings-field textarea:focus{border-color:#00c8ff;box-shadow:0 0 0 3px rgba(0,200,255,.08)}
      .cff-standings-toolbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:10px 0 14px}
      .cff-standings-status{font-size:.76rem;color:#85a1bd}.cff-standings-status.is-ok{color:#79e7aa}.cff-standings-status.is-warn{color:#ffd37b}.cff-standings-status.is-error{color:#ff98a5}
      .cff-standings-team-wrap{border:1px solid rgba(255,255,255,.09);border-radius:13px;overflow:hidden;background:#07101a}
      .cff-standings-team-head,.cff-standings-team-row{display:grid;grid-template-columns:54px minmax(110px,.65fr) minmax(160px,1.35fr) 80px 70px;gap:8px;align-items:center;padding:9px 12px}
      .cff-standings-team-head{background:#101a28;color:#7895b2;font-size:.67rem;font-weight:950;text-transform:uppercase;letter-spacing:.4px}
      .cff-standings-team-row{border-top:1px solid rgba(255,255,255,.06)}
      .cff-standings-rank{font-weight:1000;color:#7f9bb7}.cff-standings-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:#81dfff;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .cff-standings-team-name{min-width:0;border:1px solid rgba(255,255,255,.11);border-radius:8px;background:#0c1623;color:#fff;padding:8px 9px;font:inherit;font-size:.82rem;font-weight:850}
      .cff-standings-points{font-weight:1000;color:#fff;text-align:right}.cff-standings-kills{font-weight:900;color:#8ba6c1;text-align:right}
      .cff-standings-empty{padding:28px;text-align:center;color:#738da8;font-size:.8rem}
      .cff-standings-actions{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:16px}
      .cff-standings-actions-right{display:flex;gap:8px;flex-wrap:wrap}
      .admin-btn[data-standings-live].is-enabled{border-color:rgba(126,226,168,.45);color:#8ff0b8;background:rgba(126,226,168,.08)}
      @media(max-width:760px){.cff-standings-modal{padding:0}.cff-standings-dialog{max-height:100vh;height:100vh;border-radius:0}.cff-standings-fields{grid-template-columns:1fr}.cff-standings-team-head{display:none}.cff-standings-team-row{grid-template-columns:34px 82px minmax(0,1fr) 55px}.cff-standings-kills{display:none}.cff-standings-body{padding:16px}.cff-standings-head{padding:16px}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    let modal = document.getElementById('cff-live-standings-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'cff-live-standings-modal';
    modal.className = 'cff-standings-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <section class="cff-standings-dialog" role="dialog" aria-modal="true" aria-labelledby="cff-standings-title">
        <header class="cff-standings-head">
          <div><p>TABELA DA TRANSMISSÃO</p><h2 id="cff-standings-title">Classificação ao vivo</h2><p id="cff-standings-live-name"></p></div>
          <button class="cff-standings-close" id="cff-standings-close" type="button" aria-label="Fechar">×</button>
        </header>
        <div class="cff-standings-body">
          <label class="cff-standings-toggle"><input id="cff-standings-enabled" type="checkbox"> Exibir esta tabela na home enquanto a transmissão estiver ao vivo</label>
          <div class="cff-standings-fields">
            <div class="cff-standings-field"><label for="cff-standings-label">Título da tabela</label><input id="cff-standings-label" maxlength="100" placeholder="Ex.: Grand Finals"></div>
            <div class="cff-standings-field"><label>Formato</label><input value="2 colunas • 6 times por coluna" readonly></div>
          </div>
          <div class="cff-standings-field">
            <label for="cff-standings-code">Código da Liquipedia</label>
            <textarea id="cff-standings-code" spellcheck="false" placeholder="Cole aqui o bloco com p_kill, p1...p12, opponent1...opponent12 e MS..."></textarea>
          </div>
          <div class="cff-standings-toolbar">
            <button class="admin-btn admin-btn-ghost" id="cff-standings-parse" type="button">Ler código</button>
            <span class="cff-standings-status" id="cff-standings-status">Cole o código da Liquipedia para detectar os times e calcular a classificação.</span>
          </div>
          <div class="cff-standings-team-wrap" id="cff-standings-team-wrap">
            <div class="cff-standings-empty">Nenhum time detectado ainda.</div>
          </div>
          <div class="cff-standings-actions">
            <button class="admin-btn admin-btn-danger" id="cff-standings-remove" type="button">Remover tabela</button>
            <div class="cff-standings-actions-right"><button class="admin-btn admin-btn-ghost" id="cff-standings-cancel" type="button">Cancelar</button><button class="admin-btn admin-btn-primary" id="cff-standings-save" type="button">Salvar tabela</button></div>
          </div>
        </div>
      </section>`;
    document.body.appendChild(modal);

    $('#cff-standings-close', modal).addEventListener('click', closeModal);
    $('#cff-standings-cancel', modal).addEventListener('click', closeModal);
    $('#cff-standings-parse', modal).addEventListener('click', () => parseFromEditor(true));
    $('#cff-standings-save', modal).addEventListener('click', saveStandings);
    $('#cff-standings-remove', modal).addEventListener('click', removeStandings);
    $('#cff-standings-code', modal).addEventListener('paste', () => setTimeout(() => parseFromEditor(false), 0));
    $('#cff-standings-code', modal).addEventListener('input', debounce(() => parseFromEditor(false), 350));
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });
    return modal;
  }

  function debounce(fn, wait) {
    let timer = 0;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
  }

  function parseLiquipedia(raw) {
    const source = String(raw || '');
    if (!source.trim()) return { ok: false, error: 'Cole o código da Liquipedia.' };

    const pKillMatch = source.match(/\|\s*p_kill\s*=\s*(-?\d+(?:[.,]\d+)?)/i);
    const pKill = num(pKillMatch?.[1], 1);
    const placementPoints = {};
    for (let pos = 1; pos <= 12; pos++) {
      const match = source.match(new RegExp(`\\|\\s*p${pos}\\s*=\\s*(-?\\d+(?:[.,]\\d+)?)`, 'i'));
      placementPoints[pos] = num(match?.[1], 0);
    }

    const mapIndexes = [...source.matchAll(/\|\s*map(\d+)\s*=/gi)].map((m) => Number(m[1])).filter(Number.isFinite);
    const totalMaps = mapIndexes.length ? Math.max(...mapIndexes) : 0;
    const titleMatch = source.match(/\{\{\s*StandingsResultsToggle\s*\|\s*title\s*=\s*([^|}\r\n]+)/i);
    const suggestedTitle = safeName(titleMatch?.[1], 'Tabela ao vivo');

    const starts = [];
    const opponentRegex = /\|\s*opponent(\d+)\s*=\s*\{\{\s*TeamOpponent\s*\|\s*([^|}\r\n]+?)(?=\s*(?:\||\r?\n|}}))/gi;
    let match;
    while ((match = opponentRegex.exec(source))) {
      starts.push({ opponent: Number(match[1]), code: String(match[2] || '').trim(), index: match.index });
    }
    if (!starts.length) return { ok: false, error: 'Não encontrei opponent1, opponent2... no código.' };

    let completedMaps = 0;
    const teams = starts.slice(0, 12).map((item, idx) => {
      const end = starts[idx + 1]?.index ?? source.length;
      const segment = source.slice(item.index, end);
      const scoreRegex = /\|\s*m(\d+)\s*=\s*\{\{\s*MS\s*\|\s*([^|}]*)\|\s*([^}]*)}}/gi;
      let scoreMatch;
      let points = 0;
      let kills = 0;
      let mapsPlayed = 0;
      const maps = [];
      while ((scoreMatch = scoreRegex.exec(segment))) {
        const map = Number(scoreMatch[1]);
        const positionRaw = String(scoreMatch[2] ?? '').trim();
        const killRaw = String(scoreMatch[3] ?? '').trim();
        const position = Number(positionRaw);
        const mapKills = Number(killRaw.replace(',', '.'));
        if (!Number.isInteger(position) || position < 1 || position > 12 || !Number.isFinite(mapKills)) continue;
        const placement = num(placementPoints[position], 0);
        const mapPoints = placement + mapKills * pKill;
        points += mapPoints;
        kills += mapKills;
        mapsPlayed += 1;
        if (Number.isFinite(map)) completedMaps = Math.max(completedMaps, map);
        maps.push({ map, position, kills: mapKills, points: mapPoints });
      }
      return {
        opponent: item.opponent,
        code: item.code,
        normCode: normalizeCode(item.code),
        points,
        kills,
        mapsPlayed,
        maps,
      };
    }).filter((team) => team.code);

    teams.sort((a, b) => (b.points - a.points) || (b.kills - a.kills) || (a.opponent - b.opponent));
    teams.forEach((team, index) => { team.rank = index + 1; });

    return {
      ok: true,
      pKill,
      placementPoints,
      completedMaps,
      totalMaps,
      suggestedTitle,
      teams,
    };
  }

  function rememberNames() {
    $$('.cff-standings-team-name', ensureModal()).forEach((input) => {
      const code = normalizeCode(input.dataset.code);
      if (code) currentNames.set(code, safeName(input.value));
    });
  }

  function parseFromEditor(explicit) {
    rememberNames();
    const modal = ensureModal();
    const result = parseLiquipedia($('#cff-standings-code', modal).value);
    if (!result.ok) {
      parsed = null;
      renderTeams();
      setStatus(result.error, explicit ? 'error' : 'warn');
      return;
    }
    parsed = result;
    const titleInput = $('#cff-standings-label', modal);
    if (!titleInput.value.trim() || titleInput.dataset.auto === '1') {
      titleInput.value = result.suggestedTitle || 'Tabela ao vivo';
      titleInput.dataset.auto = '1';
    }
    renderTeams();
    const mapsText = result.totalMaps ? `${result.completedMaps}/${result.totalMaps} quedas` : `${result.completedMaps} quedas`;
    const teamText = `${result.teams.length} time${result.teams.length === 1 ? '' : 's'}`;
    setStatus(`${teamText} detectados • ${mapsText} • ${result.pKill} pt por abate`, result.teams.length === 12 ? 'ok' : 'warn');
  }

  function setStatus(text, kind = '') {
    const status = $('#cff-standings-status', ensureModal());
    status.textContent = text;
    status.className = `cff-standings-status${kind ? ` is-${kind}` : ''}`;
  }

  function renderTeams() {
    const wrap = $('#cff-standings-team-wrap', ensureModal());
    if (!parsed?.teams?.length) {
      wrap.innerHTML = '<div class="cff-standings-empty">Nenhum time detectado ainda.</div>';
      return;
    }
    wrap.replaceChildren();
    const head = document.createElement('div');
    head.className = 'cff-standings-team-head';
    head.innerHTML = '<span>#</span><span>Código</span><span>Nome exibido</span><span style="text-align:right">PTS</span><span style="text-align:right">AB</span>';
    wrap.appendChild(head);

    parsed.teams.slice(0, 12).forEach((team) => {
      const row = document.createElement('div');
      row.className = 'cff-standings-team-row';
      const rank = document.createElement('span');
      rank.className = 'cff-standings-rank';
      rank.textContent = `${team.rank}º`;
      const code = document.createElement('span');
      code.className = 'cff-standings-code';
      code.title = team.code;
      code.textContent = team.code;
      const name = document.createElement('input');
      name.className = 'cff-standings-team-name';
      name.dataset.code = team.code;
      name.maxLength = 80;
      name.value = currentNames.get(team.normCode) || team.code.toUpperCase();
      name.placeholder = team.code.toUpperCase();
      name.addEventListener('input', () => currentNames.set(team.normCode, safeName(name.value)));
      const points = document.createElement('span');
      points.className = 'cff-standings-points';
      points.textContent = String(team.points);
      const kills = document.createElement('span');
      kills.className = 'cff-standings-kills';
      kills.textContent = String(team.kills);
      row.append(rank, code, name, points, kills);
      wrap.appendChild(row);
    });
  }

  function closeModal() {
    const modal = ensureModal();
    modal.hidden = true;
    document.body.style.removeProperty('overflow');
    currentLiveId = '';
    currentLive = null;
    parsed = null;
    currentNames = new Map();
  }

  async function openModal(id) {
    const modal = ensureModal();
    currentLiveId = String(id || '');
    if (!currentLiveId) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setStatus('Carregando configuração...', '');
    $('#cff-standings-team-wrap', modal).innerHTML = '<div class="cff-standings-empty">Carregando...</div>';
    try {
      const snapshot = await get(ref(database, `adminLives/${currentLiveId}`));
      currentLive = snapshot.val();
      if (!currentLive) throw new Error('Transmissão não encontrada.');
      const standings = currentLive.standings || {};
      $('#cff-standings-live-name', modal).textContent = [currentLive.torneio, currentLive.faseDia].filter(Boolean).join(' • ');
      $('#cff-standings-enabled', modal).checked = Boolean(standings.enabled);
      $('#cff-standings-code', modal).value = String(standings.rawCode || '');
      const titleInput = $('#cff-standings-label', modal);
      titleInput.value = String(standings.title || '');
      titleInput.dataset.auto = titleInput.value ? '0' : '1';
      titleInput.oninput = () => { titleInput.dataset.auto = '0'; };
      currentNames = new Map((Array.isArray(standings.teams) ? standings.teams : Object.values(standings.teams || {})).map((team) => [normalizeCode(team?.code), safeName(team?.name)]).filter(([code]) => code));
      if (standings.rawCode) parseFromEditor(false);
      else {
        parsed = null;
        renderTeams();
        setStatus('Cole o código da Liquipedia para detectar os 12 times.', '');
      }
    } catch (error) {
      console.error('[Tabela da live]', error);
      setStatus(error?.message || 'Não foi possível carregar a transmissão.', 'error');
    }
  }

  async function saveStandings() {
    const modal = ensureModal();
    if (!currentLiveId) return;
    parseFromEditor(true);
    const enabled = $('#cff-standings-enabled', modal).checked;
    if (enabled && (!parsed?.teams?.length || parsed.teams.length < 2)) {
      setStatus('Para exibir a tabela, cole um código válido da Liquipedia.', 'error');
      return;
    }
    if (!parsed?.teams?.length) {
      setStatus('Nenhum time foi detectado no código.', 'error');
      return;
    }
    rememberNames();
    const teams = parsed.teams.slice(0, 12).map((team, index) => ({
      code: team.code,
      name: safeName(currentNames.get(team.normCode), team.code.toUpperCase()),
      points: team.points,
      kills: team.kills,
      maps: team.mapsPlayed,
      rank: index + 1,
    }));
    const payload = {
      enabled,
      source: 'liquipedia-wikitext',
      title: safeName($('#cff-standings-label', modal).value, 'Tabela ao vivo'),
      rawCode: $('#cff-standings-code', modal).value,
      pKill: parsed.pKill,
      placementPoints: parsed.placementPoints,
      completedMaps: parsed.completedMaps,
      totalMaps: parsed.totalMaps,
      teams,
      updatedAt: Date.now(),
    };
    const saveButton = $('#cff-standings-save', modal);
    saveButton.disabled = true;
    saveButton.textContent = 'Salvando...';
    try {
      await update(ref(database, `adminLives/${currentLiveId}`), { standings: payload });
      liveStates.set(currentLiveId, { enabled, configured: true });
      decorateButtons();
      setStatus(enabled ? 'Tabela salva e ativada na home.' : 'Tabela salva, mas está desativada.', 'ok');
      setTimeout(closeModal, 650);
    } catch (error) {
      console.error('[Tabela da live] Falha ao salvar', error);
      setStatus('Não foi possível salvar a tabela. Confira sua sessão administrativa.', 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Salvar tabela';
    }
  }

  async function removeStandings() {
    if (!currentLiveId) return;
    if (!confirm('Remover a tabela desta transmissão? A live continuará cadastrada normalmente.')) return;
    const button = $('#cff-standings-remove', ensureModal());
    button.disabled = true;
    try {
      await update(ref(database, `adminLives/${currentLiveId}`), { standings: null });
      liveStates.set(currentLiveId, { enabled: false, configured: false });
      decorateButtons();
      closeModal();
    } catch (error) {
      console.error('[Tabela da live] Falha ao remover', error);
      setStatus('Não foi possível remover a tabela.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function refreshStates() {
    try {
      const snapshot = await get(ref(database, 'adminLives'));
      const data = snapshot.val() || {};
      liveStates = new Map(Object.entries(data).map(([id, live]) => [String(id), {
        enabled: Boolean(live?.standings?.enabled),
        configured: Boolean(live?.standings?.rawCode || live?.standings?.teams),
      }]));
    } catch (_) {}
    decorateButtons();
  }

  function decorateButtons() {
    $$('[data-edit-live]', liveList).forEach((editButton) => {
      const id = String(editButton.dataset.editLive || '');
      if (!id) return;
      let tableButton = editButton.parentElement?.querySelector(`[data-standings-live="${CSS.escape(id)}"]`);
      if (!tableButton) {
        tableButton = document.createElement('button');
        tableButton.className = 'admin-btn admin-btn-ghost';
        tableButton.type = 'button';
        tableButton.dataset.standingsLive = id;
        editButton.insertAdjacentElement('afterend', tableButton);
      }
      const state = liveStates.get(id);
      tableButton.textContent = state?.enabled ? 'Tabela ✓' : (state?.configured ? 'Tabela •' : 'Tabela');
      tableButton.classList.toggle('is-enabled', Boolean(state?.enabled));
      tableButton.title = state?.enabled ? 'Tabela ativa na home' : (state?.configured ? 'Tabela configurada, mas desativada' : 'Configurar tabela pela Liquipedia');
    });
  }

  injectStyles();
  ensureModal();
  liveList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-standings-live]');
    if (!button) return;
    event.preventDefault();
    openModal(button.dataset.standingsLive);
  });
  const observer = new MutationObserver(decorateButtons);
  observer.observe(liveList, { childList: true, subtree: true });
  decorateButtons();
  refreshStates();
}
