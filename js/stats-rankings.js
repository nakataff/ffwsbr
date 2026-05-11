// PÁGINA DE ESTATÍSTICAS (MÉDIAS E TOTAIS)

function toggleTeams(e) {
    e.stopPropagation();
    const drop = document.getElementById('teams-drop');
    drop.classList.toggle('active');
}

// Fecha o menu se clicar fora dele
window.addEventListener('click', function(e) {
    const drop = document.getElementById('teams-drop');
    if (drop && !e.target.matches('.nav-teams-btn') && !drop.contains(e.target)) {
        drop.classList.remove('active');
    }
});

// Função auxiliar para normalizar mapas
function normalizeMapName(name) {
    if(!name) return '';
    let n = name.toLowerCase().trim();
    if (n === 'nexterra') return 'nova terra';
    if (n === 'purgatory') return 'purgatório';
    return n;
}

// Função que lê os Novos Campeonatos e distribui para os times
function distribuirNovosResultados() {
    dbCampeonatos.forEach(camp => {
        for (let equipe in camp.resultados) {
            let colocacao = camp.resultados[equipe];

            if (!dbResults[equipe]) {
                dbResults[equipe] = [];
            }

            // Evita duplicata: só injeta se não existir já um resultado
            // com a mesma data E o mesmo nome de torneio para este time
            const jaExiste = dbResults[equipe].some(
                r => r.data === camp.data && r.torneio === camp.torneio
            );
            if (jaExiste) continue;

            dbResults[equipe].push({
                data: camp.data,
                tier: camp.tier,
                place: colocacao,
                torneio: camp.torneio
            });
        }
    });
}

function getDisplayName(name) {
    if (!name) return "";
    // Remove sujeiras da Liquipedia e sufixos internos
    let cleanName = name.split('|')[0];
    cleanName = cleanName.replace(/_Staff|_Coach|_Inativo|_2/g, "");
    return cleanName;
}

function openTeamProfile(teamName) {
    if (!teamName) return;
    currentTeamView = teamName;
    selectedTpDays = [];

    // 1. Busca o time (ignora espaços e maiúsculas)
    let t = db.teams.find(x => x.equipe.trim().toUpperCase() === teamName.trim().toUpperCase());

    // 2. Se for histórico/fora da WB, cria um perfil básico
    if(!t) {
        t = {
            equipe: teamName,
            grupo: "Histórico/Outro",
            posGeral: "-",
            pontos: 0, booyah: 0, abates: 0, quedas: 0
        };
    }

    // 3. Preenche os textos básicos
    document.getElementById('tp-name').innerText = t.equipe;
    document.getElementById('tp-group').innerText = (t.grupo === "Histórico/Outro") ? "EQUIPE HISTÓRICA" : `Grupo ${t.grupo}`;
    document.getElementById('tp-pos').innerText = (t.posGeral === "-") ? "N/A" : `${t.posGeral}º`;

    // 4. Logo com fallback (escudo.webp)
    let logoEl = document.getElementById('tp-logo');
    if (logoEl) {
        logoEl.src = logos[t.equipe] || 'escudo.webp';
        logoEl.style.display = 'block';
    }

    // 5. Lógica do Próximo Jogo (Apenas para times ativos)
    const tpContainer = document.getElementById('tp-next-match-container');
    if (tpContainer) {
        const now = new Date();
        currentTeamNextMatch = agenda.find(m =>
            m.grupos.includes(t.grupo) &&
            (parseMatchDate(m.data).getTime() + (3.5 * 60 * 60 * 1000) > now.getTime())
        );

        if (currentTeamNextMatch && t.grupo !== "Histórico/Outro") {
            const opponentsHtml = currentTeamNextMatch.grupos
                .filter(g => g !== t.grupo)
                .map(g => {
                    const teamsInGroup = db.teams.filter(tm => tm.grupo === g);
                    const logosHtml = teamsInGroup.map(tm =>
                        `<img src="${logos[tm.equipe] || 'escudo.webp'}" class="mini-logo" style="width:18px; height:18px; margin: 0 1px;">`
                    ).join('');
                    return `<div style="margin-top:5px; display:flex; align-items:center; gap:8px;">
                                <span style="font-weight:bold; color:var(--accent); font-size:0.85em;">${g}:</span>
                                <div style="display:flex;">${logosHtml}</div>
                            </div>`;
                }).join('');

            tpContainer.innerHTML = `
                <div style="background: rgba(255, 170, 0, 0.05); border: 1px solid rgba(255,170,0,0.3); padding: 15px; border-radius: 12px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <div style="color: var(--accent); font-size: 0.75em; font-weight: bold; text-transform: uppercase; letter-spacing:1px; margin-bottom:5px;">Próximo Jogo da Equipe</div>
                        <div id="tp-countdown-display" style="font-size: 1.2em; font-weight: bold; color:#fff;">Calculando...</div>
                        <div style="font-size: 0.8em; color: var(--text-muted); margin-top:2px;">${currentTeamNextMatch.data} às 13h</div>
                    </div>
                    <div style="background: rgba(0,0,0,0.2); padding: 10px 15px; border-radius: 8px; border: 1px solid #333;">
                        <div style="font-size: 0.7em; color: #888; text-transform: uppercase; font-weight: bold; margin-bottom: 3px;">Enfrenta:</div>
                        ${opponentsHtml}
                    </div>
                </div>`;
        } else {
            tpContainer.innerHTML = "";
        }
    }

    // 6. Limpa e reconstrói os filtros de confronto
    let oppSelect = document.getElementById('tp-opp-group');
    if (oppSelect) {
        oppSelect.innerHTML = '';
        ['A', 'B', 'C', 'D'].forEach(g => {
            if (g !== t.grupo) oppSelect.innerHTML += `<option value="${g}">Grupo ${g}</option>`;
        });
    }

    // 7. Renderiza as abas de conteúdo
    if (typeof buildDayFilters === 'function') buildDayFilters();
    if (typeof renderTeamProfileStats === 'function') renderTeamProfileStats();
    if (typeof renderTeamConfrontation === 'function') renderTeamConfrontation();

    // 8. Abre a tela
    navigate('team-profile');
    if (typeof updateCountdown === 'function') updateCountdown();
}

function renderHistoricoEquipes(nome, containerId) {
    let container = document.getElementById(containerId);
    if (!container) return;

    let cleanName = typeof getDisplayName === 'function' ? getDisplayName(nome) : nome;
    let targetLower = cleanName.toLowerCase();

    // Busca o histórico do banco de dados antigo
    let hist = typeof dbPassagens !== 'undefined' ? dbPassagens.find(p => p.jogador.toLowerCase() === targetLower) : null;

    // Clona a array para não modificar o banco original
    let passagensArray = hist && hist.passagens ? [...hist.passagens] : [];

    // MÁGICA: VERIFICA SE O JOGADOR ESTÁ ATIVO NA TEMPORADA
    let activePlayer = typeof db !== 'undefined' && db.players ? db.players.find(p => checkNameMatch(p.jogador, nome)) : null;
    let activeStaff = typeof dbStaff !== 'undefined' ? dbStaff.find(s => checkNameMatch(s.nome, nome)) : null;

    let currentActiveTeam = null;
    let currentRole = null;

    // Dá prioridade pro cargo/time atual
    if (activePlayer && !activePlayer.isEx) {
        currentActiveTeam = activePlayer.equipe;
        currentRole = "Jogador";
    } else if (activeStaff) {
        currentActiveTeam = activeStaff.equipe;
        currentRole = activeStaff.cargo || "Staff";
    }

    // Se o jogador estiver ativo, insere o time novo no final da linha do tempo!
    if (currentActiveTeam) {
        let lastPassagem = passagensArray.length > 0 ? passagensArray[passagensArray.length - 1] : null;

        // Só adiciona se o último time já não for igual ao time atual
        if (!lastPassagem || lastPassagem.equipe.toUpperCase() !== currentActiveTeam.toUpperCase()) {
            passagensArray.push({
                equipe: currentActiveTeam,
                cargo: currentRole
            });
        }
    }

    if (passagensArray.length === 0) {
        container.innerHTML = '<div style="color:#888; font-size:0.9em; text-align:center; width:100%; font-weight:bold;">Nenhum histórico de equipes registrado.</div>';
        return;
    }

    container.innerHTML = passagensArray.map((passagem, index) => {
        let logoSrc = logos[passagem.equipe] || 'escudo.webp';
        let equipeUpper = passagem.equipe.toUpperCase();

        let isClickable = typeof db !== 'undefined' && db.teams && db.teams.some(t => t.equipe.toUpperCase() === equipeUpper);

        // Verifica se essa cartinha é a última e representa a equipe ATUAL
        let isLast = index === passagensArray.length - 1;
        let isCurrent = currentActiveTeam && equipeUpper === currentActiveTeam.toUpperCase() && isLast;

        let cursorStyle = isClickable ? 'cursor: pointer; transition: 0.3s;' : 'cursor: default;';
        let styleHighlight = '';
        let hoverStyle = '';

        let clickAction = isClickable ? `onclick="openTeamProfile('${passagem.equipe}')"` : '';
        let sName = typeof shortNames !== 'undefined' && shortNames[passagem.equipe] ? shortNames[passagem.equipe] : passagem.equipe;
        let labelCargo = passagem.cargo;

        // LÓGICA DE CORES E EFEITOS (ATUAL vs ANTIGOS)
        if (isCurrent) {
            // Time atual: Brilhando, 100% visível
            styleHighlight = 'border-color: var(--accent); box-shadow: 0 0 15px rgba(0, 200, 255, 0.4); opacity: 1; filter: grayscale(0);';
            labelCargo = '<span style="color:#00c8ff;">ATUAL</span>';
            if (isClickable) {
                hoverStyle = 'onmouseover="this.style.transform=\'translateY(-3px)\'" onmouseout="this.style.transform=\'none\'"';
            }
        } else {
            // Times antigos: Apagadinhos (Cinza e 50% transparente)
            if (isClickable) {
                styleHighlight = 'border-color: var(--border); opacity: 0.5; filter: grayscale(0.8);';
                // Ao passar o mouse, ele acende e ganha cor
                hoverStyle = 'onmouseover="this.style.borderColor=\'var(--accent)\'; this.style.transform=\'translateY(-3px)\'; this.style.opacity=\'1\'; this.style.filter=\'grayscale(0)\'" onmouseout="this.style.borderColor=\'var(--border)\'; this.style.transform=\'none\'; this.style.opacity=\'0.5\'; this.style.filter=\'grayscale(0.8)\'"';
            } else {
                // Times que não existem mais: Super apagados e sem hover
                styleHighlight = 'border-color: var(--border); opacity: 0.3; filter: grayscale(1);';
            }
        }

        return `
        <div style="display: flex; flex-direction: column; align-items: center; width: 90px;">
            <div style="font-size: 0.55em; color: var(--text-muted); font-weight: bold; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; text-align: center; height: 12px;">
                ${labelCargo}
            </div>

            <div ${clickAction} ${hoverStyle} style="width: 60px; height: 60px; background: rgba(255,255,255,0.02); border: 1px solid; border-radius: 12px; display: flex; justify-content: center; align-items: center; margin-bottom: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); ${cursorStyle} ${styleHighlight}">
                <img src="${logoSrc}" style="width: 40px; height: 40px; object-fit: contain;">
            </div>

            <span style="font-size: 0.65em; color: #fff; font-weight: bold; text-align: center; line-height: 1.2; word-wrap: break-word; width: 100%;">${sName}</span>
        </div>`;
    }).join('<div style="display:flex; align-items:center; color:#444; font-size:1.5em; height: 80px; margin-top: 15px;">➔</div>');
}

function toggleAvgTable() {
    isAvgExpanded = !isAvgExpanded;
    renderTableAvg();
}

function toggleTotalTable() {
    isTotalExpanded = !isTotalExpanded;
    renderTableTotal();
}

function togglePlayerTable() {
    isPlayerExpanded = !isPlayerExpanded;
    renderPlayerStats();
}

function renderPlayerStats() {
    let dayFilter = document.getElementById('filter-player-day')?.value || 'all';
    let confFilter = document.getElementById('filter-player-conf')?.value || 'all'; // NOVO: Filtro de Confronto
    let mapFilter = document.getElementById('filter-player-map')?.value || 'all';
    let teamFilter = document.getElementById('filter-player-team')?.value || 'all';
    let roleFilter = document.getElementById('filter-player-role')?.value || 'all';
    let rookieFilter = document.getElementById('filter-player-rookie')?.value || 'all';

    let aggregatedPlayers = {};

    // Navega pelo novo dbJogadoresQuedas
    for (let d in dbJogadoresQuedas) {
        if (dayFilter !== 'all' && String(d) !== dayFilter) continue;

        // NOVO: Filtro de Confronto (Ignora o dia se não fizer parte do confronto selecionado)
        if (confFilter !== 'all' && !mapConfrontos[confFilter].includes(String(d))) continue;

        for (let q in dbJogadoresQuedas[d]) {
            // Descobre qual mapa foi jogado nessa queda consultando o dbQuedas
            let mapName = dbQuedas[d] && dbQuedas[d][q] ? normalizeMapName(dbQuedas[d][q].mapa) : '';
            if (mapFilter !== 'all' && mapName !== normalizeMapName(mapFilter)) continue;

            let playersInDrop = dbJogadoresQuedas[d][q];

            playersInDrop.forEach(p => {
                if (teamFilter !== 'all' && p.equipe !== teamFilter) return;

                // Procura a role do jogador na sua const playerRoles
                let role = "Desconhecida";

                // Se a sua const for um Array (tipo [{nome: "Raone7", role: "Rush"}])
                if (Array.isArray(playerRoles)) {
                    let roleData = playerRoles.find(r => r.nome?.trim().toLowerCase() === p.nome.trim().toLowerCase());
                    if (roleData) role = roleData.role || roleData.funcao || "-";
                }
                // Se a sua const for um Objeto (tipo { "Raone7": "Rush", "Yago": "Suporte" })
                else if (playerRoles && playerRoles[p.nome]) {
                    role = playerRoles[p.nome];
                }

                if (roleFilter !== 'all' && role.toLowerCase() !== roleFilter.toLowerCase()) return;
                if (rookieFilter !== 'all' && !(typeof isRookiePlayer === 'function' && isRookiePlayer(p.nome))) return;

                // Se passou por todos os filtros, soma!
                if (!aggregatedPlayers[p.nome]) {
                    aggregatedPlayers[p.nome] = { nome: p.nome, equipe: p.equipe, role: role, kills: 0, dano: 0, assists: 0, mvp: 0, quedas: 0 };
                }

                aggregatedPlayers[p.nome].kills += p.kills;
                aggregatedPlayers[p.nome].dano += p.dano;
                aggregatedPlayers[p.nome].assists += p.assists;
                aggregatedPlayers[p.nome].mvp += p.mvp;
                aggregatedPlayers[p.nome].quedas += 1;
            });
        }
    }

    // Transforma em array e ordena por Kills, desempate por Dano
    let result = Object.values(aggregatedPlayers);
    result.sort((a, b) => b.kills - a.kills || b.dano - a.dano);

    // LÓGICA DO BOTÃO "VER MAIS" E TOP 6
    let dataToShow = isPlayerExpanded ? result : result.slice(0, 6);
    let btn = document.getElementById('btn-player-expand');
    if(btn) {
        btn.style.display = result.length > 6 ? 'inline-block' : 'none';
        btn.innerText = isPlayerExpanded ? 'Ocultar' : 'Ver Mais';
    }

    let tbody = document.querySelector('#table-stats-players-detailed tbody');
    if (tbody) {
        tbody.innerHTML = dataToShow.map((p, index) => {
            let sName = shortNames[p.equipe] || p.equipe;
            return `<tr>
                <td style="color:var(--accent); font-weight:bold;">${index + 1}º</td>
                <td style="text-align:left;">
                    <span style="font-weight:bold; color:#fff;">${p.nome}</span>
                    <div style="font-size:0.75em; color:#888;">${sName}</div>
                </td>
                <td class="hide-mobile" style="color:#aaa; font-size: 0.9em;">${p.role}</td>
                <td style="font-weight:bold; color:var(--accent);">${p.kills}</td>
                <td>${p.dano}</td>
                <td class="hide-mobile" style="color:#aaa;">${p.assists}</td>
                <td>${p.quedas}</td>
            </tr>`;
        }).join('');
    }
}

// Chame renderPlayerStats() no seu window.onload!

// --- NOVAS FUNÇÕES DA ABA ESTATÍSTICAS ---

// 1. CARDS TOP 5 POR MAPA
function renderTop5Stats() {
    buildDayFilters(); // Garante que os botões de dia atualizem o visual
    let mapFilter = document.getElementById('top5-map-filter').value;
    let targetMap = mapFilter === 'all' ? 'all' : normalizeMapName(mapFilter);

    let teamStats = {};
    let playerStats = {};

    db.teams.forEach(t => teamStats[t.equipe] = { equipe: t.equipe, pontos: 0, kills: 0, booyahs: 0, somaPosicao: 0, quedas: 0, top3: 0, top12: 0 });

    for(let d in dbQuedas) {
        // Filtro de Dia
        if (selectedTop5Days.length > 0 && !selectedTop5Days.includes(String(d))) continue;

        for (let q in dbQuedas[d]) {
            let drop = dbQuedas[d][q];
            let currentMap = normalizeMapName(drop.mapa);

            // Filtro de Mapa
            if (targetMap !== 'all' && currentMap !== targetMap) continue;

            // Agregação de Times
            drop.resultados.forEach(res => {
                let tm = teamStats[res.equipe];
                if(tm) {
                    tm.pontos += (posPoints[res.posicao] || 0) + res.kills;
                    tm.kills += res.kills;
                    tm.booyahs += res.booyah;
                    tm.somaPosicao += res.posicao;
                    tm.quedas += 1;
                    if(res.posicao <= 3) tm.top3 += 1;
                    if(res.posicao === 12) tm.top12 += 1;
                }
            });

            // Agregação de Jogadores
            if(dbJogadoresQuedas[d] && dbJogadoresQuedas[d][q]) {
                dbJogadoresQuedas[d][q].forEach(p => {
                    if(!playerStats[p.nome]) playerStats[p.nome] = { jogador: p.nome, equipe: p.equipe, kills: 0, dano: 0, assists: 0, quedas: 0 };
                    playerStats[p.nome].kills += p.kills;
                    playerStats[p.nome].dano += p.dano;
                    playerStats[p.nome].assists += p.assists;
                    playerStats[p.nome].quedas += 1;
                });
            }
        }
    }

    let validTeams = Object.values(teamStats).filter(t => t.quedas > 0);
    let validPlayers = Object.values(playerStats).filter(p => p.quedas > 0);

    // Calcula médias
    validTeams.forEach(t => {
        t.avgPts = t.pontos / t.quedas;
        t.avgKills = t.kills / t.quedas;
        t.avgPos = t.somaPosicao / t.quedas;
        t.avgTop3 = t.top3 / t.quedas;
    });
    validPlayers.forEach(p => {
        p.avgKills = p.kills / p.quedas;
        p.avgDano = p.dano / p.quedas;
        p.avgAssists = p.assists / p.quedas;
    });

    // Calcula participacao relativa: total acumulado do jogador / total acumulado da equipe
    let partStats = {};
    let teamAccTotals = {};
    for(let d in dbQuedas) {
        if (selectedTop5Days.length > 0 && !selectedTop5Days.includes(String(d))) continue;
        for (let q in dbQuedas[d]) {
            let drop = dbQuedas[d][q];
            let currentMap = normalizeMapName(drop.mapa);
            if (targetMap !== 'all' && currentMap !== targetMap) continue;
            if(dbJogadoresQuedas[d] && dbJogadoresQuedas[d][q]) {
                dbJogadoresQuedas[d][q].forEach(p => {
                    let key = p.nome;
                    if(!partStats[key]) partStats[key] = { jogador: p.nome, equipe: p.equipe, kills: 0, dano: 0, assists: 0, quedas: 0 };
                    partStats[key].kills   += p.kills;
                    partStats[key].dano    += p.dano;
                    partStats[key].assists += p.assists;
                    partStats[key].quedas  += 1;
                    if(!teamAccTotals[p.equipe]) teamAccTotals[p.equipe] = { kills: 0, dano: 0, assists: 0 };
                    teamAccTotals[p.equipe].kills   += p.kills;
                    teamAccTotals[p.equipe].dano    += p.dano;
                    teamAccTotals[p.equipe].assists += p.assists;
                });
            }
        }
    }
    let validPart = Object.values(partStats).filter(p => p.quedas >= 3);
    validPart.forEach(p => {
        let tt = teamAccTotals[p.equipe] || { kills: 0, dano: 0, assists: 0 };
        p.avgPartKills   = tt.kills   > 0 ? (p.kills   / tt.kills)   * 100 : 0;
        p.avgPartDano    = tt.dano    > 0 ? (p.dano    / tt.dano)    * 100 : 0;
        p.avgPartAssists = tt.assists > 0 ? (p.assists / tt.assists) * 100 : 0;
    });

    let validRookies = validPlayers.filter(p => typeof isRookiePlayer === 'function' && isRookiePlayer(p.jogador));

    // ---- Funções auxiliares de renderização com paginação ----
    // Estado de página por card (indexado por id único do card)
    if(!window._top5Pages) window._top5Pages = {};

    const getPagedCardHtml = (cardId, sortedAll, rowFn, headerHtml, pageSize) => {
        pageSize = pageSize || 4;
        let page = window._top5Pages[cardId] || 0;
        let totalPages = Math.ceil(sortedAll.length / pageSize);
        if(page >= totalPages) page = 0;
        if(page < 0) page = 0;
        let slice = sortedAll.slice(page * pageSize, page * pageSize + pageSize);
        let rows = slice.map((item, i) => rowFn(item, page * pageSize + i)).join('');
        let isFirst = page === 0;
        let isLast  = page >= totalPages - 1;
        let btnLeft  = isFirst
            ? `<button disabled style="background:rgba(255,255,255,0.02); border:1px solid #222; color:#333; border-radius:50%; width:26px; height:26px; cursor:default; font-size:1em; display:flex; align-items:center; justify-content:center;">&#8249;</button>`
            : `<button onclick="event.stopPropagation(); _top5PageNav('${cardId}', -1)" style="background:rgba(255,255,255,0.07); border:1px solid #333; color:#aaa; border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:1em; display:flex; align-items:center; justify-content:center;">&#8249;</button>`;
        let btnRight = isLast
            ? `<button onclick="event.stopPropagation(); _top5PageNav('${cardId}', 'reset')" title="Voltar ao inicio" style="background:rgba(255,255,255,0.07); border:1px solid #333; color:var(--accent); border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:0.85em; display:flex; align-items:center; justify-content:center;">&#8635;</button>`
            : `<button onclick="event.stopPropagation(); _top5PageNav('${cardId}', 1)" style="background:rgba(255,255,255,0.07); border:1px solid #333; color:#aaa; border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:1em; display:flex; align-items:center; justify-content:center;">&#8250;</button>`;
        let nav = totalPages > 1 ? `
            <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:10px; padding-top:8px; border-top:1px solid #222;">
                ${btnLeft}
                <span style="font-size:0.75em; color:#666;">Top ${page*pageSize+1}&#8211;${Math.min((page+1)*pageSize, sortedAll.length)}</span>
                ${btnRight}
            </div>` : '';
        return headerHtml + rows + nav;
    };

    const borderColor = i => i===0?'#ffd700':(i===1?'#c0c0c0':(i===2?'#cd7f32':'#888'));

    const getTeamHtml = (cardId, arr, valFn, formatFn, label) => {
        const sorted = [...arr].sort((a,b) => valFn(b) - valFn(a));
        const header = `<div style="display: grid; grid-template-columns: 1fr 0.5fr; padding: 0 10px 8px 10px; font-size: 0.7em; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;"><div>Equipe</div><div style="text-align: right;">${label}</div></div>`;
        const rowFn = (t, globalIdx) => `<div style="display: grid; grid-template-columns: 1fr 0.5fr; align-items: center; margin-bottom: 6px; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 4px; border-left: 3px solid ${borderColor(globalIdx)}; font-size: 0.85em;">
                <div class="clickable" onclick="openTeamProfile('${t.equipe}')" style="display: flex; align-items: center; gap: 6px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span style="font-weight:bold; color: #555; margin-right: 4px;">${globalIdx+1}º</span><img src="${logos[t.equipe]||''}" style="width:16px; height:16px; object-fit: contain;"><span style="font-size: 0.95em; font-weight:bold;">${shortNames[t.equipe] || t.equipe}</span></div>
                <div style="font-weight: bold; color: var(--accent); text-align: right;">${formatFn(valFn(t))}</div>
            </div>`;
        return getPagedCardHtml(cardId, sorted, rowFn, header, 4);
    };

    const getTeamHtmlAsc = (cardId, arr, valFn, formatFn, label) => {
        const sorted = [...arr].sort((a,b) => valFn(a) - valFn(b));
        const header = `<div style="display: grid; grid-template-columns: 1fr 0.5fr; padding: 0 10px 8px 10px; font-size: 0.7em; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;"><div>Equipe</div><div style="text-align: right;">${label}</div></div>`;
        const rowFn = (t, globalIdx) => `<div style="display: grid; grid-template-columns: 1fr 0.5fr; align-items: center; margin-bottom: 6px; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 4px; border-left: 3px solid ${borderColor(globalIdx)}; font-size: 0.85em;">
                <div class="clickable" onclick="openTeamProfile('${t.equipe}')" style="display: flex; align-items: center; gap: 6px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span style="font-weight:bold; color: #555; margin-right: 4px;">${globalIdx+1}º</span><img src="${logos[t.equipe]||''}" style="width:16px; height:16px; object-fit: contain;"><span style="font-size: 0.95em; font-weight:bold;">${shortNames[t.equipe] || t.equipe}</span></div>
                <div style="font-weight: bold; color: var(--accent); text-align: right;">${formatFn(valFn(t))}</div>
            </div>`;
        return getPagedCardHtml(cardId, sorted, rowFn, header, 4);
    };

    // Helper: 2 colunas de valor — valor principal (bold) + valor secundário (muted)
    const getTeamHtml2Col = (cardId, arr, valFn, formatFn, secFn, label, secLabel) => {
        const sorted = [...arr].sort((a,b) => valFn(b) - valFn(a));
        const header = `<div style="display: grid; grid-template-columns: 1fr 0.5fr 0.4fr; padding: 0 10px 8px 10px; font-size: 0.7em; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;"><div>Equipe</div><div style="text-align: right;">${label}</div><div style="text-align: right; color:#444;">${secLabel}</div></div>`;
        const rowFn = (t, globalIdx) => `<div style="display: grid; grid-template-columns: 1fr 0.5fr 0.4fr; align-items: center; margin-bottom: 6px; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 4px; border-left: 3px solid ${borderColor(globalIdx)}; font-size: 0.85em;">
                <div class="clickable" onclick="openTeamProfile('${t.equipe}')" style="display: flex; align-items: center; gap: 6px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span style="font-weight:bold; color: #555; margin-right: 4px;">${globalIdx+1}º</span><img src="${logos[t.equipe]||''}" style="width:16px; height:16px; object-fit: contain;"><span style="font-size: 0.95em; font-weight:bold;">${shortNames[t.equipe] || t.equipe}</span></div>
                <div style="font-weight: bold; color: var(--accent); text-align: right;">${formatFn(valFn(t))}</div>
                <div style="color: #555; font-size: 0.9em; text-align: right;">${secFn(t)}</div>
            </div>`;
        return getPagedCardHtml(cardId, sorted, rowFn, header, 4);
    };

    const getPlayerHtml = (cardId, arr, valFn, formatFn, label) => {
        const sorted = [...arr].sort((a,b) => valFn(b) - valFn(a));
        const header = `<div style="display: grid; grid-template-columns: 1.2fr 1fr 0.7fr; padding: 0 10px 8px 10px; font-size: 0.7em; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;"><div>Jogador</div><div>Equipe</div><div style="text-align: right;">${label}</div></div>`;
        const rowFn = (p, globalIdx) => `<div style="display: grid; grid-template-columns: 1.2fr 1fr 0.7fr; align-items: center; margin-bottom: 6px; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 4px; border-left: 3px solid ${borderColor(globalIdx)}; font-size: 0.85em;">
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span style="font-weight:bold; color: #555; margin-right: 4px;">${globalIdx+1}º</span><span class="clickable" onclick="${_safePPAttr(p.jogador)}" title="${p.jogador}">${p.jogador}</span></div>
                <div class="clickable" onclick="openTeamProfile('${p.equipe}')" style="display: flex; align-items: center; gap: 6px; color: #9aa0a6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><img src="${logos[p.equipe]||''}" style="width:14px; height:14px; object-fit: contain;"><span style="font-size: 0.9em;">${shortNames[p.equipe] || p.equipe}</span></div>
                <div style="font-weight: bold; color: var(--accent); text-align: right;">${formatFn(valFn(p))}</div>
            </div>`;
        return getPagedCardHtml(cardId, sorted, rowFn, header, 4);
    };

    document.getElementById('top5-container').innerHTML = `
        <h4 id="anchor-totais-equipe" style="color:#66b3ff; margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Totais por Equipe</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Top Pontos</h3>${getTeamHtml('eq-pts', validTeams, t=>t.pontos, v=>v, "Pts")}</div>
            <div class="card"><div class="card-top-border"></div><h3>Top Abates</h3>${getTeamHtml('eq-kills', validTeams, t=>t.kills, v=>v, "Kills")}</div>
            <div class="card"><div class="card-top-border"></div><h3>Top Booyahs</h3>${getTeamHtml('eq-booyah', validTeams, t=>t.booyahs, v=>v, "B!")}</div>
        </div>

        <h4 id="anchor-medias-equipe" style="color:#66b3ff; margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Médias por Equipe</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Média Pontos</h3>${getTeamHtml('eq-avgpts', validTeams, t=>t.avgPts, v=>v.toFixed(2), "Média")}</div>
            <div class="card"><div class="card-top-border"></div><h3>Média Abates</h3>${getTeamHtml('eq-avgkills', validTeams, t=>t.avgKills, v=>v.toFixed(2), "Média")}</div>
            <div class="card"><div class="card-top-border"></div><h3>Colocação Média</h3>${getTeamHtmlAsc('eq-avgpos', validTeams, t=>t.avgPos, v=>v.toFixed(2)+"º", "Pos")}</div>
        </div>

        <h4 id="anchor-top3-equipe" style="color:#66b3ff; margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Top 3 &amp; Último Lugar por Equipe <span style="font-size:0.55em; color:#888; text-transform:none; font-weight:normal;">(número de quedas ao lado)</span></h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>+ Vezes no Top 3</h3>${getTeamHtml2Col('eq-top3-count', validTeams, t=>t.top3, v=>v, t=>t.quedas, "Top3", "Q")}</div>
            <div class="card"><div class="card-top-border"></div><h3>Maior Média Top 3</h3>${getTeamHtml2Col('eq-top3-avg', validTeams, t=>t.avgTop3, v=>(v*100).toFixed(1)+"%", t=>t.top3+" x", "% Top3", "N")}</div>
            <div class="card"><div class="card-top-border"></div><h3>+ Vezes em Último (12º)</h3>${getTeamHtml2Col('eq-top12-count', validTeams, t=>t.top12, v=>v, t=>t.quedas, "12º", "Q")}</div>
        </div>

        <h4 style="color:var(--accent); margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Totais por Jogador</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Top Abates</h3>${getPlayerHtml('pl-totkills', validPlayers, p=>p.kills, v=>v, "Kills")}</div>
            <div class="card"><div class="card-top-border"></div><h3>Top Dano</h3>${getPlayerHtml('pl-totdano', validPlayers, p=>p.dano, v=>v, "Dano")}</div>
            <div class="card"><div class="card-top-border"></div><h3>Top Assistências</h3>${getPlayerHtml('pl-totast', validPlayers, p=>p.assists, v=>v, "Ast")}</div>
        </div>

        <h4 style="color:var(--accent); margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Médias por Jogador</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Média Abates</h3>${getPlayerHtml('pl-avgkills', validPlayers, p=>p.avgKills, v=>v.toFixed(2), "Média")}</div>
            <div class="card"><div class="card-top-border"></div><h3>Média Dano</h3>${getPlayerHtml('pl-avgdano', validPlayers, p=>p.avgDano, v=>v.toFixed(0), "Média")}</div>
            <div class="card"><div class="card-top-border"></div><h3>Média Assistências</h3>${getPlayerHtml('pl-avgast', validPlayers, p=>p.avgAssists, v=>v.toFixed(2), "Média")}</div>
        </div>

        <h4 style="color:var(--accent); margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Participacao Relativa a Equipe <span style="font-size:0.6em; color:#666; text-transform: none; font-weight: normal;">(media % de contribuicao por queda — min. 3 quedas)</span></h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Part. Kills</h3>${getPlayerHtml('pl-partkills', validPart, p=>p.avgPartKills, v=>v.toFixed(1)+"%", "%")}</div>
            <div class="card"><div class="card-top-border"></div><h3>Part. Dano</h3>${getPlayerHtml('pl-partdano', validPart, p=>p.avgPartDano, v=>v.toFixed(1)+"%", "%")}</div>
            <div class="card"><div class="card-top-border"></div><h3>Part. Assists</h3>${getPlayerHtml('pl-partast', validPart, p=>p.avgPartAssists, v=>v.toFixed(1)+"%", "%")}</div>
        </div>

        <h4 style="color:var(--accent); margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Jogadores Novatos</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
            <div class="card"><div class="card-top-border"></div><h3>Kills</h3>${getPlayerHtml('rookie-kills', validRookies, p=>p.kills, v=>v, "Kills")}</div>
            <div class="card"><div class="card-top-border"></div><h3>Dano</h3>${getPlayerHtml('rookie-dano', validRookies, p=>p.dano, v=>v, "Dano")}</div>
            <div class="card"><div class="card-top-border"></div><h3>Assistência</h3>${getPlayerHtml('rookie-assists', validRookies, p=>p.assists, v=>v, "Ast")}</div>
        </div>
    `;
}

// Funcao de navegacao de pagina dos cards de ranking
function _top5PageNav(cardId, dir) {
    if(!window._top5Pages) window._top5Pages = {};
    if(dir === 'reset') {
        window._top5Pages[cardId] = 0;
    } else {
        window._top5Pages[cardId] = (window._top5Pages[cardId] || 0) + dir;
    }
    renderTop5Stats();
}

// 2. FUNÇÃO AUXILIAR PARA AGREGAR DADOS DAS TABELAS
function getAggregatedTeamsForStats(daysFilter, mapFilter) {
    let teamsMapStats = {};
    db.teams.forEach(t => {
        teamsMapStats[t.equipe] = { equipe: t.equipe, pontos: 0, kills: 0, booyahs: 0, quedas: 0, somaPosicao: 0 };
    });

    for (let d in dbQuedas) {
        if (daysFilter.length > 0 && !daysFilter.includes(String(d))) continue;

        for (let q in dbQuedas[d]) {
            let drop = dbQuedas[d][q];
            let currentMap = normalizeMapName(drop.mapa);

            if (mapFilter === 'all' || currentMap === mapFilter) {
                drop.resultados.forEach(res => {
                    let tm = teamsMapStats[res.equipe];
                    if (tm) {
                        let pts = posPoints[res.posicao] || 0;
                        tm.pontos += (pts + res.kills);
                        tm.kills += res.kills;
                        tm.booyahs += res.booyah;
                        tm.quedas += 1;
                        tm.somaPosicao += res.posicao;
                    }
                });
            }
        }
    }
    return Object.values(teamsMapStats).filter(t => t.quedas > 0);
}

// 3. TABELA DE RANKING DE MÉDIAS
// 1. TABELA DE RANKING DE MÉDIAS
function renderTableAvg() {
    buildDayFilters(); // Reconstrói os chips em caso de clique
    let targetMap = normalizeMapName(document.getElementById('avg-map-filter').value);
    let confFilter = document.getElementById('avg-conf-filter').value; // NOVO: Filtro de Confronto

    // Lógica para cruzar os Dias Selecionados com o Confronto
    let finalDays = [...selectedAvgDays];
    if (confFilter !== 'all') {
        let diasDoConfronto = mapConfrontos[confFilter] || [];
        if (finalDays.length === 0) {
            finalDays = diasDoConfronto; // Se não selecionou dia nenhum, usa os do confronto
        } else {
            // Se selecionou dia, checa se ele bate com o confronto
            finalDays = finalDays.filter(d => diasDoConfronto.includes(String(d)));
            if (finalDays.length === 0) finalDays = ['999']; // Evita puxar "todos os dias" por engano
        }
    }

    let validTeams = getAggregatedTeamsForStats(finalDays, targetMap);

    validTeams.forEach(t => {
        t.avgPts = (t.pontos / t.quedas).toFixed(1);
        t.avgKills = (t.kills / t.quedas).toFixed(1);
        t.avgPos = (t.somaPosicao / t.quedas).toFixed(1);
    });
    validTeams.sort((a, b) => b.avgPts - a.avgPts);

    // LÓGICA DO BOTÃO "VER MAIS" E TOP 6
    let dataToShow = isAvgExpanded ? validTeams : validTeams.slice(0, 6);
    let btn = document.getElementById('btn-avg-expand');
    if(btn) {
        btn.style.display = validTeams.length > 6 ? 'inline-block' : 'none';
        btn.innerText = isAvgExpanded ? 'Ocultar' : 'Ver Mais';
    }

    let tbodyAvg = document.querySelector('#table-stats-avg tbody');
    if(tbodyAvg) {
        tbodyAvg.innerHTML = dataToShow.map((t, index) => {
            let logoSrc = logos[t.equipe] || '';
            let sName = shortNames[t.equipe] || t.equipe;
            return `<tr>
                <td style="color:var(--accent); font-weight:bold;">${index + 1}º</td>
                <td class="team-cell clickable" onclick="openTeamProfile('${t.equipe}')">
                    <img src="${logoSrc}" class="team-logo hide-mobile">
                    <span class="full-name-desktop">${t.equipe}</span>
                    <span class="short-name-mobile">${sName}</span>
                </td>
                <td style="color:var(--accent); font-weight:bold">${t.avgPts}</td>
                <td>${t.avgKills}</td>
                <td style="color: #aaa;">${t.avgPos}º</td>
                <td class="hide-mobile">${t.quedas}</td>
            </tr>`;
        }).join('');
    }
}

// 4. TABELA DE RANKING DE TOTAIS
function renderTableTotal() {
    buildDayFilters(); // Reconstrói os chips em caso de clique
    let targetMap = normalizeMapName(document.getElementById('total-map-filter').value);
    let confFilter = document.getElementById('total-conf-filter').value; // NOVO: Filtro de Confronto

    // Lógica para cruzar os Dias Selecionados com o Confronto
    let finalDays = [...selectedTotalDays];
    if (confFilter !== 'all') {
        let diasDoConfronto = mapConfrontos[confFilter] || [];
        if (finalDays.length === 0) {
            finalDays = diasDoConfronto; // Se não selecionou dia nenhum, usa os do confronto
        } else {
            // Se selecionou dia, checa se ele bate com o confronto
            finalDays = finalDays.filter(d => diasDoConfronto.includes(String(d)));
            if (finalDays.length === 0) finalDays = ['999']; // Evita puxar "todos os dias" por engano
        }
    }

    let validTeams = getAggregatedTeamsForStats(finalDays, targetMap);

    validTeams.sort((a, b) => b.pontos - a.pontos);

    // LÓGICA DO BOTÃO "VER MAIS" E TOP 6
    let dataToShow = isTotalExpanded ? validTeams : validTeams.slice(0, 6);
    let btn = document.getElementById('btn-total-expand');
    if(btn) {
        btn.style.display = validTeams.length > 6 ? 'inline-block' : 'none';
        btn.innerText = isTotalExpanded ? 'Ocultar' : 'Ver Mais';
    }

    let tbodyTotal = document.querySelector('#table-stats-total tbody');
    if(tbodyTotal) {
        tbodyTotal.innerHTML = dataToShow.map((t, index) => {
            let logoSrc = logos[t.equipe] || '';
            let sName = shortNames[t.equipe] || t.equipe;
            return `<tr>
                <td style="color:var(--accent); font-weight:bold;">${index + 1}º</td>
                <td class="team-cell clickable" onclick="openTeamProfile('${t.equipe}')">
                    <img src="${logoSrc}" class="team-logo hide-mobile">
                    <span class="full-name-desktop">${t.equipe}</span>
                    <span class="short-name-mobile">${sName}</span>
                </td>
                <td style="color:var(--accent); font-weight:bold">${t.pontos}</td>
                <td>${t.booyahs}</td>
                <td>${t.kills}</td>
            </tr>`;
        }).join('');
    }
}

    // --- LÓGICA DA PESQUISA GLOBAL ---

    // --- LÓGICA DA PESQUISA GLOBAL ---
