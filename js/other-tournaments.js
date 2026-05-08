// ABA: OUTROS TORNEIOS

let currentOtId = null; // Guarda qual torneio está aberto
let currentOtStage = null; // Guarda qual fase (Classificatória, Final) está aberta

// 1. Carrega os cards na tela inicial da aba
function renderOutrosTorneiosList() {
    const container = document.getElementById('ot-grid-torneios');
    if (!container || dbCampeonatos.length === 0) return;

    const searchQuery = (document.getElementById('ot-search')?.value || '').toLowerCase().trim();
    const yearFilter = document.getElementById('ot-filter-year')?.value || 'all';
    const tierFilter = document.getElementById('ot-filter-tier')?.value || 'all';

    // 1. Preencher opções de Ano dinamicamente baseado na planilha
    const yearSelect = document.getElementById('ot-filter-year');
    if (yearSelect && yearSelect.options.length <= 1) {
        const anosUnicos = [...new Set(dbCampeonatos.map(c => c.data.substring(0, 4)))].sort((a,b) => b - a);
        anosUnicos.forEach(ano => {
            yearSelect.innerHTML += `<option value="${ano}">${ano}</option>`;
        });
    }

    // 2. Filtra os torneios
    let filtrados = dbCampeonatos.filter(c => {
        const ano = c.data.substring(0, 4);
        const matchSearch = c.torneio.toLowerCase().includes(searchQuery);
        const matchYear = yearFilter === 'all' || ano === yearFilter;
        const matchTier = tierFilter === 'all' || c.tier === tierFilter;
        return matchSearch && matchYear && matchTier;
    });

    // Ordena pela data (do mais recente para o mais antigo)
    filtrados.sort((a, b) => new Date(b.data) - new Date(a.data));

    if (filtrados.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1;">Nenhum torneio encontrado com esses filtros.</p>';
        return;
    }

    // 3. Monta os cards
    container.innerHTML = filtrados.map(t => {
        // Encontra o campeão daquele torneio (quem tem "1st" ou "1º")
        let champion = null;
        for (let equipe in t.resultados) {
            let pos = t.resultados[equipe];
            if (pos === '1st' || pos === '1º') {
                champion = equipe;
                break;
            }
        }

        let championHtml = champion ? `
            <div class="ot-card-champion">
                <img src="${logos[champion] || 'escudo.webp'}" onerror="this.src='escudo.webp'">
                🏆 ${shortNames[champion] || champion}
            </div>` : '';

        // Imagem: consulta planilha primeiro, depois fallback hardcoded
        let tournamentImg = resolveLeagueLogo(t.torneio);

        const ano = t.data.substring(0, 4);

        // Cores do Tier
        let tierColor = 'var(--accent)';
        if(t.tier === 'S-Tier') tierColor = '#ffd700';
        else if(t.tier === 'A-Tier') tierColor = '#ff4444';
        else if(t.tier === 'B-Tier') tierColor = '#33ccff';
        else if(t.tier === 'C-Tier') tierColor = '#4caf50';

        return `
            <div class="ot-tournament-card" onclick="openOtherTournament('${t.id}')" style="--card-accent: ${tierColor}; border-color: rgba(255, 255, 255, 0.1);">
                <img class="ot-card-img" src="${tournamentImg}" onerror="this.src='trofeu.webp'">
                <div class="ot-card-name">${t.torneio}</div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="ot-card-year">${ano}</div>
                    <div style="font-size: 0.7em; font-weight: bold; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: ${tierColor}">${t.tier}</div>
                </div>
                ${championHtml}
                <div class="ot-card-click-hint">Ver tabela de classificação →</div>
            </div>
        `;
    }).join('');
}

// Helper: converte hex/named color para rgb
function hexToRgb(color) {
    if (color.startsWith('#')) {
        let hex = color.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
        const num = parseInt(hex, 16);
        return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
    }
    return '0, 200, 255';
}

// Helper: retorna imagem do torneio — usa resolveLeagueLogo (planilha + fallback hardcoded)
function getTournamentImg(t) {
    if (!t) return 'lbff.webp';
    // Se a planilha já forneceu uma imagem customizada, usa ela
    if (t.imagem) return t.imagem;
    // Senão, resolve pelo nome
    const nome = t.nome || t.event || t.torneio || '';
    return resolveLeagueLogo(nome);
}

// 2. Abre a tela de um torneio específico
function openOtherTournament(id) {
    let t = dbCampeonatos.find(x => x.id === id);
    if (!t) return;

    currentOtData = t;

    // Troca as telas
    document.getElementById('ot-list-view').style.display = 'none';
    document.getElementById('ot-details-view').style.display = 'block';

    // Preenche Título, Ano e Tier
    document.getElementById('ot-title').innerText = t.torneio;
    document.getElementById('ot-year').innerText = t.data.substring(0, 4);

    const badgeEl = document.getElementById('ot-details-badge');
    if (badgeEl) badgeEl.innerText = t.tier;

    renderOtStandings();
    renderOtChampions(t); // ← Seção da equipe campeã
    window.scrollTo(0, 0);
}

// Renderiza a seção da equipe campeã com cartinhas dos jogadores
function renderOtChampions(t) {
    const container = document.getElementById('ot-champions-container');
    if (!container) return;

    // Busca o título coletivo que bate com o nome deste torneio
    const titulo = titlesData.coletivos.find(tc =>
        tc.event.toUpperCase().trim() === t.torneio.toUpperCase().trim() ||
        t.torneio.toUpperCase().includes(tc.event.toUpperCase().trim()) ||
        tc.event.toUpperCase().includes(t.torneio.toUpperCase().trim())
    );

    if (!titulo || !titulo.players || titulo.players.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    const teamName = titulo.team;
    const teamLogo = logos[teamName] || 'escudo.webp';

    // Gera os cards — com dados reais se o jogador existir, genérico se não
    const cardsHtml = titulo.players.map(pName => {
        // Tenta achar o jogador no banco atual ou histórico
        let pObj = db.players.find(x => checkNameMatch(x.jogador, pName));

        if (pObj) {
            // Card completo com overall real
            return `<div style="flex-shrink:0;">${createPlayerCardHTML(pObj, 0.85)}</div>`;
        } else {
            // Card genérico: MANTÉM AS CORES, MAS COPIA AS DIMENSÕES DO CARD OFICIAL
            const photo = playerPhotos[pName] || 'silhueta.png';
            return `
            <div style="flex-shrink:0;">
                <div data-player="${pName.replace(/"/g,'&quot;')}" class="ot-champ-card" style="cursor:pointer; width:280px; height:420px; background:#000; border:3px solid #888; border-radius:15px; position:relative; overflow:hidden; font-family:sans-serif; transform: scale(0.85); margin: -15px;">
                    <div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 30%,#222,#000);opacity:0.9;"></div>

                    <div style="position:absolute;top:40px;left:25px;z-index:4;text-align:center;color:#888;">
                        <div style="font-size:18px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">CAMPEÃO</div>
                        <div style="margin:10px auto;width:35px;height:2px;background:#888;opacity:0.6;"></div>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/0/05/Flag_of_Brazil.svg" style="width:35px;border-radius:2px;display:block;margin:8px auto;">
                        <img src="${teamLogo}" onerror="this.src='escudo.webp'" style="width:50px;height:50px;object-fit:contain;display:block;margin:10px auto;">
                    </div>

                    <img src="${photo}" onerror="this.src='silhueta.png'" style="position:absolute;top:20px;right:-30px;height:260px;z-index:2;-webkit-mask-image:linear-gradient(to bottom,black 70%,transparent 100%);">

                    <div style="position:absolute;bottom:0;width:100%;height:185px;background:linear-gradient(transparent,#000 35%);z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:12px;">
                        <div style="width:100%;text-align:center;margin-bottom:8px;">
                            <div style="margin:0 auto;width:85%;height:1px;background:linear-gradient(90deg,transparent,#888,transparent);"></div>
                            <div style="color:#fff;font-size:24px;font-weight:900;text-transform:uppercase;padding:6px 0;">${pName}</div>
                            <div style="margin:0 auto;width:85%;height:1px;background:linear-gradient(90deg,transparent,#888,transparent);"></div>
                        </div>
                        <div style="color:#aaa;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1px; margin-bottom: 25px;">${teamName}</div>
                    </div>
                </div>
            </div>`;
        }
    }).join('');

    container.innerHTML = `
        <div style="margin-top:30px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:12px;">
                <img src="${teamLogo}" onerror="this.src='escudo.webp'" style="width:40px;height:40px;object-fit:contain;">
                <div>
                    <div style="color:#ffd700;font-weight:900;font-size:1.1em;text-transform:uppercase;letter-spacing:1px;">🏆 Equipe Campeã</div>
                    <div style="color:#fff;font-size:1.3em;font-weight:bold;">${teamName}</div>
                </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;">
                ${cardsHtml}
            </div>
        </div>
    `;

    // Listener seguro para os cards genéricos (evita problema com apóstrofos)
    container.querySelectorAll('.ot-champ-card[data-player]').forEach(el => {
        el.addEventListener('click', () => openPlayerProfile(el.dataset.player));
    });
}

function closeOtherTournament() {
    document.getElementById('ot-list-view').style.display = 'block';
    document.getElementById('ot-details-view').style.display = 'none';
    const champEl = document.getElementById('ot-champions-container');
    if (champEl) { champEl.innerHTML = ''; champEl.style.display = 'none'; }
    currentOtData = null;
}

// 4. Troca a fase do torneio (ao clicar no botão)
function changeOtStage(fase) {
    currentOtStage = fase;
    // Atualiza a cor dos botões
    let buttons = document.getElementById('ot-stage-filters').children;
    for(let b of buttons) {
        if(b.innerText === fase) b.classList.add('active');
        else b.classList.remove('active');
    }
    renderOtStandings();
}

// 5. Renderiza a tabela de Classificação (FOCADA APENAS EM PONTOS)
function renderOtStandings() {
    let t = currentOtData;
    if (!t) return;

    // Transforma o objeto de resultados { Equipe: "1st" } num Array ordenável
    let dados = [];
    for(let equipe in t.resultados) {
        let placeStr = t.resultados[equipe];
        // Converte "1st", "2nd", "10º" em números para ordenar direito (1, 2, 10...)
        let placeNum = parseInt(placeStr.replace(/\D/g, '')) || 999;
        dados.push({ equipe: equipe, placeStr: placeStr, placeNum: placeNum });
    }

    dados.sort((a, b) => a.placeNum - b.placeNum);

    let tbodyHtml = dados.map((row) => {
        let logoSrc = logos[row.equipe] || 'escudo.webp';

        let isFirst = row.placeNum === 1;
        let isSecond = row.placeNum === 2;
        let isThird = row.placeNum === 3;

        let rowStyle = '';
        if (isFirst) rowStyle = 'color: #ffd700; font-size: 1.1em; text-shadow: 0 0 10px rgba(255,215,0,0.5);';
        else if (isSecond) rowStyle = 'color: #c0c0c0;';
        else if (isThird) rowStyle = 'color: #cd7f32;';
        else rowStyle = 'color: #fff;';

        return `
        <tr>
            <td style="font-weight:bold; ${rowStyle}">${row.placeStr.replace(/st|nd|rd|th/ig, 'º')}</td>
            <td class="clickable team-cell" onclick="openTeamProfile('${row.equipe}')" style="text-align:left; display: flex; align-items: center; gap: 10px;">
                <img src="${logoSrc}" style="width: 24px; height: 24px; object-fit: contain;" onerror="this.src='escudo.webp'">
                <span style="font-weight:bold; color:#fff;">${shortNames[row.equipe] || row.equipe}</span>
            </td>
        </tr>`;
    }).join('');

    document.getElementById('ot-standings-container').innerHTML = `
        <div class="table-container">
            <table style="width: 100%;">
                <thead>
                    <tr>
                        <th style="width: 100px;">POSIÇÃO</th>
                        <th style="text-align:left;">EQUIPE</th>
                    </tr>
                </thead>
                <tbody>${tbodyHtml}</tbody>
            </table>
        </div>
    `;
}

// 7. Abre o Modal com a Escalação
function openOtTeamRoster(tourneyId, teamName) {
    let t = dbOutrosTorneios.find(x => x.id === tourneyId);

    // Se não tivermos anotado a escalação desse time no BD, avisa o usuário
    if (!t || !t.escalacoes || !t.escalacoes[teamName]) {
        alert("Escalação não registrada para este time neste torneio.");
        return;
    }

    document.getElementById('ot-roster-title').innerText = teamName;
    document.getElementById('ot-roster-logo').src = logos[teamName] || 'escudo.webp';

    let players = t.escalacoes[teamName];

    let html = players.map(pName => {
        // Verifica se o jogador existe no nosso banco (Ativo ou Inativo)
        let isRegistered = db.players.some(x => checkNameMatch(x.jogador, pName)) ||
                           (typeof lbffData !== 'undefined' && Object.keys(lbffData).some(name => checkNameMatch(name, pName)));

        if (isRegistered) {
            // Se existe, cria um botão que leva direto pro perfil
            return `<button class="btn-action" style="width: 100%; margin-top: 0; background: rgba(102, 179, 255, 0.1); border: 1px solid #66b3ff; color: #66b3ff;" onclick="document.getElementById('ot-roster-modal').classList.remove('active'); ${_safePPAttr(pName)}">${pName} ↗</button>`;
        } else {
            // Se NÃO existe, só mostra o nome numa caixinha cinza sem clique
            return `<div style="background: rgba(255,255,255,0.05); border: 1px solid var(--border); padding: 10px; border-radius: 6px; color: #888; font-weight: bold;">${pName}</div>`;
        }
    }).join('');

    document.getElementById('ot-roster-list').innerHTML = html;
    document.getElementById('ot-roster-modal').classList.add('active');
}

// 8. Fechar o Modal de Escalação clicando fora
function closeOtRosterModal(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
}

// 6. Renderiza o Ranking de MVP
function renderOtMvp() {
    let t = dbOutrosTorneios.find(x => x.id === currentOtId);
    let container = document.getElementById('ot-mvp-container');

    if (!t || !t.ranking_mvp || t.ranking_mvp.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center;">Ranking de MVP não disponível para este torneio.</p>';
        return;
    }

    let dados = t.ranking_mvp;
    dados.sort((a,b) => b.kills - a.kills);

    let tbodyHtml = dados.map((row, index) => {
        let isMvp = row.jogador === t.mvp_oficial;
        let mvpIcon = isMvp ? '👑 ' : '';
        let mvpStyle = isMvp ? 'color: #a020f0; text-shadow: 0 0 5px rgba(160, 32, 240, 0.5);' : 'color: #fff;';

        return `
        <tr>
            <td style="color:var(--accent); font-weight:bold;">${index + 1}º</td>
            <td style="text-align:left; font-weight:bold; ${mvpStyle}">${mvpIcon}${row.jogador}</td>
            <td style="color:#aaa;">${row.equipe}</td>
            <td style="color:var(--accent); font-weight:bold;">${row.kills}</td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 50px;">#</th>
                        <th style="text-align:left;">JOGADOR</th>
                        <th>EQUIPE</th>
                        <th>KILLS</th>
                    </tr>
                </thead>
                <tbody>${tbodyHtml}</tbody>
            </table>
        </div>
    `;
}
