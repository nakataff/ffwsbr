// ============== PLAYER PROFILE ==============
// Código da página de jogadores separado do perfil de equipes.
// Mantém dependência dos helpers compartilhados carregados em team-profile.js.

function cffBuildPlayerEditionBreakdownHTML(editionsData, options = {}) {
    const safe = (typeof cffEscapeHTML === 'function') ? cffEscapeHTML : (v) => String(v || '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
    const entries = Object.entries(editionsData || {});
    const sorted = (typeof cffSortEditions === 'function') ? cffSortEditions(entries) : entries;
    const rows = sorted.map(([edition, row]) => {
        const kills = Number(row.k || row.kills || 0);
        const matches = Number(row.q || row.quedas || row.matches || 0);
        return { edition, kills, matches, avg: matches ? (kills / matches).toFixed(2) : '0.00' };
    }).filter(r => r.kills || r.matches);
    if (!rows.length) return '';
    const id = options.id || `pp-history-breakdown-${Math.random().toString(36).slice(2, 8)}`;
    const compact = rows.slice(-3).reverse();
    return `<div class="cff-history-compact pp-history-compact">
        <div class="cff-history-compact-head">
            <div>
                <strong>Histórico por edição</strong>
                <span>${rows.length} edição${rows.length === 1 ? '' : 'ões'} registrada${rows.length === 1 ? '' : 's'}</span>
            </div>
            <button class="cff-expand-btn" type="button" onclick="window.cffToggleHistoryBreakdown('${id}', this)">Ver detalhes</button>
        </div>
        <div class="cff-history-mini-list">
            ${compact.map(ed => `<div class="cff-history-mini-pill"><strong>${safe(ed.edition)}</strong><span>${ed.kills} K • ${ed.avg} K/Q</span></div>`).join('')}
        </div>
        <div id="${id}" class="cff-history-breakdown" hidden>
            ${rows.map(ed => `<div class="cff-history-row"><strong>${safe(ed.edition)}</strong><span>${ed.kills} K • ${ed.matches} quedas • média ${ed.avg}</span></div>`).join('')}
        </div>
    </div>`;
}

function cffRenderPlayerEditionBreakdown(editionsData) {
    const avgEl = document.getElementById('pp-hist-avg');
    if (!avgEl) return;
    let wrap = document.getElementById('pp-historical-editions-breakdown');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'pp-historical-editions-breakdown';
        const histGrid = avgEl.closest('.grid-cards');
        if (histGrid && histGrid.parentNode) histGrid.parentNode.insertBefore(wrap, histGrid.nextSibling);
    }
    wrap.innerHTML = cffBuildPlayerEditionBreakdownHTML(editionsData, { id: 'pp-history-breakdown-details' });
    wrap.style.display = wrap.innerHTML.trim() ? 'block' : 'none';
}

window.cffToggleHistoryBreakdown = window.cffToggleHistoryBreakdown || function (id, btn) {
    const el = document.getElementById(id);
    if (!el) return;
    const willOpen = el.hasAttribute('hidden');
    if (willOpen) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
    if (btn) btn.textContent = willOpen ? 'Ocultar detalhes' : 'Ver detalhes';
};

function cffPlayerProfileFindSocial(playerName) {
    if (typeof dbSocials === 'undefined' || !dbSocials) return '';
    const raw = String(playerName || '').trim();
    if (dbSocials[raw]) return dbSocials[raw];
    const key = Object.keys(dbSocials).find(k => typeof cffPlayerNameMatches === 'function' ? cffPlayerNameMatches(k, raw) : String(k).toLowerCase() === raw.toLowerCase());
    return key ? dbSocials[key] : '';
}

function cffPlayerProfileResolveTeamLogo(teamName) {
    const raw = String(teamName || '').trim();
    if (!raw || /^sem\s+(equipe|time|clube)$/i.test(raw) || /hist[oó]rico/i.test(raw)) return '';
    const laffTeam = (typeof cffFindLAFFTeamInfo === 'function') ? cffFindLAFFTeamInfo(raw) : null;
    if (laffTeam?.logo) return laffTeam.logo;
    if (typeof cffResolveTeamLogoSafe === 'function') return cffResolveTeamLogoSafe(raw);
    if (typeof logos !== 'undefined' && logos) return logos[raw] || logos[(typeof getTeamCanonicalName === 'function' ? getTeamCanonicalName(raw) : raw)] || 'escudo.webp';
    return 'escudo.webp';
}

function cffBuildUnifiedPlayerHero(options = {}) {
    const playerName = options.playerName || '';
    const displayName = typeof getDisplayName === 'function' ? getDisplayName(playerName) : playerName;
    const photo = (typeof cffResolvePlayerHistoryPhoto === 'function') ? cffResolvePlayerHistoryPhoto(playerName) : 'silhueta.webp';
    const teamName = String(options.teamName || '').trim();
    const teamLogo = options.showTeamLogo === false ? '' : cffPlayerProfileResolveTeamLogo(teamName);
    const hasTeamLogo = !!teamLogo && !/^escudo\.webp$/i.test(teamLogo) && !options.noTeam;
    const insta = cffPlayerProfileFindSocial(playerName);
    const status = options.status || (hasTeamLogo ? 'JOGADOR ATIVO' : 'JOGADOR HISTÓRICO');
    const roleHtml = options.role ? `<div class="cff-player-hero-last">Função: <strong>${cffEscapeHTML(options.role)}</strong></div>` : '';
    const lastHtml = options.lastText ? `<div class="cff-player-hero-last">${options.lastText}</div>` : '';
    const teamHtml = (teamName && !options.noTeam) ? `<button type="button" class="cff-player-hero-team-btn" onclick="cffOpenTeamProfileSmart('${String(teamName).replace(/'/g, "\'")}')">${cffEscapeHTML(teamName)}</button>` : '';
    const instaHtml = insta ? `<a href="https://instagram.com/${cffEscapeHTML(insta)}" target="_blank" class="cff-inactive-player-instagram"><img src="instagram.webp" alt="Instagram"><span>@${cffEscapeHTML(insta)}</span></a>` : '';
    const extraHtml = options.extraHtml || '';

    return `
        <div class="cff-player-profile-hero ${hasTeamLogo ? 'has-team-logo' : 'no-team-logo'} ${options.variant || ''}">
            <div class="cff-player-hero-photo-wrap">
                <img class="cff-player-hero-photo" src="${cffEscapeHTML(photo)}" alt="${cffEscapeHTML(displayName)}" onerror="this.src='silhueta.webp'">
                ${hasTeamLogo ? `<span class="cff-player-hero-team-orbit"><img src="${cffEscapeHTML(teamLogo)}" alt="${cffEscapeHTML(teamName)}" onerror="this.src='escudo.webp'"></span>` : ''}
            </div>
            <div class="cff-player-hero-content">
                <div class="cff-player-hero-kicker">${cffEscapeHTML(status)}</div>
                <h2>${cffEscapeHTML(displayName)}</h2>
                ${teamHtml}
                ${roleHtml}
                ${lastHtml}
                ${extraHtml}
                ${instaHtml}
            </div>
        </div>`;
}

function cffBuildInactivePlayerHero(playerName, lastEd) {
    const lastText = lastEd && lastEd !== 'N/A' ? `Última participação: <strong>${cffEscapeHTML(lastEd)}</strong>` : '';
    return cffBuildUnifiedPlayerHero({
        playerName,
        status: 'EX-JOGADOR',
        noTeam: true,
        showTeamLogo: false,
        lastText,
        variant: 'is-inactive'
    });
}


function cffFindLAFFPlayerInfo(playerName) {
    const raw = String(playerName || '').trim();
    if (!raw || typeof window.getLAFFPlayers !== 'function') return null;
    const rows = window.getLAFFPlayers() || [];
    return rows.find(p => {
        const n = String(p?.name || '').trim();
        if (!n) return false;
        if (typeof cffPlayerNameMatches === 'function' && cffPlayerNameMatches(n, raw)) return true;
        if (typeof checkNameMatch === 'function' && checkNameMatch(n, raw)) return true;
        return cffPlayerLooseKey(n) === cffPlayerLooseKey(raw);
    }) || null;
}

function cffFindLAFFTeamInfo(teamName) {
    const raw = String(teamName || '').trim();
    if (!raw || typeof window.getLAFFTeams !== 'function') return null;
    const teams = window.getLAFFTeams() || [];
    return teams.find(t => {
        const n = String(t?.name || '').trim();
        if (!n) return false;
        if (typeof sameTeamName === 'function' && sameTeamName(n, raw)) return true;
        if (typeof cffTeamMatchesHistoryTeam === 'function' && cffTeamMatchesHistoryTeam(n, raw)) return true;
        return cffNormalizeFilterText(n) === cffNormalizeFilterText(raw);
    }) || null;
}


async function cffLoadLAFF2025S1Finals() {
    if (window.__cffLAFF2025S1Finals) return window.__cffLAFF2025S1Finals;
    try {
        const text = (typeof fetchTextNoCache === 'function')
            ? await fetchTextNoCache('laff-2025-s1-finals.json')
            : await fetch('laff-2025-s1-finals.json', { cache: 'no-store' }).then(r => r.text());
        window.__cffLAFF2025S1Finals = JSON.parse(text || '{}');
    } catch (e) {
        window.__cffLAFF2025S1Finals = { competition: 'LAFF 2025 S1', stage: 'Finals', teams: [] };
    }
    return window.__cffLAFF2025S1Finals;
}

function cffTeamMatchesLAFFName(a, b) {
    if (!a || !b) return false;
    if (typeof sameTeamName === 'function' && sameTeamName(a, b)) return true;
    if (typeof cffTeamMatchesHistoryTeam === 'function' && cffTeamMatchesHistoryTeam(a, b)) return true;
    return cffNormalizeFilterText(a) === cffNormalizeFilterText(b);
}

function cffGetPlayerRelatedTeams(playerName, currentTeam = '') {
    const teams = [];
    const add = (name) => {
        const clean = String(name || '').trim();
        if (!clean || /^sem equipe$/i.test(clean)) return;
        if (!teams.some(t => cffTeamMatchesLAFFName(t, clean))) teams.push(clean);
    };
    add(currentTeam);
    const laff = cffFindLAFFPlayerInfo(playerName);
    add(laff?.team);
    try {
        const hist = Array.isArray(dbPassagens) ? dbPassagens.find(p => typeof checkNameMatch === 'function' ? checkNameMatch(p.jogador, playerName) : String(p.jogador).toLowerCase() === String(playerName).toLowerCase()) : null;
        (hist?.passagens || []).forEach(pass => add(pass.equipe));
    } catch(e) {}
    return teams;
}

function cffLAFFPlayerMatches(rowName, playerName) {
    const a = String(rowName || '').trim();
    const b = String(playerName || '').trim();
    if (!a || !b) return false;
    if (typeof cffPlayerNameMatches === 'function' && cffPlayerNameMatches(a, b)) return true;
    if (typeof checkNameMatch === 'function' && checkNameMatch(a, b)) return true;
    return cffPlayerLooseKey(a) === cffPlayerLooseKey(b);
}

function cffGetLAFFStageTeamRows(data, teams) {
    const out = [];
    const addRows = (stageKey, label) => {
        const rows = data?.stages?.[stageKey]?.teams || [];
        rows.forEach(row => {
            if (!row?.team || !teams.some(team => cffTeamMatchesLAFFName(row.team, team))) return;
            if (out.some(item => item.stageKey === stageKey && cffTeamMatchesLAFFName(item.team, row.team))) return;
            out.push({ ...row, stageKey, label });
        });
    };
    addRows('groups', 'LAFF 2025 S1 · Classificatória');
    addRows('finals', 'LAFF 2025 S1 · Final');
    if (!out.length && Array.isArray(data?.teams)) {
        data.teams.forEach(row => {
            if (!row?.team || !teams.some(team => cffTeamMatchesLAFFName(row.team, team))) return;
            out.push({ ...row, stageKey: 'finals', label: 'LAFF 2025 S1 · Final' });
        });
    }
    return out;
}


function cffGetLAFFPlayerHistoryRows(playerName) {
    const data = window.__cffLAFF2025S1Finals || null;
    const rows = Array.isArray(data?.players) ? data.players : [];
    return rows.filter(row => cffLAFFPlayerMatches(row.name, playerName));
}

function cffMergeLAFFPlayerHistoryIntoEditions(playerName, editions = {}) {
    const merged = { ...(editions || {}) };
    const rows = cffGetLAFFPlayerHistoryRows(playerName);
    rows.forEach(row => {
        const label = row.stage || row.label || 'LAFF 2025 S1';
        const current = merged[label] || { k: 0, q: 0, team: row.team || '', source: 'laff' };
        current.k = Number(current.k || current.kills || 0) + Number(row.kills || row.abates || 0);
        current.q = Number(current.q || current.quedas || current.matches || 0) + Number(row.matches || row.quedas || 0);
        current.team = current.team || row.team || '';
        current.source = 'laff';
        merged[label] = current;
    });
    return merged;
}

function cffGetLAFFPlayerHistoryTotals(playerName) {
    return cffGetLAFFPlayerHistoryRows(playerName).reduce((acc, row) => {
        acc.kills += Number(row.kills || row.abates || 0);
        acc.matches += Number(row.matches || row.quedas || 0);
        if (row.team && !acc.teams.some(team => cffTeamMatchesLAFFName(team, row.team))) acc.teams.push(row.team);
        return acc;
    }, { kills: 0, matches: 0, teams: [] });
}


function cffSumPlayerHistoryEditions(editionsData = {}) {
    return Object.values(editionsData || {}).reduce((acc, row) => {
        acc.kills += Number(row?.k || row?.kills || 0);
        acc.matches += Number(row?.q || row?.quedas || row?.matches || 0);
        return acc;
    }, { kills: 0, matches: 0 });
}

function cffBuildPlayerHistoryScopeState(wbEditions = {}, laffEditions = {}) {
    const wbOnly = { ...(wbEditions || {}) };
    const laffOnly = { ...(laffEditions || {}) };
    const all = cffMergeLAFFPlayerHistoryIntoEditions('', wbOnly);

    // A linha acima não recebe nome de jogador; ela só preserva a estrutura. A fusão real é feita abaixo.
    const mergedAll = { ...wbOnly };
    Object.entries(laffOnly).forEach(([label, row]) => {
        const current = mergedAll[label] || { k: 0, q: 0, source: 'laff' };
        current.k = Number(current.k || current.kills || 0) + Number(row?.k || row?.kills || 0);
        current.q = Number(current.q || current.quedas || current.matches || 0) + Number(row?.q || row?.quedas || row?.matches || 0);
        current.team = current.team || row?.team || '';
        current.source = row?.source || current.source || 'laff';
        mergedAll[label] = current;
    });

    return {
        scope: 'all',
        data: {
            all: mergedAll,
            wb: wbOnly,
            laff: laffOnly
        },
        totals: {
            all: cffSumPlayerHistoryEditions(mergedAll),
            wb: cffSumPlayerHistoryEditions(wbOnly),
            laff: cffSumPlayerHistoryEditions(laffOnly)
        }
    };
}

function cffBuildLAFFPlayerEditionData(playerName) {
    const out = {};
    cffGetLAFFPlayerHistoryRows(playerName).forEach(row => {
        const label = row.stage || row.label || 'LAFF 2025 S1';
        const current = out[label] || { k: 0, q: 0, team: row.team || '', source: 'laff' };
        current.k = Number(current.k || current.kills || 0) + Number(row.kills || row.abates || 0);
        current.q = Number(current.q || current.quedas || current.matches || 0) + Number(row.matches || row.quedas || 0);
        current.team = current.team || row.team || '';
        current.source = 'laff';
        out[label] = current;
    });
    return out;
}

function cffRenderPlayerHistoryScopeFilters(state) {
    const holder = document.getElementById('pp-history-scope-filters');
    if (!holder) return;
    const hasWB = Number(state?.totals?.wb?.kills || 0) || Number(state?.totals?.wb?.matches || 0);
    const hasLAFF = Number(state?.totals?.laff?.kills || 0) || Number(state?.totals?.laff?.matches || 0);
    if (!hasWB || !hasLAFF) {
        holder.innerHTML = '';
        holder.style.display = 'none';
        return;
    }
    holder.style.display = '';
    const current = state.scope || 'all';
    const btn = (scope, label) => `<button type="button" class="pp-history-scope-btn${current === scope ? ' is-active' : ''}" onclick="window.cffSetPlayerHistoryScope('${scope}')">${label}</button>`;
    holder.innerHTML = btn('all', 'Geral') + btn('wb', 'WB/LBFF') + btn('laff', 'LAFF');
}

function cffApplyPlayerHistoryScope(scope = 'all') {
    const state = window.__cffPlayerHistoryScopeState;
    if (!state || !state.data) return;
    const safeScope = state.data[scope] ? scope : 'all';
    state.scope = safeScope;
    const totals = state.totals[safeScope] || { kills: 0, matches: 0 };
    const killsEl = document.getElementById('pp-hist-kills');
    const quedasEl = document.getElementById('pp-hist-quedas');
    const avgEl = document.getElementById('pp-hist-avg');
    if (killsEl) killsEl.innerText = totals.kills;
    if (quedasEl) quedasEl.innerText = totals.matches;
    if (avgEl) avgEl.innerText = totals.matches > 0 ? (totals.kills / totals.matches).toFixed(2) : '0.00';
    cffRenderPlayerEditionBreakdown(state.data[safeScope]);
    cffRenderPlayerHistoryScopeFilters(state);
}

window.cffSetPlayerHistoryScope = function(scope) {
    cffApplyPlayerHistoryScope(scope);
};

function cffBuildLAFFResponsiveTeamName(teamName) {
    const full = String(teamName || '').trim();
    if (!full) return '';
    let short = '';
    try {
        short = typeof window.getLAFFTeamShortName === 'function' ? window.getLAFFTeamShortName(full) : '';
    } catch (e) { short = ''; }
    if (!short || cffNormalizeFilterText(short) === cffNormalizeFilterText(full)) return cffEscapeHTML(full);
    return `<span class="laff-team-name-full">${cffEscapeHTML(full)}</span><span class="laff-team-name-short">${cffEscapeHTML(short)}</span>`;
}

async function cffRenderPlayerLAFFHistoryPanel(playerName, currentTeam = '') {
    let anchor = document.getElementById('pp-historical-editions-breakdown') || document.getElementById('pp-history-summary-box') || document.getElementById('player-overall-card');
    if (!anchor || !anchor.parentNode) return;
    let box = document.getElementById('pp-laff-history-panel');
    if (!box) {
        box = document.createElement('section');
        box.id = 'pp-laff-history-panel';
        box.className = 'pp-laff-history-panel';
        anchor.parentNode.insertBefore(box, anchor.nextSibling);
    }

    const teams = cffGetPlayerRelatedTeams(playerName, currentTeam);
    const data = await cffLoadLAFF2025S1Finals();
    const currentLaff = cffFindLAFFPlayerInfo(playerName);
    const playerRows = (data.players || []).filter(row => cffLAFFPlayerMatches(row.name, playerName));
    playerRows.forEach(row => {
        const cleanTeam = String(row.team || '').trim();
        if (cleanTeam && !teams.some(team => cffTeamMatchesLAFFName(team, cleanTeam))) teams.push(cleanTeam);
    });
    const teamRows = cffGetLAFFStageTeamRows(data, teams);

    if (!teamRows.length && !playerRows.length && !currentLaff) {
        box.innerHTML = '';
        box.style.display = 'none';
        return;
    }

    const currentHtml = currentLaff ? `<div class="pp-laff-row is-current"><strong>LAFF 2026 S1</strong><span>${cffEscapeHTML(currentLaff.team || 'Equipe a confirmar')} · elenco atual</span></div>` : '';
    const playerHtml = playerRows.map(row => `<div class="pp-laff-row is-player">
        <strong>LAFF 2025 S1</strong>
        <span>${cffEscapeHTML(row.name || playerName)} · ${cffEscapeHTML(row.team || 'Equipe não informada')} · ${Number(row.kills || 0)} K · ${Number(row.matches || 0)} quedas</span>
    </div>`).join('');
    const rowsHtml = teamRows.map(row => `<div class="pp-laff-row">
        <strong>${cffEscapeHTML(row.label || 'LAFF 2025 S1')}</strong>
        <span>${cffEscapeHTML(row.team)} · ${Number(row.points || 0)} PTS · ${Number(row.kills || 0)} K · ${Number(row.booyah || 0)} B! · ${Number(row.matches || 0)} quedas</span>
    </div>`).join('');

    box.style.display = 'block';
    box.innerHTML = `<button type="button" class="btn-action pp-laff-toggle" onclick="cffToggleHistoryBreakdown('pp-laff-history-content', this)">Ver dados LAFF</button>
        <div id="pp-laff-history-content" class="pp-laff-history-content" hidden>
            <div class="pp-laff-history-title">Dados LAFF vinculados ao jogador</div>
            ${currentHtml}${playerHtml}${rowsHtml}
        </div>`;
}

function cffNormalizeRoleLabel(role, compact = false) {
    const raw = String(role || '').trim();
    const n = cffNormalizeFilterText(raw);
    if (!n) return compact ? 'IND' : 'INDEFINIDA';
    if (n.includes('RUSH')) return compact ? 'RSH' : 'RUSH';
    if (n.includes('SUP') || n.includes('SNIPER')) return compact ? 'SUP' : 'SUPORTE';
    if (n.includes('GRAN')) return compact ? 'GRAN' : 'GRANADEIRO';
    return compact ? raw.toUpperCase().slice(0, 4) : raw.toUpperCase();
}

function cffNormalizeRoleCardLabel(role) {
    const raw = String(role || '').trim();
    const n = cffNormalizeFilterText(raw);
    if (!n) return 'IND';
    if (n.includes('GRAN')) return 'GRAN';
    if (n.includes('SUP') || n.includes('SNIPER')) return 'SUP';
    if (n.includes('RUSH')) return 'RUSH';
    return raw.toUpperCase().slice(0, 4);
}


function cffBuildLaffRosterPlayerHero(playerName, teamName, laffInfo = null) {
    const role = cffNormalizeRoleLabel(laffInfo?.funcao || laffInfo?.role || '', false);
    return cffBuildUnifiedPlayerHero({
        playerName,
        teamName,
        status: 'LAFF 2026 S1',
        role,
        variant: 'is-laff-roster'
    });
}


function cffEnsureLAFFTeamHistory(playerName, containerId) {
    const info = cffFindLAFFPlayerInfo(playerName);
    const wrap = document.getElementById(containerId);
    if (!info || !wrap || !String(info.team || '').trim()) return;
    const teamName = String(info.team || '').trim();
    const team = cffFindLAFFTeamInfo(teamName) || {};
    const existingText = cffNormalizeFilterText(wrap.textContent || '');
    if (existingText.includes(cffNormalizeFilterText(teamName))) return;
    // renderHistoricoEquipes já entende LAFF; este fallback só entra se a passagem
    // ainda não apareceu por alguma diferença de alias. Mantém o mesmo visual compacto
    // da linha do tempo tradicional.
    const card = document.createElement('div');
    card.className = 'cff-laff-current-team-history';
    card.innerHTML = `
        <div class="cff-laff-current-label">ATUAL</div>
        <button type="button" class="cff-laff-current-logo" onclick="cffOpenTeamProfileSmart('${String(teamName || '').replace(/'/g, "\'")}')">
            <img src="${cffEscapeHTML(team.logo || 'escudo.webp')}" onerror="this.onerror=null;this.src='escudo.webp'" alt="${cffEscapeHTML(teamName)}">
        </button>
        <span>${cffEscapeHTML(teamName)}</span>`;
    wrap.prepend(card);
}

async function openPlayerProfile(playerName) {
    if (!playerName) return;
    if (typeof cffSetPlayerHash === 'function') cffSetPlayerHash(playerName);
    if (typeof loadTeamAliases === 'function') await loadTeamAliases();
    if (typeof loadNovosTorneios === 'function' && (typeof novosTorneiosLoaded === 'undefined' || !novosTorneiosLoaded)) {
        await loadNovosTorneios();
    }
    if (typeof loadMercado === 'function') {
        try { await loadMercado(); } catch (e) { console.warn('[PlayerProfile] Mercado não carregou antes do perfil:', e); }
    }
    if (typeof cffApplyMercadoDeparturesToCurrentPlayers === 'function') {
        try { cffApplyMercadoDeparturesToCurrentPlayers(); } catch (e) { console.warn('[PlayerProfile] Saídas do Mercado não aplicadas:', e); }
    }
    if (typeof loadPlayerAliases === 'function') {
        try { await loadPlayerAliases(); } catch (e) { console.warn('[PlayerProfile] Aliases de jogadores não carregaram:', e); }
    }
    if (typeof window.loadLAFFData === 'function') {
        try { await window.loadLAFFData(); } catch (e) { console.warn('[PlayerProfile] LAFF 2026 não carregou antes do perfil:', e); }
    }
    if (typeof cffLoadLAFF2025S1Finals === 'function') {
        try { await cffLoadLAFF2025S1Finals(); } catch (e) { console.warn('[PlayerProfile] Histórico LAFF 2025 não carregou:', e); }
    }
    let safeName = playerName.trim();
    // Tenta match exato primeiro, depois via alias/checkNameMatch.
    // Se o jogador veio da LAFF, usa a LAFF como camada de elenco atual para não criar perfil duplicado/sem equipe.
    const laffRosterInfo = cffFindLAFFPlayerInfo(safeName);
    let p = db.players.find(x => x.jogador.trim().toLowerCase() === safeName.toLowerCase())
          || db.players.find(x => checkNameMatch(x.jogador, safeName));

    let isLaffRosterPlayer = !!laffRosterInfo;
    let isInactive = !p && !isLaffRosterPlayer;
    currentPlayerView = p ? p.jogador : safeName;
    let playerMercadoCurrent = (typeof cffGetMercadoCurrentTeam === 'function') ? cffGetMercadoCurrentTeam(currentPlayerView) : null;
    let playerMercadoExit = playerMercadoCurrent ? null : ((typeof cffGetMercadoExitInfo === 'function') ? cffGetMercadoExitInfo(currentPlayerView) : null);

    // --- NOVA LÓGICA DE SELEÇÃO INICIAL ---
    const ppStageSel = document.getElementById('pp-cff-stage-filter');
    if (ppStageSel) ppStageSel.value = 'geral';
    if (typeof currentPpcffStage !== 'undefined') currentPpcffStage = 'geral';
    const initialNotasQuedas = (typeof cffGetStageJogadoresQuedas === 'function') ? cffGetStageJogadoresQuedas('geral') : dbJogadoresQuedas;
    let daysPlayed = [];
    for (let d in (initialNotasQuedas || {})) {
        for (let q in (initialNotasQuedas[d] || {})) {
            if ((initialNotasQuedas[d][q] || []).some(x => checkNameMatch(x.nome, currentPlayerView))) {
                daysPlayed.push(Number(d));
                break;
            }
        }
    }

    // Se ele tiver jogado, seleciona por padrão o maior dia que encontrar
    if (daysPlayed.length > 0) {
        selectedPpcffDays = [String(Math.max(...daysPlayed))];
    } else {
        selectedPpcffDays = [];
    }

    buildDayFilters();

    // 3. Pega o nome oficial do histórico se ele for inativo
let officialName = cffCanonicalPlayerDisplayName(safeName);
    if (isInactive || (isLaffRosterPlayer && !p)) {
        let lbffEntry = Object.keys(lbffData || {}).find(name => cffPlayerNameMatches(name, safeName));
        // Se o lbffData estiver como ITAL0$$, mantém ITALO como nome visual/canônico,
        // mas ainda usa o match por alias para puxar os números históricos.
        if (lbffEntry) officialName = cffCanonicalPlayerDisplayName(lbffEntry);

        // Cria o objeto base com o nome oficial. Para LAFF, já entra com equipe atual da LAFF.
        p = { jogador: officialName, equipe: isLaffRosterPlayer ? (laffRosterInfo.team || "Sem Equipe") : "Sem Equipe", abates: 0, quedas: 0, dano: 0, assists: 0, mvp: 0 };
    }

    // --- CONFIGURAÇÃO VISUAL ---
    // NOTA: Certifique-se de que a função getDisplayName() existe no seu código!
    document.getElementById('pp-name').innerText = typeof getDisplayName === 'function' ? getDisplayName(p.jogador) : p.jogador;

    // Detecta equipe ATUAL pelo registro mais recente nas quedas (resolve transferências)
    let equipeAtual = p.equipe;
    if (!isInactive) {
        let lastDay = -1;
        for (let d in dbJogadoresQuedas) {
            for (let q in dbJogadoresQuedas[d]) {
                let entry = dbJogadoresQuedas[d][q].find(x => checkNameMatch(x.nome, p.jogador));
                if (entry && Number(d) > lastDay) {
                    lastDay = Number(d);
                    equipeAtual = entry.equipe;
                }
            }
        }
    }

    if (isLaffRosterPlayer && laffRosterInfo?.team) {
        equipeAtual = laffRosterInfo.team;
        playerMercadoExit = null;
    }
    if (playerMercadoCurrent?.equipeDestino) {
        equipeAtual = playerMercadoCurrent.equipeDestino;
    } else if (playerMercadoExit) {
        equipeAtual = 'Sem Equipe';
    }

    if (p && equipeAtual) p.equipe = equipeAtual;

    const teamEl = document.getElementById('pp-team');
    if (teamEl) {
        teamEl.innerText = playerMercadoExit ? "SEM EQUIPE" : (isInactive && !playerMercadoCurrent && !isLaffRosterPlayer ? "JOGADOR HISTÓRICO" : equipeAtual);
        teamEl.onclick = (isInactive && !playerMercadoCurrent && !isLaffRosterPlayer || playerMercadoExit) ? null : () => cffOpenTeamProfileSmart(equipeAtual);
        teamEl.style.cursor = (isInactive && !playerMercadoCurrent && !isLaffRosterPlayer || playerMercadoExit) ? "default" : "pointer";
    }

    // --- CÁLCULO HISTÓRICO ---
    let histKills = 0, histQuedas = 0, lastEd = "N/A";

    let playerEntries = Object.entries(lbffData || {}).find(([name]) => cffPlayerNameMatches(name, p.jogador) || cffPlayerNameMatches(name, safeName));

    const wbPlayerEditions = cffMergeCurrentEditionIntoEditions(p.jogador, playerEntries ? playerEntries[1] : {}, p);
    const laffPlayerEditions = cffBuildLAFFPlayerEditionData(p.jogador);
    const mergedPlayerEditions = { ...wbPlayerEditions };
    Object.entries(laffPlayerEditions).forEach(([label, row]) => {
        const current = mergedPlayerEditions[label] || { k: 0, q: 0, team: row.team || '', source: 'laff' };
        current.k = Number(current.k || current.kills || 0) + Number(row.k || row.kills || 0);
        current.q = Number(current.q || current.quedas || current.matches || 0) + Number(row.q || row.quedas || row.matches || 0);
        current.team = current.team || row.team || '';
        current.source = row.source || current.source || 'laff';
        mergedPlayerEditions[label] = current;
    });

    // Soma todas as edições históricas + WB 2026 S1 atual + LAFF, inclusive quando o jogador saiu pelo Mercado.
    const allTotals = cffSumPlayerHistoryEditions(mergedPlayerEditions);
    histKills = allTotals.kills;
    histQuedas = allTotals.matches;

    const editions = (typeof cffSortEditions === 'function')
        ? cffSortEditions(Object.entries(mergedPlayerEditions)).map(([ed]) => ed)
        : Object.keys(mergedPlayerEditions);
    lastEd = editions[editions.length - 1] || lastEd;

    window.__cffPlayerHistoryScopeState = cffBuildPlayerHistoryScopeState(wbPlayerEditions, laffPlayerEditions);
    cffApplyPlayerHistoryScope('all');

    // --- NOVO: LINK PARA CARREIRA COMO STAFF ---
    let isStaff = dbStaff.find(s => checkNameMatch(s.nome, p.jogador));
    let staffLinkContainer = document.getElementById('pp-staff-link-container');
    if(staffLinkContainer) {
        const marketExitHtml = playerMercadoCurrent ? `
            <div class="player-market-status-box">
                <strong>Transferência oficial</strong>
                <span>${playerMercadoCurrent.equipeOrigem ? `${cffEscapeHTML(playerMercadoCurrent.equipeOrigem)} → ` : ''}${cffEscapeHTML(playerMercadoCurrent.equipeDestino)}${playerMercadoCurrent.data ? ` · ${cffEscapeHTML(playerMercadoCurrent.data)}` : ''}</span>
            </div>` : (playerMercadoExit ? `
            <div class="player-market-status-box">
                <strong>Sem equipe no momento</strong>
                <span>Saída oficial da ${cffEscapeHTML(playerMercadoExit.equipeOrigem || 'equipe anterior')}${playerMercadoExit.data ? ` · ${cffEscapeHTML(playerMercadoExit.data)}` : ''}</span>
            </div>` : '');
        const staffHtml = isStaff ?
            `<button class="btn-action" onclick="openStaffProfile('${p.jogador}')" style="background: rgba(255, 170, 0, 0.1); border: 1px solid var(--accent); color: var(--accent); font-size: 0.85em; width: 100%; max-width: 400px; margin-bottom: 15px;">Ver Carreira como Coach/Analista 📋</button>` : '';
        staffLinkContainer.innerHTML = marketExitHtml + staffHtml;
    }

    // --- TRATAMENTO PARA JOGADORES INATIVOS ---
    const currentStatsTitle = document.getElementById("pp-current-title");
    const currentStatsGrid = document.getElementById("pp-current-grid");
    const overallCard = document.getElementById('player-overall-card');

    const currentQuedasBox = document.getElementById('pp-quedas')?.closest('div');

    const shouldHideCurrentStats = isInactive || (isLaffRosterPlayer && Number(p.quedas || 0) <= 0);
    if (shouldHideCurrentStats) {
        if(overallCard) {
            overallCard.innerHTML = isLaffRosterPlayer
                ? cffBuildLaffRosterPlayerHero(p.jogador, equipeAtual, laffRosterInfo)
                : cffBuildInactivePlayerHero(p.jogador, lastEd);
        }
        // Esconde estatísticas atuais vazias. Jogador LAFF sem quedas fica ativo, mas sem card de dados zerados.
        if(currentStatsTitle) currentStatsTitle.style.display = "none";
        if(currentStatsGrid) currentStatsGrid.style.display = "none";
        if(currentQuedasBox) currentQuedasBox.style.display = "none";

    } else {
        if(currentStatsTitle) currentStatsTitle.style.display = "block";
        if(currentStatsGrid) currentStatsGrid.style.display = "grid";
        if(currentQuedasBox) currentQuedasBox.style.display = "block";

        document.getElementById('pp-quedas').innerText = p.quedas || 0;
        document.getElementById('pp-tot-kills').innerText = p.abates || 0;
        document.getElementById('pp-avg-kills').innerText = (p.abates / (p.quedas || 1)).toFixed(2);
        document.getElementById('pp-rank-kills').innerText = `#${p.rankKills || 0}`;
        document.getElementById('pp-tot-dmg').innerText = p.dano || 0;
        document.getElementById('pp-avg-dmg').innerText = (p.dano / (p.quedas || 1)).toFixed(0);
        document.getElementById('pp-rank-dmg').innerText = `#${p.rankDmg || 0}`;
        document.getElementById('pp-tot-assists').innerText = p.assists || 0;
        document.getElementById('pp-avg-assists').innerText = (p.assists / (p.quedas || 1)).toFixed(2);
        document.getElementById('pp-rank-assists').innerText = `#${p.rankAssists || 0}`;
        document.getElementById('pp-record').innerText = p.recorde || 0;
        document.getElementById('pp-tot-mvps').innerText = p.mvp || 0;

        renderActivePlayerCard(p);
    }
if (typeof renderPlayerCFFRating === 'function') renderPlayerCFFRating(p.jogador);

    // --- TROFÉUS E HISTÓRICO DE EQUIPES ---
    // NOTA: Certifique-se de que essas duas funções existem no seu JS e os IDs existem no seu HTML!
    if (typeof renderUnifiedTrophies === 'function') renderUnifiedTrophies(p.jogador, 'pp-trophies-container');
    if (typeof renderHistoricoEquipes === 'function') renderHistoricoEquipes(p.jogador, 'pp-team-history-container');
    if (isLaffRosterPlayer) cffEnsureLAFFTeamHistory(p.jogador, 'pp-team-history-container');
    if (typeof renderPlayerHistorySummary === 'function') renderPlayerHistorySummary(p.jogador, { isInactive: (isInactive && !isLaffRosterPlayer) || !!playerMercadoExit, currentTeam: playerMercadoExit ? '' : equipeAtual, lastEdition: lastEd, mercadoExit: playerMercadoExit, mercadoCurrent: playerMercadoCurrent, currentPlayer: p });
    const oldLaffPanel = document.getElementById('pp-laff-history-panel');
    if (oldLaffPanel) { oldLaffPanel.innerHTML = ''; oldLaffPanel.style.display = 'none'; }
    if (typeof renderPlayerTeammatesSection === 'function') renderPlayerTeammatesSection(p.jogador, playerMercadoExit ? '' : equipeAtual, { isInactive: (isInactive && !isLaffRosterPlayer) || !!playerMercadoExit, laffRoster: isLaffRosterPlayer });

    navigate('player-profile');
}


function getPlayerNameSizeClass(name) {
    const len = String(name || '').trim().length;
    if (len >= 13) return 'name-very-long';
    if (len >= 10) return 'name-long';
    return '';
}

function cffNormalizeFilterText(value) {
    return String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim();
}

function cffSameTeamForMvpFilter(a, b) {
    if (!a || !b) return false;
    if (typeof sameTeamName === 'function' && sameTeamName(a, b)) return true;

    const rawA = String(a || '').trim();
    const rawB = String(b || '').trim();
    const canA = (typeof getTeamCanonicalName === 'function') ? getTeamCanonicalName(rawA) : rawA;
    const canB = (typeof getTeamCanonicalName === 'function') ? getTeamCanonicalName(rawB) : rawB;

    const shortMap = (typeof shortNames !== 'undefined' && shortNames) ? shortNames : {};
    const variantsA = [rawA, canA, shortMap[rawA], shortMap[canA]].filter(Boolean).map(cffNormalizeFilterText);
    const variantsB = [rawB, canB, shortMap[rawB], shortMap[canB]].filter(Boolean).map(cffNormalizeFilterText);

    return variantsA.some(x => variantsB.includes(x));
}

function cffFindOfficialPlayerForMvp(name) {
    const raw = String(name || '').trim();
    if (!raw || !Array.isArray(db?.players)) return null;
    return db.players.find(x => x.jogador === raw)
        || db.players.find(x => typeof checkNameMatch === 'function' && checkNameMatch(x.jogador, raw))
        || null;
}

function cffGetPlayerRoleForMvpFilter(name) {
    const raw = String(name || '').trim();
    if (!raw) return 'RUSH';

    if (Array.isArray(playerRoles)) {
        const found = playerRoles.find(r => {
            const n = r?.nome || r?.jogador || r?.player || '';
            return n === raw || (typeof checkNameMatch === 'function' && checkNameMatch(n, raw));
        });
        return (found?.role || found?.funcao || found?.função || 'RUSH');
    }

    if (playerRoles && typeof playerRoles === 'object') {
        if (playerRoles[raw]) return playerRoles[raw];
        const key = Object.keys(playerRoles).find(k => k === raw || (typeof checkNameMatch === 'function' && checkNameMatch(k, raw)));
        if (key) return playerRoles[key];
    }

    const official = cffFindOfficialPlayerForMvp(raw);
    if (official?.jogador && playerRoles?.[official.jogador]) return playerRoles[official.jogador];
    return 'RUSH';
}

function cffNormalizeRoleForMvpFilter(value) {
    if (typeof normalizePlayerRole === 'function') return normalizePlayerRole(value);
    const v = String(value || '').trim().toUpperCase();
    if (v.includes('GRAN')) return 'GRAN';
    if (v.includes('SUP')) return 'SUP';
    if (v.includes('RUSH')) return 'RUSH';
    return v || 'RUSH';
}

function cffGetRawMultiOrSelect(selectId) {
    if (typeof getMultiSelectRawState === 'function') {
        const raw = getMultiSelectRawState(selectId).map(String);
        if (raw.length) return raw;
    }
    const select = document.getElementById(selectId);
    const value = String(select?.value || 'all');
    return value && value !== 'all' ? [value] : [];
}

function renderAllPlayers() {
    const teamValues = cffGetRawMultiOrSelect('filter-team-players');
    const roleValues = cffGetRawMultiOrSelect('filter-role-players').map(cffNormalizeRoleForMvpFilter);

    let rookieSelect = document.getElementById('filter-rookie-players');
    let rookieFilter = rookieSelect ? rookieSelect.value : 'all';

    let tbody = document.querySelector('#table-players tbody');
    if (!tbody) return;

    tbody.innerHTML = Array(6).fill(0).map(() => `<tr class="skeleton-row">
        <td><div class="skeleton-cell" style="width:16px;"></div></td>
        <td><div class="skeleton-cell" style="width:80px;"></div></td>
        <td><div class="skeleton-cell" style="width:22px; height:22px; border-radius:50%; margin:0 auto;"></div></td>
        <td><div class="skeleton-cell" style="width:30px; margin:0 auto;"></div></td>
        <td class="hide-mobile"><div class="skeleton-cell" style="width:40px; margin:0 auto;"></div></td>
        <td class="hide-mobile"><div class="skeleton-cell" style="width:30px; margin:0 auto;"></div></td>
        <td><div class="skeleton-cell" style="width:24px; margin:0 auto;"></div></td>
        <td class="hide-mobile"><div class="skeleton-cell" style="width:24px; margin:0 auto;"></div></td>
    </tr>`).join('');

    setTimeout(() => {
        let stageFilter = (typeof cffGetSelectedMvpStage === 'function') ? cffGetSelectedMvpStage() : 'classificatoria';
        let dataToAggregate = (typeof cffGetPlayerDailyByStage === 'function') ? cffGetPlayerDailyByStage(stageFilter) : db.playerDaily;
        if (selectedPlayerDays.length > 0) dataToAggregate = dataToAggregate.filter(p => selectedPlayerDays.includes(String(p.dia)));

        const noFinalData = stageFilter === 'final' && (!dataToAggregate || dataToAggregate.length === 0);
        if (noFinalData) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:18px;">A final ainda não começou. O ranking será atualizado após as primeiras quedas.</td></tr>';
            return;
        }

        let aggregated = {};
        (dataToAggregate || []).forEach(row => {
            const official = cffFindOfficialPlayerForMvp(row.jogador);
            const canonicalName = official?.jogador || row.jogador;
            const officialTeam = official?.equipe || row.equipe;
            const role = cffGetPlayerRoleForMvpFilter(canonicalName || row.jogador);
            const key = canonicalName || row.jogador;

            if (!aggregated[key]) {
                aggregated[key] = { jogador: canonicalName, equipe: officialTeam, abates: 0, dano: 0, assists: 0, quedas: 0, mvp: 0, role };
            }
            aggregated[key].abates += Number(row.abates) || 0;
            aggregated[key].dano += Number(row.dano) || 0;
            aggregated[key].assists += Number(row.assists) || 0;
            aggregated[key].quedas += Number(row.quedas) || 0;
            aggregated[key].mvp += Number(row.mvp) || 0;
            if (officialTeam) aggregated[key].equipe = officialTeam;
        });

        let data = Object.values(aggregated)
            .filter(p => {
                if (!teamValues.length) return true;
                return teamValues.some(team => cffSameTeamForMvpFilter(p.equipe, team));
            })
            .filter(p => {
                if (!roleValues.length) return true;
                const currentRole = cffNormalizeRoleForMvpFilter(p.role || cffGetPlayerRoleForMvpFilter(p.jogador));
                return roleValues.includes(currentRole);
            })
            .filter(p => {
                if (rookieFilter === 'all') return true;
                return typeof isRookiePlayer === 'function' && isRookiePlayer(p.jogador);
            })
            .filter(p => p.quedas > 0);

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:18px;">Nenhum jogador encontrado para os filtros selecionados.</td></tr>';
            return;
        }

        tbody.innerHTML = data.sort((a,b) => b.abates - a.abates || b.dano - a.dano).map((p, i) => {
            let canonicalName = p.jogador;
            let officialTeam = p.equipe;
            let danoFmt = Math.floor((Number(p.dano) || 0) / 1000) + 'k';
            let danoFull = p.dano >= 1000 ? p.dano.toLocaleString('pt-BR') : p.dano;
            const logoSrc = (typeof getTeamLogoByAliases === 'function') ? getTeamLogoByAliases(officialTeam) : (logos[officialTeam] || 'escudo.webp');
            return `<tr>
                <td style="font-size:0.8em; color:var(--text-muted);">${i+1}</td>
                <td class="player-name-cell"><span class="clickable player-name-link ${getPlayerNameSizeClass(canonicalName)}" onclick="${_safePPAttr(canonicalName)}" title="${canonicalName}">${canonicalName}</span></td>
                <td style="text-align:center;"><img src="${logoSrc}" class="team-logo" alt="${officialTeam}" title="${officialTeam}" style="cursor:pointer; width:22px; height:22px; object-fit:contain;" onclick="openTeamProfile('${String(officialTeam || '').replace(/'/g, "\\'")}')"></td>
                <td style="color:var(--accent); font-weight:bold; font-size:0.9em;">${p.abates}</td>
                <td class="hide-mobile"><span class="hide-on-mobile-text">${danoFull}</span><span class="show-mobile-only">${danoFmt}</span></td>
                <td class="hide-mobile" style="font-size:0.9em;">${p.assists}</td>
                <td style="font-size:0.9em;">${p.quedas}</td>
                <td class="hide-mobile" style="font-size:0.9em;">${p.mvp}</td>
            </tr>`;
        }).join('');
    }, 50);
}

function renderActivePlayerCard(p) {
    const ovr = calculateOverall(p);
    const role = playerRoles[p.jogador] || 'RUSH';
    const category = ovr >= 91 ? 'LENDÁRIO' : (ovr >= 85 ? 'ELITE' : (ovr >= 80 ? 'MUITO BOM' : 'PROFISSIONAL'));
    const stars = ovr >= 91 ? '⭐⭐⭐⭐⭐' : (ovr >= 85 ? '⭐⭐⭐⭐' : (ovr >= 80 ? '⭐⭐⭐' : '⭐⭐'));
    const extraHtml = `
        <div class="cff-player-hero-pro-box">
            <div class="cff-player-hero-pro-kicker">Classificação Pro 2026</div>
            <div class="cff-player-hero-stars">${stars}</div>
            <div class="cff-player-hero-category">${category}</div>
            <div class="cff-player-hero-mini-stats">
                <span><strong>${Number(p.abates || 0)}</strong><small>K</small></span>
                <span><strong>${Number(p.quedas || 0)}</strong><small>Q</small></span>
                <span><strong>${(Number(p.abates || 0) / (Number(p.quedas || 0) || 1)).toFixed(2)}</strong><small>K/Q</small></span>
                <span><strong>${Number(p.mvp || 0)}</strong><small>MVP</small></span>
            </div>
            <p>Performance calculada em tempo real, com o mesmo bloco visual usado para ativos e históricos.</p>
        </div>`;

    const container = document.getElementById('player-overall-card');
    if (!container) return;
    container.innerHTML = cffBuildUnifiedPlayerHero({
        playerName: p.jogador,
        teamName: p.equipe,
        status: 'JOGADOR ATIVO',
        role,
        extraHtml,
        variant: 'is-active'
    });
}


function renderPlayerTrophies(jogador) {
    let colTitles = titlesData.coletivos.filter(t => t.players.some(pl => checkNameMatch(pl, jogador)));
    let indTitles = titlesData.individuais.filter(t => checkNameMatch(t.player, jogador));

    // Atualiza os contadores na tela
    document.getElementById('pp-hist-col').innerText = colTitles.length;
    document.getElementById('pp-hist-ind').innerText = indTitles.length;

    let allTitles = [...colTitles, ...indTitles];

    let trophiesHtml = allTitles.length === 0 ?
        '<div style="color:#888; text-align:center; width:100%; padding:20px;">Nenhum título oficial registrado na base de dados.</div>' :
        allTitles.map(t => {
            let tournamentImg = resolveLeagueLogo(t.event);

            let typeUpper = t.type.toUpperCase();
            let borderClass = 'border-campeao';
            if (typeUpper.includes("MVP")) borderClass = 'border-mvp';
            if (typeUpper.includes("REVELAÇÃO")) borderClass = 'border-revelacao';

            let teamHtml = t.team ? `<div class="trophy-team"><img src="${t.teamImg}"> ${t.team}</div>` : '';

            return `
            <div class="trophy-card ${borderClass}">
                <img src="${tournamentImg}" class="trophy-img" alt="${t.type}">
                <div class="event" style="font-weight:bold; font-size:0.8em; color:#fff;">${t.event}</div>
                <div class="type" style="color:var(--accent); font-size:0.75em; font-weight:bold;">${t.type}</div>
                ${teamHtml}
            </div>`;
        }).join('');

    document.getElementById('pp-trophies-container').innerHTML = trophiesHtml;
}

