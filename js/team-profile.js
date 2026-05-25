// ============== TEAM PROFILE E MODAL ==============
function cffFormatCompactStat(value) {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 1000000) return `${Math.floor(n / 1000000)}M`;
    if (Math.abs(n) >= 1000) return `${Math.floor(n / 1000)}k`;
    return String(n);
}

function openStaffProfile(staffName) {
    let s = dbStaff.find(x => x.nome === staffName);
    if(!s) return;

    let t = db.teams.find(x => x.equipe === s.equipe);

    document.getElementById('sp-name').innerText = getDisplayName(s.nome);
    document.getElementById('sp-role').innerText = s.cargo;
    document.getElementById('sp-team-name').innerText = s.equipe;
    document.getElementById('sp-team-name').onclick = () => openTeamProfile(s.equipe);
    document.getElementById('sp-team-logo').src = logos[s.equipe] || '';

    // Foto com Zoom
    let photoEl = document.getElementById('sp-photo');
    if(photoEl) {
        let photoKey = Object.keys(staffPhotos).find(k => k.toLowerCase() === s.nome.toLowerCase().trim());
        photoEl.src = photoKey ? staffPhotos[photoKey] : 'silhueta.png';
    }

    // Link para Carreira como Jogador
    let isPlayer = db.players.find(p => checkNameMatch(p.jogador, s.nome)) || Object.keys(lbffData).find(name => checkNameMatch(name, s.nome));
    let linkContainer = document.getElementById('sp-player-link-container');
    if(linkContainer) {
        linkContainer.innerHTML = isPlayer ?
            `<button class="btn-action" onclick="${_safePPAttr(s.nome)}" style="background: rgba(102, 179, 255, 0.1); border: 1px solid #66b3ff; color: #66b3ff; font-size: 0.85em; margin-bottom: 15px; width: 100%;">Ver Carreira como Jogador 🎮</button>` : '';
    }

    // Stats da Equipa e Troféus
    if(t) {
        document.getElementById('sp-team-pos').innerText = `${t.posGeral}º`;
        document.getElementById('sp-team-pts').innerText = t.pontos;
        document.getElementById('sp-team-booyah').innerText = t.booyah;
        document.getElementById('sp-team-avg').innerText = (t.pontos / (t.quedas || 1)).toFixed(1);
    }

// Troféus Unificados
    renderUnifiedTrophies(s.nome, 'sp-trophies-container');

    // --- LINHA DO TEMPO DE EQUIPES ---
    renderHistoricoEquipes(s.nome, 'sp-team-history-container'); // <- ADICIONE AQUI

    navigate('staff-profile');
    // Lógica do Instagram
    let insta = dbSocials[s.nome];
    let container = document.getElementById('sp-insta-container');
    if(container) {
        container.innerHTML = insta ? `
            <a href="https://instagram.com/${insta}" target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 10px; text-decoration: none; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); padding: 12px 25px; border-radius: 30px; margin: 10px auto; width: fit-content; transition: 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                <img src="instagram.png" style="width: 20px;">
                <span style="color: #fff; font-weight: bold; font-size: 1.1em;">@${insta}</span>
            </a>` : '';
    }

    navigate('staff-profile');
}

async function openResultsModal() {
    await loadResults();
    if (typeof loadTeamAliases === 'function') await loadTeamAliases();
    if (typeof loadNovosTorneios === 'function' && (typeof novosTorneiosLoaded === 'undefined' || !novosTorneiosLoaded)) {
        await loadNovosTorneios();
    }
    renderTeamResults();
    document.getElementById('results-modal-title').innerText = `Resultados: ${currentTeamView}`;
    document.getElementById('results-modal').classList.add('active');
}

// (handleGlobalSearch redirecionada para handleGlobalSearchFrom — ver acima)

function renderTeamProfileStats() {
    let tName = currentTeamView;
    let t = db.teams.find(x => x.equipe.toUpperCase() === tName.toUpperCase());

    // Se a equipa não for encontrada na WB atual, tratamos como Histórica
    if(!t) {
        t = { equipe: tName, grupo: "Histórico/Outro" };
    }
    let isHist = t.grupo === "Histórico/Outro";

    // Mapeamento de elementos do DOM
    let evolutionContainer = document.getElementById('tp-evolution-container'); // <-- ESSA LINHA FALTAVA
    let bestWorstContainer = document.getElementById('tp-best-worst-container');
    let statsContainer = document.getElementById('tp-stats-container');
    let confResult = document.getElementById('tp-confrontation-result');
    let btnConf = document.getElementById('btn-confrontation');
    let cardsContainer = document.getElementById('tp-players-cards-container');
    let internalTableWrap = document.querySelector('#table-team-players') ? document.querySelector('#table-team-players').parentElement : null;
    let headers = document.querySelectorAll('#team-profile h3');
    let filters = document.querySelectorAll('#team-profile .filters');

    if (isHist) {
        // MODO: EQUIPE HISTÓRICA

        // 1. Ocultar componentes da temporada ativa
        if(evolutionContainer) evolutionContainer.style.display = 'none';
        if(bestWorstContainer) bestWorstContainer.style.display = 'none';
        if(statsContainer) statsContainer.style.display = 'none';
        if(confResult) confResult.style.display = 'none';
        if(btnConf) btnConf.style.display = 'none';
        if(internalTableWrap) internalTableWrap.style.display = 'none';
        filters.forEach(f => { if(!f.id.includes('day-filters')) f.style.display = 'none'; });

        // 2. Ajustar Títulos
        headers.forEach(h => {
            let text = h.innerText.toUpperCase();
            if(text.includes('DESEMPENHO') || text.includes('CLASSIFICAÇÃO INTERNA') || text.includes('EVOLUÇÃO')) {
                h.style.display = 'none';
            }
            if(text.includes('JOGADORES E STAFF') || text.includes('JOGADORES NOTÁVEIS')) {
                h.innerText = 'JOGADORES NOTÁVEIS';
                h.style.display = 'block';
            }
        });

        // 3. Lógica de Jogadores Notáveis (Top 5 Kills da História na Org)
        let notablePlayers = [];
        if (typeof dbPassagens !== 'undefined') {
            let playersWithPassage = dbPassagens.filter(p =>
                p.passagens.some(pass => (typeof sameTeamName === 'function' ? sameTeamName(pass.equipe, tName) : pass.equipe.toUpperCase() === tName.toUpperCase()) && pass.cargo.toUpperCase() === "JOGADOR")
            );

            playersWithPassage.forEach(pt => {
                let playerName = pt.jogador;
                let hKills = 0, hQuedas = 0;

                // Soma dados históricos via lbffData
                let histRecord = typeof lbffData !== 'undefined' ? getHistTotals(playerName) : { k: 0, q: 0 };
                let lbffEntry = histRecord.entry;

                if (histRecord.k > 0 || histRecord.q > 0) {
                    hKills = histRecord.k; hQuedas = histRecord.q;
                }

                // Soma desempenho da temporada atual se estiver ativo
                let activeName = (typeof getCanonicalPlayerName === 'function') ? getCanonicalPlayerName(playerName) : ((typeof historicalAliases !== 'undefined' && historicalAliases[playerName]) || playerName);
                let activeP = db.players.find(x => x.jogador.toLowerCase() === activeName.toLowerCase());
                if (activeP) {
                    hKills += (activeP.abates || 0);
                    hQuedas += (activeP.quedas || 0);
                }

                if (hKills > 0) {
                    notablePlayers.push({
                        jogador: playerName,
                        equipe: tName,
                        abates: hKills,
                        quedas: hQuedas,
                        dano: hKills * 450, // Estimativa para preenchimento visual
                        assists: Math.floor(hKills * 0.3),
                        ovrOverride: 0 // Será calculado abaixo
                    });
                }
            });
        }

        notablePlayers.sort((a,b) => b.abates - a.abates);
        let top5 = notablePlayers.slice(0, 5);

        if (cardsContainer) {
            if (top5.length > 0) {
                cardsContainer.innerHTML = top5.map(p => {
                    let pCard = { ...p };
                    pCard.ovrOverride = calculateHistoricalOverall(p); // Usa o cálculo de lenda
                    return createPlayerCardHTML(pCard, 0.85);
                }).join('');
            } else {
                cardsContainer.innerHTML = '<div style="color:#888; text-align:center; width:100%; padding: 20px;">Sem registo de jogadores notáveis para esta organização.</div>';
            }
        }

    } else {
        // MODO: EQUIPE ATIVA

        if(evolutionContainer) evolutionContainer.style.display = 'block';
        if(bestWorstContainer) bestWorstContainer.style.display = 'block';
        if(statsContainer) statsContainer.style.display = 'block';
        if(confResult) confResult.style.display = 'block';
        if(btnConf) btnConf.style.display = 'inline-block';
        if(internalTableWrap) internalTableWrap.style.display = 'block';
        filters.forEach(f => f.style.display = 'flex');

        headers.forEach(h => {
            let text = h.innerText.toUpperCase();
            if(text.includes('DESEMPENHO') || text.includes('CLASSIFICAÇÃO INTERNA') || text.includes('EVOLUÇÃO')) h.style.display = 'block';
            if(text.includes('JOGADORES NOTÁVEIS') || text.includes('JOGADORES E STAFF')) {
                h.innerText = 'JOGADORES E STAFF';
                h.style.display = 'block';
            }
        });

        // Cálculo de estatísticas da temporada
        let allTeamsStats = [];
        db.teams.forEach(team => {
            let daily = db.teamDaily[team.equipe] || [];
            let pDaily = db.playerDaily.filter(p => p.equipe === team.equipe);
            if (selectedTpDays.length > 0) {
                daily = daily.filter(d => selectedTpDays.includes(String(d.dia)));
                pDaily = pDaily.filter(p => selectedTpDays.includes(String(p.dia)));
            }
            let stats = daily.reduce((acc, curr) => {
                acc.pontos += curr.pontos; acc.abates += curr.abates; acc.booyah += curr.booyah; acc.quedas += curr.quedas; return acc;
            }, {pontos: 0, abates: 0, booyah: 0, quedas: 0});
            let danoTotal = pDaily.reduce((sum, p) => sum + p.dano, 0);

            allTeamsStats.push({ equipe: team.equipe, pontos: stats.pontos, abates: stats.abates, pontos_pos: stats.pontos - stats.abates, dano: danoTotal, booyah: stats.booyah, quedas: stats.quedas, dias: daily.length });
        });

        let cur = allTeamsStats.find(x => x.equipe === tName);

        if(bestWorstContainer && db.teamDaily[tName]) {
            let sorted = [...db.teamDaily[tName]].sort((a,b) => b.pontos - a.pontos);
            if(sorted.length > 0) {
                bestWorstContainer.innerHTML = `
                    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                        <div class="card" style="flex: 1; border-left: 4px solid #4caf50;"><h3 style="font-size: 0.8em;">🏆 Melhor Dia</h3><div class="value" style="font-size: 1.5em;">${sorted[0].pontos} <span style="font-size: 0.5em; color: #888;">PTS (DIA ${sorted[0].dia})</span></div></div>
                        <div class="card" style="flex: 1; border-left: 4px solid #f44336;"><h3 style="font-size: 0.8em;">⚠️ Pior Dia</h3><div class="value" style="font-size: 1.5em;">${sorted[sorted.length-1].pontos} <span style="font-size: 0.5em; color: #888;">PTS (DIA ${sorted[sorted.length-1].dia})</span></div></div>
                    </div>`;
            }
        }

        if(statsContainer && cur) {
            let gridCSS = window.innerWidth > 1000 ? "grid-template-columns: repeat(5, 1fr);" : "grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));";
            statsContainer.innerHTML = `
                <div style="display: grid; ${gridCSS} gap: 15px; margin-bottom: 15px;">
                    <div class="card"><div class="card-top-border"></div><h3>Média Pts</h3><div class="value">${(cur.pontos/(cur.quedas||1)).toFixed(1)}</div></div>
                    <div class="card"><div class="card-top-border"></div><h3>Média Kills</h3><div class="value">${(cur.abates/(cur.quedas||1)).toFixed(1)}</div></div>
                    <div class="card"><div class="card-top-border"></div><h3>Média Pos</h3><div class="value">${(cur.pontos_pos/(cur.quedas||1)).toFixed(1)}</div></div>
                    <div class="card"><div class="card-top-border"></div><h3>Média Dano</h3><div class="value">${(cur.dano/(cur.quedas||1)).toFixed(0)}</div></div>
                    <div class="card"><div class="card-top-border"></div><h3>Booyahs</h3><div class="value">${cur.booyah}</div></div>
                </div>`;
        }

// Jogadores Ativos (Top 5)
        let pRaw = db.playerDaily.filter(p => p.equipe === tName);
        if (selectedTpDays.length > 0) pRaw = pRaw.filter(p => selectedTpDays.includes(String(p.dia)));

        let agg = {};
        pRaw.forEach(row => {
            if (!agg[row.jogador]) agg[row.jogador] = { jogador: row.jogador, equipe: row.equipe, quedas: 0, abates: 0, dano: 0, assists: 0, mvp: 0 };
            agg[row.jogador].quedas += row.quedas; agg[row.jogador].abates += row.abates;
            agg[row.jogador].dano += row.dano; agg[row.jogador].assists += row.assists;
            agg[row.jogador].mvp += (row.mvp || 0);
        });

        let marketDepartures = (typeof cffGetTeamMercadoDepartures === 'function') ? cffGetTeamMercadoDepartures(tName) : [];
        let playersList = Object.values(agg).map(p => {
            let dbP = db.players.find(x => x.jogador === p.jogador || (typeof checkNameMatch === 'function' && checkNameMatch(x.jogador, p.jogador)));
            let mercadoExit = (typeof cffPlayerHasLeftTeam === 'function') ? cffPlayerHasLeftTeam(p.jogador, tName) : false;
            p.isEx = !!(mercadoExit || (dbP && dbP.isEx));
            p.mercadoExit = !!mercadoExit;
            p.dataSaida = (dbP && dbP.dataSaida) || '';
            return p;
        });

        marketDepartures.forEach(exit => {
            const exists = playersList.some(p => typeof checkNameMatch === 'function' ? checkNameMatch(p.jogador, exit.jogador) : String(p.jogador).toLowerCase() === String(exit.jogador).toLowerCase());
            if (exists) return;
            playersList.push({
                jogador: exit.jogador,
                equipe: tName,
                quedas: 0,
                abates: 0,
                dano: 0,
                assists: 0,
                mvp: 0,
                isEx: true,
                mercadoExit: true,
                dataSaida: exit.data || ''
            });
        });

        let ativos = playersList.filter(p => !p.isEx).sort((a,b) => b.abates - a.abates);
        // Alterado de 4 para 5 abaixo:
        let topAtivos = ativos.slice(0, 6);
        let inativos = playersList.filter(p => p.isEx).sort((a,b) => b.abates - a.abates);

if (cardsContainer) {
            // Grid: até 5 jogadores = 1 linha com 5; mais de 5 = 2 linhas com 3.
            // Se a planilha do Mercado marcou saída coletiva, os jogadores saem do elenco ativo automaticamente.
            const numAtivos = topAtivos.length;
            if (window.innerWidth > 768 && numAtivos > 0) {
                cardsContainer.style.display = "grid";
                cardsContainer.style.gridTemplateColumns = numAtivos <= 5 ? `repeat(${numAtivos}, auto)` : "repeat(3, auto)";
                cardsContainer.style.justifyContent = "center";
                cardsContainer.style.gap = "20px";
            } else {
                cardsContainer.style.display = "flex";
                cardsContainer.style.flexWrap = "wrap";
                cardsContainer.style.justifyContent = "center";
                cardsContainer.style.gap = "20px";
            }
            cardsContainer.style.maxWidth = "none";
            cardsContainer.style.margin = "0 auto 30px auto";

            let html = topAtivos.length
                ? topAtivos.map(p => createPlayerCardHTML(p, 0.85)).join('')
                : (marketDepartures.length > 0
                    ? `<div class="team-roster-update-empty">Elenco em atualização após saídas recentes.</div>`
                    : '');

            if (inativos.length > 0) {
                html += `
                <div style="width: 100%; grid-column: 1 / -1; text-align: center; margin-top: 15px;">
                    <button class="btn-action" onclick="let c = document.getElementById('ex-players-div'); if(c.style.display==='none'){c.style.display='flex'; this.innerText='Ocultar saídas / ex-jogadores';}else{c.style.display='none'; this.innerText='Ver saídas / ex-jogadores';}" style="background: transparent; border: 1px solid var(--border); color: var(--text-muted); font-size: 0.85em; padding: 8px 15px;">Ver saídas / ex-jogadores</button>
                </div>
                <div id="ex-players-div" style="display: none; width: 100%; grid-column: 1 / -1; justify-content: center; gap: 20px; flex-wrap: wrap; margin-top: 10px; padding-top: 25px; border-top: 1px dashed #333;">
                    ${inativos.map(p => createPlayerCardHTML(p, 0.85)).join('')}
                </div>`;
            }

            let staffList = dbStaff.filter(s => s.equipe === tName);
            if (staffList.length > 0) {
                html += `<div style="width: 100%; grid-column: 1 / -1; display: flex; justify-content: center; gap: 15px; margin-top: 25px; flex-wrap: wrap;">
                    ${staffList.map(s => {
                        let photoKey = Object.keys(staffPhotos).find(k => k.toLowerCase() === s.nome.toLowerCase().trim());
                        let photo = photoKey ? staffPhotos[photoKey] : 'silhueta.png';
                        return `
                        <div onclick="openStaffProfile('${s.nome}')" style="cursor: pointer; background: #1c1c20; border: 1px solid var(--border); padding: 15px; border-radius: 12px; min-width: 160px; text-align: center;">
                            <div style="width: 70px; height: 70px; border-radius: 50%; overflow: hidden; margin: 0 auto 10px auto; border: 2px solid var(--accent);"><img src="${photo}" style="width: 100%; height: 100%; object-fit: cover; object-position: center 15%; transform: scale(1.25);"></div>
                            <div style="color: #fff; font-size: 1em; font-weight: bold;">${s.nome}</div>
                            <div style="color: var(--accent); font-size: 0.75em; text-transform: uppercase; font-weight: 900;">${s.cargo}</div>
                        </div>`;
                    }).join('')}
                </div>`;
            }
            cardsContainer.innerHTML = html;
        }

        let tbody = document.querySelector('#table-team-players tbody');
        if(tbody) {
            tbody.innerHTML = playersList.sort((a,b) => b.abates - a.abates).map(p => {
                const exitBadge = p.isEx ? ' <span class="team-player-ex-badge">saiu</span>' : '';
                return `<tr class="${p.isEx ? 'team-player-row-ex' : ''}"><td style="text-align:left;"><span class="clickable" onclick="${_safePPAttr(p.jogador)}">${p.jogador}</span>${exitBadge}</td><td style="color:var(--accent); font-weight:bold;">${p.abates}</td><td data-sort-value="${p.dano}">${cffFormatCompactStat(p.dano)}</td><td>${p.assists}</td><td>${p.quedas}</td><td>${p.mvp || 0}</td></tr>`;
            }).join('');
        }

        // Aqui garantimos que o gráfico só é gerado e atualizado para equipes ATIVAS
        renderTeamChart();
    }

    renderTeamTrophies(tName);
}

// Função auxiliar para renderizar os troféus da equipe
function renderTeamTrophies(teamName) {
    let container = document.getElementById('tp-trophies-container');
    if(!container) return;

    const aliasSet = (typeof getTeamAliasSet === 'function') ? getTeamAliasSet(teamName) : new Set([String(teamName).toUpperCase()]);
    const matchesTeam = (name) => aliasSet.has(typeof normalizeTeamAlias === 'function' ? normalizeTeamAlias(name) : String(name).toUpperCase());

    const staticCollective = (titlesData.coletivos || []).filter(t => matchesTeam(t.team));
    const novosCollective = (typeof getNovosTorneiosCollectiveTitlesForTeam === 'function') ? getNovosTorneiosCollectiveTitlesForTeam(teamName) : [];
    const individualAwards = (typeof getNovosTorneiosIndividualAwardsForTeam === 'function') ? getNovosTorneiosIndividualAwardsForTeam(teamName) : [];

    const collectiveTitles = [...staticCollective, ...novosCollective];

    if (collectiveTitles.length === 0 && individualAwards.length === 0) {
        container.innerHTML = '<div style="color:#888; text-align:center; width:100%; padding:20px;">Nenhum título oficial registrado para esta organização.</div>';
        return;
    }

    const collectiveHtml = collectiveTitles.length ? `
        <div style="width:100%; color:#ffd700; font-weight:900; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Títulos coletivos</div>
        ${collectiveTitles.map(t => {
            if (typeof buildUnifiedTrophyCard === 'function') return buildUnifiedTrophyCard({ ...t, type: t.type || 'Campeão' });
            let tournamentImg = resolveLeagueLogo(t.event);
            return `<div class="trophy-card border-campeao"><img src="${tournamentImg}" class="trophy-img" onerror="this.src='trofeu.webp'"><div>${t.event}</div><div>Campeão</div></div>`;
        }).join('')}` : '';

    const individualHtml = individualAwards.length ? `
        <div style="width:100%; color:var(--accent); font-weight:900; text-transform:uppercase; letter-spacing:1px; margin:16px 0 4px;">Títulos individuais</div>
        ${individualAwards.map(t => typeof buildUnifiedTrophyCard === 'function'
            ? buildUnifiedTrophyCard(t, { showPlayer: true })
            : `<div class="trophy-card border-mvp"><div>${t.event}</div><div>${t.type}</div><div>${t.player}</div></div>`
        ).join('')}` : '';

    container.innerHTML = collectiveHtml + individualHtml;
}

function getConfrontationData() {
    let tName = currentTeamView;
    let t = db.teams.find(x => x.equipe === tName);
    let oppGroup = document.getElementById('tp-opp-group').value;

    let teamDays = db.teamDaily[tName] ? db.teamDaily[tName].map(d => d.dia) : [];
    let oppTeamObj = db.teams.find(x => x.grupo === oppGroup);
    let oppDays = (oppTeamObj && db.teamDaily[oppTeamObj.equipe]) ? db.teamDaily[oppTeamObj.equipe].map(d => d.dia) : [];

    let intersectionDays = teamDays.filter(d => oppDays.includes(d));
    return { tName, t, oppGroup, intersectionDays };
}

function renderTeamConfrontation() {
    let { tName, t, oppGroup, intersectionDays } = getConfrontationData();
    let container = document.getElementById('tp-confrontation-result');
    let btn = document.getElementById('btn-confrontation');
    currentOppGroup = oppGroup;

    if (intersectionDays.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; color:#aaa; text-align:center; padding: 20px;">Nenhum confronto direto registrado contra o Grupo ${oppGroup} até o momento.</div>`;
        btn.style.display = 'none';
        return;
    }

    btn.style.display = 'inline-block';

    let stats = db.teamDaily[tName].filter(d => intersectionDays.includes(d.dia)).reduce((acc, curr) => {
        acc.pontos += curr.pontos; acc.abates += curr.abates; acc.booyah += curr.booyah; acc.quedas += curr.quedas; // USA AS QUEDAS REAIS
        return acc;
    }, {pontos: 0, abates: 0, booyah: 0, quedas: 0});

    let pDaily = db.playerDaily.filter(p => p.equipe === tName && intersectionDays.includes(p.dia));
    let totalDano = pDaily.reduce((sum, p) => sum + p.dano, 0);

    let ptsColocacao = stats.pontos - stats.abates;
    let totalQuedas = stats.quedas; // AGORA PEGA O REAL
    let totalDias = intersectionDays.length;

    // ... O resto continua idêntico (calcula rank e cria HTML) ...
    let teamsOverallPoints = {};
    db.teams.forEach(tm => {
        if(db.teamDaily[tm.equipe]) {
            let pts = db.teamDaily[tm.equipe].filter(d => intersectionDays.includes(d.dia)).reduce((sum, d) => sum + d.pontos, 0);
            if (pts > 0) teamsOverallPoints[tm.equipe] = pts;
        }
    });

    let sortedTeams = Object.keys(teamsOverallPoints).sort((a,b) => teamsOverallPoints[b] - teamsOverallPoints[a]);
    let rankInConfrontation = sortedTeams.indexOf(tName) + 1;
    let totalTeamsMatched = sortedTeams.length;

    container.style.display = "block";
    let gridCSS = window.innerWidth > 1000 ? "grid-template-columns: repeat(5, 1fr);" : "grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));";

    container.innerHTML = `
        <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; margin-bottom: 15px;">
            <div class="card" style="flex: 1 1 300px; max-width: 450px; border-left: 4px solid var(--accent);">
                <h3>Quedas Jogadas</h3>
                <div class="value">${totalQuedas}</div>
                <div style="color:#888;font-size:0.85em;margin-top:5px;">Em ${totalDias} dias de jogo contra o Grupo ${oppGroup}</div>
            </div>
            <div class="card" style="flex: 1 1 300px; max-width: 450px; border-left: 4px solid #66b3ff;">
                <h3>Rank no Confronto</h3>
                <div class="value">#${rankInConfrontation} <span style="font-size:0.4em;color:#aaa">de ${totalTeamsMatched}</span></div>
                <div style="color:#888;font-size:0.85em;margin-top:5px;">Posição geral entre os grupos no período</div>
            </div>
        </div>

        <div style="display: grid; ${gridCSS} gap: 15px; margin-bottom: 15px;">
            <div class="card"><div class="card-top-border"></div><h3 style="font-size:0.9em">Média Pts</h3><div class="value">${(stats.pontos/totalQuedas).toFixed(1)}</div><div style="color:#888;font-size:0.8em;margin-top:5px;">Por queda</div></div>
            <div class="card"><div class="card-top-border"></div><h3 style="font-size:0.9em">Média Abates</h3><div class="value">${(stats.abates/totalQuedas).toFixed(1)}</div><div style="color:#888;font-size:0.8em;margin-top:5px;">Por queda</div></div>
            <div class="card"><div class="card-top-border"></div><h3 style="font-size:0.9em">Média Colocação</h3><div class="value">${(ptsColocacao/totalQuedas).toFixed(1)}</div><div style="color:#888;font-size:0.8em;margin-top:5px;">Por queda</div></div>
            <div class="card"><div class="card-top-border"></div><h3 style="font-size:0.9em">Média Dano</h3><div class="value">${(totalDano/totalQuedas).toFixed(0)}</div><div style="color:#888;font-size:0.8em;margin-top:5px;">Por queda</div></div>
            <div class="card"><div class="card-top-border"></div><h3 style="font-size:0.9em">Média Booyah</h3><div class="value">${(stats.booyah/totalDias).toFixed(2)}</div><div style="color:#888;font-size:0.8em;margin-top:5px;">Por dia</div></div>
        </div>

        <div style="display: grid; ${gridCSS} gap: 15px;">
            <div class="card" style="background: rgba(255,170,0,0.05); border: 1px solid #444;"><div class="card-top-border" style="background:#888"></div><h3 style="font-size:0.9em">Pontos Totais</h3><div class="value" style="color:#fff">${stats.pontos}</div></div>
            <div class="card" style="background: rgba(255,170,0,0.05); border: 1px solid #444;"><div class="card-top-border" style="background:#888"></div><h3 style="font-size:0.9em">Abates Totais</h3><div class="value" style="color:#fff">${stats.abates}</div></div>
            <div class="card" style="background: rgba(255,170,0,0.05); border: 1px solid #444;"><div class="card-top-border" style="background:#888"></div><h3 style="font-size:0.9em">Pts Colocação</h3><div class="value" style="color:#fff">${ptsColocacao}</div></div>
            <div class="card" style="background: rgba(255,170,0,0.05); border: 1px solid #444;"><div class="card-top-border" style="background:#888"></div><h3 style="font-size:0.9em">Dano Acumulado</h3><div class="value" style="color:#fff">${totalDano}</div></div>
            <div class="card" style="background: rgba(255,170,0,0.05); border: 1px solid #444;"><div class="card-top-border" style="background:#888"></div><h3 style="font-size:0.9em">Booyahs Totais</h3><div class="value" style="color:#fff">${stats.booyah}</div></div>
        </div>
    `;
}


function ensureConfrontationModalExists() {
    let modal = document.getElementById('confrontation-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'confrontation-modal';
    modal.className = 'modal-overlay';
    modal.onclick = closeModal;
    modal.innerHTML = `
        <div class="modal-content confrontation-modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div>
                    <h2 id="modal-title" style="margin-bottom: 4px;">Ranking do Confronto</h2>
                    <div id="modal-subtitle" style="color: var(--text-muted); font-size: 0.85em;"></div>
                </div>
                <button class="close-btn" type="button" onclick="document.getElementById('confrontation-modal').classList.remove('active')">×</button>
            </div>
            <div class="table-container" style="margin-bottom:0;">
                <table id="table-modal-ranking">
                    <thead></thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>`;

    document.body.appendChild(modal);
    return modal;
}

function openConfrontationModal() {
    let { tName, t, oppGroup, intersectionDays } = getConfrontationData();
    if (intersectionDays.length === 0 || !t) return;

    const modal = ensureConfrontationModalExists();

    let teamsData = [];
    const gruposEnvolvidos = [t.grupo, oppGroup];

    db.teams.forEach(tm => {
        if(gruposEnvolvidos.includes(tm.grupo)) {
            if(db.teamDaily[tm.equipe]) {
                let filtered = db.teamDaily[tm.equipe].filter(d => intersectionDays.includes(d.dia));
                if (filtered.length > 0) {
                    let stats = filtered.reduce((acc, curr) => {
                        acc.pontos += curr.pontos; acc.abates += curr.abates; acc.booyah += curr.booyah; acc.quedas += curr.quedas; // USA AS QUEDAS REAIS
                        return acc;
                    }, {pontos: 0, abates: 0, booyah: 0, quedas: 0});

                    teamsData.push({ equipe: tm.equipe, grupo: tm.grupo, pontos: stats.pontos, booyah: stats.booyah, abates: stats.abates, quedas: stats.quedas });
                }
            }
        }
    });

    teamsData.sort((a,b) => b.pontos - a.pontos);

    document.querySelector('#table-modal-ranking thead').innerHTML = `
        <tr><th>#</th><th style="text-align:center;">E</th> <th>G</th> <th>P</th> <th>B</th> <th>K</th> <th>Q</th> </tr>`;

    let tbody = document.querySelector('#table-modal-ranking tbody');
    tbody.innerHTML = teamsData.map((tm, index) => {
        let isCurrent = tm.equipe === tName;
        let rowStyle = isCurrent ? "background-color: rgba(255, 170, 0, 0.1);" : "";
        let logoSrc = logos[tm.equipe] ? logos[tm.equipe] : '';
        let sName = shortNames[tm.equipe] || tm.equipe;

        return `<tr style="${rowStyle}">
                    <td style="color:var(--accent); font-weight:bold;">${index+1}º</td>
                    <td class="team-cell" onclick="openTeamProfile('${tm.equipe}')" style="cursor:pointer; text-align:center;">
                        <img src="${logoSrc}" class="team-logo" style="margin:0 auto; display:block;">
                        <span class="hide-mobile" style="font-size:0.8em; margin-top:2px;">${sName}</span>
                    </td>
                    <td>${tm.grupo}</td>
                    <td style="color:var(--accent); font-weight:bold">${tm.pontos}</td>
                    <td>${tm.booyah}</td>
                    <td>${tm.abates}</td>
                    <td>${tm.quedas}</td>
                </tr>`;
    }).join('');

    document.getElementById('modal-title').innerText = `Ranking: Gp ${t.grupo} vs ${oppGroup}`;
    document.getElementById('modal-subtitle').innerText = `${intersectionDays.length} dias de confronto direto.`;
    modal.classList.add('active');
}

function closeModal(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
}

// --- SISTEMA DE OVERALL (MVP COMO BÔNUS EXTRA) ---
function calculateOverall(p) {
    let q = p.quedas || 1;
    let avgK = p.abates / q;
    let avgD = p.dano / q;
    let avgA = p.assists / q;
    let avgM = (p.mvp || 0) / q;

    // Pega a função do jogador para balancear os pesos (sem capitão agora)
    let role = playerRoles[p.jogador] || "RUSH";

    // 1. PESOS POR POSIÇÃO
    let weightK, weightD, weightA;

    if (role === "SUP") {
        weightK = 0.20; weightD = 0.35; weightA = 0.45;
    } else if (role === "GRAN") {
        weightK = 0.35; weightD = 0.45; weightA = 0.20;
    } else {
        // RUSH / OUTROS
        weightK = 0.50; weightD = 0.35; weightA = 0.15;
    }

    let scoreK = Math.min((avgK / 2.6) * 100, 100);
    let scoreD = Math.min((avgD / 1750) * 100, 100);
    let scoreA = Math.min((avgA / 1.2) * 100, 100);

    let baseRaw = (scoreK * weightK) + (scoreD * weightD) + (scoreA * weightA);

    // Transforma a nota base em um range de 68 a 85 (Deixando espaço para os bônus puxarem pro 90+)
    let finalOverall = 68 + (baseRaw / 100) * (85 - 68);

    // 2. REPUTAÇÃO POR TÍTULOS (O "Fator Bops")
    let repBonus = 0;

    if (typeof titlesData !== 'undefined' && typeof checkNameMatch === 'function') {
        let isWorldChamp = titlesData.coletivos.some(t => t.event.includes("World Series") && t.players && t.players.some(pl => checkNameMatch(pl, p.jogador)));
        let titulosLocais = titlesData.coletivos.filter(t => !t.event.includes("World Series") && t.players && t.players.some(pl => checkNameMatch(pl, p.jogador))).length;

        if (isWorldChamp) repBonus += 4; // Título Mundial pesa absurdo
        if (titulosLocais >= 2) repBonus += 2; // Multicampeão
        else if (titulosLocais === 1) repBonus += 1;
    }

    // Bônus de Impacto (MVP)
    if (avgM >= 0.13) repBonus += 3;
    else if (avgM >= 0.08) repBonus += 2;
    else if (avgM > 0) repBonus += 1;

    finalOverall += repBonus;

    // 3. O PESO DA CAMISA (Sua ideia de Tiers)
    let eqUpper = p.equipe ? p.equipe.toUpperCase() : "";

    // Suas classificações exatas
    const tierS = ["FLUXO W7M", "LOS", "LOUD SNICKERS"];
    const tierA = ["VIRTUS PRO", "TEAM SOLID", "INTZ"];
    const tierB = ["E1", "E1 ESPORTS", "ALPHA7"];
    const tierC = ["AXS", "LOOPS", "RISE", "RISE GAMING", "RUSH", "INFLUENCE RAGE"];
    const tierD = ["VASCO", "ANGELS", "CIVIS"];

    let minOverall = 65; // O mínimo absoluto para um jogador de Série A
    let tierBonus = 0;

    if (tierS.includes(eqUpper)) {
        tierBonus = 3;  // Só de vestir essa camisa ganha +3
        minOverall = 81; // O "Piso do Proxx"
    } else if (tierA.includes(eqUpper)) {
        tierBonus = 2;
        minOverall = 78;
    } else if (tierB.includes(eqUpper)) {
        tierBonus = 1;
        minOverall = 74;
    } else if (tierC.includes(eqUpper)) {
        tierBonus = 0;
        minOverall = 70;
    } else if (tierD.includes(eqUpper)) {
        tierBonus = 0;
        minOverall = 65;
    }

    // Adiciona o bônus da camisa aos status do jogador
    finalOverall += tierBonus;

    // Se mesmo com os bônus o cara ficou abaixo do aceitável para o nível do time dele, a camisa "salva" ele:
    if (finalOverall < minOverall) {
        finalOverall = minOverall;
    }

    // 4. TRAVAS DE SEGURANÇA
    let result = Math.round(finalOverall);
    if (result > 96) result = 96;
    if (result < 65) result = 65;

    return result;
}

function calculateHistoricalOverall(p) {
    let q = p.quedas || 1;
    let avgK = p.abates / q;

    // 1. Base pela Média de Kills Histórica (Escala mais rigorosa para lendas)
    // 1.8 de média histórica é o topo do mundo (equivale a 95 pts)
    let scoreBase = 70 + (Math.min(avgK / 1.8, 1) * 25);

    // 2. Bônus por Volume Total (O "Fator Legado")
    let legacyBonus = 0;
    if (p.abates >= 1000) legacyBonus += 4;      // Clube das 1000 Kills
    else if (p.abates >= 500) legacyBonus += 2;  // Veterano de Elite

    // 3. Bônus por Títulos (Puxa do titlesData se o nome bater)
    let titlesBonus = 0;
    if (typeof titlesData !== 'undefined') {
        let titles = titlesData.coletivos.filter(t => t.players?.some(pl => checkNameMatch(pl, p.jogador))).length;
        titlesBonus = Math.min(titles * 1.5, 5); // Até 5 pontos por ser multicampeão
    }

    let final = Math.round(scoreBase + legacyBonus + titlesBonus);

    // Trava para lendas não ficarem abaixo de 80 e não passarem de 99
    if (final < 80) final = 80;
    return final > 96 ? 96 : final;
}

function getOverallColor(ovr) {
    if (ovr >= 90) return '#ffd700'; // Ouro Lendário
    if (ovr >= 85) return '#ffea00'; // Ouro Elite
    if (ovr >= 80) return '#e5e5e5'; // Prata Brilhante
    if (ovr >= 75) return '#c0c0c0'; // Prata
    return '#cd7f32';               // Bronze
}

// Mapa seguro: índice numérico → nome do jogador (evita quebra por apóstrofo/! no onclick)
let _ppNameMap = [];
function _openPP(idx) {
    if (_ppNameMap[idx] !== undefined) openPlayerProfile(_ppNameMap[idx]);
}
function _safePPAttr(name) {
    let idx = _ppNameMap.indexOf(name);
    if (idx === -1) { idx = _ppNameMap.length; _ppNameMap.push(name); }
    return `_openPP(${idx})`;
}

// Mapa seguro: índice numérico → nome de equipe (evita quebra por aspas/apóstrofo no onclick)
let _tpTeamNameMap = [];
function _openTP(idx) {
    if (_tpTeamNameMap[idx] !== undefined) openTeamProfile(_tpTeamNameMap[idx]);
}
function _safeTPAttr(name) {
    let idx = _tpTeamNameMap.indexOf(name);
    if (idx === -1) { idx = _tpTeamNameMap.length; _tpTeamNameMap.push(name); }
    return `_openTP(${idx})`;
}


function cffEscapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function cffEditionNumber(label) {
    const txt = String(label || '');
    const m = txt.match(/(?:LBFF|WB)\s*(\d+)/i) || txt.match(/(\d+)/);
    return m ? Number(m[1]) : 9999;
}

function cffSortEditions(entries) {
    return [...entries].sort((a, b) => {
        const an = cffEditionNumber(a[0]);
        const bn = cffEditionNumber(b[0]);
        if (an !== bn) return an - bn;
        return String(a[0]).localeCompare(String(b[0]), 'pt-BR');
    });
}

function cffGetLatestActiveTeamForPlayer(playerName, fallbackTeam = '') {
    let latest = { day: -1, team: fallbackTeam || '' };
    if (typeof dbJogadoresQuedas !== 'undefined' && dbJogadoresQuedas) {
        Object.entries(dbJogadoresQuedas).forEach(([day, rounds]) => {
            Object.values(rounds || {}).forEach(list => {
                const entry = (list || []).find(x => cffPlayerNameMatches(x.nome, playerName));
                if (entry && Number(day) >= latest.day) {
                    latest = { day: Number(day), team: entry.equipe || latest.team };
                }
            });
        });
    }
    return latest.team || fallbackTeam || '';
}

function cffFindCurrentPlayerInfo(playerName) {
    if (typeof db === 'undefined' || !Array.isArray(db.players)) return null;
    const active = db.players.find(p => cffPlayerNameMatches(p.jogador, playerName));
    if (!active || active.isEx === true) return null;

    // A planilha do Mercado também é fonte oficial de saída. Se o jogador aparece como
    // saída fechada/confirmada para Sem Clube, ele não pode continuar como ATUAL.
    const mercadoExit = (typeof cffGetMercadoExitInfo === 'function')
        ? cffGetMercadoExitInfo(active.jogador, active.equipe)
        : null;
    if (mercadoExit) return null;

    // A planilha de status atual é a fonte principal para saber se o jogador está ativo
    // e em qual equipe ele está. O histórico de quedas pode ter dados antigos e não deve
    // transformar jogador ativo da FFWS BR atual em "inativo" na página da equipe.
    const statusTeam = String(active.equipe || '').trim();
    const latestTeam = cffGetLatestActiveTeamForPlayer(active.jogador, statusTeam);
    const finalTeam = statusTeam || latestTeam || '';

    return { player: active, equipe: finalTeam };
}


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
                <strong>LBFF/WB por edição</strong>
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

function cffBuildInactivePlayerHero(playerName, lastEd) {
    const displayName = typeof getDisplayName === 'function' ? getDisplayName(playerName) : playerName;
    const photo = cffResolvePlayerHistoryPhoto(playerName);
    const insta = (typeof dbSocials !== 'undefined' && dbSocials) ? dbSocials[playerName] : null;
    const instaHtml = insta ? `
        <a href="https://instagram.com/${cffEscapeHTML(insta)}" target="_blank" class="cff-inactive-player-instagram">
            <img src="instagram.png" alt="Instagram">
            <span>@${cffEscapeHTML(insta)}</span>
        </a>` : '';

    return `
        <div class="cff-inactive-player-hero">
            <div class="cff-inactive-player-photo-wrap">
                <img class="cff-inactive-player-photo" src="${cffEscapeHTML(photo)}" alt="${cffEscapeHTML(displayName)}" onerror="this.src='silhueta.png'">
            </div>
            <h2>${cffEscapeHTML(displayName)}</h2>
            <div class="cff-inactive-player-status">EX-JOGADOR</div>
            ${lastEd && lastEd !== 'N/A' ? `<div class="cff-inactive-player-last">Última participação: <strong>${cffEscapeHTML(lastEd)}</strong></div>` : ''}
            ${instaHtml}
        </div>`;
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
    let safeName = playerName.trim();
    // Tenta match exato primeiro, depois via alias/checkNameMatch
    let p = db.players.find(x => x.jogador.trim().toLowerCase() === safeName.toLowerCase())
          || db.players.find(x => checkNameMatch(x.jogador, safeName));

    const isInactive = !p;
    currentPlayerView = p ? p.jogador : safeName;
    let playerMercadoExit = (typeof cffGetMercadoExitInfo === 'function') ? cffGetMercadoExitInfo(currentPlayerView) : null;

    // --- NOVA LÓGICA DE SELEÇÃO INICIAL ---
    let daysPlayed = [];
    for (let d in dbJogadoresQuedas) {
        for (let q in dbJogadoresQuedas[d]) {
            if (dbJogadoresQuedas[d][q].some(x => checkNameMatch(x.nome, currentPlayerView))) {
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
    if (isInactive) {
        let lbffEntry = Object.keys(lbffData || {}).find(name => cffPlayerNameMatches(name, safeName));
        // Se o lbffData estiver como ITAL0$$, mantém ITALO como nome visual/canônico,
        // mas ainda usa o match por alias para puxar os números históricos.
        if (lbffEntry) officialName = cffCanonicalPlayerDisplayName(lbffEntry);

        // Cria o objeto base com o nome oficial
        p = { jogador: officialName, equipe: "Sem Equipe", abates: 0, quedas: 0, dano: 0, assists: 0, mvp: 0 };
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

    if (playerMercadoExit) {
        equipeAtual = 'Sem Equipe';
    }

    const teamEl = document.getElementById('pp-team');
    if (teamEl) {
        teamEl.innerText = playerMercadoExit ? "SEM EQUIPE" : (isInactive ? "JOGADOR HISTÓRICO" : equipeAtual);
        teamEl.onclick = (isInactive || playerMercadoExit) ? null : () => openTeamProfile(equipeAtual);
        teamEl.style.cursor = (isInactive || playerMercadoExit) ? "default" : "pointer";
    }

    // --- CÁLCULO HISTÓRICO ---
    let histKills = 0, histQuedas = 0, lastEd = "N/A";

    let playerEntries = Object.entries(lbffData || {}).find(([name]) => cffPlayerNameMatches(name, p.jogador) || cffPlayerNameMatches(name, safeName));

    const mergedPlayerEditions = cffMergeCurrentEditionIntoEditions(p.jogador, playerEntries ? playerEntries[1] : {}, p);

    // Soma todas as edições históricas + WB 2026 S1 atual, inclusive quando o jogador saiu pelo Mercado.
    for (let ed in mergedPlayerEditions) {
        histKills += Number(mergedPlayerEditions[ed].k || mergedPlayerEditions[ed].kills || 0);
        histQuedas += Number(mergedPlayerEditions[ed].q || mergedPlayerEditions[ed].quedas || mergedPlayerEditions[ed].matches || 0);
    }

    const editions = (typeof cffSortEditions === 'function')
        ? cffSortEditions(Object.entries(mergedPlayerEditions)).map(([ed]) => ed)
        : Object.keys(mergedPlayerEditions);
    lastEd = editions[editions.length - 1] || lastEd;

    document.getElementById('pp-hist-kills').innerText = histKills;
    document.getElementById('pp-hist-quedas').innerText = histQuedas;
    document.getElementById('pp-hist-avg').innerText = histQuedas > 0 ? (histKills / histQuedas).toFixed(2) : "0.00";
    cffRenderPlayerEditionBreakdown(mergedPlayerEditions);

    // --- NOVO: LINK PARA CARREIRA COMO STAFF ---
    let isStaff = dbStaff.find(s => checkNameMatch(s.nome, p.jogador));
    let staffLinkContainer = document.getElementById('pp-staff-link-container');
    if(staffLinkContainer) {
        const marketExitHtml = playerMercadoExit ? `
            <div class="player-market-status-box">
                <strong>Sem equipe no momento</strong>
                <span>Saída oficial da ${cffEscapeHTML(playerMercadoExit.equipeOrigem || 'equipe anterior')}${playerMercadoExit.data ? ` · ${cffEscapeHTML(playerMercadoExit.data)}` : ''}</span>
            </div>` : '';
        const staffHtml = isStaff ?
            `<button class="btn-action" onclick="openStaffProfile('${p.jogador}')" style="background: rgba(255, 170, 0, 0.1); border: 1px solid var(--accent); color: var(--accent); font-size: 0.85em; width: 100%; max-width: 400px; margin-bottom: 15px;">Ver Carreira como Coach/Analista 📋</button>` : '';
        staffLinkContainer.innerHTML = marketExitHtml + staffHtml;
    }

    // --- TRATAMENTO PARA JOGADORES INATIVOS ---
    const currentStatsTitle = document.getElementById("pp-current-title");
    const currentStatsGrid = document.getElementById("pp-current-grid");
    const overallCard = document.getElementById('player-overall-card');

    const currentQuedasBox = document.getElementById('pp-quedas')?.closest('div');

    if (isInactive) {
        if(overallCard) {
            overallCard.innerHTML = cffBuildInactivePlayerHero(p.jogador, lastEd);
        }
        // Esconde as seções de estatísticas atuais que ficariam vazias.
        // Jogador histórico mostra foto + resumo; jogador ativo continua com a cartinha normal.
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
    if (typeof renderPlayerHistorySummary === 'function') renderPlayerHistorySummary(p.jogador, { isInactive: isInactive || !!playerMercadoExit, currentTeam: playerMercadoExit ? '' : equipeAtual, lastEdition: lastEd, mercadoExit: playerMercadoExit, currentPlayer: p });
    if (typeof renderPlayerTeammatesSection === 'function') renderPlayerTeammatesSection(p.jogador, playerMercadoExit ? '' : equipeAtual, { isInactive: isInactive || !!playerMercadoExit });

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
    let insta = dbSocials[p.jogador];
    let instaButtonHtml = insta ? `
        <div style="margin-top: 15px;">
            <a href="https://instagram.com/${insta}" target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 10px; text-decoration: none; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); padding: 10px 20px; border-radius: 30px; width: fit-content; transition: 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                <img src="instagram.png" style="width: 20px;">
                <span style="color: #fff; font-weight: bold; font-size: 0.9em;">@${insta}</span>
            </a>
        </div>` : '';

    let ovr = calculateOverall(p);
    let role = playerRoles[p.jogador] || "RUSH";
    let category = ovr >= 91 ? "LENDÁRIO" : (ovr >= 85 ? "ELITE" : (ovr >= 80 ? "MUITO BOM" : "PROFISSIONAL"));
    let accentColor = ovr >= 91 ? "#d4af37" : (ovr >= 85 ? "#c5a028" : (ovr >= 80 ? "#e5e5e5" : "#cd7f32"));
    let stars = ovr >= 91 ? "⭐⭐⭐⭐⭐" : (ovr >= 85 ? "⭐⭐⭐⭐" : (ovr >= 80 ? "⭐⭐⭐" : "⭐⭐"));

    document.getElementById('player-overall-card').innerHTML = `
        <div style="display: flex; gap: 30px; align-items: center; background: rgba(0,0,0,0.3); padding: 30px; border-radius: 20px; flex-wrap: wrap; margin: 20px 0; border: 1px solid rgba(255,255,255,0.05); justify-content: center;">
            ${createPlayerCardHTML(p, 1)}
            <div style="flex: 1; min-width: 280px;">
                <div style="color: #888; font-size: 0.85em; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">Classificação Pro 2026</div>
                <div style="font-size: 2em; margin-bottom: 10px;">${stars}</div>
                <div style="background: ${accentColor}22; color: ${accentColor}; border: 1px solid ${accentColor}44; padding: 12px 25px; font-weight: 900; display: inline-block; font-size: 1.3em; border-radius: 5px; text-transform: uppercase;">${category}</div>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05);">
                    <p style="color: #aaa; font-size: 0.95em; line-height: 1.6; margin: 0;">Performance calculada em tempo real.<br>Especialidade: <strong style="color:#fff">${role}</strong></p>
                    ${instaButtonHtml}
                </div>
            </div>
        </div>`;
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

function renderMapData() {
    let map = document.getElementById('filter-map').value;
    let data = db.maps[map];
    let tbody = document.querySelector('#table-maps tbody');
    tbody.innerHTML = '';
    if(data) {
        const rows = [...data].sort((a,b) => b.pontos_total - a.pontos_total).map((t, i) =>
            `<tr><td style="color:var(--accent); font-weight:bold;">${i+1}º</td><td class="team-cell"><img src="${logos[t.equipe]||''}" class="team-logo" alt=""><span class="clickable" onclick="openTeamProfile('${t.equipe}')">${t.equipe}</span></td><td style="color:var(--accent); font-weight:bold">${t.pontos_total.toFixed(2)}</td><td>${t.abates.toFixed(2)}</td><td>${t.pontos_pos.toFixed(2)}</td><td>${t.Booyah.toFixed(2)}</td></tr>`
        );
        tbody.innerHTML = rows.join('');
    }
}

// Essa função é nova, ela apenas abre/fecha o menu mobile
function toggleMobileMenu() {
    // Legacy - agora usa a sidebar
    openSidebar();
}



// ============== RESUMOS HISTÓRICOS CLEAN ==============
function cffPlaceToNumber(place) {
    const n = parseInt(String(place || '').replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
}

function cffOrdinalBR(n) {
    n = Number(n || 0);
    if (!n) return 'N/A';
    return n === 1 ? 'campeã' : `${n}ª colocada`;
}


function cffCountOrDash(value) {
    const n = Number(value || 0);
    return n > 0 ? String(n) : '-';
}

function cffPluralBR(count, singular, plural) {
    const n = Number(count || 0);
    return `${n} ${n === 1 ? singular : plural}`;
}

function cffTitleCountsSentence(subject, collectiveCount, individualCount) {
    const coletivos = Number(collectiveCount || 0);
    const individuais = Number(individualCount || 0);
    const safeSubject = subject ? `<strong>${cffEscapeHTML(subject)}</strong> ` : '';

    if (coletivos === 0 && individuais === 0) {
        return `${safeSubject}não conquistou nenhum título coletivo e nenhum título individual.`;
    }

    return `${safeSubject}já conquistou <strong>${cffPluralBR(coletivos, 'título coletivo', 'títulos coletivos')}</strong> e <strong>${cffPluralBR(individuais, 'título individual', 'títulos individuais')}</strong>.`;
}

function cffAwardCountsSentence(count, mvpCount = 0) {
    const n = Number(count || 0);
    const mvp = Number(mvpCount || 0);
    if (n <= 0) return 'Jogadores atuando pela equipe não conquistaram nenhum prêmio individual registrado.';
    const mvpText = mvp > 0 ? `, incluindo <strong>${cffPluralBR(mvp, 'MVP', 'MVPs')}</strong>` : '';
    return `Jogadores atuando pela equipe somam <strong>${cffPluralBR(n, 'prêmio individual', 'prêmios individuais')}</strong>${mvpText}.`;
}

function cffGetTitleEventName(title) {
    return String(title?.event || title?.torneio || title?.tournament || title?.name || title?.nome || '').trim();
}

function cffGetTitleTeamName(title) {
    return String(title?.team || title?.equipe || title?.org || '').trim();
}

function cffSameTournamentName(a, b) {
    const norm = v => String(v || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '');
    const na = norm(a);
    const nb = norm(b);
    return !!na && !!nb && (na === nb || na.includes(nb) || nb.includes(na));
}

function cffFindPlayerFirstPassageTeam(playerName) {
    if (!Array.isArray(dbPassagens)) return '';
    const row = dbPassagens.find(p => cffPlayerNameMatches(p.jogador, playerName) || (Array.isArray(p.aliases) && p.aliases.some(a => cffPlayerNameMatches(a, playerName))));
    const firstPlayerPass = (row?.passagens || []).find(pass => String(pass.cargo || '').toUpperCase().includes('JOGADOR'));
    return firstPlayerPass?.equipe || '';
}

function cffFindPlayerCollectiveTitleForEvent(playerName, eventName = '') {
    const titles = cffGetPlayerTitles(playerName).collective || [];
    if (!titles.length) return null;
    if (eventName) {
        const exact = titles.find(t => cffSameTournamentName(cffGetTitleEventName(t), eventName));
        if (exact) return exact;
    }
    return titles[0] || null;
}

function cffFindTeamFirstTitle(teamName) {
    const titles = cffGetTeamTitles(teamName).collective || [];
    return titles[0] || null;
}

function cffPlayerLooseKey(value) {
    const key = typeof normalizePlayerAliasKey === 'function'
        ? normalizePlayerAliasKey(value)
        : String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toUpperCase();
    return key.replace(/0/g, 'O');
}

function cffPlayerNameMatches(a, b) {
    if (!a || !b) return false;
    if (typeof checkNameMatch === 'function' && checkNameMatch(a, b)) return true;

    const rawA = String(a || '').trim();
    const rawB = String(b || '').trim();
    if (!rawA || !rawB) return false;

    if (cffPlayerLooseKey(rawA) && cffPlayerLooseKey(rawA) === cffPlayerLooseKey(rawB)) return true;

    const canonA = typeof getCanonicalPlayerName === 'function' ? getCanonicalPlayerName(rawA) : rawA;
    const canonB = typeof getCanonicalPlayerName === 'function' ? getCanonicalPlayerName(rawB) : rawB;
    if (cffPlayerLooseKey(canonA) && cffPlayerLooseKey(canonA) === cffPlayerLooseKey(canonB)) return true;

    const aliasesA = typeof getPlayerAliasList === 'function' ? getPlayerAliasList(rawA) : [rawA, canonA];
    const aliasesB = typeof getPlayerAliasList === 'function' ? getPlayerAliasList(rawB) : [rawB, canonB];
    return aliasesA.some(a1 => aliasesB.some(b1 => cffPlayerLooseKey(a1) && cffPlayerLooseKey(a1) === cffPlayerLooseKey(b1)));
}

function cffCanonicalPlayerDisplayName(name) {
    const raw = String(name || '').trim();
    if (!raw) return raw;
    if (typeof getCanonicalPlayerName === 'function') {
        const canonical = getCanonicalPlayerName(raw);
        if (canonical && cffPlayerLooseKey(canonical) !== cffPlayerLooseKey(raw)) return canonical;
        if (canonical && canonical !== raw) return canonical;
    }
    if (Array.isArray(dbPassagens)) {
        const hist = dbPassagens.find(p => cffPlayerNameMatches(p.jogador, raw) || (Array.isArray(p.aliases) && p.aliases.some(a => cffPlayerNameMatches(a, raw))));
        if (hist?.jogador) return hist.jogador;
    }
    return raw;
}

function cffEnsureAfter(targetId, newId, className) {
    let el = document.getElementById(newId);
    if (el) return el;

    const target = document.getElementById(targetId);
    if (!target || !target.parentNode) return null;

    el = document.createElement('div');
    el.id = newId;
    el.className = className;
    target.parentNode.insertBefore(el, target.nextSibling);
    return el;
}

function cffGetPrimarySection(t) {
    if (typeof getNovoTorneioPrimaryResultSection === 'function') {
        return getNovoTorneioPrimaryResultSection(t).section;
    }
    if (t?.final?.rows?.length) return t.final;
    const standings = Array.isArray(t?.standings) ? t.standings.filter(sec => sec?.type !== 'pointRush') : [];
    return standings[0] || null;
}

function cffGetRowField(row, section, field, fallback = '') {
    if (typeof getCompactFieldFromCols === 'function') return getCompactFieldFromCols(row, section, field, fallback);
    if (!Array.isArray(row)) return row?.[field] ?? fallback;
    const idx = (section?.cols || []).indexOf(field);
    return idx >= 0 ? row[idx] : fallback;
}

function cffGetTeamPositionInTournament(t, teamName) {
    const section = cffGetPrimarySection(t);
    if (!section) return null;
    const aliasSet = typeof getTeamAliasSet === 'function' ? getTeamAliasSet(teamName) : new Set([String(teamName).toUpperCase()]);
    const rows = section.rows || section.linhas || [];

    for (const row of rows) {
        const team = cffGetRowField(row, section, 'team', '');
        const original = cffGetRowField(row, section, 'teamOriginal', '');
        const teamSet = typeof getTeamAliasSet === 'function'
            ? new Set([...getTeamAliasSet(team), ...getTeamAliasSet(original)])
            : new Set([String(team).toUpperCase(), String(original).toUpperCase()]);
        const matches = [...teamSet].some(x => aliasSet.has(x));
        if (matches) return Number(cffGetRowField(row, section, 'pos', cffGetRowField(row, section, 'posicao', 0))) || 0;
    }
    return null;
}

function cffGetTeamForPlayerInTournament(t, playerName) {
    const teams = t?.teams?.items || t?.teams?.equipes || [];
    for (const team of teams) {
        const teamName = team.n || team.nome || team.o || team.nomeOriginal || '';
        const people = [...(team.p || team.jogadores || []), ...(team.s || team.staff || [])];
        if (people.some(p => cffPlayerNameMatches(p.n || p.nome || '', playerName))) return teamName;
    }
    return '';
}

function cffGetPlayerAppearances(playerName) {
    const tournaments = typeof getNovosTorneiosSafeList === 'function' ? getNovosTorneiosSafeList() : (window.dbNovosTorneios || []);
    return tournaments.map(t => {
        const team = cffGetTeamForPlayerInTournament(t, playerName);
        if (!team) return null;
        const pos = cffGetTeamPositionInTournament(t, team);
        return {
            tournament: t.name || t.nome || t.id || 'Torneio',
            id: t.id || '',
            year: String(t.year || t.ano || ''),
            team,
            pos
        };
    }).filter(Boolean).sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0));
}

function cffGetPlayerLbffEntry(playerName) {
    if (typeof lbffData === 'undefined' || !lbffData) return null;
    const entry = Object.entries(lbffData).find(([name]) => cffPlayerNameMatches(name, playerName));
    return entry ? { name: entry[0], editions: entry[1] || {} } : null;
}

function cffGetCurrentWbEditionStats(playerName, fallbackPlayer = null) {
    const candidates = [];
    if (fallbackPlayer && fallbackPlayer.jogador) candidates.push(fallbackPlayer);
    if (typeof db !== 'undefined' && Array.isArray(db.players)) {
        db.players.forEach(p => {
            if (p && p.jogador && cffPlayerNameMatches(p.jogador, playerName)) candidates.push(p);
        });
    }

    const row = candidates.find(p => {
        const k = Number(p.abates || p.kills || 0);
        const q = Number(p.quedas || p.matches || 0);
        return k > 0 || q > 0 || String(p.equipe || '').trim();
    });

    if (!row) return null;

    const kills = Number(row.abates || row.kills || 0);
    const matches = Number(row.quedas || row.matches || 0);
    const team = String(row.equipe || '').trim();

    if (!kills && !matches && !team) return null;

    return {
        edition: 'WB 2026 S1',
        data: {
            k: kills,
            q: matches,
            team,
            equipe: team,
            currentSeason: true
        }
    };
}

function cffMergeCurrentEditionIntoEditions(playerName, editionsData = {}, fallbackPlayer = null) {
    const merged = { ...(editionsData || {}) };
    const current = cffGetCurrentWbEditionStats(playerName, fallbackPlayer);
    if (!current) return merged;

    const existingKey = Object.keys(merged).find(k => String(k || '').toLowerCase().replace(/\s+/g, ' ').trim() === current.edition.toLowerCase());
    const key = existingKey || current.edition;
    const prev = merged[key] || {};
    merged[key] = {
        ...prev,
        ...current.data,
        k: Math.max(Number(prev.k || prev.kills || 0), Number(current.data.k || 0)),
        q: Math.max(Number(prev.q || prev.quedas || prev.matches || 0), Number(current.data.q || 0)),
        team: current.data.team || prev.team || prev.equipe || '',
        equipe: current.data.team || prev.equipe || prev.team || ''
    };
    return merged;
}

function cffGetPlayerTitles(playerName) {
    const oldCol = (typeof titlesData !== 'undefined' ? titlesData.coletivos || [] : []).filter(t => (t.players || []).some(pl => cffPlayerNameMatches(pl, playerName)));
    const oldInd = (typeof titlesData !== 'undefined' ? titlesData.individuais || [] : []).filter(t => cffPlayerNameMatches(t.player, playerName));
    const newCol = typeof getNovosTorneiosCollectiveTitlesForPlayer === 'function' ? getNovosTorneiosCollectiveTitlesForPlayer(playerName) : [];
    const newInd = typeof getNovosTorneiosIndividualAwardsForPlayer === 'function' ? getNovosTorneiosIndividualAwardsForPlayer(playerName) : [];
    return { collective: [...oldCol, ...newCol], individual: [...oldInd, ...newInd] };
}


function cffBuildTeamLink(teamName, extraClass = '') {
    const name = String(teamName || '').trim();
    if (!name) return '';
    const safe = cffEscapeHTML(name);
    const onclick = `openTeamProfile('${name.replace(/'/g, "\\'")}')`;
    return `<span class="cff-inline-link ${extraClass}" onclick="${onclick}" title="Ver perfil de ${safe}"><strong>${safe}</strong></span>`;
}

function cffHasTournamentPage(eventName) {
    const name = String(eventName || '').trim();
    if (!name) return false;
    try {
        return !!(typeof findTournamentInDB === 'function' && findTournamentInDB(name))
            || !!(typeof findNovoTorneioByName === 'function' && findNovoTorneioByName(name));
    } catch (e) {
        return false;
    }
}

function cffBuildTournamentLink(eventName) {
    const name = String(eventName || '').trim();
    if (!name) return '';
    const safe = cffEscapeHTML(name);
    if (!cffHasTournamentPage(name) || typeof openAnyTournamentPage !== 'function') return `<strong>${safe}</strong>`;
    const onclick = `openAnyTournamentPage('${name.replace(/'/g, "\\'")}')`;
    return `<span class="cff-inline-link" onclick="${onclick}" title="Ver página de ${safe}"><strong>${safe}</strong></span>`;
}

function cffGetPlayerNationality(playerName) {
    // A base nacional da LBFF/WB é brasileira. Mantido em função para facilitar expansão futura.
    return 'brasileiro';
}

function cffBuildAllTimeKillRowsForRank() {
    const rows = [];
    const seen = new Set();
    Object.entries(lbffData || {}).forEach(([name, editions]) => {
        let histK = 0, histQ = 0;
        Object.values(editions || {}).forEach(data => {
            histK += Number(data.k || data.kills || 0);
            histQ += Number(data.q || data.quedas || 0);
        });
        const activeName = typeof getCanonicalPlayerName === 'function' ? getCanonicalPlayerName(name) : ((typeof historicalAliases !== 'undefined' && historicalAliases[name]) || name);
        const activeP = (typeof db !== 'undefined' && Array.isArray(db.players)) ? db.players.find(x => String(x.jogador || '').toLowerCase() === String(activeName || '').toLowerCase()) : null;
        const totalKills = histK + (activeP ? Number(activeP.abates || 0) : 0);
        const totalQuedas = histQ + (activeP ? Number(activeP.quedas || 0) : 0);
        if (totalKills > 0 || totalQuedas > 0) {
            const key = cffPlayerLooseKey(activeName || name);
            seen.add(key);
            rows.push({ originalName: name, activeName, totalKills, totalQuedas });
        }
    });

    if (typeof db !== 'undefined' && Array.isArray(db.players)) {
        db.players.forEach(activeP => {
            const key = cffPlayerLooseKey(activeP.jogador);
            if (seen.has(key)) return;
            const totalKills = Number(activeP.abates || 0);
            const totalQuedas = Number(activeP.quedas || 0);
            if (totalKills > 0 || totalQuedas > 0) rows.push({ originalName: activeP.jogador, activeName: activeP.jogador, totalKills, totalQuedas });
        });
    }

    return rows.sort((a, b) => {
        if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
        if (a.totalQuedas !== b.totalQuedas) return a.totalQuedas - b.totalQuedas;
        return String(a.activeName || a.originalName).localeCompare(String(b.activeName || b.originalName), 'pt-BR');
    });
}

function cffGetPlayerAllTimeKillRank(playerName) {
    const rows = cffBuildAllTimeKillRowsForRank();
    const idx = rows.findIndex(row => cffPlayerNameMatches(row.activeName, playerName) || cffPlayerNameMatches(row.originalName, playerName));
    return idx >= 0 ? idx + 1 : 0;
}

function cffOpenHallForPlayer(playerName) {
    const name = String(playerName || '').trim();
    if (typeof navigate === 'function') navigate('hall-da-fama');
    setTimeout(() => {
        const input = document.getElementById('hist-all-player-search');
        if (input) input.value = name;
        try {
            if (typeof setHallAllTimePlayerSearch === 'function') setHallAllTimePlayerSearch(name);
            else if (typeof renderHistoricalRanking === 'function') renderHistoricalRanking();
        } catch(e) {
            if (typeof renderHistoricalRanking === 'function') renderHistoricalRanking();
        }
        const table = document.getElementById('table-history');
        if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
}
window.cffOpenHallForPlayer = cffOpenHallForPlayer;

function cffBuildRankLink(playerName, rank) {
    const n = Number(rank || 0);
    if (!n) return '-';
    const safe = String(playerName || '').replace(/'/g, "\\'");
    return `<button type="button" class="cff-rank-link" onclick="cffOpenHallForPlayer('${safe}')" title="Ver ${cffEscapeHTML(playerName)} no Hall da Fama">${n}º</button>`;
}

function cffGetTeamActivePeople(teamName, currentPlayerName = '') {
    const canonical = typeof getTeamCanonicalName === 'function' ? getTeamCanonicalName(teamName) : String(teamName || '').trim();
    const players = (typeof db !== 'undefined' && Array.isArray(db.players) ? db.players : [])
        .filter(p => !p.isEx && cffTeamMatchesHistoryTeam(p.equipe, canonical) && !(typeof cffPlayerHasLeftTeam === 'function' && cffPlayerHasLeftTeam(p.jogador, canonical)))
        .map(p => ({
            type: 'player',
            name: p.jogador,
            displayName: typeof getDisplayName === 'function' ? getDisplayName(p.jogador) : p.jogador,
            role: (typeof playerRoles !== 'undefined' && playerRoles[p.jogador]) ? playerRoles[p.jogador] : 'JOGADOR',
            photo: cffResolvePlayerHistoryPhoto(p.jogador),
            isCurrentPlayer: cffPlayerNameMatches(p.jogador, currentPlayerName),
            onclick: _safePPAttr(p.jogador)
        }));

    const staff = (typeof dbStaff !== 'undefined' && Array.isArray(dbStaff) ? dbStaff : [])
        .filter(s => cffTeamMatchesHistoryTeam(s.equipe, canonical))
        .map(s => {
            const photoKey = typeof staffPhotos !== 'undefined' ? Object.keys(staffPhotos || {}).find(k => k.toLowerCase() === String(s.nome || '').toLowerCase().trim()) : '';
            return {
                type: 'staff',
                name: s.nome,
                displayName: typeof getDisplayName === 'function' ? getDisplayName(s.nome) : s.nome,
                role: s.cargo || 'STAFF',
                photo: photoKey ? staffPhotos[photoKey] : 'silhueta.png',
                isCurrentPlayer: false,
                onclick: `openStaffProfile('${String(s.nome || '').replace(/'/g, "\\'")}')`
            };
        });

    return { players, staff, all: [...players, ...staff] };
}

function renderPlayerTeammatesSection(playerName, teamName, context = {}) {
    let section = document.getElementById('pp-teammates-section');
    const anchor = document.getElementById('pp-history-summary-box') || document.getElementById('player-overall-card');
    if (!section && anchor?.parentNode) {
        section = document.createElement('section');
        section.id = 'pp-teammates-section';
        section.className = 'pp-teammates-section';
        anchor.parentNode.insertBefore(section, anchor.nextSibling);
    }
    if (!section) return;

    const activeTeam = String(teamName || '').trim();
    if (context.isInactive || !activeTeam || activeTeam === 'Sem Equipe') {
        section.innerHTML = '';
        section.style.display = 'none';
        return;
    }

    const people = cffGetTeamActivePeople(activeTeam, playerName);
    const items = people.all;
    if (!items.length) {
        section.innerHTML = '';
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    section.innerHTML = `
        <div class="pp-teammates-head">
            <div>
                <div class="pp-teammates-kicker">Elenco atual</div>
                <h3>Companheiros de equipe</h3>
            </div>
            <div class="pp-teammates-count"><strong>${people.players.length}</strong> jogadores · <strong>${people.staff.length}</strong> comissão</div>
        </div>
        <div class="pp-teammates-grid" style="--pp-teammate-count:${items.length};">
            ${items.map(item => `
                <button type="button" class="pp-teammate-card${item.isCurrentPlayer ? ' is-current-player' : ''}" onclick="${item.onclick}" title="Abrir perfil de ${cffEscapeHTML(item.displayName)}">
                    <span class="pp-teammate-avatar"><img src="${cffEscapeHTML(item.photo)}" alt="${cffEscapeHTML(item.displayName)}" onerror="this.src='silhueta.png'"></span>
                    <span class="pp-teammate-info">
                        <strong>${cffEscapeHTML(item.displayName)}</strong>
                        <small>${cffEscapeHTML(String(item.role || '').toUpperCase())}</small>
                    </span>
                </button>`).join('')}
        </div>`;
}
function renderPlayerHistorySummary(playerName, context = {}) {
    const box = cffEnsureAfter('player-overall-card', 'pp-history-summary-box', 'cff-summary-box');
    if (!box) return;

    const displayName = typeof getDisplayName === 'function' ? getDisplayName(playerName) : playerName;
    const lbff = cffGetPlayerLbffEntry(playerName);
    const mercadoExit = context.mercadoExit || ((typeof cffGetMercadoExitInfo === 'function') ? cffGetMercadoExitInfo(playerName) : null);
    const activeInfo = mercadoExit ? null : cffFindCurrentPlayerInfo(playerName);
    const activePlayer = activeInfo?.player || context.currentPlayer || null;
    const mergedSummaryEditions = cffMergeCurrentEditionIntoEditions(playerName, lbff ? (lbff.editions || {}) : {}, activePlayer || context.currentPlayer || null);
    const appearances = cffGetPlayerAppearances(playerName);
    const editions = cffSortEditions(Object.entries(mergedSummaryEditions || {}));

    let totalKills = 0, totalMatches = 0;
    let bestKill = null;
    editions.forEach(([edition, data]) => {
        const k = Number(data.k || data.kills || 0);
        const q = Number(data.q || data.quedas || data.matches || 0);
        totalKills += k;
        totalMatches += q;
        if (!bestKill || k > bestKill.kills) bestKill = { edition, kills: k, matches: q };
    });

    const firstPassageTeam = cffFindPlayerFirstPassageTeam(playerName);
    const lbffDebut = editions.length ? { tournament: editions[0][0], pos: 0, team: firstPassageTeam } : null;
    const lbffLast = editions.length ? { tournament: editions[editions.length - 1][0], pos: 0, team: '' } : null;
    const debut = lbffDebut || appearances[0] || null;
    const last = lbffLast || appearances[appearances.length - 1] || null;

    const bestPlace = appearances.filter(a => a.pos).sort((a, b) => a.pos - b.pos)[0] || null;
    const titles = cffGetPlayerTitles(playerName);
    const currentTeam = activeInfo?.equipe || activePlayer?.equipe || context.currentTeam || '';
    const allTimeRank = cffGetPlayerAllTimeKillRank(playerName);
    const nationality = cffGetPlayerNationality(playerName);

    const nameStrong = `<strong>${cffEscapeHTML(displayName)}</strong>`;
    const currentTeamLink = currentTeam ? cffBuildTeamLink(currentTeam) : '<strong>sem equipe</strong>';
    const debutTournament = debut ? cffBuildTournamentLink(debut.tournament) : '';
    const debutTeam = debut?.team ? cffBuildTeamLink(debut.team) : '';
    const bestTournament = bestKill ? cffBuildTournamentLink(bestKill.edition) : '';
    const bestAvg = bestKill?.matches ? (bestKill.kills / bestKill.matches).toFixed(2) : '0.00';
    const titlesSentence = cffTitleCountsSentence(displayName, titles.collective.length, titles.individual.length);

    const sentences = [];
    if (activePlayer && currentTeam) {
        sentences.push(`${nameStrong} é um jogador ${nationality} que atua pelo time ${currentTeamLink}.`);
    } else {
        sentences.push(`${nameStrong} é um jogador ${nationality}.`);
    }

    if (debut) {
        sentences.push(`O atleta estreou na ${debutTournament}${debutTeam ? ` pelo ${debutTeam}` : ''}.`);
    }

    if (bestKill) {
        sentences.push(`Seu melhor desempenho individual foi de <strong>${bestKill.kills} abates</strong> em <strong>${bestKill.matches || 0} quedas</strong>, com média de <strong>${bestAvg} kills por queda</strong> na ${bestTournament}.`);
    }

    sentences.push(`${nameStrong} soma <strong>${totalKills} abates</strong> em <strong>${totalMatches} quedas</strong> na história da LBFF/WB.`);

    if (activePlayer && currentTeam) {
        sentences.push(`Atualmente defende ${currentTeamLink}.`);
    } else {
        sentences.push(`Atualmente não está jogando por nenhum time na WB; sua última participação registrada foi em ${cffBuildTournamentLink(last?.tournament || context.lastEdition || 'N/A')}.`);
    }

    sentences.push(titlesSentence);

    box.innerHTML = `
        <div class="cff-summary-kicker">Resumo histórico</div>
        <p>${sentences.join(' ')}</p>
        <div class="cff-summary-mini-grid">
            <span><strong>${totalKills}</strong><small>abates</small></span>
            <span><strong>${totalMatches}</strong><small>quedas</small></span>
            <span><strong>${cffBuildRankLink(displayName, allTimeRank)}</strong><small>posição no ranking de abates</small></span>
            <span><strong>${cffCountOrDash(titles.collective.length + titles.individual.length)}</strong><small>títulos/prêmios</small></span>
        </div>`;
}
function cffNormalizeTeamLooseForHistory(value) {
    if (typeof normalizeTeamAlias === 'function') return normalizeTeamAlias(value);
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function cffTeamMatchesHistoryTeam(a, b) {
    if (typeof sameTeamName === 'function') return sameTeamName(a, b);
    return cffNormalizeTeamLooseForHistory(a) === cffNormalizeTeamLooseForHistory(b);
}


function cffResolvePlayerHistoryPhoto(name) {
    const candidates = [];
    const raw = String(name || '').trim();
    if (raw) candidates.push(raw);

    try {
        if (typeof getDisplayName === 'function') candidates.push(getDisplayName(raw));
        if (typeof getSearchCanonicalName === 'function') candidates.push(getSearchCanonicalName(raw));
        if (typeof getPlayerAliasList === 'function') {
            getPlayerAliasList(raw).forEach(alias => candidates.push(alias));
            const display = typeof getDisplayName === 'function' ? getDisplayName(raw) : raw;
            getPlayerAliasList(display).forEach(alias => candidates.push(alias));
        }
    } catch (e) {}

    const normalized = typeof normalizePlayerAliasKey === 'function'
        ? normalizePlayerAliasKey
        : (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

    const unique = [...new Set(candidates.filter(Boolean))];
    for (const candidate of unique) {
        if (typeof playerPhotos !== 'undefined' && playerPhotos[candidate]) return playerPhotos[candidate];
    }

    if (typeof playerPhotos !== 'undefined') {
        const wanted = new Set(unique.map(normalized));
        const key = Object.keys(playerPhotos).find(k => wanted.has(normalized(k)));
        if (key && playerPhotos[key]) return playerPhotos[key];
    }

    return 'silhueta.png';
}

function cffResolveTeamLogoSafe(teamName) {
    if (!teamName) return '';
    try {
        if (typeof getTeamLogoByAliases === 'function') return getTeamLogoByAliases(teamName) || '';
    } catch (e) {}
    return (typeof logos !== 'undefined' && logos) ? (logos[teamName] || 'escudo.webp') : 'escudo.webp';
}

function cffGetPlayersFromTeamPassagens(teamName) {
    if (!Array.isArray(dbPassagens)) return [];
    const canonical = typeof getTeamCanonicalName === 'function' ? getTeamCanonicalName(teamName) : teamName;
    const currentPlayers = (typeof db !== 'undefined' && Array.isArray(db.players)) ? db.players : [];
    const byName = new Map();

    const pushRecord = (record) => {
        if (!record || !record.jogador) return;
        const key = cffPlayerLooseKey(record.jogador || record.displayName);
        if (!key) return;
        const existing = byName.get(key);
        if (!existing) {
            byName.set(key, record);
            return;
        }
        byName.set(key, {
            ...existing,
            ...record,
            passagens: Math.max(Number(existing.passagens || 0), Number(record.passagens || 0)),
            firstIndex: Math.min(Number(existing.firstIndex ?? 9999), Number(record.firstIndex ?? 9999)),
            lastIndex: Math.max(Number(existing.lastIndex ?? -1), Number(record.lastIndex ?? -1)),
            abates: Math.max(Number(existing.abates || 0), Number(record.abates || 0)),
            quedas: Math.max(Number(existing.quedas || 0), Number(record.quedas || 0)),
            isCurrent: Boolean((existing.isCurrent || record.isCurrent) && !(existing.mercadoExit || record.mercadoExit)),
            mercadoExit: Boolean(existing.mercadoExit || record.mercadoExit),
            isActiveElsewhere: Boolean((existing.isActiveElsewhere || record.isActiveElsewhere) && !(existing.isCurrent || record.isCurrent) && !(existing.mercadoExit || record.mercadoExit)),
            activeTeam: record.activeTeam || existing.activeTeam || '',
            activeTeamLogo: record.activeTeamLogo || existing.activeTeamLogo || ''
        });
    };

    dbPassagens.forEach(row => {
        const passagens = Array.isArray(row.passagens) ? row.passagens : [];
        const matches = passagens
            .map((pass, idx) => ({ ...pass, _idx: idx }))
            .filter(pass => cffTeamMatchesHistoryTeam(pass.equipe, canonical) && String(pass.cargo || '').toUpperCase().includes('JOGADOR'));
        if (!matches.length) return;

        const mercadoExit = (typeof cffGetMercadoExitInfo === 'function') ? cffGetMercadoExitInfo(row.jogador, canonical) : null;
        const activeInfo = mercadoExit ? null : cffFindCurrentPlayerInfo(row.jogador);
        const active = activeInfo?.player || currentPlayers.find(p => cffPlayerNameMatches(p.jogador, row.jogador));
        const activeTeam = activeInfo?.equipe || active?.equipe || '';
        const isCurrent = !mercadoExit && !!activeInfo && cffTeamMatchesHistoryTeam(activeTeam, canonical);
        const isActiveElsewhere = !mercadoExit && !!activeInfo && !!activeTeam && !isCurrent;
        const histTotals = (typeof getHistTotals === 'function') ? getHistTotals(row.jogador) : { k: 0, q: 0 };
        const activeKills = activeInfo ? Number(activeInfo.player.abates || 0) : 0;
        const activeQuedas = activeInfo ? Number(activeInfo.player.quedas || 0) : 0;
        const kills = Number(histTotals.k || 0) + activeKills;
        const quedas = Number(histTotals.q || 0) + activeQuedas;
        const firstMatch = matches[0];
        const lastMatch = matches[matches.length - 1];
        const displayName = typeof getDisplayName === 'function' ? getDisplayName(row.jogador) : row.jogador;

        pushRecord({
            jogador: row.jogador,
            displayName,
            passagens: matches.length,
            firstIndex: firstMatch._idx,
            lastIndex: lastMatch._idx,
            cargo: lastMatch.cargo || 'Jogador',
            isCurrent: !!isCurrent,
            mercadoExit: !!mercadoExit,
            isActiveElsewhere: !!isActiveElsewhere,
            activeTeam: activeTeam || '',
            activeTeamLogo: isActiveElsewhere ? cffResolveTeamLogoSafe(activeTeam) : '',
            abates: kills,
            quedas,
            media: quedas ? kills / quedas : 0
        });
    });

    // Alguns jogadores atuais ainda não aparecem na planilha de passagens. Para não deixar
    // o histórico incompleto, junta também o elenco ativo da WB atual da equipe aberta.
    currentPlayers
        .filter(p => p && p.isEx !== true && cffTeamMatchesHistoryTeam(p.equipe, canonical) && !(typeof cffPlayerHasLeftTeam === 'function' && cffPlayerHasLeftTeam(p.jogador, canonical)))
        .forEach(p => {
            const displayName = typeof getDisplayName === 'function' ? getDisplayName(p.jogador) : p.jogador;
            const kills = Number(p.abates || 0);
            const quedas = Number(p.quedas || 0);
            pushRecord({
                jogador: p.jogador,
                displayName,
                passagens: 1,
                firstIndex: 9999,
                lastIndex: 9999,
                cargo: p.posicao || p.funcao || 'Jogador',
                isCurrent: true,
                isActiveElsewhere: false,
                activeTeam: p.equipe || canonical,
                activeTeamLogo: '',
                abates: kills,
                quedas,
                media: quedas ? kills / quedas : 0
            });
        });

    // Saídas oficiais vindas do Mercado também precisam entrar no histórico da equipe.
    // Isso cobre saídas coletivas recentes que ainda não existem na planilha de passagens.
    const mercadoDepartures = (typeof cffGetTeamMercadoDepartures === 'function') ? cffGetTeamMercadoDepartures(canonical) : [];
    mercadoDepartures.forEach(exit => {
        if (!exit || !exit.jogador) return;

        const active = currentPlayers.find(p => cffPlayerNameMatches(p.jogador, exit.jogador));
        const displayName = typeof getDisplayName === 'function' ? getDisplayName(exit.jogador) : exit.jogador;
        const kills = Number(active?.abates || 0);
        const quedas = Number(active?.quedas || 0);

        pushRecord({
            jogador: exit.jogador,
            displayName,
            passagens: 1,
            firstIndex: 10000,
            lastIndex: 10000,
            cargo: 'Jogador',
            isCurrent: false,
            mercadoExit: true,
            isActiveElsewhere: false,
            activeTeam: '',
            activeTeamLogo: '',
            abates: kills,
            quedas,
            media: quedas ? kills / quedas : 0
        });
    });

    return [...byName.values()].sort((a, b) => {
        if (b.isCurrent !== a.isCurrent) return Number(b.isCurrent) - Number(a.isCurrent);
        if (b.isActiveElsewhere !== a.isActiveElsewhere) return Number(b.isActiveElsewhere) - Number(a.isActiveElsewhere);
        if (b.abates !== a.abates) return b.abates - a.abates;
        return String(a.displayName).localeCompare(String(b.displayName), 'pt-BR');
    });
}

async function renderTeamPlayersHistory(teamName) {
    const mount = document.getElementById('tp-player-history-mount');
    const trophies = document.getElementById('tp-trophies-container');
    const anchor = mount || trophies || document.getElementById('tp-players-cards-container');
    if (!anchor) return;

    let section = document.getElementById('tp-player-history-section');
    if (!section) {
        section = document.createElement('section');
        section.id = 'tp-player-history-section';
        section.className = 'team-history-section';
        if (mount) mount.appendChild(section);
        else if (trophies && trophies.parentNode) trophies.parentNode.insertBefore(section, trophies.previousElementSibling || trophies);
        else anchor.parentNode.insertBefore(section, anchor.nextSibling);
    } else if (mount && section.parentNode !== mount) {
        mount.appendChild(section);
    }

    if (typeof loadPassagens === 'function' && (!Array.isArray(dbPassagens) || dbPassagens.length === 0)) {
        try { await loadPassagens(); } catch (e) { console.warn('[renderTeamPlayersHistory] passagens não carregou:', e); }
    }

    if (typeof loadPhotos === 'function' && !window.__cffTeamHistoryPhotosLoaded) {
        window.__cffTeamHistoryPhotosLoaded = true;
        try { await loadPhotos(); } catch (e) { console.warn('[renderTeamPlayersHistory] fotos não carregaram:', e); }
    }

    const canonical = typeof getTeamCanonicalName === 'function' ? getTeamCanonicalName(teamName) : teamName;
    const players = cffGetPlayersFromTeamPassagens(canonical);

    if (!players.length) {
        section.innerHTML = `
            <div class="team-history-head team-history-head-simple">
                <h3>História</h3>
            </div>
            <div class="team-player-history-empty">Nenhum jogador encontrado na planilha de passagens para esta equipe.</div>`;
        return;
    }

    const currentCount = players.filter(p => p.isCurrent).length;
    const exCount = players.length - currentCount;
    const topPlayers = players.slice(0, 64);
    const notablePlayers = [...players].sort((a, b) => {
        if (b.abates !== a.abates) return b.abates - a.abates;
        if (b.media !== a.media) return b.media - a.media;
        return String(a.displayName).localeCompare(String(b.displayName), 'pt-BR');
    }).slice(0, 5);

    const playerCardsHtml = topPlayers.map(p => {
        const photo = cffResolvePlayerHistoryPhoto(p.jogador || p.displayName);
        const stateClass = p.isCurrent ? ' is-current' : (p.isActiveElsewhere ? ' is-active-elsewhere' : ' is-inactive');
        const status = p.isCurrent ? 'ATUAL' : 'EX-JOGADOR';
        const logoHtml = p.isActiveElsewhere && p.activeTeamLogo ? `
            <span class="team-player-current-team-logo" title="Atualmente em ${cffEscapeHTML(p.activeTeam)}">
                <img src="${cffEscapeHTML(p.activeTeamLogo)}" alt="${cffEscapeHTML(p.activeTeam)}" onerror="this.style.display='none'">
            </span>` : '';
        return `
            <button type="button" class="team-player-history-card team-player-history-photo-card${stateClass}" onclick="${_safePPAttr(p.jogador)}" title="Abrir perfil de ${cffEscapeHTML(p.displayName)}">
                <span class="team-player-history-avatar">
                    ${logoHtml}
                    <img src="${cffEscapeHTML(photo)}" alt="${cffEscapeHTML(p.displayName)}" onerror="this.src='silhueta.png'">
                </span>
                <span class="team-player-history-name">${cffEscapeHTML(p.displayName)}</span>
                <span class="team-player-history-status">${status}</span>
            </button>`;
    }).join('');

    const notableHtml = notablePlayers.map((p, index) => {
        const photo = cffResolvePlayerHistoryPhoto(p.jogador || p.displayName);
        return `
            <button type="button" class="team-notable-player-card" onclick="${_safePPAttr(p.jogador)}" title="Abrir perfil de ${cffEscapeHTML(p.displayName)}">
                <span class="team-notable-rank">${index + 1}º</span>
                <span class="team-notable-avatar"><img src="${cffEscapeHTML(photo)}" alt="${cffEscapeHTML(p.displayName)}" onerror="this.src='silhueta.png'"></span>
                <span class="team-notable-info">
                    <strong>${cffEscapeHTML(p.displayName)}</strong>
                    <small>${Number(p.abates || 0)} abates · ${Number(p.quedas || 0)} quedas</small>
                </span>
            </button>`;
    }).join('');

    section.innerHTML = `
        <div class="team-history-head team-history-head-simple">
            <h3>História</h3>
            <div class="team-player-history-stats">
                <span><strong>${players.length}</strong><small>jogadores</small></span>
                <span><strong>${currentCount}</strong><small>atuais</small></span>
                <span><strong>${exCount}</strong><small>ex-jogadores</small></span>
            </div>
        </div>

        <div class="team-history-subsection">
            <div class="team-history-subtitle-row">
                <h4>Histórico de jogadores</h4>
            </div>
            <div class="team-player-history-grid team-player-history-photo-grid">
                ${playerCardsHtml}
            </div>
            ${players.length > topPlayers.length ? `<div class="team-player-history-more">Mostrando ${topPlayers.length} de ${players.length} jogadores para manter a página leve.</div>` : ''}
        </div>

        <div class="team-history-subsection">
            <div class="team-history-subtitle-row">
                <h4>Jogadores notáveis</h4>
                <p>Top 5 jogadores com mais abates cadastrados na história da organização.</p>
            </div>
            <div class="team-notable-players-grid">
                ${notableHtml || '<div class="team-player-history-empty">Ainda não há dados suficientes para montar os jogadores notáveis.</div>'}
            </div>
        </div>`;
}

function cffGetTeamTitles(teamName) {
    const aliasSet = typeof getTeamAliasSet === 'function' ? getTeamAliasSet(teamName) : new Set([String(teamName).toUpperCase()]);
    const oldCol = (typeof titlesData !== 'undefined' ? titlesData.coletivos || [] : []).filter(t => aliasSet.has(normalizeTeamAlias(t.team)));
    const oldInd = (typeof titlesData !== 'undefined' ? titlesData.individuais || [] : []).filter(t => aliasSet.has(normalizeTeamAlias(t.team)));
    const newCol = typeof getNovosTorneiosCollectiveTitlesForTeam === 'function' ? getNovosTorneiosCollectiveTitlesForTeam(teamName) : [];
    const newInd = typeof getNovosTorneiosIndividualAwardsForTeam === 'function' ? getNovosTorneiosIndividualAwardsForTeam(teamName) : [];
    return { collective: [...oldCol, ...newCol], individual: [...oldInd, ...newInd] };
}

function renderTeamHistorySummary(teamName) {
    const target = document.getElementById('tp-next-match-container') || document.getElementById('tp-pos');
    let box = document.getElementById('tp-history-summary-box');
    if (!box && target && target.parentNode) {
        box = document.createElement('div');
        box.id = 'tp-history-summary-box';
        box.className = 'cff-summary-box cff-summary-box-team';
        target.parentNode.insertBefore(box, target.nextSibling);
    }
    if (!box) return;

    const canonical = typeof getTeamCanonicalName === 'function' ? getTeamCanonicalName(teamName) : teamName;
    const results = [
        ...(typeof getResultsByTeamAliases === 'function' ? getResultsByTeamAliases(canonical) : []),
        ...(typeof getNovosTorneiosResultsForTeam === 'function' ? getNovosTorneiosResultsForTeam(canonical) : [])
    ];
    const unique = [];
    const seen = new Set();
    results.forEach(r => {
        const key = `${r.torneio}|${r.data}|${r.place}`;
        if (!seen.has(key)) { seen.add(key); unique.push(r); }
    });

    const placements = unique.map(r => ({ ...r, n: cffPlaceToNumber(r.place) })).filter(r => r.n);
    const best = placements.sort((a, b) => a.n - b.n)[0] || null;
    const worlds = unique.filter(r => /world|mundial|ffws/i.test(r.torneio || ''));
    const titles = cffGetTeamTitles(canonical);
    const activeTeam = (typeof db !== 'undefined' && db.teams) ? db.teams.find(t => typeof getTeamCanonicalName === 'function' ? getTeamCanonicalName(t.equipe) === canonical : t.equipe === canonical) : null;
    const totalMvp = titles.individual.filter(t => String(t.type || t.award || '').toUpperCase().includes('MVP')).length;
    const firstTitle = cffFindTeamFirstTitle(canonical);

    const sentences = [];
    sentences.push(`${canonical} ${activeTeam ? 'está disputando a WB atual' : 'é uma equipe histórica/fora da WB atual'}.`);
    if (best) sentences.push(`Sua melhor colocação registrada na LBFF/WB foi <strong>${cffEscapeHTML(cffOrdinalBR(best.n))}</strong> em <strong>${cffEscapeHTML(best.torneio)}</strong>.`);
    if (firstTitle) sentences.push(`A primeira conquista coletiva registrada foi na <strong>${cffEscapeHTML(cffGetTitleEventName(firstTitle) || 'competição cadastrada')}</strong>.`);
    if (worlds.length) sentences.push(`A organização tem participação registrada em torneio mundial/FFWS.`);
    sentences.push(cffTitleCountsSentence(canonical, titles.collective.length, titles.individual.length));
    if (titles.individual.length) sentences.push(cffAwardCountsSentence(titles.individual.length, totalMvp));
    if (!best && !titles.collective.length && !titles.individual.length) sentences.push('Ainda não há resultados históricos suficientes cadastrados para montar um resumo completo.');

    box.innerHTML = `
        <div class="cff-summary-kicker">Resumo da organização</div>
        <p>${sentences.join(' ')}</p>
        <div class="cff-summary-mini-grid">
            <span><strong>${best?.n ? best.n + 'º' : '-'}</strong><small>melhor posição</small></span>
            <span><strong>${cffCountOrDash(titles.collective.length)}</strong><small>títulos coletivos</small></span>
            <span><strong>${cffCountOrDash(titles.individual.length)}</strong><small>prêmios individuais</small></span>
            <span><strong>${unique.length}</strong><small>resultados</small></span>
        </div>`;
}
