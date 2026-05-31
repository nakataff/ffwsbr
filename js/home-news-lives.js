// --- FUNÇÕES DA PÁGINA INICIAL ---
function renderHomeStats() {
    // Top 6 Teams
    let sortedTeams = [...db.teams].sort((a,b) => b.pontos - a.pontos).slice(0, 6);
    let tbodyTeams = document.getElementById('home-tbody-teams');
    if(tbodyTeams) {
        tbodyTeams.innerHTML = sortedTeams.map((t, i) => `
            <tr>
                <td style="color:var(--accent); font-weight:bold;">${i+1}º</td>
                <td class="clickable" onclick="openTeamProfile('${t.equipe}')" style="text-align:left; border-bottom: none;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <img src="${logos[t.equipe]||''}" style="width:20px; height:20px; object-fit:contain;">
                        <span style="font-weight:bold; color:#fff;">${shortNames[t.equipe] || t.equipe}</span>
                    </div>
                    <div style="font-size: 0.75em; color: #888; margin-left: 28px;">Grupo ${t.grupo}</div>
                </td>
                <td style="color:var(--accent); font-weight:bold;">${t.pontos}</td>
            </tr>
        `).join('');
    }

    // Top 6 Players
    let sortedPlayers = [...db.players].filter(p => !p.isEx).sort((a,b) => b.abates - a.abates).slice(0, 6);
    let tbodyPlayers = document.getElementById('home-tbody-players');
    if(tbodyPlayers) {
        tbodyPlayers.innerHTML = sortedPlayers.map((p, i) => `
            <tr>
                <td style="color:var(--accent); font-weight:bold;">${i+1}º</td>
                <td class="clickable" onclick="${_safePPAttr(p.jogador)}" style="text-align:left; border-bottom: none;">
                    <span style="font-weight:bold; color:#fff;">${getDisplayName(p.jogador)}</span>
                    <div style="font-size: 0.75em; color: #888;">${p.equipe}</div>
                </td>
                <td style="color:var(--accent); font-weight:bold;">${p.abates}</td>
            </tr>
        `).join('');
    }
}

// SISTEMA DE NOTÍCIAS — carrega de noticias.json
// Estrutura do noticias.json:
// [
//   { "imagem": "noticia1.webp", "titulo": "TÍTULO EM MAIÚSCULAS", "link": "https://...", "destaque": true },
//   { "imagem": "noticia2.jpg", "titulo": "Título da notícia", "link": "https://...", "destaque": false }
// ]
// A notícia com "destaque": true vira o hero (banner grande).
// As demais aparecem na grade de "Últimas Notícias" abaixo do Top 6.
async function loadResults() {
    // Se já estiver carregado, não faz nada e sai da função
    if (resultsLoaded) return;

    try {
        const response = await fetch(typeof withCacheBuster === 'function' ? withCacheBuster('resultados.json') : `resultados.json?nocache=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error("Erro ao carregar resultados.json");

        dbResults = await response.json();

        // Sincroniza com os novos resultados da planilha
        if (typeof distribuirNovosResultados === 'function') {
            distribuirNovosResultados();
        }

        resultsLoaded = true; // Ativa a chave: agora está carregado
        console.log("Histórico de resultados carregado sob demanda!");
    } catch (e) {
        console.error("Falha no carregamento do JSON:", e);
    }
}


// ALIASES HISTÓRICOS DE EQUIPES — permite agrupar nomes antigos e atuais
let dbTeamAliases = {};
let teamAliasesLoaded = false;

const TEAM_ALIAS_FALLBACK = {
    'LOUD SNICKERS': ['LOUD SNICKERS', 'LOUD'],
    'VIVO KEYD': ['VIVO KEYD', 'KEYD STARS', 'KEYD'],
    'FLUXO W7M': ['FLUXO W7M', 'FLUXO', 'FX', 'FX W7M'],
    'TEAM SOLID': ['TEAM SOLID', 'TS'],
    'ALPHA7': ['ALPHA7', 'A7'],
    'VASCO ESPORTS': ['VASCO ESPORTS', 'VASCO', 'CRVG'],
    'INFLUENCE RAGE': ['INFLUENCE RAGE', 'INF'],
    'E1 SPORTS': ['E1 SPORTS', 'E1'],
    'AXS FUSION': ['AXS FUSION', 'AXS'],
    'RISE GAMING': ['RISE GAMING', 'RISE'],
    'RUSH GAMING': ['RUSH GAMING', 'RUSH'],
    'B4 ESPORTS': ['B4 ESPORTS', 'B4STARDOS', 'B4E', 'B4'],
    'TEAM LIQUID': ['TEAM LIQUID', 'LIQUID'],
    'PAIN GAMING': ['PAIN GAMING', 'PAIN', 'PNG'],
    'BD LOS GRANDES': ['BD LOS GRANDES', 'BD LOS', 'BD LGD'],
    'BLACK DRAGONS': ['BLACK DRAGONS', 'Black Dragons e-Sports', 'BD'],
    'RED CANIDS': ['RED CANIDS', 'RED'],
    'PRODIGY ESPORTS': ['PRODIGY ESPORTS', 'PRG'],
    'SPECIAL KILLER SERVICE': ['SPECIAL KILLER SERVICE', 'SKS'],
    'CORINTHIANS': ['CORINTHIANS', 'SCCP']
};

function normalizeTeamAlias(value) {
    return String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
}

async function loadTeamAliases() {
    if (teamAliasesLoaded) return;
    dbTeamAliases = { ...TEAM_ALIAS_FALLBACK };

    try {
        const url = typeof withCacheBuster === 'function' ? withCacheBuster('team-aliases.json') : `team-aliases.json?v=${Date.now()}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            Object.entries(data || {}).forEach(([canonical, aliases]) => {
                dbTeamAliases[canonical] = Array.isArray(aliases) ? aliases : [aliases];
            });
        }
        // Evita a entidade antiga aparecer como nome oficial quando a equipe correta é B4 ESPORTS.
        if (dbTeamAliases['B4 ESPORTS']) delete dbTeamAliases['B4STARDOS'];
    } catch (e) {
        console.warn('[loadTeamAliases] Usando aliases padrão:', e);
    }

    teamAliasesLoaded = true;
}

function getTeamCanonicalName(nome) {
    const target = normalizeTeamAlias(nome);
    const aliasSource = (dbTeamAliases && Object.keys(dbTeamAliases).length) ? dbTeamAliases : TEAM_ALIAS_FALLBACK;
    for (const [canonical, aliases] of Object.entries(aliasSource)) {
        const allNames = [canonical, ...(Array.isArray(aliases) ? aliases : [aliases])];
        if (allNames.some(n => normalizeTeamAlias(n) === target)) return canonical;
    }
    return nome;
}

function getTeamAliasSet(nome) {
    const canonical = getTeamCanonicalName(nome);
    const set = new Set([normalizeTeamAlias(nome), normalizeTeamAlias(canonical)]);

    const addList = (list) => (list || []).forEach(item => set.add(normalizeTeamAlias(item)));
    const aliasSource = (dbTeamAliases && Object.keys(dbTeamAliases).length) ? dbTeamAliases : TEAM_ALIAS_FALLBACK;
    addList(aliasSource[canonical]);

    // Aproveita também aliases salvos dentro dos JSONs de Outros Torneios
    if (Array.isArray(window.dbNovosTorneios || (typeof dbNovosTorneios !== 'undefined' ? dbNovosTorneios : []))) {
        (window.dbNovosTorneios || (typeof dbNovosTorneios !== 'undefined' ? dbNovosTorneios : [])).forEach(t => {
            Object.entries(t.aliases || {}).forEach(([alias, mapped]) => {
                const a = normalizeTeamAlias(alias);
                const m = normalizeTeamAlias(mapped);
                if (set.has(a) || set.has(m)) {
                    set.add(a);
                    set.add(m);
                }
            });
        });
    }

    return set;
}


// Utilidades globais para aliases, logos e títulos vindos de novos-torneios
function getTeamLogoByAliases(teamName) {
    const raw = String(teamName || '').trim();
    if (!raw) return 'escudo.webp';

    const candidates = new Set([raw, raw.toUpperCase(), getTeamCanonicalName(raw)]);
    getTeamAliasSet(raw).forEach(alias => candidates.add(alias));

    for (const name of candidates) {
        if (logos[name]) return logos[name];
        if (logos[String(name).toUpperCase()]) return logos[String(name).toUpperCase()];
    }

    const normalizedCandidates = [...candidates].map(normalizeTeamAlias);
    for (const [logoKey, logoValue] of Object.entries(logos || {})) {
        if (normalizedCandidates.includes(normalizeTeamAlias(logoKey))) return logoValue;
    }

    return 'escudo.webp';
}

function getNovosTorneiosSafeList() {
    return window.dbNovosTorneios || (typeof dbNovosTorneios !== 'undefined' ? dbNovosTorneios : []) || [];
}

function getNovoTorneioName(t) {
    return t?.name || t?.nome || t?.torneio || t?.id || 'Torneio';
}

function getNovoTorneioYear(t) {
    return String(t?.year || t?.ano || '').trim();
}

function getNovoTorneioChampionTeam(t) {
    const pickTeam = (section) => {
        const rows = section?.rows || section?.linhas || [];
        if (!rows.length) return '';
        return getCompactFieldFromCols(rows[0], section, 'team', getCompactFieldFromCols(rows[0], section, 'equipe', ''));
    };

    if (t?.final) return pickTeam(t.final);
    const standings = Array.isArray(t?.standings) ? t.standings.filter(sec => sec?.type !== 'pointRush') : [];
    if (standings.length) return pickTeam(standings[0]);
    return '';
}

function getNovoTorneioTeamObject(t, teamName) {
    const aliasSet = getTeamAliasSet(teamName);
    const teams = t?.teams?.items || t?.teams?.equipes || [];
    return teams.find(team => {
        const n = team.n || team.nome || '';
        const o = team.o || team.nomeOriginal || '';
        const teamSet = new Set([...getTeamAliasSet(n), ...getTeamAliasSet(o)]);
        return [...teamSet].some(alias => aliasSet.has(alias));
    }) || null;
}

function novoTorneioHasPlayerInTeam(t, teamName, playerName) {
    const team = getNovoTorneioTeamObject(t, teamName);
    if (!team) return false;
    const players = team.p || team.jogadores || [];
    const staff = team.s || team.staff || [];
    return [...players, ...staff].some(person => {
        const n = person.n || person.nome || '';
        return typeof checkNameMatch === 'function'
            ? checkNameMatch(n, playerName)
            : String(n).toLowerCase() === String(playerName).toLowerCase();
    });
}


function cffNormalizeNovoTorneioAwards(t) {
    const raw = t?.awards || t?.premios || [];
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];

    const cols = Array.isArray(raw.cols) ? raw.cols.map(c => String(c || '').trim()) : [];
    const rows = Array.isArray(raw.rows) ? raw.rows : [];
    if (!rows.length) return [];

    return rows.map(row => {
        if (row && typeof row === 'object' && !Array.isArray(row)) return row;
        const obj = {};
        cols.forEach((col, i) => { obj[col] = Array.isArray(row) ? row[i] : ''; });
        return {
            award: obj.award || obj.premio || obj.title || '',
            player: obj.player || obj.jogador || obj.nome || '',
            team: obj.team || obj.equipe || obj.time || '',
            date: obj.date || obj.data || '',
            note: obj.note || obj.observacao || ''
        };
    }).filter(a => a.award || a.player || a.team);
}

function getNovosTorneiosCollectiveTitlesForTeam(teamName) {
    const aliasSet = getTeamAliasSet(teamName);
    return getNovosTorneiosSafeList().map(t => {
        const champion = getNovoTorneioChampionTeam(t);
        if (!champion) return null;
        const championSet = getTeamAliasSet(champion);
        const matches = [...championSet].some(alias => aliasSet.has(alias));
        if (!matches) return null;
        return {
            event: getNovoTorneioName(t),
            year: getNovoTorneioYear(t),
            type: 'Campeão',
            team: champion,
            novoTorneioId: t.id || ''
        };
    }).filter(Boolean);
}

function getNovosTorneiosIndividualAwardsForTeam(teamName) {
    const aliasSet = getTeamAliasSet(teamName);
    return getNovosTorneiosSafeList().flatMap(t => cffNormalizeNovoTorneioAwards(t).map(a => {
        const awardTeam = a.team || a.equipe || '';
        const awardSet = getTeamAliasSet(awardTeam);
        const matches = [...awardSet].some(alias => aliasSet.has(alias));
        if (!matches) return null;
        return {
            event: getNovoTorneioName(t),
            year: getNovoTorneioYear(t),
            type: a.award || a.premio || 'Prêmio individual',
            player: a.player || a.jogador || '',
            team: awardTeam,
            note: a.note || a.observacao || '',
            novoTorneioId: t.id || ''
        };
    }).filter(Boolean));
}

function getNovosTorneiosCollectiveTitlesForPlayer(playerName) {
    return getNovosTorneiosSafeList().map(t => {
        const champion = getNovoTorneioChampionTeam(t);
        if (!champion || !novoTorneioHasPlayerInTeam(t, champion, playerName)) return null;
        return {
            event: getNovoTorneioName(t),
            year: getNovoTorneioYear(t),
            type: 'Campeão',
            team: champion,
            players: [playerName],
            novoTorneioId: t.id || ''
        };
    }).filter(Boolean);
}

function getNovosTorneiosIndividualAwardsForPlayer(playerName) {
    return getNovosTorneiosSafeList().flatMap(t => cffNormalizeNovoTorneioAwards(t).map(a => {
        const player = a.player || a.jogador || '';
        const matches = typeof checkNameMatch === 'function'
            ? checkNameMatch(player, playerName)
            : String(player).toLowerCase() === String(playerName).toLowerCase();
        if (!matches) return null;
        return {
            event: getNovoTorneioName(t),
            year: getNovoTorneioYear(t),
            type: a.award || a.premio || 'Prêmio individual',
            player,
            team: a.team || a.equipe || '',
            novoTorneioId: t.id || ''
        };
    }).filter(Boolean));
}

function buildUnifiedTrophyCard(t, opts = {}) {
    const eventName = t.event || t.torneio || 'Torneio';
    const tournamentImg = resolveLeagueLogo(eventName);
    const typeUpper = String(t.type || '').toUpperCase();
    const borderClass = typeUpper.includes('MVP') ? 'border-mvp' : (typeUpper.includes('REVELAÇÃO') ? 'border-revelacao' : 'border-campeao');
    const hasTournamentPage = !!findTournamentInDB(eventName);
    const clickAttr = hasTournamentPage ? `onclick="navigateToTournament('${eventName.replace(/'/g, "\\'")}')" style="cursor:pointer;" title="Ver página do torneio"` : '';
    const linkIcon = hasTournamentPage ? `<div style="font-size:0.55em; color:var(--accent); margin-top:3px;">Ver torneio</div>` : '';
    const team = t.team || '';
    const player = t.player || '';
    const year = t.year ? `<div style="font-size:0.55em; color:#aaa; margin-top:2px;">${t.year}</div>` : '';
    const playerLine = opts.showPlayer && player ? `<div style="font-size:0.62em; color:#fff; font-weight:800; text-align:center; margin-top:3px;">${player}</div>` : '';
    const teamLine = team ? `<div class="trophy-team"><img src="${getTeamLogoByAliases(team)}" style="width:14px; height:14px; object-fit:contain;" onerror="this.src='escudo.webp'">${team}</div>` : '';

    return `<div class="trophy-card ${borderClass}" ${clickAttr}>
        <img src="${tournamentImg}" class="trophy-img" onerror="this.src='trofeu.webp'">
        <div style="font-weight:bold; font-size:0.75em; color:#fff; text-align:center; margin-top:5px;">${eventName}</div>
        <div style="color:var(--accent); font-size:0.65em; font-weight:bold; text-transform:uppercase; text-align:center;">${t.type || 'Título'}</div>
        ${playerLine}
        ${year}
        ${linkIcon}
        ${teamLine}
    </div>`;
}

function getResultsByTeamAliases(nome) {
    const aliasSet = getTeamAliasSet(nome);
    const results = [];
    Object.entries(dbResults || {}).forEach(([teamName, rows]) => {
        const teamAliasSet = getTeamAliasSet(teamName);
        const matches = [...teamAliasSet].some(alias => aliasSet.has(alias));
        if (matches || aliasSet.has(normalizeTeamAlias(teamName))) {
            results.push(...(rows || []));
        }
    });
    return results;
}

function getCompactFieldFromCols(row, section, field, fallback = '') {
    if (!row) return fallback;
    if (!Array.isArray(row)) return row[field] ?? fallback;
    const cols = section?.cols || [];
    const idx = cols.indexOf(field);
    return idx >= 0 ? row[idx] : fallback;
}

function formatTierForResults(tier) {
    const raw = String(tier || '').trim();
    if (!raw) return 'Sem Tier';
    if (/^[SABCD]$/i.test(raw)) return `${raw.toUpperCase()}-Tier`;
    return raw;
}

function placeNumberToResultPlace(pos) {
    const n = Number(pos) || 0;
    if (!n) return '-';
    if (n === 1) return '1st';
    if (n === 2) return '2nd';
    if (n === 3) return '3rd';
    return `${n}th`;
}

function getNovoTorneioPrimaryResultSection(t) {
    if (t?.final && Array.isArray(t.final.rows) && t.final.rows.length) {
        return { section: t.final, stage: 'Final' };
    }

    const standings = Array.isArray(t?.standings)
        ? t.standings.filter(sec => sec?.type !== 'pointRush' && sec?.type !== 'finalTable')
        : [];

    if (standings.length && Array.isArray(standings[0].rows) && standings[0].rows.length) {
        return { section: standings[0], stage: 'Classificação' };
    }

    return { section: null, stage: '' };
}

function getNovosTorneiosResultsForTeam(nome) {
    const aliasSet = getTeamAliasSet(nome);
    const tournaments = window.dbNovosTorneios || (typeof dbNovosTorneios !== 'undefined' ? dbNovosTorneios : []) || [];
    const results = [];

    tournaments.forEach(t => {
        const { section, stage } = getNovoTorneioPrimaryResultSection(t);
        if (!section) return;

        const rows = section.rows || section.linhas || [];
        rows.forEach(row => {
            const team = getCompactFieldFromCols(row, section, 'team', '');
            const teamOriginal = getCompactFieldFromCols(row, section, 'teamOriginal', '');
            const teamSet = getTeamAliasSet(team);
            const originalSet = getTeamAliasSet(teamOriginal);
            const matchesTeam = [...teamSet, ...originalSet].some(alias => aliasSet.has(alias));
            if (!matchesTeam && !aliasSet.has(normalizeTeamAlias(team)) && !aliasSet.has(normalizeTeamAlias(teamOriginal))) return;

            const pos = getCompactFieldFromCols(row, section, 'pos', getCompactFieldFromCols(row, section, 'posicao', ''));
            results.push({
                data: String(t.year || t.ano || ''),
                tier: formatTierForResults(t.tier),
                place: placeNumberToResultPlace(pos),
                torneio: t.name || t.nome || t.id || 'Torneio',
                novoTorneioId: t.id || '',
                source: 'novos-torneios',
                stage
            });
        });
    });

    return results;
}

function findNovoTorneioByName(eventName) {
    const name = String(eventName || '').trim().toUpperCase();
    const tournaments = window.dbNovosTorneios || (typeof dbNovosTorneios !== 'undefined' ? dbNovosTorneios : []) || [];
    return tournaments.find(t => String(t.name || t.nome || t.id || '').trim().toUpperCase() === name);
}

function openAnyTournamentPage(eventName, novoTorneioId = '') {
    if (novoTorneioId && typeof openOtherTournament === 'function') {
        if (typeof navigate === 'function') navigate('outros-torneios');
        setTimeout(() => openOtherTournament(novoTorneioId), 80);
        return;
    }

    const novo = findNovoTorneioByName(eventName);
    if (novo && typeof openOtherTournament === 'function') {
        if (typeof navigate === 'function') navigate('outros-torneios');
        setTimeout(() => openOtherTournament(novo.id), 80);
        return;
    }

    if (typeof navigateToTournament === 'function') navigateToTournament(eventName);
}

async function loadNoticias() {
    const heroContainer = document.getElementById('news-hero-container');
    const grid = document.getElementById('ultimas-noticias-grid');
    const titulo = document.getElementById('ultimas-noticias-titulo');
    if (!heroContainer) return;

    // Aba de notícias publicada como TSV.
    // Colunas aceitas:
    // id | titulo | imagem | resumo | conteudo | data | autor | destaque | link_original
    // Para entrar no carrossel, marque destaque como TRUE. Se tiver menos de 3 TRUE,
    // o código completa automaticamente com as notícias mais recentes.
    const SHEET_TSV_URL = window.CFF_CONFIG.sheets.noticias;

    const FALLBACK_IMG = 'central free fire.webp';

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[char]));
    }

    function slugify(text) {
        return String(text || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || ('noticia-' + Date.now());
    }

    function convertDriveImage(url) {
        url = String(url || '').trim().replace(/\r/g, '');
        if (!url) return '';
        if (url.includes('drive.google.com')) {
            const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (match && match[1]) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
        }
        return url;
    }

    function isTrue(value) {
        const v = String(value || '').trim().toLowerCase();
        return ['true', 'sim', 's', '1', 'yes', 'destaque'].includes(v);
    }

    // Parser TSV mais seguro: suporta aspas e quebras de linha dentro de célula.
    // Isso evita a Home sumir quando a coluna "conteudo" da notícia fica grande.
    function parseTSV(text) {
        const rows = [];
        let row = [];
        let cell = '';
        let inQuotes = false;
        const src = String(text || '').replace(/^\uFEFF/, '');

        for (let i = 0; i < src.length; i++) {
            const char = src[i];
            const next = src[i + 1];

            if (char === '"') {
                if (inQuotes && next === '"') {
                    cell += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (char === '\t' && !inQuotes) {
                row.push(cell.trim());
                cell = '';
                continue;
            }

            if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && next === '\n') i++;
                row.push(cell.trim());
                if (row.some(v => String(v).trim() !== '')) rows.push(row);
                row = [];
                cell = '';
                continue;
            }

            cell += char;
        }

        row.push(cell.trim());
        if (row.some(v => String(v).trim() !== '')) rows.push(row);
        return rows;
    }

    function parseNoticiasTSV(tsvText) {
        const rows = parseTSV(tsvText);
        if (!rows.length) return [];

        const headers = rows[0].map(h => h.trim().toLowerCase());
        const temCabecalhoNovo = headers.includes('titulo') || headers.includes('conteudo') || headers.includes('resumo') || headers.includes('link_original');

        return rows.slice(1).map((cells, index) => {
            let noticia = {};

            if (temCabecalhoNovo) {
                headers.forEach((h, i) => noticia[h] = cells[i] || '');
            } else {
                noticia = {
                    imagem: cells[0] || '',
                    titulo: cells[1] || '',
                    link_original: cells[2] || '',
                    destaque: cells[3] || ''
                };
            }

            noticia.titulo = String(noticia.titulo || '').trim();
            noticia.id = String(noticia.id || '').trim() || slugify(noticia.titulo || `noticia-${index + 1}`);
            noticia.imagem = convertDriveImage(noticia.imagem);
            noticia.resumo = String(noticia.resumo || '').trim();
            noticia.link_original = noticia.link_original || noticia.link || '';
            noticia.destaque = isTrue(noticia.destaque);
            noticia.urlInterna = `noticias/${encodeURIComponent(noticia.id)}/`;

            return noticia;
        }).filter(n => n.titulo && n.titulo.length > 2);
    }

    function initHeroCarousel() {
        const carousel = document.getElementById('news-hero-carousel');
        if (!carousel || carousel.dataset.ready === '1') return;
        carousel.dataset.ready = '1';

        const slides = Array.from(carousel.querySelectorAll('.news-hero-slide'));
        const dots = Array.from(carousel.querySelectorAll('.news-hero-dot'));
        const prev = carousel.querySelector('.news-hero-prev');
        const next = carousel.querySelector('.news-hero-next');
        let current = 0;
        let timer = null;
        let startX = 0;
        let startY = 0;
        let isDragging = false;

        function showSlide(index) {
            if (!slides.length) return;
            current = (index + slides.length) % slides.length;
            slides.forEach((slide, i) => slide.classList.toggle('active', i === current));
            dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
        }

        function restartTimer() {
            if (timer) clearInterval(timer);
            if (slides.length > 1) timer = setInterval(() => showSlide(current + 1), 6500);
        }

        function goTo(index) {
            showSlide(index);
            restartTimer();
        }

        if (prev) prev.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            goTo(current - 1);
        });

        if (next) next.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            goTo(current + 1);
        });

        dots.forEach((dot, i) => dot.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            goTo(i);
        }));

        carousel.addEventListener('touchstart', event => {
            if (!event.touches || !event.touches.length) return;
            startX = event.touches[0].clientX;
            startY = event.touches[0].clientY;
            isDragging = true;
        }, { passive: true });

        carousel.addEventListener('touchend', event => {
            if (!isDragging || !event.changedTouches || !event.changedTouches.length) return;
            isDragging = false;
            const endX = event.changedTouches[0].clientX;
            const endY = event.changedTouches[0].clientY;
            const diffX = endX - startX;
            const diffY = endY - startY;

            // Só troca se for arraste horizontal de verdade, para não atrapalhar o scroll vertical.
            if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
                goTo(diffX < 0 ? current + 1 : current - 1);
            }
        }, { passive: true });

        carousel.addEventListener('mouseenter', () => { if (timer) clearInterval(timer); });
        carousel.addEventListener('mouseleave', restartTimer);

        showSlide(0);
        restartTimer();
    }

    heroContainer.innerHTML = `
        <section class="news-hero-carousel" aria-label="Carregando notícias">
            <div style="min-height:220px; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-weight:800; text-transform:uppercase; letter-spacing:1px;">
                Carregando notícias...
            </div>
        </section>`;

    try {
        const res = await fetch(`${SHEET_TSV_URL}&nocache=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Erro ao carregar a aba de notícias.');

        const tsvText = await res.text();
        const noticias = parseNoticiasTSV(tsvText);
        window.CFF_NOTICIAS_CACHE = noticias;
        window.cffNoticias = noticias;
        if (!noticias.length) throw new Error('A planilha de notícias está vazia ou sem coluna de título.');

        const destaques = noticias.filter(n => n.destaque);
        const slides = [];
        const slideIds = new Set();

        [...destaques, ...noticias].forEach(n => {
            const key = n.id || n.titulo;
            if (!key || slideIds.has(key) || slides.length >= 3) return;
            slides.push(n);
            slideIds.add(key);
        });

        heroContainer.innerHTML = `
        <section class="news-hero-carousel" id="news-hero-carousel" aria-label="Notícias principais">
            <div class="news-hero-track">
                ${slides.map((n, i) => `
                <a class="news-hero-slide ${i === 0 ? 'active' : ''}" href="${escapeHTML(n.urlInterna)}">
                    <img src="${escapeHTML(n.imagem || FALLBACK_IMG)}" alt="${escapeHTML(n.titulo)}" onerror="this.src='${FALLBACK_IMG}'">
                    <div class="news-hero-overlay">
                        <h2 class="news-hero-title">${escapeHTML(n.titulo)}</h2>
                        ${n.resumo ? `<p style="margin:8px 0 0; color:#d7ecff; font-weight:600; max-width:760px;">${escapeHTML(n.resumo)}</p>` : ''}
                    </div>
                </a>`).join('')}
            </div>
            ${slides.length > 1 ? `
                <button class="news-hero-nav news-hero-prev" type="button" aria-label="Notícia anterior">‹</button>
                <button class="news-hero-nav news-hero-next" type="button" aria-label="Próxima notícia">›</button>
                <div class="news-hero-dots">
                    ${slides.map((_, i) => `<button class="news-hero-dot ${i === 0 ? 'active' : ''}" type="button" aria-label="Ir para notícia ${i + 1}"></button>`).join('')}
                </div>` : ''}
        </section>`;

        initHeroCarousel();

        if (grid) {
            if (titulo) titulo.style.display = 'block';
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
            grid.style.gap = '20px';

            grid.innerHTML = noticias.map(n => `
                <a class="old-news-card" href="${escapeHTML(n.urlInterna)}" style="display:flex; flex-direction:column; height:100%; text-decoration:none; color:inherit;">
                    <div style="width:100%; height:160px; overflow:hidden; border-bottom:1px solid var(--border);">
                        <img src="${escapeHTML(n.imagem || FALLBACK_IMG)}" alt="${escapeHTML(n.titulo)}" onerror="this.src='${FALLBACK_IMG}'" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div class="old-news-title" style="padding:12px; font-size:0.95em; flex-grow:1;">${escapeHTML(n.titulo)}</div>
                </a>`).join('');
        }

    } catch (e) {
        console.error('[loadNoticias] Erro:', e);
        heroContainer.innerHTML = `
            <section class="news-hero-carousel" aria-label="Erro ao carregar notícias">
                <div style="min-height:220px; display:flex; flex-direction:column; gap:8px; align-items:center; justify-content:center; text-align:center; padding:20px; color:var(--text-muted);">
                    <strong style="color:#fff; text-transform:uppercase;">Notícias indisponíveis no momento</strong>
                    <span style="font-size:0.9em;">Confira se a planilha publicada está acessível e se existe a coluna titulo.</span>
                </div>
            </section>`;
        if (grid) grid.innerHTML = '';
        if (titulo) titulo.style.display = 'none';
    }
}

async function loadSobre() {
    const page = document.getElementById('sobre');
    if (!page) return;

    // Publique uma aba SOBRE em TSV e troque o GID abaixo pelo GID dela se for diferente.
    // Colunas recomendadas: titulo | subtitulo | texto | contato | email | instagram | whatsapp | discord | imagem | botao_texto | botao_link
    // Para cards extras: label | valor | link
    const SOBRE_TSV_URL = window.CFF_CONFIG.sheets.sobre;

    const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));

    const normalizeUrl = (value, type = '') => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('mailto:')) return raw;
        if (type === 'email') return `mailto:${raw}`;
        if (type === 'instagram') return `https://instagram.com/${raw.replace('@', '')}`;
        if (type === 'whatsapp') return `https://wa.me/${raw.replace(/\D/g, '')}`;
        return raw;
    };

    const addCard = (cards, label, value, link = '') => {
        if (!value) return;
        cards.push({ label, value, link });
    };

    try {
        const res = await fetch(`${SOBRE_TSV_URL}&nocache=${Date.now()}`);
        if (!res.ok) throw new Error('Erro ao carregar a aba SOBRE.');
        const tsvText = await res.text();
        const rows = String(tsvText || '').trim().split(/\n/).map(r => r.split('\t').map(c => c.trim().replace(/\r/g, '')));
        if (rows.length < 2) return;

        const headers = rows[0].map(h => h.toLowerCase());
        const data = rows.slice(1).map(cells => {
            const item = {};
            headers.forEach((h, i) => item[h] = cells[i] || '');
            return item;
        });

        const main = data.find(row => row.titulo || row.texto || row.contato || row.instagram || row.email) || data[0];
        if (!main) return;

        const kicker = document.getElementById('sobre-kicker');
        const title = document.getElementById('sobre-titulo');
        const text = document.getElementById('sobre-texto');
        const contacts = document.getElementById('sobre-contatos');

        if (kicker && main.subtitulo) kicker.textContent = main.subtitulo;
        if (title && main.titulo) title.textContent = main.titulo;
        if (text && main.texto) text.innerHTML = escapeHTML(main.texto).replace(/\n/g, '<br>');

        const cards = [];
        addCard(cards, 'Contato', main.contato, main.botao_link || '');
        addCard(cards, 'Instagram', main.instagram, normalizeUrl(main.instagram, 'instagram'));
        addCard(cards, 'E-mail', main.email, normalizeUrl(main.email, 'email'));
        addCard(cards, 'WhatsApp', main.whatsapp, normalizeUrl(main.whatsapp, 'whatsapp'));
        addCard(cards, 'Discord', main.discord, main.discord_link || '');

        data.forEach(row => {
            if (row.label && row.valor) addCard(cards, row.label, row.valor, row.link || '');
        });

        if (contacts && cards.length) {
            contacts.innerHTML = cards.map(card => `
                <div class="about-card">
                    <div class="about-card-label">${escapeHTML(card.label)}</div>
                    <div class="about-card-value">
                        ${card.link ? `<a href="${escapeHTML(card.link)}" target="_blank" rel="noopener">${escapeHTML(card.value)}</a>` : escapeHTML(card.value)}
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error('[loadSobre] Erro:', e);
    }
}

function normalizeLogoSheetKey(value) {
    return String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim();
}

function getLogoSheetValue(row, headers, names) {
    const wanted = names.map(normalizeLogoSheetKey);
    for (const h of headers) {
        const key = normalizeLogoSheetKey(h);
        if (wanted.includes(key) || wanted.some(w => key.includes(w))) {
            const val = row[h];
            if (val != null && String(val).trim()) return String(val).trim().replace(/\r/g, '');
        }
    }
    return '';
}

function registerTeamLogoAliases(nomeEquipe, urlLogo) {
    const raw = String(nomeEquipe || '').trim();
    const url = String(urlLogo || '').trim().replace(/\r/g, '');
    if (!raw || !url) return;

    const candidates = new Set([raw, raw.toUpperCase().trim(), normalizeLogoSheetKey(raw)]);

    if (typeof getTeamCanonicalName === 'function') {
        const canonical = getTeamCanonicalName(raw);
        candidates.add(canonical);
        candidates.add(String(canonical || '').toUpperCase().trim());
    }

    if (typeof getSEATeamFullName === 'function') {
        const full = getSEATeamFullName(raw);
        candidates.add(full);
        candidates.add(String(full || '').toUpperCase().trim());
        candidates.add(normalizeLogoSheetKey(full));
    }

    if (typeof getSEATeamSigla === 'function') {
        const sigla = getSEATeamSigla(raw);
        candidates.add(sigla);
        candidates.add(String(sigla || '').toUpperCase().trim());
        candidates.add(normalizeLogoSheetKey(sigla));
    }

    try {
        if (typeof SEA_TEAM_NAME_MAP !== 'undefined') {
            Object.entries(SEA_TEAM_NAME_MAP).forEach(([alias, mapped]) => {
                if (normalizeLogoSheetKey(alias) === normalizeLogoSheetKey(raw) || normalizeLogoSheetKey(mapped) === normalizeLogoSheetKey(raw)) {
                    [alias, mapped].forEach(v => {
                        candidates.add(v);
                        candidates.add(String(v || '').toUpperCase().trim());
                        candidates.add(normalizeLogoSheetKey(v));
                    });
                }
            });
        }
        if (typeof SEA_TEAM_SIGLA_MAP !== 'undefined') {
            Object.entries(SEA_TEAM_SIGLA_MAP).forEach(([alias, sigla]) => {
                if (normalizeLogoSheetKey(alias) === normalizeLogoSheetKey(raw) || normalizeLogoSheetKey(sigla) === normalizeLogoSheetKey(raw)) {
                    [alias, sigla].forEach(v => {
                        candidates.add(v);
                        candidates.add(String(v || '').toUpperCase().trim());
                        candidates.add(normalizeLogoSheetKey(v));
                    });
                }
            });
        }
    } catch (e) {}

    candidates.forEach(key => {
        const clean = String(key || '').trim();
        if (clean) logos[clean] = url;
    });

    if (typeof window !== 'undefined') window.logos = logos;
}

async function loadTeamLogos() {
    const LOGOS_TSV_URL = window.CFF_CONFIG.sheets.logosEquipes;

    try {
        const res = await fetch(`${LOGOS_TSV_URL}&nocache=${new Date().getTime()}`);
        const tsvText = await res.text();
        const lines = tsvText.replace(/^\uFEFF/, '').split('\n').filter(line => line.trim());
        if (!lines.length) return;

        const headers = lines[0].split('\t').map(h => h.trim().replace(/\r/g, ''));
        let loaded = 0;

        lines.slice(1).forEach(line => {
            const cols = line.split('\t');
            const row = {};
            headers.forEach((h, i) => row[h] = (cols[i] || '').trim().replace(/\r/g, ''));

            let nomeEquipe = getLogoSheetValue(row, headers, ['Equipe', 'Time', 'Team', 'Nome', 'Organização', 'Organizacao', 'Org', 'Sigla']);
            let urlLogo = getLogoSheetValue(row, headers, ['Logo', 'Escudo', 'Imagem', 'URL', 'Link']);

            // Fallback para planilha simples: coluna A = equipe, coluna B = logo.
            if (!nomeEquipe) nomeEquipe = cols[0]?.trim().replace(/\r/g, '') || '';
            if (!urlLogo) {
                urlLogo = (cols.find((cell, idx) => idx > 0 && /^https?:\/\//i.test(String(cell || '').trim())) || cols[1] || '').trim().replace(/\r/g, '');
            }

            if (nomeEquipe && urlLogo) {
                registerTeamLogoAliases(nomeEquipe, urlLogo);
                loaded++;
            }
        });

        window.__cffTeamLogosLoaded = true;
        console.log(`Logos atualizadas via Sheets! (${loaded})`);

        // Após carregar as logos, atualiza os blocos que usam escudos sem depender de filtro/troca de aba.
        if (typeof renderHomeStats === 'function') renderHomeStats();
        if (typeof renderFullTeams === 'function') renderFullTeams();
        if (typeof renderSelection === 'function') renderSelection();
        if (typeof renderTop5Stats === 'function') renderTop5Stats();
        if (typeof renderTableAvg === 'function') renderTableAvg();
        if (typeof renderTableTotal === 'function') renderTableTotal();
        if (typeof renderNotasCFFPage === 'function') renderNotasCFFPage();
        if (typeof renderSEATable === 'function' && typeof seaClassificacaoParsed !== 'undefined' && seaClassificacaoParsed?.headers?.length) {
            renderSEATable('table-sea-classificacao', seaClassificacaoParsed, 'Nenhum dado de classificação encontrado.');
        }
        if (typeof applySEAAbatesFilters === 'function' && typeof seaAbatesParsed !== 'undefined' && seaAbatesParsed?.headers?.length) {
            applySEAAbatesFilters();
        }
    } catch (e) {
        console.error('Erro ao carregar logos da planilha:', e);
    }
}
// OUTRAS EQUIPES — equipes fora do db.teams

// Retorna os nomes das equipes que têm resultados em dbResults mas NÃO estão em db.teams
function getOutrasEquipes() {
    const equipesAtivas = new Set(db.teams.map(t => t.equipe.toUpperCase()));
    return Object.keys(dbResults)
        .filter(nome => !equipesAtivas.has(nome.toUpperCase()))
        .sort((a, b) => a.localeCompare(b));
}

let currentOutraEquipe = null;

function renderOutrasEquipesGrid() {
    const container = document.getElementById('outras-equipes-directory');
    if (!container) return;

    const searchInput = document.getElementById('outras-equipes-search');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const equipes = getOutrasEquipes().filter(e => e.toLowerCase().includes(query));

    if (equipes.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1;">Nenhuma equipe encontrada.</p>';
        return;
    }

    container.innerHTML = equipes.map(nome => {
        const logoSrc = (typeof getTeamLogoByAliases === 'function') ? getTeamLogoByAliases(nome) : (logos[nome] || 'escudo.webp');
        // Conta títulos desta equipe
        const nTitulos = (titlesData.coletivos || []).filter(t => t.team.toUpperCase() === nome.toUpperCase()).length;
        const resultados = dbResults[nome] || [];
        const nTorneios = resultados.length;
        const badge = nTitulos > 0 ? `<div style="margin-top: 8px;"><span style="background: rgba(255,215,0,0.15); color: #ffd700; font-size: 0.75em; font-weight: bold; padding: 3px 10px; border-radius: 10px; border: 1px solid #ffd700; display: inline-block; white-space: nowrap;">🏆 ${nTitulos} título${nTitulos > 1 ? 's' : ''}</span></div>` : '';
         return `
        <div class="team-item-card" onclick="openOutraEquipe('${nome.replace(/'/g, "\\'")}')">
            <img src="${logoSrc}" alt="${nome}" onerror="this.src='escudo.webp'">
            <h4>${nome}</h4>
            <div style="margin-bottom: 2px;"><span>${nTorneios} resultado${nTorneios !== 1 ? 's' : ''}</span></div>
            ${badge}
        </div>`;
    }).join('');
}

async function openOutraEquipe(nome) {
    await loadResults();
    await loadTeamAliases();
    if (typeof loadNovosTorneios === 'function' && (typeof novosTorneiosLoaded === 'undefined' || !novosTorneiosLoaded)) {
        await loadNovosTorneios();
    }

    const canonicalName = getTeamCanonicalName(nome);
    currentOutraEquipe = canonicalName;
    document.getElementById('oep-name').innerText = canonicalName;
    document.getElementById('oep-logo').src = (typeof getTeamLogoByAliases === 'function') ? getTeamLogoByAliases(canonicalName || nome) : (logos[canonicalName] || logos[nome] || 'escudo.webp');

    // Reseta filtros
    const yearEl = document.getElementById('oep-filter-year');
    const tierEl = document.getElementById('oep-filter-tier');
    if (yearEl) yearEl.value = 'all';
    if (tierEl) tierEl.value = 'all';

    // Títulos coletivos e individuais da organização
    const aliasSet = getTeamAliasSet(canonicalName);
    const titulosStatic = (titlesData.coletivos || []).filter(t => aliasSet.has(normalizeTeamAlias(t.team)));
    const titulosNovos = (typeof getNovosTorneiosCollectiveTitlesForTeam === 'function') ? getNovosTorneiosCollectiveTitlesForTeam(canonicalName) : [];
    const premiosIndividuais = (typeof getNovosTorneiosIndividualAwardsForTeam === 'function') ? getNovosTorneiosIndividualAwardsForTeam(canonicalName) : [];
    const titulos = [...titulosStatic, ...titulosNovos];
    const titulosSection = document.getElementById('oep-titulos-section');
    const titulosContainer = document.getElementById('oep-titulos-container');
    if (titulos.length > 0 || premiosIndividuais.length > 0) {
        titulosSection.style.display = 'block';
        const coletivosHtml = titulos.length ? `<div style="width:100%; color:#ffd700; font-weight:900; text-transform:uppercase; letter-spacing:1px;">Títulos coletivos</div>` + titulos.map(t => buildUnifiedTrophyCard(t)).join('') : '';
        const individuaisHtml = premiosIndividuais.length ? `<div style="width:100%; color:var(--accent); font-weight:900; text-transform:uppercase; letter-spacing:1px; margin-top:10px;">Títulos individuais</div>` + premiosIndividuais.map(t => buildUnifiedTrophyCard(t, { showPlayer: true })).join('') : '';
        titulosContainer.innerHTML = coletivosHtml + individuaisHtml;
    } else {
        titulosSection.style.display = 'none';
    }

    renderOutraEquipeResultados();
    navigate('outras-equipes-profile');
}

function renderOutraEquipeResultados() {
    const nome = currentOutraEquipe;
    if (!nome) return;

    const tbody = document.querySelector('#table-outra-equipe-results tbody');
    const yearFilter = document.getElementById('oep-filter-year')?.value || 'all';
    const tierFilter = document.getElementById('oep-filter-tier')?.value || 'all';

    let results = [
        ...getResultsByTeamAliases(nome),
        ...getNovosTorneiosResultsForTeam(nome)
    ];

    if (tierFilter !== 'all') results = results.filter(r => r.tier === tierFilter);
    if (yearFilter !== 'all') results = results.filter(r => r.data.startsWith(yearFilter));

    // Conta medalhas
    let c1 = 0, c2 = 0, c3 = 0;
    results.forEach(r => {
        if (r.place === '1st' || r.place === '1º') c1++;
        else if (r.place === '2nd' || r.place === '2º') c2++;
        else if (r.place === '3rd' || r.place === '3º') c3++;
    });
    const el1 = document.getElementById('oep-count-1st');
    const el2 = document.getElementById('oep-count-2nd');
    const el3 = document.getElementById('oep-count-3rd');
    if (el1) el1.innerText = c1;
    if (el2) el2.innerText = c2;
    if (el3) el3.innerText = c3;

    if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="color:#aaa; padding:30px; text-align:center;">Nenhum resultado encontrado.</td></tr>';
        return;
    }

    results.sort((a, b) => new Date(b.data) - new Date(a.data));

    tbody.innerHTML = results.map(r => {
        const isFirst = r.place === '1st' || r.place === '1º';
        const tierClass = r.tier.toLowerCase().split('-')[0];
        const isSTier = r.tier === 'S-Tier';
        const placeBR = r.place.replace(/st|nd|rd|th/ig, 'º');
        const placeStyle = isFirst ? 'color: #ffd700; text-shadow: 0 0 8px rgba(255,215,0,0.5);' : '';
        const hasTournamentPage = !!findTournamentInDB(r.torneio) || !!findNovoTorneioByName(r.torneio) || !!r.novoTorneioId;
        const torneioSafe = String(r.torneio || '').replace(/'/g, "\\'");
        const novoIdSafe = String(r.novoTorneioId || '').replace(/'/g, "\\'");
        const torneioCell = hasTournamentPage
            ? `<span onclick="openAnyTournamentPage('${torneioSafe}', '${novoIdSafe}')" style="cursor:pointer; color: var(--accent); text-decoration: underline; text-decoration-style: dotted;" title="Ver página do torneio">${r.torneio} 🔗</span>`
            : r.torneio;
        return `<tr class="${isSTier ? 'row-tier-s' : ''}">
            <td style="color: var(--text-muted);">${r.data}</td>
            <td class="tier-${tierClass}">${r.tier}</td>
            <td style="font-weight: bold; font-size: 1.1em; ${placeStyle}">${placeBR}</td>
            <td style="text-align: left; font-weight: ${isSTier ? 'bold' : 'normal'}; ${isSTier ? 'color:#fff;' : ''}">${torneioCell}</td>
        </tr>`;
    }).join('');
}

// LOGOS DE LIGAS — carrega do Google Sheets
// Aba com colunas: nome_torneio | logo_url
// "nome_torneio" pode ser o nome completo ou parte dele (ex: "LBFF 8", "Copa Tal 2025")
async function loadLeagueLogos() {
    // TROQUE pelo link TSV da sua aba de logos de torneios (mude o gid= para o ID correto)
    const LOGOS_TSV_URL = window.CFF_CONFIG.sheets.logosOutrasEquipes;

    try {
        const res = await fetch(`${LOGOS_TSV_URL}&nocache=${new Date().getTime()}`);
        const tsvText = await res.text();
        const lines = tsvText.split('\n').slice(1); // Pula o cabeçalho

        leagueLogos = {};
        lines.forEach(line => {
            const cols = line.split('\t');
            const nome = cols[0]?.trim().replace(/\r/g, '').toUpperCase();
            const url  = cols[1]?.trim().replace(/\r/g, '');
            if (nome && url) {
                leagueLogos[nome] = url;
            }
        });

        console.log(`✅ ${Object.keys(leagueLogos).length} logo(s) de liga/torneio carregado(s)!`);

        // Re-renderiza as telas que usam logos de torneio, se já estiverem abertas
        renderOutrosTorneiosList();

    } catch (e) {
        console.error('[loadLeagueLogos] Erro:', e);
    }
}

// NAVEGAÇÃO DIRETA PARA TORNEIO
// Verifica se o torneio existe em dbCampeonatos e abre ele diretamente
function findTournamentInDB(eventName) {
    if (!eventName) return null;
    const upper = String(eventName).toUpperCase().trim();

    const novo = getNovosTorneiosSafeList().find(t => {
        const tUpper = getNovoTorneioName(t).toUpperCase().trim();
        return tUpper === upper || tUpper.includes(upper) || upper.includes(tUpper);
    });
    if (novo) return { ...novo, __novoTorneio: true };

    if (!dbCampeonatos || dbCampeonatos.length === 0) return null;
    return dbCampeonatos.find(t => {
        const tUpper = t.torneio.toUpperCase().trim();
        return tUpper === upper || tUpper.includes(upper) || upper.includes(tUpper);
    }) || null;
}

function navigateToTournament(eventName) {
    const t = findTournamentInDB(eventName);
    if (!t) return;
    const modal = document.getElementById('results-modal');
    if (modal && modal.classList.contains('active')) modal.classList.remove('active');

    navigate('outros-torneios');
    if (typeof renderOutrosTorneiosList === 'function') renderOutrosTorneiosList();
    setTimeout(() => {
        if (t.__novoTorneio && typeof openOtherTournament === 'function') openOtherTournament(t.id);
        else if (typeof openTournamentDetails === 'function') openTournamentDetails(t.id);
        else if (typeof openOtherTournament === 'function') openOtherTournament(t.id);
    }, 80);
}

// Função auxiliar global para resolver a imagem de um torneio.
// Prioridade: 1) Planilha (leagueLogos)  2) Arquivo local hardcoded  3) Fallback trofeu.webp
function resolveLeagueLogo(nomeEvento) {
    if (!nomeEvento) return 'trofeu.webp';
    const upper = nomeEvento.toUpperCase().trim();

    // 1. Tenta match exato no dicionário da planilha
    if (leagueLogos[upper]) return leagueLogos[upper];

    // 2. Tenta match parcial SEGURO:
    //    A chave da planilha deve estar CONTIDA no nome do evento (não o contrário)
    //    E a chave deve ter pelo menos 5 caracteres para evitar matches acidentais
    let bestMatch = null;
    let bestLen = 0;
    for (let chave in leagueLogos) {
        if (chave.length >= 5 && upper.includes(chave) && chave.length > bestLen) {
            bestMatch = chave;
            bestLen = chave.length;
        }
    }
    if (bestMatch) return leagueLogos[bestMatch];

    // 3. Fallback: lógica hardcoded original (WB, Copa FF, LBFF)
    if (upper.includes('WB')) return 'wb.webp';
    if (upper.includes('LBFF')) return 'lbff.webp';
    if (upper.includes('C.O.P.A') || upper.includes('COPA FF') || upper.includes('COPA FREE')) {
        if (upper.includes('2020')) return 'copaff20.webp';
        if (upper.includes('2022')) return 'copaff22.webp';
        if (upper.includes('2023')) return 'copaff23.webp';
        if (upper.includes('2024')) return 'copaff24.webp';
        if (upper.includes('2025')) return 'copaff25.webp';
        if (upper.includes('2026')) return 'copaff26.webp';
        return 'copaff.webp';
    }
    return 'trofeu.webp';
}

// SISTEMA DE LIVES — carrega de lives.json
// Para ativar uma live: mude "ativo": false → true
// Para adicionar uma live nova: adicione um objeto ao array
// Variável global para guardar as lives
let globalLivesData = [];

async function loadLives() {
    // SEU LINK DA PLANILHA (Mantive o que você já mandou)
    const LIVES_TSV_URL = window.CFF_CONFIG.sheets.lives;

    try {
        const res = await fetch(`${LIVES_TSV_URL}&nocache=${new Date().getTime()}`);
        const tsvText = await res.text();
        const lines = tsvText.split('\n');

        // Pega os dados da planilha
        globalLivesData = lines.slice(1).map((line, index) => {
            const data = line.split('\t');
            return {
                id: 'live-' + index, // Dá um ID único para o relógio conseguir achar o elemento
                titulo: data[0]?.trim().replace(/\r/g, ""),
                canal: data[1]?.trim().replace(/\r/g, ""),
                url: data[2]?.trim().replace(/\r/g, ""),
                categoria: data[3]?.trim().replace(/\r/g, "").toLowerCase() || 'recomendada',
                ativo: data[4]?.trim().toLowerCase().includes('true'),
                data_hora: data[5]?.trim().replace(/\r/g, ""), // Ex: 2026-04-24 13:00
                duracao: parseFloat(data[6]?.trim().replace(/\r/g, "")) || 0 // Ex: 4
            };
        }).filter(l => l.titulo && l.titulo.length > 2);

        // 1. Constrói o visual estático das lives
        buildLivesHTML();

        // 2. Ativa o cronômetro para atualizar o status a cada segundo
        if (!window.livesInterval) {
            window.livesInterval = setInterval(updateLivesTick, 1000);
        }
        updateLivesTick(); // Roda a primeira vez na hora para não esperar 1s

    } catch (e) {
        document.getElementById('lives-widget-container').innerHTML = '<div class="lives-empty">Erro ao carregar lives.</div>';
        console.error('[loadLives] Erro:', e);
    }
}

function buildLivesHTML() {
    if (globalLivesData.length === 0) return;

    globalLivesData.forEach(live => {
        const el = document.createElement('a');
        el.id = `${live.id}-link`;
        el.className = 'live-card offline';
        el.target = "_blank";
        el.innerHTML = `
            <div class="live-dot"></div>
            <div class="live-card-info">
                <div class="live-card-titulo">${live.titulo}</div>
                <div class="live-card-canal">${live.canal}</div>
            </div>
            <span id="${live.id}-badge" class="live-card-badge">Offline</span>
        `;
        live.element = el; // Guarda o elemento para o JS mover depois
        live.badgeElement = el.querySelector('.live-card-badge');
    });
}

function updateLivesTick() {
    const now = new Date();
    const containerOn = document.getElementById('lives-on-container');
    const containerUp = document.getElementById('lives-upcoming-container');
    if (!containerOn || !containerUp) return;

    let onCount = 0;
    let upCount = 0;
    const BADGE_LABELS = { oficial: '🔴 Oficial', amador: '🟢 Amador', recomendada:'🔵 Recomendada' };

    globalLivesData.forEach(live => {
        const linkEl = live.element;
        const badgeEl = live.badgeElement;
        if (!linkEl || !badgeEl) return;

        let isAutoLive = false;
        let isScheduled = false;
        let timeStr = "";

        if (live.data_hora && live.duracao > 0) {
            let dateStr = live.data_hora.trim().replace(' ', 'T');
            if (dateStr.length === 16) dateStr += ":00";
            const startTime = new Date(dateStr);
            const endTime = new Date(startTime.getTime() + (live.duracao * 60 * 60 * 1000));

            if (now >= startTime && now <= endTime) isAutoLive = true;
else if (now < startTime) {
    isScheduled = true;
    const diff = startTime - now;
    const d = Math.floor(diff / (1000 * 60 * 60 * 24)); // Calcula os dias
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    // Formata a string colocando os zeros à esquerda
    const hStr = h.toString().padStart(2, '0');
    const mStr = m.toString().padStart(2, '0');
    const sStr = s.toString().padStart(2, '0');

    // Se faltar mais de 1 dia, exibe "Xd HH:MM:SS", se não, exibe só "HH:MM:SS"
    timeStr = d > 0 ? `${d}d ${hStr}:${mStr}:${sStr}` : `${hStr}:${mStr}:${sStr}`;
}
        }

        // Define Status e move para a caixa correta
        if (live.ativo || isAutoLive) {
            linkEl.className = `live-card ativo ${live.categoria}`;
            badgeEl.innerText = BADGE_LABELS[live.categoria] || 'AO VIVO';
            linkEl.href = live.url;
            if (linkEl.parentElement !== containerOn) containerOn.appendChild(linkEl);
            onCount++;
        } else if (isScheduled) {
            linkEl.className = 'live-card agendado';
            badgeEl.innerText = `⏳ ${timeStr}`;
            linkEl.href = live.url;
            if (linkEl.parentElement !== containerUp) containerUp.appendChild(linkEl);
            upCount++;
        } else {
            // Live já encerrada ou sem agendamento ativo: não aparece mais em Agendadas/Offline.
            linkEl.className = 'live-card offline live-card-hidden';
            badgeEl.innerText = 'Offline';
            linkEl.removeAttribute('href');
            if (linkEl.parentElement) linkEl.parentElement.removeChild(linkEl);
        }
    });

    document.getElementById('lives-on-empty').style.display = (onCount === 0) ? 'block' : 'none';
    document.getElementById('lives-up-empty').style.display = (upCount === 0) ? 'block' : 'none';
}

async function loadPhotos() {
    if (window.__cffPhotosPromise) return window.__cffPhotosPromise;

    window.__cffPhotosPromise = (async () => {
        // COLE AQUI O LINK TSV DA SUA ABA DE FOTOS (mude o GID)
        const PHOTOS_TSV_URL = window.CFF_CONFIG.sheets.fotosJogadores;

        try {
            const res = await fetch(`${PHOTOS_TSV_URL}&nocache=${new Date().getTime()}`);
            const tsvText = await res.text();
            const lines = tsvText.split('\n');

            // Opcional: limpa as fotos atuais antes de carregar as novas
            // playerPhotos = {};
            // staffPhotos = {};

            lines.slice(1).forEach(line => {
                const data = line.split('\t');
                const nome = data[0]?.trim().replace(/\r/g, "");
                const urlFoto = data[1]?.trim().replace(/\r/g, "");
                const tipo = data[2]?.trim().replace(/\r/g, "").toLowerCase(); // 'player' ou 'staff'

                if (nome && urlFoto) {
                    if (tipo === 'staff') {
                        staffPhotos[nome] = urlFoto;
                    } else {
                        playerPhotos[nome] = urlFoto;
                    }
                }
            });

            console.log("Fotos carregadas com sucesso!");

            // Re-renderiza blocos que podem ter aberto antes do carregamento das fotos.
            if (typeof mercadoHasLoaded !== 'undefined' && mercadoHasLoaded) {
                if (typeof renderMercado === 'function') renderMercado();
                if (typeof renderHomeMercadoResumo === 'function') renderHomeMercadoResumo();
            }

        } catch (e) {
            console.error('[loadPhotos] Erro ao carregar fotos:', e);
        }
    })();

    return window.__cffPhotosPromise;
}

async function loadSocials() {
    // COLE AQUI O LINK TSV DA SUA ABA DE REDES SOCIAIS
    const SOCIALS_TSV_URL = window.CFF_CONFIG.sheets.redesSociais;

    try {
        const res = await fetch(`${SOCIALS_TSV_URL}&nocache=${new Date().getTime()}`);
        const tsvText = await res.text();
        const lines = tsvText.split('\n');

        // Limpa o objeto antes de preencher
        dbSocials = {};

        // Ignora o cabeçalho (linha 0) e processa o resto
        lines.slice(1).forEach(line => {
            const data = line.split('\t');
            const nome = data[0]?.trim().replace(/\r/g, "");
            const insta = data[1]?.trim().replace(/\r/g, "");

            // Se tiver nome e instagram preenchidos, adiciona ao nosso banco de dados
            if (nome && insta) {
                dbSocials[nome] = insta;
            }
        });

        console.log("Redes sociais carregadas com sucesso!", dbSocials);

    } catch (e) {
        console.error('[loadSocials] Erro ao carregar redes sociais:', e);
    }
}



// =============================================
// RESUMO AUTOMÁTICO DO PRÓXIMO CONFRONTO
// =============================================
function cffHomeEscapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
}

function cffParseBRMatchDate(dateStr) {
    const months = {
        'janeiro': 0, 'fevereiro': 1, 'marco': 2, 'março': 2, 'abril': 3,
        'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8,
        'outubro': 9, 'novembro': 10, 'dezembro': 11
    };
    const clean = String(dateStr || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const dayMatch = clean.match(/(\d{1,2})/);
    const monthKey = Object.keys(months).find(m => clean.includes(m.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
    const day = dayMatch ? parseInt(dayMatch[1], 10) : 1;
    const month = monthKey ? months[monthKey] : 0;
    return new Date(2026, month, day, 13, 0, 0);
}

function getNextHomeConfrontationMatch() {
    if (typeof agenda === 'undefined' || !Array.isArray(agenda) || !agenda.length) return null;
    const now = new Date();
    return agenda.find(match => {
        const endTime = new Date(cffParseBRMatchDate(match.data).getTime() + (3.5 * 60 * 60 * 1000));
        return endTime > now;
    }) || agenda[agenda.length - 1];
}

function getHomeConfrontationTeams(match) {
    if (!match || typeof db === 'undefined' || !Array.isArray(db.teams)) return [];
    return db.teams.filter(team => match.grupos.includes(team.grupo));
}

function getCffTeamGroupMap() {
    const map = {};
    if (typeof db === 'undefined' || !Array.isArray(db.teams)) return map;

    db.teams.forEach(team => {
        const name = String(team.equipe || '').toUpperCase().trim();
        if (name) map[name] = String(team.grupo || '').toUpperCase().trim();
    });

    return map;
}

function cffSameGroupSet(a, b) {
    const aa = [...new Set((a || []).map(g => String(g).toUpperCase().trim()).filter(Boolean))].sort();
    const bb = [...new Set((b || []).map(g => String(g).toUpperCase().trim()).filter(Boolean))].sort();
    return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
}

function getHomeConfrontationDays(matchGroups) {
    const targetGroups = [...new Set((matchGroups || []).map(g => String(g).toUpperCase().trim()).filter(Boolean))];
    const groupMap = getCffTeamGroupMap();
    const validDays = [];

    if (!targetGroups.length || typeof dbQuedas === 'undefined') return validDays;

    Object.entries(dbQuedas || {}).forEach(([dayKey, dayDrops]) => {
        const foundGroups = new Set();

        Object.values(dayDrops || {}).forEach(drop => {
            (drop.resultados || []).forEach(result => {
                const teamName = String(result.equipe || '').toUpperCase().trim();
                const group = groupMap[teamName];
                if (group) foundGroups.add(group);
            });
        });

        // Só entra se o dia foi exatamente daquele confronto de grupos.
        // Exemplo: próximo jogo B x C x D => pega apenas dias em que jogaram B, C e D.
        if (cffSameGroupSet([...foundGroups], targetGroups)) {
            validDays.push(String(dayKey));
        }
    });

    return validDays;
}

function getHomeConfrontationTeamStats(teamNames, matchGroups) {
    const target = new Set(teamNames.map(t => String(t).toUpperCase().trim()));
    const validDays = getHomeConfrontationDays(matchGroups);
    const stats = {};

    teamNames.forEach(team => {
        stats[team] = { equipe: team, pontos: 0, abates: 0, booyah: 0, quedas: 0 };
    });

    if (typeof dbQuedas === 'undefined' || !validDays.length) return Object.values(stats);

    validDays.forEach(dayKey => {
        const dayDrops = dbQuedas[dayKey];
        Object.values(dayDrops || {}).forEach(drop => {
            (drop.resultados || []).forEach(result => {
                const teamName = String(result.equipe || '').toUpperCase().trim();
                if (!target.has(teamName)) return;

                const key = teamNames.find(t => String(t).toUpperCase().trim() === teamName) || result.equipe;
                if (!stats[key]) stats[key] = { equipe: key, pontos: 0, abates: 0, booyah: 0, quedas: 0 };

                const positionPoints = (typeof posPoints !== 'undefined' ? posPoints[result.posicao] : 0) || 0;
                stats[key].pontos += positionPoints + (Number(result.kills) || 0);
                stats[key].abates += Number(result.kills) || 0;
                stats[key].booyah += Number(result.booyah) || 0;
                stats[key].quedas += 1;
            });
        });
    });

    return Object.values(stats)
        .filter(t => t.quedas > 0)
        .sort((a, b) => b.pontos - a.pontos || b.abates - a.abates || b.booyah - a.booyah);
}

function getHomeConfrontationPlayerStats(teamNames, matchGroups) {
    const target = new Set(teamNames.map(t => String(t).toUpperCase().trim()));
    const validDays = getHomeConfrontationDays(matchGroups);
    const stats = {};

    if (typeof dbJogadoresQuedas === 'undefined' || !validDays.length) return [];

    validDays.forEach(dayKey => {
        const dayPlayers = dbJogadoresQuedas[dayKey];
        Object.values(dayPlayers || {}).forEach(dropPlayers => {
            (dropPlayers || []).forEach(p => {
                const teamName = String(p.equipe || '').toUpperCase().trim();
                if (!target.has(teamName)) return;

                const playerName = p.nome || p.jogador || '';
                const key = `${playerName}__${p.equipe}`;
                if (!stats[key]) {
                    stats[key] = { jogador: playerName, equipe: p.equipe, abates: 0, dano: 0, quedas: 0 };
                }

                stats[key].abates += Number(p.kills ?? p.abates) || 0;
                stats[key].dano += Number(p.dano) || 0;
                stats[key].quedas += 1;
            });
        });
    });

    return Object.values(stats).sort((a, b) => b.abates - a.abates || b.dano - a.dano);
}

function formatHomeCompactNumber(value) {
    const num = Number(value) || 0;
    if (num >= 1000) return `${Math.round(num / 1000)}k`;
    return String(num);
}

function buildHomeConfrontationText(teamStats, playerStats, groupsText, confrontationDays) {
    const bestTeam = teamStats[0];
    const bestKiller = playerStats[0];
    const bestDamage = [...playerStats].sort((a, b) => b.dano - a.dano)[0];
    const daysLabel = confrontationDays && confrontationDays.length ? `${confrontationDays.length} dia(s)` : 'nenhum dia registrado';

    if (!bestTeam || !bestKiller) {
        return `Ainda não há dados suficientes somente do confronto ${groupsText}. Foram encontrados ${daysLabel} para esse recorte.`;
    }

    let text = `${bestTeam.equipe} é a melhor equipe especificamente no confronto ${groupsText}, somando ${bestTeam.pontos} pontos, ${bestTeam.abates} abates e ${bestTeam.booyah} booyah(s) neste recorte.`;
    if (bestKiller && bestDamage && bestKiller.jogador === bestDamage.jogador) {
        text += ` ${bestKiller.jogador} é o destruidor desse confronto: lidera em abates e também aparece como grande nome em dano.`;
    } else {
        text += ` ${bestKiller.jogador} lidera os abates do confronto, enquanto ${bestDamage.jogador} aparece como o maior causador de dano.`;
    }
    return text;
}

function ensureHomeConfrontationSummaryModal() {
    if (document.getElementById('home-confrontation-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'home-confrontation-modal';
    modal.className = 'modal-overlay home-confrontation-modal';
    modal.onclick = event => {
        if (event.target === modal) closeHomeConfrontationSummary();
    };
    modal.innerHTML = `
        <div class="modal-content home-confrontation-content">
            <div class="modal-header">
                <h2 id="home-confrontation-title">Resumo do confronto</h2>
                <button class="close-btn" aria-label="Fechar" onclick="closeHomeConfrontationSummary()">&times;</button>
            </div>
            <div id="home-confrontation-body"></div>
        </div>`;
    document.body.appendChild(modal);
}

function openHomeFinalPossibilitiesPage() {
    if (typeof navigate === 'function') {
        navigate('final');
    } else {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        const finalPage = document.getElementById('final');
        if (finalPage) finalPage.classList.add('active');
    }

    setTimeout(function () {
        if (typeof renderFinalPossibilities === 'function') {
            renderFinalPossibilities();
        }
    }, 80);
}

function ensureHomeConfrontationSummaryButton() {
    // Reaproveita o botão que já existe na Home, mantendo o mesmo CSS/cor.
    const possibleButtons = Array.from(document.querySelectorAll('button, a')).filter(el => {
        const txt = (el.textContent || '').trim().toLowerCase();
        const onclick = el.getAttribute('onclick') || '';
        return txt.includes('resumo do confronto') ||
               txt.includes('possibilidade da final') ||
               txt.includes('possibilidade das finais') ||
               txt.includes('probabilidades da final') ||
               onclick.includes('openHomeConfrontoResumoModal') ||
               onclick.includes('openHomeConfrontationSummary') ||
               onclick.includes("navigate('final')");
    });

    const existing = possibleButtons[0] || document.getElementById('home-confrontation-main-btn');

    if (existing) {
        existing.id = existing.id || 'home-confrontation-main-btn';
        existing.classList.add('home-confrontation-summary-btn');
        existing.removeAttribute('onclick');
        existing.onclick = openHomeFinalPossibilitiesPage;
        existing.innerHTML = '🏆 PROBABILIDADES DA FINAL';
        return;
    }

    const liveBtn = document.getElementById('home-live-btn');
    const groupsEl = document.getElementById('home-next-groups');
    const anchor = liveBtn || groupsEl;
    if (!anchor || document.getElementById('home-confrontation-main-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'home-confrontation-main-btn';
    btn.type = 'button';
    btn.className = 'home-confrontation-summary-btn';
    btn.innerHTML = '🏆 PROBABILIDADES DA FINAL';
    btn.onclick = openHomeFinalPossibilitiesPage;
    anchor.insertAdjacentElement('afterend', btn);
}

function openHomeConfrontationSummary() {
    openHomeFinalPossibilitiesPage();
}


function closeHomeConfrontationSummary() {
    const modal = document.getElementById('home-confrontation-modal');
    if (modal) modal.classList.remove('active');
}


// =============================================
// COMPATIBILIDADE / LIMPEZA DO BOTÃO DA HOME
// =============================================
window.openHomeConfrontoResumoModal = function () {
    if (typeof openHomeConfrontationSummary === 'function') {
        openHomeConfrontationSummary();
        return;
    }
    console.error('openHomeConfrontationSummary não encontrada.');
};

window.closeHomeConfrontoResumoModal = function () {
    if (typeof closeHomeConfrontationSummary === 'function') {
        closeHomeConfrontationSummary();
        return;
    }
    console.error('closeHomeConfrontationSummary não encontrada.');
};

document.addEventListener('DOMContentLoaded', function () {
    if (typeof ensureHomeConfrontationSummaryButton === 'function') {
        setTimeout(ensureHomeConfrontationSummaryButton, 250);
    }
});


window.openHomeFinalPossibilitiesPage = openHomeFinalPossibilitiesPage;
window.openHomeConfrontationSummary = openHomeConfrontationSummary;
// Também tenta de novo depois, porque a Home monta partes via JS.
setTimeout(function () {
    if (typeof ensureHomeConfrontationSummaryButton === 'function') {
        ensureHomeConfrontationSummaryButton();
    }
}, 1200);


// =============================================
// FINAL WB 2026 S1 - POSSIBILIDADES
// =============================================
function cffFinalGetQualifiedTeams() {
    if (typeof db === 'undefined' || !Array.isArray(db.teams)) return [];
    return [...db.teams]
        .filter(t => Number(t.pontos) > 0)
        .sort((a, b) => (Number(b.pontos) || 0) - (Number(a.pontos) || 0) || (Number(b.abates) || 0) - (Number(a.abates) || 0))
        .slice(0, 12);
}

function cffFinalTeamRecentPoints(teamName) {
    const daily = (db.teamDaily && db.teamDaily[teamName]) ? db.teamDaily[teamName] : [];
    if (!daily.length) return 0;
    const sorted = [...daily].sort((a, b) => Number(a.dia) - Number(b.dia));
    const recent = sorted.slice(-4);
    return recent.reduce((sum, d) => sum + (Number(d.pontos) || 0), 0) / Math.max(1, recent.length);
}

function cffFinalTeamConsistency(teamName) {
    const daily = (db.teamDaily && db.teamDaily[teamName]) ? db.teamDaily[teamName] : [];
    if (daily.length < 2) return 0.5;
    const pts = daily.map(d => Number(d.pontos) || 0).filter(v => v >= 0);
    const avg = pts.reduce((s, v) => s + v, 0) / Math.max(1, pts.length);
    const variance = pts.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / Math.max(1, pts.length);
    const sd = Math.sqrt(variance);
    return Math.max(0.2, Math.min(1, 1 - (sd / Math.max(1, avg * 1.65))));
}

function cffFinalCalculateProbabilities() {
    const teams = cffFinalGetQualifiedTeams();
    if (!teams.length) return [];

    const maxPts = Math.max(...teams.map(t => Number(t.pontos) || 0), 1);
    const maxKills = Math.max(...teams.map(t => Number(t.abates) || 0), 1);
    const maxBooyah = Math.max(...teams.map(t => Number(t.booyah) || 0), 1);
    const recentMap = Object.fromEntries(teams.map(t => [t.equipe, cffFinalTeamRecentPoints(t.equipe)]));
    const maxRecent = Math.max(...Object.values(recentMap), 1);

    const rows = teams.map((team, index) => {
        const pontos = Number(team.pontos) || 0;
        const kills = Number(team.abates) || 0;
        const booyah = Number(team.booyah) || 0;
        const quedas = Number(team.quedas) || 0;
        const avg = quedas ? pontos / quedas : 0;
        const pointsPower = Math.pow(Math.max(0.01, pontos / maxPts), 2.6);
        const killFactor = 0.88 + 0.18 * (kills / maxKills);
        const booyahFactor = 0.94 + 0.10 * (booyah / maxBooyah);
        const recentFactor = 0.88 + 0.18 * ((recentMap[team.equipe] || 0) / maxRecent);
        const consistencyFactor = 0.92 + 0.10 * cffFinalTeamConsistency(team.equipe);
        const rankProtection = 1 + Math.max(0, (12 - index)) * 0.006;
        const score = pointsPower * killFactor * booyahFactor * recentFactor * consistencyFactor * rankProtection;
        return { ...team, rank: index + 1, avg, score };
    });

    const totalScore = rows.reduce((sum, r) => sum + r.score, 0) || 1;
    return rows.map(r => ({ ...r, probability: (r.score / totalScore) * 100 }));
}

function cffFinalBestPlayers(qualifiedTeams) {
    const teamSet = new Set(qualifiedTeams.map(t => String(t.equipe).toUpperCase()));
    return [...(db.players || [])]
        .filter(p => !p.isEx && teamSet.has(String(p.equipe || '').toUpperCase()))
        .sort((a, b) => (Number(b.abates) || 0) - (Number(a.abates) || 0) || (Number(b.dano) || 0) - (Number(a.dano) || 0))
        .slice(0, 10);
}



// =============================================
// PATCH FINAL WB - LEITURA DE dados-final.json + CHAMPION POINT
// =============================================
function cffFinalEscapeTeamForClick(team) {
    return cffHomeEscapeHTML(String(team || '').replace(/'/g, "\\'"));
}

function cffFinalGetRawDrops() {
    return (typeof dbFinalQuedas !== 'undefined' && cffHasDrops(dbFinalQuedas)) ? dbFinalQuedas : {};
}

function cffFinalHasRealData() {
    return cffHasDrops(cffFinalGetRawDrops());
}

function cffFinalGetFilterValues() {
    return {
        day: document.getElementById('final-day-filter')?.value || 'all',
        map: normalizeMapName(document.getElementById('final-map-filter')?.value || 'all'),
        drop: document.getElementById('final-drop-filter')?.value || 'all'
    };
}

function cffFinalHasActiveTableFilter() {
    const filters = cffFinalGetFilterValues();
    return filters.day !== 'all' || filters.map !== 'all' || filters.drop !== 'all';
}

function cffFinalGetOrderedDropList() {
    const rawDrops = cffFinalGetRawDrops();
    const drops = [];

    Object.keys(rawDrops || {}).sort((a, b) => Number(a) - Number(b)).forEach(day => {
        Object.keys(rawDrops[day] || {}).sort((a, b) => Number(a) - Number(b)).forEach(round => {
            const drop = rawDrops[day][round] || {};
            drops.push({
                day: String(day),
                round: String(round),
                value: `${day}-${round}`,
                mapa: drop.mapa || ''
            });
        });
    });

    return drops;
}

function cffFinalUpdateDropFilterOptions(keepCurrent = true) {
    const select = document.getElementById('final-drop-filter');
    if (!select) return;

    const currentValue = keepCurrent ? select.value : 'all';
    const selectedDay = document.getElementById('final-day-filter')?.value || 'all';
    const drops = cffFinalGetOrderedDropList().filter(drop => selectedDay === 'all' || drop.day === String(selectedDay));

    select.innerHTML = '<option value="all">Todas as quedas do período</option>';
    drops.forEach(drop => {
        const opt = document.createElement('option');
        opt.value = drop.value;
        opt.textContent = `Dia ${drop.day} - Queda ${drop.round}${drop.mapa ? ` (${drop.mapa})` : ''}`;
        select.appendChild(opt);
    });

    const hasCurrent = Array.from(select.options).some(opt => opt.value === currentValue);
    select.value = hasCurrent ? currentValue : 'all';
}

function cffFinalOnDayFilterChanged() {
    cffFinalUpdateDropFilterOptions(false);
    renderFinalPossibilities();
}

function cffFinalOnMapFilterChanged() {
    const dropSelect = document.getElementById('final-drop-filter');
    if (dropSelect) dropSelect.value = 'all';
    renderFinalPossibilities();
}

function cffFinalOnDropFilterChanged() {
    const dropSelect = document.getElementById('final-drop-filter');
    const mapSelect = document.getElementById('final-map-filter');
    if (dropSelect && dropSelect.value !== 'all' && mapSelect) mapSelect.value = 'all';
    renderFinalPossibilities();
}

function cffFinalQualifiedBaseRows() {
    return cffFinalGetQualifiedTeams().map((t, index) => ({
        equipe: t.equipe,
        rank: index + 1,
        pontos: 0,
        abates: 0,
        booyah: 0,
        quedas: 0,
        avg: 0,
        probability: 0,
        source: 'pre-final'
    }));
}

function cffFinalIsFluxoW7M(team) {
    return normalizeTeamAlias(team) === normalizeTeamAlias('FLUXO W7M') ||
        normalizeTeamAlias(team) === normalizeTeamAlias('FLUXO') ||
        normalizeTeamAlias(team) === normalizeTeamAlias('FX W7M') ||
        normalizeTeamAlias(team) === normalizeTeamAlias('FX');
}

function cffFinalIsSameTeam(a, b) {
    if (!a || !b) return false;
    return normalizeTeamAlias(a) === normalizeTeamAlias(b);
}

function cffFinalGetEwcHighlightedTeams(rows, champion) {
    const highlights = new Set();
    const list = Array.isArray(rows) ? rows : [];

    const fluxo = list.find(t => cffFinalIsFluxoW7M(t.equipe));
    if (fluxo) highlights.add(normalizeTeamAlias(fluxo.equipe));

    const championTeam = champion?.equipe || '';
    if (championTeam) highlights.add(normalizeTeamAlias(championTeam));

    const nonFluxo = list.filter(t => !cffFinalIsFluxoW7M(t.equipe) && !cffFinalIsSameTeam(t.equipe, championTeam));
    const extraSlots = championTeam ? 1 : 2;
    nonFluxo.slice(0, extraSlots).forEach(t => highlights.add(normalizeTeamAlias(t.equipe)));

    return highlights;
}

function cffFinalBuildDisplayRows(rows, champion) {
    const list = Array.isArray(rows) ? rows : [];
    const championTeam = champion?.equipe || '';
    const canForceChampionFirst = championTeam && !cffFinalHasActiveTableFilter();

    let ordered = list;
    if (canForceChampionFirst) {
        const championRow = list.find(t => cffFinalIsSameTeam(t.equipe, championTeam));
        if (championRow) {
            ordered = [championRow, ...list.filter(t => !cffFinalIsSameTeam(t.equipe, championTeam))];
        }
    }

    const showChampionBadge = championTeam && !cffFinalHasActiveTableFilter();
    return ordered.map((t, idx) => ({ ...t, rank: idx + 1, isChampion: showChampionBadge && cffFinalIsSameTeam(t.equipe, championTeam) }));
}

function cffFinalEnsureTableLayout() {
    const table = document.getElementById('final-teams-table');
    if (!table) return;

    const headRow = table.querySelector('thead tr');
    if (headRow && !headRow.dataset.finalV4) {
        headRow.innerHTML = `
            <th>#</th>
            <th style="text-align:left;">Eqp</th>
            <th>Pts</th>
            <th>B!</th>
            <th>K</th>
            <th>Q</th>
        `;
        headRow.dataset.finalV4 = '1';
    }

    if (!document.getElementById('cff-final-ewc-style')) {
        const style = document.createElement('style');
        style.id = 'cff-final-ewc-style';
        style.textContent = `
            #final-teams-table td.final-ewc-marker {
                color: #4aa8ff !important;
                position: relative;
                font-weight: 950 !important;
                padding-left: 12px !important;
            }
            #final-teams-table td.final-ewc-marker::before {
                content: '';
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 5px;
                border-radius: 0 999px 999px 0;
                background: #4aa8ff;
            }
            #final-teams-table tbody tr.final-row-champion .team-cell::after {
                content: 'CAMPEÃO';
                margin-left: 8px;
                padding: 3px 7px;
                border-radius: 999px;
                border: 1px solid rgba(74,168,255,.45);
                background: rgba(74,168,255,.12);
                color: #4aa8ff;
                font-size: .62rem;
                font-weight: 950;
                letter-spacing: .5px;
            }
            @media (max-width: 768px) {
                #final-teams-table th:nth-child(3),
                #final-teams-table td:nth-child(3),
                #final-teams-table th:nth-child(4),
                #final-teams-table td:nth-child(4),
                #final-teams-table th:nth-child(5),
                #final-teams-table td:nth-child(5),
                #final-teams-table th:nth-child(6),
                #final-teams-table td:nth-child(6) { width: 38px !important; }
                #final-teams-table tbody tr.final-row-champion .team-cell::after { display: none; }
            }
        `;
        document.head.appendChild(style);
    }
}

function cffFinalSimulateChampion(rawDrops) {
    const scores = {};
    const ordered = [];
    Object.keys(rawDrops || {}).sort((a, b) => Number(a) - Number(b)).forEach(day => {
        Object.keys(rawDrops[day] || {}).sort((a, b) => Number(a) - Number(b)).forEach(round => {
            ordered.push({ day, round, drop: rawDrops[day][round] });
        });
    });

    for (const item of ordered) {
        const results = Array.isArray(item.drop?.resultados) ? item.drop.resultados : [];
        for (const res of results) {
            const team = res.equipe;
            const before = Number(scores[team] || 0);
            if (before >= CFF_FINAL_RULES.championPoint && Number(res.booyah) === 1) {
                return { equipe: team, day: item.day, round: item.round, mode: 'champion-point' };
            }
        }
        for (const res of results) {
            const team = res.equipe;
            scores[team] = Number(scores[team] || 0) + (Number(posPoints[res.posicao]) || 0) + (Number(res.kills) || 0);
        }
    }

    const playedDrops = ordered.length;
    if (playedDrops >= CFF_FINAL_RULES.totalDrops) {
        const leader = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
        if (leader) return { equipe: leader[0], mode: 'points', pontos: leader[1] };
    }
    return null;
}

function cffFinalGetClassificationPowerMap() {
    const qualified = cffFinalGetQualifiedTeams();
    if (!qualified.length) return {};

    const maxPts = Math.max(...qualified.map(t => Number(t.pontos) || 0), 1);
    const maxKills = Math.max(...qualified.map(t => Number(t.abates) || 0), 1);
    const maxBooyah = Math.max(...qualified.map(t => Number(t.booyah) || 0), 1);
    const recentMap = Object.fromEntries(qualified.map(t => [t.equipe, cffFinalTeamRecentPoints(t.equipe)]));
    const maxRecent = Math.max(...Object.values(recentMap), 1);

    const powers = {};
    qualified.forEach((team, index) => {
        const pontos = Number(team.pontos) || 0;
        const kills = Number(team.abates) || 0;
        const booyah = Number(team.booyah) || 0;
        const pointsPower = Math.pow(Math.max(0.01, pontos / maxPts), 2.35);
        const killFactor = 0.90 + 0.16 * (kills / maxKills);
        const booyahFactor = 0.94 + 0.12 * (booyah / maxBooyah);
        const recentFactor = 0.90 + 0.16 * ((recentMap[team.equipe] || 0) / maxRecent);
        const consistencyFactor = 0.92 + 0.10 * cffFinalTeamConsistency(team.equipe);
        const rankProtection = 1 + Math.max(0, (12 - index)) * 0.008;
        powers[String(team.equipe).toUpperCase()] = pointsPower * killFactor * booyahFactor * recentFactor * consistencyFactor * rankProtection;
    });

    return powers;
}

function cffFinalCalculateLivePossibilities(rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return [];

    const classPower = cffFinalGetClassificationPowerMap();
    const maxFinalPts = Math.max(...list.map(t => Number(t.pontos) || 0), 1);
    const maxFinalKills = Math.max(...list.map(t => Number(t.abates) || 0), 1);
    const maxFinalBooyah = Math.max(...list.map(t => Number(t.booyah) || 0), 1);
    const hasFinalPoints = list.some(t => (Number(t.pontos) || 0) > 0 || (Number(t.abates) || 0) > 0 || (Number(t.booyah) || 0) > 0);

    const scores = list.map(t => {
        const key = String(t.equipe || '').toUpperCase();
        const baseScore = Math.max(0.01, Number(classPower[key]) || 0.01);
        const pontos = Number(t.pontos) || 0;
        const kills = Number(t.abates) || 0;
        const booyah = Number(t.booyah) || 0;
        const cpProgress = Math.min(1.4, pontos / CFF_FINAL_RULES.championPoint);
        const cpPressure = pontos >= CFF_FINAL_RULES.championPoint ? 1.7 : 1 + cpProgress * 0.45;
        const finalPointsPower = hasFinalPoints ? Math.pow(Math.max(0.04, pontos / maxFinalPts), 2.05) : 0;
        const finalKillFactor = hasFinalPoints ? (0.88 + 0.18 * (kills / maxFinalKills)) : 1;
        const finalBooyahFactor = hasFinalPoints ? (0.94 + 0.16 * (booyah / maxFinalBooyah)) : 1;

        // Favoritismo público: base da classificatória + força real da final.
        // Antes da final começar, usa só a classificatória; conforme os pontos entram,
        // o peso da final cresce sem apagar quem chegou como favorito.
        const finalScore = hasFinalPoints ? finalPointsPower * finalKillFactor * finalBooyahFactor * cpPressure : 0;
        const score = hasFinalPoints ? (baseScore * 0.58) + (finalScore * 0.42) : baseScore;
        return { ...t, score };
    });

    const totalScore = scores.reduce((sum, t) => sum + (Number(t.score) || 0), 0) || 1;
    return scores
        .map(t => ({ ...t, probability: ((Number(t.score) || 0) / totalScore) * 100 }))
        .sort((a, b) => (Number(b.probability) || 0) - (Number(a.probability) || 0));
}

function cffFinalAggregateRows() {
    const rawDrops = cffFinalGetRawDrops();
    if (!cffFinalHasRealData()) return cffFinalQualifiedBaseRows();

    const filters = cffFinalGetFilterValues();
    const qualified = cffFinalGetQualifiedTeams();
    const allowed = new Set(qualified.map(t => String(t.equipe).toUpperCase()));
    const rows = {};

    qualified.forEach(t => {
        rows[t.equipe] = { equipe: t.equipe, pontos: 0, abates: 0, booyah: 0, quedas: 0, source: 'final' };
    });

    const addDropToRows = (drop) => {
        (drop?.resultados || []).forEach(res => {
            if (!allowed.has(String(res.equipe || '').toUpperCase())) return;
            if (!rows[res.equipe]) rows[res.equipe] = { equipe: res.equipe, pontos: 0, abates: 0, booyah: 0, quedas: 0, source: 'final' };
            rows[res.equipe].pontos += (Number(posPoints[res.posicao]) || 0) + (Number(res.kills) || 0);
            rows[res.equipe].abates += Number(res.kills) || 0;
            rows[res.equipe].booyah += Number(res.booyah) || 0;
            rows[res.equipe].quedas += 1;
        });
    };

    if (filters.drop !== 'all') {
        const [selectedDay, selectedRound] = String(filters.drop).split('-');
        addDropToRows(rawDrops?.[selectedDay]?.[selectedRound]);
    } else {
        Object.keys(rawDrops).sort((a, b) => Number(a) - Number(b)).forEach(day => {
            if (filters.day !== 'all' && String(day) !== String(filters.day)) return;
            Object.keys(rawDrops[day] || {}).sort((a, b) => Number(a) - Number(b)).forEach(round => {
                const drop = rawDrops[day][round];
                const mapName = normalizeMapName(drop?.mapa || '');
                if (filters.map !== 'all' && mapName !== filters.map) return;
                addDropToRows(drop);
            });
        });
    }

    return Object.values(rows)
        .map(t => {
            t.avg = t.quedas ? t.pontos / t.quedas : 0;
            return t;
        })
        .sort((a, b) => b.pontos - a.pontos || b.abates - a.abates)
        .map((t, idx) => ({ ...t, rank: idx + 1, probability: 0 }));
}

function cffFinalRenderSummary(rows) {
    const box = document.getElementById('final-live-summary');
    if (!box) return;
    const hasData = cffFinalHasRealData();
    const rawDrops = cffFinalGetRawDrops();
    const dropsPlayed = hasData ? Object.values(rawDrops).reduce((sum, day) => sum + Object.keys(day || {}).length, 0) : 0;
    const leader = rows[0];
    const champion = hasData ? cffFinalSimulateChampion(rawDrops) : null;
    box.innerHTML = `
        <strong>${champion ? `Campeão: ${cffHomeEscapeHTML(champion.equipe)}` : hasData ? `Líder atual: ${cffHomeEscapeHTML(leader?.equipe || '-')}` : 'Final zerada'}</strong>
        <span>${dropsPlayed}/${CFF_FINAL_RULES.totalDrops} quedas jogadas • Champion Point: ${CFF_FINAL_RULES.championPoint} pts${hasData && leader ? ` • ${leader.pontos} pts / ${leader.abates} K` : ''}</span>
    `;
}

function renderFinalPossibilities() {
    const probGrid = document.getElementById('final-probability-grid');
    const tableBody = document.querySelector('#final-teams-table tbody');
    if (!probGrid && !tableBody) return;

    cffFinalEnsureTableLayout();
    cffFinalUpdateDropFilterOptions(true);

    const hasFinalData = cffFinalHasRealData();
    const rawDrops = cffFinalGetRawDrops();
    const rows = hasFinalData ? cffFinalAggregateRows() : cffFinalQualifiedBaseRows();
    const champion = hasFinalData ? cffFinalSimulateChampion(rawDrops) : null;
    const displayRows = cffFinalBuildDisplayRows(rows, champion);
    const ewcHighlights = cffFinalHasActiveTableFilter() ? new Set() : cffFinalGetEwcHighlightedTeams(displayRows, champion);

    if (!rows.length) {
        if (probGrid) probGrid.innerHTML = '<div class="home-confrontation-empty">Ainda não foi possível montar a final.</div>';
        return;
    }

    cffFinalRenderSummary(displayRows);

    if (probGrid) {
        const probRows = cffFinalCalculateLivePossibilities(rows);
        probGrid.innerHTML = probRows.map((t, idx) => {
            const pct = Math.max(0, Number(t.probability) || 0);
            return `<button class="final-prob-card" onclick="openTeamProfile('${cffFinalEscapeTeamForClick(t.equipe)}')">
                <div class="final-prob-rank">${idx + 1}º</div>
                <img src="${getTeamLogoByAliases(t.equipe)}" onerror="this.src='escudo.webp'" alt="${cffHomeEscapeHTML(t.equipe)}">
                <div class="final-prob-info">
                    <strong>${cffHomeEscapeHTML(shortNames[t.equipe] || t.equipe)}</strong>
                    <span>${Number(t.pontos) || 0} pts • ${Number(t.booyah) || 0} B! • ${Number(t.abates) || 0} K • ${Number(t.quedas) || 0} Q</span>
                    <div class="final-prob-bar"><i style="width:${Math.min(100, pct).toFixed(1)}%"></i></div>
                </div>
                <b>${pct.toFixed(1)}%</b>
            </button>`;
        }).join('');
    }

    if (tableBody) {
        tableBody.innerHTML = displayRows.map(t => {
            const isEwc = ewcHighlights.has(normalizeTeamAlias(t.equipe));
            const rowClass = `${isEwc ? 'final-row-ewc' : ''} ${t.isChampion ? 'final-row-champion' : ''}`.trim();
            return `<tr class="${rowClass}">
                <td class="${isEwc ? 'final-ewc-marker' : ''}" style="color:${isEwc ? '#4aa8ff' : 'var(--accent)'}; font-weight:900;" title="${isEwc ? 'Vaga/slot EWC' : ''}">${t.rank}º</td>
                <td style="text-align:left;"><span class="team-cell clickable" onclick="openTeamProfile('${cffFinalEscapeTeamForClick(t.equipe)}')"><img class="team-logo" src="${getTeamLogoByAliases(t.equipe)}" onerror="this.src='escudo.webp'"><span class="full-name-desktop">${cffHomeEscapeHTML(t.equipe)}</span><span class="short-name-mobile">${cffHomeEscapeHTML(shortNames[t.equipe] || t.equipe)}</span></span></td>
                <td><strong>${Number(t.pontos) || 0}</strong></td>
                <td>${Number(t.booyah) || 0}</td>
                <td>${Number(t.abates) || 0}</td>
                <td>${Number(t.quedas) || 0}</td>
            </tr>`;
        }).join('');
    }
}

window.cffFinalOnDayFilterChanged = cffFinalOnDayFilterChanged;
window.cffFinalOnMapFilterChanged = cffFinalOnMapFilterChanged;
window.cffFinalOnDropFilterChanged = cffFinalOnDropFilterChanged;
window.renderFinalPossibilities = renderFinalPossibilities;
