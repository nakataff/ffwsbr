// GRÁFICO COMPARATIVO DE MÚLTIPLAS EQUIPES
let selectedCompareTeams = [];
let multiTeamChartInstance = null;

// Uma paleta de cores fortes para não confundir as linhas
const multiChartColors = ['#00c8ff', '#ff4444', '#ffd700', '#4caf50', '#a020f0'];

function buildMultiTeamFilters() {
    let container = document.getElementById('multi-team-filters');
    if(!container) return;

    let html = '';
    let sortedTeams = [...db.teams].sort((a,b) => a.equipe.localeCompare(b.equipe));

    // Auto-seleciona os 2 primeiros times do ranking geral para o gráfico não vir vazio
    if(selectedCompareTeams.length === 0 && sortedTeams.length >= 2) {
        let topTeams = [...db.teams].sort((a,b) => b.pontos - a.pontos).slice(0, 2);
        selectedCompareTeams = topTeams.map(t => t.equipe);
    }

    sortedTeams.forEach(t => {
        let sName = shortNames[t.equipe] || t.equipe;
        let isActive = selectedCompareTeams.includes(t.equipe);

        // Estilo especial para os selecionados (pega a cor da linha deles)
        let idx = selectedCompareTeams.indexOf(t.equipe);
        let colorStyle = isActive ? `background-color: ${multiChartColors[idx]}; color: #000; font-weight: bold; border-color: ${multiChartColors[idx]};` : '';

        html += `<div class="day-chip" style="${colorStyle}" onclick="toggleCompareTeam('${t.equipe}')">${sName}</div>`;
    });

    container.innerHTML = html;
}

function toggleCompareTeam(teamName) {
    let idx = selectedCompareTeams.indexOf(teamName);
    if (idx > -1) {
        // Remove se já estiver selecionado
        selectedCompareTeams.splice(idx, 1);
    } else {
        // Adiciona limitando a 5 para o gráfico não virar uma bagunça
        if(selectedCompareTeams.length >= 5) {
            alert('Você pode selecionar no máximo 5 equipes simultâneas para manter a clareza do gráfico.');
            return;
        }
        selectedCompareTeams.push(teamName);
    }

    buildMultiTeamFilters();
    renderMultiTeamChart();
}

function renderMultiTeamChart() {
    let ctx = document.getElementById('multi-team-evolution-chart');
    if (!ctx) return;

    let metric = document.getElementById('multi-chart-metric').value;
    let isReverse = false;

    // Descobre todos os dias para criar o Eixo X
    let allDays = new Set();

    if (metric === 'pos_geral_dia') {
        // Se for Posição Geral, pega TODOS os dias do campeonato
        for (let i = 1; i <= TOTAL_DIAS; i++) {
            allDays.add(i);
        }
    } else {
        // Se for Pontos ou Kills, pega só os dias que os times selecionados jogaram
        selectedCompareTeams.forEach(tName => {
            if(db.teamDaily[tName]) {
                db.teamDaily[tName].forEach(d => allDays.add(d.dia));
            }
        });
    }

    let sortedDays = Array.from(allDays).sort((a,b) => a - b);
    let labels = sortedDays.map(d => `Dia ${d}`);
    let datasets = [];

    // Cria as linhas do gráfico para cada equipe selecionada
    selectedCompareTeams.forEach((tName, index) => {
        if (!db.teamDaily[tName]) return;

        let teamColor = multiChartColors[index];
        let dataPoints = [];

        sortedDays.forEach(d => {
            let dInfo = db.teamDaily[tName].find(x => x.dia === d);

            if (metric === 'pontos_dia') {
                dataPoints.push(dInfo ? dInfo.pontos : null);
            } else if (metric === 'kills_dia') {
                dataPoints.push(dInfo ? dInfo.abates : null);
            } else if (metric === 'pos_geral_dia') {
                isReverse = true;
                // Calcula a posição GERAL até aquele dia, MESMO SE O TIME NÃO JOGOU!
                dataPoints.push(getGeneralPositionUpToDay(d, tName));
            }
        });

        datasets.push({
            label: shortNames[tName] || tName,
            data: dataPoints,
            borderColor: teamColor,
            backgroundColor: teamColor + '33', // Transparência embaixo da linha
            borderWidth: 3,
            pointBackgroundColor: teamColor,
            pointBorderColor: '#000',
            pointRadius: 5,
            pointHoverRadius: 8,
            tension: 0.2,
            spanGaps: true // Conecta a linha mesmo se faltar dado em um dia
        });
    });

    // ... Resto do código continua igualzinho (multiTeamChartInstance.destroy(), etc) ...

    // Destroi o gráfico anterior caso exista
    if (multiTeamChartInstance) {
        multiTeamChartInstance.destroy();
    }

    // Renderiza o novo
    multiTeamChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
options: {
            responsive: true,
            maintainAspectRatio: false,
            // Adicione clip: false para impedir que as bolinhas sejam cortadas
            clip: false,
            layout: {
                padding: {
                    left: 10,
                    right: 15,
                    top: 20,    // <-- ADICIONADO: Respiro no topo
                    bottom: 10  // <-- ADICIONADO: Respiro embaixo
                }
            },
            scales: {
                y: {
                    reverse: isReverse,
                    min: isReverse ? 1 : 0,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#888',
                        font: { weight: 'bold' },
                        precision: 0,
                        stepSize: isReverse ? 1 : undefined
                    }
                },
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#888' }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#fff', font: { weight: 'bold', size: 13 }, usePointStyle: true, boxWidth: 10 }
                },
                tooltip: { backgroundColor: '#0d1220', titleColor: '#fff', bodyColor: '#fff', borderColor: '#333', borderWidth: 1, padding: 12 }
            }
        }
    });

    if (typeof updateChartSummary === 'function') {
        const summaryItems = datasets.map(ds => {
            const values = (ds.data || []).filter(v => v !== null && v !== undefined);
            const latest = values.length ? values[values.length - 1] : '-';
            return { label: ds.label, value: latest };
        });
        const metricLabel = metric === 'pos_geral_dia' ? 'Posição atual no gráfico' : (metric === 'pontos_dia' ? 'Último dia de pontos' : 'Último dia de abates');
        updateChartSummary('multi-team-chart-summary', metricLabel, summaryItems);
    }
}

// MERCADO DA BOLA

// SUBSTITUA pelo link TSV publicado da sua aba "mercado" no Google Sheets
// Colunas esperadas (ordem): jogador | foto | status | time_origem | escudo_origem | time_destino | escudo_destino | ultima_atualizacao
// Onde "status" é: rumor / negociando / fechado / melou
const MERCADO_TSV_URL = window.CFF_CONFIG.sheets.mercado;

let mercadoData = [];
let mercadoFilter = 'all';
let mercadoHasLoaded = false;
let mercadoLoadPromise = null;
// Votos salvos localmente por sessão: { "NomeJogador": { up: N, down: N, voted: 'up'|'down'|null } }
let mercadoVotes = JSON.parse(sessionStorage.getItem('mercadoVotes') || '{}');

/**
 * Resolve o escudo de um time.
 * Prioridade:
 *   1. Valor direto da planilha (link http/https ou caminho de arquivo)
 *   2. Busca automática pelo nome do time no objeto `logos` já usado pelo site
 *   3. Fallback para 'escudo.webp'
 */
function resolveEscudo(escudoCell, nomeTime) {
    // 1. Se a planilha forneceu algum valor, usa direto
    if (escudoCell && escudoCell.trim()) {
        return escudoCell.trim();
    }
    // 2. Busca no objeto `logos` pelo nome do time (case-insensitive)
    if (nomeTime && typeof logos !== 'undefined') {
        const nomeLower = nomeTime.trim().toUpperCase();
        // Tenta exato primeiro
        if (logos[nomeLower]) return logos[nomeLower];
        // Tenta match parcial/case-insensitive
        const chave = Object.keys(logos).find(k => k.toUpperCase() === nomeLower);
        if (chave) return logos[chave];
    }
    // 3. Fallback
    return 'escudo.webp';
}

/**
 * Verifica se um time tem página clicável (time ativo ou histórico).
 * Retorna o onclick adequado ou null.
 */
function resolveTeamClick(nomeTime) {
    if (!nomeTime || nomeTime === '?' || nomeTime === 'Sem Clube') return null;
    const nomeUpper = nomeTime.trim().toUpperCase();
    // Time ativo (tem página de perfil)
    if (typeof db !== 'undefined' && db.teams) {
        const ativo = db.teams.find(t => t.equipe.trim().toUpperCase() === nomeUpper);
        if (ativo) return `openTeamProfile('${ativo.equipe.replace(/'/g, "\\'")}')`;
    }
    // Time histórico (tem página em outras-equipes)
    if (typeof dbResults !== 'undefined') {
        const hist = Object.keys(dbResults).find(k => k.trim().toUpperCase() === nomeUpper);
        if (hist) return `openOutraEquipe('${hist.replace(/'/g, "\\'")}')`;
    }
    return null;
}

function normalizeMercadoPlayerKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/0/g, 'O')
        .replace(/[^a-z0-9]/gi, '')
        .toUpperCase();
}


function escapeMercadoHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function splitMercadoPlayers(value) {
    return String(value || '')
        .split(',')
        .map(name => name.trim())
        .filter(Boolean);
}

function getMercadoPlayers(d) {
    const players = splitMercadoPlayers(d && d.jogador);
    return players.length ? players : [String((d && d.jogador) || '').trim()].filter(Boolean);
}

function resolveMercadoPlayerPhotos(d) {
    const players = getMercadoPlayers(d);
    const directPhotos = String((d && d.foto) || '')
        .split(',')
        .map(x => x.trim())
        .filter(Boolean);

    return players.map((name, index) => {
        const direct = directPhotos[index] || (directPhotos.length === 1 && players.length === 1 ? directPhotos[0] : '');
        return {
            name,
            photo: resolveMercadoPlayerPhoto(name, direct)
        };
    });
}

function renderMercadoAvatarStack(d, context = 'full') {
    const items = resolveMercadoPlayerPhotos(d);
    const isMulti = items.length > 1;
    const maxVisible = context === 'home' ? 4 : 5;
    const visible = items.slice(0, maxVisible);
    const extra = items.length - visible.length;
    const alt = escapeMercadoHtml(items.map(x => x.name).join(', '));

    if (!isMulti) {
        const item = visible[0] || { name: String((d && d.jogador) || ''), photo: 'silhueta.png' };
        const cls = context === 'home' ? 'home-mercado-mini-avatar' : 'mercado-card-avatar';
        return `<img class="${cls}" src="${escapeMercadoHtml(item.photo)}" onerror="this.src='silhueta.png'" alt="${escapeMercadoHtml(item.name)}">`;
    }

    const cls = context === 'home' ? 'home-mercado-avatar-stack' : 'mercado-avatar-stack';
    const imgs = visible.map((item, idx) => `
        <img src="${escapeMercadoHtml(item.photo)}" onerror="this.src='silhueta.png'" alt="${escapeMercadoHtml(item.name)}" style="--i:${idx};">`).join('');
    const more = extra > 0 ? `<span class="mercado-avatar-extra">+${extra}</span>` : '';
    return `<div class="${cls}" title="${alt}" aria-label="${alt}">${imgs}${more}</div>`;
}

function hasMercadoPlayerProfile(playerName) {
    const nomeSafe = String(playerName || '').trim().toLowerCase();
    if (!nomeSafe) return false;
    return (typeof db !== 'undefined' && db.players && db.players.some(x => x.jogador.toLowerCase() === nomeSafe || checkNameMatch(x.jogador, playerName))) ||
        (typeof lbffData !== 'undefined' && Object.keys(lbffData).some(name => name.toLowerCase() === nomeSafe || checkNameMatch(name, playerName)));
}

function renderMercadoPlayerNames(d, mode = 'full') {
    const players = getMercadoPlayers(d);
    const fullTitle = escapeMercadoHtml(players.join(', '));

    if (mode === 'home') {
        const maxNames = 2;
        const shown = players.slice(0, maxNames).map(escapeMercadoHtml).join(', ');
        const extra = players.length > maxNames ? ` +${players.length - maxNames}` : '';
        return `<span title="${fullTitle}">${shown}${extra}</span>`;
    }

    const html = players.map(name => {
        const safeName = escapeMercadoHtml(name);
        if (hasMercadoPlayerProfile(name)) {
            return `<span class="mercado-player-name-link" onclick="${_safePPAttr(name)}" title="Ver perfil de ${safeName}">${safeName}</span>`;
        }
        return `<span>${safeName}</span>`;
    }).join('<span class="mercado-name-sep">,</span> ');

    return `<div class="mercado-player-name-list ${players.length > 1 ? 'is-multi' : ''}" title="${fullTitle}">${html}</div>`;
}

function resolveMercadoPlayerPhoto(playerName, sheetPhoto) {
    const directPhoto = String(sheetPhoto || '').trim();
    if (directPhoto) return directPhoto;

    if (typeof playerPhotos === 'undefined' || !playerPhotos) return 'silhueta.png';

    const wantedRaw = String(playerName || '').trim();
    if (!wantedRaw) return 'silhueta.png';

    const keys = Object.keys(playerPhotos);
    const aliases = [];

    if (typeof getPlayerAliasList === 'function') {
        getPlayerAliasList(wantedRaw).forEach(name => aliases.push(name));
    }
    if (typeof getCanonicalPlayerName === 'function') {
        aliases.push(getCanonicalPlayerName(wantedRaw));
    }
    aliases.push(wantedRaw);

    const uniqueAliases = [...new Set(aliases.filter(Boolean))];

    for (const alias of uniqueAliases) {
        const exactKey = keys.find(k => k.toLowerCase().trim() === String(alias).toLowerCase().trim());
        if (exactKey && playerPhotos[exactKey]) return playerPhotos[exactKey];
    }

    if (typeof checkNameMatch === 'function') {
        const matchKey = keys.find(k => checkNameMatch(k, wantedRaw) || uniqueAliases.some(alias => checkNameMatch(k, alias)));
        if (matchKey && playerPhotos[matchKey]) return playerPhotos[matchKey];
    }

    const wantedKey = normalizeMercadoPlayerKey(wantedRaw);
    const wantedNoDigits = wantedKey.replace(/\d+$/g, '');

    let looseKey = keys.find(k => normalizeMercadoPlayerKey(k) === wantedKey);
    if (looseKey && playerPhotos[looseKey]) return playerPhotos[looseKey];

    if (wantedNoDigits.length >= 4) {
        looseKey = keys.find(k => {
            const key = normalizeMercadoPlayerKey(k);
            const keyNoDigits = key.replace(/\d+$/g, '');
            return keyNoDigits === wantedNoDigits || key.startsWith(wantedNoDigits) || wantedNoDigits.startsWith(keyNoDigits);
        });
        if (looseKey && playerPhotos[looseKey]) return playerPhotos[looseKey];
    }

    return 'silhueta.png';
}

async function loadMercado() {
    if (mercadoHasLoaded) {
        renderMercado();
        renderHomeMercadoResumo();
        return mercadoData;
    }
    if (mercadoLoadPromise) return mercadoLoadPromise;

    mercadoLoadPromise = (async () => {
    try {
        const res = await fetch(`${MERCADO_TSV_URL}&nocache=${Date.now()}`);
        if (!res.ok) throw new Error('Falha ao buscar planilha');
        const text = await res.text();
        const lines = text.trim().split('\n');

        mercadoData = lines.slice(1).map(line => {
            const cols = line.split('\t').map(c => c.trim().replace(/\r/g, ''));
            return {
                jogador:       cols[0] || '',
                foto:          cols[1] || '',
                status:        (cols[2] || 'rumor').toLowerCase(),
                timeOrigem:    cols[3] || '',
                escudoOrigem:  cols[4] || '',
                timeDestino:   cols[5] || '',
                escudoDestino: cols[6] || '',
                atualizacao:   cols[7] || '',
                role:          cols[8] || '', // <-- CAPTURA A ROLE DA COLUNA I
            };
        }).filter(d => d.jogador);

        // --- LÓGICA PARA PREENCHER O FILTRO DE EQUIPES ---
        let uniqueTeams = new Set();
        mercadoData.forEach(d => {
            if(d.timeOrigem && d.timeOrigem !== '?' && d.timeOrigem !== 'Sem Clube') uniqueTeams.add(d.timeOrigem);
            if(d.timeDestino && d.timeDestino !== '?' && d.timeDestino !== 'Sem Clube') uniqueTeams.add(d.timeDestino);
        });

const teamSelect = document.getElementById('mercado-team-filter');
        if (teamSelect) {
            let selectHtml = '<option value="all">Todas as Equipes</option>';
            // Transforma o Set em Array, ordena alfabeticamente e cria as opções
            [...uniqueTeams].sort().forEach(t => {
                selectHtml += `<option value="${t}">${t}</option>`;
            });
            teamSelect.innerHTML = selectHtml;
        }

        if (typeof loadPhotos === 'function') {
            try { await loadPhotos(); } catch (e) { console.warn('[Mercado] Fotos não carregaram antes do resumo:', e); }
        }

        mercadoHasLoaded = true;
        renderMercado();
        renderHomeMercadoResumo();

        // ✅ CHAMA O FIREBASE PARA ATUALIZAR COM OS VOTOS GLOBAIS
        if (typeof window.fbLoadVotes === 'function') {
            window.fbLoadVotes();
        }

    } catch (e) {
        const mercadoList = document.getElementById('mercado-list');
        if (mercadoList) {
            mercadoList.innerHTML =
                `<div class="mercado-empty">⚠️ Não foi possível carregar os dados.<br><small style="color:#555">Verifique a conexão ou o link da planilha.</small></div>`;
        }
        const homeList = document.getElementById('home-mercado-list');
        if (homeList) {
            homeList.innerHTML = '<div class="home-mercado-empty">⚠️ Não foi possível carregar o mercado agora.</div>';
        }
        console.error("Erro ao carregar mercado:", e);
    } finally {
        mercadoLoadPromise = null;
    }
    return mercadoData;
    })();

    return mercadoLoadPromise;
}

function filterMercado(el, filter) {
    mercadoFilter = filter;
    document.querySelectorAll('.mercado-filter-chip').forEach(chip => {
        chip.classList.remove('active', 'active-rumor', 'active-negociando', 'active-fechado', 'active-melou');
    });
    if (filter === 'all') {
        el.classList.add('active');
    } else {
        el.classList.add('active-' + filter);
    }
    renderMercado();
}

function renderMercado() {
    const list = document.getElementById('mercado-list');
    if (!list) return;

    // Puxa o valor do filtro de equipe
    const teamFilter = document.getElementById('mercado-team-filter')?.value || 'all';

    // Filtra pelo Status (Rumor, Fechado, etc) E pela Equipe (Origem ou Destino)
    const filtered = mercadoData.filter(d => {
        const passStatus = mercadoFilter === 'all' || d.status === mercadoFilter;
        const passTeam = teamFilter === 'all' ||
                         (d.timeOrigem && d.timeOrigem.toUpperCase() === teamFilter.toUpperCase()) ||
                         (d.timeDestino && d.timeDestino.toUpperCase() === teamFilter.toUpperCase());
        return passStatus && passTeam;
    });

    if (!filtered.length) {
        list.innerHTML = '<div class="mercado-empty">Nenhuma negociação encontrada com estes filtros no momento.</div>';
        return;
    }

    const statusLabels = { rumor: 'Rumor', negociando: 'Negociando', fechado: 'Fechado', melou: 'Melou' };

    list.innerHTML = filtered.map((d, idx) => {
        const key = d.jogador;
        if (!mercadoVotes[key]) mercadoVotes[key] = { up: 0, down: 0, voted: null };
        const v = mercadoVotes[key];
        const total = v.up + v.down;
        const pct = total ? Math.round((v.up / total) * 100) : 50;

        const avatarHtml = renderMercadoAvatarStack(d, 'full');
        const escudoOrigem = resolveEscudo(d.escudoOrigem, d.timeOrigem);
        const escudoDestino = resolveEscudo(d.escudoDestino, d.timeDestino);

        const hasOrigem = d.timeOrigem && d.timeOrigem.trim() !== '';
        const hasDestino = d.timeDestino && d.timeDestino.trim() !== '' && d.timeDestino !== '?';

        const nomeOrigem = hasOrigem ? d.timeOrigem : 'Sem Clube';
        const nomeDestino = hasDestino ? d.timeDestino : 'Sem Clube';

        const clickOrigem = resolveTeamClick(d.timeOrigem);
        const clickDestino = resolveTeamClick(d.timeDestino);
        const clubeOrigemAttr = clickOrigem
            ? `onclick="${clickOrigem}" style="cursor:pointer;" title="Ver ${nomeOrigem}"`
            : '';
        const clubeDestinoAttr = clickDestino
            ? `onclick="${clickDestino}" style="cursor:pointer;" title="Ver ${nomeDestino}"`
            : '';

        let arrowClass = 'arrow-white';
        if (!hasOrigem && hasDestino) arrowClass = 'arrow-green';       // sem clube → time
        else if (hasOrigem && !hasDestino) arrowClass = 'arrow-red';    // time → sem clube
        else arrowClass = 'arrow-white';                                 // time → time
        const votedUpClass = v.voted === 'up' ? 'voted-up' : '';
        const votedDownClass = v.voted === 'down' ? 'voted-down' : '';
        const safeId = key.replace(/[\s.#$/[\]]/g, '_');
        const nomeHtml = renderMercadoPlayerNames(d, 'full');
        return `
        <div class="mercado-card status-${d.status}" data-status="${d.status}">
            ${avatarHtml}

            <div class="mercado-card-status">
                <img class="mercado-status-icon"
                     src="${d.status}.webp"
                     onerror="this.style.display='none'"
                     alt="${d.status}">
                <span class="mercado-status-label">${statusLabels[d.status] || d.status}</span>
            </div>

            <div class="mercado-card-info">
                <div class="mercado-card-name">${nomeHtml}</div>
                <div class="mercado-card-meta">
                    ${d.role ? `<span style="color: var(--accent); font-weight: 800; font-size: 0.9em; text-transform: uppercase;">${d.role}</span><br>` : ''}
                    ${d.atualizacao ? `Atualizado: <span>${d.atualizacao}</span>` : ''}
                </div>
            </div>

            <div class="mercado-card-clubs">
                <div class="mercado-club" ${clubeOrigemAttr}>
                    <img src="${escudoOrigem}" onerror="this.src='escudo.webp'" alt="${nomeOrigem}">
                    <span class="mercado-club-name">${nomeOrigem}</span>
                </div>
                <img class="mercado-arrow ${arrowClass}" src="seta.webp" alt="→">
                <div class="mercado-club" ${clubeDestinoAttr}>
                    <img src="${escudoDestino}" onerror="this.src='escudo.webp'" alt="${nomeDestino}">
                    <span class="mercado-club-name">${nomeDestino}</span>
                </div>
            </div>

<div class="mercado-card-votes">
    <button class="vote-btn ${votedUpClass}" onclick="voteMercado(event, '${key}', 'up')">
        <span class="vote-icon">👍</span> <span id="vu-${safeId}">${v.up > 0 ? v.up : ''}</span>
    </button>

    <div class="vote-bar-wrap">
        <div class="vote-bar-fill" id="vbar-${safeId}" style="width:${pct}%"></div>
    </div>

    <button class="vote-btn ${votedDownClass}" onclick="voteMercado(event, '${key}', 'down')">
        <span class="vote-icon">👎</span> <span id="vd-${safeId}">${v.down > 0 ? v.down : ''}</span>
    </button>
</div>
        </div>`;
    }).join('');
}

function escapeMercadoHomeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getMercadoStatusLabel(status) {
    const labels = { rumor: 'Rumor', negociando: 'Negociando', fechado: 'Fechado', melou: 'Melou' };
    return labels[status] || status || 'Status';
}

function renderHomeMercadoResumo() {
    const list = document.getElementById('home-mercado-list');
    if (!list) return;

    const ultimas = mercadoData.slice(0, 5);
    if (!ultimas.length) {
        list.innerHTML = '<div class="home-mercado-empty">Nenhuma transferência cadastrada.</div>';
        return;
    }

    list.innerHTML = ultimas.map(d => {
        const avatarHtml = renderMercadoAvatarStack(d, 'home');
        const jogador = escapeMercadoHomeHtml(getMercadoPlayers(d).join(', '));
        const jogadorResumo = renderMercadoPlayerNames(d, 'home');
        const origem = escapeMercadoHomeHtml(d.timeOrigem || 'Sem Clube');
        const destino = escapeMercadoHomeHtml((d.timeDestino && d.timeDestino !== '?') ? d.timeDestino : 'Sem Clube');
        const role = d.role ? ` · ${escapeMercadoHomeHtml(d.role)}` : '';
        const status = escapeMercadoHomeHtml((d.status || 'rumor').toLowerCase());
        const statusLabel = escapeMercadoHomeHtml(getMercadoStatusLabel(d.status));

        return `
            <div class="home-mercado-mini-card" onclick="navigate('mercado')" title="Abrir Mercado da Bala">
                ${avatarHtml}
                <div class="home-mercado-mini-main">
                    <div class="home-mercado-mini-name">${jogadorResumo}${role}</div>
                    <div class="home-mercado-mini-route">${origem} → ${destino}</div>
                </div>
                <div class="home-mercado-mini-status status-${status}">
                    <img src="${status}.webp" onerror="this.style.display='none'" alt="${statusLabel}">
                    <span>${statusLabel}</span>
                </div>
            </div>`;
    }).join('');
}

function voteMercado(e, key, dir) {
    e.stopPropagation();
    if (!mercadoVotes[key]) mercadoVotes[key] = { up: 0, down: 0, voted: null };
    const v = mercadoVotes[key];
    const previousDir = v.voted;

    // Lógica matemática do voto local
    if (v.voted === dir) {
        // Clicou de novo no mesmo = tira o voto (toggle off)
        v[dir]--;
        v.voted = null;
    } else {
        if (v.voted && v.voted !== dir) {
            // Tinha votado no outro, então remove o voto antigo
            v[v.voted]--;
        }
        // Adiciona o voto novo
        v[dir]++;
        v.voted = dir;
    }

    // Salva no navegador do usuário
    sessionStorage.setItem('mercadoVotes', JSON.stringify(mercadoVotes));

    // A MÁGICA QUE FALTAVA: Chama a função do Firebase lá de baixo!
    if (typeof window.fbVote === 'function') {
        window.fbVote(key, v.voted, previousDir);
    }

    // Atualiza a barrinha e os números na hora (Feedback visual imediato)
    const safeKey = key.replace(/[\s.#$/[\]]/g, '_'); // Limpeza padrão do Firebase
    const total = v.up + v.down;
    const pct = total ? Math.round((v.up / total) * 100) : 50;

    const bar = document.getElementById(`vbar-${safeKey}`);
    const vuEl = document.getElementById(`vu-${safeKey}`);
    const vdEl = document.getElementById(`vd-${safeKey}`);

    if (bar) bar.style.width = pct + '%';
    // Corrigido de "data.up" para "v.up"
    if (vuEl) vuEl.textContent  = v.up   > 0 ? v.up   : '';
    if (vdEl) vdEl.textContent  = v.down > 0 ? v.down : '';

    // Troca as cores dos botões
    const card = e.target.closest('.mercado-card');
    if (card) {
        card.querySelectorAll('.vote-btn').forEach(btn => btn.classList.remove('voted-up', 'voted-down'));
        if (v.voted === 'up') card.querySelectorAll('.vote-btn')[0].classList.add('voted-up');
        if (v.voted === 'down') card.querySelectorAll('.vote-btn')[1].classList.add('voted-down');
    }
}

// Hook into the navigate function to lazy-load when entering mercado page
const _origNavigate = typeof navigate === 'function' ? navigate : null;
document.addEventListener('DOMContentLoaded', () => {
    // A home agora também usa o Mercado da Bala, então carrega assim que o card existir.
    if (document.getElementById('home-mercado-list')) {
        loadMercado();
    }

    // Mantém o carregamento ao entrar direto pela página do Mercado.
    const navButtons = document.querySelectorAll('[onclick*="mercado"]');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!mercadoHasLoaded) {
                loadMercado();
            } else {
                renderMercado();
                renderHomeMercadoResumo();
            }
        });
    });
});


