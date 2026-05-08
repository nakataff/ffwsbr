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
    await loadResults(); // <--- Adicionamos essa linha para carregar o arquivo
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
                p.passagens.some(pass => pass.equipe.toUpperCase() === tName.toUpperCase() && pass.cargo.toUpperCase() === "JOGADOR")
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
                let activeName = (typeof historicalAliases !== 'undefined' && historicalAliases[playerName]) || playerName;
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

    // Filtra títulos coletivos onde a equipe foi campeã
    let teamTitles = titlesData.coletivos.filter(t => t.team.toUpperCase() === teamName.toUpperCase());

    if (teamTitles.length === 0) {
        container.innerHTML = '<div style="color:#888; text-align:center; width:100%; padding:20px;">Nenhum título oficial registrado para esta organização.</div>';
        return;
    }

    container.innerHTML = teamTitles.map(t => {
let tournamentImg = resolveLeagueLogo(t.event);
        const hasTournamentPage = !!findTournamentInDB(t.event);
        const clickAttr = hasTournamentPage ? `onclick="navigateToTournament('${t.event.replace(/'/g, "\\'")}')" style="cursor:pointer;" title="Ver página do torneio"` : '';
        const linkIcon = hasTournamentPage ? `<div style="font-size:0.55em; color:var(--accent); margin-top:3px;">🔗 Ver Torneio</div>` : '';
        return `
        <div class="trophy-card border-campeao" ${clickAttr}>
            <img src="${tournamentImg}" class="trophy-img" style="height: 50px;">
            <div style="font-weight:bold; font-size:0.75em; color:#fff; text-align:center; margin-top:5px;">${t.event}</div>
            <div style="color:var(--accent); font-size:0.65em; font-weight:bold; text-transform:uppercase;">Campeão</div>
            ${linkIcon}
        </div>`;
    }).join('');
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

function openConfrontationModal() {
    let { tName, t, oppGroup, intersectionDays } = getConfrontationData();
    if (intersectionDays.length === 0) return;

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
    document.getElementById('confrontation-modal').classList.add('active');
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

function openPlayerProfile(playerName) {
    if (!playerName) return;
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

