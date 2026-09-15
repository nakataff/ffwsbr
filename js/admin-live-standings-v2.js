import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getDatabase, ref, get, update } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';

const config = window.CFF_CONFIG && window.CFF_CONFIG.firebase;
if (!config) throw new Error('Configuração do Firebase não encontrada.');

const app = getApps().length ? getApp() : initializeApp(config);
const database = getDatabase(app);
const liveList = document.querySelector('#admin-live-list');

if (liveList) {
  let states = new Map();
  let currentId = '';
  let parsed = null;
  let names = new Map();

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clean = (v, fallback = '') => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, 100) || fallback;
  const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const toNum = (v, fallback = 0) => {
    const n = Number(String(v ?? '').trim().replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  };

  function injectCss() {
    if ($('#cff-live-standings-admin-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-live-standings-admin-css';
    style.textContent = `
      .cff-standings-modal[hidden]{display:none!important}.cff-standings-modal{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:18px;background:rgba(2,7,14,.82);backdrop-filter:blur(7px)}
      .cff-standings-dialog{width:min(1050px,100%);max-height:94vh;overflow:auto;background:#09111d;color:#edf7ff;border:1px solid rgba(0,200,255,.23);border-radius:18px;box-shadow:0 28px 80px rgba(0,0,0,.5)}
      .cff-standings-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:14px;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(9,17,29,.97)}
      .cff-standings-head p{margin:0;color:#7896b5;font-size:.72rem;font-weight:900}.cff-standings-head h2{margin:3px 0;font-size:1.35rem}.cff-standings-close{width:38px;height:38px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:#111c2b;color:#fff;cursor:pointer}
      .cff-standings-body{padding:18px 20px 22px}.cff-standings-toggle{display:flex;align-items:center;gap:9px;padding:11px 13px;margin-bottom:12px;border-radius:10px;border:1px solid rgba(0,200,255,.18);background:rgba(0,200,255,.055);font-weight:850}.cff-standings-toggle input{width:18px;height:18px}
      .cff-standings-fields{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:12px;margin-bottom:12px}.cff-standings-field{display:grid;gap:6px}.cff-standings-field label{font-size:.71rem;color:#86a1bc;font-weight:900;text-transform:uppercase}.cff-standings-field input,.cff-standings-field textarea{box-sizing:border-box;width:100%;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#07101a;color:#fff;padding:11px 12px;font:inherit}.cff-standings-field textarea{min-height:255px;resize:vertical;font-family:Consolas,monospace;font-size:.78rem;line-height:1.4}
      .cff-standings-toolbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:10px 0 14px}.cff-standings-status{font-size:.76rem;color:#829db8}.cff-standings-status.ok{color:#7de5aa}.cff-standings-status.warn{color:#ffd27a}.cff-standings-status.error{color:#ff8f9c}
      .cff-standings-team-wrap{border:1px solid rgba(255,255,255,.09);border-radius:12px;overflow:hidden;background:#07101a}.cff-standings-team-head,.cff-standings-team-row{display:grid;grid-template-columns:50px minmax(100px,.65fr) minmax(160px,1.35fr) 72px 62px;gap:8px;align-items:center;padding:9px 11px}.cff-standings-team-head{background:#101a28;color:#7894b0;font-size:.66rem;font-weight:950;text-transform:uppercase}.cff-standings-team-row{border-top:1px solid rgba(255,255,255,.06)}
      .cff-rank{font-weight:950;color:#839db7}.cff-code{font-family:Consolas,monospace;color:#75ddff;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cff-name{min-width:0;border:1px solid rgba(255,255,255,.11);border-radius:8px;background:#0c1623;color:#fff;padding:8px 9px;font:inherit;font-size:.82rem;font-weight:850}.cff-points,.cff-kills{text-align:right;font-weight:950}.cff-kills{color:#87a0b8}.cff-empty{padding:24px;text-align:center;color:#7892ac;font-size:.8rem}
      .cff-standings-actions{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:15px}.cff-standings-actions-right{display:flex;gap:8px;flex-wrap:wrap}.admin-btn[data-standings-live].is-enabled{border-color:rgba(126,226,168,.45);color:#8ff0b8;background:rgba(126,226,168,.08)}
      @media(max-width:760px){.cff-standings-modal{padding:0}.cff-standings-dialog{height:100vh;max-height:100vh;border-radius:0}.cff-standings-fields{grid-template-columns:1fr}.cff-standings-team-head{display:none}.cff-standings-team-row{grid-template-columns:34px 78px minmax(0,1fr) 55px}.cff-kills{display:none}.cff-standings-body{padding:15px}}
    `;
    document.head.appendChild(style);
  }

  function modal() {
    let box = $('#cff-live-standings-modal');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'cff-live-standings-modal';
    box.className = 'cff-standings-modal';
    box.hidden = true;
    box.innerHTML = `
      <section class="cff-standings-dialog" role="dialog" aria-modal="true">
        <header class="cff-standings-head"><div><p>TABELA DA TRANSMISSÃO</p><h2>Classificação ao vivo</h2><p id="cff-standings-live-name"></p></div><button id="cff-standings-close" class="cff-standings-close" type="button">×</button></header>
        <div class="cff-standings-body">
          <label class="cff-standings-toggle"><input id="cff-standings-enabled" type="checkbox"> Exibir esta tabela na home enquanto a transmissão estiver ao vivo</label>
          <div class="cff-standings-fields"><div class="cff-standings-field"><label for="cff-standings-label">Título da tabela</label><input id="cff-standings-label" maxlength="100" placeholder="Ex.: Grand Finals"></div><div class="cff-standings-field"><label>Formato</label><input value="2 colunas • 6 times por coluna" readonly></div></div>
          <div class="cff-standings-field"><label for="cff-standings-code">Código da Liquipedia</label><textarea id="cff-standings-code" spellcheck="false" placeholder="Cole aqui o bloco StandingsResultsToggle / Bracket"></textarea></div>
          <div class="cff-standings-toolbar"><button id="cff-standings-parse" class="admin-btn admin-btn-ghost" type="button">Ler código</button><span id="cff-standings-status" class="cff-standings-status">Cole o código para detectar times, quedas e pontuação.</span></div>
          <div id="cff-standings-team-wrap" class="cff-standings-team-wrap"><div class="cff-empty">Nenhum time detectado ainda.</div></div>
          <div class="cff-standings-actions"><button id="cff-standings-remove" class="admin-btn admin-btn-danger" type="button">Remover tabela</button><div class="cff-standings-actions-right"><button id="cff-standings-cancel" class="admin-btn admin-btn-ghost" type="button">Cancelar</button><button id="cff-standings-save" class="admin-btn admin-btn-primary" type="button">Salvar tabela</button></div></div>
        </div>
      </section>`;
    document.body.appendChild(box);
    $('#cff-standings-close', box).onclick = close;
    $('#cff-standings-cancel', box).onclick = close;
    $('#cff-standings-parse', box).onclick = () => parseEditor(true);
    $('#cff-standings-save', box).onclick = save;
    $('#cff-standings-remove', box).onclick = removeTable;
    let timer = 0;
    $('#cff-standings-code', box).addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => parseEditor(false), 300); });
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    return box;
  }

  function parseLiquipedia(raw) {
    const source = String(raw || '');
    if (!source.trim()) return { ok:false, error:'Cole o código da Liquipedia.' };

    const killMatch = source.match(/\|\s*p_kill\s*=\s*(-?\d+(?:[.,]\d+)?)/i);
    const pKill = toNum(killMatch?.[1], 1);
    const placement = {};
    for (let pos = 1; pos <= 12; pos++) {
      const m = source.match(new RegExp(`\\|\\s*p${pos}\\s*=\\s*(-?\\d+(?:[.,]\\d+)?)`, 'i'));
      placement[pos] = toNum(m?.[1], 0);
    }

    const mapIds = [...source.matchAll(/\|\s*map(\d+)\s*=/gi)].map(m => Number(m[1])).filter(Number.isFinite);
    const totalMaps = mapIds.length ? Math.max(...mapIds) : 0;
    const titleMatch = source.match(/\{\{\s*StandingsResultsToggle\s*\|\s*title\s*=\s*([^|}]+)/i);
    const suggestedTitle = clean(titleMatch?.[1], 'Tabela ao vivo');

    const starts = [];
    const opponentRx = /\|\s*opponent(\d+)\s*=\s*\{\{\s*TeamOpponent\s*\|\s*([^|}]+)/gi;
    let m;
    while ((m = opponentRx.exec(source))) {
      starts.push({ opponent:Number(m[1]), code:clean(m[2]), index:m.index });
    }
    if (!starts.length) return { ok:false, error:'Não encontrei opponent1, opponent2... no código.' };

    let completedMaps = 0;
    const teams = starts.slice(0,12).map((item, index) => {
      const end = starts[index + 1]?.index ?? source.length;
      const segment = source.slice(item.index, end);
      const scoreRx = /\|\s*m(\d+)\s*=\s*\{\{\s*MS\s*\|\s*([^|}]*)\|\s*([^}]*)}}/gi;
      let score;
      let points = 0, kills = 0, mapsPlayed = 0;
      while ((score = scoreRx.exec(segment))) {
        const map = Number(score[1]);
        const pos = Number(String(score[2] ?? '').trim());
        const ab = Number(String(score[3] ?? '').trim().replace(',', '.'));
        if (!Number.isInteger(pos) || pos < 1 || pos > 12 || !Number.isFinite(ab)) continue;
        points += toNum(placement[pos]) + ab * pKill;
        kills += ab;
        mapsPlayed += 1;
        if (Number.isFinite(map)) completedMaps = Math.max(completedMaps, map);
      }
      return { opponent:item.opponent, code:item.code, key:norm(item.code), points, kills, mapsPlayed };
    }).filter(t => t.code);

    teams.sort((a,b) => (b.points-a.points) || (b.kills-a.kills) || (a.opponent-b.opponent));
    teams.forEach((t,i) => t.rank = i + 1);
    return { ok:true, pKill, placement, completedMaps, totalMaps, suggestedTitle, teams };
  }

  function setStatus(text, kind='') {
    const el = $('#cff-standings-status', modal());
    el.textContent = text;
    el.className = `cff-standings-status${kind ? ` ${kind}` : ''}`;
  }

  function rememberNames() {
    $$('.cff-name', modal()).forEach(input => {
      const key = norm(input.dataset.code);
      if (key) names.set(key, clean(input.value));
    });
  }

  function parseEditor(explicit=false) {
    rememberNames();
    const box = modal();
    const result = parseLiquipedia($('#cff-standings-code', box).value);
    if (!result.ok) {
      parsed = null;
      renderTeams();
      setStatus(result.error, explicit ? 'error' : 'warn');
      return;
    }
    parsed = result;
    const title = $('#cff-standings-label', box);
    if (!title.value.trim() || title.dataset.auto === '1') {
      title.value = result.suggestedTitle;
      title.dataset.auto = '1';
    }
    renderTeams();
    const maps = result.totalMaps ? `${result.completedMaps}/${result.totalMaps} quedas` : `${result.completedMaps} quedas`;
    setStatus(`${result.teams.length} times detectados • ${maps} • ${result.pKill} pt por abate`, result.teams.length === 12 ? 'ok' : 'warn');
  }

  function renderTeams() {
    const wrap = $('#cff-standings-team-wrap', modal());
    if (!parsed?.teams?.length) { wrap.innerHTML = '<div class="cff-empty">Nenhum time detectado ainda.</div>'; return; }
    wrap.replaceChildren();
    const head = document.createElement('div');
    head.className = 'cff-standings-team-head';
    head.innerHTML = '<span>#</span><span>Código</span><span>Nome exibido</span><span style="text-align:right">PTS</span><span style="text-align:right">AB</span>';
    wrap.appendChild(head);
    parsed.teams.forEach(team => {
      const row = document.createElement('div'); row.className = 'cff-standings-team-row';
      const rank = document.createElement('span'); rank.className = 'cff-rank'; rank.textContent = `${team.rank}º`;
      const code = document.createElement('span'); code.className = 'cff-code'; code.textContent = team.code; code.title = team.code;
      const name = document.createElement('input'); name.className = 'cff-name'; name.dataset.code = team.code; name.maxLength = 80; name.value = names.get(team.key) || team.code.toUpperCase();
      name.addEventListener('input', () => names.set(team.key, clean(name.value)));
      const pts = document.createElement('span'); pts.className = 'cff-points'; pts.textContent = String(team.points);
      const kills = document.createElement('span'); kills.className = 'cff-kills'; kills.textContent = String(team.kills);
      row.append(rank, code, name, pts, kills); wrap.appendChild(row);
    });
  }

  function close() {
    const box = modal();
    box.hidden = true;
    document.body.style.removeProperty('overflow');
    currentId = ''; parsed = null; names = new Map();
  }

  async function open(id) {
    const box = modal();
    currentId = String(id || '');
    if (!currentId) return;
    box.hidden = false; document.body.style.overflow = 'hidden';
    setStatus('Carregando configuração...');
    try {
      const snap = await get(ref(database, `adminLives/${currentId}`));
      const live = snap.val();
      if (!live) throw new Error('Transmissão não encontrada.');
      const st = live.standings || {};
      $('#cff-standings-live-name', box).textContent = [live.torneio, live.faseDia].filter(Boolean).join(' • ');
      $('#cff-standings-enabled', box).checked = Boolean(st.enabled);
      $('#cff-standings-code', box).value = String(st.rawCode || '');
      const title = $('#cff-standings-label', box); title.value = String(st.title || ''); title.dataset.auto = title.value ? '0' : '1'; title.oninput = () => title.dataset.auto = '0';
      const savedTeams = Array.isArray(st.teams) ? st.teams : Object.values(st.teams || {});
      names = new Map(savedTeams.map(t => [norm(t?.code), clean(t?.name)]).filter(([k]) => k));
      if (st.rawCode) parseEditor(false); else { parsed = null; renderTeams(); setStatus('Cole o código da Liquipedia para detectar os 12 times.'); }
    } catch (error) {
      console.error('[Tabela da live]', error); setStatus(error?.message || 'Não foi possível carregar.', 'error');
    }
  }

  async function save() {
    if (!currentId) return;
    parseEditor(true);
    if (!parsed?.teams?.length) return;
    rememberNames();
    const box = modal();
    const payload = {
      enabled: $('#cff-standings-enabled', box).checked,
      source: 'liquipedia-wikitext',
      title: clean($('#cff-standings-label', box).value, 'Tabela ao vivo'),
      rawCode: $('#cff-standings-code', box).value,
      pKill: parsed.pKill,
      placementPoints: parsed.placement,
      completedMaps: parsed.completedMaps,
      totalMaps: parsed.totalMaps,
      teams: parsed.teams.slice(0,12).map(t => ({ code:t.code, name:clean(names.get(t.key), t.code.toUpperCase()), points:t.points, kills:t.kills, maps:t.mapsPlayed, rank:t.rank })),
      updatedAt: Date.now()
    };
    const button = $('#cff-standings-save', box); button.disabled = true; button.textContent = 'Salvando...';
    try {
      await update(ref(database, `adminLives/${currentId}`), { standings: payload });
      states.set(currentId, { configured:true, enabled:payload.enabled }); decorate(); setStatus(payload.enabled ? 'Tabela salva e ativada.' : 'Tabela salva, mas desativada.', 'ok'); setTimeout(close, 500);
    } catch (error) {
      console.error(error); setStatus('Não foi possível salvar. Confira sua sessão administrativa.', 'error');
    } finally { button.disabled = false; button.textContent = 'Salvar tabela'; }
  }

  async function removeTable() {
    if (!currentId || !confirm('Remover a tabela desta transmissão?')) return;
    try { await update(ref(database, `adminLives/${currentId}`), { standings:null }); states.set(currentId,{configured:false,enabled:false}); decorate(); close(); }
    catch (error) { console.error(error); setStatus('Não foi possível remover a tabela.', 'error'); }
  }

  async function refreshStates() {
    try {
      const snap = await get(ref(database, 'adminLives')); const data = snap.val() || {};
      states = new Map(Object.entries(data).map(([id, live]) => [String(id), { configured:Boolean(live?.standings?.rawCode || live?.standings?.teams), enabled:Boolean(live?.standings?.enabled) }]));
    } catch (_) {}
    decorate();
  }

  function decorate() {
    $$('[data-edit-live]', liveList).forEach(edit => {
      const id = String(edit.dataset.editLive || ''); if (!id) return;
      let button = edit.parentElement?.querySelector('[data-standings-live]');
      if (button && button.dataset.standingsLive !== id) button = null;
      if (!button) { button = document.createElement('button'); button.type = 'button'; button.className = 'admin-btn admin-btn-ghost'; button.dataset.standingsLive = id; edit.insertAdjacentElement('afterend', button); }
      const st = states.get(id); button.textContent = st?.enabled ? 'Tabela ✓' : (st?.configured ? 'Tabela •' : 'Tabela'); button.classList.toggle('is-enabled', Boolean(st?.enabled));
    });
  }

  injectCss(); modal();
  liveList.addEventListener('click', e => { const button = e.target.closest('[data-standings-live]'); if (!button) return; e.preventDefault(); open(button.dataset.standingsLive); });
  new MutationObserver(decorate).observe(liveList, { childList:true, subtree:true });
  decorate(); refreshStates();
}
