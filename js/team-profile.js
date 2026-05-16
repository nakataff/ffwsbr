// ============== TEAM PROFILE E MODAL ==============
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

        let playersList = Object.values(agg).map(p => {
            let dbP = db.players.find(x => x.jogador === p.jogador);
            p.isEx = dbP ? (dbP.isEx || false) : false;
            return p;
        });

        let ativos = playersList.filter(p => !p.isEx).sort((a,b) => b.abates - a.abates);
        // Alterado de 4 para 5 abaixo:
        let topAtivos = ativos.slice(0, 6);
        let inativos = playersList.filter(p => p.isEx).sort((a,b) => b.abates - a.abates);

if (cardsContainer) {
            // Grid: até 5 jogadores = 1 linha com 5; mais de 5 = 2 linhas com 3
            const numAtivos = topAtivos.length;
            if (window.innerWidth > 768) {
                if (numAtivos <= 5) {
                    cardsContainer.style.display = "grid";
                    cardsContainer.style.gridTemplateColumns = `repeat(${numAtivos}, auto)`;
                    cardsContainer.style.justifyContent = "center";
                    cardsContainer.style.gap = "20px";
                } else {
                    cardsContainer.style.display = "grid";
                    cardsContainer.style.gridTemplateColumns = "repeat(3, auto)";
                    cardsContainer.style.justifyContent = "center";
                    cardsContainer.style.gap = "20px";
                }
            } else {
                cardsContainer.style.display = "flex";
                cardsContainer.style.flexWrap = "wrap";
                cardsContainer.style.justifyContent = "center";
                cardsContainer.style.gap = "20px";
            }
            cardsContainer.style.maxWidth = "none";
            cardsContainer.style.margin = "0 auto 30px auto";

            let html = topAtivos.map(p => createPlayerCardHTML(p, 0.85)).join('');

            if (inativos.length > 0) {
                html += `
                <div style="width: 100%; grid-column: 1 / -1; text-align: center; margin-top: 15px;">
                    <button class="btn-action" onclick="let c = document.getElementById('ex-players-div'); if(c.style.display==='none'){c.style.display='flex'; this.innerText='Ocultar Ex-Jogadores';}else{c.style.display='none'; this.innerText='Ver Ex-Jogadores';}" style="background: transparent; border: 1px solid var(--border); color: var(--text-muted); font-size: 0.85em; padding: 8px 15px;">Ver Ex-Jogadores</button>
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
            tbody.innerHTML = playersList.sort((a,b) => b.abates - a.abates).map(p => `<tr><td style="text-align:left;"><span class="clickable" onclick="${_safePPAttr(p.jogador)}">${p.jogador}</span></td><td style="color:var(--accent); font-weight:bold;">${p.abates}</td><td>${p.dano}</td><td>${p.assists}</td><td>${p.quedas}</td><td>${p.mvp || 0}</td></tr>`).join('');
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

async function openPlayerProfile(playerName) {
    if (!playerName) return;
    if (typeof loadTeamAliases === 'function') await loadTeamAliases();
    if (typeof loadNovosTorneios === 'function' && (typeof novosTorneiosLoaded === 'undefined' || !novosTorneiosLoaded)) {
        await loadNovosTorneios();
    }
    let safeName = playerName.trim();
    // Tenta match exato primeiro, depois via alias/checkNameMatch
    let p = db.players.find(x => x.jogador.trim().toLowerCase() === safeName.toLowerCase())
          || db.players.find(x => checkNameMatch(x.jogador, safeName));

    const isInactive = !p;
    currentPlayerView = p ? p.jogador : safeName;

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
let officialName = safeName;
    if (isInactive) {
        let lbffEntry = Object.keys(lbffData).find(name => checkNameMatch(name, safeName));
        if (lbffEntry) officialName = lbffEntry;

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

    const teamEl = document.getElementById('pp-team');
    if (teamEl) {
        teamEl.innerText = isInactive ? "JOGADOR HISTÓRICO" : equipeAtual;
        teamEl.onclick = isInactive ? null : () => openTeamProfile(equipeAtual);
        teamEl.style.cursor = isInactive ? "default" : "pointer";
    }

    // --- CÁLCULO HISTÓRICO ---
    let histKills = 0, histQuedas = 0, lastEd = "N/A";

    let playerEntries = Object.entries(lbffData).find(([name]) => checkNameMatch(name, p.jogador));

    if (playerEntries) {
        // Soma todas as edições do lbffData
        let editionsData = playerEntries[1];
        for (let ed in editionsData) {
            histKills += editionsData[ed].k || 0;
            histQuedas += editionsData[ed].q || 0;
        }
        let editions = Object.keys(editionsData);
        lastEd = editions[editions.length - 1];
    }

    // Soma com a edição atual (se ele estiver jogando)
    histKills += (p.abates || 0);
    histQuedas += (p.quedas || 0);

    document.getElementById('pp-hist-kills').innerText = histKills;
    document.getElementById('pp-hist-quedas').innerText = histQuedas;
    document.getElementById('pp-hist-avg').innerText = histQuedas > 0 ? (histKills / histQuedas).toFixed(2) : "0.00";

    // --- NOVO: LINK PARA CARREIRA COMO STAFF ---
    let isStaff = dbStaff.find(s => checkNameMatch(s.nome, p.jogador));
    let staffLinkContainer = document.getElementById('pp-staff-link-container');
    if(staffLinkContainer) {
        staffLinkContainer.innerHTML = isStaff ?
            `<button class="btn-action" onclick="openStaffProfile('${p.jogador}')" style="background: rgba(255, 170, 0, 0.1); border: 1px solid var(--accent); color: var(--accent); font-size: 0.85em; width: 100%; max-width: 400px; margin-bottom: 15px;">Ver Carreira como Coach/Analista 📋</button>` : '';
    }

    // --- TRATAMENTO PARA JOGADORES INATIVOS ---
    const currentStatsTitle = document.getElementById("pp-current-title");
    const currentStatsGrid = document.getElementById("pp-current-grid");
    const overallCard = document.getElementById('player-overall-card');

    if (isInactive) {
        if(overallCard) {
            overallCard.innerHTML = `
                <div style="
                    background: rgba(255,0,0,0.1);
                    border: 2px solid #ff4444;
                    padding: 30px;
                    border-radius: 15px;
                    text-align: center;
                    width: 100%;
                    max-width: 1000px;
                    margin: 20px auto;
                    box-sizing: border-box;
                    display: block;
                    clear: both;
                ">
                    <h2 style="color:#ff4444; margin:0; font-size: 1.8em;">JOGADOR INATIVO</h2>
                    <p style="color:#aaa; margin:10px 0 0 0; font-size: 1.1em;">Este jogador não está disputando a WB 2026 S1 no momento.</p>
                    <div style="margin-top:20px; font-weight:bold; color:var(--accent); font-size: 1.2em;">
                        Última participação: <span style="color:#fff;">${lastEd}</span>
                    </div>
                </div>`;
        }
        // Esconde as seções de estatísticas atuais que ficariam vazias
        if(currentStatsTitle) currentStatsTitle.style.display = "none";
        if(currentStatsGrid) currentStatsGrid.style.display = "none";

        let quedasEl = document.getElementById('pp-quedas');
        if(quedasEl) quedasEl.innerText = "-";

    } else {
        if(currentStatsTitle) currentStatsTitle.style.display = "block";
        if(currentStatsGrid) currentStatsGrid.style.display = "grid";

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
    if (typeof renderPlayerHistorySummary === 'function') renderPlayerHistorySummary(p.jogador, { isInactive, currentTeam: equipeAtual, lastEdition: lastEd });

    navigate('player-profile');
}


function getPlayerNameSizeClass(name) {
    const len = String(name || '').trim().length;
    if (len >= 13) return 'name-very-long';
    if (len >= 10) return 'name-long';
    return '';
}

function renderAllPlayers() {
    let teamFilter = document.getElementById('filter-team-players').value;

    // Pega o valor do filtro de posição (Se não achar, assume 'all')
    let roleSelect = document.getElementById('filter-role-players');
    let roleFilter = roleSelect ? roleSelect.value : 'all';

    let rookieSelect = document.getElementById('filter-rookie-players');
    let rookieFilter = rookieSelect ? rookieSelect.value : 'all';

    // Mostra skeleton enquanto processa
    let tbody = document.querySelector('#table-players tbody');
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
        let dataToAggregate = db.playerDaily;
        if (selectedPlayerDays.length > 0) dataToAggregate = dataToAggregate.filter(p => selectedPlayerDays.includes(String(p.dia)));

        let aggregated = {};
        dataToAggregate.forEach(row => {
            if (!aggregated[row.jogador]) aggregated[row.jogador] = { jogador: row.jogador, equipe: row.equipe, abates: 0, dano: 0, assists: 0, quedas: 0, mvp: 0 };
            aggregated[row.jogador].abates += row.abates;
            aggregated[row.jogador].dano += row.dano;
            aggregated[row.jogador].assists += row.assists;
            aggregated[row.jogador].quedas += row.quedas;
            aggregated[row.jogador].mvp += row.mvp;
        });

        let data = Object.values(aggregated)
            .filter(p => {
                if (teamFilter === 'all') return true;
                // Busca a equipe oficial do jogador no db.players para garantir
                let officialTeam = db.players.find(x => x.jogador === p.jogador)?.equipe || p.equipe;
                // Compara ignorando maiúsculas/minúsculas e espaços extras
                return officialTeam?.toUpperCase().trim() === teamFilter.toUpperCase().trim() ||
                       p.equipe?.toUpperCase().trim() === teamFilter.toUpperCase().trim();
            })
            .filter(p => {
                if (roleFilter === 'all') return true;
                let currentRole = playerRoles[p.jogador] || "RUSH";
                return currentRole.toUpperCase() === roleFilter.toUpperCase();
            })
            .filter(p => {
                if (rookieFilter === 'all') return true;
                return typeof isRookiePlayer === 'function' && isRookiePlayer(p.jogador);
            })
            .filter(p => p.quedas > 0);

        tbody.innerHTML = data.sort((a,b) => b.abates - a.abates).map((p, i) => {
            // Resolve o nome canônico e equipe oficial via db.players (suporta aliases)
            let dbP = db.players.find(x => x.jogador === p.jogador)
                   || db.players.find(x => checkNameMatch(x.jogador, p.jogador));
            let canonicalName = dbP ? dbP.jogador : p.jogador;
            let officialTeam = dbP?.equipe || p.equipe;
            let danoFmt = Math.floor(p.dano / 1000) + 'k';
            let danoFull = p.dano >= 1000 ? p.dano.toLocaleString('pt-BR') : p.dano;
            return `<tr>
                <td style="font-size:0.8em; color:var(--text-muted);">${i+1}</td>
                <td class="player-name-cell"><span class="clickable player-name-link ${getPlayerNameSizeClass(canonicalName)}" onclick="${_safePPAttr(canonicalName)}" title="${canonicalName}">${canonicalName}</span></td>
                <td style="text-align:center;"><img src="${logos[officialTeam]||''}" class="team-logo" alt="${officialTeam}" title="${officialTeam}" style="cursor:pointer; width:22px; height:22px; object-fit:contain;" onclick="openTeamProfile('${officialTeam}')"></td>
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

function cffPlayerNameMatches(a, b) {
    if (typeof checkNameMatch === 'function') return checkNameMatch(a, b);
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
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

function cffGetPlayerTitles(playerName) {
    const oldCol = (typeof titlesData !== 'undefined' ? titlesData.coletivos || [] : []).filter(t => (t.players || []).some(pl => cffPlayerNameMatches(pl, playerName)));
    const oldInd = (typeof titlesData !== 'undefined' ? titlesData.individuais || [] : []).filter(t => cffPlayerNameMatches(t.player, playerName));
    const newCol = typeof getNovosTorneiosCollectiveTitlesForPlayer === 'function' ? getNovosTorneiosCollectiveTitlesForPlayer(playerName) : [];
    const newInd = typeof getNovosTorneiosIndividualAwardsForPlayer === 'function' ? getNovosTorneiosIndividualAwardsForPlayer(playerName) : [];
    return { collective: [...oldCol, ...newCol], individual: [...oldInd, ...newInd] };
}

function renderPlayerHistorySummary(playerName, context = {}) {
    const box = cffEnsureAfter('player-overall-card', 'pp-history-summary-box', 'cff-summary-box');
    if (!box) return;

    const displayName = typeof getDisplayName === 'function' ? getDisplayName(playerName) : playerName;
    const lbff = cffGetPlayerLbffEntry(playerName);
    const appearances = cffGetPlayerAppearances(playerName);
    const editions = lbff ? Object.entries(lbff.editions || {}) : [];

    let totalKills = 0, totalMatches = 0;
    let bestKill = null;
    editions.forEach(([edition, data]) => {
        const k = Number(data.k || data.kills || 0);
        const q = Number(data.q || data.quedas || 0);
        totalKills += k;
        totalMatches += q;
        if (!bestKill || k > bestKill.kills) bestKill = { edition, kills: k, matches: q };
    });

    const activePlayer = (typeof db !== 'undefined' && db.players) ? db.players.find(p => cffPlayerNameMatches(p.jogador, playerName)) : null;
    if (activePlayer && !activePlayer.isEx) {
        totalKills += Number(activePlayer.abates || 0);
        totalMatches += Number(activePlayer.quedas || 0);
    }

    const debut = appearances[0] || (editions.length ? { tournament: editions[0][0], pos: 0, team: '' } : null);
    const last = appearances[appearances.length - 1] || (editions.length ? { tournament: editions[editions.length - 1][0], pos: 0, team: '' } : null);
    const bestPlace = appearances.filter(a => a.pos).sort((a, b) => a.pos - b.pos)[0] || null;
    const titles = cffGetPlayerTitles(playerName);
    const currentText = activePlayer && !activePlayer.isEx
        ? `Atualmente defende ${activePlayer.equipe}.`
        : `Atualmente não está jogando por nenhum time na WB; sua última participação registrada foi em ${last?.tournament || context.lastEdition || 'N/A'}.`;

    const sentences = [];
    if (debut) sentences.push(`${displayName} estreou na ${debut.tournament}${debut.pos ? ` e ficou na ${debut.pos}ª posição` : ''}${debut.team ? ` com ${debut.team}` : ''}.`);
    if (bestKill) sentences.push(`Seu melhor desempenho individual foi de ${bestKill.kills} abates na ${bestKill.edition}.`);
    if (bestPlace) sentences.push(`Sua melhor colocação como equipe foi ${cffOrdinalBR(bestPlace.pos)} na ${bestPlace.tournament}.`);
    sentences.push(`${displayName} soma ${totalKills} abates em ${totalMatches} quedas na história da LBFF/WB.`);
    sentences.push(currentText);
    sentences.push(`${displayName} já conquistou ${titles.collective.length} título(s) coletivo(s) e ${titles.individual.length} título(s) individual(is).`);

    box.innerHTML = `
        <div class="cff-summary-kicker">Resumo histórico</div>
        <p>${sentences.join(' ')}</p>
        <div class="cff-summary-mini-grid">
            <span><strong>${totalKills}</strong><small>abates</small></span>
            <span><strong>${totalMatches}</strong><small>quedas</small></span>
            <span><strong>${bestPlace?.pos ? bestPlace.pos + 'º' : 'N/A'}</strong><small>melhor posição</small></span>
            <span><strong>${titles.collective.length + titles.individual.length}</strong><small>títulos/prêmios</small></span>
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

function cffGetPlayersFromTeamPassagens(teamName) {
    if (!Array.isArray(dbPassagens)) return [];
    const canonical = typeof getTeamCanonicalName === 'function' ? getTeamCanonicalName(teamName) : teamName;
    const currentPlayers = (typeof db !== 'undefined' && Array.isArray(db.players)) ? db.players : [];

    return dbPassagens.map(row => {
        const passagens = Array.isArray(row.passagens) ? row.passagens : [];
        const matches = passagens
            .map((pass, idx) => ({ ...pass, _idx: idx }))
            .filter(pass => cffTeamMatchesHistoryTeam(pass.equipe, canonical) && String(pass.cargo || '').toUpperCase().includes('JOGADOR'));
        if (!matches.length) return null;

        const active = currentPlayers.find(p => typeof checkNameMatch === 'function'
            ? checkNameMatch(p.jogador, row.jogador)
            : String(p.jogador || '').toLowerCase() === String(row.jogador || '').toLowerCase());
        const isCurrent = active && !active.isEx && cffTeamMatchesHistoryTeam(active.equipe, canonical);
        const histTotals = (typeof getHistTotals === 'function') ? getHistTotals(row.jogador) : { k: 0, q: 0 };
        const activeKills = active && !active.isEx ? Number(active.abates || 0) : 0;
        const activeQuedas = active && !active.isEx ? Number(active.quedas || 0) : 0;
        const kills = Number(histTotals.k || 0) + activeKills;
        const quedas = Number(histTotals.q || 0) + activeQuedas;
        const firstMatch = matches[0];
        const lastMatch = matches[matches.length - 1];
        const displayName = typeof getDisplayName === 'function' ? getDisplayName(row.jogador) : row.jogador;

        return {
            jogador: row.jogador,
            displayName,
            passagens: matches.length,
            firstIndex: firstMatch._idx,
            lastIndex: lastMatch._idx,
            cargo: lastMatch.cargo || 'Jogador',
            isCurrent: !!isCurrent,
            abates: kills,
            quedas,
            media: quedas ? kills / quedas : 0
        };
    }).filter(Boolean).sort((a, b) => {
        if (b.isCurrent !== a.isCurrent) return Number(b.isCurrent) - Number(a.isCurrent);
        if (b.abates !== a.abates) return b.abates - a.abates;
        return String(a.displayName).localeCompare(String(b.displayName), 'pt-BR');
    });
}

async function renderTeamPlayersHistory(teamName) {
    let anchor = document.getElementById('tp-players-cards-container');
    if (!anchor) return;

    let section = document.getElementById('tp-player-history-section');
    if (!section) {
        section = document.createElement('section');
        section.id = 'tp-player-history-section';
        section.className = 'team-player-history-section';
        anchor.parentNode.insertBefore(section, anchor.nextSibling);
    }

    if (typeof loadPassagens === 'function' && (!Array.isArray(dbPassagens) || dbPassagens.length === 0)) {
        try { await loadPassagens(); } catch (e) { console.warn('[renderTeamPlayersHistory] passagens não carregou:', e); }
    }

    const canonical = typeof getTeamCanonicalName === 'function' ? getTeamCanonicalName(teamName) : teamName;
    const players = cffGetPlayersFromTeamPassagens(canonical);

    if (!players.length) {
        section.innerHTML = `
            <div class="team-player-history-head">
                <div>
                    <div class="team-player-history-kicker">Histórico de jogadores</div>
                    <h3>Jogadores que passaram pela equipe</h3>
                </div>
            </div>
            <div class="team-player-history-empty">Nenhum jogador encontrado na planilha de passagens para esta equipe.</div>`;
        return;
    }

    const currentCount = players.filter(p => p.isCurrent).length;
    const totalKills = players.reduce((sum, p) => sum + Number(p.abates || 0), 0);
    const topPlayers = players.slice(0, 36);

    section.innerHTML = `
        <div class="team-player-history-head">
            <div>
                <div class="team-player-history-kicker">Histórico de jogadores</div>
                <h3>Jogadores que passaram pela equipe</h3>
            </div>
            <div class="team-player-history-stats">
                <span><strong>${players.length}</strong><small>jogadores</small></span>
                <span><strong>${currentCount}</strong><small>atuais</small></span>
                <span><strong>${totalKills}</strong><small>abates hist.</small></span>
            </div>
        </div>
        <div class="team-player-history-grid">
            ${topPlayers.map(p => `
                <button type="button" class="team-player-history-card${p.isCurrent ? ' is-current' : ''}" onclick="${_safePPAttr(p.jogador)}" title="Abrir perfil de ${p.displayName}">
                    <span class="team-player-history-name">${p.displayName}</span>
                    <span class="team-player-history-meta">${p.isCurrent ? 'ATUAL' : 'JOGADOR'} · ${p.abates || 0} K · ${p.quedas || 0} Q</span>
                </button>
            `).join('')}
        </div>
        ${players.length > topPlayers.length ? `<div class="team-player-history-more">Mostrando ${topPlayers.length} de ${players.length} jogadores para manter a página leve.</div>` : ''}`;
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

    const sentences = [];
    sentences.push(`${canonical} ${activeTeam ? 'está disputando a WB atual' : 'é uma equipe histórica/fora da WB atual'}.`);
    if (best) sentences.push(`Sua melhor colocação registrada na LBFF/WB foi ${cffOrdinalBR(best.n)} em ${best.torneio}.`);
    if (worlds.length) sentences.push(`A organização tem participação registrada em torneio mundial/FFWS.`);
    if (titles.collective.length) sentences.push(`Já conquistou ${titles.collective.length} título(s) coletivo(s).`);
    if (titles.individual.length) sentences.push(`Jogadores atuando pela equipe somam ${titles.individual.length} prêmio(s) individual(is), incluindo ${totalMvp} MVP(s).`);
    if (!best && !titles.collective.length && !titles.individual.length) sentences.push('Ainda não há resultados históricos suficientes cadastrados para montar um resumo completo.');

    box.innerHTML = `
        <div class="cff-summary-kicker">Resumo da organização</div>
        <p>${sentences.join(' ')}</p>
        <div class="cff-summary-mini-grid">
            <span><strong>${best?.n ? best.n + 'º' : 'N/A'}</strong><small>melhor posição</small></span>
            <span><strong>${titles.collective.length}</strong><small>títulos coletivos</small></span>
            <span><strong>${titles.individual.length}</strong><small>prêmios individuais</small></span>
            <span><strong>${unique.length}</strong><small>resultados</small></span>
        </div>`;
}
