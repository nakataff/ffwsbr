// --- PESQUISA GLOBAL ATUALIZADA ---
function renderUnifiedTrophies(name, containerId) {
    let container = document.getElementById(containerId);
    if(!container) return;

    let targetNameLower = name.toLowerCase();
    let validNames = new Set([targetNameLower]);

    if (typeof historicalAliases !== 'undefined') {
        if (historicalAliases[name]) validNames.add(historicalAliases[name].toLowerCase());
        for (let key in historicalAliases) {
            if (historicalAliases[key].toLowerCase() === targetNameLower) validNames.add(key.toLowerCase());
        }
    }

    const fastCheck = (n) => n && validNames.has(n.toLowerCase());

    let indTitles = titlesData.individuais.filter(t => fastCheck(t.player));
    let colAsPlayer = titlesData.coletivos.filter(t => t.players && t.players.some(fastCheck));
    let colAsStaff = titlesData.coletivos.filter(t => t.staff && t.staff.some(fastCheck));

    let allTitles = [...new Set([...indTitles, ...colAsPlayer, ...colAsStaff])];

    if(containerId === 'pp-trophies-container') {
        let elCol = document.getElementById('pp-hist-col');
        let elInd = document.getElementById('pp-hist-ind');
        if(elCol) elCol.innerText = new Set([...colAsPlayer, ...colAsStaff]).size;
        if(elInd) elInd.innerText = indTitles.length;
    }

    if (allTitles.length === 0) {
        container.innerHTML = '<div style="color:#888; text-align:center; width:100%; padding:20px;">Nenhum título oficial registrado.</div>';
        return;
    }

    container.innerHTML = allTitles.map(t => {
        let tournamentImg = resolveLeagueLogo(t.event);
        let typeUpper = t.type ? t.type.toUpperCase() : "";
        let borderClass = typeUpper.includes("MVP") ? 'border-mvp' : (typeUpper.includes("REVELAÇÃO") ? 'border-revelacao' : 'border-campeao');

        // --- MÁGICA PARA O CLIQUE FUNCIONAR ---
        const hasTournamentPage = !!findTournamentInDB(t.event);
        const clickAttr = hasTournamentPage ? `onclick="navigateToTournament('${t.event.replace(/'/g, "\\'")}')" style="cursor:pointer;"` : '';
        const linkIcon = hasTournamentPage ? `<div style="font-size:0.55em; color:var(--accent); margin-top:3px;">🔗 Ver Torneio</div>` : '';

        let roleTag = "";
        let isPlayer = t.players && t.players.some(fastCheck);
        let isStaff = t.staff && t.staff.some(fastCheck);

        if (isPlayer && isStaff) roleTag = `<div style="font-size:0.55em; color:#aaa; margin-top:2px;">(JOGADOR E STAFF)</div>`;
        else if (isStaff) roleTag = `<div style="font-size:0.55em; color:#aaa; margin-top:2px;">(COMO STAFF)</div>`;
        else if (isPlayer) roleTag = `<div style="font-size:0.55em; color:#aaa; margin-top:2px;">(COMO JOGADOR)</div>`;

        return `<div class="trophy-card ${borderClass}" ${clickAttr}>
            <img class="ot-card-img" src="${tournamentImg}" loading="lazy" onerror="this.src='trofeu.webp'">
            <div style="font-weight:bold; font-size:0.75em; color:#fff; text-align:center;">${t.event}</div>
            <div style="color:var(--accent); font-size:0.65em; font-weight:bold; text-align:center;">${t.type}</div>
            ${roleTag}
            ${linkIcon}
            <div class="trophy-team">
                <img src="${logos[t.team] || 'escudo.webp'}" style="width: 14px; height: 14px; object-fit: contain;">
                ${t.team}
            </div>
        </div>`;
    }).join('');
}

// handleGlobalSearch legada — redireciona para a nova versão unificada
function selectSearchResult(type, name) {
    // Limpa todos os campos e esconde os resultados
    ['search-results', 'search-results-desktop', 'search-results-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    ['global-search', 'global-search-desktop', 'global-search-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // NOVA ADIÇÃO: Fecha a barra de pesquisa mobile e desktop corretamente
    const mobileBar = document.getElementById('mobile-search-bar');
    if (mobileBar) mobileBar.classList.remove('active');

    const desktopWrapper = document.getElementById('nav-search-wrapper-desktop');
    if (desktopWrapper) desktopWrapper.classList.remove('open');

    // Redireciona
    if (type === 'staff') {
        openStaffProfile(name);
    } else if (type === 'team') {
        openTeamProfile(name);
    } else {
        openPlayerProfile(name);
    }
}

// Esconder os dropdowns de busca ao clicar fora
    document.addEventListener('click', function(e) {
        const targets = [
            { results: 'search-results-desktop', wrapper: '.nav-search-wrapper-desktop' },
            { results: 'search-results-mobile', wrapper: '.nav-mobile-search-bar' },
        ];
        targets.forEach(({ results, wrapper }) => {
            const box = document.getElementById(results);
            const wrapperEl = document.querySelector(wrapper);
            if (box && wrapperEl && !wrapperEl.contains(e.target)) {
                box.style.display = 'none';
            }
        });
        // Fecha a barra de busca desktop se clicar fora
        const desktopWrapper = document.getElementById('nav-search-wrapper-desktop');
        if (desktopWrapper && desktopWrapper.classList.contains('open') && !desktopWrapper.contains(e.target)) {
            desktopWrapper.classList.remove('open');
            const inp = document.getElementById('global-search-desktop');
            if (inp) { inp.value = ''; }
            const res = document.getElementById('search-results-desktop');
            if (res) res.style.display = 'none';
        }
    });

function checkNameMatch(n1, n2) {
    if(!n1 || !n2) return false;
    let lower1 = n1.toLowerCase(), lower2 = n2.toLowerCase();
    if(lower1 === lower2) return true;

    let alias1 = historicalAliases[n1] ? historicalAliases[n1].toLowerCase() : null;
    let alias2 = historicalAliases[n2] ? historicalAliases[n2].toLowerCase() : null;

    if (alias1 === lower2 || alias2 === lower1) return true;

    for(let key in historicalAliases) {
        if(key.toLowerCase() === lower1 && historicalAliases[key].toLowerCase() === lower2) return true;
        if(key.toLowerCase() === lower2 && historicalAliases[key].toLowerCase() === lower1) return true;
    }
    return false;
}

// 1. Constrói os botões de filtro de Edição
function buildEditionFilters() {
    let container = document.getElementById('edition-filters');
    if(!container) return;
    let html = '';
    allEditions.forEach(ed => {
        let isActive = selectedEditions.includes(ed);
        html += `<div class="day-chip ${isActive ? 'active' : ''}" onclick="toggleEdition('${ed}')">${ed}</div>`;
    });
    container.innerHTML = html;
}

function toggleEdition(ed) {
    let idx = selectedEditions.indexOf(ed);
    if (idx > -1) selectedEditions.splice(idx, 1);
    else selectedEditions.push(ed);
    buildEditionFilters();
    renderEditionRanking();
}

function renderSelectionFilters() {
    const container = document.getElementById('selection-week-filters');
    if(!container) return;

    // Filtramos apenas as semanas que possuem algum dado no db.playerDaily
    const weeksWithData = Object.keys(wbWeeks).filter(w => {
        const days = wbWeeks[w];
        return db.playerDaily.some(d => days.includes(Number(d.dia)));
    });

    // Se não houver dados em nenhuma semana ainda, mostramos pelo menos a Semana 1 (vazia)
    const displayWeeks = weeksWithData.length > 0 ? weeksWithData : ["1"];

    container.innerHTML = displayWeeks.map(w => `
        <button class="btn-day ${currentSelectionWeek === w ? 'active' : ''}"
                onclick="currentSelectionWeek='${w}'; renderSelection(); renderSelectionFilters();"
                style="${currentSelectionWeek === w ? 'background:#ff0000; border-color:#ff0000; color:#fff;' : ''}">
            SEMANA ${w}
        </button>
    `).join('');
}

function renderSelection() {
    const container = document.getElementById('selection-container');
    if(!container) return;

    const days = wbWeeks[currentSelectionWeek];

    // 1. Agrupar dados da semana selecionada
    let stats = {};
    db.playerDaily.filter(d => days.includes(Number(d.dia))).forEach(row => {
        if(!stats[row.jogador]) {
            stats[row.jogador] = { jogador: row.jogador, equipe: row.equipe, abates: 0, dano: 0, assists: 0, quedas: 0 };
        }
        stats[row.jogador].abates += row.abates;
        stats[row.jogador].dano += row.dano;
        stats[row.jogador].assists += row.assists;
        stats[row.jogador].quedas += row.quedas;
    });

    const players = Object.values(stats);

    // 2. Lógica de seleção corrigida para ler "GRAN" e "SUP" do seu playerRoles
    const getTop = (roleList, count) => {
        return players
            .filter(p => roleList.includes(playerRoles[p.jogador] || "RUSH"))
            .sort((a,b) => b.abates - a.abates)
            .slice(0, count);
    };

    const selecionados = [
        ...getTop(["RUSH"], 2), // Traz os 2 melhores Rushers
        ...getTop(["GRAN"], 1), // Traz o melhor Grandeiro
        ...getTop(["SUP"], 1)   // Traz o melhor Suporte/Sniper
    ];

    if(selecionados.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 50px; color: #888; border: 1px dashed #333; border-radius: 15px; width: 100%;">
                <p>Aguardando o início das batalhas da Semana ${currentSelectionWeek}...</p>
            </div>`;
        return;
    }

    container.innerHTML = selecionados.map(p => createSelectionCardHTML(p)).join('');
}

// 2. Renderiza a tabela filtrada por Edição
function renderEditionRanking() {
    let tbody = document.querySelector('#table-edition-history tbody');
    if(!tbody || selectedEditions.length === 0) {
        if(tbody) tbody.innerHTML = '<tr><td colspan="6" style="color:#aaa; padding:20px;">Selecione uma edição.</td></tr>';
        return;
    }

    let results = [];
    for (let playerName in lbffData) {
        let pData = lbffData[playerName];
        let totalK = 0, totalQ = 0, jogou = false;

        selectedEditions.forEach(ed => {
            if(ed === "WB 2026 S1") {
                let activeName = historicalAliases[playerName] || playerName;
                let activeP = db.players.find(x => x.jogador.toLowerCase() === activeName.toLowerCase());
                if(activeP) { totalK += activeP.abates || 0; totalQ += activeP.quedas || 0; jogou = true; }
            } else if(pData[ed]) { totalK += pData[ed].k; totalQ += pData[ed].q; jogou = true; }
        });

        if (jogou && (totalK > 0 || totalQ > 0)) {
            let activeName = historicalAliases[playerName] || playerName;
            let activeP = db.players.find(x => x.jogador.toLowerCase() === activeName.toLowerCase());
            results.push({
                originalName: playerName, activeName: activeName,
                isPlaying: activeP && !activeP.isEx,
                equipe: (activeP && !activeP.isEx) ? activeP.equipe : null,
                k: totalK, q: totalQ, avg: totalQ > 0 ? (totalK/totalQ).toFixed(2) : "0.00"
            });
        }
    }

    results.sort((a,b) => b.k - a.k);
    let dataToShow = isEditionExpanded ? results : results.slice(0, 10);
    let btn = document.getElementById('btn-hist-edition');
    if(btn) { btn.style.display = results.length > 10 ? 'inline-block' : 'none'; btn.innerText = isEditionExpanded ? 'Recolher' : 'Ver Mais'; }

    tbody.innerHTML = dataToShow.map((p, i) => {
        let nameShort = p.originalName.length > 7 ? p.originalName.substring(0, 6) + "..." : p.originalName;

        // Clique liberado para todos (Ativos e Inativos)
        let nameHtml = `
            <span class="clickable full-name-desktop" onclick="${_safePPAttr(p.activeName)}">${p.originalName}</span>
            <span class="clickable short-name-mobile" onclick="${_safePPAttr(p.activeName)}">${nameShort}</span>`;

        let teamHtml = p.isPlaying ?
            `<div class="team-cell" style="justify-content:center;"><img src="${logos[p.equipe]||''}" class="team-logo"><span class="hide-mobile">${shortNames[p.equipe] || p.equipe}</span></div>` :
            `<span>🚫</span>`;

        return `<tr>
            <td style="color:var(--accent); font-weight:bold;">${i+1}º</td>
            <td style="text-align:left;">${nameHtml}</td>
            <td>${teamHtml}</td>
            <td style="color:#fff; font-weight:bold;">${p.k}</td>
            <td>${p.q}</td>
            <td style="color:var(--accent);">${p.avg}</td>
        </tr>`;
    }).join('');
}

// Preenche os selects do Comparador Histórico
function populateHistSelects() {
    let p1 = document.getElementById('hist-comp-p1');
    let p2 = document.getElementById('hist-comp-p2');
    if(!p1 || !p2) return;

    // Pega todos os jogadores que têm histórico no lbffData OU estão ativos
    let allHistoricalPlayers = new Set([
        ...Object.keys(lbffData),
        ...db.players.map(p => historicalAliases[p.jogador] || p.jogador)
    ]);

    let sortedPlayers = [...allHistoricalPlayers].sort((a,b) => a.localeCompare(b));

    let optionsHtml = sortedPlayers.map(p => `<option value="${p}">${p}</option>`).join('');
    p1.innerHTML = optionsHtml;
    p2.innerHTML = optionsHtml;

    // Seleciona um diferente pro P2 pra não começar espelhado
    if(p2.options.length > 1) p2.selectedIndex = 1;

    // Atualiza as edições disponíveis para os jogadores iniciais
    updateEditionOptions('hist-comp-p1', 'hist-comp-ed1');
    updateEditionOptions('hist-comp-p2', 'hist-comp-ed2');
}


function populateComparePlayerSelects(region = 'nacional') {
    const comparadorP1 = document.getElementById('comp-p1');
    const comparadorP2 = document.getElementById('comp-p2');
    if (!comparadorP1 || !comparadorP2) return;

    const previousP1 = comparadorP1.value;
    const previousP2 = comparadorP2.value;
    comparadorP1.innerHTML = '';
    comparadorP2.innerHTML = '';

    let playersSet = [];

    if (region === 'internacional') {
        playersSet = buildSEAComparePlayers().sort((a, b) => a.jogador.localeCompare(b.jogador, 'pt-BR'));
        if (!playersSet.length) {
            comparadorP1.innerHTML = '<option value="">Carregando FFWS SEA...</option>';
            comparadorP2.innerHTML = '<option value="">Carregando FFWS SEA...</option>';
            return;
        }
        playersSet.forEach(p => {
            const opt = `<option value="${escapeHtml(p.id)}">${escapeHtml(p.jogador)} (${escapeHtml(p.equipe)}) 🌏</option>`;
            comparadorP1.innerHTML += opt;
            comparadorP2.innerHTML += opt;
        });
    } else if (region === 'brxgringos') {
        const brPlayers = [...db.players].sort((a,b) => a.jogador.localeCompare(b.jogador, 'pt-BR'));
        const seaPlayers = buildSEAComparePlayers().sort((a, b) => a.jogador.localeCompare(b.jogador, 'pt-BR'));

        if (!seaPlayers.length) {
            comparadorP1.innerHTML = '<option value="">Carregando FFWS BR...</option>';
            comparadorP2.innerHTML = '<option value="">Carregando FFWS SEA...</option>';
            return;
        }

        brPlayers.forEach(p => {
            comparadorP1.innerHTML += `<option value="${escapeHtml(p.jogador)}">🇧🇷 ${escapeHtml(p.jogador)} (${escapeHtml(p.equipe)})</option>`;
        });

        seaPlayers.forEach(p => {
            comparadorP2.innerHTML += `<option value="${escapeHtml(p.id)}">🌏 ${escapeHtml(p.jogador)} (${escapeHtml(p.equipe)})</option>`;
        });
    } else {
        playersSet = [...db.players].sort((a,b) => a.jogador.localeCompare(b.jogador, 'pt-BR'));
        playersSet.forEach(p => {
            const opt = `<option value="${escapeHtml(p.jogador)}">${escapeHtml(p.jogador)} (${escapeHtml(p.equipe)})</option>`;
            comparadorP1.innerHTML += opt;
            comparadorP2.innerHTML += opt;
        });
    }

    if ([...comparadorP1.options].some(o => o.value === previousP1)) comparadorP1.value = previousP1;
    if ([...comparadorP2.options].some(o => o.value === previousP2)) comparadorP2.value = previousP2;
    if (comparadorP2.options.length > 1 && comparadorP1.value === comparadorP2.value) comparadorP2.selectedIndex = 1;
}

async function switchComparePlayerRegion() {
    const region = document.getElementById('comp-player-region')?.value || 'nacional';
    const result = document.getElementById('compare-players-result');

    if ((region === 'internacional' || region === 'brxgringos') && !seaDataLoaded) {
        if (result) result.innerHTML = '<div class="compare-box" style="grid-column:1/-1; color:var(--text-muted);">Carregando jogadores da FFWS SEA...</div>';
        await loadSEAData(true);
    }

    populateComparePlayerSelects(region);
    renderComparePlayers();
}

// Preenche os selects da aba Histórico
// Preenche os selects da aba Histórico
function populateSelects() {
    // --- 1. PREENCHIMENTO DAS EQUIPES ---
    let filtroGeral = document.getElementById('filter-equipe');

    // CORREÇÃO: O ID exato do HTML para a aba de Jogadores é 'filter-team-players'
    let filtroJogadores = document.getElementById('filter-team-players');

    let comparadorT1 = document.getElementById('comp-t1');
    let comparadorT2 = document.getElementById('comp-t2');

    // Ordenamos em ordem alfabética para ficar organizado
    let teamsSet = [...new Set(db.teams.map(t => t.equipe))].sort();

    teamsSet.forEach(equipe => {
        let opt = `<option value="${equipe}">${equipe}</option>`;
        if (filtroGeral) filtroGeral.innerHTML += opt;
        if (filtroJogadores) filtroJogadores.innerHTML += opt; // Agora ele vai preencher!
        if (comparadorT1) comparadorT1.innerHTML += opt;
        if (comparadorT2) comparadorT2.innerHTML += opt;
    });

    // --- 2. PREENCHIMENTO DOS JOGADORES (Aba Comparar) ---
    populateComparePlayerSelects(document.getElementById('comp-player-region')?.value || 'nacional');
    let comparadorP1 = document.getElementById('comp-p1');
    let comparadorP2 = document.getElementById('comp-p2');

    // Previne que o comparador comece com o mesmo time/jogador selecionado dos dois lados
    if (comparadorT2 && comparadorT2.options.length > 1) comparadorT2.selectedIndex = 1;
    if (comparadorP2 && comparadorP2.options.length > 1 && comparadorP1?.value === comparadorP2.value) comparadorP2.selectedIndex = 1;

    // --- 3. PREENCHIMENTO AUTOMÁTICO DOS DIAS (A Mágica) ---
    let playerDaySelect = document.getElementById('filter-player-day');
    if (playerDaySelect) {
        playerDaySelect.innerHTML = '<option value="all">Todos os Dias</option>';
        for (let i = 1; i <= TOTAL_DIAS; i++) {
            playerDaySelect.innerHTML += `<option value="${i}">Dia ${i}</option>`;
        }
    }

    // --- 4. RENDERIZA OS COMPARADORES PELA PRIMEIRA VEZ ---
    if (typeof renderCompareTeams === 'function') renderCompareTeams();
    if (typeof renderComparePlayers === 'function') renderComparePlayers();
}

// A função do Comparador
function renderHistCompare() {
    let p1Name = document.getElementById('hist-comp-p1').value;
    let p2Name = document.getElementById('hist-comp-p2').value;
    let ed1 = document.getElementById('hist-comp-ed1').value;
    let ed2 = document.getElementById('hist-comp-ed2').value;

    const getData = (pName, ed) => {
        if (ed === "WB 2026 S1") {
            let activeName = historicalAliases[pName] || pName;
            let activeP = db.players.find(x => x.jogador.toLowerCase() === activeName.toLowerCase());
            return { k: activeP ? activeP.abates||0 : 0, q: activeP ? activeP.quedas||0 : 0 };
        }
        return (lbffData[pName] && lbffData[pName][ed]) ? lbffData[pName][ed] : {k:0, q:0};
    };

    let d1 = getData(p1Name, ed1);
    let d2 = getData(p2Name, ed2);

    let avg1 = d1.q > 0 ? (d1.k/d1.q).toFixed(2) : "0.00";
    let avg2 = d2.q > 0 ? (d2.k/d2.q).toFixed(2) : "0.00";

    const buildRow = (label, v1, v2) => `
        <div class="stat-row">
            <div class="stat-val ${parseFloat(v1)>parseFloat(v2)?'winner':(parseFloat(v1)<parseFloat(v2)?'loser':'')}">${v1}</div>
            <div class="stat-label">${label}</div>
            <div class="stat-val ${parseFloat(v2)>parseFloat(v1)?'winner':(parseFloat(v2)<parseFloat(v1)?'loser':'')}">${v2}</div>
        </div>`;

    document.getElementById('hist-compare-result').innerHTML = `
        <div class="compare-box">
            <h2 style="color:#66b3ff; margin-bottom:5px;">${p1Name}</h2>
            <div style="color:var(--accent); font-weight:bold; font-size:0.9em; text-transform:uppercase;">${ed1}</div>
        </div>
        <div class="compare-box">
            <h2 style="color:#ff6666; margin-bottom:5px;">${p2Name}</h2>
            <div style="color:var(--accent); font-weight:bold; font-size:0.9em; text-transform:uppercase;">${ed2}</div>
        </div>
        <div class="hist-stats-full-width" style="grid-column: 1/-1; background:var(--panel-bg); border-radius:8px; padding:15px; border:1px solid var(--border);">
            ${buildRow('Abates (Kills)', d1.k, d2.k)}
            ${buildRow('Quedas Jogadas', d1.q, d2.q)}
            ${buildRow('Média K/D', avg1, avg2)}
        </div>`;
}

function updateEditionOptions(pSelectId, edSelectId) {
    let playerName = document.getElementById(pSelectId).value;
    let edSelect = document.getElementById(edSelectId);

    // Pega as edições que o jogador tem no lbffData (histórico)
    let availableEds = lbffData[playerName] ? Object.keys(lbffData[playerName]) : [];

    // Verifica se o jogador está jogando a WB 2026 S1 atual
    let activeName = historicalAliases[playerName] || playerName;
    let activeP = db.players.find(x => x.jogador.toLowerCase() === activeName.toLowerCase());
    if (activeP && !availableEds.includes("WB 2026 S1")) {
        availableEds.push("WB 2026 S1");
    }

    // Reconstruir o select apenas com as edições que ele realmente jogou
    edSelect.innerHTML = availableEds.map(ed => `<option value="${ed}">${ed}</option>`).join('');
}

function renderHistoricalRanking() {
    let tbody = document.querySelector('#table-history tbody');
    if(!tbody) return;

    const CURRENT_EDITION = "WB 2026 S1";

    // Constrói ranking a partir do lbffData, somando todas as edições por jogador
    let currentRankData = Object.entries(lbffData).map(([name, editions]) => {
        let histK = 0, histQ = 0;
        let preK = 0, preQ = 0; // kills ANTES da edição atual (para calcular shift)
        for (let ed in editions) {
            histK += editions[ed].k || 0;
            histQ += editions[ed].q || 0;
            if (ed !== CURRENT_EDITION) {
                preK += editions[ed].k || 0;
                preQ += editions[ed].q || 0;
            }
        }
        let activeName = historicalAliases[name] || name;
        let activePlayer = db.players.find(x => x.jogador.toLowerCase() === activeName.toLowerCase());
        let isPlaying = activePlayer && !activePlayer.isEx;
        return {
            originalName: name,
            activeName: activeName,
            isPlaying: isPlaying,
            equipe: isPlaying ? activePlayer.equipe : null,
            totalKills: histK + (activePlayer ? activePlayer.abates || 0 : 0),
            totalQuedas: histQ + (activePlayer ? activePlayer.quedas || 0 : 0),
            preKills: preK  // kills históricas sem a edição atual (para oldPos)
        };
    });

    // Calcula oldPos: posição antes da WB 2026 S1 (só kills históricas anteriores)
    let preSorted = [...currentRankData]
        .filter(p => p.preKills > 0)
        .sort((a, b) => b.preKills - a.preKills);
    preSorted.forEach((p, i) => { p.oldPos = i + 1; });

    // Jogadores que não tinham kills antes ficam sem referência de posição
    currentRankData.filter(p => p.preKills === 0).forEach(p => { p.oldPos = null; });

    currentRankData.sort((a, b) => b.totalKills - a.totalKills);

    let dataToShow = isAllTimeExpanded ? currentRankData : currentRankData.slice(0, 10);
    document.getElementById('btn-hist-all').innerText = isAllTimeExpanded ? 'Recolher' : 'Ver Mais';

    tbody.innerHTML = dataToShow.map((p, i) => {
        let newPos = i + 1;
        let shiftHtml;
        if (p.oldPos === null) {
            shiftHtml = `<span style="color:#4caf50; font-size:0.8em;">NOVO</span>`;
        } else {
            let diff = p.oldPos - newPos;
            shiftHtml = diff > 0 ? `<span style="color:#4caf50; font-size:0.8em;">▲${diff}</span>` : (diff < 0 ? `<span style="color:#f44336; font-size:0.8em;">▼${Math.abs(diff)}</span>` : `<span style="color:#888; font-size:0.8em;">-</span>`);
        }

        let nameShort = p.originalName.length > 7 ? p.originalName.substring(0, 6) + "..." : p.originalName;

        // Clique liberado para todos (Ativos e Inativos)
        let nameHtml = `
            <span class="clickable full-name-desktop" onclick="${_safePPAttr(p.activeName)}">${p.originalName}</span>
            <span class="clickable short-name-mobile" onclick="${_safePPAttr(p.activeName)}">${nameShort}</span>`;

        let teamHtml = p.isPlaying ?
            `<div class="team-cell" style="justify-content:center;"><img src="${logos[p.equipe]||''}" class="team-logo"><span class="hide-mobile">${shortNames[p.equipe] || p.equipe}</span></div>` :
            `<span style="color:#666; font-size:0.8em;">🚫</span>`;

        return `<tr>
            <td><div style="font-weight:bold; color:var(--accent);">${newPos}º</div>${shiftHtml}</td>
            <td style="text-align:left;">${nameHtml}</td>
            <td>${teamHtml}</td>
            <td style="color:#fff; font-weight:bold;">${p.totalKills}</td>
            <td>${p.totalQuedas}</td>
            <td style="color:var(--accent);">${(p.totalKills / (p.totalQuedas || 1)).toFixed(2)}</td>
        </tr>`;
    }).join('');
}

// Cartinha Especial Vermelha Seleção WB
function createSelectionCardHTML(p) {
    const role = playerRoles[p.jogador] || "RUSH";
    const photo = playerPhotos[p.jogador] || "silhueta.png";
    const teamLogo = logos[p.equipe] || "";
    const danoK = (p.dano / 1000).toFixed(1) + "K";
    const redAccent = "#ff0000";

    return `
        <div onclick="${_safePPAttr(p.jogador)}" style="cursor:pointer; width: 280px; height: 420px; background: #000; border: 4px solid ${redAccent}; border-radius: 15px; position: relative; overflow: hidden; box-shadow: 0 0 25px rgba(255, 0, 0, 0.5); margin: 0 auto;">
            <div style="position: absolute; inset: 0; background: radial-gradient(circle at 30% 30%, #400, #000); opacity: 0.95;"></div>

            <div style="position: absolute; top: 15px; left: 15px; z-index: 10; background: ${redAccent}; color: #fff; padding: 4px 12px; border-radius: 4px; font-size: 0.75em; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">
                SELEÇÃO DA SEMANA
            </div>

            <div style="position: absolute; top: 50px; left: 25px; z-index: 4; text-align: center; color: ${redAccent};">
                <div style="font-size: 22px; font-weight: 900;">${role}</div>
                <div style="margin: 8px auto; width: 35px; height: 3px; background: ${redAccent};"></div>
                <img src="${teamLogo}" style="width: 50px; height: 50px; object-fit: contain; margin-top: 5px; filter: drop-shadow(0 0 5px rgba(255,0,0,0.3));">
            </div>

            <img src="${photo}" style="position: absolute; top: 20px; right: -35px; height: 270px; z-index: 2; filter: drop-shadow(5px 5px 15px #000); -webkit-mask-image: linear-gradient(to bottom, black 75%, transparent 100%);">

            <div style="position: absolute; bottom: 0; width: 100%; height: 170px; background: linear-gradient(transparent, #000 45%); z-index: 3; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 20px;">
                <div style="color: #fff; font-size: 24px; font-weight: 900; text-transform: uppercase; padding: 6px 0;">${getDisplayName(p.jogador)}</div>

                <div style="display: flex; justify-content: space-around; width: 90%; color: #fff; border-top: 1px solid rgba(255,0,0,0.3); padding-top: 10px;">
                    <div style="text-align:center;">
                        <div style="font-size: 0.65em; color: #888;">KILLS</div>
                        <div style="font-size: 1.1em; font-weight: 900; color: ${redAccent};">${p.abates}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size: 0.65em; color: #888;">DANO</div>
                        <div style="font-size: 1.1em; font-weight: 900;">${danoK}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size: 0.65em; color: #888;">QUEDAS</div>
                        <div style="font-size: 1.1em; font-weight: 900;">${p.quedas}</div>
                    </div>
                </div>
            </div>
        </div>`;
}

function createPlayerCardHTML(p, scale = 1) {
    // 1. DEFINIÇÃO DO OVERALL (Prioriza o valor de lenda se existir)
    let ovr = p.ovrOverride ? p.ovrOverride : calculateOverall(p);

    // 2. LÓGICA DE FOTO (Fallback para silhueta se estiver vazio ou não existir)
    let photoKey = Object.keys(playerPhotos).find(k => k.toLowerCase() === p.jogador.toLowerCase().trim());
    let photo = (photoKey && playerPhotos[photoKey]) ? playerPhotos[photoKey] : "silhueta.png";

    // 3. CORES E ESTILO BASEADO NA NOTA
    let accentColor = "#cd7f32"; // Bronze (Padrão)
    if (ovr >= 95) accentColor = "#00c8ff";      // Diamante/Lendário Plus
    else if (ovr >= 90) accentColor = "#d4af37"; // Ouro Lendário
    else if (ovr >= 85) accentColor = "#c5a028"; // Ouro Elite
    else if (ovr >= 80) accentColor = "#e5e5e5"; // Prata Brilhante
    else if (ovr >= 75) accentColor = "#a3a3a3"; // Prata

    let glow = ovr >= 90 ? `box-shadow: 0 0 30px ${accentColor}66;` : '';

    // 4. FORMATAÇÃO DE DADOS
    let role = playerRoles[p.jogador] || "RUSH";
    let teamLogo = logos[p.equipe] || "escudo.webp";
    let danoK = (p.dano / 1000).toFixed(1) + "K";

    // 5. BADGES (Inativo e Capitão)
    let exBadge = p.isEx ? `<div style="position: absolute; top: 18px; left: -35px; background: #f44336; color: #fff; font-size: 0.7em; font-weight: bold; padding: 5px 35px; transform: rotate(-45deg); z-index: 10; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">Inativo</div>` : '';

    let captainBadge = (typeof playerCaptains !== 'undefined' && playerCaptains[p.jogador]) ?
        `<img src="cpt.png" style="position: absolute; top: 20px; right: 15px; z-index: 5; width: 35px; filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.5));">` : '';

    let marginStyle = scale !== 1 ? `transform: scale(${scale}); margin: -15px;` : `margin: 0 auto;`;

    return `
        <div onclick="${_safePPAttr(p.jogador)}" style="cursor:pointer; width: 280px; height: 420px; background: #000; border: 3px solid ${accentColor}; border-radius: 15px; position: relative; overflow: hidden; font-family: sans-serif; ${glow} ${marginStyle}">
            <div style="position: absolute; inset: 0; background: radial-gradient(circle at 30% 30%, #222, #000); opacity: 0.9;"></div>
            ${exBadge}
            ${captainBadge}

            <div style="position: absolute; top: 40px; left: 25px; z-index: 4; text-align: center; color: ${accentColor};">
                <div style="font-size: 58px; font-weight: 900; line-height: 0.8;">${ovr}</div>
                <div style="font-size: 22px; font-weight: bold; margin-top: 5px;">${role}</div>
                <div style="margin: 15px auto; width: 40px; height: 2px; background: ${accentColor}; opacity: 0.6;"></div>
                <img src="https://upload.wikimedia.org/wikipedia/commons/0/05/Flag_of_Brazil.svg" style="width: 35px; border-radius: 2px; display: block; margin: 8px auto;">
                <img src="${teamLogo}" onerror="this.src='escudo.webp'" style="width: 50px; height: 50px; object-fit: contain; display: block; margin: 10px auto;">
            </div>

            <img src="${photo}" onerror="this.src='silhueta.png'" style="position: absolute; top: 20px; right: -30px; height: 260px; z-index: 2; -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 100%);">

            <div style="position: absolute; bottom: 0; width: 100%; height: 185px; background: linear-gradient(transparent, #000 35%); z-index: 3; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 12px;">
                <div style="width: 100%; text-align: center; margin-bottom: 8px;">
                    <div style="margin: 0 auto; width: 85%; height: 1px; background: linear-gradient(90deg, transparent, ${accentColor}, transparent);"></div>
                    <div style="color: #fff; font-size: 24px; font-weight: 900; text-transform: uppercase; padding: 6px 0;">${getDisplayName(p.jogador)}</div>
                    <div style="margin: 0 auto; width: 85%; height: 1px; background: linear-gradient(90deg, transparent, ${accentColor}, transparent);"></div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 2px; color: #fff; width: 100%; align-items: center; text-transform: uppercase;">
                    <div style="font-size: 13px; font-weight: bold;"><span style="font-weight: 900; color: ${accentColor}; font-size: 16px;">${p.abates}</span> ABATES</div>
                    <div style="font-size: 13px; font-weight: bold;"><span style="font-weight: 900; color: ${accentColor}; font-size: 16px;">${p.assists}</span> ASSISTÊNCIAS</div>
                    <div style="font-size: 13px; font-weight: bold;"><span style="font-weight: 900; color: ${accentColor}; font-size: 16px;">${danoK}</span> DANO</div>
                    <div style="font-size: 13px; font-weight: bold;"><span style="font-weight: 900; color: ${accentColor}; font-size: 16px;">${p.quedas}</span> QUEDAS</div>
                </div>
            </div>
        </div>`;
}

function autoCalculateTotals() {
    // 0. Garante que as listas existam dentro do db
    db.teamDaily = {};
    db.playerDaily = [];

    // 1. GERA O db.teamDaily A PARTIR DO dbQuedas
    for (let dia in dbQuedas) {
        for (let queda in dbQuedas[dia]) {
            let drop = dbQuedas[dia][queda];
            drop.resultados.forEach(res => {
                if (!db.teamDaily[res.equipe]) db.teamDaily[res.equipe] = [];

                let diaNum = Number(dia);
                let dayEntry = db.teamDaily[res.equipe].find(d => d.dia === diaNum);

                let ptsPosicao = posPoints[res.posicao] || 0;
                let ptsTotal = ptsPosicao + res.kills;

                if (!dayEntry) {
                    db.teamDaily[res.equipe].push({
                        dia: diaNum,
                        pontos: ptsTotal,
                        booyah: res.booyah,
                        abates: res.kills,
                        quedas: 1 // AGORA ELE COMEÇA CONTANDO 1 QUEDA
                    });
                } else {
                    dayEntry.pontos += ptsTotal;
                    dayEntry.booyah += res.booyah;
                    dayEntry.abates += res.kills;
                    dayEntry.quedas += 1; // E VAI SOMANDO 1 A CADA MAPA
                }
            });
        }
    }

    // 2. GERA O db.playerDaily A PARTIR DO dbJogadoresQuedas
    let playerAggregator = {};

    for (let dia in dbJogadoresQuedas) {
        for (let queda in dbJogadoresQuedas[dia]) {
            dbJogadoresQuedas[dia][queda].forEach(p => {
                let key = `${p.nome}-${dia}`;
                if (!playerAggregator[key]) {
                    playerAggregator[key] = {
                        jogador: p.nome, equipe: p.equipe, dia: Number(dia),
                        abates: 0, dano: 0, assists: 0, quedas: 0, mvp: 0
                    };
                }
                playerAggregator[key].abates += p.kills;
                playerAggregator[key].dano += p.dano;
                playerAggregator[key].assists += p.assists;
                playerAggregator[key].mvp += (p.mvp || 0);
                playerAggregator[key].quedas += 1;
            });
        }
    }
    db.playerDaily = Object.values(playerAggregator);

    // 3. ATUALIZA OS TOTAIS GERAIS (db.players e db.teams)
    db.players.forEach(p => {
        const dailyData = db.playerDaily.filter(d => d.jogador === p.jogador);
        const totals = dailyData.reduce((acc, curr) => {
            acc.abates += curr.abates; acc.dano += curr.dano; acc.assists += curr.assists;
            acc.quedas += curr.quedas; acc.mvp += curr.mvp;
            if (curr.abates > acc.recorde) acc.recorde = curr.abates;
            return acc;
        }, { abates: 0, dano: 0, assists: 0, quedas: 0, mvp: 0, recorde: 0 });
        Object.assign(p, totals);
    });

    db.teams.forEach(t => {
        const daily = db.teamDaily[t.equipe] || [];
        const totals = daily.reduce((acc, curr) => {
            acc.pontos += curr.pontos; acc.booyah += curr.booyah;
            acc.abates += curr.abates; acc.quedas += curr.quedas; // USA AS QUEDAS REAIS AQUI
            return acc;
        }, { pontos: 0, booyah: 0, abates: 0, quedas: 0 });
        Object.assign(t, totals);
    });
}

async function loadLbffData() {
    if (lbffLoaded) return; // Se já estiver cheia, não faz nada
    try {
        const response = await fetch('lbffData.json');
        if (!response.ok) throw new Error("Erro ao carregar lbffData.json");

        // Aqui a mágica acontece: a variável global recebe os dados do arquivo
        lbffData = await response.json();

        lbffLoaded = true;
        console.log("Dados históricos carregados com sucesso!");
    } catch (e) {
        console.error("Falha ao carregar LBFF Data:", e);
    }
}

// Função para converter "25 de Abril" em um objeto Date do JS
function parseMatchDate(dateStr) {
    const months = { "Janeiro": 0, "Fevereiro": 1, "Março": 2, "Abril": 3, "Maio": 4, "Junho": 5 };
    const parts = dateStr.split(" de ");
    const day = parseInt(parts[0]);
    const month = months[parts[1]];
    // Define a data para o ano de 2026, às 13:00:00
    return new Date(2026, month, day, 13, 0, 0);
}


