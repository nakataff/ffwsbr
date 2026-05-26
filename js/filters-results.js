
function getBRTeamClassificationStatus(rank) {
    const pos = parseInt(rank, 10) || 0;
    if (pos === 1) return { label: 'Grand Finals + Esports World Cup', className: 'br-status-ewc', rowClass: 'br-row-ewc' };
    if (pos <= 12) return { label: 'Grand Finals', className: 'br-status-final', rowClass: 'br-row-final' };
    if (pos <= 14) return { label: 'Eliminado', className: 'br-status-eliminated', rowClass: 'br-row-eliminated' };
    return { label: 'Rebaixado para LAFF', className: 'br-status-relegated', rowClass: 'br-row-relegated' };
}

function refreshBRTeamRankMarkers() {
    const table = document.getElementById('table-teams-full');
    if (!table) return;

    const classes = [
        'br-row-ewc', 'br-row-final', 'br-row-eliminated', 'br-row-relegated',
        'br-status-ewc', 'br-status-final', 'br-status-eliminated', 'br-status-relegated'
    ];

    Array.from(table.querySelectorAll('tbody tr')).forEach((row, index) => {
        const rank = index + 1;
        const status = getBRTeamClassificationStatus(rank);
        const rankCell = row.cells[0];

        row.classList.remove(...classes);
        row.classList.add(status.rowClass);

        if (rankCell) {
            rankCell.classList.remove(...classes);
            rankCell.classList.add('br-rank-marker', status.className);
            rankCell.textContent = `${rank}º`;
            rankCell.title = status.label;
        }
    });
}


let selectedTeamQuedas = new Set();

// --- NOVO SISTEMA DE FILTRO POR QUEDA ---

function getSelectedTeamQuedasArray() {
    return Array.from(selectedTeamQuedas).map(String);
}

function getAvailableTeamQuedas() {
    const daysToCheck = selectedTeamDays.length > 0 ? selectedTeamDays : [];
    const items = [];
    daysToCheck.forEach(d => {
        if (!dbQuedas[d]) return;
        Object.keys(dbQuedas[d]).sort((a, b) => Number(a) - Number(b)).forEach(q => {
            items.push({ value: `${d}-${q}`, day: String(d), drop: String(q), mapa: dbQuedas[d][q].mapa || 'Mapa' });
        });
    });
    return items;
}

function updateQuedaFilterOptions() {
    let container = document.getElementById('queda-filter-container');
    let select = document.getElementById('filter-queda');
    if (!container || !select) return;

    let multi = document.getElementById('filter-queda-multi');
    if (!multi) {
        multi = document.createElement('div');
        multi.id = 'filter-queda-multi';
        multi.className = 'multi-check-filter queda-multi-filter';
        select.insertAdjacentElement('afterend', multi);
    }
    select.style.display = 'none';
    select.value = 'all';

    if (selectedTeamDays.length === 0) {
        container.style.display = 'none';
        selectedTeamQuedas.clear();
        multi.innerHTML = '';
        return;
    }

    const items = getAvailableTeamQuedas();
    const validValues = new Set(items.map(i => i.value));
    selectedTeamQuedas = new Set(Array.from(selectedTeamQuedas).filter(v => validValues.has(v)));

    if (!items.length) {
        container.style.display = 'none';
        multi.innerHTML = '';
        return;
    }

    container.style.display = 'flex';
    const selected = getSelectedTeamQuedasArray();
    const allSelected = selected.length === 0 || selected.length === items.length;
    const label = allSelected
        ? 'Todas as quedas do período'
        : (selected.length === 1 ? '1 queda selecionada' : `${selected.length} quedas selecionadas`);

    multi.innerHTML = `
        <button type="button" class="multi-check-toggle" onclick="toggleTeamQuedaMenu()">${label}</button>
        <div class="multi-check-menu" id="filter-queda-menu" style="display:none;">
            <div class="multi-check-row multi-check-all">
                <label><input type="checkbox" ${allSelected ? 'checked' : ''} onchange="selectAllTeamQuedas()"> Selecionar tudo</label>
            </div>
            ${items.map(item => {
                const checked = allSelected || selectedTeamQuedas.has(item.value) ? 'checked' : '';
                return `<div class="multi-check-row">
                    <label><input type="checkbox" value="${item.value}" ${checked} onchange="toggleTeamQuedaSelection('${item.value}', this.checked)"> Dia ${item.day} - Queda ${item.drop} (${item.mapa})</label>
                    <button type="button" class="multi-check-only" onclick="selectOnlyTeamQueda('${item.value}')">somente</button>
                </div>`;
            }).join('')}
        </div>`;
}

function toggleTeamQuedaMenu() {
    const menu = document.getElementById('filter-queda-menu');
    if (!menu) return;
    const shouldOpen = menu.style.display === 'none' || !menu.style.display;
    document.querySelectorAll('.multi-check-menu').forEach(m => {
        if (m !== menu) m.style.display = 'none';
    });
    menu.style.display = shouldOpen ? 'grid' : 'none';
}

function keepTeamQuedaMenuOpen() {
    const menu = document.getElementById('filter-queda-menu');
    if (menu) menu.style.display = 'grid';
}

function rerenderTeamQuedaFilter() {
    updateQuedaFilterOptions();
    keepTeamQuedaMenuOpen();
    renderFullTeams();
    renderGroupsTables();
}

function selectAllTeamQuedas() {
    selectedTeamQuedas.clear();
    rerenderTeamQuedaFilter();
}

function selectOnlyTeamQueda(value) {
    selectedTeamQuedas = new Set([String(value)]);
    const mapSelect = document.getElementById('filter-team-map');
    if (mapSelect) mapSelect.value = 'all';
    if (window._genericMultiSelectFilters) window._genericMultiSelectFilters['filter-team-map'] = new Set();
    if (typeof buildExtraMultiSelectFilters === 'function') buildExtraMultiSelectFilters();
    rerenderTeamQuedaFilter();
}

function toggleTeamQuedaSelection(value, checked) {
    const items = getAvailableTeamQuedas();
    const allValues = items.map(i => i.value);
    let selected = selectedTeamQuedas.size ? getSelectedTeamQuedasArray() : [...allValues];

    if (checked) {
        if (!selected.includes(String(value))) selected.push(String(value));
    } else {
        selected = selected.filter(v => v !== String(value));
    }

    // Se desmarcar tudo, volta para todas as quedas selecionadas.
    if (selected.length === 0 || selected.length === allValues.length) selectedTeamQuedas.clear();
    else selectedTeamQuedas = new Set(selected);

    const mapSelect = document.getElementById('filter-team-map');
    if (mapSelect) mapSelect.value = 'all';
    if (window._genericMultiSelectFilters) window._genericMultiSelectFilters['filter-team-map'] = new Set();
    if (typeof buildExtraMultiSelectFilters === 'function') buildExtraMultiSelectFilters();
    rerenderTeamQuedaFilter();
}

function onTeamDayFilterChanged() {
    buildDayFilters();
    updateQuedaFilterOptions(); // Atualiza as quedas antes de renderizar
    selectedTeamQuedas.clear(); // Reseta para evitar bugs
    const quedaInput = document.getElementById('filter-queda');
    if (quedaInput) quedaInput.value = 'all';
    renderFullTeams();
    renderGroupsTables();
}

// --- EVENTOS DOS NOVOS FILTROS ---

function onMapFilterChanged() {
    if (typeof buildExtraMultiSelectFilters === 'function') buildExtraMultiSelectFilters();
    // Se escolher um Mapa geral, reseta a Queda específica para evitar bugs de lógica
    let quedaSelect = document.getElementById('filter-queda');
    if (quedaSelect) quedaSelect.value = 'all';
    selectedTeamQuedas.clear();
    updateQuedaFilterOptions();

    renderFullTeams();
    renderGroupsTables();
}

function onQuedaFilterChanged() {
    // Mantido por compatibilidade com o select antigo/oculto.
    let mapSelect = document.getElementById('filter-team-map');
    if (mapSelect) mapSelect.value = 'all';
    if (window._genericMultiSelectFilters) window._genericMultiSelectFilters['filter-team-map'] = new Set();
    if (typeof buildExtraMultiSelectFilters === 'function') buildExtraMultiSelectFilters();

    renderFullTeams();
    renderGroupsTables();
}

function getAggregatedTeams(selectedDays) {
    const selectedQuedas = getSelectedTeamQuedasArray();

    let mapSelect = document.getElementById('filter-team-map');
    let selectedMaps = (typeof getMultiSelectValues === 'function' && mapSelect)
        ? getMultiSelectValues('filter-team-map').map(v => String(v).toLowerCase())
        : (mapSelect && mapSelect.value !== 'all' ? [String(mapSelect.value).toLowerCase()] : []);
    const isAllMapsSelected = !selectedMaps.length || selectedMaps.length === Array.from(mapSelect?.options || []).filter(o => o.value !== 'all').length;

    if (selectedQuedas.length > 0) {
        let teamsData = db.teams.map(t => ({ ...t, pontos: 0, booyah: 0, abates: 0, quedas: 0, posicaoQueda: null, pontosPosicao: 0 }));

        selectedQuedas.forEach(value => {
            let [d, q] = String(value).split('-');
            let matchData = dbQuedas?.[d]?.[q];
            if (!matchData) return;

            matchData.resultados.forEach(res => {
                let tIndex = teamsData.findIndex(t => t.equipe === res.equipe);
                if (tIndex > -1) {
                    let pPos = posPoints[res.posicao] || 0;
                    teamsData[tIndex].pontos += (pPos + res.kills);
                    teamsData[tIndex].abates += res.kills;
                    teamsData[tIndex].booyah += res.booyah;
                    teamsData[tIndex].quedas += 1;
                    teamsData[tIndex].posicaoQueda = res.posicao;
                    teamsData[tIndex].pontosPosicao = pPos;
                }
            });
        });

        return teamsData.map(t => ({ ...t, didNotPlay: t.quedas === 0 }));
    }

    if (!isAllMapsSelected) {
        let daysToCheck = selectedDays.length > 0 ? selectedDays : Object.keys(dbQuedas);
        let teamsData = db.teams.map(t => ({ ...t, pontos: 0, booyah: 0, abates: 0, quedas: 0 }));
        daysToCheck.forEach(d => {
            if (dbQuedas[d]) {
                for (let q in dbQuedas[d]) {
                    let drop = dbQuedas[d][q];
                    if (selectedMaps.includes(String(drop.mapa).toLowerCase())) {
                        drop.resultados.forEach(res => {
                            let tIndex = teamsData.findIndex(t => t.equipe === res.equipe);
                            if (tIndex > -1) {
                                let pPos = posPoints[res.posicao] || 0;
                                teamsData[tIndex].pontos += (pPos + res.kills);
                                teamsData[tIndex].abates += res.kills;
                                teamsData[tIndex].booyah += res.booyah;
                                teamsData[tIndex].quedas += 1;
                            }
                        });
                    }
                }
            }
        });
        return teamsData.map(t => ({ ...t, didNotPlay: t.quedas === 0 }));
    }

    if (selectedDays.length === 0) return db.teams.map(t => ({...t, didNotPlay: false}));
    return db.teams.map(t => {
        let daily = db.teamDaily[t.equipe] || [];
        let filtered = daily.filter(d => selectedDays.includes(String(d.dia)));
        if (filtered.length === 0) return { ...t, pontos: 0, booyah: 0, abates: 0, quedas: 0, didNotPlay: true };

        let stats = filtered.reduce((acc, curr) => {
            acc.pontos += curr.pontos; acc.abates += curr.abates; acc.booyah += curr.booyah; acc.quedas += curr.quedas; // USA AS QUEDAS REAIS
            return acc;
        }, {pontos: 0, abates: 0, booyah: 0, quedas: 0});

        return { ...t, pontos: stats.pontos, abates: stats.abates, booyah: stats.booyah, quedas: stats.quedas, didNotPlay: false };
    });
}

function renderFullTeams() {
    let tableData = getAggregatedTeams(selectedTeamDays);
    if (selectedTeamDays.length > 0) tableData = tableData.filter(t => !t.didNotPlay);

    let mapSelect = document.getElementById('filter-team-map');
    if (typeof buildExtraMultiSelectFilters === 'function') buildExtraMultiSelectFilters();

    let isSingleDrop = getSelectedTeamQuedasArray().length === 1;
    let isMapFilter = mapSelect && typeof getMultiSelectRawState === 'function' ? getMultiSelectRawState('filter-team-map').length > 0 : (mapSelect && mapSelect.value !== 'all');

    // Muda o título da coluna dinamicamente
    let thLast = document.getElementById('th-quedas-colocacao');
    if (thLast) {
        if (isSingleDrop) {
            thLast.innerHTML = '<span class="full-name-desktop">C (Pts) ↕</span><span class="short-name-mobile">C ↕</span>';
            thLast.title = "Colocação (Pontos de Posição)";
        } else {
            thLast.innerHTML = 'Q ↕';
            thLast.title = "Quedas Jogadas";
        }
    }

    // SEMPRE ordena por pontos para garantir o ranking correto do filtro atual
    tableData.sort((a, b) => b.pontos - a.pontos);

    let tbody = document.querySelector('#table-teams-full tbody');

    tbody.innerHTML = tableData.map((t, index) => {
        // CORREÇÃO: Se houver filtro de mapa, queda ou dias, a posição é o index + 1
        // Se estiver em "Todos" (sem nenhum filtro), ele pode usar a posGeral original
        let pos = (selectedTeamDays.length > 0 || isMapFilter || isSingleDrop) ? (index + 1) : t.posGeral;

        let logoSrc = logos[t.equipe] || 'escudo.webp';
        let sName = shortNames[t.equipe] || t.equipe;

        // Define o que aparece na última coluna
        let lastColHtml = isSingleDrop
            ? `<span style="font-weight:bold; color:var(--accent);">${t.posicaoQueda}º</span> <span style="font-size:0.8em; color:var(--text-muted);">(${t.pontosPosicao})</span>`
            : t.quedas;

        const status = getBRTeamClassificationStatus(pos);

        return `<tr class="${status.rowClass}">
            <td class="br-rank-marker ${status.className}" title="${status.label}">${pos}º</td>
            <td class="team-cell">
                <img src="${logoSrc}" class="team-logo team-logo-mobile-full clickable" onclick="openTeamProfile('${t.equipe}')">
                <span class="clickable full-name-desktop" onclick="openTeamProfile('${t.equipe}')">${t.equipe}</span>
                <span class="clickable short-name-mobile" onclick="openTeamProfile('${t.equipe}')">${sName}</span>
            </td>
            <td class="hide-mobile">${t.grupo}</td>
            <td style="color:var(--accent); font-weight:bold">${t.pontos}</td>
            <td class="hide-mobile">${t.booyah}</td>
            <td class="hide-mobile">${t.abates}</td>
            <td>${lastColHtml}</td>
        </tr>`;
    }).join('');

    refreshBRTeamRankMarkers();
}

function renderGroupsTables() {
    let container = document.getElementById('groups-tables-grid');
    let html = '';
    let tableData = getAggregatedTeams(selectedTeamDays);

    let isSingleDrop = getSelectedTeamQuedasArray().length === 1;

    // Header dinâmico para as tabelinhas de grupo
    let lastColHeader = isSingleDrop
        ? '<th style="padding:8px" title="Colocação">C (Pts)</th>'
        : '<th style="padding:8px" title="Quedas Jogadas">Q</th>';

    tableData.sort((a, b) => b.pontos - a.pontos);
    tableData.forEach((t, i) => t.currentPos = i + 1);

    ['A', 'B', 'C', 'D'].forEach(g => {
        let rows = tableData.filter(t => t.grupo === g).map(t => {
            let sName = shortNames[t.equipe] || t.equipe;

            // Coluna final dinâmica
            let lastColHtml = isSingleDrop
                ? `<span style="font-weight:bold; color:var(--accent);">${t.posicaoQueda}º</span> <span style="font-size:0.8em; color:var(--text-muted);">(${t.pontosPosicao})</span>`
                : t.quedas;

            return `<tr>
                        <td style="padding: 6px; color:#aaa; font-weight:bold;">${t.currentPos}º</td>
                        <td style="padding: 6px; font-weight:bold; text-align:left;"><span class="clickable" onclick="openTeamProfile('${t.equipe}')">${sName}</span></td>
                        <td style="padding: 6px; color:var(--accent);">${t.pontos}</td>
                        <td style="padding: 6px;">${t.booyah}</td>
                        <td style="padding: 6px;">${t.abates}</td>
                        <td style="padding: 6px; color:var(--text-muted);">${lastColHtml}</td>
                    </tr>`;
        }).join('');

        html += `<div class="group-table-card">
                    <h3>GRUPO ${g}</h3>
                    <div style="overflow-x:auto;">
                        <table style="font-size:0.9em; margin-bottom:0;">
                            <thead>
                                <tr>
                                    <th style="padding:8px" title="Posição Geral">#</th>
                                    <th style="padding:8px; text-align:left;">TIME</th>
                                    <th style="padding:8px">PTS</th>
                                    <th style="padding:8px" title="Booyahs">B!</th>
                                    <th style="padding:8px">KILLS</th>
                                    ${lastColHeader}
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                 </div>`;
    });

    container.innerHTML = html;
}

function renderHomeGroups() {
    let container = document.getElementById('groups-container');
    let html = '';
    ['A', 'B', 'C', 'D'].forEach(g => {
        let rows = db.teams.filter(t => t.grupo === g).sort((a,b) => b.pontos - a.pontos).map(t => `<li><img src="${logos[t.equipe]||''}" class="team-logo" alt=""><span class="clickable" onclick="openTeamProfile('${t.equipe}')">${t.equipe}</span></li>`).join('');
        html += `<div class="group-card-simple"><div class="group-header-simple">Grupo ${g}</div><ul class="group-list">${rows}</ul></div>`;
    });
    container.innerHTML = html;
}

function renderTeamResults() {
    let tName = currentTeamView;
    let tbody = document.querySelector('#table-team-results tbody');
    let tierFilter = document.getElementById('filter-results-tier').value;

    // Pega o filtro de Ano (se existir)
    let yearFilterEl = document.getElementById('filter-results-year');
    let yearFilter = yearFilterEl ? yearFilterEl.value : 'all';

    let results = (typeof getResultsByTeamAliases === 'function')
        ? getResultsByTeamAliases(tName)
        : (dbResults[tName] || []);

    if (typeof getNovosTorneiosResultsForTeam === 'function') {
        results = [...results, ...getNovosTorneiosResultsForTeam(tName)];
    }

    // Resultado final automático da classificatória atual para times fora do Top 12.
    // Ex.: LOOPS — 13º, VASCO ESPORTS — 15º, ANGELS OUTPLAY — 16º.
    try {
        const currentRank = [...db.teams]
            .filter(t => Number(t.pontos) > 0)
            .sort((a, b) => (Number(b.pontos) || 0) - (Number(a.pontos) || 0) || (Number(b.abates) || 0) - (Number(a.abates) || 0))
            .findIndex(t => String(t.equipe || '').toUpperCase() === String(tName || '').toUpperCase()) + 1;
        const alreadyHasCurrent = results.some(r => String(r.torneio || '').toUpperCase().includes('FFWS BR 2026') || String(r.torneio || '').toUpperCase().includes('WB 2026'));
        if (currentRank > 12 && !alreadyHasCurrent) {
            results.unshift({
                data: '2026-05-24',
                tier: 'A-Tier',
                place: `${currentRank}º`,
                torneio: 'FFWS BR 2026 S1 - Classificatória'
            });
        }
    } catch (error) {
        console.warn('Não foi possível adicionar posição final automática:', error);
    }

    // 1. Aplica o filtro de Tier
    if (tierFilter !== 'all') {
        results = results.filter(r => r.tier === tierFilter);
    }

    // 2. Aplica o filtro de Ano (procura o ano no início da data YYYY-MM-DD)
    if (yearFilter !== 'all') {
        results = results.filter(r => r.data.startsWith(yearFilter));
    }

    // 3. Calcula as Medalhas do que sobrou na lista
    let count1 = 0, count2 = 0, count3 = 0;
    results.forEach(r => {
        if (r.place === "1st" || r.place === "1º") count1++;
        else if (r.place === "2nd" || r.place === "2º") count2++;
        else if (r.place === "3rd" || r.place === "3º") count3++;
    });

    // 4. Atualiza os números no Placar do HTML
    let el1 = document.getElementById('count-1st');
    let el2 = document.getElementById('count-2nd');
    let el3 = document.getElementById('count-3rd');
    if(el1) el1.innerText = count1;
    if(el2) el2.innerText = count2;
    if(el3) el3.innerText = count3;

    // 5. Renderiza a tabela
    if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="color:#aaa; padding:30px; text-align:center;">Nenhum resultado encontrado para este filtro.</td></tr>';
        return;
    }

    // Ordena por data mais recente por padrão. Aceita data completa ou apenas ano.
    const resultDateValue = (value) => {
        const raw = String(value || '');
        if (/^\d{4}$/.test(raw)) return new Date(`${raw}-01-01`).getTime();
        const parsed = new Date(raw).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
    };
    results.sort((a, b) => resultDateValue(b.data) - resultDateValue(a.data));

    tbody.innerHTML = results.map(r => {
        let isSTier = r.tier === 'S-Tier';
        // Cria a regra: é 1º lugar?
        let isFirst = r.place === '1st' || r.place === '1º';

        let rowClass = isSTier ? 'row-tier-s' : '';
        let tierClass = r.tier.toLowerCase().split('-')[0];

        let placeBR = r.place.replace(/st|nd|rd|th/ig, 'º');

        // MUDANÇA AQUI: Agora a cor dourada é EXCLUSIVA do 1º lugar!
        let placeStyle = isFirst ? 'color: #ffd700; text-shadow: 0 0 8px rgba(255,215,0,0.5);' : '';

        const hasTournamentPage = !!findTournamentInDB(r.torneio) || (typeof findNovoTorneioByName === 'function' && !!findNovoTorneioByName(r.torneio)) || !!r.novoTorneioId;
        const torneioSafe = String(r.torneio || '').replace(/'/g, "\\'");
        const novoIdSafe = String(r.novoTorneioId || '').replace(/'/g, "\\'");
        const torneioCell = hasTournamentPage
            ? `<span onclick="${typeof openAnyTournamentPage === 'function' ? `openAnyTournamentPage('${torneioSafe}', '${novoIdSafe}')` : `navigateToTournament('${torneioSafe}')`}" style="cursor:pointer; color: var(--accent); text-decoration: underline; text-decoration-style: dotted;" title="Ver página do torneio">${r.torneio} 🔗</span>`
            : r.torneio;

        return `<tr class="${rowClass}">
            <td style="color: var(--text-muted);">${r.data}</td>
            <td class="tier-${tierClass}">${r.tier}</td>
            <td style="font-weight: bold; font-size: 1.1em; ${placeStyle}">${placeBR}</td>
            <td style="text-align: left; font-weight: ${isSTier ? 'bold' : 'normal'}; ${isSTier ? 'color: #fff;' : ''}">${torneioCell}</td>
        </tr>`;
    }).join('');
}

function renderTeamsDirectory() {
    const container = document.getElementById('teams-directory');
    let html = '';

    // Lista de grupos que queremos exibir
    const grupos = ['A', 'B', 'C', 'D'];

    grupos.forEach(g => {
        // Filtra as equipes do grupo atual e ordena alfabeticamente dentro do grupo
        const equipesDoGrupo = db.teams
            .filter(t => t.grupo === g)
            .sort((a, b) => a.equipe.localeCompare(b.equipe));

        // Adiciona um cabeçalho para o grupo que ocupa a largura total do grid
        html += `
            <div style="grid-column: 1 / -1; margin-top: 20px; padding: 10px; background: rgba(255, 170, 0, 0.1); border-left: 4px solid var(--accent); border-radius: 4px;">
                <h3 style="margin: 0; color: var(--accent);">Grupo ${g}</h3>
            </div>
        `;

        // Adiciona os cards das equipes
        html += equipesDoGrupo.map(t => `
            <div class="team-item-card" onclick="openTeamProfile('${t.equipe}')">
                <img src="${logos[t.equipe]||''}" alt="${t.equipe}">
                <h4>${shortNames[t.equipe] || t.equipe}</h4>
                <span>${t.equipe}</span>
            </div>
        `).join('');
    });

    container.innerHTML = html;
}

function renderSchedule() {
    let container = document.getElementById('schedule-content');
    let html = '';

    // Group schedule by week
    let weeks = {};
    agenda.forEach(a => {
        if(!weeks[a.semana]) weeks[a.semana] = [];
        weeks[a.semana].push(a);
    });

    for(let w in weeks) {
        html += `<div class="schedule-box">
            <div class="schedule-header"><span class="schedule-title">Semana ${w}</span></div>`;
        weeks[w].forEach(match => {
            let groupsHtml = match.grupos.map(g => {
                let teamsInGroup = db.teams.filter(t => t.grupo === g);
                let logosHtml = teamsInGroup.map(t => `<img src="${logos[t.equipe]||''}" class="mini-logo" title="${t.equipe}">`).join('');
                return `<div class="group-logos"><span class="group-label">Grupo ${g}</span>${logosHtml}</div>`;
            }).join(' <span style="font-weight:bold;color:#555;">X</span> ');

            html += `<div class="match-row">
                <div style="min-width: 100px; color: var(--text-muted); font-size: 1.1em;"><strong>${match.data}</strong></div>
                <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">${groupsHtml}</div>
            </div>`;
        });
        html += `</div>`;
    }

    html += `<div class="schedule-box" style="border-left-color: #ffd700; background: linear-gradient(90deg, rgba(255,215,0,0.1) 0%, var(--panel-bg) 100%);">
        <div class="schedule-header" style="border-bottom-color: rgba(255,215,0,0.3);"><span class="schedule-title" style="color: #ffd700; font-size: 1.5em;">🏆 Grand Finals</span></div>
        <div class="schedule-text" style="margin-top:10px;"><strong>30 de Maio:</strong> Dia 1<br><strong>31 de Maio:</strong> Dia 2</div>
    </div>`;

    container.innerHTML = html;
}

let teamChartInstance = null;

// Função auxiliar para calcular em qual posição geral o time terminou em cada dia
function getGeneralPositionUpToDay(targetDay, teamName) {
    let totals = {};
    db.teams.forEach(t => totals[t.equipe] = 0);

    // Soma os pontos de todos os times do Dia 1 até o Dia Alvo
    for (let d = 1; d <= targetDay; d++) {
        for (let equipe in db.teamDaily) {
            let dailyData = db.teamDaily[equipe].find(x => x.dia === d);
            if (dailyData && totals[equipe] !== undefined) {
                totals[equipe] += dailyData.pontos;
            }
        }
    }

    // Faz o ranking e descobre onde o time atual está
    let ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    let pos = ranked.findIndex(x => x[0].toUpperCase() === teamName.toUpperCase()) + 1;
    return pos;
}


function toggleChartSummary(id) {
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.hidden = !panel.hidden;
    const btn = panel.previousElementSibling;
    if (btn && btn.classList.contains('chart-summary-toggle')) {
        btn.textContent = panel.hidden ? 'Ver legenda do gráfico' : 'Ocultar legenda do gráfico';
    }
}

function formatChartSummaryValue(value) {
    if (value === null || value === undefined || value === '') return '-';
    const n = Number(value);
    if (Number.isFinite(n)) return Number.isInteger(n) ? String(n) : n.toFixed(2);
    return String(value);
}

function updateChartSummary(panelId, title, items) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const safe = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const rows = (items || []).filter(item => item && item.label !== undefined);
    if (!rows.length) {
        panel.innerHTML = '<div class="chart-summary-title">Sem dados para resumir</div>';
        return;
    }

    const hasGroups = rows.some(item => Array.isArray(item.children));
    if (hasGroups) {
        panel.innerHTML = `
            <div class="chart-summary-title">${safe(title || 'Resumo do gráfico')}</div>
            <div class="chart-summary-team-grid">
                ${rows.map(group => {
                    const children = (group.children || []).filter(child => child && child.label !== undefined);
                    return `
                        <div class="chart-summary-team-card">
                            <div class="chart-summary-team-name">${safe(group.label)}</div>
                            <div class="chart-summary-team-values">
                                ${children.length ? children.map(child => `
                                    <div class="chart-summary-line">
                                        <span>${safe(child.label)}</span>
                                        <strong>${safe(formatChartSummaryValue(child.value))}${child.suffix ? ` ${safe(child.suffix)}` : ''}</strong>
                                    </div>`).join('') : '<div class="chart-summary-empty">Sem dados</div>'}
                            </div>
                        </div>`;
                }).join('')}
            </div>`;
        return;
    }

    panel.innerHTML = `
        <div class="chart-summary-title">${safe(title || 'Resumo do gráfico')}</div>
        <div class="chart-summary-list">
            ${rows.map(item => `
                <div class="chart-summary-item">
                    <span class="chart-summary-label" title="${safe(item.label)}">${safe(item.label)}</span>
                    <span class="chart-summary-value">${safe(formatChartSummaryValue(item.value))}${item.suffix ? ` ${safe(item.suffix)}` : ''}</span>
                </div>`).join('')}
        </div>`;
}

if (typeof window !== 'undefined') {
    window.toggleChartSummary = toggleChartSummary;
    window.updateChartSummary = updateChartSummary;
}

function renderTeamChart() {
    // --- TRAVA DE SEGURANÇA PARA EQUIPES HISTÓRICAS ---
    let evolutionContainer = document.getElementById('tp-evolution-container');
    if (!evolutionContainer || evolutionContainer.style.display === 'none') return;

    let tName = currentTeamView;
    if (!tName) return;

    let metric = document.getElementById('chart-metric').value;
    let ctx = document.getElementById('team-evolution-chart');
    if (!ctx) return;

    let labels = [];
    let dataset = [];
    let chartLabel = '';
    let isReverse = false; // Se for ranking, 1º fica no topo
    let chartColor = '#00c8ff';

    // Se a equipe não tem dados diários gerados, não faz nada
    if (!db.teamDaily[tName]) return;

    if (metric.includes('dia')) {
        // --- VISÃO POR DIA ---
        let dailyStats = [...db.teamDaily[tName]].sort((a, b) => a.dia - b.dia);

        dailyStats.forEach(d => {
            // Respeita o filtro de dias selecionado lá em cima
            if (selectedTpDays.length > 0 && !selectedTpDays.includes(String(d.dia))) return;

            labels.push(`Dia ${d.dia}`);
            if (metric === 'pontos_dia') {
                dataset.push(d.pontos);
                chartLabel = 'Pontos Conquistados no Dia';
                chartColor = '#ffd700';
            } else if (metric === 'kills_dia') {
                dataset.push(d.abates);
                chartLabel = 'Abates no Dia';
                chartColor = '#ff4444';
            } else if (metric === 'pos_geral_dia') {
                dataset.push(getGeneralPositionUpToDay(d.dia, tName));
                chartLabel = 'Posição na Tabela Geral ao Fim do Dia';
                chartColor = '#00c8ff';
                isReverse = true;
            }
        });
    } else if (metric.includes('queda')) {
        // --- VISÃO POR QUEDA ---
        let dias = Object.keys(dbQuedas).map(Number).sort((a, b) => a - b);

        dias.forEach(d => {
            // Respeita o filtro de dias selecionado lá em cima
            if (selectedTpDays.length > 0 && !selectedTpDays.includes(String(d))) return;

            let quedas = Object.keys(dbQuedas[d]).map(Number).sort((a, b) => a - b);
            quedas.forEach(q => {
                let drop = dbQuedas[d][q];
                let res = drop.resultados.find(r => r.equipe.toUpperCase() === tName.toUpperCase());

                if (res) {
                    labels.push(`D${d}-Q${q}`);
                    if (metric === 'pos_queda') {
                        dataset.push(res.posicao);
                        chartLabel = 'Posição (Sobrevivência)';
                        chartColor = '#4caf50';
                        isReverse = true;
                    } else if (metric === 'kills_queda') {
                        dataset.push(res.kills);
                        chartLabel = 'Abates na Queda';
                        chartColor = '#ff4444';
                    } else if (metric === 'pontos_queda') {
                        let pPos = posPoints[res.posicao] || 0;
                        dataset.push(pPos + res.kills);
                        chartLabel = 'Pontos Finais (Kills + Posição)';
                        chartColor = '#ffd700';
                    }
                }
            });
        });
    }

    // Destroi o gráfico anterior caso ele exista para não sobrepor
    if (typeof teamChartInstance !== 'undefined' && teamChartInstance !== null) {
        teamChartInstance.destroy();
    }

    // Cria o novo gráfico com a paleta de cores do site
    teamChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: chartLabel,
                data: dataset,
                borderColor: chartColor,
                backgroundColor: chartColor + '22', // Deixa um brilho transparente em baixo
                borderWidth: 3,
                pointBackgroundColor: chartColor,
                pointBorderColor: '#000',
                pointRadius: 4,
                pointHoverRadius: 7,
                pointHitRadius: 16,
                clip: false,
                fill: true,
                tension: 0.2 // Deixa a linha suavemente curvada
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 18, right: 10, bottom: 6, left: 10 } },
            scales: {
                y: {
                    reverse: isReverse,
                    min: isReverse ? 0.75 : 0,
                    max: isReverse ? (metric === 'pos_queda' ? 12.25 : undefined) : undefined,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#888', font: { weight: 'bold' } }
                },
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#888', autoSkip: true, maxTicksLimit: 15 }
                }
            },
            plugins: {
                legend: { labels: { color: '#fff', font: { weight: 'bold' } } },
                tooltip: { backgroundColor: '#0d1220', titleColor: chartColor, bodyColor: '#fff', borderColor: '#333', borderWidth: 1 }
            }
        }
    });

    if (typeof updateChartSummary === 'function') {
        updateChartSummary(
            'team-chart-summary',
            chartLabel || 'Resumo do gráfico',
            labels.map((label, index) => ({ label, value: dataset[index] }))
        );
    }
}

