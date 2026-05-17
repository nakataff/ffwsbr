// Página NOTAS CFF — recordes + ranking filtrável
let cffNotasSortKey = 'nota';
let cffNotasSortDir = 'desc';
let cffSelectedDay = 'all';
let cffSelectedDrops = new Set();
let cffRecordsPage = 0;

function cffSlugifyPlayerName(name) {
    return String(name || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .trim();
}

function cffFindPlayerBySlug(slug) {
    const target = cffSlugifyPlayerName(slug);
    if (!target) return null;
    const names = new Set();

    if (typeof db !== 'undefined' && Array.isArray(db.players)) db.players.forEach(p => names.add(p.jogador));
    if (typeof dbJogadoresQuedas !== 'undefined' && dbJogadoresQuedas) {
        Object.values(dbJogadoresQuedas).forEach(rounds => {
            Object.values(rounds || {}).forEach(players => (players || []).forEach(p => names.add(p.nome)));
        });
    }
    if (typeof lbffData !== 'undefined' && lbffData) Object.keys(lbffData).forEach(name => names.add(name));
    if (typeof playerAliasesMap !== 'undefined' && playerAliasesMap) {
        Object.entries(playerAliasesMap).forEach(([alias, canonical]) => { names.add(alias); names.add(canonical); });
    }

    for (const name of names) {
        if (cffSlugifyPlayerName(name) === target) return name;
        if (typeof getPlayerAliasList === 'function') {
            const aliases = getPlayerAliasList(name) || [];
            if (aliases.some(alias => cffSlugifyPlayerName(alias) === target)) return name;
        }
    }
    return null;
}

function cffSetPlayerHash(playerName) {
    const slug = cffSlugifyPlayerName(playerName);
    if (slug) history.replaceState(null, '', '#' + slug);
}

function cffResolveHashRoute(hash) {
    const clean = String(hash || '').replace(/^#/, '').trim();
    if (!clean) return false;
    if (document.getElementById(clean)) return false;
    const playerName = cffFindPlayerBySlug(clean);
    if (playerName && typeof openPlayerProfile === 'function') {
        openPlayerProfile(playerName);
        return true;
    }
    return false;
}

function openNotasCFFInfoModal() {
    const modal = document.getElementById('cff-info-modal');
    if (modal) modal.style.display = 'flex';
}

function closeNotasCFFInfoModal() {
    const modal = document.getElementById('cff-info-modal');
    if (modal) modal.style.display = 'none';
}

function cffGetSelectedDay() { return cffSelectedDay || 'all'; }

function cffGetSelectedDrops() {
    return Array.from(cffSelectedDrops).map(String);
}

function cffGetRole(playerName) {
    if (typeof playerRoles !== 'undefined' && playerRoles) {
        if (playerRoles[playerName]) return playerRoles[playerName];
        const found = Object.keys(playerRoles).find(name => typeof checkNameMatch === 'function' ? checkNameMatch(name, playerName) : name.toLowerCase() === String(playerName).toLowerCase());
        if (found) return playerRoles[found];
    }
    return 'RUSH';
}

function cffGetConfrontoByDay(day) {
    const d = String(day);
    if (typeof mapConfrontos !== 'undefined') {
        for (const [conf, days] of Object.entries(mapConfrontos)) {
            if ((days || []).map(String).includes(d)) return conf;
        }
    }
    return '';
}

function cffTeamPosition(day, drop, team) {
    const resultados = dbQuedas?.[day]?.[drop]?.resultados || [];
    const found = resultados.find(r => String(r.equipe || '').toUpperCase() === String(team || '').toUpperCase());
    return found ? found.posicao : 12;
}

function cffEscapeAttr(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cffCollectNotaRows() {
    const dayFilter = cffGetSelectedDay();
    const selectedDrops = cffGetSelectedDrops();
    const mapFilter = document.getElementById('cff-filter-map')?.value || 'all';
    const teamFilter = document.getElementById('cff-filter-team')?.value || 'all';
    const roleFilter = document.getElementById('cff-filter-role')?.value || 'all';
    const confFilter = document.getElementById('cff-filter-conf')?.value || 'all';
    const rookieFilter = document.getElementById('cff-filter-rookie')?.value || 'all';

    const aggregateByPlayer = selectedDrops.length !== 1;
    const aggregated = {};
    const rows = [];

    Object.keys(dbJogadoresQuedas || {}).sort((a, b) => Number(a) - Number(b)).forEach(day => {
        if (dayFilter !== 'all' && String(day) !== String(dayFilter)) return;
        if (confFilter !== 'all' && cffGetConfrontoByDay(day) !== confFilter) return;

        Object.keys(dbJogadoresQuedas[day] || {}).sort((a, b) => Number(a) - Number(b)).forEach(drop => {
            if (dayFilter !== 'all' && selectedDrops.length && !selectedDrops.includes(String(drop))) return;
            const dropInfo = dbQuedas?.[day]?.[drop] || { mapa: 'Desconhecido', resultados: [] };
            const normalizedMap = typeof normalizeMapName === 'function' ? normalizeMapName(dropInfo.mapa) : String(dropInfo.mapa || '').toLowerCase();
            if (mapFilter !== 'all' && normalizedMap !== normalizeMapName(mapFilter)) return;

            (dbJogadoresQuedas[day][drop] || []).forEach(p => {
                if (teamFilter !== 'all' && String(p.equipe || '').toUpperCase() !== String(teamFilter).toUpperCase()) return;
                const role = cffGetRole(p.nome);
                if (roleFilter !== 'all' && String(role).toUpperCase() !== String(roleFilter).toUpperCase()) return;
                if (rookieFilter === 'rookies' && !(typeof isRookiePlayer === 'function' && isRookiePlayer(p.nome))) return;

                const posTime = cffTeamPosition(day, drop, p.equipe);
                const nota = calculateCFFNota(p.kills || 0, p.dano || 0, p.assists || 0, p.mvp || 0, posTime);
                const row = {
                    jogador: p.nome,
                    equipe: p.equipe,
                    role,
                    dia: day,
                    queda: drop,
                    mapa: dropInfo.mapa || 'Desconhecido',
                    confronto: cffGetConfrontoByDay(day),
                    nota,
                    kills: p.kills || 0,
                    assists: p.assists || 0,
                    dano: p.dano || 0,
                    quedas: 1
                };

                if (!aggregateByPlayer) {
                    rows.push(row);
                    return;
                }

                const key = p.nome;
                if (!aggregated[key]) {
                    aggregated[key] = { ...row, somaNota: 0, melhorNota: 0, kills: 0, assists: 0, dano: 0, quedas: 0, detalhes: [] };
                }
                aggregated[key].somaNota += nota;
                aggregated[key].melhorNota = Math.max(aggregated[key].melhorNota, nota);
                aggregated[key].kills += row.kills;
                aggregated[key].assists += row.assists;
                aggregated[key].dano += row.dano;
                aggregated[key].quedas += 1;
                aggregated[key].detalhes.push(row);
            });
        });
    });

    if (!aggregateByPlayer) return rows;

    return Object.values(aggregated).map(p => ({
        ...p,
        nota: p.quedas ? Number((p.somaNota / p.quedas).toFixed(1)) : 0,
        dia: dayFilter === 'all' ? 'Todos' : dayFilter,
        queda: selectedDrops.length ? selectedDrops.join(', ') : 'Todas',
        mapa: mapFilter === 'all' ? 'Todos' : mapFilter,
        confronto: confFilter === 'all' ? 'Todos' : confFilter
    }));
}

function cffPopulateNotasFilters() {
    cffRenderDayButtons();
    cffRenderDropFilter();

    const teamSel = document.getElementById('cff-filter-team');
    if (!teamSel) return;
    const currentTeam = teamSel.value || 'all';
    const teams = new Set();
    Object.values(dbJogadoresQuedas || {}).forEach(rounds => Object.values(rounds || {}).forEach(players => (players || []).forEach(p => teams.add(p.equipe))));
    teamSel.innerHTML = '<option value="all">Todas</option>' + Array.from(teams).sort().map(t => `<option value="${cffEscapeAttr(t)}">${(typeof shortNames !== 'undefined' && shortNames[t]) ? shortNames[t] : t}</option>`).join('');
    teamSel.value = teams.has(currentTeam) ? currentTeam : 'all';
}

function cffRenderDayButtons() {
    const box = document.getElementById('cff-day-buttons');
    if (!box) return;
    const days = Object.keys(dbJogadoresQuedas || {}).sort((a, b) => Number(a) - Number(b));
    const buttons = [`<button type="button" class="${cffSelectedDay === 'all' ? 'active' : ''}" onclick="cffSelectDay('all')">Todos</button>`]
        .concat(days.map(d => `<button type="button" class="${String(cffSelectedDay) === String(d) ? 'active' : ''}" onclick="cffSelectDay('${cffEscapeAttr(d)}')">Dia ${d}</button>`));
    box.innerHTML = buttons.join('');
}

function cffSelectDay(day) {
    cffSelectedDay = String(day || 'all');
    cffSelectedDrops.clear();
    cffRenderDayButtons();
    cffRenderDropFilter();
    renderNotasCFFRanking();
}

function cffRenderDropFilter() {
    const wrap = document.getElementById('cff-drop-filter-wrap');
    const menu = document.getElementById('cff-drop-menu');
    const btn = document.querySelector('.cff-drop-toggle');
    if (!wrap || !menu || !btn) return;

    if (cffSelectedDay === 'all') {
        wrap.style.display = 'none';
        menu.style.display = 'none';
        cffSelectedDrops.clear();
        return;
    }

    wrap.style.display = 'block';
    const drops = Object.keys(dbJogadoresQuedas?.[cffSelectedDay] || {}).sort((a, b) => Number(a) - Number(b));
    if (!cffSelectedDrops.size) btn.textContent = 'Todas as quedas';
    else btn.textContent = cffSelectedDrops.size === 1 ? `1 queda selecionada` : `${cffSelectedDrops.size} quedas selecionadas`;

    menu.innerHTML = drops.map(q => {
        const mapa = dbQuedas?.[cffSelectedDay]?.[q]?.mapa || 'Mapa';
        const checked = cffSelectedDrops.has(String(q)) ? 'checked' : '';
        return `<label><input type="checkbox" value="${cffEscapeAttr(q)}" ${checked} onchange="cffToggleDropSelection(this)"> Queda ${q} (${mapa})</label>`;
    }).join('');
}

function cffToggleDropFilter() {
    const menu = document.getElementById('cff-drop-menu');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'grid' : 'none';
}

function cffToggleDropSelection(input) {
    const value = String(input.value);
    if (input.checked) cffSelectedDrops.add(value);
    else cffSelectedDrops.delete(value);
    cffRenderDropFilter();
    const menu = document.getElementById('cff-drop-menu');
    if (menu) menu.style.display = 'grid';
    renderNotasCFFRanking();
}

function renderNotasCFFPage() {
    if (typeof renderCFFStats === 'function') renderCFFStats();
    cffInitRecordsPager();
    cffPopulateNotasFilters();
    renderNotasCFFRanking();
}

function cffInitRecordsPager() {
    cffRecordsPage = 0;
    cffUpdateRecordsPager();
}

function cffMoveRecordsPage(direction) {
    const cards = Array.from(document.querySelectorAll('#cff-records-grid > .card'));
    if (!cards.length) return;
    const perPage = 4;
    const totalPages = Math.max(1, Math.ceil(cards.length / perPage));
    cffRecordsPage = (cffRecordsPage + direction + totalPages) % totalPages;
    cffUpdateRecordsPager();
}

function cffUpdateRecordsPager() {
    const cards = Array.from(document.querySelectorAll('#cff-records-grid > .card'));
    const label = document.getElementById('cff-records-page-label');
    if (!cards.length) return;

    const perPage = 4;
    const totalPages = Math.max(1, Math.ceil(cards.length / perPage));
    if (cffRecordsPage >= totalPages) cffRecordsPage = 0;

    const start = cffRecordsPage * perPage;
    const end = Math.min(start + perPage, cards.length);
    cards.forEach((card, index) => {
        card.style.display = (index >= start && index < end) ? 'block' : 'none';
    });

    if (label) label.textContent = `Recordes ${start + 1}–${end}`;
}

function cffCompareRows(a, b) {
    const key = cffNotasSortKey || 'nota';
    let diff = 0;

    if (key === 'jogador' || key === 'equipe') {
        diff = String(a[key] || '').localeCompare(String(b[key] || ''), 'pt-BR', { sensitivity: 'base' });
    } else if (key === 'rank') {
        diff = 0;
    } else {
        diff = (Number(a[key]) || 0) - (Number(b[key]) || 0);
    }

    if (!diff) diff = (Number(a.nota) || 0) - (Number(b.nota) || 0);
    if (!diff) diff = (Number(a.kills) || 0) - (Number(b.kills) || 0);
    if (!diff) diff = (Number(a.dano) || 0) - (Number(b.dano) || 0);

    return cffNotasSortDir === 'desc' ? -diff : diff;
}

function cffUpdateSortIcons() {
    document.querySelectorAll('[data-sort-icon]').forEach(icon => {
        const key = icon.getAttribute('data-sort-icon');
        icon.textContent = key === cffNotasSortKey ? (cffNotasSortDir === 'desc' ? '↓' : '↑') : '';
    });
}

function setNotasCFFSort(key) {
    if (key === 'rank') key = 'nota';
    if (cffNotasSortKey === key) {
        cffNotasSortDir = cffNotasSortDir === 'desc' ? 'asc' : 'desc';
    } else {
        cffNotasSortKey = key;
        cffNotasSortDir = (key === 'jogador' || key === 'equipe') ? 'asc' : 'desc';
    }
    renderNotasCFFRanking();
}

function renderNotasCFFRanking() {
    const tbody = document.querySelector('#table-notas-cff tbody');
    const counter = document.getElementById('cff-ranking-count');
    if (!tbody) return;

    const rows = cffCollectNotaRows().sort(cffCompareRows);

    if (counter) counter.textContent = `${rows.length}`;
    cffUpdateSortIcons();

    tbody.innerHTML = rows.map((p, index) => {
        const badgeClass = getCFFBadgeColor(p.nota);
        const teamLogo = (typeof getTeamLogoByAliases === 'function') ? getTeamLogoByAliases(p.equipe) : ((typeof logos !== 'undefined' && logos[p.equipe]) ? logos[p.equipe] : 'escudo.webp');
        const danoMobile = p.dano >= 1000 ? `${Math.floor(p.dano / 1000)}k` : p.dano;
        const detalhe = p.queda === 'Todas'
            ? `${p.quedas} queda${p.quedas === 1 ? '' : 's'} filtrada${p.quedas === 1 ? '' : 's'}`
            : `Dia ${p.dia} • Q${p.queda} • ${p.mapa}`;
        const playerName = cffEscapeAttr(String(p.jogador).replace(/'/g, "\\'"));
        const teamName = cffEscapeAttr(String(p.equipe).replace(/'/g, "\\'"));
        return `<tr>
            <td style="color:var(--accent); font-weight:800;">${index + 1}º</td>
            <td style="text-align:left; min-width: 128px;">
                <span class="clickable player-name-link" onclick="openPlayerProfile('${playerName}')">${p.jogador}</span>
                <div class="cff-mobile-detail">${detalhe}</div>
            </td>
            <td><img src="${teamLogo}" class="team-logo" alt="${p.equipe}" title="${p.equipe}" onclick="openTeamProfile('${teamName}')"></td>
            <td><span class="cff-badge ${badgeClass}">${Number(p.nota).toFixed(1)}</span></td>
            <td style="font-weight:800; color:#fff;">${p.kills}</td>
            <td>${p.assists}</td>
            <td><span class="hide-on-mobile-text">${p.dano.toLocaleString('pt-BR')}</span><span class="show-mobile-only">${danoMobile}</span></td>
            <td>${p.quedas}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="8" style="padding: 22px; color: var(--text-muted);">Nenhum registro encontrado com esses filtros.</td></tr>`;
}

