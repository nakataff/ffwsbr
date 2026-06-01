// NOVA NAVEGAÇÃO — FUNÇÕES DE CONTROLE

function openSidebar() {
    document.getElementById('sidebar-panel').classList.add('active');
    document.getElementById('sidebar-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    document.getElementById('sidebar-panel').classList.remove('active');
    document.getElementById('sidebar-overlay').classList.remove('active');
    document.body.style.overflow = '';
}

// Controle de renderização — evita re-renderizar seções já prontas a cada clique no menu.
// Para forçar um re-render (ex: após atualizar dados), use: delete window._cff_rendered['nome-da-secao']
window._cff_rendered = window._cff_rendered || {};

function _cffRenderOnce(pageId, renderFn) {
    if (window._cff_rendered[pageId]) return;
    renderFn();
    window._cff_rendered[pageId] = true;
}

function navigateAndClose(pageId) {
    navigate(pageId);
    closeSidebar();

    if (pageId === 'tabela') {
        _cffRenderOnce('tabela', () => { renderFullTeams(); renderGroupsTables(); });
    }
    else if (pageId === 'mvp') {
        _cffRenderOnce('mvp', () => renderAllPlayers());
    }
    else if (pageId === 'notas-cff') {
        _cffRenderOnce('notas-cff', () => renderNotasCFFPage());
    }
    else if (pageId === 'equipes') {
        _cffRenderOnce('equipes', () => renderTeamsDirectory());
    }
    else if (pageId === 'datas') {
        _cffRenderOnce('datas', () => renderSchedule());
    }
    else if (pageId === 'laff-classificatoria') {
        if (typeof loadLAFFData === 'function') loadLAFFData();
    }
    else if (pageId === 'laff-mvp' || pageId === 'laff-equipes' || pageId === 'laff-stats' || pageId === 'laff-datas' || pageId === 'laff-selecoes') {
        if (typeof loadLAFFData === 'function') loadLAFFData();
    }
    else if (pageId === 'laff-2026-s1' && typeof loadLAFFData === 'function') {
        loadLAFFData();
    }
    else if (pageId === 'outros-torneios') {
        _cffRenderOnce('outros-torneios', () => renderOutrosTorneiosList());
    }
    else if (pageId === 'outras-equipes') {
        _cffRenderOnce('outras-equipes', () => renderOutrasEquipesGrid());
    }
    else if (pageId === 'ffws-sea-2026-s1') {
        _cffRenderOnce('ffws-sea-2026-s1', () => loadSEAData());
    }
    else if (pageId === 'ffws-latam-s1') { /* Página preparada: em breve */ }
    else if (pageId === 'hall-da-fama') {
        _cffRenderOnce('hall-da-fama', () => renderHistoricalRanking());
    }
    else if (pageId === 'recordes') {
        _cffRenderOnce('recordes', () => renderIndividualRecords());
    }
    else if (pageId === 'stats') {
        _cffRenderOnce('stats', () => {
            renderTop5Stats();
            renderTableAvg();
            renderTableTotal();
            renderCFFStats();
            renderPlayerStats();
            if (typeof buildMultiTeamFilters === 'function') buildMultiTeamFilters();
            if (typeof renderMultiTeamChart === 'function') renderMultiTeamChart();
        });
    }
    else if (pageId === 'comparar-1v1') {
        _cffRenderOnce('comparar-1v1', () => { renderCompareTeams(); renderComparePlayers(); });
    }
    else if (pageId === 'selecao-da-semana') {
        _cffRenderOnce('selecao-da-semana', () => renderSelection());
    }
    else if (pageId === 'final' && typeof renderFinalPossibilities === 'function') {
        // Final sempre re-renderiza pois o estado pode mudar durante o torneio
        renderFinalPossibilities();
    }
    else if (pageId === 'home') {
        _cffRenderOnce('home', () => { renderHomeStats(); renderHomeGroups(); });
    }
}

function mobileTabClick(pageId, btnEl) {
    navigate(pageId);

    if (pageId === 'tabela') {
        _cffRenderOnce('tabela', () => { renderFullTeams(); renderGroupsTables(); });
    }
    else if (pageId === 'mvp') {
        _cffRenderOnce('mvp', () => renderAllPlayers());
    }
    else if (pageId === 'notas-cff') {
        _cffRenderOnce('notas-cff', () => renderNotasCFFPage());
    }
    else if (pageId === 'equipes') {
        _cffRenderOnce('equipes', () => renderTeamsDirectory());
    }
    else if (pageId === 'datas') {
        _cffRenderOnce('datas', () => renderSchedule());
    }
    else if (pageId === 'stats') {
        _cffRenderOnce('stats', () => {
            renderTop5Stats();
            renderTableAvg();
            renderTableTotal();
            renderCFFStats();
            renderPlayerStats();
            if (typeof buildMultiTeamFilters === 'function') buildMultiTeamFilters();
            if (typeof renderMultiTeamChart === 'function') renderMultiTeamChart();
        });
    }
    else if (pageId === 'laff-2026-s1' && typeof loadLAFFData === 'function') {
        loadLAFFData();
    }
}

function toggleDesktopSearch() {
    const wrapper = document.getElementById('nav-search-wrapper-desktop');
    const input = document.getElementById('global-search-desktop');
    const isOpen = wrapper.classList.toggle('open');
    if (isOpen) {
        setTimeout(() => input.focus(), 300); // aguarda a animação de abertura
    } else {
        input.value = '';
        document.getElementById('search-results-desktop').style.display = 'none';
    }
}

function toggleMobileSearch() {
    const bar = document.getElementById('mobile-search-bar');
    if (bar) {
        bar.classList.toggle('active');
        if (bar.classList.contains('active')) {
            const input = document.getElementById('global-search-mobile');
            if (input) setTimeout(() => input.focus(), 100);
        }
    }
}

function renderCFFStats() {
    const container = document.getElementById('cff-records-grid');
    if (!container) return;

    let allMatchPerformances = [];
    let playerDailyAggregator = {};
    let playerCareerAggregator = {};

    // 1. Processar dados de todas as quedas de todos os jogadores
    for (let d in dbJogadoresQuedas) {
        for (let q in dbJogadoresQuedas[d]) {
            // Trava de segurança: evita erros se a queda não tiver dados no dbQuedas
            let dropInfo = (dbQuedas[d] && dbQuedas[d][q]) ? dbQuedas[d][q] : { mapa: 'Desconhecido', resultados: [] };

            dbJogadoresQuedas[d][q].forEach(p => {
                let posTime = 12; // Valor padrão
                if (dropInfo.resultados) {
                    let teamRes = dropInfo.resultados.find(r => r.equipe.toUpperCase() === p.equipe.toUpperCase());
                    if (teamRes) posTime = teamRes.posicao;
                }

                // Calcula a nota individual da queda
                let notaMatch = calculateCFFNota(p.kills, p.dano, p.assists, p.mvp, posTime);

                allMatchPerformances.push({
                    nome: p.nome, equipe: p.equipe, nota: notaMatch, kills: p.kills, dia: d, queda: q
                });

                // Agregador para notas diárias (com bônus de lenda)
                let dayKey = `${p.nome}-${d}`;
                if (!playerDailyAggregator[dayKey]) {
                    playerDailyAggregator[dayKey] = { nome: p.nome, equipe: p.equipe, dia: d, quedas: [] };
                }
                playerDailyAggregator[dayKey].quedas.push({ nota: notaMatch, kills: p.kills, dano: p.dano, mvp: p.mvp });

                // Agregador para a Média Geral (mínimo de quedas)
                if (!playerCareerAggregator[p.nome]) {
                    playerCareerAggregator[p.nome] = { nome: p.nome, equipe: p.equipe, somaNotas: 0, totalQuedas: 0 };
                }
                playerCareerAggregator[p.nome].somaNotas += notaMatch;
                playerCareerAggregator[p.nome].totalQuedas++;
            });
        }
    }

    // A. Maiores Notas Individuais (Top 5 Quedas)
    let topSingleMatches = allMatchPerformances.sort((a,b) => b.nota - a.nota).slice(0, 5);

    // B. Maiores Notas de um Dia — fórmula baseada na distribuição real dos dados
    // Percentis reais (577 dias jogados): mediana=7k, top10%=15k, top1%=22k, máximo=31k (MT7)
    // Nota 10.0 só para 27+ kills (apenas MT7 Dia10/Dia7 e Yago Dia9 atingiram)
    let dailyRatings = Object.values(playerDailyAggregator).map(day => {
        let totalKills = day.quedas.reduce((s, q) => s + q.kills, 0);
        let totalDano  = day.quedas.reduce((s, q) => s + q.dano,  0);
        let totalMvps  = day.quedas.filter(q => q.mvp).length;

        // Nota base por kills — curva ajustada aos percentis reais
        let notaDia;
        if      (totalKills <= 3)  notaDia = 4.0;
        else if (totalKills <= 5)  notaDia = 5.0  + (totalKills - 4)  * 0.40; // 5.0–5.4
        else if (totalKills <= 8)  notaDia = 5.5  + (totalKills - 6)  * 0.25; // 5.5–6.25 (mediana)
        else if (totalKills <= 12) notaDia = 6.5  + (totalKills - 9)  * 0.25; // 6.5–7.25 (top 25%)
        else if (totalKills <= 15) notaDia = 7.5  + (totalKills - 13) * 0.20; // 7.5–8.1  (top 10%)
        else if (totalKills <= 18) notaDia = 8.0  + (totalKills - 16) * 0.20; // 8.0–8.6  (top 5%)
        else if (totalKills <= 21) notaDia = 8.5  + (totalKills - 19) * 0.20; // 8.5–9.1  (top 2%)
        else if (totalKills <= 24) notaDia = 9.0  + (totalKills - 22) * 0.15; // 9.0–9.45 (top 1%)
        else if (totalKills <= 27) notaDia = 9.4  + (totalKills - 25) * 0.15; // 9.4–9.7  (elite)
        else if (totalKills <= 30) notaDia = 9.7  + (totalKills - 28) * 0.10; // 9.7–9.9  (lendário)
        else                       notaDia = 10.0;                             // 31+ (apenas MT7 Dia10)

        // Bônus de dano alto (complementar, pequeno)
        if      (totalDano >= 20000) notaDia += 0.2;
        else if (totalDano >= 15000) notaDia += 0.1;

        // Bônus MVP
        notaDia += totalMvps * 0.1;

        return {
            nome:      day.nome,
            equipe:    day.equipe,
            dia:       day.dia,
            notaFinal: Math.min(notaDia, 10.0)
        };
    }).sort((a,b) => b.notaFinal - a.notaFinal).slice(0, 5);

    // C. Melhores Médias Gerais (Top 5 Médias - mínimo de 30% das quedas do campeonato)
    const totalQuedasCampeonato = Object.values(dbJogadoresQuedas || {}).reduce((total, rounds) => {
        return total + Object.keys(rounds || {}).length;
    }, 0);
    const minQuedasMediaGeral = Math.max(1, Math.ceil(totalQuedasCampeonato * 0.30));
    let topAverages = Object.values(playerCareerAggregator)
        .filter(p => p.totalQuedas >= minQuedasMediaGeral)
        .map(p => ({ nome: p.nome, equipe: p.equipe, media: p.somaNotas / p.totalQuedas }))
        .sort((a,b) => b.media - a.media).slice(0, 5);

    // Função interna para gerar as linhas visuais
    const getRowHtml = (p, valor, infoExtra, onClickType) => {
        let notaVal = parseFloat(valor).toFixed(1);
        let badgeClass = getCFFBadgeColor(notaVal);
        let clickAction = onClickType === 'team' ? `openTeamProfile('${p.equipe}')` : `openPlayerProfile('${p.nome}')`;

        return `
        <div style="display: grid; grid-template-columns: 1fr auto; align-items: center; margin-bottom: 8px; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 4px; border-left: 3px solid var(--border); font-size: 0.85em;">
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <span class="clickable" onclick="${clickAction}" style="color:#fff; font-weight:bold;">${p.nome}</span>
                <div style="font-size:0.75em; color:#888;">${p.equipe} • ${infoExtra}</div>
            </div>
            <span class="cff-badge ${badgeClass}" style="min-width: 35px; font-size: 0.85em;">${notaVal}</span>
        </div>`;
    };

    container.innerHTML = `
        <div class="card"><div class="card-top-border"></div><h3>Top Quedas</h3>
            <div style="margin-bottom:10px; font-size:0.7em; color:#555; text-transform:uppercase; letter-spacing:1px; padding:0 10px;">Jogador / Localização</div>
            ${topSingleMatches.map(p => getRowHtml(p, p.nota, `Dia ${p.dia} Q${p.queda} (${p.kills} Kills)`, 'player')).join('')}
        </div>
        <div class="card"><div class="card-top-border"></div><h3>Top Dias</h3>
            <div style="margin-bottom:10px; font-size:0.7em; color:#555; text-transform:uppercase; letter-spacing:1px; padding:0 10px;">Jogador / Data</div>
            ${dailyRatings.map(p => getRowHtml(p, p.notaFinal, `Desempenho no Dia ${p.dia}`, 'player')).join('')}
        </div>
        <div class="card"><div class="card-top-border"></div><h3>Médias Gerais</h3>
            <div style="margin-bottom:10px; font-size:0.7em; color:#555; text-transform:uppercase; letter-spacing:1px; padding:0 10px;">Mínimo ${minQuedasMediaGeral} quedas (30%)</div>
            ${topAverages.map(p => getRowHtml(p, p.media, `Média em todo o campeonato`, 'player')).join('')}
        </div>
    `;
}

// Listener de busca configurado UMA VEZ — event delegation no container pai.
// Assim funciona mesmo depois de innerHTML recriar os itens.
function initSearchListeners() {
    ['search-results-desktop', 'search-results-mobile'].forEach(id => {
        const box = document.getElementById(id);
        if (!box) return;
        box.addEventListener('click', (e) => {
            const item = e.target.closest('.search-item[data-name]');
            if (!item) return;
            e.stopPropagation();
            selectSearchResult(item.dataset.type, item.dataset.name);
        });
    });
}

// Busca unificada (desktop e mobile compartilham o pool, só o container muda)
function getSearchCanonicalName(name) {
    if (typeof getCanonicalPlayerName === 'function') {
        return getCanonicalPlayerName(name);
    }
    return String(name || '').trim();
}

function getSearchAliasHaystack(name) {
    const canonical = getSearchCanonicalName(name);
    const values = new Set([String(name || ''), canonical]);

    if (typeof getPlayerAliasList === 'function') {
        getPlayerAliasList(canonical).forEach(alias => values.add(alias));
        getPlayerAliasList(name).forEach(alias => values.add(alias));
    }

    return Array.from(values)
        .map(v => getDisplayName(v).toLowerCase())
        .join(' ');
}

function getSearchPlayerPhoto(name, fallbackName = '') {
    const candidates = [];
    const canonical = getSearchCanonicalName(name);

    candidates.push(name, canonical, fallbackName);

    if (typeof getPlayerAliasList === 'function') {
        getPlayerAliasList(canonical).forEach(alias => candidates.push(alias));
        getPlayerAliasList(name).forEach(alias => candidates.push(alias));
    }

    for (const candidate of candidates) {
        if (candidate && playerPhotos[candidate]) return playerPhotos[candidate];
    }

    return 'silhueta.webp';
}


function navSearchEscapeHTML(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function navNormalizeSearchText(value) {
    if (typeof otNormalizeSearchText === 'function') return otNormalizeSearchText(value);
    return String(value || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function navGetTournamentListForSearch() {
    if (typeof getNovosTorneiosSafeList === 'function') return getNovosTorneiosSafeList();
    if (typeof dbNovosTorneios !== 'undefined') return dbNovosTorneios || [];
    return window.dbNovosTorneios || [];
}

function navGetTournamentNameForSearch(t) {
    if (typeof otGetTournamentName === 'function') return otGetTournamentName(t);
    if (typeof getNovoTorneioName === 'function') return getNovoTorneioName(t);
    return t?.name || t?.nome || t?.torneio || t?.id || 'Torneio';
}

function navGetTournamentSearchText(t) {
    // Busca global do topo: torneio só deve aparecer quando a pesquisa bater no NOME/ID do torneio.
    // Não usa equipes, jogadores, prêmios ou campeão para evitar falso positivo tipo pesquisar jogador e aparecer LBFF.
    const name = navGetTournamentNameForSearch(t);
    const id = t?.id || '';
    const year = typeof otGetTournamentYear === 'function' ? otGetTournamentYear(t) : (t?.year || t?.ano || '');

    const tokens = [id, name];

    // Permite encontrar "LBFF 3", "lbff3", "LBFF S3" e variações simples.
    const numberMatch = String(name || id || '').match(/(?:^|\s)(?:s|season|temporada)?\s*(\d+)(?:\s|$)/i);
    const prefixMatch = String(name || id || '').match(/^([a-zA-Z]{2,})/);
    if (prefixMatch && numberMatch) {
        const prefix = prefixMatch[1];
        const n = numberMatch[1];
        tokens.push(`${prefix} ${n}`, `${prefix}${n}`, `${prefix} s${n}`, `${prefix} season ${n}`, `${prefix} temporada ${n}`);
    }

    // Ano ajuda só como complemento quando o usuário pesquisa junto com o nome, ex: "LBFF 2021".
    if (year) tokens.push(`${name} ${year}`, `${id} ${year}`);

    return tokens.filter(Boolean).join(' ');
}

function navGetTournamentNumberForSearch(t) {
    const name = String(navGetTournamentNameForSearch(t) || '');
    const id = String(t?.id || '');
    const source = `${name} ${id}`;

    // Pega número de edição/temporada do nome/id: LBFF 1, LBFF S1, lbff-1 etc.
    const editionMatch = source.match(/(?:^|[^a-z0-9])(?:s|season|temporada)?\s*(\d{1,2})(?:[^a-z0-9]|$)/i);
    return editionMatch ? editionMatch[1] : '';
}

function navGetTournamentSearchScore(t, rawInput) {
    const query = navNormalizeSearchText(rawInput);
    if (!query || query.length < 2) return -1;

    const searchable = navNormalizeSearchText(navGetTournamentSearchText(t));
    const compactSearchable = searchable.replace(/\s+/g, '');
    const compactQuery = query.replace(/\s+/g, '');
    const tokens = query.split(' ').filter(Boolean);

    // Não deixa torneio aparecer só por ano/número isolado. Precisa ter algum pedaço textual do nome/id.
    const textTokens = tokens.filter(token => /[a-z]/.test(token));
    if (!textTokens.length) return -1;

    const numberTokens = tokens.filter(token => /^\d+$/.test(token));
    const editionNumber = navGetTournamentNumberForSearch(t);
    const year = String(typeof otGetTournamentYear === 'function' ? otGetTournamentYear(t) : (t?.year || t?.ano || ''));

    // Correção principal: em pesquisas como "lbff 1", o "1" precisa bater na edição LBFF 1,
    // não no ano 2021. Ano só conta quando o usuário digitar 4 dígitos, ex: "lbff 2021".
    for (const token of numberTokens) {
        if (token.length >= 4) {
            if (year !== token && !searchable.includes(token)) return -1;
        } else if (editionNumber !== token) {
            return -1;
        }
    }

    const textMatches = textTokens.every(token => searchable.includes(token) || compactSearchable.includes(token));
    const compactMatches = compactQuery.length >= 4 && compactSearchable.includes(compactQuery);
    if (!textMatches && !compactMatches) return -1;

    const name = navNormalizeSearchText(navGetTournamentNameForSearch(t));
    const compactName = name.replace(/\s+/g, '');

    let score = 10;
    if (name === query || compactName === compactQuery) score += 100;
    if (editionNumber && numberTokens.includes(editionNumber)) score += 50;
    if (name.startsWith(query) || compactName.startsWith(compactQuery)) score += 25;
    if (year && numberTokens.includes(year)) score += 15;

    return score;
}

function navTournamentMatchesSearch(t, rawInput) {
    return navGetTournamentSearchScore(t, rawInput) >= 0;
}

function navGetTournamentLogoForSearch(t) {
    if (typeof otGetLeagueLogo === 'function') return otGetLeagueLogo(t);
    const name = navGetTournamentNameForSearch(t);
    if (typeof resolveLeagueLogo === 'function') return resolveLeagueLogo(name);
    return 'trofeu.webp';
}

function navGetTournamentSubForSearch(t) {
    const year = typeof otGetTournamentYear === 'function' ? otGetTournamentYear(t) : (t?.year || t?.ano || '');
    return year ? `TORNEIO - ${year}` : 'TORNEIO';
}

// Busca global inteligente: resultados rápidos + página completa
function navSearchSplitWords(value) {
    return navNormalizeSearchText(value).split(' ').filter(Boolean);
}

function navLevenshteinDistance(a, b) {
    a = String(a || '');
    b = String(b || '');
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;

    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    const curr = new Array(b.length + 1);

    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                curr[j - 1] + 1,
                prev[j] + 1,
                prev[j - 1] + cost
            );
        }
        for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
    }
    return prev[b.length];
}

function navFuzzyTokenScore(queryToken, words) {
    if (!queryToken || queryToken.length < 3) return -1;
    let best = -1;
    words.forEach(word => {
        if (!word || word.length < 2) return;
        if (word === queryToken) best = Math.max(best, 1);
        else if (word.startsWith(queryToken) || queryToken.startsWith(word)) best = Math.max(best, 0.92);
        else {
            const dist = navLevenshteinDistance(queryToken, word);
            const maxLen = Math.max(queryToken.length, word.length);
            const sim = 1 - (dist / maxLen);
            best = Math.max(best, sim);
        }
    });
    return best;
}

function navSmartSearchScore(rawQuery, rawText, allowFuzzy = true) {
    const query = navNormalizeSearchText(rawQuery);
    const text = navNormalizeSearchText(rawText);
    if (!query || !text || query.length < 2) return -1;

    const compactQuery = query.replace(/\s+/g, '');
    const compactText = text.replace(/\s+/g, '');
    const queryTokens = query.split(' ').filter(Boolean);
    const textWords = text.split(' ').filter(Boolean);

    if (text === query || compactText === compactQuery) return 250;
    if (text.startsWith(query) || compactText.startsWith(compactQuery)) return 190;
    if (text.includes(query) || compactText.includes(compactQuery)) return 155;
    if (queryTokens.every(token => text.includes(token) || compactText.includes(token))) return 130;

    if (!allowFuzzy) return -1;

    let total = 0;
    for (const token of queryTokens) {
        const minSimilarity = token.length <= 3 ? 0.67 : 0.74;
        const best = navFuzzyTokenScore(token, textWords);
        if (best < minSimilarity) return -1;
        total += best;
    }

    const avg = total / Math.max(queryTokens.length, 1);
    return Math.round(65 + avg * 55);
}

function navBuildPeopleSearchPool() {
    let peopleMap = new Map();

    const addPersonToSearch = (rawName, sub, type = 'player', isEx = false, priority = 0) => {
        const name = String(rawName || '').trim();
        if (!name) return;

        const canonical = type === 'player' ? getSearchCanonicalName(name) : name;
        const key = `${type}:${type === 'player' && typeof normalizePlayerAliasKey === 'function' ? normalizePlayerAliasKey(canonical) : canonical.toLowerCase()}`;
        const existing = peopleMap.get(key);

        if (!existing || priority > existing.priority) {
            peopleMap.set(key, {
                name: canonical,
                originalName: name,
                title: type === 'player' ? getDisplayName(canonical) : canonical,
                sub,
                type,
                isEx,
                priority,
                haystack: type === 'player'
                    ? getSearchAliasHaystack(name)
                    : getDisplayName(name).toLowerCase()
            });
        } else if (existing && type === 'player') {
            existing.haystack += ' ' + getSearchAliasHaystack(name);
        }
    };

    (db.players || []).forEach(p => {
        addPersonToSearch(p.jogador, p.equipe, 'player', !!p.isEx, 3);
    });

    if (typeof lbffData !== 'undefined') {
        Object.keys(lbffData || {}).forEach(name => {
            addPersonToSearch(name, 'JOGADOR HISTÓRICO', 'player', true, 1);
        });
    }

    (dbStaff || []).forEach(s => {
        addPersonToSearch(s.nome, `${s.equipe} (${s.cargo})`, 'staff', false, 2);
    });

    // Inclui jogadores da LAFF, mas sem duplicar quem já está na WB.
    // Jogadores que jogam WB e LAFF ao mesmo tempo ficam com tipo 'player'
    // (abre o perfil WB completo) e apenas atualizam o subtítulo.
    // Jogadores exclusivos da LAFF ficam com tipo 'laff-player'.
    if (typeof window.getLAFFPlayers === 'function') {
        const wbPlayerKey = name => typeof normalizePlayerAliasKey === 'function'
            ? normalizePlayerAliasKey(String(name || '').toLowerCase())
            : String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const laffPlayers = window.getLAFFPlayers() || [];
        laffPlayers.forEach(p => {
            const name = String(p.name || '').trim();
            if (!name) return;
            const canonical = typeof getSearchCanonicalName === 'function' ? getSearchCanonicalName(name) : name;
            const normalizedKey = wbPlayerKey(canonical);
            const wbKey = `player:${normalizedKey}`;
            const laffKey = `laff-player:${normalizedKey}`;
            if (peopleMap.has(wbKey)) {
                // Jogador já está na WB/mercado — mantém a busca pela LAFF, mas não polui o subtítulo.
                const existing = peopleMap.get(wbKey);
                existing.sub = p.team || existing.sub || existing.name;
                existing.haystack += ' laff liga ascensao';
            } else if (!peopleMap.has(laffKey)) {
                // Jogador exclusivo da LAFF
                peopleMap.set(laffKey, {
                    name: canonical,
                    originalName: name,
                    title: canonical,
                    sub: p.team || 'LAFF',
                    type: 'laff-player',
                    isEx: false,
                    priority: 4,
                    img: p.photo || (typeof getPlayerPhoto === 'function' ? getPlayerPhoto(name) : 'silhueta.webp'),
                    haystack: `${name} ${canonical} ${p.team || ''} ${p.funcao || ''} jogador laff liga ascensao free fire`.toLowerCase()
                });
            }
        });
    }

    return Array.from(peopleMap.values());
}

function navGetTeamAliasesForSearch(teamName) {
    const names = new Set([String(teamName || '')]);
    if (typeof dbTeamAliases !== 'undefined' && dbTeamAliases) {
        Object.entries(dbTeamAliases).forEach(([canonical, aliases]) => {
            const all = [canonical, ...(Array.isArray(aliases) ? aliases : [aliases])].filter(Boolean);
            const normalizedAll = all.map(navNormalizeSearchText);
            if (normalizedAll.includes(navNormalizeSearchText(teamName))) {
                all.forEach(n => names.add(n));
            }
        });
    }
    if (typeof shortNames !== 'undefined' && shortNames && shortNames[teamName]) names.add(shortNames[teamName]);
    return Array.from(names).filter(Boolean);
}

function navBuildTeamSearchPool() {
    const allTeamNames = new Set(Object.keys(logos || {}));
    (db.teams || []).forEach(t => allTeamNames.add(t.equipe));
    if (typeof dbTeamAliases !== 'undefined' && dbTeamAliases) {
        Object.entries(dbTeamAliases).forEach(([canonical, aliases]) => {
            allTeamNames.add(canonical);
            (Array.isArray(aliases) ? aliases : [aliases]).forEach(alias => allTeamNames.add(alias));
        });
    }

    const teamMap = new Map();
    Array.from(allTeamNames).filter(Boolean).forEach(rawName => {
        const canonical = typeof getTeamCanonicalName === 'function' ? getTeamCanonicalName(rawName) : rawName;
        const key = typeof normalizeTeamAlias === 'function'
            ? normalizeTeamAlias(canonical)
            : navNormalizeSearchText(canonical);
        const aliases = new Set(navGetTeamAliasesForSearch(rawName));
        navGetTeamAliasesForSearch(canonical).forEach(alias => aliases.add(alias));
        aliases.add(rawName);
        aliases.add(canonical);

        const existing = teamMap.get(key);
        const isWB = (db.teams || []).some(x => {
            const cx = typeof getTeamCanonicalName === 'function' ? getTeamCanonicalName(x.equipe) : x.equipe;
            const nx = typeof normalizeTeamAlias === 'function' ? normalizeTeamAlias(cx) : navNormalizeSearchText(cx);
            return nx === key;
        });
        const isLAFFOfficial = (() => {
            try {
                const laffTeams = typeof window.getLAFFTeams === 'function' ? (window.getLAFFTeams() || []) : [];
                return laffTeams.some(t => {
                    const tn = String(t?.name || '').trim();
                    if (!tn) return false;
                    if (typeof sameTeamName === 'function') return sameTeamName(tn, rawName) || sameTeamName(tn, canonical);
                    return navNormalizeTeamSearchKey(tn) === navNormalizeTeamSearchKey(rawName) || navNormalizeTeamSearchKey(tn) === navNormalizeTeamSearchKey(canonical);
                });
            } catch (e) {
                return false;
            }
        })();
        if (isLAFFOfficial && !isWB) return;
        const img = (logos && (logos[canonical] || logos[rawName] || Array.from(aliases).map(a => logos[a]).find(Boolean))) || 'escudo.webp';

        if (!existing) {
            teamMap.set(key, {
                type: 'team',
                name: canonical,
                title: canonical,
                sub: isWB ? 'Equipe Competidora' : 'Equipe Histórica',
                img,
                haystack: Array.from(aliases).join(' '),
                isWB
            });
        } else {
            existing.haystack += ' ' + Array.from(aliases).join(' ');
            if (isWB && !existing.isWB) {
                existing.sub = 'Equipe Competidora';
                existing.isWB = true;
            }
            if ((!existing.img || existing.img === 'escudo.webp') && img) existing.img = img;
        }
    });

    return Array.from(teamMap.values());
}

function navBuildTournamentSearchPool() {
    return navGetTournamentListForSearch().map(t => {
        const name = navGetTournamentNameForSearch(t);
        const id = t?.id || name;
        return {
            type: 'tournament',
            name: id,
            title: name,
            sub: navGetTournamentSubForSearch(t),
            img: navGetTournamentLogoForSearch(t),
            item: t,
            haystack: navGetTournamentSearchText(t)
        };
    });
}

function navGetNewsListForSearch() {
    return window.CFF_NOTICIAS_CACHE || window.cffNoticias || window.__CFF_NOTICIAS || [];
}

function navBuildNewsSearchPool() {
    return navGetNewsListForSearch().map(n => ({
        type: 'news',
        name: n.urlInterna || n.link_original || n.id || n.titulo,
        title: n.titulo || 'Notícia',
        sub: n.data ? `NOTÍCIA - ${n.data}` : 'NOTÍCIA',
        img: n.imagem || 'central free fire.webp',
        url: n.urlInterna || n.link_original || '#',
        // Notícias entram na busca só com sinal forte. Título e resumo são prioridade;
        // o conteúdo completo não entra no dropdown para evitar falso positivo.
        haystack: [n.titulo, n.resumo, n.autor].filter(Boolean).join(' '),
        fullHaystack: [n.titulo, n.resumo, n.conteudo, n.autor].filter(Boolean).join(' ')
    }));
}

function navNewsSearchScore(rawQuery, item, includeFullText = false) {
    const query = navNormalizeSearchText(rawQuery);
    if (!query || query.length < 3) return -1;

    const mainText = navNormalizeSearchText(item.haystack || '');
    const fullText = navNormalizeSearchText(includeFullText ? (item.fullHaystack || item.haystack || '') : (item.haystack || ''));
    const compactQuery = query.replace(/\s+/g, '');
    const compactMain = mainText.replace(/\s+/g, '');
    const tokens = query.split(' ').filter(Boolean);

    if (mainText === query || compactMain === compactQuery) return 180;
    if (mainText.includes(query) || compactMain.includes(compactQuery)) return 135;

    // Para notícia, não usa fuzzy. Cada token precisa aparecer como palavra/trecho real.
    // Assim "nobru" não puxa matéria aleatória só por aproximação.
    const words = fullText.split(' ').filter(Boolean);
    const ok = tokens.every(token => {
        if (token.length < 3) return false;
        return words.some(word => word === token || word.startsWith(token));
    });
    return ok ? 95 : -1;
}



function navNormalizeTeamSearchKey(value) {
    return navNormalizeSearchText(value).replace(/\s+/g, '');
}

function navSimplifyTeamSearchKey(value) {
    const words = navNormalizeSearchText(value)
        .split(' ')
        .filter(Boolean)
        .filter(w => !['gaming', 'esports', 'esport', 'e', 'team', 'clube', 'club', 'fc', 'oficial', 'official'].includes(w));
    return words.join('');
}

function navGetLAFFCanonicalSearchKey(item) {
    if (!item) return '';

    const candidates = [item.name, item.title, item.originalName]
        .concat(String(item.haystack || '').split(/\s{2,}|\|/g))
        .map(v => String(v || '').trim())
        .filter(Boolean);

    const exact = new Set(candidates.map(navNormalizeTeamSearchKey).filter(Boolean));
    const simplified = new Set(candidates.map(navSimplifyTeamSearchKey).filter(Boolean));

    try {
        if (typeof getLAFFTeams === 'function') {
            const teams = getLAFFTeams() || [];
            for (const team of teams) {
                const official = team && team.name ? String(team.name) : '';
                if (!official) continue;
                const officialKey = navNormalizeTeamSearchKey(official);
                const officialSimple = navSimplifyTeamSearchKey(official);
                if (!officialKey) continue;

                const matchesExact = exact.has(officialKey);
                const matchesSimple = officialSimple && simplified.has(officialSimple);
                const matchesContained = Array.from(exact).some(k => {
                    if (!k || k.length < 3 || !officialKey) return false;
                    return officialKey.includes(k) || k.includes(officialKey);
                });

                if (matchesExact || matchesSimple || matchesContained) return officialKey;
            }
        }
    } catch (e) {}

    return '';
}

function navGetSEACanonicalSearchKey(item) {
    if (!item) return '';

    const normalize = value => typeof navNormalizeSearchText === 'function'
        ? navNormalizeSearchText(value)
        : String(value || '')
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, ' ')
            .trim();

    const candidates = [item.name, item.title]
        .concat(String(item.haystack || '').split(/\s{2,}|\|/g))
        .map(normalize)
        .filter(Boolean);

    const exact = new Set(candidates);

    try {
        if (typeof SEA_TEAM_NAME_MAP !== 'undefined' && SEA_TEAM_NAME_MAP) {
            for (const [alias, canonical] of Object.entries(SEA_TEAM_NAME_MAP)) {
                const aliasKey = normalize(alias);
                const canonicalKey = normalize(canonical);
                if (exact.has(aliasKey) || exact.has(canonicalKey)) return canonicalKey;
            }
        }
    } catch (e) {}

    try {
        if (typeof getSEAProfileTeams === 'function') {
            const teams = getSEAProfileTeams() || [];
            for (const team of teams) {
                const teamKey = normalize(team.name);
                const siglaKey = normalize(team.sigla);
                if (exact.has(teamKey) || (siglaKey && exact.has(siglaKey))) return teamKey;
            }
        }
    } catch (e) {}

    return '';
}

function navPreferSearchResult(current, candidate) {
    if (!current) return candidate;
    if (!candidate) return current;

    // Em buscas de torneios regionais, a versão oficial do torneio vence a equipe histórica.
    if (current.type !== 'sea-team' && candidate.type === 'sea-team') return candidate;
    if (current.type === 'sea-team' && candidate.type !== 'sea-team') return current;
    if (current.type !== 'laff-team' && candidate.type === 'laff-team') return candidate;
    if (current.type === 'laff-team' && candidate.type !== 'laff-team') return current;

    // Entre duas opções equivalentes, mantém a mais bem ranqueada.
    return (Number(candidate.score) || 0) > (Number(current.score) || 0) ? candidate : current;
}

function navDedupeSearchResults(results) {
    const selected = [];
    const indexByKey = new Map();

    results.forEach(item => {
        const seaKey = navGetSEACanonicalSearchKey(item);
        const laffKey = navGetLAFFCanonicalSearchKey(item);
        const normalizedName = navNormalizeTeamSearchKey(item.name || item.title || '');
        const regularKey = `${item.type}:${normalizedName}`;
        const key = seaKey ? `sea-team:${seaKey}` : (laffKey ? `laff-team:${laffKey}` : regularKey);
        const existingIndex = indexByKey.get(key);

        if (existingIndex === undefined) {
            indexByKey.set(key, selected.length);
            selected.push(item);
            return;
        }

        selected[existingIndex] = navPreferSearchResult(selected[existingIndex], item);
    });

    return selected;
}

function navBuildAllSearchResults(rawInput) {
    const query = String(rawInput || '').trim();
    if (query.length < 2) return { query, total: 0, grouped: {}, all: [] };

    const results = [];

    navBuildTeamSearchPool().forEach(item => {
        const score = navSmartSearchScore(query, item.haystack, true);
        if (score >= 0) results.push({ ...item, score });
    });

    navBuildTournamentSearchPool().forEach(item => {
        let score = navGetTournamentSearchScore(item.item, query);
        if (score < 0 && navNormalizeSearchText(query).length >= 4) {
            const fuzzyScore = navSmartSearchScore(query, item.haystack, true);
            if (fuzzyScore >= 0) score = fuzzyScore - 15;
        }
        if (score >= 0) results.push({ ...item, score: score + 10 });
    });

    navBuildPeopleSearchPool().forEach(p => {
        const score = navSmartSearchScore(query, p.haystack, true);
        if (score >= 0) {
            const img = p.type === 'staff'
                ? ((typeof staffPhotos !== 'undefined' && staffPhotos[p.name]) || 'silhueta.webp')
                : (p.img || getSearchPlayerPhoto(p.name, p.originalName));
            results.push({
                type: p.type,
                name: p.name,
                title: p.title || (p.type === 'player' ? getDisplayName(p.name) : p.name),
                sub: p.sub,
                img,
                score: score + (p.type === 'player' || p.type === 'sea-player' || p.type === 'laff-player' ? 5 : 0)
            });
        }
    });

    navBuildNewsSearchPool().forEach(item => {
        const score = navNewsSearchScore(query, item, true);
        if (score >= 0) results.push({ ...item, score: score - 25 });
    });

    const all = navDedupeSearchResults(
        results.sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)))
    );

    const grouped = all.reduce((acc, item) => {
        const key = (item.type === 'team' || item.type === 'sea-team' || item.type === 'laff-team') ? 'teams'
            : item.type === 'tournament' ? 'tournaments'
            : item.type === 'news' ? 'news'
            : item.type === 'staff' ? 'staff'
            : 'players';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    return { query, total: all.length, grouped, all };
}

function navRenderDropdownItem(item) {
    const safeType = navSearchEscapeHTML(item.type);
    const safeName = navSearchEscapeHTML(item.name);
    const safeTitle = navSearchEscapeHTML(item.title);
    const safeSub = navSearchEscapeHTML(item.sub || '');
    const safeImg = navSearchEscapeHTML(item.img || (item.type === 'team' ? 'escudo.webp' : 'silhueta.webp'));
    const fallback = (item.type === 'team' || item.type === 'sea-team' || item.type === 'laff-team') ? 'escudo.webp' : (item.type === 'tournament' ? 'trofeu.webp' : (item.type === 'news' ? 'central free fire.webp' : 'silhueta.webp'));

    return `
        <div class="search-item" data-type="${safeType}" data-name="${safeName}" style="cursor:pointer;">
            <img src="${safeImg}" onerror="this.src='${fallback}'">
            <div>
                <span style="font-weight: bold; color: #fff;">${safeTitle}</span><br>
                <small style="color: #aaa;">${safeSub}</small>
            </div>
        </div>`;
}

function navRenderShowAllSearchItem(query, total, hasApprox) {
    const safeQuery = navSearchEscapeHTML(query);
    const label = total > 0
        ? `Mostrar todos os resultados (${total})`
        : 'Procurar resultados aproximados';
    const sub = hasApprox ? 'Inclui resultados aproximados e relacionados' : 'Ver página completa de busca';
    return `
        <div class="search-item nav-show-all-search" data-type="search-all" data-name="${safeQuery}" style="cursor:pointer;">
            <div class="nav-show-all-icon">🔎</div>
            <div>
                <span style="font-weight:900; color:var(--accent);">${label}</span><br>
                <small style="color:#aaa;">${sub}</small>
            </div>
        </div>`;
}

// Busca unificada (desktop e mobile compartilham o pool, só o container muda)
function handleGlobalSearchFrom(source) {
    const inputId = source === 'desktop' ? 'global-search-desktop' : 'global-search-mobile';
    const resultsId = source === 'desktop' ? 'search-results-desktop' : 'search-results-mobile';

    const input = document.getElementById(inputId)?.value?.trim() || '';
    const resultsBox = document.getElementById(resultsId);
    if (!resultsBox) return;

    if (input.length < 2) {
        resultsBox.style.display = 'none';
        return;
    }

    const data = navBuildAllSearchResults(input);
    const quickLimit = 6;
    const quickResults = data.all.slice(0, quickLimit);
    const hasMore = data.total > quickLimit;
    const hasApprox = data.all.some(item => item.score < 145);

    let html = quickResults.map(navRenderDropdownItem).join('');
    html += navRenderShowAllSearchItem(input, data.total, hasMore || hasApprox || data.total === 0);

    if (!quickResults.length) {
        html = `
            <div style="padding:15px; color:#888; text-align:center; border-bottom:1px solid var(--border);">
                Nenhum resultado exato. Tente ver os aproximados.
            </div>
            ${navRenderShowAllSearchItem(input, 0, true)}`;
    }

    resultsBox.innerHTML = html;
    resultsBox.style.display = 'block';
}

function navSearchResultAction(item) {
    if (!item) return '';
    const safeName = String(item.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    if (item.type === 'news') {
        const url = String(item.url || item.name || '#').replace(/"/g, '&quot;');
        return `onclick="window.location.href='${url}'"`;
    }
    return `onclick="selectSearchResult('${item.type}', '${safeName}')"`;
}

function renderGlobalSearchResults(query) {
    const page = document.getElementById('busca-global');
    const container = document.getElementById('global-search-results-container');
    const input = document.getElementById('global-search-page-input');
    const title = document.getElementById('global-search-page-title');
    if (!page || !container) return;

    const q = String(query || '').trim();
    if (input) input.value = q;
    const data = navBuildAllSearchResults(q);

    if (title) {
        title.innerHTML = q
            ? `Resultados para <span style="color:var(--accent);">${navSearchEscapeHTML(q)}</span>`
            : 'Busca completa';
    }

    if (!q || q.length < 2) {
        container.innerHTML = `<div class="global-search-empty">Digite pelo menos 2 caracteres para pesquisar.</div>`;
        return;
    }

    const labels = {
        teams: 'Equipes',
        tournaments: 'Torneios',
        players: 'Jogadores',
        staff: 'Staff',
        news: 'Notícias relacionadas'
    };
    const order = ['teams', 'tournaments', 'players', 'staff', 'news'];

    if (!data.total) {
        container.innerHTML = `
            <div class="global-search-empty">
                Nenhum resultado encontrado para <strong>${navSearchEscapeHTML(q)}</strong>.<br>
                Tente menos letras ou uma variação do nome.
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="global-search-summary">${data.total} resultado(s) encontrados, incluindo resultados aproximados quando fizer sentido.</div>
        ${order.map(key => {
            const items = data.grouped[key] || [];
            if (!items.length) return '';
            return `
                <section class="global-search-section">
                    <div class="global-search-section-head">
                        <h3>${labels[key]}</h3>
                        <span>${items.length}</span>
                    </div>
                    <div class="global-search-grid">
                        ${items.map(item => {
                            const fallback = (item.type === 'team' || item.type === 'sea-team' || item.type === 'laff-team') ? 'escudo.webp' : (item.type === 'tournament' ? 'trofeu.webp' : (item.type === 'news' ? 'central free fire.webp' : 'silhueta.webp'));
                            return `
                                <button class="global-search-card" type="button" ${navSearchResultAction(item)}>
                                    <img src="${navSearchEscapeHTML(item.img || fallback)}" onerror="this.src='${fallback}'" alt="">
                                    <div>
                                        <strong>${navSearchEscapeHTML(item.title)}</strong>
                                        <small>${navSearchEscapeHTML(item.sub || '')}</small>
                                    </div>
                                </button>`;
                        }).join('')}
                    </div>
                </section>`;
        }).join('')}`;
}

function openGlobalSearchResults(query) {
    ['search-results', 'search-results-desktop', 'search-results-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const mobileBar = document.getElementById('mobile-search-bar');
    if (mobileBar) mobileBar.classList.remove('active');
    const desktopWrapper = document.getElementById('nav-search-wrapper-desktop');
    if (desktopWrapper) desktopWrapper.classList.remove('open');

    if (typeof navigate === 'function') navigate('busca-global');
    renderGlobalSearchResults(query);
}

function handleGlobalSearchPageSubmit(event) {
    if (event) event.preventDefault();
    const value = document.getElementById('global-search-page-input')?.value || '';
    renderGlobalSearchResults(value);
    if (typeof history !== 'undefined' && value.trim()) history.replaceState(null, '', '#busca=' + encodeURIComponent(value.trim()));
}

// Popula o dropdown desktop com os logos dos times da WB em grid 4x4
function buildDesktopTeamNav() {
    const container = document.getElementById('nav-desktop-teams');
    if (!container || !db.teams) return;

    const order = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
    const wbTeams = [...db.teams].sort((a, b) => order[a.grupo] - order[b.grupo] || a.equipe.localeCompare(b.equipe));

    // Removido a <span> que mostrava o nome/sigla ao lado da logo
    container.innerHTML = wbTeams.map(t => `
        <button class="nav-team-logo-btn" onclick="closeTeamsDropdown(); openTeamProfile('${t.equipe}')" title="${t.equipe}">
            <img src="${logos[t.equipe] || 'escudo.webp'}" alt="${t.equipe}" onerror="this.src='escudo.webp'">
        </button>`).join('');
}

function renderIndividualRecords() {
    let pData = db.players;

    // Extrai e junta todas as performances diárias das Equipes
    let tDailyData = [];
    for (let team in db.teamDaily) {
        db.teamDaily[team].forEach(dayPerf => {
            tDailyData.push({
                equipe: team, dia: dayPerf.dia, pontos: dayPerf.pontos,
                abates: dayPerf.abates, booyah: dayPerf.booyah
            });
        });
    }

    const getPlayerTopHtml = (arr, valFn, formatFn, label) => {
        const isMob = window.innerWidth <= 768;
        const labelShort = {'Total':'K','Dano':'D','Assist.':'A','Média K':'MdK','Média D':'MdD'}[label] || label;
        const colHdr = isMob ? 'J' : 'Jogador';
        const eqHdr  = isMob ? 'E' : 'Equipe';
        const valHdr = isMob ? labelShort : label;
        const cols   = isMob ? '1fr 22px 0.6fr' : '1.2fr 1fr 0.7fr';
        const sorted = [...arr].sort((a,b) => valFn(b) - valFn(a)).slice(0, 5);
        let html = `<div style="display:grid;grid-template-columns:${cols};padding:0 10px 8px 10px;font-size:0.7em;color:#666;font-weight:bold;text-transform:uppercase;letter-spacing:1px;"><div>${colHdr}</div><div>${eqHdr}</div><div style="text-align:right;">${valHdr}</div></div>`;
        html += sorted.map((p, i) => `<div style="display:grid;grid-template-columns:${cols};align-items:center;margin-bottom:6px;padding:8px 10px;background:rgba(255,255,255,0.02);border-radius:4px;border-left:3px solid ${i===0?'#ffd700':(i===1?'#c0c0c0':(i===2?'#cd7f32':'#888'))};font-size:0.85em;">
                <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><span style="font-weight:bold;color:#555;margin-right:4px;">${i+1}º</span><span class="clickable" onclick="${_safePPAttr(p.jogador)}" title="${p.jogador}">${p.jogador}</span></div>
                <div class="clickable" onclick="openTeamProfile('${p.equipe}')" style="display:flex;align-items:center;gap:4px;color:#9aa0a6;overflow:hidden;white-space:nowrap;"><img src="${logos[p.equipe]||''}" style="width:14px;height:14px;object-fit:contain;flex-shrink:0;">${isMob ? '' : `<span style="font-size:0.9em;overflow:hidden;text-overflow:ellipsis;">${shortNames[p.equipe]||p.equipe}</span>`}</div>
                <div style="font-weight:bold;color:var(--accent);text-align:right;">${formatFn(valFn(p))}</div>
            </div>`).join('');
        return html;
    };

    const getTeamTopHtml = (arr, valFn, formatFn, label) => {
        const sorted = [...arr].sort((a,b) => valFn(b) - valFn(a)).slice(0, 5);
        let html = `<div style="display: grid; grid-template-columns: 1.5fr 1fr 0.7fr; padding: 0 10px 8px 10px; font-size: 0.7em; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;"><div>Equipe</div><div>Dia</div><div style="text-align: right;">${label}</div></div>`;
        html += sorted.map((t, i) => `<div style="display: grid; grid-template-columns: 1.5fr 1fr 0.7fr; align-items: center; margin-bottom: 6px; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 4px; border-left: 3px solid ${i===0?'#ffd700':(i===1?'#c0c0c0':(i===2?'#cd7f32':'#888'))}; font-size: 0.85em;">
                <div class="clickable" onclick="openTeamProfile('${t.equipe}')" style="display: flex; align-items: center; gap: 6px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span style="font-weight:bold; color: #555; margin-right: 4px;">${i+1}º</span><img src="${logos[t.equipe]||''}" style="width:16px; height:16px; object-fit: contain;"><span style="font-size: 0.95em; font-weight:bold;">${shortNames[t.equipe] || t.equipe}</span></div>
                <div style="color: #9aa0a6; font-size: 0.9em;">Dia ${t.dia}</div>
                <div style="font-weight: bold; color: var(--accent); text-align: right;">${formatFn(valFn(t))}</div>
            </div>`).join('');
        return html;
    };

    // Versão especial do ranking que mostra o dia do recorde
    const getPlayerDailyTopHtml = (arr, valFn, formatFn, label) => {
        const isMob = window.innerWidth <= 768;
        const cols = isMob ? '1fr 24px 36px 28px' : '2fr 1fr 60px 55px';
        const sorted = [...arr].sort((a,b) => valFn(b) - valFn(a)).slice(0, 5);
        let html = `<div style="display:grid;grid-template-columns:${cols};column-gap:12px;padding:0 10px 8px 10px;font-size:0.7em;color:#666;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">
            <div>${isMob ? 'J' : 'Jogador'}</div>
            <div style="text-align:center;">${isMob ? 'E' : 'Equipe'}</div>
            <div style="text-align:right;">${isMob ? 'K' : label}</div>
            <div style="text-align:right;">${isMob ? 'Dia' : 'Dia'}</div>
        </div>`;
        html += sorted.map((p, i) => `<div style="display:grid;grid-template-columns:${cols};column-gap:12px;align-items:center;margin-bottom:6px;padding:8px 10px;background:rgba(255,255,255,0.02);border-radius:4px;border-left:3px solid ${i===0?'#ffd700':(i===1?'#c0c0c0':(i===2?'#cd7f32':'#888'))};font-size:0.85em;">
                <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;"><span style="font-weight:bold;color:#555;margin-right:4px;">${i+1}º</span><span class="clickable" onclick="${_safePPAttr(p.jogador)}" title="${p.jogador}">${p.jogador}</span></div>
                <div class="clickable" onclick="openTeamProfile('${p.equipe}')" style="display:flex;align-items:center;justify-content:center;gap:4px;color:#9aa0a6;min-width:0;"><img src="${logos[p.equipe]||''}" style="width:14px;height:14px;object-fit:contain;flex-shrink:0;">${isMob ? '' : `<span style="font-size:0.9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${shortNames[p.equipe]||p.equipe}</span>`}</div>
                <div style="font-weight:bold;color:var(--accent);text-align:right;">${formatFn(valFn(p))}</div>
                <div style="color:#9aa0a6;font-size:0.9em;text-align:right;">${isMob ? p.dia : 'Dia '+p.dia}</div>
            </div>`).join('');
        return html;
    };

    let container = document.getElementById('records-container');
    container.style.display = "grid";
    if (window.innerWidth > 1100) { container.style.gridTemplateColumns = "repeat(3, 1fr)"; }
    else { container.style.gridTemplateColumns = "repeat(auto-fit, minmax(320px, 1fr))"; }
    container.style.gap = "20px";

    container.innerHTML = `
        <div style="grid-column: 1/-1; border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-top: 10px;">
            <h3 style="color: #fff; margin:0;">Recordes de Equipes (Diários)</h3>
        </div>
        <div class="card"><div class="card-top-border"></div><h3>Mais Pontos em 1 Dia</h3>${getTeamTopHtml(tDailyData, t => t.pontos, v => v, "Pts")}</div>
        <div class="card"><div class="card-top-border"></div><h3>Mais Abates em 1 Dia</h3>${getTeamTopHtml(tDailyData, t => t.abates, v => v, "Kills")}</div>
        <div class="card"><div class="card-top-border"></div><h3>Mais Booyahs em 1 Dia</h3>${getTeamTopHtml(tDailyData, t => t.booyah, v => v, "B!")}</div>

        <div style="grid-column: 1/-1; border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-top: 20px;">
            <h3 style="color: #fff; margin:0;">Recordes Individuais</h3>
        </div>
        <div class="card"><div class="card-top-border"></div><h3>Recorde Abates (Dia)</h3>${getPlayerDailyTopHtml(db.playerDaily, p => p.abates || 0, v => v, "Abates")}</div>
        <div class="card"><div class="card-top-border"></div><h3>Abates Totais</h3>${getPlayerTopHtml(pData, p => p.abates, v => v, "Total")}</div>
        <div class="card"><div class="card-top-border"></div><h3>Dano Total</h3>${getPlayerTopHtml(pData, p => p.dano, v => v, "Dano")}</div>
        <div class="card"><div class="card-top-border"></div><h3>Assistências</h3>${getPlayerTopHtml(pData, p => p.assists, v => v, "Assist.")}</div>
        <div class="card"><div class="card-top-border"></div><h3>Média Kills</h3>${getPlayerTopHtml(pData, p => p.abates / (p.quedas || 1), v => v.toFixed(2), "Média K")}</div>
        <div class="card"><div class="card-top-border"></div><h3>Média Dano</h3>${getPlayerTopHtml(pData, p => p.dano / (p.quedas || 1), v => v.toFixed(0), "Média D")}</div>
    `;
}

function cffCompareEscape(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cffEnsureSEACompareTeamOptions() {
    const s1 = document.getElementById('comp-t1');
    const s2 = document.getElementById('comp-t2');
    if (!s1 || !s2) return;
    const addOptions = () => {
        const teams = typeof window.getSEAProfileTeams === 'function' ? window.getSEAProfileTeams() : [];
        if (!teams.length) return;
        [s1, s2].forEach(select => {
            if (select.querySelector('optgroup[data-region="sea"]')) return;
            const group = document.createElement('optgroup');
            group.label = 'FFWS SEA';
            group.dataset.region = 'sea';
            teams
                .slice()
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
                .forEach(team => {
                    const opt = document.createElement('option');
                    opt.value = `SEA::${team.name}`;
                    opt.textContent = `🌏 ${team.name}`;
                    group.appendChild(opt);
                });
            select.appendChild(group);
        });
    };

    addOptions();
    if (!window.__cffCompareSeaTeamsLoading && typeof window.loadSEAProfilesData === 'function') {
        window.__cffCompareSeaTeamsLoading = true;
        window.loadSEAProfilesData()
            .then(() => { addOptions(); })
            .catch(err => console.warn('[compare] FFWS SEA não carregou:', err))
            .finally(() => { window.__cffCompareSeaTeamsLoading = false; });
    }
}


function cffGetSEATeamDrops(team) {
    const players = Array.isArray(team?.players) ? team.players : [];
    const explicit = Number(team?.teamQuedas ?? team?.teamDrops ?? team?.matches ?? team?.partidas ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;

    // Em ffws-sea-abates.json, "quedas" vem por jogador. Para comparar equipe,
    // o correto é a quantidade de quedas disputadas pelo time, não a soma dos 4/5 jogadores.
    const playerDrops = players
        .map(player => Number(player?.quedas || 0))
        .filter(value => Number.isFinite(value) && value > 0);
    if (playerDrops.length) return Math.max(...playerDrops);

    const total = Number(team?.quedas || 0);
    if (Number.isFinite(total) && total > 0) {
        const divisor = players.filter(player => Number(player?.kills || player?.dano || player?.assistencias || player?.mvp || player?.quedas)).length || 4;
        return Math.max(1, Math.round(total / Math.max(1, divisor)));
    }
    return 0;
}

function cffGetCompareTeamData(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    if (raw.startsWith('SEA::')) {
        const name = raw.slice(5);
        const teams = typeof window.getSEAProfileTeams === 'function' ? window.getSEAProfileTeams() : [];
        const team = teams.find(t => String(t.name || '').toUpperCase() === name.toUpperCase() || String(t.sigla || '').toUpperCase() === name.toUpperCase());
        if (!team) return null;
        const quedas = cffGetSEATeamDrops(team);
        return {
            source: 'SEA',
            name: team.name,
            short: team.sigla || team.name,
            logo: team.logo || (typeof resolveSEATeamLogo === 'function' ? resolveSEATeamLogo(team.name) : '') || logos[team.name] || 'escudo.webp',
            posicao: '-',
            pontos: null,
            abates: Number(team.kills || team.abates || 0),
            booyah: null,
            quedas,
            kq: quedas ? Number(team.kills || team.abates || 0) / quedas : 0,
            dano: Number(team.dano || 0),
            assistencias: Number(team.assistencias || 0)
        };
    }

    const team = db.teams.find(x => x.equipe === raw) || db.teams.find(x => String(x.equipe || '').toUpperCase() === raw.toUpperCase());
    if (!team) return null;
    const quedas = Number(team.quedas || 0);
    return {
        source: 'BR',
        name: team.equipe,
        short: shortNames[team.equipe] || team.equipe,
        logo: logos[team.equipe] || 'escudo.webp',
        posicao: team.posGeral || '-',
        pontos: Number(team.pontos || 0),
        abates: Number(team.abates || 0),
        booyah: Number(team.booyah || 0),
        quedas,
        kq: quedas ? Number(team.abates || 0) / quedas : 0,
        dano: Number(team.dano || 0),
        assistencias: Number(team.assists || team.assistencias || 0)
    };
}

function renderCompareTeams() {
    cffEnsureSEACompareTeamOptions();
    const select1 = document.getElementById('comp-t1');
    const select2 = document.getElementById('comp-t2');
    const result = document.getElementById('compare-teams-result');
    if (!select1 || !select2 || !result) return;

    let t1 = cffGetCompareTeamData(select1.value);
    let t2 = cffGetCompareTeamData(select2.value);

    if ((!t1 || !t2) && (String(select1.value || '').startsWith('SEA::') || String(select2.value || '').startsWith('SEA::'))) {
        result.innerHTML = '<div class="compare-box" style="grid-column:1/-1;color:var(--text-muted);">Carregando dados da FFWS SEA...</div>';
        return;
    }
    if (!t1 || !t2) return;

    const metric = document.getElementById('comp-team-metric')?.value || 'total';
    const metricLabel = metric === 'media' ? 'Média K/Q' : 'Abates';
    const metricValue = (team) => metric === 'media' ? Number(team.kq || 0) : Number(team.abates || 0);
    const metricFormat = (value) => metric === 'media' ? Number(value || 0).toFixed(2) : Math.round(Number(value || 0));

    const buildRow = (label, v1, v2, formatFn = v => v, options = {}) => {
        const n1 = Number(v1);
        const n2 = Number(v2);
        const comparable = !options.neutral && Number.isFinite(n1) && Number.isFinite(n2);
        return `<div class="stat-row">
            <div class="stat-val ${comparable && n1 > n2 ? 'winner' : (comparable && n1 < n2 ? 'loser' : '')}">${formatFn(v1)}</div>
            <div class="stat-label">${label}</div>
            <div class="stat-val ${comparable && n2 > n1 ? 'winner' : (comparable && n2 < n1 ? 'loser' : '')}">${formatFn(v2)}</div>
        </div>`;
    };
    const dash = v => (v === null || v === undefined || v === '') ? '-' : v;
    const teamLink = (team) => team.source === 'SEA'
        ? `openSEATeamProfile && openSEATeamProfile('${String(team.name).replace(/'/g, "\\'")}')`
        : `openTeamProfile('${String(team.name).replace(/'/g, "\\'")}')`;

    result.innerHTML = `
        <div class="compare-box">
            <img src="${cffCompareEscape(t1.logo)}" onerror="this.src='escudo.webp'" style="height: 80px; object-fit: contain; margin-bottom: 15px;">
            <h2 style="color:#66b3ff; font-size: 1.4em;"><span class="clickable" onclick="${teamLink(t1)}">${cffCompareEscape(t1.short)}</span></h2>
            <p style="font-size: 0.9em;">${t1.source === 'SEA' ? 'FFWS SEA' : `Posição: <strong style="color:var(--accent)">${cffCompareEscape(t1.posicao)}º</strong>`}</p>
        </div>
        <div class="compare-box">
            <img src="${cffCompareEscape(t2.logo)}" onerror="this.src='escudo.webp'" style="height: 80px; object-fit: contain; margin-bottom: 15px;">
            <h2 style="color:#ff6666; font-size: 1.4em;"><span class="clickable" onclick="${teamLink(t2)}">${cffCompareEscape(t2.short)}</span></h2>
            <p style="font-size: 0.9em;">${t2.source === 'SEA' ? 'FFWS SEA' : `Posição: <strong style="color:var(--accent)">${cffCompareEscape(t2.posicao)}º</strong>`}</p>
        </div>
        <div style="grid-column: span 2; background:var(--panel-bg); border-radius:8px; padding:15px; border:1px solid var(--border);">
            ${buildRow(metricLabel, metricValue(t1), metricValue(t2), metricFormat)}
            ${metric === 'media' ? buildRow('Abates totais', t1.abates, t2.abates, v => Math.round(Number(v || 0))) : ''}
            ${buildRow('Quedas', t1.quedas, t2.quedas, v => Math.round(Number(v || 0)), { neutral: true })}
            ${buildRow('Pts/Queda', t1.pontos !== null && t1.quedas ? t1.pontos / t1.quedas : null, t2.pontos !== null && t2.quedas ? t2.pontos / t2.quedas : null, v => v === null ? '-' : Number(v || 0).toFixed(2))}
            ${buildRow('Pontos', t1.pontos, t2.pontos, dash)}
            ${buildRow('Booyahs', t1.booyah, t2.booyah, dash)}
        </div>`;
}


function findSEAStatHeader(headers, patterns) {
    return (headers || []).find(header => {
        const h = normalizeSEAKey(header);
        return patterns.some(pattern => h === pattern || h.includes(pattern));
    }) || null;
}

function getSEAComparePlayerId(rawName, index) {
    const teamSigla = getSEAPlayerTeamSigla(rawName) || 'SEA';
    return `${teamSigla}__${cleanSEAPlayerName(rawName) || index}`;
}

function buildSEAComparePlayers() {
    if (!seaAbatesParsed?.headers?.length || !seaAbatesParsed?.rows?.length) return [];

    const headers = seaAbatesParsed.headers;
    const playerHeader = findSEAHeader(headers, shouldCleanSEAPlayerColumn) || headers[0];
    const teamHeader = findSEAHeader(headers, shouldConvertSEATeamColumn);
    const roleHeader = findSEAHeader(headers, shouldConvertSEAFunctionColumn);
    const killsHeader = findSEAAbatesHeader(headers);
    const damageHeader = findSEAStatHeader(headers, ['DANO', 'DAMAGE', 'DMG']);
    const assistsHeader = findSEAStatHeader(headers, ['ASSISTENCIAS', 'ASSISTENCIA', 'ASSISTS', 'ASSIST']);
    const dropsHeader = findSEAStatHeader(headers, ['QUEDAS', 'QUEDA', 'Q', 'GP', 'PARTIDAS', 'MATCHES']);
    const mvpHeader = findSEAStatHeader(headers, ['MVP', 'MVPS']);

    const players = seaAbatesParsed.rows.map((row, index) => {
        const rawName = row[playerHeader] || '';
        const jogador = cleanSEAPlayerName(rawName);
        const equipe = getSEARowTeamName(row, playerHeader, teamHeader) || 'SEA';
        const abates = killsHeader ? parseSEANumber(row[killsHeader]) : 0;
        const dano = damageHeader ? parseSEANumber(row[damageHeader]) : 0;
        const assists = assistsHeader ? parseSEANumber(row[assistsHeader]) : 0;
        const quedas = dropsHeader ? parseSEANumber(row[dropsHeader]) : 0;
        const mvp = mvpHeader ? parseSEANumber(row[mvpHeader]) : 0;
        const role = roleHeader ? getSEAFunctionName(row[roleHeader]) : 'Rush';

        return {
            id: getSEAComparePlayerId(rawName, index),
            jogador,
            rawJogador: rawName,
            equipe,
            abates,
            dano,
            assists,
            quedas,
            mvp,
            role,
            region: 'SEA',
            isSEA: true
        };
    }).filter(p => p.jogador);

    const setRank = (metric, rankKey) => {
        [...players].sort((a, b) => (b[metric] || 0) - (a[metric] || 0)).forEach((player, index) => {
            player[rankKey] = index + 1;
        });
    };

    setRank('abates', 'rankKills');
    setRank('dano', 'rankDmg');
    setRank('assists', 'rankAssists');
    setRank('mvp', 'rankMvp');

    return players;
}

function getSEAComparePlayerById(id) {
    return buildSEAComparePlayers().find(p => p.id === id) || null;
}

function createSEAPlayerCardHTML(p, scale = 1) {
    const safeName = escapeHtml(p.jogador || '-');
    const role = escapeHtml((p.role || 'RUSH').toUpperCase());
    const kills = p.abates || 0;
    const assists = p.assists || 0;
    const danoK = ((p.dano || 0) / 1000).toFixed(1) + 'K';
    const quedas = p.quedas || 0;
    const accentColor = '#00c8ff';
    const teamLogo = logos[p.equipe] || 'escudo.webp';
    const marginStyle = scale !== 1 ? `transform: scale(${scale}); margin: -15px;` : `margin: 0 auto;`;

    return `
        <div style="cursor:default; width: 280px; height: 420px; background: #000; border: 3px solid ${accentColor}; border-radius: 15px; position: relative; overflow: hidden; font-family: sans-serif; box-shadow: 0 0 30px ${accentColor}55; ${marginStyle}">
            <div style="position: absolute; inset: 0; background: radial-gradient(circle at 30% 30%, #0b2941, #000); opacity: 0.92;"></div>

            <div style="position:absolute; top:14px; right:14px; z-index:8; background:rgba(0,200,255,0.14); border:1px solid rgba(0,200,255,0.55); color:#fff; padding:5px 10px; border-radius:999px; font-size:0.78em; font-weight:900; letter-spacing:1px;">
                🌏 SEA
            </div>

            <div style="position: absolute; top: 40px; left: 25px; z-index: 4; text-align: center; color: ${accentColor};">
                <div style="font-size: 48px; font-weight: 900; line-height: 0.85;">INT</div>
                <div style="font-size: 22px; font-weight: bold; margin-top: 5px; text-transform:uppercase;">${role}</div>
                <div style="margin: 15px auto; width: 40px; height: 2px; background: ${accentColor}; opacity: 0.6;"></div>
                <div style="font-size: 34px; line-height:1; filter: drop-shadow(0 0 8px rgba(0,200,255,.55));">🌏</div>
                <img src="${teamLogo}" onerror="this.src='escudo.webp'" style="width: 50px; height: 50px; object-fit: contain; display: block; margin: 10px auto;">
            </div>

            <img src="silhueta.webp" onerror="this.src='silhueta.webp'" style="position: absolute; top: 20px; right: -30px; height: 260px; z-index: 2; -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 100%); opacity: 0.95;">

            <div style="position: absolute; bottom: 0; width: 100%; height: 185px; background: linear-gradient(transparent, #000 35%); z-index: 3; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 12px;">
                <div style="width: 100%; text-align: center; margin-bottom: 8px;">
                    <div style="margin: 0 auto; width: 85%; height: 1px; background: linear-gradient(90deg, transparent, ${accentColor}, transparent);"></div>
                    <div style="color: #fff; font-size: 24px; font-weight: 900; text-transform: uppercase; padding: 6px 0;">${safeName}</div>
                    <div style="margin: 0 auto; width: 85%; height: 1px; background: linear-gradient(90deg, transparent, ${accentColor}, transparent);"></div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 2px; color: #fff; width: 100%; align-items: center; text-transform: uppercase;">
                    <div style="font-size: 13px; font-weight: bold;"><span style="font-weight: 900; color: ${accentColor}; font-size: 16px;">${kills}</span> ABATES</div>
                    <div style="font-size: 13px; font-weight: bold;"><span style="font-weight: 900; color: ${accentColor}; font-size: 16px;">${assists}</span> ASSISTÊNCIAS</div>
                    <div style="font-size: 13px; font-weight: bold;"><span style="font-weight: 900; color: ${accentColor}; font-size: 16px;">${danoK}</span> DANO</div>
                    <div style="font-size: 13px; font-weight: bold;"><span style="font-weight: 900; color: ${accentColor}; font-size: 16px;">${quedas}</span> QUEDAS</div>
                </div>
            </div>
        </div>`;
}

function renderComparePlayers() {
    const region = document.getElementById('comp-player-region')?.value || 'nacional';
    const result = document.getElementById('compare-players-result');
    let p1, p2;

    if (region === 'internacional') {
        if (!seaDataLoaded && !seaAbatesParsed.rows.length) {
            if (result) result.innerHTML = '<div class="compare-box" style="grid-column:1/-1; color:var(--text-muted);">Escolha INTERNACIONAL e aguarde carregar os dados da FFWS SEA.</div>';
            return;
        }
        p1 = getSEAComparePlayerById(document.getElementById('comp-p1').value);
        p2 = getSEAComparePlayerById(document.getElementById('comp-p2').value);
    } else if (region === 'brxgringos') {
        if (!seaDataLoaded && !seaAbatesParsed.rows.length) {
            if (result) result.innerHTML = '<div class="compare-box" style="grid-column:1/-1; color:var(--text-muted);">Escolha BR X GRINGOS e aguarde carregar os dados da FFWS SEA.</div>';
            return;
        }
        p1 = db.players.find(x => x.jogador === document.getElementById('comp-p1').value);
        p2 = getSEAComparePlayerById(document.getElementById('comp-p2').value);
    } else {
        p1 = db.players.find(x => x.jogador === document.getElementById('comp-p1').value);
        p2 = db.players.find(x => x.jogador === document.getElementById('comp-p2').value);
    }

    if(!p1 || !p2 || !result) return;

    const getCardHtml = (p) => p?.isSEA ? createSEAPlayerCardHTML(p, 1) : createPlayerCardHTML(p, 1);
    const safeRank = (rank) => rank ? ` <span class="rank-badge" style="font-size:0.7em">#${rank}</span>` : '';

    const buildRow = (label, v1, v2, r1, r2, formatFn = v=>v) => `
        <div class="stat-row">
            <div class="stat-val ${Number(v1)>Number(v2)?'winner':(Number(v1)<Number(v2)?'loser':'')}">${formatFn(v1)}${safeRank(r1)}</div>
            <div class="stat-label">${label}</div>
            <div class="stat-val ${Number(v2)>Number(v1)?'winner':(Number(v2)<Number(v1)?'loser':'')}">${formatFn(v2)}${safeRank(r2)}</div>
        </div>`;

    const kq1 = (p1.quedas || 0) > 0 ? (p1.abates / p1.quedas) : 0;
    const kq2 = (p2.quedas || 0) > 0 ? (p2.abates / p2.quedas) : 0;
    const playerMetric = document.getElementById('comp-player-metric')?.value || 'total';
    const primaryLabel = playerMetric === 'media' ? 'Média K/Q' : 'Abates';
    const primaryValue1 = playerMetric === 'media' ? kq1 : (p1.abates || 0);
    const primaryValue2 = playerMetric === 'media' ? kq2 : (p2.abates || 0);
    const primaryRank1 = playerMetric === 'media' ? null : p1.rankKills;
    const primaryRank2 = playerMetric === 'media' ? null : p2.rankKills;
    const primaryFormat = playerMetric === 'media' ? v => Number(v || 0).toFixed(2) : v => Math.round(Number(v || 0));

    result.innerHTML = `
        <div class="compare-box" style="background:transparent; border:none; padding:0;">
            ${getCardHtml(p1)}
        </div>
        <div class="compare-box" style="background:transparent; border:none; padding:0;">
            ${getCardHtml(p2)}
        </div>
        <div style="grid-column: span 2; background:var(--panel-bg); border-radius:8px; padding:15px; border:1px solid var(--border);">
            ${buildRow(primaryLabel, primaryValue1, primaryValue2, primaryRank1, primaryRank2, primaryFormat)}
            ${playerMetric === 'media' ? buildRow('Abates totais', p1.abates || 0, p2.abates || 0, p1.rankKills, p2.rankKills, v => Math.round(Number(v || 0))) : buildRow('Kills/Queda', kq1, kq2, null, null, v => Number(v || 0).toFixed(2))}
            ${buildRow('Dano Total', p1.dano || 0, p2.dano || 0, p1.rankDmg, p2.rankDmg)}
            ${buildRow('Assistências', p1.assists || 0, p2.assists || 0, p1.rankAssists, p2.rankAssists)}
            ${buildRow('MVPs', p1.mvp || 0, p2.mvp || 0, p1.rankMvp, p2.rankMvp)}
        </div>`;
}
