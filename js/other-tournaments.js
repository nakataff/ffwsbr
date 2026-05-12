// ABA: OUTROS TORNEIOS — JSON por torneio

var dbNovosTorneios = window.dbNovosTorneios || [];
var currentOtTab = window.currentOtTab || 'standings';
var novosTorneiosLoaded = window.novosTorneiosLoaded || false;
var otShowRosters = window.otShowRosters || false;
var otFinalMatchFilter = window.otFinalMatchFilter || 'all';
var otMobileTeamShortNames = window.otMobileTeamShortNames || {};
var otMobileShortNamesLoaded = window.otMobileShortNamesLoaded || false;
var globalTeamAliasesMap = window.globalTeamAliasesMap || null;

async function loadTeamAliases() {
    if (globalTeamAliasesMap) return;
    try {
        const res = await fetch(withCacheBuster('team-aliases.json'));
        if (!res.ok) throw new Error('Falha ao carregar team-aliases.json');
        const data = await res.json();
        
        globalTeamAliasesMap = {};
        // Transforma o JSON em um dicionário rápido de busca (Alias -> Nome Canônico)
        for (const [canonical, aliases] of Object.entries(data)) {
            globalTeamAliasesMap[otNormalizeKey(canonical)] = canonical;
            aliases.forEach(alias => {
                globalTeamAliasesMap[otNormalizeKey(alias)] = canonical;
            });
        }
        window.globalTeamAliasesMap = globalTeamAliasesMap;
        console.log('✅ team-aliases.json carregado!');
    } catch (e) {
        console.warn('[Outros Torneios] Erro ao carregar team-aliases.json:', e);
        globalTeamAliasesMap = {}; // Evita tentar carregar de novo se der erro
    }
}

function otEscapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[ch]));
}

function otNormalizeKey(value) {
    return String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
}

function otParseSimpleTSV(text) {
    const lines = String(text || '').split(/\r?\n/).filter(line => line.trim());
    if (!lines.length) return [];
    const headers = lines.shift().split('\t').map(h => h.trim().toLowerCase());
    return lines.map(line => {
        const cols = line.split('\t');
        const obj = {};
        headers.forEach((h, i) => obj[h] = (cols[i] || '').trim());
        return obj;
    });
}

async function loadOtMobileTeamShortNames() {
    if (otMobileShortNamesLoaded) return;
    otMobileShortNamesLoaded = true;
    const url = window.CFF_CONFIG?.sheets?.nomesCurtosEquipes;
    if (!url) return;

    try {
        const res = await fetch(withCacheBuster(url));
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const rows = otParseSimpleTSV(await res.text());
        rows.forEach(row => {
            const values = Object.values(row);
            const full = row.nome || row['nome do time'] || row.equipe || row.time || row.team || values[0] || '';
            const short = row.curto || row['nome curto'] || row.sigla || row.mobile || values[1] || '';
            if (full && short) otMobileTeamShortNames[otNormalizeKey(full)] = short;
        });
        window.otMobileTeamShortNames = otMobileTeamShortNames;
        console.log(`✅ ${Object.keys(otMobileTeamShortNames).length} nomes curtos de equipes carregados!`);
    } catch (e) {
        console.warn('[Outros Torneios] Falha ao carregar nomes curtos de equipes:', e);
    }
}

function otGetMobileTeamName(teamName) {
    const raw = String(teamName || '').trim();
    const normalized = otNormalizeTeamFromAliases(raw);
    const current = otResolveCurrentTeamName(normalized);
    return otMobileTeamShortNames[otNormalizeKey(raw)]
        || otMobileTeamShortNames[otNormalizeKey(normalized)]
        || otMobileTeamShortNames[otNormalizeKey(current)]
        || raw;
}

function otTeamNameHTML(teamName) {
    const raw = String(teamName || '').trim();
    const normalized = otNormalizeTeamFromAliases(raw);
    const current = otResolveCurrentTeamName(normalized);
    
    // Usa o nome convertido; se falhar, usa o original
    const full = current || raw; 
    const short = otGetMobileTeamName(full);
    
    return `<span class="ot-team-full">${otEscapeHTML(full)}</span><span class="ot-team-short">${otEscapeHTML(short)}</span>`;
}

function otShortRoundLabel(label) {
    const raw = String(label || '').trim();
    return raw
        .replace(/^Week\s*(\d+)$/i, 'W$1')
        .replace(/^Day\s*(\d+)$/i, 'D$1')
        .replace(/^Round\s*(\d+)$/i, 'R$1')
        .replace(/^Semana\s*(\d+)$/i, 'S$1')
        .replace(/^Dia\s*(\d+)$/i, 'D$1');
}

function otHeaderLabel(full, mobile) {
    return `<span class="ot-desktop-label">${otEscapeHTML(full)}</span><span class="ot-mobile-label">${otEscapeHTML(mobile || full)}</span>`;
}

function otGetTournamentName(t) {
    return t?.name || t?.nome || t?.torneio || 'Torneio sem nome';
}

function otGetTournamentYear(t) {
    return String(t?.year || t?.ano || '').trim();
}

function otGetTournamentTier(t) {
    return String(t?.tier || '').trim() || 'Sem tier';
}

function otGetTournamentRegion(t) {
    return String(t?.region || t?.regiao || '').trim() || 'Sem região';
}

function otGetTournamentStatus(t) {
    return String(t?.status || '').trim();
}

function otFormatTier(tier) {
    const raw = String(tier || '').trim();
    if (!raw) return 'Sem tier';
    if (/^tier\s+/i.test(raw)) return raw.replace(/^tier/i, 'Tier');
    if (/^[SABCD]$/i.test(raw)) return `Tier ${raw.toUpperCase()}`;
    if (/^[SABCD]-?tier$/i.test(raw)) return `Tier ${raw.charAt(0).toUpperCase()}`;
    return raw;
}

function otFormatMoney(value, currency = 'BRL') {
    const num = Number(value || 0);
    const cur = String(currency || 'BRL').toUpperCase();
    try {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: cur }).format(num);
    } catch (e) {
        return `${cur} ${num.toLocaleString('pt-BR')}`;
    }
}

function otNormalizeTeamFromAliases(teamName, tournament = currentOtData) {
    const raw = String(teamName || '').trim();
    if (!raw) return '';
    const aliases = tournament?.aliases || {};
    const key = raw.toLowerCase();
    return aliases[key] || aliases[raw] || raw;
}

function otGetFormatText(t) {
    return String(t?.format || t?.formato || t?.rules || t?.regulamento || '').trim();
}

function otTranslateFormatLine(line) {
    let out = String(line || '').trim();
    if (!out) return '';

    out = out.replace(/Series A Stage (\d+)/gi, 'Série A - Etapa $1');
    out = out.replace(/Stage (\d+)/gi, 'Etapa $1');
    out = out.replace(/Regular Season/gi, 'Fase regular');
    out = out.replace(/Grand Finals?/gi, 'Grande Final');
    out = out.replace(/February/gi, 'fevereiro').replace(/March/gi, 'março').replace(/April/gi, 'abril').replace(/May/gi, 'maio').replace(/June/gi, 'junho').replace(/July/gi, 'julho').replace(/August/gi, 'agosto').replace(/September/gi, 'setembro').replace(/October/gi, 'outubro').replace(/November/gi, 'novembro').replace(/December/gi, 'dezembro').replace(/January/gi, 'janeiro');
    out = out.replace(/in Estúdios Quanta, Brazil Sao Paulo/gi, 'nos Estúdios Quanta, em São Paulo, Brasil');
    out = out.replace(/in ([^\n]+)/gi, 'em $1');
    out = out.replace(/Invited Teams?/gi, 'equipes convidadas');
    out = out.replace(/from/gi, 'da');
    out = out.replace(/Weeks? of League Play/gi, 'semanas de fase de liga');
    out = out.replace(/Each team played (\d+) matches per week/gi, 'cada equipe jogou $1 quedas por semana');
    out = out.replace(/contains an extra Day (\d+)/gi, 'teve um Dia $1 extra');
    out = out.replace(/Top (\d+) teams qualified for/gi, 'As $1 melhores equipes se classificaram para');
    out = out.replace(/Bottom (\d+) teams relegated for/gi, 'As $1 últimas equipes foram rebaixadas para');
    out = out.replace(/qualified for/gi, 'classificadas para');
    out = out.replace(/relegated for/gi, 'rebaixadas para');
    out = out.replace(/League Play/gi, 'fase de liga');
    out = out.replace(/matches/gi, 'quedas');
    out = out.replace(/teams/gi, 'equipes');
    return out;
}

function otGetPrizeSections(t) {
    const sections = [];
    const push = (section, fallbackType) => {
        if (!section) return;
        if (Array.isArray(section)) return section.forEach(item => push(item, fallbackType));
        const rows = otCompactRows(section);
        if (rows.length || section.items?.length || section.slots?.length) sections.push({ ...section, type: section.type || fallbackType });
    };

    push(t?.prizePool, 'teamPrizePool');
    push(t?.teamPrizePool, 'teamPrizePool');
    push(t?.premiacaoEquipes, 'teamPrizePool');
    push(t?.awardPrizePool, 'awardPrizePool');
    push(t?.premiacaoPremios, 'awardPrizePool');
    if (Array.isArray(t?.prizePools)) t.prizePools.forEach(p => push(p, p.type || 'teamPrizePool'));
    return sections;
}

function otGetTotalPrize(t) {
    let total = 0;
    otGetPrizeSections(t).forEach(section => {
        const rows = otCompactRows(section);
        rows.forEach(row => {
            const val = otGetByCol(row, section, 'prize', otGetByCol(row, section, 'localprize', otGetByCol(row, section, 'points', 0)));
            total += Number(val || 0);
        });
        (section.items || section.slots || []).forEach(item => total += Number(item.prize || item.localprize || 0));
    });
    return total;
}

function otGetPrizeCurrency(t) {
    const first = otGetPrizeSections(t)[0];
    return String(first?.currency || first?.localcurrency || t?.currency || 'BRL').toUpperCase();
}

function otGetTournamentMvp(t) {
    const awards = otGetAwards(t);
    const mvp = awards.find(a => String(a.award || a.premio || '').toUpperCase().includes('MVP'));
    if (mvp) return mvp.player || mvp.jogador || '';
    const ranking = otGetPlayerRanking(t);
    const rows = otCompactRows(ranking);
    if (ranking && rows.length) return otGetByCol(rows[0], ranking, 'player', '');
    return '';
}


function otGetTeamLogo(teamName) {
    const raw = String(teamName || '').trim();
    if (!raw) return 'escudo.webp';
    const normalized = otNormalizeTeamFromAliases(raw);
    const current = otResolveCurrentTeamName(normalized);

    return logos?.[raw]
        || logos?.[raw.toUpperCase()]
        || logos?.[otNormalizeKey(raw)]
        || logos?.[normalized]
        || logos?.[normalized.toUpperCase()]
        || logos?.[otNormalizeKey(normalized)]
        || logos?.[current]
        || logos?.[current?.toUpperCase?.()]
        || logos?.[otNormalizeKey(current)]
        || 'escudo.webp';
}


function otResolveCurrentTeamName(teamName) {
    let raw = String(teamName || '').trim();
    if (!raw) return '';

    if (typeof getTeamCanonicalName === 'function') {
        raw = getTeamCanonicalName(raw);
    }

    const direct = (typeof db !== 'undefined' && Array.isArray(db.teams))
        ? db.teams.find(t => otNormalizeKey(t.equipe) === otNormalizeKey(raw))
        : null;
    if (direct) return direct.equipe;

    const mapped = historicalToCurrent[raw.toUpperCase()];
    if (mapped && typeof db !== 'undefined' && Array.isArray(db.teams)) {
        const exists = db.teams.find(t => otNormalizeKey(t.equipe) === otNormalizeKey(mapped));
        if (exists) return exists.equipe;
    }

    return raw;
}

function otResolveCurrentTeamName(teamName) {
    let raw = String(teamName || '').trim();
    if (!raw) return '';

    if (typeof getTeamCanonicalName === 'function') {
        raw = getTeamCanonicalName(raw);
    }

    // Busca no JSON externo de Aliases
    if (globalTeamAliasesMap) {
        const mapped = globalTeamAliasesMap[otNormalizeKey(raw)];
        if (mapped) raw = mapped;
    }

    // Verifica se o nome resolvido existe no DB principal de times
    const direct = (typeof db !== 'undefined' && Array.isArray(db.teams))
        ? db.teams.find(t => otNormalizeKey(t.equipe) === otNormalizeKey(raw))
        : null;
    
    if (direct) return direct.equipe;

    return raw;
}

function otOpenTeamProfile(teamName) {
    const resolved = otResolveCurrentTeamName(teamName);
    if (typeof openTeamProfile === 'function') openTeamProfile(resolved || teamName);
}

function otGetLeagueLogo(t) {
    const name = otGetTournamentName(t);
    if (typeof resolveLeagueLogo === 'function') return resolveLeagueLogo(name);
    return name.toUpperCase().includes('LBFF') ? 'lbff.webp' : 'trofeu.webp';
}

function otCompactRows(section) {
    if (!section) return [];
    if (Array.isArray(section.rows)) return section.rows;
    if (Array.isArray(section.linhas)) return section.linhas;
    return [];
}

function otGetByCol(row, section, colName, fallback = '') {
    if (!row) return fallback;
    if (!Array.isArray(row)) return row[colName] ?? fallback;
    const cols = section?.cols || [];
    const idx = cols.indexOf(colName);
    return idx >= 0 ? row[idx] : fallback;
}


function otGetRosterDisplayName(team) {
    return team?.n || team?.nome || team?.o || team?.nomeOriginal || '';
}

function otGetRosterCandidateNames(team) {
    const values = [team?.n, team?.nome, team?.o, team?.nomeOriginal, team?.id];
    return values.map(v => String(v || '').trim()).filter(Boolean);
}

function otGetGlobalTeamCanonicalName(name) {
    const raw = String(name || '').trim();
    if (!raw) return '';
    const key = otNormalizeKey(raw);
    if (globalTeamAliasesMap && globalTeamAliasesMap[key]) return globalTeamAliasesMap[key];
    return raw;
}

function otResolveTeamForTournament(teamName, tournament = currentOtData, teamOriginal = '') {
    const raw = String(teamName || '').trim();
    const original = String(teamOriginal || '').trim();
    const teams = otGetTeams(tournament);
    const candidates = [raw, original]
        .concat(raw ? [otNormalizeTeamFromAliases(raw, tournament)] : [])
        .concat(original ? [otNormalizeTeamFromAliases(original, tournament)] : [])
        .filter(Boolean);

    if (teams.length) {
        // 1) Primeiro tenta bater exatamente com a lista de equipes do próprio torneio.
        for (const candidate of candidates) {
            const key = otNormalizeKey(candidate);
            const exact = teams.find(team => otGetRosterCandidateNames(team).some(name => otNormalizeKey(name) === key));
            if (exact) return otGetRosterDisplayName(exact) || candidate;
        }

        // 2) Depois usa o team-aliases.json global para desambiguar siglas perigosas, tipo BD.
        // Ex.: se a classificação vier como "bd", mas a lista de equipes do torneio tiver
        // "Black Dragons e-Sports", a tabela passa a apontar para Black Dragons, não BD LOS.
        const globalCanonKeys = new Set(candidates.map(otGetGlobalTeamCanonicalName).map(otNormalizeKey).filter(Boolean));
        if (globalCanonKeys.size) {
            const byGlobalAlias = teams.find(team => {
                const rosterNames = otGetRosterCandidateNames(team);
                return rosterNames.some(name => globalCanonKeys.has(otNormalizeKey(otGetGlobalTeamCanonicalName(name))));
            });
            if (byGlobalAlias) return otGetRosterDisplayName(byGlobalAlias) || raw || original;
        }

        // 3) Por último, usa aliases locais do torneio, mas só se eles apontarem para uma equipe existente.
        for (const candidate of candidates) {
            const local = otNormalizeTeamFromAliases(candidate, tournament);
            const key = otNormalizeKey(local);
            const byLocalAlias = teams.find(team => otGetRosterCandidateNames(team).some(name => otNormalizeKey(name) === key));
            if (byLocalAlias) return otGetRosterDisplayName(byLocalAlias) || local;
        }
    }

    return otResolveCurrentTeamName(otNormalizeTeamFromAliases(raw || original, tournament));
}

function otFindTeamOriginal(t, teamName) {
    const teams = t?.teams?.items || t?.teams?.equipes || [];
    const resolved = otResolveTeamForTournament(teamName, t, teamName);
    const keys = new Set([teamName, resolved, otGetGlobalTeamCanonicalName(teamName), otGetGlobalTeamCanonicalName(resolved)].map(otNormalizeKey).filter(Boolean));

    return teams.find(team => {
        const names = otGetRosterCandidateNames(team);
        return names.some(name => keys.has(otNormalizeKey(name)) || keys.has(otNormalizeKey(otGetGlobalTeamCanonicalName(name))));
    });
}

function otGetTeams(t) {
    return t?.teams?.items || t?.teams?.equipes || [];
}

function otGetAwards(t) {
    return Array.isArray(t?.awards) ? t.awards : [];
}

function otGetStandings(t) {
    return Array.isArray(t?.standings) ? t.standings.filter(section => section?.type !== 'pointRush') : [];
}

function otGetPointRush(t) {
    return Array.isArray(t?.standings) ? t.standings.filter(section => section?.type === 'pointRush') : [];
}

function otGetPlayerRanking(t) {
    const existing = t?.playerRanking || t?.rankingJogadores || null;
    if (existing) return existing;

    const edition = otGetTournamentName(t);
    if (typeof lbffData === 'undefined' || !lbffData) return null;

    const teams = otGetTeams(t);
    const playerTeam = {};
    teams.forEach(team => {
        const teamName = team.n || team.nome || team.o || team.nomeOriginal || '';
        (team.p || team.jogadores || []).forEach(p => {
            const playerName = p.n || p.nome || '';
            if (playerName) playerTeam[otNormalizeKey(playerName)] = teamName;
        });
    });

    const rows = [];
    Object.entries(lbffData).forEach(([name, editions]) => {
        const data = editions?.[edition];
        if (!data) return;
        const kills = Number(data.k || data.kills || 0);
        const matches = Number(data.q || data.quedas || 0);
        if (!kills && !matches) return;
        const team = playerTeam[otNormalizeKey(name)] || '';
        rows.push([0, name, team, team, kills, matches, matches ? Number((kills / matches).toFixed(2)) : null, null, null, null, null, null]);
    });

    if (!rows.length) return null;
    rows.sort((a, b) => (b[4] - a[4]) || ((b[6] || 0) - (a[6] || 0)));
    rows.forEach((row, i) => row[0] = i + 1);

    return {
        type: 'playerRanking',
        source: 'lbffData',
        cols: ['pos', 'player', 'teamOriginal', 'team', 'kills', 'matches', 'avgKills', 'damage', 'avgDamage', 'assists', 'avgAssists', 'mvps'],
        available: { kills: true, matches: true, damage: false, assists: false, mvps: false },
        rows
    };
}

function otGetChampionFromFinal(t) {
    const final = t?.final;
    if (final && Array.isArray(final.rows) && final.rows.length) {
        return otGetByCol(final.rows[0], final, 'team', '');
    }
    const standings = otGetStandings(t);
    if (standings.length && standings[0].rows?.length) {
        return otGetByCol(standings[0].rows[0], standings[0], 'team', '');
    }
    return '';
}

function otTierColor(tier) {
    const key = String(tier || '').toUpperCase();
    if (key.includes('S')) return '#ffd700';
    if (key.includes('A')) return '#ff4444';
    if (key.includes('B')) return '#33ccff';
    if (key.includes('C')) return '#4caf50';
    return 'var(--accent)';
}

async function loadNovosTorneios() {
    const cfg = window.CFF_CONFIG?.outrosTorneios || {};
    const manifestUrl = cfg.manifest || 'novos-torneios/index.json';
    const fallbackFiles = cfg.fallbackFiles || ['novos-torneios/lbff-1.json'];

    let files = [];
    try {
        const res = await fetch(withCacheBuster(manifestUrl));
        if (!res.ok) throw new Error('Manifest não encontrado');
        const manifest = await res.json();
        files = Array.isArray(manifest) ? manifest : (manifest.files || []);
        files = files.map(file => file.includes('/') ? file : `novos-torneios/${file}`);
    } catch (e) {
        console.warn('[loadNovosTorneios] Usando fallback:', e);
        files = fallbackFiles;
    }

    const loaded = [];
    for (const file of files) {
        try {
            const res = await fetch(withCacheBuster(file));
            if (!res.ok) throw new Error(`Erro ${res.status}`);
            const data = await res.json();
            if (data && data.id) loaded.push(data);
        } catch (e) {
            console.error(`[loadNovosTorneios] Falha ao carregar ${file}:`, e);
        }
    }

    await loadOtMobileTeamShortNames();
    await loadTeamAliases(); // <-- Chamada adicionada aqui!

    dbNovosTorneios = loaded.sort((a, b) => {
        const ya = Number(otGetTournamentYear(a)) || 0;
        const yb = Number(otGetTournamentYear(b)) || 0;
        return yb - ya || otGetTournamentName(a).localeCompare(otGetTournamentName(b));
    });

    novosTorneiosLoaded = true;
    renderOutrosTorneiosList();
    console.log(`✅ ${dbNovosTorneios.length} torneio(s) JSON carregado(s)!`);
}

function otFillFilterOptions() {
    const yearSelect = document.getElementById('ot-filter-year');
    const tierSelect = document.getElementById('ot-filter-tier');
    const regionSelect = document.getElementById('ot-filter-region');

    const fill = (select, values, firstLabel) => {
        if (!select || select.dataset.filled === 'true') return;
        const current = select.value || 'all';
        select.innerHTML = `<option value="all">${firstLabel}</option>` + values.map(v => `<option value="${otEscapeHTML(v)}">${otEscapeHTML(v)}</option>`).join('');
        select.value = current;
        select.dataset.filled = 'true';
    };

    const years = [...new Set(dbNovosTorneios.map(otGetTournamentYear).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
    const tiers = [...new Set(dbNovosTorneios.map(otGetTournamentTier).filter(Boolean))].sort();
    const regions = [...new Set(dbNovosTorneios.map(otGetTournamentRegion).filter(Boolean))].sort();

    fill(yearSelect, years, 'Todos os anos');
    fill(tierSelect, tiers, 'Todos os tiers');
    fill(regionSelect, regions, 'Todas as regiões');
}

function otUpdateSummary(list) {
    const tCount = document.getElementById('ot-count-torneios');
    const eCount = document.getElementById('ot-count-equipes');
    const aCount = document.getElementById('ot-count-premios');
    if (!tCount) return;

    const teams = new Set();
    let awards = 0;
    (list || dbNovosTorneios).forEach(t => {
        otGetTeams(t).forEach(team => teams.add(team.n || team.nome || team.o || team.nomeOriginal));
        awards += otGetAwards(t).length;
    });

    tCount.textContent = list.length;
    eCount.textContent = teams.size;
    aCount.textContent = awards;
}

function renderOutrosTorneiosList() {
    const container = document.getElementById('ot-grid-torneios');
    if (!container) return;

    if (!novosTorneiosLoaded && dbNovosTorneios.length === 0) {
        container.innerHTML = '<p class="ot-empty">Carregando torneios...</p>';
        return;
    }

    otFillFilterOptions();

    const search = (document.getElementById('ot-search')?.value || '').toLowerCase().trim();
    const yearFilter = document.getElementById('ot-filter-year')?.value || 'all';
    const tierFilter = document.getElementById('ot-filter-tier')?.value || 'all';
    const regionFilter = document.getElementById('ot-filter-region')?.value || 'all';

    let list = dbNovosTorneios.filter(t => {
        const name = otGetTournamentName(t).toLowerCase();
        const champion = otGetChampionFromFinal(t).toLowerCase();
        return (!search || name.includes(search) || champion.includes(search))
            && (yearFilter === 'all' || otGetTournamentYear(t) === yearFilter)
            && (tierFilter === 'all' || otGetTournamentTier(t) === tierFilter)
            && (regionFilter === 'all' || otGetTournamentRegion(t) === regionFilter);
    });

    otUpdateSummary(list);

    if (!list.length) {
        container.innerHTML = '<p class="ot-empty">Nenhum torneio encontrado com esses filtros.</p>';
        return;
    }

    container.innerHTML = list.map(t => {
        const name = otGetTournamentName(t);
        const year = otGetTournamentYear(t);
        const tier = otFormatTier(otGetTournamentTier(t));
        const region = otGetTournamentRegion(t);
        const champion = otGetChampionFromFinal(t);
        const championLogo = otGetTeamLogo(champion);
        const cardColor = otTierColor(tier);
        const leagueLogo = otGetLeagueLogo(t);
        const teamsCount = otGetTeams(t).length;
        const awardsCount = otGetAwards(t).length;

        return `
            <div class="ot-tournament-card ot-json-card" onclick="openOtherTournament('${otEscapeHTML(t.id)}')" style="--card-accent: ${cardColor};">
                <div class="ot-card-topline"></div>
                <div class="ot-card-logo-wrap">
                    <img class="ot-card-img" src="${otEscapeHTML(leagueLogo)}" onerror="this.src='trofeu.webp'" alt="${otEscapeHTML(name)}">
                </div>
                <div class="ot-card-name">${otEscapeHTML(name)}</div>
                <div class="ot-card-meta-row">
                    <span>${otEscapeHTML(year || 'Sem ano')}</span>
                    <span style="color:${cardColor};">${otEscapeHTML(tier)}</span>
                    <span>${otEscapeHTML(region)}</span>
                </div>
                ${champion ? `
                    <div class="ot-card-champion">
                        <img src="${otEscapeHTML(championLogo)}" onerror="this.src='escudo.webp'" alt="${otEscapeHTML(champion)}">
                        <span>${otEscapeHTML(champion)}</span>
                    </div>` : ''}
                <div class="ot-card-footer">
                    <span>${teamsCount} equipes</span>
                    <span>${awardsCount} prêmios</span>
                </div>
            </div>
        `;
    }).join('');
}

function openOtherTournament(id) {
    const t = dbNovosTorneios.find(item => item.id === id);
    if (!t) return;

    currentOtData = t;
    currentOtTab = t.final ? 'final' : (otGetStandings(t).length ? 'standings' : 'teams');

    document.getElementById('ot-list-view').style.display = 'none';
    document.getElementById('ot-details-view').style.display = 'block';

    document.getElementById('ot-title').textContent = otGetTournamentName(t);
    document.getElementById('ot-year').textContent = [otGetTournamentYear(t), otGetTournamentRegion(t), otGetTournamentStatus(t)].filter(Boolean).join(' • ');
    document.getElementById('ot-details-badge').textContent = otFormatTier(otGetTournamentTier(t));
    const logo = document.getElementById('ot-details-logo');
    if (logo) logo.src = otGetLeagueLogo(t);

    renderOtDetailsStats();
    renderOtTabs();
    renderOtCurrentTab();
    window.scrollTo(0, 0);
}

function closeOtherTournament() {
    document.getElementById('ot-list-view').style.display = 'block';
    document.getElementById('ot-details-view').style.display = 'none';
    const dynamic = document.getElementById('ot-dynamic-container');
    if (dynamic) dynamic.innerHTML = '';
    currentOtData = null;
    currentOtTab = 'standings';
}

function renderOtDetailsStats() {
    const el = document.getElementById('ot-details-stats');
    if (!el || !currentOtData) return;

    const champion = otGetChampionFromFinal(currentOtData) || 'Sem campeão';
    const teamsCount = otGetTeams(currentOtData).length;
    const mvp = otGetTournamentMvp(currentOtData) || 'Sem MVP';
    const totalPrize = otGetTotalPrize(currentOtData);
    const currency = otGetPrizeCurrency(currentOtData);

    el.innerHTML = `
        <div><strong>${otEscapeHTML(champion)}</strong><span>Campeão</span></div>
        <div><strong>${teamsCount}</strong><span>Equipes</span></div>
        <div><strong>${otEscapeHTML(mvp)}</strong><span>MVP</span></div>
        <div><strong>${totalPrize ? otFormatMoney(totalPrize, currency) : '-'}</strong><span>Premiação total</span></div>
    `;
}

function renderOtTabs() {
    const tabs = document.getElementById('ot-details-tabs');
    if (!tabs || !currentOtData) return;

    const options = [];
    if (otGetFormatText(currentOtData)) options.push(['format', 'Formato']);
    if (otGetStandings(currentOtData).length) options.push(['standings', 'Classificação']);
    if (otGetPointRush(currentOtData).length) options.push(['pointRush', 'Point Rush']);
    if (currentOtData.headstart) options.push(['headstart', 'Pontos iniciais']);
    if (currentOtData.final) options.push(['final', 'Final']);
    if (otGetPlayerRanking(currentOtData)) options.push(['players', 'Ranking de abates']);
    if (otGetTeams(currentOtData).length) options.push(['teams', 'Equipes']);
    if (otGetPrizeSections(currentOtData).length) options.push(['prize', 'Prêmios coletivos']);
    if (otGetAwards(currentOtData).length) options.push(['awards', 'Prêmios individuais']);

    tabs.innerHTML = options.map(([id, label]) => `
        <button class="ot-tab ${currentOtTab === id ? 'active' : ''}" onclick="changeOtTab('${id}')">${label}</button>
    `).join('');
}


function changeOtTab(tabId) {
    currentOtTab = tabId;
    renderOtTabs();
    renderOtCurrentTab();
}

function renderOtCurrentTab() {
    if (!currentOtData) return;
    if (currentOtTab === 'format') return renderOtFormat();
    if (currentOtTab === 'standings') return renderOtStandings();
    if (currentOtTab === 'pointRush') return renderOtStandings(otGetPointRush(currentOtData));
    if (currentOtTab === 'headstart') return renderOtHeadstart();
    if (currentOtTab === 'final') return renderOtFinal();
    if (currentOtTab === 'players') return renderOtPlayerRanking();
    if (currentOtTab === 'teams') return renderOtTeams();
    if (currentOtTab === 'prize') return renderOtPrizePool();
    if (currentOtTab === 'awards') return renderOtAwards();
}

function renderOtFormat() {
    const container = document.getElementById('ot-dynamic-container');
    if (!container) return;
    const formatText = otGetFormatText(currentOtData);
    if (!formatText) {
        container.innerHTML = '<p class="ot-empty">Formato não disponível para este torneio.</p>';
        return;
    }

    const lines = formatText.split(/\r?\n/).map(otTranslateFormatLine).filter(Boolean);
    container.innerHTML = `
        <section class="ot-section-block">
            <div class="ot-section-head"><h3>Formato</h3><span>${otEscapeHTML(otGetTournamentName(currentOtData))}</span></div>
            <div class="ot-format-box">
                ${lines.map(line => `<div class="ot-format-line">${otEscapeHTML(line)}</div>`).join('')}
            </div>
        </section>
    `;
}

function renderOtPrizePool() {
    const container = document.getElementById('ot-dynamic-container');
    if (!container) return;

    const sections = otGetPrizeSections(currentOtData);
    if (!sections.length) {
        container.innerHTML = '<p class="ot-empty">Premiação não disponível para este torneio.</p>';
        return;
    }

    container.innerHTML = sections.map((section, index) => {
        const rows = otCompactRows(section);
        const currency = String(section.currency || section.localcurrency || otGetPrizeCurrency(currentOtData)).toUpperCase();
        const title = section.title || (section.type === 'awardPrizePool' ? 'Premiações por dia' : 'Premiação por equipe');

        const tbody = rows.map((row, rowIndex) => {
            const award = otGetByCol(row, section, 'award', '');
            const date = otGetByCol(row, section, 'date', '');
            const teamOriginal = otGetByCol(row, section, 'teamOriginal', '');
            const rawTeam = otGetByCol(row, section, 'team', otNormalizeTeamFromAliases(teamOriginal));
            const team = otResolveTeamForTournament(rawTeam, currentOtData, teamOriginal);
            const prize = otGetByCol(row, section, 'prize', otGetByCol(row, section, 'localprize', 0));
            const pos = otGetByCol(row, section, 'pos', rowIndex + 1);
            const logo = otGetTeamLogo(team);

            if (section.type === 'awardPrizePool') {
                return `
                    <tr>
                        <td>${otEscapeHTML(award || '-')}</td>
                        <td class="ot-team-click" onclick="openOtTeamRoster('${otEscapeHTML(currentOtData.id)}', '${otEscapeHTML(team)}')"><img src="${otEscapeHTML(logo)}" onerror="this.src='escudo.webp'">${otTeamNameHTML(team)}</td>
                        <td>${otEscapeHTML(date || '-')}</td>
                        <td class="ot-total-cell">${otFormatMoney(prize, currency)}</td>
                    </tr>
                `;
            }

            return `
                <tr>
                    <td class="ot-pos-cell">${pos}º</td>
                    <td class="ot-team-click" onclick="openOtTeamRoster('${otEscapeHTML(currentOtData.id)}', '${otEscapeHTML(team)}')"><img src="${otEscapeHTML(logo)}" onerror="this.src='escudo.webp'">${otTeamNameHTML(team)}</td>
                    <td class="ot-total-cell">${otFormatMoney(prize, currency)}</td>
                </tr>
            `;
        }).join('');

        return `
            <section class="ot-section-block">
                <div class="ot-section-head"><h3>${otEscapeHTML(title)}</h3><span>${otEscapeHTML(currency)}</span></div>
                <div class="table-container ot-wide-table">
                    <table>
                        <thead>
                            ${section.type === 'awardPrizePool'
                                ? '<tr><th style="text-align:left;">Prêmio</th><th style="text-align:left;">Equipe</th><th>Data</th><th>Valor</th></tr>'
                                : '<tr><th>#</th><th style="text-align:left;">Equipe</th><th>Valor</th></tr>'}
                        </thead>
                        <tbody>${tbody}</tbody>
                    </table>
                </div>
            </section>
        `;
    }).join('');
}

function renderOtStandings(customTables = null) {
    const container = document.getElementById('ot-dynamic-container');
    const tables = customTables || otGetStandings(currentOtData);
    if (!container) return;

    if (!tables.length) {
        container.innerHTML = '<p class="ot-empty">Tabela não disponível para este torneio.</p>';
        return;
    }

    container.innerHTML = tables.map((table) => {
        const rounds = table.rounds || [];
        const rows = otCompactRows(table);
        const tbody = rows.map(row => {
            const pos = otGetByCol(row, table, 'pos');
            const teamOriginal = otGetByCol(row, table, 'teamOriginal', '');
            const rawTeam = otGetByCol(row, table, 'team', otNormalizeTeamFromAliases(teamOriginal));
            const team = otResolveTeamForTournament(rawTeam, currentOtData, teamOriginal);
            const total = otGetByCol(row, table, table.cols?.includes('points') ? 'points' : 'total');
            const results = otGetByCol(row, table, 'results', []) || [];
            const logo = otGetTeamLogo(team);
            return `
                <tr>
                    <td class="ot-pos-cell">${pos}º</td>
                    <td class="ot-team-click" onclick="openOtTeamRoster('${otEscapeHTML(currentOtData.id)}', '${otEscapeHTML(team)}')">
                        <img src="${otEscapeHTML(logo)}" onerror="this.src='escudo.webp'" alt="${otEscapeHTML(team)}">
                        ${otTeamNameHTML(team)}
                    </td>
                    <td class="ot-total-cell">${total ?? '-'}</td>
                    ${rounds.map((_, i) => `<td>${results[i] == null ? '-' : results[i]}</td>`).join('')}
                </tr>
            `;
        }).join('');

        return `
            <section class="ot-section-block">
                <div class="ot-section-head">
                    <h3>TABELA</h3>
                </div>
                <div class="table-container ot-wide-table ot-mobile-table-wrap">
                    <table class="ot-standings-table ot-table-compact-mobile">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th style="text-align:left;">${otHeaderLabel('Equipe', 'E')}</th>
                                <th>Total</th>
                                ${rounds.map(r => `<th>${otHeaderLabel(r, otShortRoundLabel(r))}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>${tbody}</tbody>
                    </table>
                </div>
            </section>
        `;
    }).join('');
}

function renderOtHeadstart() {
    const container = document.getElementById('ot-dynamic-container');
    const h = currentOtData?.headstart;
    if (!container || !h) return;

    const rows = otCompactRows(h);
    container.innerHTML = `
        <section class="ot-section-block">
            <div class="ot-section-head"><h3>${otEscapeHTML(h.title || 'Pontos iniciais')}</h3></div>
            <div class="table-container">
                <table>
                    <thead><tr><th>#</th><th style="text-align:left;">Equipe</th><th>Pontos</th></tr></thead>
                    <tbody>
                    ${rows.map(row => {
                        const pos = otGetByCol(row, h, 'pos');
                        const teamOriginal = otGetByCol(row, h, 'teamOriginal', '');
                        const rawTeam = otGetByCol(row, h, 'team', otNormalizeTeamFromAliases(teamOriginal));
                        const team = otResolveTeamForTournament(rawTeam, currentOtData, teamOriginal);
                        const points = otGetByCol(row, h, 'points');
                        return `<tr><td>${pos}º</td><td class="ot-team-click" onclick="openOtTeamRoster('${otEscapeHTML(currentOtData.id)}', '${otEscapeHTML(team)}')"><img src="${otGetTeamLogo(team)}" onerror="this.src='escudo.webp'">${otTeamNameHTML(team)}</td><td class="ot-total-cell">${points}</td></tr>`;
                    }).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function getOtFinalMatchValue(row, final, matchNumber, matchCol) {
    const matches = otGetByCol(row, final, 'matches', []) || [];
    const match = matches.find(m => Number(m?.[0]) === Number(matchNumber));
    if (!match) return null;
    const cols = final.matchCols || ['match', 'placement', 'kills', 'placementPts', 'killPts', 'total'];
    const idx = cols.indexOf(matchCol);
    return idx >= 0 ? match[idx] : null;
}

function setOtFinalMatchFilter(value) {
    otFinalMatchFilter = value;
    window.otFinalMatchFilter = value;
    renderOtFinal();
}

function renderOtFinal() {
    const container = document.getElementById('ot-dynamic-container');
    const final = currentOtData?.final;
    if (!container || !final) return;

    const rows = otCompactRows(final);
    const maps = final.maps || [];
    const scoreMode = final.scoreMode || 'placementKills';
    const isPointsOnly = scoreMode === 'pointsOnly';
    const showKillPts = !isPointsOnly && Number(final.killPoint || 1) !== 1;
    const selectedMatch = otFinalMatchFilter === 'all' ? 'all' : Number(otFinalMatchFilter);

    const filterHtml = maps.length ? `
        <div class="ot-final-filter">
            <button class="ot-final-filter-btn ${selectedMatch === 'all' ? 'active' : ''}" onclick="setOtFinalMatchFilter('all')">Geral</button>
            ${maps.map(m => `
                <button class="ot-final-filter-btn ${selectedMatch === Number(m[0]) ? 'active' : ''}" onclick="setOtFinalMatchFilter('${Number(m[0])}')">
                    Q${m[0]}${m[1] ? ` • ${otEscapeHTML(m[1])}` : ''}
                </button>
            `).join('')}
        </div>
    ` : '';

    const rowsToRender = selectedMatch === 'all'
        ? rows
        : [...rows].sort((a, b) => {
            const tb = Number(getOtFinalMatchValue(b, final, selectedMatch, 'total') || 0);
            const ta = Number(getOtFinalMatchValue(a, final, selectedMatch, 'total') || 0);
            return tb - ta;
        });

    const tbody = rowsToRender.map((row, index) => {
        const pos = selectedMatch === 'all' ? otGetByCol(row, final, 'pos') : index + 1;
        const teamOriginal = otGetByCol(row, final, 'teamOriginal', '');
        const rawTeam = otGetByCol(row, final, 'team', otNormalizeTeamFromAliases(teamOriginal));
        const team = otResolveTeamForTournament(rawTeam, currentOtData, teamOriginal);
        const logo = otGetTeamLogo(team);

        if (selectedMatch !== 'all') {
            const placement = getOtFinalMatchValue(row, final, selectedMatch, 'placement');
            const kills = getOtFinalMatchValue(row, final, selectedMatch, 'kills');
            const placementPts = getOtFinalMatchValue(row, final, selectedMatch, 'placementPts');
            const killPts = getOtFinalMatchValue(row, final, selectedMatch, 'killPts');
            const total = getOtFinalMatchValue(row, final, selectedMatch, 'total') || 0;
            const booyah = Number(placement) === 1;

            if (isPointsOnly) {
                return `
                    <tr>
                        <td class="ot-pos-cell">${pos}º</td>
                        <td class="ot-team-click" onclick="openOtTeamRoster('${otEscapeHTML(currentOtData.id)}', '${otEscapeHTML(team)}')">
                            <img src="${otEscapeHTML(logo)}" onerror="this.src='escudo.webp'">${otTeamNameHTML(team)}
                        </td>
                        <td class="ot-total-cell">${total}</td>
                    </tr>
                `;
            }

            return `
                <tr>
                    <td class="ot-pos-cell">${pos}º</td>
                    <td class="ot-team-click" onclick="openOtTeamRoster('${otEscapeHTML(currentOtData.id)}', '${otEscapeHTML(team)}')">
                        <img src="${otEscapeHTML(logo)}" onerror="this.src='escudo.webp'">${otTeamNameHTML(team)}
                        ${booyah ? '<img class="ot-booyah-icon" src="booyah.webp" onerror="this.style.display=\'none\'" alt="Booyah">' : ''}
                    </td>
                    <td class="ot-total-cell">${total}</td>
                    <td>${kills ?? '-'}</td>
                    <td>${placementPts ?? '-'}</td>
                    ${showKillPts ? `<td>${killPts ?? '-'}</td>` : ''}
                </tr>
            `;
        }

        const headstart = otGetByCol(row, final, 'headstart', 0);
        const kills = otGetByCol(row, final, 'kills', null);
        const placementPts = otGetByCol(row, final, 'placementPts', null);
        const killPts = otGetByCol(row, final, 'killPts', null);
        const total = otGetByCol(row, final, 'total', 0);

        if (isPointsOnly) {
            return `
                <tr>
                    <td class="ot-pos-cell">${pos}º</td>
                    <td class="ot-team-click" onclick="openOtTeamRoster('${otEscapeHTML(currentOtData.id)}', '${otEscapeHTML(team)}')"><img src="${otEscapeHTML(logo)}" onerror="this.src='escudo.webp'">${otTeamNameHTML(team)}</td>
                    <td class="ot-total-cell">${total}</td>
                    <td>${headstart || 0}</td>
                </tr>
            `;
        }

        return `
            <tr>
                <td class="ot-pos-cell">${pos}º</td>
                <td class="ot-team-click" onclick="openOtTeamRoster('${otEscapeHTML(currentOtData.id)}', '${otEscapeHTML(team)}')"><img src="${otEscapeHTML(logo)}" onerror="this.src='escudo.webp'">${otTeamNameHTML(team)}</td>
                <td class="ot-total-cell">${total}</td>
                <td>${headstart || 0}</td>
                <td>${kills ?? '-'}</td>
                <td>${placementPts ?? '-'}</td>
                ${showKillPts ? `<td>${killPts ?? '-'}</td>` : ''}
            </tr>
        `;
    }).join('');

    const header = selectedMatch !== 'all'
        ? (isPointsOnly
            ? `<tr><th>#</th><th style="text-align:left;">${otHeaderLabel('Equipe', 'E')}</th><th>${otHeaderLabel('Total', 'PTS')}</th></tr>`
            : `<tr><th>#</th><th style="text-align:left;">${otHeaderLabel('Equipe', 'E')}</th><th>${otHeaderLabel('Total', 'PTS')}</th><th>${otHeaderLabel('Abates', 'K')}</th><th>${otHeaderLabel('Colocação', 'PTS.C')}</th>${showKillPts ? `<th>${otHeaderLabel('Pontos por kill', 'PTS.K')}</th>` : ''}</tr>`)
        : (isPointsOnly
            ? `<tr><th>#</th><th style="text-align:left;">${otHeaderLabel('Equipe', 'E')}</th><th>${otHeaderLabel('Total', 'PTS')}</th><th>${otHeaderLabel('Inicial', 'PTS INI')}</th></tr>`
            : `<tr><th>#</th><th style="text-align:left;">${otHeaderLabel('Equipe', 'E')}</th><th>${otHeaderLabel('Total', 'PTS')}</th><th>${otHeaderLabel('Inicial', 'PTS INI')}</th><th>${otHeaderLabel('Abates', 'K')}</th><th>${otHeaderLabel('Colocação', 'PTS.C')}</th>${showKillPts ? `<th>${otHeaderLabel('Pontos por kill', 'PTS.K')}</th>` : ''}</tr>`);

    container.innerHTML = `
        <section class="ot-section-block">
            <div class="ot-section-head"><h3>${otEscapeHTML(final.title || 'Final')}</h3></div>
            ${filterHtml}
            <div class="table-container ot-wide-table ot-mobile-table-wrap">
                <table class="ot-final-table ot-table-compact-mobile">
                    <thead>${header}</thead>
                    <tbody>${tbody}</tbody>
                </table>
            </div>
        </section>
    `;
}


function renderOtPlayerRanking() {
    const container = document.getElementById('ot-dynamic-container');
    const ranking = otGetPlayerRanking(currentOtData);
    if (!container || !ranking) return;

    const rows = otCompactRows(ranking);
    if (!rows.length) {
        container.innerHTML = '<p class="ot-empty">Ranking de jogadores não disponível.</p>';
        return;
    }

    const hasDamage = !!(ranking.available?.damage) || rows.some(row => otGetByCol(row, ranking, 'damage', null) != null);
    const hasAssists = !!(ranking.available?.assists) || rows.some(row => otGetByCol(row, ranking, 'assists', null) != null);
    const hasMvps = !!(ranking.available?.mvps) || rows.some(row => otGetByCol(row, ranking, 'mvps', null) != null);

    container.innerHTML = `
        <section class="ot-section-block">
            <div class="ot-section-head"><h3>Ranking de abates</h3></div>
            <div class="table-container ot-wide-table ot-mobile-table-wrap">
                <table class="ot-player-ranking-table ot-table-compact-mobile">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th style="text-align:left;">${otHeaderLabel('Jogador', 'J')}</th>
                            <th>${otHeaderLabel('Equipe', 'E')}</th>
                            <th>${otHeaderLabel('Abates', 'K')}</th>
                            <th>${otHeaderLabel('Quedas', 'Q')}</th>
                            <th>${otHeaderLabel('Média', 'MdK')}</th>
                            ${hasDamage ? `<th>${otHeaderLabel('Dano', 'D')}</th>` : ''}
                            ${hasAssists ? `<th>${otHeaderLabel('Assist.', 'A')}</th>` : ''}
                            ${hasMvps ? `<th>${otHeaderLabel('MVP', '👑')}</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => {
                            const pos = otGetByCol(row, ranking, 'pos');
                            const player = otGetByCol(row, ranking, 'player');
                            const team = otGetByCol(row, ranking, 'team');
                            const kills = otGetByCol(row, ranking, 'kills', '-');
                            const matches = otGetByCol(row, ranking, 'matches', '-');
                            const avg = otGetByCol(row, ranking, 'avgKills', '-');
                            const damage = otGetByCol(row, ranking, 'damage', null);
                            const assists = otGetByCol(row, ranking, 'assists', null);
                            const mvps = otGetByCol(row, ranking, 'mvps', null);
                            return `
                                <tr>
                                    <td>${pos}º</td>
                                    <td class="ot-player-link" data-player="${otEscapeHTML(player)}">${otEscapeHTML(player)}</td>
                                    <td>${otTeamNameHTML(team)}</td>
                                    <td class="ot-total-cell">${kills}</td>
                                    <td>${matches}</td>
                                    <td>${avg ?? '-'}</td>
                                    ${hasDamage ? `<td>${damage ?? '-'}</td>` : ''}
                                    ${hasAssists ? `<td>${assists ?? '-'}</td>` : ''}
                                    ${hasMvps ? `<td>${mvps ?? '-'}</td>` : ''}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
    otBindPlayerLinks();
}

function renderOtTeams() {
    const container = document.getElementById('ot-dynamic-container');
    const teams = otGetTeams(currentOtData);
    if (!container) return;

    if (!teams.length) {
        container.innerHTML = '<p class="ot-empty">Equipes não disponíveis.</p>';
        return;
    }

    const toggleLabel = otShowRosters ? 'Ocultar escalações' : 'Mostrar escalações';

    container.innerHTML = `
        <section class="ot-section-block">
            <div class="ot-section-head ot-section-head-stack">
                <div>
                    <h3>Equipes participantes</h3>
                    <span>${teams.length} equipes</span>
                </div>
                <button class="ot-roster-toggle ${otShowRosters ? 'active' : ''}" onclick="toggleOtRosterView()">
                    ${toggleLabel}
                </button>
            </div>
            ${otShowRosters ? renderOtExpandedTeams(teams) : renderOtTeamCards(teams)}
        </section>
    `;

    if (otShowRosters) otBindExpandedTeamActions();
}

function renderOtTeamCards(teams) {
    return `
        <div class="ot-teams-grid">
            ${teams.map(team => {
                const name = team.n || team.nome || team.o || team.nomeOriginal;
                const original = team.o || team.nomeOriginal || '';
                const players = team.p || team.jogadores || [];
                const staff = team.s || team.staff || [];
                return `
                    <div class="ot-team-card" onclick="openOtTeamRoster('${otEscapeHTML(currentOtData.id)}', '${otEscapeHTML(name)}')">
                        <img src="${otGetTeamLogo(name)}" onerror="this.src='escudo.webp'" alt="${otEscapeHTML(name)}">
                        <strong>${otEscapeHTML(name)}</strong>
                        ${original && original !== name ? `<small>${otEscapeHTML(original)}</small>` : '<small>&nbsp;</small>'}
                        <div>${players.length} jogadores • ${staff.length} staff</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderOtExpandedTeams(teams) {
    return `
        <div class="ot-rosters-grid">
            ${teams.map(team => renderOtExpandedTeamCard(team)).join('')}
        </div>
    `;
}

function renderOtExpandedTeamCard(team) {
    const name = team.n || team.nome || team.o || team.nomeOriginal;
    const original = team.o || team.nomeOriginal || '';
    const players = team.p || team.jogadores || [];
    const staff = team.s || team.staff || [];
    const teamAttr = otEscapeHTML(name);

    const playersHtml = players.length ? players.map(p => {
        const playerName = p.n || p.nome || '';
        const flag = p.f || p.flag || '';
        return `
            <button class="ot-roster-line ot-inline-player" data-player="${otEscapeHTML(playerName)}">
                <span>${flag ? `<small>${otEscapeHTML(flag).toUpperCase()}</small>` : ''}${otEscapeHTML(playerName)}</span>
            </button>
        `;
    }).join('') : '<div class="ot-roster-empty-line">Jogadores não cadastrados</div>';

    const staffHtml = staff.length ? staff.map(s => {
        const staffName = s.n || s.nome || '';
        const role = s.r || s.role || 'staff';
        return `
            <div class="ot-roster-line ot-inline-staff">
                <span>${otEscapeHTML(staffName || 'Sem nome')}</span>
                <em>${otEscapeHTML(role)}</em>
            </div>
        `;
    }).join('') : '<div class="ot-roster-empty-line">Staff não cadastrado</div>';

    return `
        <article class="ot-roster-card-expanded">
            <button class="ot-roster-card-head" data-team="${teamAttr}" title="Abrir página do time">
                <img src="${otGetTeamLogo(name)}" onerror="this.src='escudo.webp'" alt="${otEscapeHTML(name)}">
                <div>
                    <strong>${otEscapeHTML(name)}</strong>
                    ${original && original !== name ? `<small>${otEscapeHTML(original)}</small>` : ''}
                </div>
            </button>
            <div class="ot-roster-card-tabs" role="tablist" aria-label="Escalação ${otEscapeHTML(name)}">
                <button class="ot-roster-card-tab active" type="button" data-tab="players" onclick="switchOtRosterTab(this, 'players')">JOGADORES</button>
                <button class="ot-roster-card-tab" type="button" data-tab="staff" onclick="switchOtRosterTab(this, 'staff')">STAFF</button>
            </div>
            <div class="ot-roster-card-body">
                <div class="ot-roster-panel active" data-panel="players">
                    ${playersHtml}
                </div>
                <div class="ot-roster-panel" data-panel="staff">
                    ${staffHtml}
                </div>
            </div>
        </article>
    `;
}

function toggleOtRosterView() {
    otShowRosters = !otShowRosters;
    window.otShowRosters = otShowRosters;
    renderOtTeams();
}

function switchOtRosterTab(button, tabName) {
    const card = button?.closest('.ot-roster-card-expanded');
    if (!card) return;

    card.querySelectorAll('.ot-roster-card-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    card.querySelectorAll('.ot-roster-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.panel === tabName);
    });
}

function otBindExpandedTeamActions() {
    document.querySelectorAll('#ot-dynamic-container .ot-roster-card-head').forEach(btn => {
        btn.onclick = () => otOpenTeamProfile(btn.dataset.team || '');
    });

    document.querySelectorAll('#ot-dynamic-container .ot-inline-player').forEach(btn => {
        btn.onclick = () => {
            const player = btn.dataset.player || btn.textContent.trim();
            if (player && typeof openPlayerProfile === 'function') openPlayerProfile(player);
        };
    });
}

function renderOtAwards() {
    const container = document.getElementById('ot-dynamic-container');
    const awards = otGetAwards(currentOtData);
    if (!container) return;

    if (!awards.length) {
        container.innerHTML = '<p class="ot-empty">Prêmios individuais não disponíveis.</p>';
        return;
    }

    container.innerHTML = `
        <section class="ot-section-block">
            <div class="ot-section-head"><h3>Prêmios individuais</h3><span>${awards.length} registros</span></div>
            <div class="ot-awards-grid">
                ${awards.map(a => {
                    const award = a.award || a.premio || '';
                    const player = a.player || a.jogador || '';
                    const team = a.team || a.equipe || '';
                    const note = a.note || a.observacao || '';
                    return `
                        <div class="ot-award-card">
                            <div class="ot-award-title">${otEscapeHTML(award)}</div>
                            <button class="ot-player-link" data-player="${otEscapeHTML(player)}">${otEscapeHTML(player)}</button>
                            <div class="ot-award-team"><img src="${otGetTeamLogo(team)}" onerror="this.src='escudo.webp'">${otEscapeHTML(team)}</div>
                            ${note ? `<p>${otEscapeHTML(note)}</p>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </section>
    `;
    otBindPlayerLinks();
}

function otBindPlayerLinks() {
    document.querySelectorAll('#ot-dynamic-container .ot-player-link').forEach(el => {
        el.onclick = () => {
            const player = el.dataset.player || el.textContent.trim();
            if (!player) return;
            if (typeof openPlayerProfile === 'function') openPlayerProfile(player);
        };
    });
}

function openOtTeamRoster(tourneyId, teamName) {
    const t = dbNovosTorneios.find(x => x.id === tourneyId) || currentOtData;
    const team = otFindTeamOriginal(t, teamName);
    const modal = document.getElementById('ot-roster-modal');
    if (!modal) return;

    const title = document.getElementById('ot-roster-title');
    const logo = document.getElementById('ot-roster-logo');
    const list = document.getElementById('ot-roster-list');

    const displayName = team?.n || team?.nome || teamName;
    title.textContent = displayName;
    title.classList.add('clickable');
    title.title = 'Abrir página do time';
    title.onclick = () => {
        modal.classList.remove('active');
        otOpenTeamProfile(displayName);
    };

    logo.src = otGetTeamLogo(displayName);
    logo.classList.add('clickable');
    logo.title = 'Abrir página do time';
    logo.onclick = () => {
        modal.classList.remove('active');
        otOpenTeamProfile(displayName);
    };

    if (!team) {
        list.innerHTML = '<p style="color:var(--text-muted);">Escalação não registrada para este time neste torneio.</p>';
        modal.classList.add('active');
        return;
    }

    const players = team.p || team.jogadores || [];
    const staff = team.s || team.staff || [];

    const playerHtml = players.map(p => `
        <button class="btn-action ot-roster-player" data-player="${otEscapeHTML(p.n || p.nome)}" style="width:100%;margin-top:0;background:rgba(102,179,255,0.1);border:1px solid #66b3ff;color:#66b3ff;">
            ${otEscapeHTML(p.n || p.nome)}
        </button>
    `).join('');

    const staffHtml = staff.length ? `
        <div class="ot-roster-subtitle">Staff</div>
        ${staff.map(s => `<div class="ot-roster-staff"><strong>${otEscapeHTML(s.n || s.nome)}</strong><span>${otEscapeHTML(s.r || s.role || 'staff')}</span></div>`).join('')}
    ` : '';

    list.innerHTML = playerHtml + staffHtml;
    list.querySelectorAll('.ot-roster-player').forEach(btn => {
        btn.onclick = () => {
            modal.classList.remove('active');
            if (typeof openPlayerProfile === 'function') openPlayerProfile(btn.dataset.player);
        };
    });
    modal.classList.add('active');
}

function closeOtRosterModal(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
}

// Compatibilidade com chamadas antigas
function changeOtStage() { renderOtStandings(); }
function renderOtMvp() { renderOtPlayerRanking(); }
function renderOtChampions() { renderOtAwards(); }


// Exposições explícitas para chamadas vindas do HTML/core-data/navigation.
window.toggleOtRosterView = toggleOtRosterView;
window.switchOtRosterTab = switchOtRosterTab;
window.renderOutrosTorneiosList = renderOutrosTorneiosList;
window.openOtherTournament = openOtherTournament;
window.closeOtherTournament = closeOtherTournament;
window.changeOtTab = changeOtTab;
window.openOtTeamRoster = openOtTeamRoster;
window.closeOtRosterModal = closeOtRosterModal;
window.otOpenTeamProfile = otOpenTeamProfile;

// Compatibilidade com nomes usados em versões anteriores.
window.openNovoTorneioDetails = openOtherTournament;
window.closeNovoTorneioDetails = closeOtherTournament;
window.renderNovoTorneioTab = changeOtTab;
