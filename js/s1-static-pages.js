(() => {
  'use strict';

  const BUILD = '20260907-s1-teams-only-v1';
  const PAGE = 'equipes';
  const state = { loading:null, ready:false, teams:[], players:[], byName:new Map() };

  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
  const num = value => Number(value) || 0;
  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  async function getJson(path) {
    const response = await fetch(`${path}?v=${BUILD}`, { cache:'force-cache' });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }

  function resolvePlayer(meta, key, stat) {
    const candidates = [key, stat?.name, stat?.jogador].map(norm).filter(Boolean);
    for (const [id,item] of Object.entries(meta || {})) {
      const aliases = [id,item?.name,...(Array.isArray(item?.aliases) ? item.aliases : [])].map(norm);
      if (candidates.some(candidate => aliases.includes(candidate))) return { id, item };
    }
    return { id:key, item:{} };
  }

  async function loadData() {
    if (state.ready) return state;
    if (state.loading) return state.loading;
    state.loading = Promise.all([
      getJson('ffws-br-2026-s1/teams.json'),
      getJson('ffws-br-2026-s1/player-meta.json'),
      getJson('ffws-br-2026-s1/player-stats.json')
    ]).then(([teamsPayload, metaPayload, statsPayload]) => {
      state.teams = Array.isArray(teamsPayload?.teams) ? teamsPayload.teams : [];
      const meta = metaPayload?.players || {};
      state.players = Object.entries(statsPayload?.players || {}).map(([key,stat]) => {
        const resolved = resolvePlayer(meta,key,stat);
        const item = resolved.item || {};
        return {
          id:String(resolved.id || key),
          name:String(item.name || stat?.name || key),
          team:String(item.team || stat?.team || ''),
          role:String(item.role || 'RUSH'),
          rookie:Boolean(item.rookie),
          aliases:Array.isArray(item.aliases) ? item.aliases : [],
          matches:num(stat?.matches),
          kills:num(stat?.kills)
        };
      });
      state.byName = new Map();
      state.players.forEach(player => [player.id,player.name,...player.aliases].filter(Boolean).forEach(alias => state.byName.set(norm(alias),player)));
      state.ready = true;
      return state;
    }).finally(() => { state.loading = null; });
    return state.loading;
  }

  function teamMeta(name) {
    return state.teams.find(team => norm(team?.name) === norm(name) || norm(team?.abbreviation) === norm(name)) || {};
  }

  function teamLogo(name) {
    try {
      const found = window.getTeamLogoSafe?.(name);
      if (found && found !== 'escudo.webp') return found;
    } catch (_) {}
    return teamMeta(name).logo || 'escudo.webp';
  }

  function playerPhoto(player) {
    try {
      const found = window.cffResolvePlayerPhoto?.(player?.name || '', '');
      if (found) return found;
    } catch (_) {}
    const known = {
      BIELGOD:'bielgod.webp',Cauan7:'cauan7.webp',WHISKYx:'whisky.webp',Rojão:'silhueta.webp',Mts007:'mts007.webp',Yann7awp:'yan7.webp',Theus:'theus.webp',wLiu:'wliu.webp',ITAL0$$:'italo.webp',IguiNmvp:'iguin.webp',Lost21:'lost21.webp','Keven7!':'keven.webp','DRADE.11':'drade.webp','SEU PAI':'seu pai.webp',YOKO7:'yoko.webp'
    };
    if (known[player?.name]) return known[player.name];
    const id = String(player?.id || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    return id ? `player-photos/s2/${id}.webp` : 'silhueta.webp';
  }

  function roleLabel(role) {
    const raw = String(role || '').toUpperCase();
    if (raw.includes('GRAN')) return 'Granadeiro';
    if (raw.includes('SUP')) return 'Suporte';
    if (raw === '3' || raw.includes('3º')) return '3º homem';
    return 'Rush';
  }

  function rosterFor(team) {
    const roster = (team?.players || []).map(name => state.byName.get(norm(name)) || {
      id:norm(name).toLowerCase(), name, team:team?.name || '', role:'RUSH', rookie:false, aliases:[], matches:0, kills:0
    });
    roster.sort((a,b) => b.matches-a.matches || b.kills-a.kills || a.name.localeCompare(b.name,'pt-BR'));
    const highlight = roster.slice().sort((a,b) => b.kills-a.kills || b.matches-a.matches)[0]?.id || '';
    return roster.map((player,index) => ({ ...player, starter:index < 4, highlight:player.id === highlight }));
  }

  function openPlayer(player) {
    if (!player) return;
    try { if (typeof window.openPlayerProfile === 'function') return window.openPlayerProfile(player.name,player.team); } catch (_) {}
    location.href = `jogador.html?${new URLSearchParams({jogador:player.name,time:player.team})}`;
  }

  function openTeam(name) {
    try { if (typeof window.openTeamProfile === 'function') return window.openTeamProfile(name); } catch (_) {}
  }

  async function render() {
    if (String(location.hash || '').replace(/^#/,'') !== PAGE && !document.getElementById(PAGE)?.classList.contains('active')) return false;
    const root = document.getElementById(PAGE);
    if (!root) return false;
    try {
      await loadData();
      const totalPlayers = new Set(state.teams.flatMap(team => (team.players || []).map(norm))).size;
      const rookies = state.players.filter(player => player.rookie && state.teams.some(team => (team.players || []).some(name => norm(name) === norm(player.name) || player.aliases.some(alias => norm(alias) === norm(name))))).length;
      root.innerHTML = `<div class="ffws-s2-shell" data-s1-static="equipes"><section class="ffws-s2-hero"><div class="ffws-s2-kicker">WB 2026 S1 • ARQUIVO</div><h1>Equipes</h1><p>As 16 organizações e os elencos finais registrados na temporada.</p></section><section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Diretório de Equipes</h2><p>Mesmo visual da WB 2026 S2, com funções, estreantes e jogadores mais utilizados.</p></div><span class="ffws-s2-badge">${totalPlayers} jogadores • ${rookies} estreantes</span></div><div class="ffws-s2-teams-grid ffws-s2-rosters-grid">${state.teams.map(team => {
        const roster = rosterFor(team);
        const starters = roster.filter(player => player.starter).length;
        return `<article class="ffws-s2-team-card ffws-s2-team-roster-card" role="button" tabindex="0" data-s1-open-team="${esc(team.name)}"><header class="ffws-s2-team-roster-head"><img loading="lazy" decoding="async" src="${esc(teamLogo(team.name))}" alt="${esc(team.name)}" onerror="this.onerror=null;this.src='escudo.webp'"><div><strong>${esc(team.name)}</strong><small>${esc(team.abbreviation || team.name)} • Brasil • Grupo ${esc(team.group || '—')}</small><small>${starters} titulares • ${Math.max(0,roster.length-starters)} reservas</small></div></header><div class="ffws-s2-roster-list">${roster.map(player => `<button type="button" class="ffws-s2-roster-player${player.starter ? '' : ' reserve'}" data-s1-open-player="${esc(player.id)}"><img class="ffws-s2-roster-player-avatar" loading="lazy" decoding="async" src="${esc(playerPhoto(player))}" alt="${esc(player.name)}" onerror="this.onerror=null;this.src='silhueta.webp'"><span class="ffws-s2-roster-player-main"><strong>${esc(player.name)}</strong><small>${esc(roleLabel(player.role))} • ${player.starter ? 'Titular' : 'Reserva'}</small></span><span class="ffws-s2-roster-badges">${player.rookie ? '<span class="ffws-s2-roster-badge rookie">Estreante</span>' : ''}${player.highlight ? '<span class="ffws-s2-roster-badge highlight">Destaque</span>' : ''}</span></button>`).join('')}</div></article>`;
      }).join('')}</div></div></section></div>`;
      root.querySelectorAll('[data-s1-open-team]').forEach(card => card.addEventListener('click',event => {
        if (event.target.closest('[data-s1-open-player]')) return;
        openTeam(card.dataset.s1OpenTeam);
      }));
      root.querySelectorAll('[data-s1-open-player]').forEach(button => button.addEventListener('click',event => {
        event.stopPropagation();
        openPlayer(state.players.find(player => String(player.id) === String(button.dataset.s1OpenPlayer)));
      }));
      return true;
    } catch (error) {
      console.error('[S1 teams]',error);
      root.innerHTML = '<div class="ffws-s2-empty"><div><strong>Não foi possível carregar as equipes.</strong></div></div>';
      return false;
    }
  }

  function schedule() { setTimeout(render,80); }
  window.cffS1StaticPagesRender = page => String(page || '') === PAGE ? render() : false;
  window.addEventListener('hashchange',schedule);
  document.addEventListener('DOMContentLoaded',schedule,{once:true});
  if (document.readyState !== 'loading') schedule();
})();