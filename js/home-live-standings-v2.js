(() => {
  'use strict';

  const base = String(window.CFF_CONFIG?.firebase?.databaseURL || '').replace(/\/$/, '');
  if (!base) return;

  let lives = [];
  let loading = false;
  let currentDetailsLive = null;

  function parseBRT(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      const [, year, month, day, hour, minute, second = '00'] = match;
      const date = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${minute}:${second}-03:00`);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isLiveNow(live, now) {
    const start = parseBRT(live?.inicio || live?.data_hora);
    const minutes = Math.max(0, Number(live?.duracaoMinutos || 0));
    if (!start || !minutes) return false;
    const end = new Date(start.getTime() + minutes * 60000);
    return now >= start && now <= end;
  }

  function isTournamentFinished(live) {
    const completed = Math.max(0, Number(live?.standings?.completedMaps || 0));
    const total = Math.max(0, Number(live?.standings?.totalMaps || 0));
    return total > 0 && completed >= total;
  }

  function shouldShow(live, now) {
    if (!live?.standings?.enabled) return false;
    if (isLiveNow(live, now)) return true;
    if (!live?.standingsKeepVisible) return false;
    return !isTournamentFinished(live);
  }

  function injectStyles() {
    if (document.getElementById('cff-live-standings-css-v2')) return;
    const style = document.createElement('style');
    style.id = 'cff-live-standings-css-v2';
    style.textContent = `
      #cff-live-standings{margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)}
      .cff-live-standings-head{display:flex;justify-content:space-between;align-items:flex-end;gap:8px;margin-bottom:8px}.cff-live-standings-title{min-width:0}.cff-live-standings-kicker{display:block;color:#00c8ff;font-size:.58rem;font-weight:1000;letter-spacing:.8px;text-transform:uppercase}.cff-live-standings-title strong{display:block;margin-top:2px;color:#fff;font-size:.76rem;font-weight:1000;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cff-live-standings-tools{display:flex;align-items:center;gap:6px;flex:0 0 auto}.cff-live-standings-progress{color:#7f9ab7;font-size:.58rem;font-weight:900;text-transform:uppercase;white-space:nowrap}.cff-live-standings-details-btn{border:1px solid rgba(0,200,255,.22);border-radius:7px;background:rgba(0,200,255,.07);color:#9fe8ff;padding:5px 7px;font-size:.52rem;font-weight:1000;text-transform:uppercase;cursor:pointer}
      .cff-live-standings-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7px}.cff-live-standings-col{display:grid;gap:4px;min-width:0}.cff-live-standings-row{display:grid;grid-template-columns:18px minmax(0,1fr) auto;align-items:center;gap:4px;min-width:0;padding:6px;border:1px solid rgba(255,255,255,.065);border-radius:7px;background:rgba(255,255,255,.025);cursor:pointer}.cff-live-standings-row.is-leader{border-color:rgba(0,200,255,.24);background:rgba(0,200,255,.055)}.cff-live-standings-row.is-cp{border-color:rgba(70,167,255,.5);background:rgba(0,132,255,.17);box-shadow:inset 0 0 0 1px rgba(86,178,255,.08)}
      .cff-live-standings-rank{color:#728ba5;font-size:.58rem;font-weight:1000;text-align:center}.cff-live-standings-row.is-cp .cff-live-standings-rank{color:#7ecaff}.cff-live-standings-team{min-width:0;color:#eaf5ff;font-size:.62rem;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cff-live-standings-points{color:#fff;font-size:.64rem;font-weight:1000;text-align:right}.cff-live-standings-points small{font-size:.45rem;color:#66809b;margin-left:1px}.cff-live-standings-row.is-cp .cff-live-standings-points{color:#8fd4ff}
      .cff-details-modal[hidden]{display:none!important}.cff-details-modal{position:fixed;inset:0;z-index:999999;display:grid;place-items:center;padding:18px;background:rgba(2,7,14,.84);backdrop-filter:blur(7px)}.cff-details-dialog{width:min(860px,100%);max-height:90vh;overflow:auto;border:1px solid rgba(0,200,255,.22);border-radius:16px;background:#09111d;color:#eef8ff;box-shadow:0 30px 80px rgba(0,0,0,.55)}.cff-details-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:12px;padding:17px 18px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(9,17,29,.98)}.cff-details-head p{margin:0;color:#7b98b5;font-size:.7rem;font-weight:900;text-transform:uppercase}.cff-details-head h3{margin:3px 0 0;font-size:1.18rem}.cff-details-close{width:36px;height:36px;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#111c2b;color:#fff;cursor:pointer}.cff-details-body{padding:17px 18px 20px}.cff-details-select{display:grid;gap:6px;margin-bottom:13px}.cff-details-select label{color:#809bb7;font-size:.68rem;font-weight:900;text-transform:uppercase}.cff-details-select select{width:100%;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#07101a;color:#fff;padding:10px 11px;font:inherit;font-weight:850}.cff-details-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:13px}.cff-details-card{padding:10px 11px;border:1px solid rgba(255,255,255,.075);border-radius:10px;background:#0c1623}.cff-details-card small{display:block;color:#728da8;font-size:.58rem;font-weight:900;text-transform:uppercase}.cff-details-card strong{display:block;margin-top:3px;font-size:1rem}.cff-details-card.is-cp{border-color:rgba(70,167,255,.4);background:rgba(0,132,255,.12)}.cff-details-table-wrap{overflow:auto;border:1px solid rgba(255,255,255,.08);border-radius:11px}.cff-details-table{width:100%;border-collapse:collapse;min-width:630px}.cff-details-table th,.cff-details-table td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:right;font-size:.72rem}.cff-details-table th{position:sticky;top:0;background:#101a28;color:#7793af;font-size:.62rem;text-transform:uppercase}.cff-details-table th:first-child,.cff-details-table td:first-child{text-align:left}.cff-details-table tr.is-cp td{background:rgba(0,132,255,.09)}.cff-details-note{margin:10px 0 0;color:#7893ad;font-size:.68rem;line-height:1.45}
      @media(max-width:520px){.cff-live-standings-grid{gap:5px}.cff-live-standings-row{padding:5px 4px;grid-template-columns:16px minmax(0,1fr) auto}.cff-live-standings-team{font-size:.58rem}.cff-live-standings-points{font-size:.6rem}.cff-live-standings-head{align-items:flex-start}.cff-live-standings-tools{flex-direction:column;align-items:flex-end}.cff-details-modal{padding:0}.cff-details-dialog{height:100vh;max-height:100vh;border-radius:0}.cff-details-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.cff-details-body{padding:14px}}
    `;
    document.head.appendChild(style);
  }

  function cleanTeams(standings) {
    const source = Array.isArray(standings?.teams) ? standings.teams : Object.values(standings?.teams || {});
    const matchPoint = Number(standings?.matchPoint || 0);
    return source.map((team, index) => ({
      name:String(team?.name || team?.code || '').trim(),
      code:String(team?.code || '').trim(),
      points:Number(team?.points || 0),
      kills:Number(team?.kills || 0),
      rank:Number(team?.rank || 0),
      maps:Number(team?.maps || 0),
      mapRows:Array.isArray(team?.mapRows) ? team.mapRows : Object.values(team?.mapRows || {}),
      championPointActive:Boolean(team?.championPointActive || (matchPoint > 0 && Number(team?.points || 0) >= matchPoint)),
      championPointReachedAt:Number(team?.championPointReachedAt || 0),
      index
    })).filter(team => team.name).sort((a,b) => {
      const ar = a.rank > 0 ? a.rank : 999;
      const br = b.rank > 0 ? b.rank : 999;
      return (ar-br) || (b.points-a.points) || (b.kills-a.kills) || (a.index-b.index);
    }).slice(0,12).map((team,index) => ({...team, rank:index+1}));
  }

  function makeRow(team, live) {
    const row = document.createElement('div');
    row.className = `cff-live-standings-row${team.rank === 1 ? ' is-leader' : ''}${team.championPointActive ? ' is-cp' : ''}`;
    row.title = team.championPointActive ? 'Champion Point ativo • clique para ver os detalhes' : 'Clique para ver os detalhes';
    const rank = document.createElement('span'); rank.className = 'cff-live-standings-rank'; rank.textContent = `${team.rank}º`;
    const name = document.createElement('span'); name.className = 'cff-live-standings-team'; name.textContent = team.name; name.title = team.name;
    const points = document.createElement('span'); points.className = 'cff-live-standings-points'; points.append(document.createTextNode(String(team.points)));
    const suffix = document.createElement('small'); suffix.textContent = team.championPointActive ? 'CP' : 'PTS'; points.appendChild(suffix);
    row.append(rank, name, points);
    row.addEventListener('click', () => openDetails(live, team.code));
    return row;
  }

  function ensureDetailsModal() {
    let modal = document.getElementById('cff-standings-details-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'cff-standings-details-modal';
    modal.className = 'cff-details-modal';
    modal.hidden = true;
    modal.innerHTML = `<section class="cff-details-dialog" role="dialog" aria-modal="true"><header class="cff-details-head"><div><p>DETALHES DA CLASSIFICAÇÃO</p><h3 id="cff-details-title">Pontuação por queda</h3></div><button class="cff-details-close" id="cff-details-close" type="button">×</button></header><div class="cff-details-body"><div class="cff-details-select"><label for="cff-details-team">Equipe</label><select id="cff-details-team"></select></div><div class="cff-details-summary" id="cff-details-summary"></div><div class="cff-details-table-wrap"><table class="cff-details-table"><thead><tr><th>Queda</th><th>Pos.</th><th>Abates</th><th>P. coloc.</th><th>P. abates</th><th>Total</th><th>Acum.</th></tr></thead><tbody id="cff-details-body"></tbody></table></div><p class="cff-details-note" id="cff-details-note"></p></div></section>`;
    document.body.appendChild(modal);
    document.getElementById('cff-details-close').onclick = closeDetails;
    document.getElementById('cff-details-team').onchange = () => renderDetailsTeam();
    modal.addEventListener('click', e => { if (e.target === modal) closeDetails(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeDetails(); });
    return modal;
  }

  function closeDetails() {
    const modal = ensureDetailsModal();
    modal.hidden = true;
    currentDetailsLive = null;
    document.body.style.removeProperty('overflow');
  }

  function openDetails(live, preferredCode='') {
    currentDetailsLive = live;
    const modal = ensureDetailsModal();
    const teams = cleanTeams(live?.standings || {});
    const select = document.getElementById('cff-details-team');
    select.replaceChildren();
    teams.forEach(team => {
      const option = document.createElement('option');
      option.value = team.code;
      option.textContent = `${team.rank}º • ${team.name} • ${team.points} pts${team.championPointActive ? ' • CP' : ''}`;
      select.appendChild(option);
    });
    if (preferredCode && teams.some(team => team.code === preferredCode)) select.value = preferredCode;
    document.getElementById('cff-details-title').textContent = String(live?.standings?.title || live?.torneio || 'Pontuação por queda');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    renderDetailsTeam();
  }

  function renderDetailsTeam() {
    if (!currentDetailsLive) return;
    const standings = currentDetailsLive.standings || {};
    const teams = cleanTeams(standings);
    const code = document.getElementById('cff-details-team').value;
    const team = teams.find(item => item.code === code) || teams[0];
    if (!team) return;
    const rows = [...team.mapRows].sort((a,b) => Number(a?.map || 0) - Number(b?.map || 0));
    const placementTotal = rows.reduce((sum,row) => sum + Number(row?.placementPoints || 0), 0);
    const killPointTotal = rows.reduce((sum,row) => sum + Number(row?.killPoints || 0), 0);
    const matchPoint = Number(standings?.matchPoint || 0);
    const summary = document.getElementById('cff-details-summary');
    summary.innerHTML = `<div class="cff-details-card"><small>Total</small><strong>${team.points} pts</strong></div><div class="cff-details-card"><small>Abates</small><strong>${team.kills}</strong></div><div class="cff-details-card"><small>Colocação</small><strong>${placementTotal} pts</strong></div><div class="cff-details-card${team.championPointActive ? ' is-cp' : ''}"><small>Champion Point</small><strong>${matchPoint ? (team.championPointActive ? 'ATIVO' : `${team.points}/${matchPoint}`) : '—'}</strong></div>`;
    const tbody = document.getElementById('cff-details-body');
    tbody.replaceChildren();
    if (!rows.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="7" style="text-align:center;color:#7893ad">Detalhes por queda ainda não estão salvos. Abra a tabela no admin e salve novamente.</td>';
      tbody.appendChild(tr);
    } else {
      rows.forEach(row => {
        const tr = document.createElement('tr');
        if (matchPoint > 0 && Number(row?.cumulative || 0) >= matchPoint) tr.className = 'is-cp';
        const values = [
          `#${Number(row?.map || 0)}`,
          `${Number(row?.placement || 0)}º`,
          String(Number(row?.kills || 0)),
          String(Number(row?.placementPoints || 0)),
          String(Number(row?.killPoints || 0)),
          String(Number(row?.points || 0)),
          String(Number(row?.cumulative || 0))
        ];
        values.forEach((value,index) => { const td = document.createElement('td'); td.textContent = value; if (index===0) td.style.textAlign='left'; tr.appendChild(td); });
        tbody.appendChild(tr);
      });
    }
    const note = document.getElementById('cff-details-note');
    if (matchPoint > 0) {
      note.textContent = team.championPointActive
        ? `Champion Point de ${matchPoint} pontos atingido${team.championPointReachedAt ? ` na queda ${team.championPointReachedAt}` : ''}. A coloração azul indica que a equipe já alcançou a linha de Champion Point.`
        : `Champion Point: ${matchPoint} pontos. Faltam ${Math.max(0, matchPoint - team.points)} pontos para esta equipe alcançar a linha.`;
    } else note.textContent = `Pontos de colocação: ${placementTotal} • pontos de abates: ${killPointTotal}.`;
  }

  function render() {
    const body = document.querySelector('.home-rail-live .home-widget-body');
    if (!body) return;
    const now = new Date();
    const eligible = lives.filter(live => shouldShow(live, now)).sort((a,b) => {
      const aLive = isLiveNow(a, now) ? 1 : 0;
      const bLive = isLiveNow(b, now) ? 1 : 0;
      if (aLive !== bLive) return bLive-aLive;
      return Number(b?.standings?.updatedAt || 0) - Number(a?.standings?.updatedAt || 0);
    });
    const live = eligible[0];
    let host = document.getElementById('cff-live-standings');
    if (!live) { host?.remove(); return; }
    const teams = cleanTeams(live.standings);
    if (!teams.length) { host?.remove(); return; }
    if (!host) { host = document.createElement('section'); host.id = 'cff-live-standings'; body.appendChild(host); }
    host.replaceChildren();

    const currentlyLive = isLiveNow(live, now);
    const head = document.createElement('div'); head.className = 'cff-live-standings-head';
    const title = document.createElement('div'); title.className = 'cff-live-standings-title';
    const kicker = document.createElement('span'); kicker.className = 'cff-live-standings-kicker'; kicker.textContent = currentlyLive ? 'TABELA AO VIVO' : 'CLASSIFICAÇÃO DA FINAL';
    const strong = document.createElement('strong'); strong.textContent = String(live.standings?.title || live.torneio || 'Classificação'); strong.title = strong.textContent;
    title.append(kicker,strong);
    const tools = document.createElement('div'); tools.className = 'cff-live-standings-tools';
    const progress = document.createElement('span'); progress.className = 'cff-live-standings-progress';
    const completed = Math.max(0, Number(live.standings?.completedMaps || 0));
    const total = Math.max(0, Number(live.standings?.totalMaps || 0));
    progress.textContent = total ? `${completed}/${total} QUEDAS` : (completed ? `${completed} QUEDAS` : (currentlyLive ? 'AO VIVO' : 'EM ANDAMENTO'));
    const details = document.createElement('button'); details.type='button'; details.className='cff-live-standings-details-btn'; details.textContent='Ver detalhes'; details.onclick=() => openDetails(live);
    tools.append(progress,details); head.append(title,tools);

    const grid = document.createElement('div'); grid.className='cff-live-standings-grid';
    const left=document.createElement('div'); left.className='cff-live-standings-col';
    const right=document.createElement('div'); right.className='cff-live-standings-col';
    teams.slice(0,6).forEach(team => left.appendChild(makeRow(team,live)));
    teams.slice(6,12).forEach(team => right.appendChild(makeRow(team,live)));
    grid.append(left,right); host.append(head,grid);
  }

  async function load() {
    if (loading) return;
    loading = true;
    try {
      const response = await fetch(`${base}/adminLives.json?standings=${Date.now()}`, { cache:'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      lives = Object.values(data || {});
      render();
    } catch (error) {
      console.warn('[Tabela ao vivo] Não foi possível carregar:', error);
      render();
    } finally { loading = false; }
  }

  function boot() {
    injectStyles();
    ensureDetailsModal();
    load();
    setInterval(render,30000);
    setInterval(load,60000);
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded',boot,{once:true}) : boot();
})();
