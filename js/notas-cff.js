// Página NOTAS CFF — recordes + ranking filtrável
let cffNotasSortDir = 'desc';

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

    if (typeof db !== 'undefined' && Array.isArray(db.players)) {
        db.players.forEach(p => names.add(p.jogador));
    }
    if (typeof dbJogadoresQuedas !== 'undefined' && dbJogadoresQuedas) {
        Object.values(dbJogadoresQuedas).forEach(rounds => {
            Object.values(rounds || {}).forEach(players => {
                (players || []).forEach(p => names.add(p.nome));
            });
        });
    }
    if (typeof lbffData !== 'undefined' && lbffData) {
        Object.keys(lbffData).forEach(name => names.add(name));
    }
    if (typeof playerAliasesMap !== 'undefined' && playerAliasesMap) {
        Object.entries(playerAliasesMap).forEach(([alias, canonical]) => {
            names.add(alias);
            names.add(canonical);
        });
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

function cffGetSelectedDay() {
    return document.getElementById('cff-filter-day')?.value || 'all';
}

function cffGetSelectedDrop() {
    return document.getElementById('cff-filter-queda')?.value || 'all';
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

function cffCollectNotaRows() {
    const dayFilter = cffGetSelectedDay();
    const dropFilter = cffGetSelectedDrop();
    const mapFilter = document.getElementById('cff-filter-map')?.value || 'all';
    const teamFilter = document.getElementById('cff-filter-team')?.value || 'all';
    const roleFilter = document.getElementById('cff-filter-role')?.value || 'all';
    const confFilter = document.getElementById('cff-filter-conf')?.value || 'all';
    const rookieFilter = document.getElementById('cff-filter-rookie')?.value || 'all';

    const aggregateByPlayer = dropFilter === 'all';
    const aggregated = {};
    const rows = [];

    Object.keys(dbJogadoresQuedas || {}).sort((a, b) => Number(a) - Number(b)).forEach(day => {
        if (dayFilter !== 'all' && String(day) !== String(dayFilter)) return;
        if (confFilter !== 'all' && cffGetConfrontoByDay(day) !== confFilter) return;

        Object.keys(dbJogadoresQuedas[day] || {}).sort((a, b) => Number(a) - Number(b)).forEach(drop => {
            if (dropFilter !== 'all' && String(drop) !== String(dropFilter)) return;
            const dropInfo = dbQuedas?.[day]?.[drop] || { mapa: 'Desconhecido', resultados: [] };
            const mapName = typeof normalizeMapName === 'function' ? normalizeMapName(dropInfo.mapa) : String(dropInfo.mapa || '').toLowerCase();
            if (mapFilter !== 'all' && mapName !== normalizeMapName(mapFilter)) return;

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
        dia: cffGetSelectedDay() === 'all' ? 'Todos' : cffGetSelectedDay(),
        queda: 'Todas',
        mapa: mapFilter === 'all' ? 'Todos' : mapFilter,
        confronto: confFilter === 'all' ? 'Todos' : confFilter
    }));
}

function cffPopulateNotasFilters() {
    const daySel = document.getElementById('cff-filter-day');
    const dropSel = document.getElementById('cff-filter-queda');
    const teamSel = document.getElementById('cff-filter-team');
    if (!daySel || !dropSel || !teamSel) return;

    const currentDay = daySel.value || 'all';
    const currentDrop = dropSel.value || 'all';
    const days = Object.keys(dbJogadoresQuedas || {}).sort((a, b) => Number(a) - Number(b));
    daySel.innerHTML = '<option value="all">Todos os dias</option>' + days.map(d => `<option value="${d}">Dia ${d}</option>`).join('');
    daySel.value = days.includes(currentDay) ? currentDay : 'all';

    const dropsSet = new Set();
    const daysToRead = daySel.value === 'all' ? days : [daySel.value];
    daysToRead.forEach(d => Object.keys(dbJogadoresQuedas?.[d] || {}).forEach(q => dropsSet.add(String(q))));
    const drops = Array.from(dropsSet).sort((a, b) => Number(a) - Number(b));
    dropSel.innerHTML = '<option value="all">Todas as quedas</option>' + drops.map(q => `<option value="${q}">Queda ${q}</option>`).join('');
    dropSel.value = drops.includes(currentDrop) ? currentDrop : 'all';

    const currentTeam = teamSel.value || 'all';
    const teams = new Set();
    Object.values(dbJogadoresQuedas || {}).forEach(rounds => Object.values(rounds || {}).forEach(players => (players || []).forEach(p => teams.add(p.equipe))));
    teamSel.innerHTML = '<option value="all">Todos os times</option>' + Array.from(teams).sort().map(t => `<option value="${t}">${(typeof shortNames !== 'undefined' && shortNames[t]) ? shortNames[t] : t}</option>`).join('');
    teamSel.value = teams.has(currentTeam) ? currentTeam : 'all';
}

function renderNotasCFFPage() {
    if (typeof renderCFFStats === 'function') renderCFFStats();
    cffPopulateNotasFilters();
    renderNotasCFFRanking();
}

function renderNotasCFFRanking() {
    const tbody = document.querySelector('#table-notas-cff tbody');
    const counter = document.getElementById('cff-ranking-count');
    if (!tbody) return;

    const rows = cffCollectNotaRows().sort((a, b) => {
        const diff = (b.nota - a.nota) || (b.kills - a.kills) || (b.dano - a.dano);
        return cffNotasSortDir === 'desc' ? diff : -diff;
    });

    if (counter) counter.textContent = `${rows.length} registro${rows.length === 1 ? '' : 's'}`;

    tbody.innerHTML = rows.map((p, index) => {
        const badgeClass = getCFFBadgeColor(p.nota);
        const teamLogo = (typeof getTeamLogoByAliases === 'function') ? getTeamLogoByAliases(p.equipe) : ((typeof logos !== 'undefined' && logos[p.equipe]) ? logos[p.equipe] : 'escudo.webp');
        const danoMobile = p.dano >= 1000 ? `${Math.floor(p.dano / 1000)}k` : p.dano;
        const detalhe = p.queda === 'Todas'
            ? `${p.quedas} queda${p.quedas === 1 ? '' : 's'} filtrada${p.quedas === 1 ? '' : 's'}`
            : `Dia ${p.dia} • Q${p.queda} • ${p.mapa}`;
        return `<tr>
            <td style="color:var(--accent); font-weight:800;">${index + 1}º</td>
            <td style="text-align:left; min-width: 128px;">
                <span class="clickable player-name-link" onclick="openPlayerProfile('${String(p.jogador).replace(/'/g, "\\'")}')">${p.jogador}</span>
                <div class="cff-mobile-detail">${detalhe}</div>
            </td>
            <td class="hide-mobile"><img src="${teamLogo}" class="team-logo" alt="${p.equipe}" title="${p.equipe}" onclick="openTeamProfile('${String(p.equipe).replace(/'/g, "\\'")}')"></td>
            <td><span class="cff-badge ${badgeClass}">${Number(p.nota).toFixed(1)}</span></td>
            <td style="font-weight:800; color:#fff;">${p.kills}</td>
            <td class="hide-mobile">${p.assists}</td>
            <td><span class="hide-on-mobile-text">${p.dano.toLocaleString('pt-BR')}</span><span class="show-mobile-only">${danoMobile}</span></td>
            <td>${p.quedas}</td>
            <td class="hide-mobile">${p.role}</td>
            <td class="hide-mobile">${p.dia}</td>
            <td class="hide-mobile">${p.queda}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="11" style="padding: 22px; color: var(--text-muted);">Nenhum registro encontrado com esses filtros.</td></tr>`;
}

function onNotasCFFDayChanged() {
    cffPopulateNotasFilters();
    renderNotasCFFRanking();
}

function toggleNotasCFFSort() {
    cffNotasSortDir = cffNotasSortDir === 'desc' ? 'asc' : 'desc';
    const btn = document.getElementById('cff-sort-btn');
    if (btn) btn.textContent = cffNotasSortDir === 'desc' ? 'Maior para menor' : 'Menor para maior';
    renderNotasCFFRanking();
}
