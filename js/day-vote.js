// =============================================
// VOTAÇÃO DO DIA - HOME
// =============================================
let dayVoteMatchKey = null;
let dayVoteTeams = [];
let dayVoteCounts = {};
let dayVoteFirebaseKeyLoaded = null;
let dayVoteLocal = JSON.parse(localStorage.getItem('cffDayVotes') || '{}');
let lastHomeGroupsHtml = '';
let lastScheduleGroupsHtml = '';
let lastDayVoteRenderedSignature = '';

function safeFirebaseKey(value) {
    return String(value || '').trim().replace(/[.#$/\[\]]/g, '_').replace(/\s+/g, '_');
}

function buildDayVoteMatchKey(match) {
    if (!match) return null;
    return safeFirebaseKey(`WB_2026_S1_${match.data}_GP_${match.grupos.join('_')}`);
}

function getTeamsFromMatch(match) {
    if (!match || !match.grupos) return [];
    return db.teams
        .filter(t => match.grupos.includes(t.grupo))
        .sort((a, b) => a.grupo.localeCompare(b.grupo) || a.equipe.localeCompare(b.equipe));
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
        grid.innerHTML = '<div class="day-vote-empty">Nenhuma rodada encontrada no momento.</div>';
        if (totalEl) totalEl.textContent = '0 votos';
        return;
    }

    const teams = getTeamsFromMatch(match);
    const localVoted = dayVoteLocal[matchKey] || null;
    const total = teams.reduce((sum, team) => sum + (dayVoteCounts[safeFirebaseKey(team.equipe)] || 0), 0);

    if (subtitle) subtitle.textContent = `${match.data} • Grupos ${match.grupos.join(' x ')}`;
    if (totalEl) totalEl.textContent = `${total} voto${total === 1 ? '' : 's'}`;

    if (!teams.length) {
        grid.innerHTML = '<div class="day-vote-empty">Times da rodada não encontrados.</div>';
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
            <button class="day-vote-team ${votedClass}" data-team-key="${teamKey}" aria-pressed="${localVoted === teamKey ? 'true' : 'false'}" onclick="voteDayTeamByKey('${teamKey}', this)" title="Votar em ${team.equipe}">
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

    const match = agenda.find(m => buildDayVoteMatchKey(m) === dayVoteMatchKey);
    renderDayVote(match);
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
    const match = agenda.find(m => buildDayVoteMatchKey(m) === matchKey);
    renderDayVote(match);
    syncDayVoteSelectedState(matchKey);
};

function updateCountdown() {
    const now = new Date();

    // 1. BUSCA O PRÓXIMO JOGO GERAL (Para Home e Datas)
    const nextMatch = agenda.find(m => {
        const mDate = parseMatchDate(m.data);
        return mDate.getTime() + (3.5 * 60 * 60 * 1000) > now.getTime();
    });

    if (nextMatch) {
        const targetDate = parseMatchDate(nextMatch.data);
        const diff = targetDate - now;
        const isLive = diff <= 0;

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        const timeStr = `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;

        // --- GERAÇÃO VISUAL DOS GRUPOS (O QUE TINHA SUMIDO) ---
        const groupsHtml = nextMatch.grupos.map(g => {
            const teamsInGroup = db.teams.filter(t => t.grupo === g);
            const logosHtml = teamsInGroup.map(t =>
                `<img src="${logos[t.equipe] || 'escudo.webp'}" onerror="this.src='escudo.webp'" class="mini-logo" style="width:22px; height:22px; margin: 0 2px;" title="${t.equipe}">`
            ).join('');
            return `<div class="group-logos"><span class="group-label">GP ${g}</span>${logosHtml}</div>`;
        }).join('<span style="font-weight:bold; color:#444; margin: 0 5px;">VS</span>');

        // Atualiza Home (Tempo e Grupos)
        const homeDisplay = document.getElementById('home-next-countdown');
        const homeGroups = document.getElementById('home-next-groups');
        const homeStatusText = document.getElementById('home-next-status');

        if (homeDisplay) homeDisplay.innerHTML = isLive ? "<span style='color: #ff4444;'>AO VIVO AGORA</span>" : timeStr;
        if (homeStatusText) homeStatusText.innerText = isLive ? "Partida em andamento:" : "A transmissão começa em:";
        if (homeGroups && groupsHtml !== lastHomeGroupsHtml) {
            homeGroups.innerHTML = groupsHtml;
            lastHomeGroupsHtml = groupsHtml;
        }
        setupDayVoteForMatch(nextMatch);

        // Atualiza Datas (Tempo e Grupos)
        const scheduleDisplay = document.getElementById('countdown-display');
        const scheduleGroups = document.getElementById('next-match-groups');
        if (scheduleDisplay) scheduleDisplay.innerText = isLive ? "AO VIVO" : timeStr;
        if (scheduleGroups && groupsHtml !== lastScheduleGroupsHtml) {
            scheduleGroups.innerHTML = groupsHtml;
            lastScheduleGroupsHtml = groupsHtml;
        }
    }

    // 2. LÓGICA DO PERFIL DA EQUIPE (Mantendo o que corrigimos antes)
    const tpDisplay = document.getElementById('tp-countdown-display');
    if (tpDisplay && currentTeamNextMatch) {
        const tpTarget = parseMatchDate(currentTeamNextMatch.data);
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

    // 3. ATUALIZAÇÃO DOS BOTÕES DE LIVE
    const checkLiveGlobal = () => {
        if (!nextMatch) return false;
        const mDate = parseMatchDate(nextMatch.data);
        // Está ao vivo se a hora atual passou da hora do jogo, por até 6 horas
        return now >= mDate && now <= (mDate.getTime() + (3.5 * 60 * 60 * 1000));
    };

    const isActuallyLive = checkLiveGlobal();

    const updateBtn = (btnId, textId, defaultText) => {
        const btn = document.getElementById(btnId);
        const txt = document.getElementById(textId);
        if (!btn) return;

        if (isActuallyLive) {
            btn.classList.remove('offline');
            btn.classList.add('online');
            if (txt) txt.innerText = "ASSISTIR AO VIVO";
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

