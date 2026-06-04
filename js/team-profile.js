// ============== TEAM PROFILE E MODAL ==============
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

    const activeWBTeam = (typeof db !== 'undefined' && db?.teams)
        ? db.teams.find(t => t?.equipe && (typeof sameTeamName === 'function' ? sameTeamName(t.equipe, raw) : String(t.equipe).toUpperCase() === raw.toUpperCase()))
        : null;
    if (activeWBTeam) return openTeamProfile(activeWBTeam.equipe || raw);

    if (typeof window.loadLAFFData === 'function' && typeof window.openLAFFTeamProfile === 'function') {
        return window.loadLAFFData().then(() => {
            const loadedTeam = findLAFFTeam();
            if (loadedTeam) return window.openLAFFTeamProfile(loadedTeam.name || raw);
            return openTeamProfile(raw);
        }).catch(() => openTeamProfile(raw));
    }

    return openTeamProfile(raw);
}

function cffFormatCompactStat(value) {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 1000000) return `${Math.floor(n / 1000000)}M`;
    if (Math.abs(n) >= 1000) return `${Math.floor(n / 1000)}k`;
    return String(n);
}


let cffTeamProfileStage = 'geral';
let cffTeamChartStage = 'classificatoria';

function cffTeamProfileNormTeam(name) {
    if (typeof normalizeTeamAlias === 'function') return normalizeTeamAlias(name);
    return String(name || '').trim().toUpperCase();
}

function cffTeamProfileSameTeam(a, b) {
    if (typeof sameTeamName === 'function') return sameTeamName(a, b);
    return cffTeamProfileNormTeam(a) === cffTeamProfileNormTeam(b);
}

function cffTeamProfileEscape(value) {
    if (typeof cffEscapeHTML === 'function') return cffEscapeHTML(value);
    return String(value ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}

function cffTeamProfileGetStage() {
    return document.getElementById('tp-stage-filter')?.value || cffTeamProfileStage || 'geral';
}

function cffSetTeamProfileStage(stage) {
    cffTeamProfileStage = ['classificatoria', 'geral', 'final'].includes(stage) ? stage : 'geral';
    selectedTpDays = [];
    const select = document.getElementById('tp-stage-filter');
    if (select && select.value !== cffTeamProfileStage) select.value = cffTeamProfileStage;
    if (typeof buildDayFilters === 'function') buildDayFilters();
    if (typeof renderTeamProfileStats === 'function') renderTeamProfileStats();
    if (typeof renderTeamChart === 'function') renderTeamChart();
}

function cffSetTeamChartStage(stage) {
    cffTeamChartStage = ['classificatoria', 'final'].includes(stage) ? stage : 'classificatoria';
    const select = document.getElementById('chart-stage');
    if (select && select.value !== cffTeamChartStage) select.value = cffTeamChartStage;
    if (typeof renderTeamChart === 'function') renderTeamChart();
}

function cffTeamProfileStageLabel(stage) {
    return stage === 'final' ? 'Final' : stage === 'classificatoria' ? 'Classificatória' : 'Geral';
}

function cffTeamProfileGetQuedas(stage) {
    if (typeof cffGetStageQuedas === 'function') return cffGetStageQuedas(stage);
    return dbQuedas || {};
}

function cffTeamProfileGetPlayerDaily(stage) {
    if (typeof cffGetPlayerDailyByStage === 'function') return cffGetPlayerDailyByStage(stage);
    return db?.playerDaily || [];
}

function cffTeamProfileAggregateTeamRows(stage = 'geral', options = {}) {
    const drops = cffTeamProfileGetQuedas(stage);
    const selectedDays = (options.selectedDays || []).map(String);
    const rows = {};
    Object.keys(drops || {}).sort((a,b)=>Number(a)-Number(b)).forEach(day => {
        if (selectedDays.length && !selectedDays.includes(String(day))) return;
        Object.keys(drops[day] || {}).sort((a,b)=>Number(a)-Number(b)).forEach(round => {
            const drop = drops[day][round] || {};
            (drop.resultados || []).forEach(res => {
                const team = res.equipe || '';
                if (!team) return;
                const key = cffTeamProfileNormTeam(team);
                if (!rows[key]) rows[key] = { equipe: team, pontos: 0, abates: 0, booyah: 0, quedas: 0, avg: 0 };
                rows[key].pontos += (Number(posPoints?.[res.posicao]) || 0) + (Number(res.kills) || 0);
                rows[key].abates += Number(res.kills) || 0;
                rows[key].booyah += Number(res.booyah) || 0;
                rows[key].quedas += 1;
            });
        });
    });
    return Object.values(rows).map(t => ({ ...t, avg: t.quedas ? t.pontos / t.quedas : 0 }))
        .sort((a,b)=>b.pontos-a.pontos || b.booyah-a.booyah || b.abates-a.abates)
        .map((t, idx)=>({ ...t, rank: idx + 1 }));
}

function cffTeamProfileSimulateFinalChampion() {
    const drops = cffTeamProfileGetQuedas('final');
    const rules = (typeof CFF_FINAL_RULES !== 'undefined') ? CFF_FINAL_RULES : { championPoint: 160, totalDrops: 16 };
    const scores = {};
    const ordered = [];
    Object.keys(drops || {}).sort((a,b)=>Number(a)-Number(b)).forEach(day => {
        Object.keys(drops[day] || {}).sort((a,b)=>Number(a)-Number(b)).forEach(round => ordered.push({ day, round, drop: drops[day][round] }));
    });
    for (const item of ordered) {
        const results = Array.isArray(item.drop?.resultados) ? item.drop.resultados : [];
        for (const res of results) {
            const before = Number(scores[res.equipe] || 0);
            if (before >= Number(rules.championPoint || 160) && Number(res.booyah) === 1) return { equipe: res.equipe, mode: 'champion-point', day: item.day, round: item.round };
        }
        for (const res of results) scores[res.equipe] = Number(scores[res.equipe] || 0) + (Number(posPoints?.[res.posicao]) || 0) + (Number(res.kills) || 0);
    }
    if (ordered.length >= Number(rules.totalDrops || 16)) {
        const leader = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
        if (leader) return { equipe: leader[0], mode: 'points', pontos: leader[1] };
    }
    return null;
}

function cffTeamProfileFinalDisplayRows() {
    let rows = cffTeamProfileAggregateTeamRows('final');
    const champion = cffTeamProfileSimulateFinalChampion();
    if (champion?.equipe) {
        const championRow = rows.find(r => cffTeamProfileSameTeam(r.equipe, champion.equipe));
        if (championRow) rows = [championRow, ...rows.filter(r => !cffTeamProfileSameTeam(r.equipe, champion.equipe))];
    }
    return rows.map((r, idx) => ({ ...r, rank: idx + 1, isChampion: !!champion?.equipe && cffTeamProfileSameTeam(r.equipe, champion.equipe) }));
}

function cffTeamProfileFinalRow(teamName) {
    return cffTeamProfileFinalDisplayRows().find(r => cffTeamProfileSameTeam(r.equipe, teamName)) || null;
}

function cffTeamProfileIsEWC(teamName) {
    return ['LOUD SNICKERS','LOUD','LOS','FLUXO W7M','FLUXO','FX W7M','FX'].some(t => cffTeamProfileSameTeam(t, teamName));
}

function cffTeamProfileEnsureFinalSummary(t, finalRow) {
    const posBox = document.getElementById('tp-pos')?.closest('div');
    if (!posBox) return;
    let box = document.getElementById('tp-final-summary');
    if (!box) {
        box = document.createElement('div');
        box.id = 'tp-final-summary';
        box.style.cssText = 'margin-top:10px;display:grid;gap:8px;';
        posBox.appendChild(box);
    }
    const group = (t?.grupo && t.grupo !== 'Histórico/Outro') ? `Grupo ${cffTeamProfileEscape(t.grupo)}` : 'Equipe histórica';
    const ewc = cffTeamProfileIsEWC(t?.equipe || currentTeamView);
    if (!finalRow) {
        box.innerHTML = `<div style="font-size:.82rem;color:var(--text-muted);font-weight:800;">${group}</div>`;
        return;
    }
    box.innerHTML = `
        ${finalRow.isChampion ? '<div style="color:#ffd700;font-weight:950;letter-spacing:1px;text-transform:uppercase;font-size:.82rem;">🏆 Atual campeã da FFWS Brasil 2026 S1</div>' : ''}
        <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">
            <span style="border:1px solid rgba(0,200,255,.28);background:rgba(0,200,255,.07);border-radius:999px;padding:5px 9px;color:#9fdcff;font-weight:900;font-size:.72rem;text-transform:uppercase;">${group}</span>
            <span style="border:1px solid rgba(255,215,0,.28);background:rgba(255,215,0,.07);border-radius:999px;padding:5px 9px;color:#ffd700;font-weight:900;font-size:.72rem;text-transform:uppercase;">Final: ${finalRow.rank}º</span>
            ${ewc ? '<span style="border:1px solid rgba(74,168,255,.35);background:rgba(74,168,255,.10);border-radius:999px;padding:5px 9px;color:#74b6ff;font-weight:900;font-size:.72rem;text-transform:uppercase;">✈️ Classificado para a EWC 2026</span>' : ''}
        </div>
        <div style="color:var(--text-muted);font-weight:800;font-size:.86rem;">${Number(finalRow.pontos)||0} pts • ${Number(finalRow.booyah)||0} B! • ${Number(finalRow.abates)||0} K • ${Number(finalRow.quedas)||0} Q</div>`;
}

function cffTeamProfileFinalTitleForTeam(teamName) {
    const finalRow = cffTeamProfileFinalRow(teamName);
    if (!finalRow?.isChampion) return null;
    return {
        event: 'FFWS Brasil 2026 Split 1',
        team: finalRow.equipe || teamName,
        type: 'Campeão',
        year: 2026,
        source: 'dados-final.json',
        logo: 'Free_Fire_World_Series_Brazil_icon_allmode.webp'
    };
}

function cffTeamProfileDedupeTitles(titles) {
    const out = [];
    const seen = new Set();
    (titles || []).forEach(t => {
        const key = `${String(t.event || t.tournament || '').toUpperCase()}|${String(t.type || t.award || '').toUpperCase()}|${String(t.year || '').toUpperCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push(t);
    });
    return out;
}

if (typeof window !== 'undefined') {
    window.cffSetTeamProfileStage = cffSetTeamProfileStage;
    window.cffSetTeamChartStage = cffSetTeamChartStage;
    window.cffTeamProfileGetStage = cffTeamProfileGetStage;
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
        photoEl.src = photoKey ? staffPhotos[photoKey] : 'silhueta.webp';
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
                <img src="instagram.webp" style="width: 20px;">
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

        // Cálculo de estatísticas por etapa: Classificatória / Geral / Final
        const tpStage = (typeof cffTeamProfileGetStage === 'function') ? cffTeamProfileGetStage() : 'geral';
        let allTeamsStats = (typeof cffTeamProfileAggregateTeamRows === 'function')
            ? cffTeamProfileAggregateTeamRows(tpStage, { selectedDays: selectedTpDays })
            : [];
        const stagePlayersDaily = (typeof cffTeamProfileGetPlayerDaily === 'function')
            ? cffTeamProfileGetPlayerDaily(tpStage)
            : (db.playerDaily || []);
        allTeamsStats = allTeamsStats.map(team => {
            const pDaily = stagePlayersDaily.filter(p => (typeof sameTeamName === 'function' ? sameTeamName(p.equipe, team.equipe) : String(p.equipe).toUpperCase() === String(team.equipe).toUpperCase()) && (!selectedTpDays.length || selectedTpDays.includes(String(p.dia))));
            return { ...team, pontos_pos: team.pontos - team.abates, dano: pDaily.reduce((sum, p) => sum + (Number(p.dano) || 0), 0), dias: team.quedas };
        });

        let cur = allTeamsStats.find(x => (typeof sameTeamName === 'function' ? sameTeamName(x.equipe, tName) : x.equipe === tName));

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
            const tpStageLabel = (typeof cffTeamProfileStageLabel === 'function') ? cffTeamProfileStageLabel(tpStage) : 'Geral';
            statsContainer.innerHTML = `
                <div style="grid-column:1/-1; color:var(--accent); font-size:.78rem; font-weight:950; letter-spacing:1px; text-transform:uppercase; text-align:center; margin-bottom:2px;">Dados da ${tpStageLabel}</div>
                <div style="display: grid; ${gridCSS} gap: 15px; margin-bottom: 15px;">
                    <div class="card"><div class="card-top-border"></div><h3>Média Pts</h3><div class="value">${(cur.pontos/(cur.quedas||1)).toFixed(1)}</div></div>
                    <div class="card"><div class="card-top-border"></div><h3>Média Kills</h3><div class="value">${(cur.abates/(cur.quedas||1)).toFixed(1)}</div></div>
                    <div class="card"><div class="card-top-border"></div><h3>Média Pos</h3><div class="value">${(cur.pontos_pos/(cur.quedas||1)).toFixed(1)}</div></div>
                    <div class="card"><div class="card-top-border"></div><h3>Média Dano</h3><div class="value">${(cur.dano/(cur.quedas||1)).toFixed(0)}</div></div>
                    <div class="card"><div class="card-top-border"></div><h3>Booyahs</h3><div class="value">${cur.booyah}</div></div>
                </div>`;
        }

// Jogadores Ativos (Top 5)
        let pRaw = stagePlayersDaily.filter(p => (typeof sameTeamName === 'function' ? sameTeamName(p.equipe, tName) : String(p.equipe).toUpperCase() === String(tName).toUpperCase()));
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
                        let photo = photoKey ? staffPhotos[photoKey] : 'silhueta.webp';
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

    const finalTitle = (typeof cffTeamProfileFinalTitleForTeam === 'function') ? cffTeamProfileFinalTitleForTeam(teamName) : null;
    const collectiveTitles = (typeof cffTeamProfileDedupeTitles === 'function')
        ? cffTeamProfileDedupeTitles([...(finalTitle ? [finalTitle] : []), ...staticCollective, ...novosCollective])
        : [...(finalTitle ? [finalTitle] : []), ...staticCollective, ...novosCollective];

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


function cffBuildLAFFTraditionalPlayerCard(player, team) {
    const name = String(player?.name || '').trim();
    const teamName = String(team?.name || player?.team || '').trim();
    if (typeof logos !== 'undefined' && teamName && team?.logo) logos[teamName] = team.logo;
    if (typeof playerRoles !== 'undefined' && name) playerRoles[name] = (typeof cffNormalizeRoleCardLabel === 'function' ? cffNormalizeRoleCardLabel(player?.funcao || player?.role || '') : cffNormalizeRoleLabel(player?.funcao || player?.role || '', true));
    const p = {
        jogador: name,
        equipe: teamName,
        abates: 0,
        assists: 0,
        dano: 0,
        quedas: 0,
        mvp: 0,
        ovrOverride: 0
    };
    if (typeof createPlayerCardHTML === 'function') return createPlayerCardHTML(p, 0.78);
    return `<button type="button" class="pp-teammate-card" onclick="openLAFFPlayerProfile('${String(name).replace(/'/g, "\\'")}')"><span class="pp-teammate-avatar"><img src="${cffEscapeHTML(player.photo || 'silhueta.webp')}" onerror="this.src='silhueta.webp'"></span><span class="pp-teammate-info"><strong>${cffEscapeHTML(name)}</strong><small>${cffEscapeHTML(cffNormalizeRoleLabel(player?.funcao || player?.role || '', false))}</small></span></button>`;
}

async function cffOpenLAFFTeamInTraditionalProfile(teamName) {
    if (typeof window.loadLAFFData === 'function') await window.loadLAFFData();
    const team = cffFindLAFFTeamInfo(teamName);
    if (!team) return false;

    currentTeamView = team.name;
    selectedTpDays = [];
    if (typeof logos !== 'undefined' && team.logo) logos[team.name] = team.logo;

    const nameEl = document.getElementById('tp-name');
    const groupEl = document.getElementById('tp-group');
    const posEl = document.getElementById('tp-pos');
    const logoEl = document.getElementById('tp-logo');
    if (nameEl) nameEl.innerText = team.name;
    if (groupEl) groupEl.innerText = `LAFF 2026 S1${team.grupo ? ' · Grupo ' + team.grupo : ''}`;
    if (posEl) posEl.innerText = 'LAFF';
    const finalSummary = document.getElementById('tp-final-summary');
    if (finalSummary) finalSummary.innerHTML = '';
    if (logoEl) { logoEl.src = team.logo || 'escudo.webp'; logoEl.style.display = 'block'; }

    const hideIds = ['tp-next-match-container','tp-best-worst-container','tp-confrontation-result','tp-evolution-container'];
    hideIds.forEach(id => { const el = document.getElementById(id); if (el) { el.innerHTML = ''; el.style.display = 'none'; } });
    const btnConf = document.getElementById('btn-confrontation');
    if (btnConf) btnConf.style.display = 'none';
    document.querySelectorAll('#team-profile .filters').forEach(f => { if (!f.id.includes('day-filters')) f.style.display = 'none'; });
    document.querySelectorAll('#team-profile h3').forEach(h => {
        const text = String(h.innerText || '').toUpperCase();
        if (text.includes('JOGADORES') || text.includes('STAFF')) { h.innerText = 'ELENCO ATUAL'; h.style.display = 'block'; }
        if (text.includes('DESEMPENHO') || text.includes('CLASSIFICAÇÃO INTERNA') || text.includes('EVOLUÇÃO')) h.style.display = 'none';
    });

    const roster = (team.players || []).filter(p => String(p?.name || '').trim());
    const cards = document.getElementById('tp-players-cards-container');
    if (cards) {
        cards.className = 'laff-traditional-roster-grid';
        cards.style.display = 'grid';
        cards.style.gridTemplateColumns = roster.length <= 5 ? `repeat(${Math.max(roster.length, 1)}, minmax(160px, 280px))` : 'repeat(auto-fit, minmax(210px, 280px))';
        cards.style.justifyContent = 'center';
        cards.style.gap = '22px';
        cards.style.maxWidth = 'none';
        cards.innerHTML = roster.length ? roster.map(p => cffBuildLAFFTraditionalPlayerCard(p, team)).join('') : '<div class="team-roster-update-empty">Elenco será exibido conforme os jogadores forem confirmados.</div>';
    }

    const stats = document.getElementById('tp-stats-container');
    if (stats) {
        stats.style.display = 'grid';
        stats.innerHTML = `<div class="grid-cards laff-team-info-grid">
            <div class="card"><h3>Jogadores</h3><div class="value">${roster.length}</div></div>
            <div class="card"><h3>Grupo</h3><div class="value">${cffEscapeHTML(team.grupo || 'Em breve')}</div></div>
            <div class="card"><h3>Origem</h3><div class="value">${cffEscapeHTML(team.origem || 'LAFF')}</div></div>
        </div>`;
    }

    const tableWrap = document.querySelector('#table-team-players')?.parentElement;
    if (tableWrap) tableWrap.style.display = 'block';
    const tbody = document.querySelector('#table-team-players tbody');
    if (tbody) {
        tbody.innerHTML = roster.map(p => `<tr><td style="text-align:left;"><span class="clickable" onclick="openLAFFPlayerProfile('${String(p.name || '').replace(/'/g, "\\'")}')">${cffEscapeHTML(p.name)}</span></td><td style="color:var(--accent); font-weight:bold;">0</td><td data-sort-value="0">0</td><td>0</td><td>0</td><td>0</td></tr>`).join('');
    }

    if (typeof renderTeamHistorySummary === 'function') renderTeamHistorySummary(team.name);
    const summary = document.getElementById('tp-history-summary-box');
    if (summary) {
        summary.innerHTML = `<div class="cff-summary-kicker">Resumo da organização</div>
            <p><strong>${cffEscapeHTML(team.name)}</strong> está confirmada na <strong>LAFF 2026 S1</strong>${team.grupo ? ` pelo Grupo ${cffEscapeHTML(team.grupo)}` : ''}. O desempenho competitivo será atualizado quando o torneio começar.</p>
            <div class="cff-summary-mini-grid"><span><strong>${roster.length}</strong><small>jogadores</small></span><span><strong>${cffEscapeHTML(team.grupo || '-')}</strong><small>grupo</small></span><span><strong>LAFF</strong><small>competição</small></span><span><strong>Sem informação</strong><small>desempenho histórico</small></span></div>`;
    }

    if (typeof renderTeamPlayersHistory === 'function') renderTeamPlayersHistory(team.name);
    if (typeof renderTeamTrophies === 'function') renderTeamTrophies(team.name);
    const trophies = document.getElementById('tp-trophies-container');
    if (trophies && /Nenhum título/i.test(trophies.textContent || '')) trophies.innerHTML = '<div class="laff-trophy-empty">EM BREVE</div>';

    if (typeof cffSetTeamHash === 'function') cffSetTeamHash(team.name);
    navigate('team-profile');
    return true;
}
window.cffOpenLAFFTeamInTraditionalProfile = cffOpenLAFFTeamInTraditionalProfile;

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
    const onclick = `cffOpenTeamProfileSmart('${name.replace(/'/g, "\\'")}')`;
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
            histQ += Number(data.q || data.quedas || data.matches || 0);
        });
        const activeName = typeof getCanonicalPlayerName === 'function' ? getCanonicalPlayerName(name) : ((typeof historicalAliases !== 'undefined' && historicalAliases[name]) || name);
        if (histK > 0 || histQ > 0) {
            const key = cffPlayerLooseKey(activeName || name);
            seen.add(key);
            rows.push({ originalName: name, activeName, totalKills: histK, totalQuedas: histQ });
        }
    });

    // Fallback: só usa db.players quando o histórico ainda não carregou ou quando é jogador realmente novo.
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
            role: cffNormalizeRoleCardLabel((typeof playerRoles !== 'undefined' && playerRoles[p.jogador]) ? playerRoles[p.jogador] : ''),
            photo: cffResolvePlayerHistoryPhoto(p.jogador),
            isCurrentPlayer: cffPlayerNameMatches(p.jogador, currentPlayerName),
            onclick: _safePPAttr(p.jogador)
        }));

    const seenPlayers = new Set(players.map(p => cffPlayerLooseKey(p.name)));
    const laffTeam = cffFindLAFFTeamInfo(teamName) || cffFindLAFFTeamInfo(canonical);
    const laffTeamName = laffTeam?.name || canonical;
    const laffPlayers = (typeof window.getLAFFPlayers === 'function' ? (window.getLAFFPlayers() || []) : [])
        .filter(p => cffTeamMatchesLAFFName(p.team, laffTeamName) || cffTeamMatchesLAFFName(p.team, canonical))
        .filter(p => {
            const k = cffPlayerLooseKey(p.name);
            if (seenPlayers.has(k)) return false;
            seenPlayers.add(k);
            return true;
        })
        .map(p => ({
            type: 'player',
            name: p.name,
            displayName: typeof getDisplayName === 'function' ? getDisplayName(p.name) : p.name,
            role: cffNormalizeRoleCardLabel(p.funcao || p.role || ''),
            photo: p.photo || cffResolvePlayerHistoryPhoto(p.name),
            isCurrentPlayer: cffPlayerNameMatches(p.name, currentPlayerName),
            onclick: _safePPAttr(p.name)
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
                photo: photoKey ? staffPhotos[photoKey] : 'silhueta.webp',
                isCurrentPlayer: false,
                onclick: `openStaffProfile('${String(s.nome || '').replace(/'/g, "\\'")}')`
            };
        });

    const allPlayers = [...players, ...laffPlayers];
    return { players: allPlayers, staff, all: [...allPlayers, ...staff] };
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
    const items = people.all.filter(item => !item.isCurrentPlayer);
    const displayPlayerCount = people.players.filter(item => !item.isCurrentPlayer).length;
    const displayStaffCount = people.staff.length;
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
            <div class="pp-teammates-count"><strong>${displayPlayerCount}</strong> jogadores · <strong>${displayStaffCount}</strong> comissão</div>
        </div>
        <div class="pp-teammates-grid" style="--pp-teammate-count:${items.length};">
            ${items.map(item => `
                <button type="button" class="pp-teammate-card${item.isCurrentPlayer ? ' is-current-player' : ''}" onclick="${item.onclick}" title="Abrir perfil de ${cffEscapeHTML(item.displayName)}">
                    <span class="pp-teammate-avatar"><img src="${cffEscapeHTML(item.photo)}" alt="${cffEscapeHTML(item.displayName)}" onerror="this.src='silhueta.webp'"></span>
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
    const mergedSummaryEditions = cffMergeLAFFPlayerHistoryIntoEditions(playerName, cffMergeCurrentEditionIntoEditions(playerName, lbff ? (lbff.editions || {}) : {}, activePlayer || context.currentPlayer || null));
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

    const laffTotals = cffGetLAFFPlayerHistoryTotals(playerName);
    const historyScope = laffTotals.kills ? 'LBFF/WB/LAFF' : 'LBFF/WB';
    sentences.push(`${nameStrong} soma <strong>${totalKills} abates</strong> em <strong>${totalMatches} quedas</strong> na história da ${historyScope}.`);
    if (laffTotals.kills) {
        const laffAvg = laffTotals.matches ? (laffTotals.kills / laffTotals.matches).toFixed(2) : '0.00';
        sentences.push(`Na LAFF, tem <strong>${laffTotals.kills} abates</strong> em <strong>${laffTotals.matches} quedas</strong>, média de <strong>${laffAvg} K/Q</strong>${laffTotals.teams.length ? ` por ${laffTotals.teams.map(cffBuildTeamLink).join(', ')}` : ''}.`);
    }

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

    return 'silhueta.webp';
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
            isActiveElsewhere: !!exit.equipeDestino,
            activeTeam: exit.equipeDestino || '',
            activeTeamLogo: exit.equipeDestino ? cffResolveTeamLogoSafe(exit.equipeDestino) : '',
            abates: kills,
            quedas,
            media: quedas ? kills / quedas : 0
        });
    });

    const laffTeam = cffFindLAFFTeamInfo(teamName) || cffFindLAFFTeamInfo(canonical);
    const laffRoster = (typeof window.getLAFFPlayers === 'function' ? (window.getLAFFPlayers() || []) : [])
        .filter(p => cffTeamMatchesLAFFName(p.team, laffTeam?.name || canonical) || cffTeamMatchesLAFFName(p.team, canonical));
    laffRoster.forEach(p => {
        const key = cffPlayerLooseKey(p.name);
        if (!key || byName.has(key)) return;
        byName.set(key, {
            jogador: p.name,
            displayName: typeof getDisplayName === 'function' ? getDisplayName(p.name) : p.name,
            isCurrent: true,
            isActiveElsewhere: false,
            activeTeam: laffTeam?.name || p.team,
            activeTeamLogo: laffTeam?.logo || cffResolveTeamLogoSafe(p.team),
            abates: 0,
            quedas: 0,
            media: 0
        });
    });

    return [...byName.values()].sort((a, b) => {
        if (b.isCurrent !== a.isCurrent) return Number(b.isCurrent) - Number(a.isCurrent);
        if (b.isActiveElsewhere !== a.isActiveElsewhere) return Number(b.isActiveElsewhere) - Number(a.isActiveElsewhere);
        if (b.abates !== a.abates) return b.abates - a.abates;
        return String(a.displayName).localeCompare(String(b.displayName), 'pt-BR');
    });
}


function cffTeamHistoryYield() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function cffTeamHistorySheetUrl() {
    try { return window.CFF_CONFIG && window.CFF_CONFIG.sheets && window.CFF_CONFIG.sheets.passagens; }
    catch (e) { return ''; }
}

function cffTeamHistoryVersionedUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const version = (typeof CFF_BUILD_VERSION !== 'undefined' ? CFF_BUILD_VERSION : 'team-history-v19');
    const separator = raw.includes('?') ? '&' : '?';
    return `${raw}${separator}v=${encodeURIComponent(version)}`;
}

let __cffTeamHistoryPassagensPromise = null;
async function cffLoadPassagensChunkedForTeamHistory() {
    if (Array.isArray(dbPassagens) && dbPassagens.length > 0) return dbPassagens;
    if (__cffTeamHistoryPassagensPromise) return __cffTeamHistoryPassagensPromise;

    __cffTeamHistoryPassagensPromise = (async () => {
        const url = cffTeamHistorySheetUrl();
        if (!url) return [];
        try {
            const res = await fetch(cffTeamHistoryVersionedUrl(url), { cache: 'force-cache' });
            const text = await res.text();
            const lines = text.split('\n');
            const tempMap = {};
            const batchSize = 250;

            for (let i = 1; i < lines.length; i += batchSize) {
                const end = Math.min(lines.length, i + batchSize);
                for (let j = i; j < end; j++) {
                    const line = lines[j];
                    if (!line) continue;
                    const data = line.split('\t');
                    const jogadorOriginal = data[0]?.trim().replace(/\r/g, '');
                    const equipeOriginal = data[1]?.trim().replace(/\r/g, '');
                    const cargo = data[2]?.trim().replace(/\r/g, '');
                    if (!jogadorOriginal || !equipeOriginal) continue;

                    const jogador = (typeof getCanonicalPlayerName === 'function') ? getCanonicalPlayerName(jogadorOriginal) : jogadorOriginal;
                    const key = (typeof normalizePlayerAliasKey === 'function') ? normalizePlayerAliasKey(jogador) : String(jogador).toLowerCase();
                    const equipe = (typeof getCanonicalTeamNameSafe === 'function') ? getCanonicalTeamNameSafe(equipeOriginal) : equipeOriginal;

                    if (!tempMap[key]) tempMap[key] = { jogador, aliases: new Set(), passagens: [] };
                    tempMap[key].aliases.add(jogadorOriginal);
                    tempMap[key].aliases.add(jogador);

                    const last = tempMap[key].passagens[tempMap[key].passagens.length - 1];
                    const same = typeof sameTeamName === 'function'
                        ? (last && sameTeamName(last.equipe, equipe))
                        : (last && String(last.equipe || '').toUpperCase() === String(equipe || '').toUpperCase());
                    if (!last || !same || String(last.cargo || '').toUpperCase() !== String(cargo || '').toUpperCase()) {
                        tempMap[key].passagens.push({ equipe, cargo });
                    }
                }
                await cffTeamHistoryYield();
            }

            dbPassagens = Object.values(tempMap).map(item => ({
                jogador: item.jogador,
                aliases: Array.from(item.aliases),
                passagens: item.passagens
            }));
            window.dbPassagens = dbPassagens;
            if (typeof buildPlayerAliasesFromPassagens === 'function') {
                try { buildPlayerAliasesFromPassagens(); } catch(e) {}
            }
            return dbPassagens;
        } catch (e) {
            console.warn('[team-history] histórico de jogadores não carregou:', e);
            return [];
        } finally {
            __cffTeamHistoryPassagensPromise = null;
        }
    })();

    return __cffTeamHistoryPassagensPromise;
}

async function cffRenderTeamHistoryIdle(teamName, options) {
    if (typeof requestIdleCallback === 'function') {
        await new Promise(resolve => requestIdleCallback(resolve, { timeout: 700 }));
    } else {
        await new Promise(resolve => setTimeout(resolve, 60));
    }
    return renderTeamPlayersHistory(teamName, options);
}

async function renderTeamPlayersHistory(teamName, options = {}) {
    const mount = document.getElementById('tp-player-history-mount');
    const trophies = document.getElementById('tp-trophies-container');
    const anchor = mount || trophies || document.getElementById('tp-players-cards-container');
    if (!anchor) return;

    const requestedTeam = String(teamName || '').trim();
    const expanded = !!options.expanded;
    const renderToken = `${requestedTeam}::${expanded ? 'expanded' : 'compact'}::${Date.now()}::${Math.random().toString(36).slice(2)}`;
    window.__cffTeamHistoryRenderToken = renderToken;
    const isStillCurrentTeam = () => {
        if (window.__cffTeamHistoryRenderToken !== renderToken) return false;
        const current = String(currentTeamView || '').trim();
        if (!current) return true;
        return typeof sameTeamName === 'function'
            ? sameTeamName(current, requestedTeam)
            : current.toUpperCase() === requestedTeam.toUpperCase();
    };

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

    const shouldLoadCompact = expanded || !!options.compact || !!options.forceLoad;

    if (!shouldLoadCompact) {
        section.innerHTML = `
            <div class="team-history-head team-history-head-simple">
                <h3>História</h3>
            </div>
            <div class="team-history-subsection team-player-history-compact-wrap team-player-history-lazy-shell">
                <div class="team-history-subtitle-row team-player-history-compact-title">
                    <h4>Histórico de jogadores</h4>
                </div>
                <div class="team-player-history-actions">
                    <button type="button" class="btn-action team-player-history-load-btn" data-team="${cffEscapeHTML(requestedTeam)}" onclick="window.cffLoadCompactTeamPlayersHistory && window.cffLoadCompactTeamPlayersHistory(this.dataset.team)">Ver histórico de jogadores</button>
                </div>
            </div>`;
        return;
    }

    section.innerHTML = `
        <div class="team-history-head team-history-head-simple">
            <h3>História</h3>
        </div>
        <div class="team-player-history-loading-inline">Preparando histórico...</div>`;

    if (!Array.isArray(dbPassagens) || dbPassagens.length === 0) {
        await cffLoadPassagensChunkedForTeamHistory();
    }
    if (!isStillCurrentTeam()) return;

    const canonical = typeof getTeamCanonicalName === 'function' ? getTeamCanonicalName(requestedTeam) : requestedTeam;
    const players = cffGetPlayersFromTeamPassagens(canonical);

    if (!players.length) {
        section.innerHTML = `
            <div class="team-history-head team-history-head-simple">
                <h3>História</h3>
            </div>
            <div class="team-player-history-empty">Sem informação.</div>`;
        return;
    }

    const currentCount = players.filter(p => p.isCurrent).length;
    const exCount = players.length - currentCount;
    const topPlayers = players.slice(0, 64);
    const compactPlayers = players.slice(0, 18);
    const notablePlayers = [...players].sort((a, b) => {
        if (b.abates !== a.abates) return b.abates - a.abates;
        if (b.media !== a.media) return b.media - a.media;
        return String(a.displayName).localeCompare(String(b.displayName), 'pt-BR');
    }).slice(0, 5);

    if (!expanded) {
        const compactHtml = compactPlayers.map(p => {
            const stateClass = p.isCurrent ? ' is-current' : (p.isActiveElsewhere ? ' is-active-elsewhere' : ' is-inactive');
            const status = p.isCurrent ? 'ATUAL' : 'EX';
            const meta = Number(p.abates || 0) > 0 ? `${Number(p.abates || 0)} K` : (p.activeTeam ? cffEscapeHTML(p.activeTeam) : '');
            return `
                <button type="button" class="team-player-history-compact-card${stateClass}" onclick="${_safePPAttr(p.jogador)}" title="Abrir perfil de ${cffEscapeHTML(p.displayName)}">
                    <span class="team-player-history-compact-name">${cffEscapeHTML(p.displayName)}</span>
                    <span class="team-player-history-compact-meta"><b>${status}</b>${meta ? ` · ${meta}` : ''}</span>
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

            <div class="team-history-subsection team-player-history-compact-wrap">
                <div class="team-history-subtitle-row team-player-history-compact-title">
                    <h4>Histórico de jogadores</h4>
                </div>
                <div class="team-player-history-compact-grid">
                    ${compactHtml}
                </div>
                <div class="team-player-history-actions">
                    ${players.length > compactPlayers.length ? `<span class="team-player-history-more">Mostrando ${compactPlayers.length} de ${players.length} jogadores.</span>` : ''}
                    <button type="button" class="btn-action team-player-history-expand-btn" data-team="${cffEscapeHTML(requestedTeam)}" onclick="window.cffExpandTeamPlayersHistory && window.cffExpandTeamPlayersHistory(this.dataset.team)">Expandir histórico com fotos</button>
                </div>
            </div>`;
        return;
    }

    // Só carrega a planilha de fotos quando o usuário expande o histórico.
    if (typeof loadPhotos === 'function' && !window.__cffTeamHistoryPhotosLoaded) {
        section.innerHTML = `
            <div class="team-history-head team-history-head-simple">
                <h3>História</h3>
                <div class="team-player-history-stats">
                    <span><strong>${players.length}</strong><small>jogadores</small></span>
                    <span><strong>${currentCount}</strong><small>atuais</small></span>
                    <span><strong>${exCount}</strong><small>ex-jogadores</small></span>
                </div>
            </div>
            <div class="team-player-history-loading-inline">Carregando fotos do histórico...</div>`;
        try {
            window.__cffTeamHistoryPhotosLoaded = true;
            await loadPhotos();
        } catch (e) {
            console.warn('[renderTeamPlayersHistory] fotos não carregaram:', e);
        }
        if (!isStillCurrentTeam()) return;
    }

    const playerCardsHtml = topPlayers.map(p => {
        const photo = cffResolvePlayerHistoryPhoto(p.jogador || p.displayName);
        const stateClass = p.isCurrent ? ' is-current' : (p.isActiveElsewhere ? ' is-active-elsewhere' : ' is-inactive');
        const status = p.isCurrent ? 'ATUAL' : 'EX-JOGADOR';
        const logoHtml = p.activeTeamLogo ? `
            <span class="team-player-current-team-logo" title="Atualmente em ${cffEscapeHTML(p.activeTeam)}">
                <img src="${cffEscapeHTML(p.activeTeamLogo)}" alt="${cffEscapeHTML(p.activeTeam)}" loading="lazy" decoding="async" fetchpriority="low" onerror="this.style.display='none'">
            </span>` : '';
        return `
            <button type="button" class="team-player-history-card team-player-history-photo-card${stateClass}" onclick="${_safePPAttr(p.jogador)}" title="Abrir perfil de ${cffEscapeHTML(p.displayName)}">
                <span class="team-player-history-avatar">
                    ${logoHtml}
                    <img src="${cffEscapeHTML(photo)}" alt="${cffEscapeHTML(p.displayName)}" loading="lazy" decoding="async" fetchpriority="low" onerror="this.src='silhueta.webp'">
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
                <span class="team-notable-avatar"><img src="${cffEscapeHTML(photo)}" alt="${cffEscapeHTML(p.displayName)}" loading="lazy" decoding="async" fetchpriority="low" onerror="this.src='silhueta.webp'"></span>
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
                <button type="button" class="btn-action team-player-history-collapse-btn" data-team="${cffEscapeHTML(requestedTeam)}" onclick="window.cffCollapseTeamPlayersHistory && window.cffCollapseTeamPlayersHistory(this.dataset.team)">Voltar ao compacto</button>
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

function cffLoadCompactTeamPlayersHistory(teamName) {
    return cffRenderTeamHistoryIdle(teamName || currentTeamView, { compact: true });
}
window.cffLoadCompactTeamPlayersHistory = cffLoadCompactTeamPlayersHistory;

function cffExpandTeamPlayersHistory(teamName) {
    return cffRenderTeamHistoryIdle(teamName || currentTeamView, { expanded: true, compact: true });
}
window.cffExpandTeamPlayersHistory = cffExpandTeamPlayersHistory;

function cffCollapseTeamPlayersHistory(teamName) {
    return cffRenderTeamHistoryIdle(teamName || currentTeamView, { compact: true });
}
window.cffCollapseTeamPlayersHistory = cffCollapseTeamPlayersHistory;

function cffGetTeamTitles(teamName) {
    const aliasSet = typeof getTeamAliasSet === 'function' ? getTeamAliasSet(teamName) : new Set([String(teamName).toUpperCase()]);
    const oldCol = (typeof titlesData !== 'undefined' ? titlesData.coletivos || [] : []).filter(t => aliasSet.has(normalizeTeamAlias(t.team)));
    const oldInd = (typeof titlesData !== 'undefined' ? titlesData.individuais || [] : []).filter(t => aliasSet.has(normalizeTeamAlias(t.team)));
    const newCol = typeof getNovosTorneiosCollectiveTitlesForTeam === 'function' ? getNovosTorneiosCollectiveTitlesForTeam(teamName) : [];
    const newInd = typeof getNovosTorneiosIndividualAwardsForTeam === 'function' ? getNovosTorneiosIndividualAwardsForTeam(teamName) : [];
    const finalTitle = (typeof cffTeamProfileFinalTitleForTeam === 'function') ? cffTeamProfileFinalTitleForTeam(teamName) : null;
    const collective = (typeof cffTeamProfileDedupeTitles === 'function')
        ? cffTeamProfileDedupeTitles([...(finalTitle ? [finalTitle] : []), ...oldCol, ...newCol])
        : [...(finalTitle ? [finalTitle] : []), ...oldCol, ...newCol];
    return { collective, individual: [...oldInd, ...newInd] };
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
