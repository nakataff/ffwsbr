(() => {
  'use strict';

  const base = String(window.CFF_CONFIG?.firebase?.databaseURL || '').replace(/\/$/, '');
  if (!base) return;

  let lives = [];
  let loading = false;

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
    if (document.getElementById('cff-live-standings-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-live-standings-css';
    style.textContent = `
      #cff-live-standings{margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)}
      .cff-live-standings-head{display:flex;justify-content:space-between;align-items:flex-end;gap:8px;margin-bottom:8px}
      .cff-live-standings-title{min-width:0}.cff-live-standings-kicker{display:block;color:#00c8ff;font-size:.58rem;font-weight:1000;letter-spacing:.8px;text-transform:uppercase}
      .cff-live-standings-title strong{display:block;margin-top:2px;color:#fff;font-size:.76rem;font-weight:1000;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cff-live-standings-progress{flex:0 0 auto;color:#7f9ab7;font-size:.58rem;font-weight:900;text-transform:uppercase;white-space:nowrap}
      .cff-live-standings-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7px}
      .cff-live-standings-col{display:grid;gap:4px;min-width:0}
      .cff-live-standings-row{display:grid;grid-template-columns:18px minmax(0,1fr) auto;align-items:center;gap:4px;min-width:0;padding:6px 6px;border:1px solid rgba(255,255,255,.065);border-radius:7px;background:rgba(255,255,255,.025)}
      .cff-live-standings-row.is-leader{border-color:rgba(0,200,255,.24);background:rgba(0,200,255,.055)}
      .cff-live-standings-rank{color:#728ba5;font-size:.58rem;font-weight:1000;text-align:center}
      .cff-live-standings-team{min-width:0;color:#eaf5ff;font-size:.62rem;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cff-live-standings-points{color:#fff;font-size:.64rem;font-weight:1000;text-align:right}.cff-live-standings-points small{font-size:.45rem;color:#66809b;margin-left:1px}
      @media(max-width:420px){.cff-live-standings-grid{gap:5px}.cff-live-standings-row{padding:5px 4px;grid-template-columns:16px minmax(0,1fr) auto}.cff-live-standings-team{font-size:.58rem}.cff-live-standings-points{font-size:.6rem}}
    `;
    document.head.appendChild(style);
  }

  function cleanTeams(standings) {
    const source = Array.isArray(standings?.teams) ? standings.teams : Object.values(standings?.teams || {});
    return source
      .map((team, index) => ({
        name: String(team?.name || team?.code || '').trim(),
        code: String(team?.code || '').trim(),
        points: Number(team?.points || 0),
        kills: Number(team?.kills || 0),
        rank: Number(team?.rank || 0),
        index,
      }))
      .filter((team) => team.name)
      .sort((a, b) => {
        const ar = a.rank > 0 ? a.rank : 999;
        const br = b.rank > 0 ? b.rank : 999;
        return (ar - br) || (b.points - a.points) || (b.kills - a.kills) || (a.index - b.index);
      })
      .slice(0, 12)
      .map((team, index) => ({ ...team, rank: index + 1 }));
  }

  function makeRow(team) {
    const row = document.createElement('div');
    row.className = `cff-live-standings-row${team.rank === 1 ? ' is-leader' : ''}`;
    const rank = document.createElement('span');
    rank.className = 'cff-live-standings-rank';
    rank.textContent = `${team.rank}º`;
    const name = document.createElement('span');
    name.className = 'cff-live-standings-team';
    name.textContent = team.name;
    name.title = team.name;
    const points = document.createElement('span');
    points.className = 'cff-live-standings-points';
    points.append(document.createTextNode(String(team.points)));
    const suffix = document.createElement('small');
    suffix.textContent = 'PTS';
    points.appendChild(suffix);
    row.append(rank, name, points);
    return row;
  }

  function render() {
    const body = document.querySelector('.home-rail-live .home-widget-body');
    if (!body) return;
    const now = new Date();
    const eligible = lives
      .filter((live) => shouldShow(live, now))
      .sort((a, b) => {
        const aLive = isLiveNow(a, now) ? 1 : 0;
        const bLive = isLiveNow(b, now) ? 1 : 0;
        if (aLive !== bLive) return bLive - aLive;
        return Number(b?.standings?.updatedAt || 0) - Number(a?.standings?.updatedAt || 0);
      });
    const live = eligible[0];
    let host = document.getElementById('cff-live-standings');
    if (!live) {
      host?.remove();
      return;
    }

    const teams = cleanTeams(live.standings);
    if (!teams.length) {
      host?.remove();
      return;
    }
    if (!host) {
      host = document.createElement('section');
      host.id = 'cff-live-standings';
      body.appendChild(host);
    }
    host.replaceChildren();

    const currentlyLive = isLiveNow(live, now);
    const head = document.createElement('div');
    head.className = 'cff-live-standings-head';
    const title = document.createElement('div');
    title.className = 'cff-live-standings-title';
    const kicker = document.createElement('span');
    kicker.className = 'cff-live-standings-kicker';
    kicker.textContent = currentlyLive ? 'TABELA AO VIVO' : 'CLASSIFICAÇÃO DA FINAL';
    const strong = document.createElement('strong');
    strong.textContent = String(live.standings?.title || live.torneio || 'Classificação');
    strong.title = strong.textContent;
    title.append(kicker, strong);
    const progress = document.createElement('span');
    progress.className = 'cff-live-standings-progress';
    const completed = Math.max(0, Number(live.standings?.completedMaps || 0));
    const total = Math.max(0, Number(live.standings?.totalMaps || 0));
    progress.textContent = total ? `${completed}/${total} QUEDAS` : (completed ? `${completed} QUEDAS` : (currentlyLive ? 'AO VIVO' : 'EM ANDAMENTO'));
    head.append(title, progress);

    const grid = document.createElement('div');
    grid.className = 'cff-live-standings-grid';
    const left = document.createElement('div');
    left.className = 'cff-live-standings-col';
    const right = document.createElement('div');
    right.className = 'cff-live-standings-col';
    teams.slice(0, 6).forEach((team) => left.appendChild(makeRow(team)));
    teams.slice(6, 12).forEach((team) => right.appendChild(makeRow(team)));
    grid.append(left, right);
    host.append(head, grid);
  }

  async function load() {
    if (loading) return;
    loading = true;
    try {
      const response = await fetch(`${base}/adminLives.json?standings=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      lives = Object.values(data || {});
      render();
    } catch (error) {
      console.warn('[Tabela ao vivo] Não foi possível carregar:', error);
      render();
    } finally {
      loading = false;
    }
  }

  function boot() {
    injectStyles();
    load();
    setInterval(render, 30000);
    setInterval(load, 60000);
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
})();
