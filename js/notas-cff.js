// Página NOTAS CFF — recordes + ranking filtrável
let cffNotasSortKey = 'nota';
let cffNotasSortDir = 'desc';
let cffSelectedDay = 'all';
let cffSelectedDrops = new Set();
let cffRecordsPage = 0;
let cffRecordCardPages = {};

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


function cffEscapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function cffSafeJsArg(value) {
    return JSON.stringify(String(value ?? ''));
}

function cffRecordBorderColor(index) {
    return index === 0 ? '#ffd700' : (index === 1 ? '#c0c0c0' : (index === 2 ? '#cd7f32' : '#888'));
}

function cffMoveRecordCardPage(cardId, direction) {
    if (!window.cffRecordCardPages) window.cffRecordCardPages = {};
    if (direction === 'reset') window.cffRecordCardPages[cardId] = 0;
    else window.cffRecordCardPages[cardId] = Math.max(0, (window.cffRecordCardPages[cardId] || 0) + Number(direction || 0));
    renderNotasCFFStatsPaged();
}

function cffPagedRecordRows(cardId, sortedAll, rowFn, headerHtml, pageSize = 4) {
    if (!window.cffRecordCardPages) window.cffRecordCardPages = {};

    const totalPages = Math.max(1, Math.ceil(sortedAll.length / pageSize));
    let page = window.cffRecordCardPages[cardId] || 0;
    if (page >= totalPages) page = totalPages - 1;
    if (page < 0) page = 0;
    window.cffRecordCardPages[cardId] = page;

    const start = page * pageSize;
    const end = Math.min(start + pageSize, sortedAll.length);
    const slice = sortedAll.slice(start, end);
    const rows = slice.map((item, i) => rowFn(item, start + i)).join('') || `<div style="color:var(--text-muted); padding:12px 10px; font-size:.85em;">Sem dados suficientes.</div>`;

    const isFirst = page === 0;
    const isLast = page >= totalPages - 1;

    const leftBtn = isFirst
        ? `<button disabled style="background:rgba(255,255,255,0.02); border:1px solid #222; color:#333; border-radius:50%; width:26px; height:26px; cursor:default; font-size:1em; display:flex; align-items:center; justify-content:center;">&#8249;</button>`
        : `<button onclick="event.stopPropagation(); cffMoveRecordCardPage('${cffEscapeAttr(cardId)}', -1)" style="background:rgba(255,255,255,0.07); border:1px solid #333; color:#aaa; border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:1em; display:flex; align-items:center; justify-content:center;">&#8249;</button>`;

    const rightBtn = isLast
        ? `<button onclick="event.stopPropagation(); cffMoveRecordCardPage('${cffEscapeAttr(cardId)}', 'reset')" title="Voltar ao começo" style="background:rgba(255,255,255,0.07); border:1px solid #333; color:var(--accent); border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:.85em; display:flex; align-items:center; justify-content:center;">&#8635;</button>`
        : `<button onclick="event.stopPropagation(); cffMoveRecordCardPage('${cffEscapeAttr(cardId)}', 1)" style="background:rgba(255,255,255,0.07); border:1px solid #333; color:#aaa; border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:1em; display:flex; align-items:center; justify-content:center;">&#8250;</button>`;

    const nav = totalPages > 1 ? `
        <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:10px; padding-top:8px; border-top:1px solid #222;">
            ${leftBtn}
            <span style="font-size:.75em; color:#666;">Top ${start + 1}&#8211;${end}</span>
            ${rightBtn}
        </div>` : '';

    return headerHtml + rows + nav;
}

function renderNotasCFFStatsPaged() {
    const container = document.getElementById('cff-records-grid');
    if (!container) return;

    const oldPager = document.querySelector('.cff-records-pager');
    if (oldPager) oldPager.style.display = 'none';

    let allMatchPerformances = [];
    let playerDailyAggregator = {};
    let playerCareerAggregator = {};

    for (let d in (dbJogadoresQuedas || {})) {
        for (let q in (dbJogadoresQuedas[d] || {})) {
            const dropInfo = (dbQuedas?.[d]?.[q]) ? dbQuedas[d][q] : { mapa: 'Desconhecido', resultados: [] };

            (dbJogadoresQuedas[d][q] || []).forEach(p => {
                let posTime = 12;
                if (dropInfo.resultados) {
                    const teamRes = dropInfo.resultados.find(r => String(r.equipe || '').toUpperCase() === String(p.equipe || '').toUpperCase());
                    if (teamRes) posTime = teamRes.posicao;
                }

                const notaMatch = calculateCFFNota(p.kills || 0, p.dano || 0, p.assists || 0, p.mvp || 0, posTime);

                allMatchPerformances.push({
                    nome: p.nome,
                    equipe: p.equipe,
                    nota: notaMatch,
                    kills: p.kills || 0,
                    dano: p.dano || 0,
                    assists: p.assists || 0,
                    dia: d,
                    queda: q,
                    mapa: dropInfo.mapa || 'Desconhecido'
                });

                const dayKey = `${p.nome}-${d}`;
                if (!playerDailyAggregator[dayKey]) {
                    playerDailyAggregator[dayKey] = { nome: p.nome, equipe: p.equipe, dia: d, quedas: [] };
                }
                playerDailyAggregator[dayKey].quedas.push({ nota: notaMatch, kills: p.kills || 0, dano: p.dano || 0, mvp: p.mvp || 0 });

                if (!playerCareerAggregator[p.nome]) {
                    playerCareerAggregator[p.nome] = { nome: p.nome, equipe: p.equipe, somaNotas: 0, totalQuedas: 0 };
                }
                playerCareerAggregator[p.nome].somaNotas += notaMatch;
                playerCareerAggregator[p.nome].totalQuedas++;
                playerCareerAggregator[p.nome].equipe = p.equipe || playerCareerAggregator[p.nome].equipe;
            });
        }
    }

    const topSingleMatches = allMatchPerformances.sort((a, b) => b.nota - a.nota || b.kills - a.kills || b.dano - a.dano);

    const dailyRatings = Object.values(playerDailyAggregator).map(day => {
        const totalKills = day.quedas.reduce((s, q) => s + q.kills, 0);
        const totalDano  = day.quedas.reduce((s, q) => s + q.dano, 0);
        const totalMvps  = day.quedas.filter(q => q.mvp).length;

        let notaDia;
        if      (totalKills <= 3)  notaDia = 4.0;
        else if (totalKills <= 5)  notaDia = 5.0  + (totalKills - 4)  * 0.40;
        else if (totalKills <= 8)  notaDia = 5.5  + (totalKills - 6)  * 0.25;
        else if (totalKills <= 12) notaDia = 6.5  + (totalKills - 9)  * 0.25;
        else if (totalKills <= 15) notaDia = 7.5  + (totalKills - 13) * 0.20;
        else if (totalKills <= 18) notaDia = 8.0  + (totalKills - 16) * 0.20;
        else if (totalKills <= 21) notaDia = 8.5  + (totalKills - 19) * 0.20;
        else if (totalKills <= 24) notaDia = 9.0  + (totalKills - 22) * 0.15;
        else if (totalKills <= 27) notaDia = 9.4  + (totalKills - 25) * 0.15;
        else if (totalKills <= 30) notaDia = 9.7  + (totalKills - 28) * 0.10;
        else                       notaDia = 10.0;

        if      (totalDano >= 20000) notaDia += 0.2;
        else if (totalDano >= 15000) notaDia += 0.1;
        notaDia += totalMvps * 0.1;

        return {
            nome: day.nome,
            equipe: day.equipe,
            dia: day.dia,
            kills: totalKills,
            dano: totalDano,
            mvp: totalMvps,
            notaFinal: Math.min(notaDia, 10.0)
        };
    }).sort((a, b) => b.notaFinal - a.notaFinal || b.kills - a.kills || b.dano - a.dano);

    const totalQuedasCampeonato = Object.values(dbJogadoresQuedas || {}).reduce((total, rounds) => total + Object.keys(rounds || {}).length, 0);
    const minQuedasMediaGeral = Math.max(1, Math.ceil(totalQuedasCampeonato * 0.30));
    const topAverages = Object.values(playerCareerAggregator)
        .filter(p => p.totalQuedas >= minQuedasMediaGeral)
        .map(p => ({ nome: p.nome, equipe: p.equipe, media: p.somaNotas / p.totalQuedas, quedas: p.totalQuedas }))
        .sort((a, b) => b.media - a.media || b.quedas - a.quedas);

    const rowHtml = (p, valor, infoExtra, globalIdx) => {
        const notaVal = Number(valor || 0).toFixed(1);
        const badgeClass = getCFFBadgeColor(notaVal);
        const player = cffEscapeHTML(p.nome);
        const team = cffEscapeHTML((typeof shortNames !== 'undefined' && shortNames[p.equipe]) ? shortNames[p.equipe] : p.equipe);
        const playerClick = `openPlayerProfile(${cffSafeJsArg(p.nome)})`;
        return `
            <div style="display:grid; grid-template-columns:1fr auto; align-items:center; margin-bottom:6px; padding:8px 10px; background:rgba(255,255,255,0.02); border-radius:4px; border-left:3px solid ${cffRecordBorderColor(globalIdx)}; font-size:.85em;">
                <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <span style="font-weight:bold; color:#555; margin-right:4px;">${globalIdx + 1}º</span>
                    <span class="clickable" onclick='${playerClick}' style="color:#fff; font-weight:bold;" title="${player}">${player}</span>
                    <div style="font-size:.75em; color:#888; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${team} • ${cffEscapeHTML(infoExtra)}</div>
                </div>
                <span class="cff-badge ${badgeClass}" style="min-width:35px; font-size:.85em;">${notaVal}</span>
            </div>`;
    };

    const header = (left, right) => `<div style="display:grid; grid-template-columns:1fr auto; padding:0 10px 8px 10px; font-size:.7em; color:#666; font-weight:bold; text-transform:uppercase; letter-spacing:1px;"><div>${left}</div><div style="text-align:right;">${right}</div></div>`;

    const card = (title, inner) => `
        <div class="card">
            <div class="card-top-border"></div>
            <h3>${title}</h3>
            ${inner}
        </div>`;

    container.innerHTML = `
        ${card('Top Quedas', cffPagedRecordRows(
            'cff-top-quedas',
            topSingleMatches,
            (p, idx) => rowHtml(p, p.nota, `Dia ${p.dia} • Q${p.queda} • ${p.mapa} • ${p.kills} K`, idx),
            header('Jogador / Queda', 'Nota'),
            4
        ))}
        ${card('Top Dias', cffPagedRecordRows(
            'cff-top-dias',
            dailyRatings,
            (p, idx) => rowHtml(p, p.notaFinal, `Dia ${p.dia} • ${p.kills} K • ${p.mvp} MVP`, idx),
            header('Jogador / Dia', 'Nota'),
            4
        ))}
        ${card('Médias Gerais', cffPagedRecordRows(
            'cff-medias-gerais',
            topAverages,
            (p, idx) => rowHtml(p, p.media, `${p.quedas} quedas • mínimo ${minQuedasMediaGeral} (30%)`, idx),
            header('Jogador / Recorte', 'Média'),
            4
        ))}
    `;
}

function renderNotasCFFPage() {
    renderNotasCFFStatsPaged();
    cffInitRecordsPager();
    cffPopulateNotasFilters();
    renderNotasCFFRanking();
}

function cffInitRecordsPager() {
    // O pager antigo da seção inteira fica escondido.
    // Agora cada card de recorde tem sua própria paginação, igual aos cards de Estatísticas Gerais.
    const oldPager = document.querySelector('.cff-records-pager');
    if (oldPager) oldPager.style.display = 'none';
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

