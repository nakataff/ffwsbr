(() => {
  'use strict';

  if (!/interacoes\.html$/i.test(location.pathname)) return;
  if (window.__CFF_COMMUNITY_PREDICTION_V3__) return;
  window.__CFF_COMMUNITY_PREDICTION_V3__ = true;

  const API = 'https://cff-instagram-community.nakataffb4.workers.dev';
  const SESSION_KEY = 'cff_daily_checkin_session_v1';
  const drafts = new Map();
  let payload = null;
  let busy = false;
  let rankingPeriod = 'week';

  const $ = (s) => document.querySelector(s);
  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const num = (value) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };

  function session() {
    try { return localStorage.getItem(SESSION_KEY) || ''; } catch (_) { return ''; }
  }

  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(options.headers || {}) },
      ...options,
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(data?.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function injectCss() {
    if ($('#cff-prediction-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-prediction-css';
    style.textContent = `
      .cff-prediction{margin:0 0 18px;border:1px solid rgba(0,200,255,.22);border-radius:18px;background:linear-gradient(135deg,rgba(0,200,255,.075),rgba(11,17,29,.97) 42%,rgba(8,14,24,.99));overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,.2)}
      .cff-prediction-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 20px;border-bottom:1px solid rgba(0,200,255,.13)}
      .cff-prediction-head-copy{min-width:0}.cff-prediction-kicker{color:#00c8ff;font-size:.64rem;font-weight:1000;letter-spacing:1.35px;text-transform:uppercase}.cff-prediction-head h2{margin:5px 0 0;color:#fff;font-size:1.05rem;font-weight:1000;text-transform:uppercase}
      .cff-prediction-head-note{color:#6f8baa;font-size:.68rem;font-weight:800;text-align:right;max-width:360px;line-height:1.35}
      .cff-prediction-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px}
      .cff-prediction-card{min-width:0;border:1px solid rgba(255,255,255,.075);border-radius:14px;background:#080e18;padding:14px}.cff-prediction-card.is-custom{grid-column:1/-1}
      .cff-prediction-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.cff-prediction-label{color:#00c8ff;font-size:.61rem;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}.cff-prediction-deadline{color:#6683a4;font-size:.6rem;font-weight:850;white-space:nowrap}
      .cff-prediction-question{display:block;margin:7px 0 11px;color:#fff;font-size:.92rem;font-weight:1000;line-height:1.3}
      .cff-prediction-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
      .cff-prediction-option{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:84px;border:1px solid rgba(255,255,255,.10);border-radius:11px;background:rgba(255,255,255,.028);color:#dce8f5;padding:8px 5px;font:900 .62rem/1.15 inherit;cursor:pointer;transition:.14s ease;text-align:center;overflow:hidden}
      .cff-prediction-option:hover:not(:disabled){border-color:rgba(0,200,255,.65);background:rgba(0,200,255,.07);transform:translateY(-1px)}.cff-prediction-option.is-selected{border-color:#00c8ff;background:rgba(0,200,255,.12);box-shadow:inset 0 0 0 1px rgba(0,200,255,.08)}
      .cff-prediction-option.is-correct{border-color:#53d99d;background:rgba(83,217,157,.10)}.cff-prediction-option.is-wrong{border-color:rgba(255,108,127,.45);background:rgba(255,108,127,.07)}.cff-prediction-option:disabled{cursor:default;opacity:.78}
      .cff-prediction-logo{width:38px;height:38px;object-fit:contain;filter:drop-shadow(0 3px 5px rgba(0,0,0,.28))}.cff-prediction-logo-fallback{display:flex;width:38px;height:38px;align-items:center;justify-content:center;border-radius:9px;background:#111c2c;color:#00c8ff;font-size:.68rem}
      .cff-prediction-points-row{display:flex;align-items:end;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)}.cff-prediction-points-row label{display:grid;gap:4px;flex:1;color:#718daa;font-size:.62rem;font-weight:900;text-transform:uppercase}.cff-prediction-points-row input{width:100%;height:39px;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#050a12;color:#fff;padding:0 10px;outline:none;font-weight:900}.cff-prediction-points-row input:focus{border-color:#00c8ff}
      .cff-prediction-confirm,.cff-prediction-edit,.cff-prediction-cancel{height:39px;border-radius:9px;padding:0 12px;font-size:.65rem;font-weight:1000;text-transform:uppercase;cursor:pointer}.cff-prediction-confirm{border:1px solid #00c8ff;background:#00c8ff;color:#03111a}.cff-prediction-confirm:disabled{opacity:.45;cursor:default}.cff-prediction-edit{border:1px solid rgba(0,200,255,.42);background:rgba(0,200,255,.08);color:#bdefff}.cff-prediction-cancel{border:1px solid rgba(255,255,255,.11);background:transparent;color:#8da4bf}.cff-prediction-edit-actions{display:flex;justify-content:flex-end;margin-top:9px}.cff-prediction-edit:hover,.cff-prediction-cancel:hover{border-color:#00c8ff;color:#e9fbff}
      .cff-prediction-status{margin:10px 0 0;color:#7891ae;font-size:.67rem;line-height:1.45;font-weight:750}.cff-prediction-status strong{color:#fff}.cff-prediction-status.ok{color:#75dfaa}.cff-prediction-status.warn{color:#ffd477}
      .cff-prediction-prize{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.cff-prediction-chip{padding:5px 7px;border:1px solid rgba(0,200,255,.18);border-radius:999px;background:rgba(0,200,255,.05);color:#aeefff;font-size:.58rem;font-weight:950;text-transform:uppercase}
      .cff-prediction-result{margin-top:9px;padding:9px 10px;border-radius:9px;background:rgba(83,217,157,.065);border:1px solid rgba(83,217,157,.16);color:#aee8c9;font-size:.67rem;font-weight:800;line-height:1.45}
      .cff-prediction-empty{padding:22px;color:#7791ae;font-size:.75rem;font-weight:800;text-align:center}
      .cff-pred-rank{margin:0 0 18px;border:1px solid var(--ig-border,#1d2a42);border-radius:18px;background:linear-gradient(145deg,rgba(15,23,38,.96),rgba(7,12,22,.97));overflow:hidden;box-shadow:0 18px 55px rgba(0,0,0,.18)}
      .cff-pred-rank-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--ig-border,#1d2a42)}.cff-pred-rank-head h2{margin:0;color:#fff;font-size:.88rem;font-weight:1000;text-transform:uppercase;letter-spacing:1px}.cff-pred-rank-tabs{display:flex;gap:5px}.cff-pred-rank-tab{border:1px solid rgba(255,255,255,.09);border-radius:8px;background:transparent;color:#738daa;padding:6px 8px;font-size:.61rem;font-weight:950;text-transform:uppercase;cursor:pointer}.cff-pred-rank-tab.is-active{border-color:rgba(0,200,255,.4);background:rgba(0,200,255,.08);color:#d8f8ff}
      .cff-pred-rank-list{display:grid;gap:1px}.cff-pred-rank-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:10px 16px;border-bottom:1px solid rgba(29,42,66,.55);font-size:.73rem}.cff-pred-rank-row:last-child{border-bottom:0}.cff-pred-rank-pos{color:#6f8baa;font-weight:1000}.cff-pred-rank-user{color:#e8f3ff;font-weight:950;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cff-pred-rank-stats{color:#6f8baa;font-size:.62rem;font-weight:800;white-space:nowrap}.cff-pred-rank-points{color:#00c8ff;font-weight:1000;white-space:nowrap}.cff-pred-rank-empty{padding:20px;color:#748eaa;text-align:center;font-size:.72rem;font-weight:800}
      @media(max-width:900px){.cff-prediction-options{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.cff-prediction-list{grid-template-columns:1fr}.cff-prediction-card.is-custom{grid-column:auto}.cff-prediction-head{align-items:flex-start;flex-direction:column}.cff-prediction-head-note{text-align:left}.cff-prediction-options{grid-template-columns:repeat(3,minmax(0,1fr))}.cff-pred-rank-row{grid-template-columns:32px minmax(0,1fr) auto}.cff-pred-rank-stats{display:none}}@media(max-width:460px){.cff-prediction-options{grid-template-columns:repeat(2,minmax(0,1fr))}.cff-prediction-option{min-height:80px}.cff-prediction-logo{width:35px;height:35px}.cff-prediction-points-row{align-items:stretch;flex-direction:column}.cff-prediction-confirm,.cff-prediction-cancel{width:100%}.cff-prediction-edit{width:100%}.cff-pred-rank-head{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function initials(value) { const clean = String(value || '').replace(/[^a-z0-9]/gi, ''); return (clean.slice(0, 3) || 'FF').toUpperCase(); }
  function logo(option) {
    const url = String(option?.logo || '').trim();
    return url ? `<img class="cff-prediction-logo" src="${esc(url)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'cff-prediction-logo-fallback',textContent:'${esc(initials(option?.label))}'}))">` : `<span class="cff-prediction-logo-fallback">${esc(initials(option?.label))}</span>`;
  }
  function formatDeadline(value) { const n = Number(value); if (!n) return ''; try { return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(n)); } catch (_) { return ''; } }

  function mount() {
    if ($('#cff-community-prediction')) return $('#cff-community-prediction');
    const toolbar = $('.ig-toolbar'); if (!toolbar) return null; injectCss();
    const section = document.createElement('section'); section.className = 'cff-prediction'; section.id = 'cff-community-prediction'; section.innerHTML = '<div class="cff-prediction-empty">Carregando palpites...</div>'; toolbar.parentNode.insertBefore(section, toolbar); return section;
  }

  function mountRanking() {
    if ($('#cff-prediction-ranking')) return $('#cff-prediction-ranking');
    const grid = $('.ig-grid'); if (!grid) return null;
    const section = document.createElement('section'); section.id = 'cff-prediction-ranking'; section.className = 'cff-pred-rank';
    section.innerHTML = `<div class="cff-pred-rank-head"><h2>🎯 Ranking de palpites</h2><div class="cff-pred-rank-tabs"><button class="cff-pred-rank-tab is-active" data-period="week">Semana</button><button class="cff-pred-rank-tab" data-period="month">Mês</button><button class="cff-pred-rank-tab" data-period="all">Geral</button></div></div><div class="cff-pred-rank-list" id="cff-pred-rank-list"><div class="cff-pred-rank-empty">Carregando...</div></div>`;
    grid.insertAdjacentElement('afterend', section);
    section.querySelectorAll('[data-period]').forEach(btn => btn.addEventListener('click', () => { rankingPeriod = btn.dataset.period || 'week'; section.querySelectorAll('[data-period]').forEach(x => x.classList.toggle('is-active', x === btn)); loadRanking(); }));
    return section;
  }

  function injectRule(predictions) {
    const rules = $('.ig-rules'); if (!rules || $('#ig-rule-prediction') || !predictions.length) return;
    const maxParticipation = Math.max(...predictions.map(p => num(p.participationPoints)), 1); const maxBonus = Math.max(...predictions.map(p => num(p.correctPoints)), 3);
    const row = document.createElement('div'); row.className = 'ig-rule'; row.id = 'ig-rule-prediction';
    row.innerHTML = `<div class="ig-rule-icon">🎯</div><div><strong>Palpites</strong><small>Participe, acerte resultados e dispute também o ranking exclusivo de palpites.</small></div><div class="ig-rule-points">+${maxParticipation} / +${maxBonus} pts</div>`;
    const note = rules.querySelector('.ig-note'); if (note) rules.insertBefore(row, note); else rules.appendChild(row);
  }

  function userVoteFor(id) { return payload?.votes && payload.votes[id] ? payload.votes[id] : null; }
  function optionLabel(p, id) { return (p.options || []).find(o => o.id === id)?.label || id || '—'; }
  function predictionStatus(p, vote, editing = false) {
    const linked = Boolean(payload?.linked);
    if (!linked) return { text: 'Vincule seu Instagram no check-in para participar.', cls: 'warn' };
    if (p.status === 'settled') {
      if (!vote) return { text: 'Resultado definido. Você não participou deste palpite.', cls: '' };
      if (vote.won) return { text: `MANDOU BEM! 🔥 Você ficou entre os vencedores e ganhou +${num(vote.bonusPoints)} pts.`, cls: 'ok' };
      return { text: 'Resultado definido. O palpite fica salvo no seu histórico.', cls: '' };
    }
    if (vote) {
      if (editing) return { text: 'Você está editando o palpite. Salve a alteração antes do horário de encerramento.', cls: 'warn' };
      const pts = vote.points == null ? '' : ` • ${num(vote.points)} pts`;
      return { text: `Palpite confirmado: ${optionLabel(p, vote.option)}${pts}. Você pode trocar enquanto estiver aberto.`, cls: 'ok' };
    }
    if (p.status !== 'open') return { text: 'Palpite encerrado. Aguardando o resultado.', cls: 'warn' };
    return { text: p.kind === 'team_points' ? 'Escolha um time, estime a pontuação e confirme.' : 'Escolha uma opção e confirme. Você poderá trocar até o encerramento.', cls: '' };
  }

  function resultMarkup(p) {
    const r = p.result; if (!r || p.status !== 'settled') return '';
    const team = r.teamLabel || r.team || optionLabel(p, r.option); const points = Number.isFinite(Number(r.points)) ? ` com <strong>${num(r.points)} pontos</strong>` : ''; const closest = Number.isFinite(Number(r.closestError)) ? ` • melhor diferença: ${num(r.closestError)} pt${num(r.closestError) === 1 ? '' : 's'}` : '';
    return `<div class="cff-prediction-result">Resultado: <strong>${esc(team)}</strong>${points}${closest}</div>`;
  }

  function cardMarkup(p) {
    const vote = userVoteFor(p.id);
    const editing = Boolean(vote) && drafts.has(p.id);
    const draft = drafts.get(p.id) || { option: vote?.option || '', points: vote?.points == null ? '' : String(vote.points) };
    const selected = editing ? (draft.option || vote?.option || '') : (vote?.option || draft.option || '');
    const locked = p.status !== 'open' || !payload?.linked || busy || (Boolean(vote) && !editing);
    const settledTeams = Array.isArray(p.result?.teams) ? p.result.teams : p.result?.option ? [p.result.option] : [];
    const status = predictionStatus(p, vote, editing);
    const isNumeric = p.kind === 'team_points';
    const pointsValue = draft.points == null ? '' : String(draft.points);
    const valid = Boolean(selected) && (!isNumeric || pointsValue !== '');
    const changed = !vote || selected !== vote.option || (isNumeric && Number(pointsValue) !== Number(vote.points));
    const canSubmit = valid && changed;
    const editor = p.status === 'open' && payload?.linked && (!vote || editing)
      ? `<div class="cff-prediction-points-row">${isNumeric ? `<label>${esc(p.pointsPrompt || 'Quantos pontos?')}<input type="number" min="0" max="300" step="1" inputmode="numeric" data-points-for="${esc(p.id)}" value="${esc(pointsValue)}" placeholder="Ex.: 82"></label>` : '<span style="flex:1"></span>'}${vote ? `<button type="button" class="cff-prediction-cancel" data-cancel-edit="${esc(p.id)}">Cancelar</button>` : ''}<button type="button" class="cff-prediction-confirm" data-confirm="${esc(p.id)}" ${canSubmit ? '' : 'disabled'}>${vote ? 'Salvar alteração' : 'Confirmar'}</button></div>`
      : '';
    const editButton = vote && p.status === 'open' && payload?.linked && !editing
      ? `<div class="cff-prediction-edit-actions"><button type="button" class="cff-prediction-edit" data-edit-prediction="${esc(p.id)}">Trocar palpite</button></div>`
      : '';
    return `<article class="cff-prediction-card ${p.category === 'custom' ? 'is-custom' : ''}" data-prediction-card="${esc(p.id)}"><div class="cff-prediction-card-top"><span class="cff-prediction-label">${esc(p.label || (p.category === 'ffws' ? 'FFWS BR • Palpite do dia' : 'Palpite da comunidade'))}</span><span class="cff-prediction-deadline">${p.closesAt ? `até ${esc(formatDeadline(p.closesAt))}` : ''}</span></div><strong class="cff-prediction-question">${esc(p.question)}</strong><div class="cff-prediction-options">${(p.options || []).map(o => { const classes = ['cff-prediction-option', selected === o.id ? 'is-selected' : '', p.status === 'settled' && settledTeams.includes(o.id) ? 'is-correct' : '', p.status === 'settled' && vote?.option === o.id && !settledTeams.includes(o.id) ? 'is-wrong' : ''].filter(Boolean).join(' '); return `<button type="button" class="${classes}" data-prediction="${esc(p.id)}" data-option="${esc(o.id)}" ${locked ? 'disabled' : ''}>${logo(o)}<span>${esc(o.label)}</span></button>`; }).join('')}</div>${editor}<div class="cff-prediction-prize"><span class="cff-prediction-chip">Participar +${num(p.participationPoints)}</span><span class="cff-prediction-chip">${isNumeric ? 'Mais próximo' : 'Acertar'} +${num(p.correctPoints)}</span></div><p class="cff-prediction-status ${status.cls}">${status.text}</p>${editButton}${resultMarkup(p)}</article>`;
  }

  function render(data) {
    const root = mount(); if (!root) return; payload = data || {}; const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
    if (!predictions.length) { root.hidden = true; return; }
    root.hidden = false; injectRule(predictions);
    root.innerHTML = `<div class="cff-prediction-head"><div class="cff-prediction-head-copy"><div class="cff-prediction-kicker">🎯 Palpites da comunidade</div><h2>Prove que entende do jogo</h2></div><div class="cff-prediction-head-note">Os palpites da FFWS fecham automaticamente às 13h, no início da transmissão. Você pode trocar sua escolha enquanto o palpite estiver aberto.</div></div><div class="cff-prediction-list">${predictions.map(cardMarkup).join('')}</div>`;
    root.querySelectorAll('[data-edit-prediction]').forEach(btn => btn.addEventListener('click', () => { const id = btn.dataset.editPrediction; const vote = userVoteFor(id); if (!id || !vote) return; drafts.set(id, { option: vote.option || '', points: vote.points == null ? '' : String(vote.points) }); render(payload); }));
    root.querySelectorAll('[data-cancel-edit]').forEach(btn => btn.addEventListener('click', () => { drafts.delete(btn.dataset.cancelEdit); render(payload); }));
    root.querySelectorAll('[data-prediction][data-option]').forEach(btn => btn.addEventListener('click', () => { const id = btn.dataset.prediction; const vote = userVoteFor(id); const current = drafts.get(id) || { option: vote?.option || '', points: vote?.points == null ? '' : String(vote.points) }; current.option = btn.dataset.option || ''; drafts.set(id, current); render(payload); }));
    root.querySelectorAll('[data-points-for]').forEach(input => input.addEventListener('input', () => {
      const id = input.dataset.pointsFor; const vote = userVoteFor(id); const current = drafts.get(id) || { option: vote?.option || '', points: vote?.points == null ? '' : String(vote.points) };
      current.points = input.value === '' ? '' : String(Math.max(0, Math.min(300, Math.round(Number(input.value) || 0)))); drafts.set(id, current);
      const confirm = root.querySelector(`[data-confirm="${CSS.escape(id)}"]`); if (confirm) { const changed = !vote || current.option !== vote.option || Number(current.points) !== Number(vote.points); confirm.disabled = !current.option || current.points === '' || !changed; }
    }));
    root.querySelectorAll('[data-confirm]').forEach(btn => btn.addEventListener('click', () => submitVote(btn.dataset.confirm)));
  }

  async function load() {
    if (!mount()) return;
    try { const qs = new URLSearchParams(); if (session()) qs.set('session', session()); qs.set('_', Date.now()); const data = await request('/api/predictions?' + qs.toString()); render(data); loadRanking(); }
    catch (error) { console.error('[CFF Predictions]', error); const root = mount(); if (root) root.hidden = true; loadRanking(); }
  }

  async function submitVote(id) {
    if (busy || !id || !session()) return; const p = payload?.predictions?.find(x => x.id === id); if (!p) return; const draft = drafts.get(id) || {}; if (!draft.option) return; if (p.kind === 'team_points' && draft.points === '') return;
    busy = true; render(payload);
    try { const data = await request('/api/prediction/vote', { method: 'POST', body: JSON.stringify({ session: session(), predictionId: id, option: draft.option, points: p.kind === 'team_points' ? Number(draft.points) : null }) }); drafts.delete(id); if (data?.all) render(data.all); else await load(); }
    catch (error) { console.error('[CFF prediction vote]', error); const card = document.querySelector(`[data-prediction-card="${CSS.escape(id)}"]`); const status = card?.querySelector('.cff-prediction-status'); if (status) { status.textContent = error.message || 'Não foi possível registrar o palpite.'; status.classList.add('warn'); } }
    finally { busy = false; }
  }

  async function loadRanking() {
    const section = mountRanking(); if (!section) return; const list = $('#cff-pred-rank-list');
    try { const data = await request(`/api/prediction/ranking?period=${encodeURIComponent(rankingPeriod)}&_=${Date.now()}`); const users = Array.isArray(data?.ranking) ? data.ranking.slice(0, 10) : []; list.innerHTML = users.length ? users.map((u, i) => `<div class="cff-pred-rank-row"><span class="cff-pred-rank-pos">${i + 1}º</span><strong class="cff-pred-rank-user">@${esc(String(u.username || 'usuario').replace(/^@+/, ''))}</strong><span class="cff-pred-rank-stats">${num(u.participations)} palpites • ${num(u.wins)} acertos</span><span class="cff-pred-rank-points">${num(u.points).toLocaleString('pt-BR')} pts</span></div>`).join('') : '<div class="cff-pred-rank-empty">Ainda não há pontos de palpite neste período.</div>'; }
    catch (error) { console.error('[CFF prediction ranking]', error); list.innerHTML = '<div class="cff-pred-rank-empty">Ranking de palpites indisponível até a atualização do Worker.</div>'; }
  }

  function boot() { let tries = 0; const timer = setInterval(() => { tries += 1; if ($('.ig-toolbar')) { clearInterval(timer); load(); } else if (tries > 100) clearInterval(timer); }, 100); }
  window.addEventListener('storage', e => { if (e.key === SESSION_KEY) load(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  setInterval(() => { if (!document.hidden && !busy) load(); }, 30000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
