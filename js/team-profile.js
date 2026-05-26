// ============== TEAM PROFILE E MODAL - VERSÃO OTIMIZADA ==============

// ===== CACHE GLOBAL PARA DADOS =====
window.__cffDataCache = window.__cffDataCache || {
    mercado: null,
    laff: null,
    laff2025: null,
    passagens: null,
    loaded: {
        mercado: false,
        laff: false,
        laff2025: false,
        passagens: false
    },
    timestamp: {
        mercado: 0,
        laff: 0,
        laff2025: 0,
        passagens: 0
    }
};

// Cache TTL em milissegundos (5 minutos)
const CACHE_TTL = 5 * 60 * 1000;

function cffIsCacheValid(key) {
    const now = Date.now();
    return (now - (window.__cffDataCache.timestamp[key] || 0)) < CACHE_TTL;
}

// Versão otimizada com cache
async function cffLoadMercadoNonBlockingCached(timeoutMs = 600) {
    if (cffIsCacheValid('mercado') && window.__cffDataCache.loaded.mercado) {
        return window.__cffDataCache.mercado;
    }
    
    if (typeof loadMercado !== 'function') return Promise.resolve([]);
    
    try {
        const load = Promise.resolve().then(() => loadMercado({ silent: true }));
        const timeout = new Promise(resolve => setTimeout(() => resolve(null), timeoutMs));
        const result = await Promise.race([load, timeout]);
        
        window.__cffDataCache.mercado = result;
        window.__cffDataCache.loaded.mercado = true;
        window.__cffDataCache.timestamp.mercado = Date.now();
        return result;
    } catch (e) {
        console.warn('[Mercado] Erro ao carregar:', e);
        return [];
    }
}

async function cffLoadLAFFDataCached() {
    if (cffIsCacheValid('laff') && window.__cffDataCache.loaded.laff) {
        return window.__cffDataCache.laff;
    }
    
    if (typeof window.loadLAFFData !== 'function') return null;
    
    try {
        const result = await window.loadLAFFData();
        window.__cffDataCache.laff = result;
        window.__cffDataCache.loaded.laff = true;
        window.__cffDataCache.timestamp.laff = Date.now();
        return result;
    } catch (e) {
        console.warn('[LAFF] Erro ao carregar:', e);
        return null;
    }
}

async function cffLoadPassagensCached() {
    if (cffIsCacheValid('passagens') && window.__cffDataCache.loaded.passagens) {
        return window.__cffDataCache.passagens;
    }
    
    if (typeof loadPassagens !== 'function') return null;
    
    try {
        const result = await loadPassagens();
        window.__cffDataCache.loaded.passagens = true;
        window.__cffDataCache.timestamp.passagens = Date.now();
        return result;
    } catch (e) {
        console.warn('[Passagens] Erro ao carregar:', e);
        return null;
    }
}

// ===== CARREGAMENTO PARALELO OTIMIZADO =====
async function cffLoadPlayerProfileDataParallel() {
    return Promise.all([
        cffLoadMercadoNonBlockingCached().catch(() => []),
        cffLoadLAFFDataCached().catch(() => null),
        cffLoadPassagensCached().catch(() => null)
    ]).catch(() => [null, null, null]);
}

function cffOpenTeamProfileSmart(teamName) {
    const raw = String(teamName || '').trim();
    if (!raw) return;

    const findLAFFTeam = () => {
        try {
            const laffTeams = (typeof window.getLAFFTeams === 'function') ? window.getLAFFTeams() : [];
            return Array.isArray(laffTeams) ? laffTeams.find(t => {
                if (!t || !t.name) return false;
                if (typeof sameTeamName === 'function') return sameTeamName(t.name, raw);
                return String(t.name || '').toUpperCase() === raw.toUpperCase();
            }) : null;
        } catch (e) {
            return null;
        }
    };

    const laffTeam = findLAFFTeam();
    if (laffTeam && typeof window.openLAFFTeamProfile === 'function') return window.openLAFFTeamProfile(laffTeam.name || raw);

    // Não força carregar a planilha da LAFF em todo clique de equipe histórica.
    return openTeamProfile(raw);
}

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

    let photoEl = document.getElementById('sp-photo');
    if(photoEl) {
        let photoKey = Object.keys(staffPhotos).find(k => k.toLowerCase() === s.nome.toLowerCase().trim());
        photoEl.src = photoKey ? staffPhotos[photoKey] : 'silhueta.png';
    }

    let isPlayer = db.players.find(p => checkNameMatch(p.jogador, s.nome)) || Object.keys(lbffData).find(name => checkNameMatch(name, s.nome));
    let linkContainer = document.getElementById('sp-player-link-container');
    if(linkContainer) {
        linkContainer.innerHTML = isPlayer ?
            `<button class="btn-action" onclick="${_safePPAttr(s.nome)}" style="background: rgba(102, 179, 255, 0.1); border: 1px solid #66b3ff; color: #66b3ff; font-size: 0.85em; margin-bottom: 1[...]
            : '';
    }

    if(t) {
        document.getElementById('sp-team-pos').innerText = `${t.posGeral}º`;
        document.getElementById('sp-team-pts').innerText = t.pontos;
        document.getElementById('sp-team-booyah').innerText = t.booyah;
        document.getElementById('sp-team-avg').innerText = (t.pontos / (t.quedas || 1)).toFixed(1);
    }

    renderUnifiedTrophies(s.nome, 'sp-trophies-container');
    renderHistoricoEquipes(s.nome, 'sp-team-history-container');

    navigate('staff-profile');
    
    let insta = dbSocials[s.nome];
    let container = document.getElementById('sp-insta-container');
    if(container) {
        container.innerHTML = insta ? `
            <a href="https://instagram.com/${insta}" target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 10px; text-decoration: none; background: linear-gradie[...]
                <img src="instagram.png" style="width: 20px;">
                <span style="color: #fff; font-weight: bold; font-size: 1.1em;">@${insta}</span>
            </a>` : '';
    }
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

function renderTeamProfileStats() {
    let tName = currentTeamView;
    let t = db.teams.find(x => x.equipe.toUpperCase() === tName.toUpperCase());

    if(!t) {
        t = { equipe: tName, grupo: "Histórico/Outro" };
    }
    let isHist = t.grupo === "Histórico/Outro";

    let evolutionContainer = document.getElementById('tp-evolution-container');
    let bestWorstContainer = document.getElementById('tp-best-worst-container');
    let statsContainer = document.getElementById('tp-stats-container');
    let confResult = document.getElementById('tp-confrontation-result');
    let btnConf = document.getElementById('btn-confrontation');
    let cardsContainer = document.getElementById('tp-players-cards-container');
    let internalTableWrap = document.querySelector('#table-team-players') ? document.querySelector('#table-team-players').parentElement : null;
    let headers = document.querySelectorAll('#team-profile h3');
    let filters = document.querySelectorAll('#team-profile .filters');

    if (isHist) {
        if(evolutionContainer) evolutionContainer.style.display = 'none';
        if(bestWorstContainer) bestWorstContainer.style.display = 'none';
        if(statsContainer) statsContainer.style.display = 'none';
        if(confResult) confResult.style.display = 'none';
        if(btnConf) btnConf.style.display = 'none';
        if(internalTableWrap) internalTableWrap.style.display = 'none';
        filters.forEach(f => { if(!f.id.includes('day-filters')) f.style.display = 'none'; });

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

        let notablePlayers = [];
        if (typeof dbPassagens !== 'undefined') {
            let playersWithPassage = dbPassagens.filter(p =>
                p.passagens.some(pass => (typeof sameTeamName === 'function' ? sameTeamName(pass.equipe, tName) : pass.equipe.toUpperCase() === tName.toUpperCase()) && pass.cargo.toUpperCase() ==[...]
            );

            playersWithPassage.forEach(pt => {
                let playerName = pt.jogador;
                let hKills = 0, hQuedas = 0;

                let histRecord = typeof lbffData !== 'undefined' ? getHistTotals(playerName) : { k: 0, q: 0 };
                let lbffEntry = histRecord.entry;

                if (histRecord.k > 0 || histRecord.q > 0) {
                    hKills = histRecord.k; hQuedas = histRecord.q;
                }

                let activeName = (typeof getCanonicalPlayerName === 'function') ? getCanonicalPlayerName(playerName) : ((typeof historicalAliases !== 'undefined' && historicalAliases[playerName])[...]
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
                        dano: hKills * 450,
                        assists: Math.floor(hKills * 0.3),
                        ovrOverride: 0
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
                    pCard.ovrOverride = calculateHistoricalOverall(p);
                    return createPlayerCardHTML(pCard, 0.85);
                }).join('');
            } else {
                cardsContainer.innerHTML = '<div style="color:#888; text-align:center; width:100%; padding: 20px;">Sem registo de jogadores notáveis para esta organização.</div>';
            }
        }

    } else {
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

            allTeamsStats.push({ equipe: team.equipe, pontos: stats.pontos, abates: stats.abates, pontos_pos: stats.pontos - stats.abates, dano: danoTotal, booyah: stats.booyah, quedas: stats.que[...]
        });

        let cur = allTeamsStats.find(x => x.equipe === tName);

        if(bestWorstContainer && db.teamDaily[tName]) {
            let sorted = [...db.teamDaily[tName]].sort((a,b) => b.pontos - a.pontos);
            if(sorted.length > 0) {
                bestWorstContainer.innerHTML = `
                    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                        <div class="card" style="flex: 1; border-left: 4px solid #4caf50;"><h3 style="font-size: 0.8em;">🏆 Melhor Dia</h3><div class="value" style="font-size: 1.5em;">${sorted[[...]
                        <div class="card" style="flex: 1; border-left: 4px solid #f44336;"><h3 style="font-size: 0.8em;">⚠️ Pior Dia</h3><div class="value" style="font-size: 1.5em;">${sorted[[...]
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
            const exists = playersList.some(p => typeof checkNameMatch === 'function' ? checkNameMatch(p.jogador, exit.jogador) : String(p.jogador).toLowerCase() === String(exit.jogador).toLowerC[...]
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
        let topAtivos = ativos.slice(0, 6);
        let inativos = playersList.filter(p => p.isEx).sort((a,b) => b.abates - a.abates);

        if (cardsContainer) {
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
                    <button class="btn-action" onclick="let c = document.getElementById('ex-players-div'); if(c.style.display==='none'){c.style.display='flex'; this.innerText='Ocultar saídas / e[...]
                </div>
                <div id="ex-players-div" style="display: none; width: 100%; grid-column: 1 / -1; justify-content: center; gap: 20px; flex-wrap: wrap; margin-top: 10px; padding-top: 25px; border-t[...]
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
                        <div onclick="openStaffProfile('${s.nome}')" style="cursor: pointer; background: #1c1c20; border: 1px solid var(--border); padding: 15px; border-radius: 12px; min-width: 1[...]
                            <div style="width: 70px; height: 70px; border-radius: 50%; overflow: hidden; margin: 0 auto 10px auto; border: 2px solid var(--accent);"><img src="${photo}" style="wid[...]
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
                return `<tr class="${p.isEx ? 'team-player-row-ex' : ''}"><td style="text-align:left;"><span class="clickable" onclick="${_safePPAttr(p.jogador)}">${p.jogador}</span>${exitBadge}<[...]
            }).join('');
        }

        renderTeamChart();
    }

    renderTeamTrophies(tName);
}

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
        acc.pontos += curr.pontos; acc.abates += curr.abates; acc.booyah += curr.booyah; acc.quedas += curr.quedas;
        return acc;
    }, {pontos: 0, abates: 0, booyah: 0, quedas: 0});

    let pDaily = db.playerDaily.filter(p => p.equipe === tName && intersectionDays.includes(p.dia));
    let totalDano = pDaily.reduce((sum, p) => sum + p.dano, 0);

    let ptsColocacao = stats.pontos - stats.abates;
    let totalQuedas = stats.quedas;
    let totalDias = intersectionDays.length;

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
            <div class="card"><div class="card-top-border"></div><h3 style="font-size:0.9em">Média Pts</h3><div class="value">${(stats.pontos/totalQuedas).toFixed(1)}</div><div style="color:#888[...]
            <div class="card"><div class="card-top-border"></div><h3 style="font-size:0.9em">Média Abates</h3><div class="value">${(stats.abates/totalQuedas).toFixed(1)}</div><div style="color:#[...]
            <div class="card"><div class="card-top-border"></div><h3 style="font-size:0.9em">Média Colocação</h3><div class="value">${(ptsColocacao/totalQuedas).toFixed(1)}</div><div style="co[...]
            <div class="card"><div class="card-top-border"></div><h3 style="font-size:0.9em">Média Dano</h3><div class="value">${(totalDano/totalQuedas).toFixed(0)}</div><div style="color:#888;f[...]
            <div class="card"><div class="card-top-border"></div><h3 style="font-size:0.9em">Média Booyah</h3><div class="value">${(stats.booyah/totalDias).toFixed(2)}</div><div style="color:#88[...]
        </div>

        <div style="display: grid; ${gridCSS} gap: 15px;">
            <div class="card" style="background: rgba(255,170,0,0.05); border: 1px solid #444;"><div class="card-top-border" style="background:#888"></div><h3 style="font-size:0.9em">Pontos Totai[...]
            <div class="card" style="background: rgba(255,170,0,0.05); border: 1px solid #444;"><div class="card-top-border" style="background:#888"></div><h3 style="font-size:0.9em">Abates Totai[...]
            <div class="card" style="background: rgba(255,170,0,0.05); border: 1px solid #444;"><div class="card-top-border" style="background:#888"></div><h3 style="font-size:0.9em">Pts Colocaç[...]
            <div class="card" style="background: rgba(255,170,0,0.05); border: 1px solid #444;"><div class="card-top-border" style="background:#888"></div><h3 style="font-size:0.9em">Dano Acumula[...]
            <div class="card" style="background: rgba(255,170,0,0.05); border: 1px solid #444;"><div class="card-top-border" style="background:#888"></div><h3 style="font-size:0.9em">Booyahs Tota[...]
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
                        acc.pontos += curr.pontos; acc.abates += curr.abates; acc.booyah += curr.booyah; acc.quedas += curr.quedas;
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

// ===== FUNÇÕES DE CÁLCULO COM CACHE =====
function calculateOverall(p) {
    let q = p.quedas || 1;
    let avgK = p.abates / q;
    let avgD = p.dano / q;
    let avgA = p.assists / q;
    let avgM = (p.mvp || 0) / q;

    let role = playerRoles[p.jogador] || "RUSH";

    let weightK, weightD, weightA;

    if (role === "SUP") {
        weightK = 0.20; weightD = 0.35; weightA = 0.45;
    } else if (role === "GRAN") {
        weightK = 0.35; weightD = 0.45; weightA = 0.20;
    } else {
        weightK = 0.50; weightD = 0.35; weightA = 0.15;
    }

    let scoreK = Math.min((avgK / 2.6) * 100, 100);
    let scoreD = Math.min((avgD / 1750) * 100, 100);
    let scoreA = Math.min((avgA / 1.2) * 100, 100);

    let baseRaw = (scoreK * weightK) + (scoreD * weightD) + (scoreA * weightA);
    let finalOverall = 68 + (baseRaw / 100) * (85 - 68);

    let repBonus = 0;

    if (typeof titlesData !== 'undefined' && typeof checkNameMatch === 'function') {
        let isWorldChamp = titlesData.coletivos.some(t => t.event.includes("World Series") && t.players && t.players.some(pl => checkNameMatch(pl, p.jogador)));
        let titulosLocais = titlesData.coletivos.filter(t => !t.event.includes("World Series") && t.players && t.players.some(pl => checkNameMatch(pl, p.jogador))).length;

        if (isWorldChamp) repBonus += 4;
        if (titulosLocais >= 2) repBonus += 2;
        else if (titulosLocais === 1) repBonus += 1;
    }

    if (avgM >= 0.13) repBonus += 3;
    else if (avgM >= 0.08) repBonus += 2;
    else if (avgM > 0) repBonus += 1;

    finalOverall += repBonus;

    let eqUpper = p.equipe ? p.equipe.toUpperCase() : "";

    const tierS = ["FLUXO W7M", "LOS", "LOUD SNICKERS"];
    const tierA = ["VIRTUS PRO", "TEAM SOLID", "INTZ"];
    const tierB = ["E1", "E1 ESPORTS", "ALPHA7"];
    const tierC = ["AXS", "LOOPS", "RISE", "RISE GAMING", "RUSH", "INFLUENCE RAGE"];
    const tierD = ["VASCO", "ANGELS", "CIVIS"];

    let minOverall = 65;
    let tierBonus = 0;

    if (tierS.includes(eqUpper)) {
        tierBonus = 3;
        minOverall = 81;
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

    finalOverall += tierBonus;

    if (finalOverall < minOverall) {
        finalOverall = minOverall;
    }

    let result = Math.round(finalOverall);
    if (result > 96) result = 96;
    if (result < 65) result = 65;

    return result;
}

function calculateHistoricalOverall(p) {
    let q = p.quedas || 1;
    let avgK = p.abates / q;

    let scoreBase = 70 + (Math.min(avgK / 1.8, 1) * 25);

    let legacyBonus = 0;
    if (p.abates >= 1000) legacyBonus += 4;
    else if (p.abates >= 500) legacyBonus += 2;

    let titlesBonus = 0;
    if (typeof titlesData !== 'undefined') {
        let titles = titlesData.coletivos.filter(t => t.players?.some(pl => checkNameMatch(pl, p.jogador))).length;
        titlesBonus = Math.min(titles * 1.5, 5);
    }

    let final = Math.round(scoreBase + legacyBonus + titlesBonus);

    if (final < 80) final = 80;
    return final > 96 ? 96 : final;
}

function getOverallColor(ovr) {
    if (ovr >= 90) return '#ffd700';
    if (ovr >= 85) return '#ffea00';
    if (ovr >= 80) return '#e5e5e5';
    if (ovr >= 75) return '#c0c0c0';
    return '#cd7f32';
}

let _ppNameMap = [];
function _openPP(idx) {
    if (_ppNameMap[idx] !== undefined) openPlayerProfile(_ppNameMap[idx]);
}
function _safePPAttr(name) {
    let idx = _ppNameMap.indexOf(name);
    if (idx === -1) { idx = _ppNameMap.length; _ppNameMap.push(name); }
    return `_openPP(${idx})`;
}

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

// ===== Stubs para funções que virão do arquivo original =====
// (Mantém compatibilidade com código existente)
