// =============================================
// VOTAÇÃO DO CAMPEÃO - HOME
// =============================================
let dayVoteMatchKey = null;
let dayVoteTeams = [];
let dayVoteCounts = {};
let dayVoteFirebaseKeyLoaded = null;
let dayVoteLocal = JSON.parse(localStorage.getItem('cffDayVotes') || '{}');
let lastHomeGroupsHtml = '';
let lastScheduleGroupsHtml = '';
let lastDayVoteRenderedSignature = '';

const CFF_FINAL_HOME_MATCHES = [
    {
        semana: 'Final',
        etapa: 'Grande Final Dia 1',
        data: '30 de Maio',
        grupos: ['FINAL'],
        startAt: '2026-05-30T13:00:00-03:00'
    },
    {
        semana: 'Final',
        etapa: 'Grande Final Dia 2',
        data: '31 de Maio',
        grupos: ['FINAL'],
        startAt: '2026-05-31T13:00:00-03:00'
    }
];

function cffDayVoteParseMatchDate(matchOrDate) {
    if (matchOrDate && typeof matchOrDate === 'object' && matchOrDate.startAt) {
        return new Date(matchOrDate.startAt);
    }

    const raw = typeof matchOrDate === 'object' ? matchOrDate?.data : matchOrDate;

    if (typeof parseMatchDate === 'function') {
        try {
            const parsed = parseMatchDate(raw);
            if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
        } catch (error) {}
    }

    const months = {
        janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3,
        maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8,
        outubro: 9, novembro: 10, dezembro: 11
    };
    const clean = String(raw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const dayMatch = clean.match(/(\d{1,2})/);
    const monthKey = Object.keys(months).find(month => clean.includes(month.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
    const day = dayMatch ? parseInt(dayMatch[1], 10) : 30;
    const month = monthKey ? months[monthKey] : 4;
    return new Date(2026, month, day, 13, 0, 0);
}

function getHomeFinalMatch() {
    const now = new Date();
    const finalMatches = Array.isArray(CFF_FINAL_HOME_MATCHES) ? CFF_FINAL_HOME_MATCHES : [];

    for (const match of finalMatches) {
        const start = cffDayVoteParseMatchDate(match);
        const end = new Date(start.getTime() + (8 * 60 * 60 * 1000));
        if (now <= end) return match;
    }

    return finalMatches[finalMatches.length - 1] || null;
}

function buildFinalTeamsLogosHtml() {
    const teams = getFinalQualifiedTeamsForVote();

    if (!teams.length) {
        return '<div class="group-logos final-groups-logos"><span class="group-label">FINAL</span><span style="color:var(--text-muted);font-size:.82em;">Carregando classificados...</span></div>';
    }

    const logosHtml = teams.map(team => `
        <img src="${getTeamLogoSrc(team.equipe)}" onerror="this.src='escudo.webp'" class="mini-logo" title="${team.equipe}" alt="${team.equipe}">
    `).join('');

    return `<div class="group-logos final-groups-logos"><span class="group-label">FINAL</span>${logosHtml}</div>`;
}


function safeFirebaseKey(value) {
    return String(value || '').trim().replace(/[.#$/\[\]]/g, '_').replace(/\s+/g, '_');
}

function buildDayVoteMatchKey(match) {
    // A votação da home agora é fixa para o campeão da final.
    // Assim ela não muda quando troca dia, grupo ou próxima rodada.
    return safeFirebaseKey('WB_2026_S1_QUEM_VAI_SER_O_CAMPEAO');
}

function getFinalQualifiedTeamsForVote() {
    if (typeof db === 'undefined' || !Array.isArray(db.teams)) return [];
    return [...db.teams]
        .filter(t => Number(t.pontos) > 0)
        .sort((a, b) => (Number(b.pontos) || 0) - (Number(a.pontos) || 0) || (Number(b.abates) || 0) - (Number(a.abates) || 0))
        .slice(0, 12);
}

function getTeamsFromMatch(match) {
    return getFinalQualifiedTeamsForVote();
}

function getTeamLogoSrc(teamName) {
    if (!teamName) return 'escudo.webp';
    if (logos[teamName]) return logos[teamName];
    const key = Object.keys(logos).find(k => k.trim().toUpperCase() === teamName.trim().toUpperCase());
    return key ? logos[key] : 'escudo.webp';
}


function syncDayVoteSelectedState(matchKey) {
    const grid = document.getElementById('day-vote-grid');
    if (!grid || !matchKey) return;
    const selectedKey = dayVoteLocal[matchKey] || null;

    grid.querySelectorAll('.day-vote-team').forEach(btn => {
        const isSelected = !!(selectedKey && btn.dataset.teamKey === selectedKey);
        btn.classList.toggle('voted', isSelected);
        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
}

function clearDayVoteGhostFocus() {
    if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('day-vote-team')) {
        document.activeElement.blur();
    }

    const grid = document.getElementById('day-vote-grid');
    if (!grid) return;

    grid.querySelectorAll('.day-vote-team').forEach(btn => {
        btn.blur();
        btn.classList.remove('force-focus-clean');
    });
}

function renderDayVote(match) {
    const card = document.getElementById('day-vote-card');
    const grid = document.getElementById('day-vote-grid');
    const subtitle = document.getElementById('day-vote-subtitle');
    const totalEl = document.getElementById('day-vote-total');
    if (!card || !grid) return;

    const matchKey = buildDayVoteMatchKey(match);
    if (!matchKey) {
        grid.innerHTML = '<div class="day-vote-empty">Classificados da final ainda não encontrados.</div>';
        if (totalEl) totalEl.textContent = '0 votos';
        return;
    }

    const teams = getTeamsFromMatch(match);
    const localVoted = dayVoteLocal[matchKey] || null;
    const total = teams.reduce((sum, team) => sum + (dayVoteCounts[safeFirebaseKey(team.equipe)] || 0), 0);

    if (subtitle) subtitle.textContent = 'Votação da final • 12 classificados';
    if (totalEl) totalEl.textContent = `${total} voto${total === 1 ? '' : 's'}`;

    if (!teams.length) {
        grid.innerHTML = '<div class="day-vote-empty">Times classificados não encontrados.</div>';
        return;
    }

    const rankedTeams = [...teams].sort((a, b) => {
        const votesA = dayVoteCounts[safeFirebaseKey(a.equipe)] || 0;
        const votesB = dayVoteCounts[safeFirebaseKey(b.equipe)] || 0;
        if (votesB !== votesA) return votesB - votesA;
        return a.equipe.localeCompare(b.equipe, 'pt-BR');
    });

    grid.innerHTML = rankedTeams.map((team, index) => {
        const teamKey = safeFirebaseKey(team.equipe);
        const count = dayVoteCounts[teamKey] || 0;
        const pct = total ? Math.round((count / total) * 100) : 0;
        const votedClass = localVoted === teamKey ? 'voted' : '';
        return `
            <button class="day-vote-team ${votedClass}" data-team-key="${teamKey}" aria-pressed="${localVoted === teamKey ? 'true' : 'false'}" onclick="voteDayTeamByKey('${teamKey}', this)" title="Votar em ${team.equipe} para campeão">
                <img src="${getTeamLogoSrc(team.equipe)}" onerror="this.src='escudo.webp'" alt="${team.equipe}">
                <span class="day-vote-name"><span class="day-vote-rank">${index + 1}º</span> ${team.equipe}</span>
                <span class="day-vote-percent">${pct}%</span>
                <div class="day-vote-bar"><div class="day-vote-bar-fill" style="width:${pct}%"></div></div>
                <span class="day-vote-count">${count} voto${count === 1 ? '' : 's'}</span>
            </button>`;
    }).join('');

    syncDayVoteSelectedState(matchKey);
    requestAnimationFrame(() => clearDayVoteGhostFocus());
}

function setupDayVoteForMatch(match) {
    const matchKey = buildDayVoteMatchKey(match);
    if (!matchKey) return;

    const changedMatch = dayVoteMatchKey !== matchKey;
    if (changedMatch) {
        dayVoteMatchKey = matchKey;
        window.currentDayVoteMatchKey = matchKey;
        dayVoteTeams = getTeamsFromMatch(match);
        dayVoteCounts = {};
        lastDayVoteRenderedSignature = '';
        renderDayVote(match);
    } else {
        // Re-renderiza caso os dados tenham sido carregados depois da Home.
        renderDayVote(match);
    }

    if (typeof window.fbLoadDayVotes === 'function' && dayVoteFirebaseKeyLoaded !== matchKey) {
        dayVoteFirebaseKeyLoaded = matchKey;
        window.fbLoadDayVotes(matchKey);
    }
}

function voteDayTeamByKey(teamKey, clickedButton = null) {
    if (!dayVoteMatchKey || !teamKey) return;

    // Mobile: remove qualquer foco/anel azul antes de reordenar os cards.
    // Safari/Chrome podem manter foco visual na posição antiga do grid.
    if (clickedButton && typeof clickedButton.blur === 'function') clickedButton.blur();
    clearDayVoteGhostFocus();

    const previousTeamKey = dayVoteLocal[dayVoteMatchKey] || null;
    const newTeamKey = previousTeamKey === teamKey ? null : teamKey;

    // Feedback local imediato
    if (previousTeamKey) dayVoteCounts[previousTeamKey] = Math.max(0, (dayVoteCounts[previousTeamKey] || 0) - 1);
    if (newTeamKey) dayVoteCounts[newTeamKey] = (dayVoteCounts[newTeamKey] || 0) + 1;

    if (newTeamKey) dayVoteLocal[dayVoteMatchKey] = newTeamKey;
    else delete dayVoteLocal[dayVoteMatchKey];
    localStorage.setItem('cffDayVotes', JSON.stringify(dayVoteLocal));

    if (typeof window.fbDayVote === 'function') {
        window.fbDayVote(dayVoteMatchKey, newTeamKey, previousTeamKey);
    }

    renderDayVote(null);
    syncDayVoteSelectedState(dayVoteMatchKey);
    clearDayVoteGhostFocus();
    requestAnimationFrame(() => clearDayVoteGhostFocus());
    setTimeout(() => clearDayVoteGhostFocus(), 80);
}

function voteDayTeam(teamName) {
    voteDayTeamByKey(safeFirebaseKey(teamName));
}

window.applyDayVoteCounts = function(matchKey, counts) {
    if (matchKey !== dayVoteMatchKey) return;
    dayVoteCounts = counts || {};
    renderDayVote(null);
    syncDayVoteSelectedState(matchKey);
};

function updateCountdown() {
    const now = new Date();

    // HOME: agora a próxima partida é a Grande Final, com os 12 classificados de uma vez.
    const nextMatch = getHomeFinalMatch();
    const targetDate = cffDayVoteParseMatchDate(nextMatch);
    const diff = targetDate - now;
    const finalEndDate = new Date(targetDate.getTime() + (8 * 60 * 60 * 1000));
    const isLive = diff <= 0 && now <= finalEndDate;
    const allFinalMatches = Array.isArray(CFF_FINAL_HOME_MATCHES) ? CFF_FINAL_HOME_MATCHES : [nextMatch].filter(Boolean);
    const lastFinalMatch = allFinalMatches[allFinalMatches.length - 1] || nextMatch;
    const lastFinalStart = cffDayVoteParseMatchDate(lastFinalMatch);
    const championshipEndDate = new Date(lastFinalStart.getTime() + (8 * 60 * 60 * 1000));
    const isFinished = now > championshipEndDate;

    const safeDiff = Math.max(0, diff);
    const d = Math.floor(safeDiff / (1000 * 60 * 60 * 24));
    const h = Math.floor((safeDiff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((safeDiff / (1000 * 60)) % 60);
    const s = Math.floor((safeDiff / 1000) % 60);
    const timeStr = `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;

    const groupsHtml = buildFinalTeamsLogosHtml();

    // Atualiza Home: tempo + 12 classificados.
    const homeDisplay = document.getElementById('home-next-countdown');
    const homeGroups = document.getElementById('home-next-groups');
    const homeStatusText = document.getElementById('home-next-status');

    if (homeDisplay) {
        if (isFinished) homeDisplay.innerHTML = "<span style='color: var(--text-muted);'>FINAL ENCERRADA</span>";
        else homeDisplay.innerHTML = isLive ? "<span style='color: #ff4444;'>AO VIVO AGORA</span>" : timeStr;
    }

    if (homeStatusText) {
        if (isFinished) homeStatusText.innerText = 'Grande Final encerrada:';
        else homeStatusText.innerText = isLive ? `${nextMatch.etapa || 'Grande Final'} em andamento:` : `${nextMatch.etapa || 'Grande Final'} começa em:`;
    }

    if (homeGroups && groupsHtml !== lastHomeGroupsHtml) {
        homeGroups.innerHTML = groupsHtml;
        lastHomeGroupsHtml = groupsHtml;
    }

    // Votação fixa: campeão da final.
    setupDayVoteForMatch(nextMatch);

    // Atualiza página de agenda, se estiver aberta.
    const scheduleDisplay = document.getElementById('countdown-display');
    const scheduleGroups = document.getElementById('next-match-groups');
    if (scheduleDisplay) {
        if (isFinished) scheduleDisplay.innerText = 'FINAL ENCERRADA';
        else scheduleDisplay.innerText = isLive ? 'AO VIVO' : timeStr;
    }
    if (scheduleGroups && groupsHtml !== lastScheduleGroupsHtml) {
        scheduleGroups.innerHTML = groupsHtml;
        lastScheduleGroupsHtml = groupsHtml;
    }

    // Perfil da equipe: mantém a lógica antiga, mas sem depender de função inexistente.
    const tpDisplay = document.getElementById('tp-countdown-display');
    if (tpDisplay && currentTeamNextMatch) {
        const tpTarget = cffDayVoteParseMatchDate(currentTeamNextMatch);
        const tpDiff = tpTarget - now;

        if (tpDiff <= 0) {
            tpDisplay.innerHTML = "<span style='color: #ff4444;'>AO VIVO AGORA</span>";
        } else {
            const tpd = Math.floor(tpDiff / (1000 * 60 * 60 * 24));
            const tph = Math.floor((tpDiff / (1000 * 60 * 60)) % 24);
            const tpm = Math.floor((tpDiff / (1000 * 60)) % 60);
            const tps = Math.floor((tpDiff / 1000) % 60);
            tpDisplay.innerText = `${tpd > 0 ? tpd + 'd ' : ''}${tph}h ${tpm}m ${tps}s`;
        }
    }

    const updateBtn = (btnId, textId, defaultText) => {
        const btn = document.getElementById(btnId);
        const txt = document.getElementById(textId);
        if (!btn) return;

        if (isLive) {
            btn.classList.remove('offline');
            btn.classList.add('online');
            if (txt) txt.innerText = 'ASSISTIR AO VIVO';
        } else {
            btn.classList.add('offline');
            btn.classList.remove('online');
            if (txt) txt.innerText = defaultText;
        }
    };

    updateBtn('home-live-btn', 'home-live-text', 'Sem transmissão disponível');
    updateBtn('schedule-live-btn', 'schedule-live-text', 'Aguardando Início');
    updateBtn('tp-live-btn', 'tp-live-text', 'Transmissão Offline');
}
function calculatePlayerRanks() {
    // 1. Filtra os jogadores que realmente jogaram (evita bugar com jogadores zerados)
    let ativos = db.players.filter(p => p.quedas > 0);

    const setRank = (attrName, rankName) => {
        // 2. Ordena do maior para o menor. Se não tiver número, ele trata como 0
        ativos.sort((a, b) => (b[attrName] || 0) - (a[attrName] || 0));

        // 3. Distribui as medalhas (1º, 2º, 3º...)
        ativos.forEach((p, index) => {
            p[rankName] = index + 1;
        });
    };

    // Aplica o ranking para cada estatística
    setRank('abates', 'rankKills');
    setRank('dano', 'rankDmg');
    setRank('assists', 'rankAssists');
    setRank('mvp', 'rankMvp');
}

function sortTable(tableId, colIndex, isNumeric) {
    let table = document.getElementById(tableId);
    if (!table) return;
    let tbody = table.querySelector("tbody");
    let rows = Array.from(tbody.querySelectorAll("tr"));
    let isAsc = table.getAttribute("data-sort-dir") === "asc";
    table.setAttribute("data-sort-dir", isAsc ? "desc" : "asc");
    rows.sort((a, b) => {
        let valA = a.cells[colIndex]?.innerText.trim() || '';
        let valB = b.cells[colIndex]?.innerText.trim() || '';
        if (isNumeric) {
            valA = parseSortNumber(valA);
            valB = parseSortNumber(valB);
            return isAsc ? valA - valB : valB - valA;
        } else {
            return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
    });
    rows.forEach(r => tbody.appendChild(r));
    if ((tableId === 'table-sea-abates' || tableId === 'table-sea-classificacao') && typeof refreshSEADynamicRankColumn === 'function') {
        refreshSEADynamicRankColumn(tableId);
    }
}


function onPlayerTeamFilterChanged() {
    selectedPlayerDays = []; // Reseta os dias selecionados ao trocar de time
    buildDayFilters();       // Reconstrói os chips de dias
    renderAllPlayers();      // Renderiza a tabela
}

function getDayFilterArray(containerId) {
    if (containerId === 'team-day-filters') return selectedTeamDays;
    if (containerId === 'player-day-filters') return selectedPlayerDays;
    if (containerId === 'avg-day-filters') return selectedAvgDays;
    if (containerId === 'total-day-filters') return selectedTotalDays;
    if (containerId === 'top5-day-filters') return selectedTop5Days;
    if (containerId === 'pp-cff-day-filters') return selectedPpcffDays;
    return selectedTpDays;
}

function getAvailableDaysForFilter(containerId) {
    if (containerId === 'pp-cff-day-filters') {
        if (!currentPlayerView) return [];
        let daysPlayed = new Set();
        for (let d in dbJogadoresQuedas) {
            for (let q in dbJogadoresQuedas[d]) {
                if (dbJogadoresQuedas[d][q].some(p => checkNameMatch(p.nome, currentPlayerView))) {
                    daysPlayed.add(Number(d));
                    break;
                }
            }
        }
        return Array.from(daysPlayed).sort((a, b) => b - a).map(String);
    }

    if (containerId === 'tp-day-filters' && currentTeamView && db.teamDaily[currentTeamView]) {
        return [...new Set(db.teamDaily[currentTeamView].map(d => d.dia))].sort((a,b)=>a-b).map(String);
    }

    if (containerId === 'player-day-filters' && typeof cffGetStageJogadoresQuedas === 'function') {
        const stageDays = Object.keys(cffGetStageJogadoresQuedas(typeof cffGetSelectedMvpStage === 'function' ? cffGetSelectedMvpStage() : 'classificatoria'));
        if (stageDays.length) return stageDays.map(Number).sort((a, b) => a - b).map(String);
    }

    if (['avg-day-filters', 'total-day-filters', 'top5-day-filters'].includes(containerId) && typeof cffGetStageQuedas === 'function') {
        const stageDays = Object.keys(cffGetStageQuedas(typeof cffGetSelectedStatsStage === 'function' ? cffGetSelectedStatsStage() : 'classificatoria'));
        if (stageDays.length) return stageDays.map(Number).sort((a, b) => a - b).map(String);
    }

    let days = [];
    for (let i = 1; i <= TOTAL_DIAS; i++) days.push(String(i));
    return days;
}

function getSelectedDaysForUi(containerId) {
    const arr = getDayFilterArray(containerId);
    const available = getAvailableDaysForFilter(containerId);
    return arr.length === 0 ? [...available] : arr.filter(d => available.includes(String(d))).map(String);
}

function runDayFilterCallback(callbackName) {
    if (typeof callbackName === 'function') callbackName();
    else if (typeof window[callbackName] === 'function') window[callbackName]();
}

function renderMultiDayFilter(containerId, arrSelected, callbackName, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const availableDays = getAvailableDaysForFilter(containerId);
    const selectedForUi = arrSelected.length === 0 ? [...availableDays] : arrSelected.filter(d => availableDays.includes(String(d))).map(String);
    const allSelected = selectedForUi.length === availableDays.length;
    const menuId = `${containerId}-menu`;
    const btnId = `${containerId}-btn`;

    if (!availableDays.length) {
        container.innerHTML = '';
        return;
    }

    let label = 'Todos os dias';
    if (!allSelected) label = selectedForUi.length === 1 ? `Dia ${selectedForUi[0]}` : `${selectedForUi.length} dias selecionados`;

    const selectAllLabel = options.selectAllLabel || 'Selecionar tudo';
    const html = `
        <div class="multi-check-filter" data-filter-id="${containerId}">
            <button type="button" class="multi-check-toggle" id="${btnId}" onclick="toggleMultiDayMenu('${containerId}')">${label}</button>
            <div class="multi-check-menu" id="${menuId}" style="display:none;">
                <button type="button" class="multi-check-close" onclick="closeMultiCheckMenu('${menuId}')" aria-label="Fechar filtro">Fechar ×</button>
                <div class="multi-check-row multi-check-all">
                    <label><input type="checkbox" ${allSelected ? 'checked' : ''} onchange="selectAllDaysFilter('${containerId}', '${callbackName}')"> ${selectAllLabel}</label>
                </div>
                ${availableDays.map(d => {
                    const checked = selectedForUi.includes(String(d)) ? 'checked' : '';
                    return `<div class="multi-check-row">
                        <label><input type="checkbox" value="${d}" ${checked} onchange="toggleDaySelection('${containerId}', '${d}', this.checked, '${callbackName}')"> Dia ${d}</label>
                        <button type="button" class="multi-check-only" onclick="selectOnlyDayFilter('${containerId}', '${d}', '${callbackName}')">somente</button>
                    </div>`;
                }).join('')}
            </div>
        </div>`;

    container.innerHTML = html;
}

function closeMultiCheckMenu(menuId) {
    const menu = document.getElementById(menuId);
    if (menu) menu.style.display = 'none';
}

function buildDayFilters() {
    renderMultiDayFilter('team-day-filters', selectedTeamDays, 'onTeamDayFilterChanged');
    renderMultiDayFilter('player-day-filters', selectedPlayerDays, 'onPlayerDayFilterChanged');
    renderMultiDayFilter('avg-day-filters', selectedAvgDays, 'renderTableAvg');
    renderMultiDayFilter('total-day-filters', selectedTotalDays, 'renderTableTotal');
    renderMultiDayFilter('top5-day-filters', selectedTop5Days, 'renderTop5Stats');

    // Filtro exclusivo da Nota CFF dentro do perfil do jogador: mantém apenas os dias em que ele atuou.
    renderMultiDayFilter('pp-cff-day-filters', selectedPpcffDays, 'onPpcffDayFilterChanged', { selectAllLabel: 'Selecionar tudo' });

    if (currentTeamView) {
        renderMultiDayFilter('tp-day-filters', selectedTpDays, 'onTpDayFilterChanged');
    }
    if (typeof buildExtraMultiSelectFilters === 'function') buildExtraMultiSelectFilters();
}

function toggleMultiDayMenu(containerId) {
    const menu = document.getElementById(`${containerId}-menu`);
    if (!menu) return;
    const shouldOpen = menu.style.display === 'none' || !menu.style.display;
    document.querySelectorAll('.multi-check-menu').forEach(m => {
        if (m !== menu) m.style.display = 'none';
    });
    menu.style.display = shouldOpen ? 'grid' : 'none';
}

function setDayFilterSelection(containerId, days, callbackName, keepMenuOpen = true) {
    const arr = getDayFilterArray(containerId);
    const available = getAvailableDaysForFilter(containerId).map(String);
    const clean = [...new Set((days || []).map(String).filter(d => available.includes(d)))];

    arr.length = 0;
    if (clean.length && clean.length < available.length) arr.push(...clean);
    // clean vazio ou igual a todos = todos selecionados, internamente representado por array vazio.

    runDayFilterCallback(callbackName);
    if (keepMenuOpen) {
        const menu = document.getElementById(`${containerId}-menu`);
        if (menu) menu.style.display = 'grid';
    }
}

function selectAllDaysFilter(containerId, callbackName) {
    setDayFilterSelection(containerId, [], callbackName, true);
}

function selectOnlyDayFilter(containerId, day, callbackName) {
    setDayFilterSelection(containerId, [String(day)], callbackName, true);
}

function toggleDaySelection(containerId, day, checked, callbackName) {
    const available = getAvailableDaysForFilter(containerId).map(String);
    let selected = getSelectedDaysForUi(containerId).map(String);

    if (checked) {
        if (!selected.includes(String(day))) selected.push(String(day));
    } else {
        selected = selected.filter(d => d !== String(day));
    }

    // Se o usuário desmarcar tudo, volta para tudo selecionado para evitar tabela vazia por acidente.
    if (selected.length === 0) selected = [...available];
    setDayFilterSelection(containerId, selected, callbackName, true);
}

function toggleDay(containerId, day, callback) {
    if (day === 'all') selectAllDaysFilter(containerId, callback);
    else {
        const selected = getSelectedDaysForUi(containerId).map(String);
        const isSelected = selected.includes(String(day));
        toggleDaySelection(containerId, day, !isSelected, callback);
    }
}

function onTeamDayFilterChanged_ALIAS() { buildDayFilters(); renderFullTeams(); renderGroupsTables(); } // alias legado — usar onTeamDayFilterChanged abaixo
function onPlayerDayFilterChanged() { buildDayFilters(); renderAllPlayers(); }
function onTpDayFilterChanged() { buildDayFilters(); renderTeamProfileStats();renderTeamChart(); }


// =============================================
// FILTROS MULTISELECT GENÉRICOS
// =============================================
window._genericMultiSelectFilters = window._genericMultiSelectFilters || {};

function _escapeAttrMulti(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function _escapeJsMulti(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getGenericMultiOptions(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return [];
    return Array.from(select.options)
        .filter(opt => String(opt.value) !== 'all' && !opt.disabled)
        .map(opt => ({ value: String(opt.value), label: opt.textContent.trim() || String(opt.value) }));
}

function getGenericMultiState(selectId) {
    if (!window._genericMultiSelectFilters[selectId]) window._genericMultiSelectFilters[selectId] = new Set();
    return window._genericMultiSelectFilters[selectId];
}

function getMultiSelectValues(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return [];
    const options = getGenericMultiOptions(selectId).map(o => o.value);
    if (!document.getElementById(`${selectId}-multi`)) {
        const value = String(select.value || 'all');
        if (value === 'all') return options;
        return [value];
    }
    const state = getGenericMultiState(selectId);
    const clean = Array.from(state).filter(v => options.includes(String(v))).map(String);
    if (clean.length !== state.size) window._genericMultiSelectFilters[selectId] = new Set(clean);
    return clean.length === 0 ? options : clean;
}

function getMultiSelectRawState(selectId) {
    const options = getGenericMultiOptions(selectId).map(o => o.value);
    const state = getGenericMultiState(selectId);
    const clean = Array.from(state).filter(v => options.includes(String(v))).map(String);
    return clean.length === 0 || clean.length === options.length ? [] : clean;
}

function multiSelectHasValue(selectId, value, normalizer) {
    const values = getMultiSelectValues(selectId);
    if (!values.length) return true;
    const raw = String(value || '');
    const cmp = typeof normalizer === 'function' ? normalizer(raw) : raw;
    return values.some(v => {
        const vv = typeof normalizer === 'function' ? normalizer(String(v)) : String(v);
        return vv === cmp;
    });
}

function runGenericMultiCallback(callbackName) {
    if (!callbackName) return;
    if (typeof callbackName === 'function') callbackName();
    else if (typeof window[callbackName] === 'function') window[callbackName]();
}

function toggleGenericMultiMenu(selectId) {
    const menu = document.getElementById(`${selectId}-multi-menu`);
    if (!menu) return;
    const shouldOpen = menu.style.display === 'none' || !menu.style.display;
    document.querySelectorAll('.multi-check-menu').forEach(m => {
        if (m !== menu) m.style.display = 'none';
    });
    menu.style.display = shouldOpen ? 'grid' : 'none';
}

function rerenderGenericMulti(selectId, callbackName, keepOpen = true) {
    setupGenericMultiSelectFilter(selectId, callbackName, { keepState: true });
    runGenericMultiCallback(callbackName);
    setupGenericMultiSelectFilter(selectId, callbackName, { keepState: true });
    if (keepOpen) {
        const menu = document.getElementById(`${selectId}-multi-menu`);
        if (menu) menu.style.display = 'grid';
    }
}

function selectAllGenericMulti(selectId, callbackName) {
    window._genericMultiSelectFilters[selectId] = new Set();
    rerenderGenericMulti(selectId, callbackName, true);
}

function selectOnlyGenericMulti(selectId, value, callbackName) {
    window._genericMultiSelectFilters[selectId] = new Set([String(value)]);
    rerenderGenericMulti(selectId, callbackName, true);
}

function toggleGenericMultiValue(selectId, value, checked, callbackName) {
    const allValues = getGenericMultiOptions(selectId).map(o => o.value);
    let selected = getMultiSelectValues(selectId).map(String);
    value = String(value);

    if (checked) {
        if (!selected.includes(value)) selected.push(value);
    } else {
        selected = selected.filter(v => v !== value);
    }

    if (selected.length === 0 || selected.length === allValues.length) window._genericMultiSelectFilters[selectId] = new Set();
    else window._genericMultiSelectFilters[selectId] = new Set(selected);
    rerenderGenericMulti(selectId, callbackName, true);
}

function setupGenericMultiSelectFilter(selectId, callbackName, options = {}) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const available = getGenericMultiOptions(selectId);
    if (!available.length) return;

    select.style.display = 'none';
    select.value = 'all';

    let wrapper = document.getElementById(`${selectId}-multi`);
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = `${selectId}-multi`;
        wrapper.className = `multi-check-filter generic-multi-filter ${options.className || ''}`.trim();
        select.insertAdjacentElement('afterend', wrapper);
    }

    const allValues = available.map(o => o.value);
    const state = getGenericMultiState(selectId);
    const clean = Array.from(state).filter(v => allValues.includes(String(v))).map(String);
    if (clean.length !== state.size) window._genericMultiSelectFilters[selectId] = new Set(clean);

    const selectedForUi = clean.length === 0 ? [...allValues] : clean;
    const allSelected = selectedForUi.length === allValues.length;
    const allLabel = options.allLabel || (select.options[0]?.textContent.trim() || 'Todos');
    const label = allSelected ? allLabel : (selectedForUi.length === 1
        ? (available.find(o => o.value === selectedForUi[0])?.label || '1 selecionado')
        : `${selectedForUi.length} selecionados`);

    wrapper.innerHTML = `
        <button type="button" class="multi-check-toggle" onclick="toggleGenericMultiMenu('${selectId}')">${label}</button>
        <div class="multi-check-menu" id="${selectId}-multi-menu" style="display:none;">
            <button type="button" class="multi-check-close" onclick="closeMultiCheckMenu('${selectId}-multi-menu')" aria-label="Fechar filtro">Fechar ×</button>
            <div class="multi-check-row multi-check-all">
                <label><input type="checkbox" ${allSelected ? 'checked' : ''} onchange="selectAllGenericMulti('${selectId}', '${callbackName}')"> Selecionar tudo</label>
            </div>
            ${available.map(item => {
                const checked = selectedForUi.includes(item.value) ? 'checked' : '';
                return `<div class="multi-check-row">
                    <label><input type="checkbox" value="${_escapeAttrMulti(item.value)}" ${checked} onchange="toggleGenericMultiValue('${selectId}', '${_escapeJsMulti(item.value)}', this.checked, '${callbackName}')"> ${item.label}</label>
                    <button type="button" class="multi-check-only" onclick="selectOnlyGenericMulti('${selectId}', '${_escapeJsMulti(item.value)}', '${callbackName}')">somente</button>
                </div>`;
            }).join('')}
        </div>`;
}

function buildExtraMultiSelectFilters() {
    setupGenericMultiSelectFilter('filter-team-map', 'onMapFilterChanged', { allLabel: 'Todos os Mapas' });
    setupGenericMultiSelectFilter('filter-team-players', 'onPlayerTeamFilterChanged', { allLabel: 'Todas as equipes' });
    setupGenericMultiSelectFilter('filter-role-players', 'renderAllPlayers', { allLabel: 'Todas as posições' });
    setupGenericMultiSelectFilter('avg-conf-filter', 'renderTableAvg', { allLabel: 'Todos os confrontos' });
    setupGenericMultiSelectFilter('avg-map-filter', 'renderTableAvg', { allLabel: 'Todos os Mapas' });
    setupGenericMultiSelectFilter('total-conf-filter', 'renderTableTotal', { allLabel: 'Todos os confrontos' });
    setupGenericMultiSelectFilter('total-map-filter', 'renderTableTotal', { allLabel: 'Todos os Mapas' });
    setupGenericMultiSelectFilter('filter-player-day', 'renderPlayerStats', { allLabel: 'Todos os dias' });
    setupGenericMultiSelectFilter('filter-player-conf', 'renderPlayerStats', { allLabel: 'Todos os confrontos' });
    setupGenericMultiSelectFilter('filter-player-map', 'renderPlayerStats', { allLabel: 'Todos os Mapas' });
    setupGenericMultiSelectFilter('filter-player-team', 'renderPlayerStats', { allLabel: 'Todas as equipes' });
    setupGenericMultiSelectFilter('filter-player-role', 'renderPlayerStats', { allLabel: 'Todas as posições' });
}

if (!window._multiCheckOutsideListenerAdded) {
    window._multiCheckOutsideListenerAdded = true;
    document.addEventListener('click', function(event) {
        const target = event.target;
        if (target && target.closest && target.closest('.multi-check-filter')) return;
        document.querySelectorAll('.multi-check-menu').forEach(menu => menu.style.display = 'none');
    });
}
