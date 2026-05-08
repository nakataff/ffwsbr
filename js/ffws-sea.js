/* =============================================
   INTERNACIONAL - FFWS SEA 2026 S1
   ============================================= */
const SEA_CLASSIFICACAO_TSV_URL = window.CFF_CONFIG.sheets.seaClassificacao;
const SEA_CLASSIFICACAO_FASE2_TSV_URL = window.CFF_CONFIG.sheets.seaClassificacaoFase2 || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR6Paknya4E3qRT2mLd0fQMIiBKhuGOPebF0pLK9c0Gk5nRnVWNdY4FxMJV42467JLmwNNumXSc4fCC/pub?gid=1461107201&single=true&output=tsv';
const SEA_ABATES_TSV_URL = window.CFF_CONFIG.sheets.seaAbates;

let currentSEAPhase = 'phase1';
let currentSEAPhase2Stage = getDefaultSEAPhase2Stage();
let seaLastLoadedPhase = null;

const SEA_TEAM_NAME_MAP = {
    'BURIRAM': 'Buriram United', 'BRU': 'Buriram United', 'BURIRAM UNITED': 'Buriram United',
    'RRQ': 'RRQ Kazu', 'RRQ KAZU': 'RRQ Kazu',
    'AG': 'All Gamers', 'ALL GAMERS': 'All Gamers',
    'BTR': 'Bigetron by Vitality', 'BGT': 'Bigetron by Vitality', 'BGV': 'Bigetron by Vitality', 'BV': 'Bigetron by Vitality', 'BIGETRON': 'Bigetron by Vitality', 'BIGETRON BY VITALITY': 'Bigetron by Vitality', 'VITALITY': 'Bigetron by Vitality',
    'TM': 'Twisted Minds', 'TWI': 'Twisted Minds', 'TWIS': 'Twisted Minds', 'TWISTED MINDS': 'Twisted Minds',
    'HV': 'Heavy', 'HEV': 'Heavy', 'HEA': 'Heavy', 'HEAVY': 'Heavy',
    'FLCN': 'Team Falcons', 'FALCONS': 'Team Falcons', 'TEAM FALCONS': 'Team Falcons',
    'FL': 'Team Flash', 'FLASH': 'Team Flash', 'TEAM FLASH': 'Team Flash',
    'ONIC': 'ONIC Olympus', 'ONIC OLYMPUS': 'ONIC Olympus',
    'WAG': 'WAG',
    'AUR': 'Aurora Gaming', 'AURORA': 'Aurora Gaming', 'AURORA GAMING': 'Aurora Gaming',
    'ACD': 'ACD',
    'GOW': 'GOW',
    'SE': 'Shadow Esports', 'SHADOW': 'Shadow Esports', 'SHADOW ESPORTS': 'Shadow Esports',
    'AVIDA': 'Avida', 'AVD': 'Avida',
    'EVOS': 'EVOS Divine', 'EVOS DIVINE': 'EVOS Divine',
    'PE': 'P Esports', 'PES': 'P Esports', 'P ESPORTS': 'P Esports',
    'MQ': 'Maqna Esports', 'MGE': 'Maqna Esports', 'MAQ': 'Maqna Esports', 'MAQNA': 'Maqna Esports', 'MAQNA ESPORTS': 'Maqna Esports'
};

const SEA_TEAM_SIGLA_MAP = {
    'BURIRAM UNITED': 'BRU',
    'BRU': 'BRU',
    'BURIRAM': 'BRU',
    'RRQ KAZU': 'RRQ',
    'RRQ': 'RRQ',
    'ALL GAMERS': 'AG',
    'AG': 'AG',
    'BIGETRON BY VITALITY': 'BTR',
    'BIGETRON': 'BTR',
    'VITALITY': 'BTR',
    'BTR': 'BTR',
    'BGT': 'BTR',
    'BGV': 'BTR',
    'BV': 'BTR',
    'TWISTED MINDS': 'TM',
    'TM': 'TM',
    'TWI': 'TM',
    'TWIS': 'TM',
    'HEAVY': 'HV',
    'HV': 'HV',
    'HEV': 'HV',
    'HEA': 'HV',
    'TEAM FALCONS': 'FLCN',
    'FALCONS': 'FLCN',
    'FLCN': 'FLCN',
    'TEAM FLASH': 'FL',
    'FLASH': 'FL',
    'FL': 'FL',
    'ONIC OLYMPUS': 'ONIC',
    'ONIC': 'ONIC',
    'WAG': 'WAG',
    'AURORA GAMING': 'AUR',
    'AURORA': 'AUR',
    'AUR': 'AUR',
    'ACD': 'ACD',
    'GOW': 'GOW',
    'SHADOW ESPORTS': 'SE',
    'SHADOW': 'SE',
    'SE': 'SE',
    'AVIDA': 'AVD',
    'AVD': 'AVD',
    'EVOS DIVINE': 'EVOS',
    'EVOS': 'EVOS',
    'P ESPORTS': 'PE',
    'PES': 'PE',
    'PE': 'PE',
    'MAQNA ESPORTS': 'MQ',
    'MAQNA': 'MQ',
    'MGE': 'MQ',
    'MAQ': 'MQ',
    'MQ': 'MQ'
};

let seaDataLoaded = false;
let seaClassificacaoParsed = { headers: [], rows: [] };
let seaAbatesParsed = { headers: [], rows: [] };


function getDefaultSEAPhase2Stage() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    if (y === 2026 && m === 4) {
        if (d <= 8) return 'w3d1';
        if (d === 9) return 'w3d2';
        if (d === 10) return 'w3d3';
        if (d >= 15) return 'w4';
    }
    return 'w3d1';
}

function getSEACurrentClassificacaoUrl() {
    return currentSEAPhase === 'phase2' ? SEA_CLASSIFICACAO_FASE2_TSV_URL : SEA_CLASSIFICACAO_TSV_URL;
}

function getSEAPhaseTitle() {
    return currentSEAPhase === 'phase2' ? 'Knockout Stage — Fase 2' : 'Knockout Stage — Fase 1';
}

function getSEAPhaseSubtitle() {
    return currentSEAPhase === 'phase2'
        ? 'Fase 2: 08/05 a 17/05 • disputa em escada por pools, com vagas diretas para a Grand Finals.'
        : 'Fase 1 encerrada: 24/04 a 03/05 • 36 quedas em 6 dias, todos os times com 24 quedas.';
}

function getSEAPhaseFormatHtml() {
    if (currentSEAPhase === 'phase2') {
        return `
            <div class="sea-format-title">Formato da Fase 2</div>
            <ul>
                <li><strong>Week 3 Day 1 — 08/05:</strong> Pool A joga. Top 2 avança para a Grand Finals; os outros seguem para o próximo dia.</li>
                <li><strong>Week 3 Day 2 — 09/05:</strong> 10 restantes + Pool B. Top 2 avança para a Grand Finals; os outros seguem.</li>
                <li><strong>Week 3 Day 3 — 10/05:</strong> 10 restantes + Pool C. Top 2 avança para a Grand Finals; os outros vão para a Week 4.</li>
                <li><strong>Week 4 — 15/05 a 17/05:</strong> 10 restantes + Pool D. Top 6 avança para a Grand Finals; bottom 6 é eliminado.</li>
            </ul>`;
    }

    return `
        <div class="sea-format-title">Formato da Fase 1</div>
        <ul>
            <li><strong>Período:</strong> 24/04 a 03/05 de 2026.</li>
            <li><strong>Formato:</strong> 2 semanas, jogos de sexta a domingo, 36 quedas no total.</li>
            <li><strong>Todos os times:</strong> 24 quedas jogadas.</li>
            <li><strong>Divisão para a Fase 2:</strong> Top 12 no Pool A; 13º–14º no Pool B; 15º–16º no Pool C; 17º–18º no Pool D.</li>
        </ul>`;
}

function getSEAPhase2StageLabel(stage) {
    const map = {
        w3d1: 'Week 3 Day 1 — 08/05',
        w3d2: 'Week 3 Day 2 — 09/05',
        w3d3: 'Week 3 Day 3 — 10/05',
        w4: 'Week 4 — 15/05 a 17/05'
    };
    return map[stage] || map.w3d1;
}

function getSEALegendHtml() {
    if (currentSEAPhase === 'phase2') {
        return `
            <div class="sea-legend-inline">
                <span><i class="sea-mini-line sea-line-qualified"></i> Grand Finals</span>
                <span><i class="sea-mini-line sea-line-next"></i> Próximo matchday</span>
                <span><i class="sea-mini-line sea-line-eliminated"></i> Eliminado</span>
            </div>`;
    }

    return `
        <div class="sea-legend-inline">
            <span><i class="sea-mini-line sea-line-pool-a"></i> Pool A — Top 12</span>
            <span><i class="sea-mini-line sea-line-pool-b"></i> Pool B — 13º–14º</span>
            <span><i class="sea-mini-line sea-line-pool-c"></i> Pool C — 15º–16º</span>
            <span><i class="sea-mini-line sea-line-pool-d"></i> Pool D — 17º–18º</span>
        </div>`;
}

function updateSEAPhaseInfo() {
    const title = document.getElementById('sea-phase-current-title');
    const subtitle = document.getElementById('sea-phase-current-subtitle');
    const format = document.getElementById('sea-phase-format');
    const legend = document.getElementById('sea-phase-legend');
    const stageWrap = document.getElementById('sea-phase2-stage-wrap');
    const stageSelect = document.getElementById('sea-phase2-stage');

    if (title) title.textContent = getSEAPhaseTitle();
    if (subtitle) subtitle.textContent = getSEAPhaseSubtitle();
    if (format) format.innerHTML = getSEAPhaseFormatHtml();
    if (legend) legend.innerHTML = getSEALegendHtml();
    if (stageWrap) stageWrap.style.display = currentSEAPhase === 'phase2' ? 'flex' : 'none';
    if (stageSelect) stageSelect.value = currentSEAPhase2Stage;

    document.querySelectorAll('.sea-phase-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.phase === currentSEAPhase);
    });
}

function ensureSEAPhasePanel() {
    if (document.getElementById('sea-phase-panel')) {
        updateSEAPhaseInfo();
        return;
    }

    const page = document.getElementById('ffws-sea-2026-s1');
    const grid = page?.querySelector('.int-grid');
    if (!page || !grid) return;

    const panel = document.createElement('div');
    panel.id = 'sea-phase-panel';
    panel.className = 'sea-phase-panel';
    panel.innerHTML = `
        <div class="sea-phase-switch">
            <button type="button" class="sea-phase-btn active" data-phase="phase1" onclick="setSEAPhase('phase1')">Fase 1</button>
            <button type="button" class="sea-phase-btn" data-phase="phase2" onclick="setSEAPhase('phase2')">Fase 2</button>
        </div>
        <div class="sea-phase-card">
            <div class="sea-phase-card-head">
                <div>
                    <div id="sea-phase-current-title" class="sea-phase-current-title"></div>
                    <div id="sea-phase-current-subtitle" class="sea-phase-current-subtitle"></div>
                </div>
                <label id="sea-phase2-stage-wrap" class="sea-phase-stage-wrap" style="display:none;">
                    Etapa:
                    <select id="sea-phase2-stage" onchange="setSEAPhase2Stage(this.value)">
                        <option value="w3d1">Week 3 Day 1</option>
                        <option value="w3d2">Week 3 Day 2</option>
                        <option value="w3d3">Week 3 Day 3</option>
                        <option value="w4">Week 4</option>
                    </select>
                </label>
            </div>
            <div id="sea-phase-format" class="sea-phase-format"></div>
            <div id="sea-phase-legend" class="sea-phase-legend"></div>
        </div>`;

    page.insertBefore(panel, grid);
    updateSEAPhaseInfo();
}

function setSEAPhase(phase) {
    currentSEAPhase = phase === 'phase2' ? 'phase2' : 'phase1';
    seaDataLoaded = false;
    updateSEAPhaseInfo();
    loadSEAData(true);
}

function setSEAPhase2Stage(stage) {
    currentSEAPhase2Stage = ['w3d1', 'w3d2', 'w3d3', 'w4'].includes(stage) ? stage : 'w3d1';
    updateSEAPhaseInfo();
    renderSEATable('table-sea-classificacao', seaClassificacaoParsed, 'Nenhum dado de classificação encontrado.');
}

function getSEAClassificationStatus(rank) {
    if (currentSEAPhase === 'phase1') {
        if (rank <= 12) return { label: 'Pool A', className: 'sea-status-pool-a', rowClass: 'sea-row-pool-a' };
        if (rank <= 14) return { label: 'Pool B', className: 'sea-status-pool-b', rowClass: 'sea-row-pool-b' };
        if (rank <= 16) return { label: 'Pool C', className: 'sea-status-pool-c', rowClass: 'sea-row-pool-c' };
        return { label: 'Pool D', className: 'sea-status-pool-d', rowClass: 'sea-row-pool-d' };
    }

    if (currentSEAPhase2Stage === 'w4') {
        if (rank <= 6) return { label: 'Grand Finals', className: 'sea-status-qualified', rowClass: 'sea-row-qualified' };
        return { label: 'Eliminado', className: 'sea-status-eliminated', rowClass: 'sea-row-eliminated' };
    }

    if (rank <= 2) return { label: 'Grand Finals', className: 'sea-status-qualified', rowClass: 'sea-row-qualified' };
    if (currentSEAPhase2Stage === 'w3d3') return { label: 'Avança para Week 4', className: 'sea-status-next', rowClass: 'sea-row-next' };
    return { label: 'Próximo matchday', className: 'sea-status-next', rowClass: 'sea-row-next' };
}

function renderSEAStatusCell(rank) {
    const status = getSEAClassificationStatus(rank);
    return `<td class="sea-col-status"><span class="sea-status-badge ${status.className}">${escapeHtml(status.label)}</span></td>`;
}

function normalizeSEAKey(value) {
    return String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function getSEATeamFullName(value) {
    const original = String(value || '').trim();
    if (!original) return original;
    const clean = normalizeSEAKey(original);
    return SEA_TEAM_NAME_MAP[clean] || original;
}

function getSEATeamSigla(value) {
    const original = String(value || '').trim();
    if (!original) return original;
    const cleanOriginal = normalizeSEAKey(original);
    const fullName = getSEATeamFullName(original);
    const cleanFull = normalizeSEAKey(fullName);
    return SEA_TEAM_SIGLA_MAP[cleanOriginal] || SEA_TEAM_SIGLA_MAP[cleanFull] || cleanOriginal.split(' ')[0].slice(0, 4);
}

function cleanSEAPlayerName(value) {
    const original = String(value || '').trim();
    if (!original) return original;
    // Exemplo: RRQ.DUTTZ vira DUTTZ. Mantém nomes sem prefixo intactos.
    if (original.includes('.')) {
        const parts = original.split('.').map(part => part.trim()).filter(Boolean);
        return parts.length ? parts[parts.length - 1] : original;
    }
    return original;
}

function getSEAPlayerTeamSigla(value) {
    const original = String(value || '').trim();
    if (!original || !original.includes('.')) return '';
    const prefix = original.split('.')[0].trim();
    return normalizeSEAKey(prefix);
}

function getSEAPlayerTeamFullName(value) {
    const sigla = getSEAPlayerTeamSigla(value);
    return sigla ? getSEATeamFullName(sigla) : '';
}

function getSEARowTeamName(row, playerHeader, teamHeader) {
    // Na planilha de abates da SEA o time vem no começo do nick: BRU.JOENA, RRQ.DUTTZ etc.
    // Então o filtro de time deve priorizar essa sigla antes do ponto.
    const fromPlayer = playerHeader ? getSEAPlayerTeamFullName(row[playerHeader]) : '';
    if (fromPlayer) return fromPlayer;
    return teamHeader ? getSEATeamFullName(row[teamHeader]) : '';
}

function getSEAFunctionName(value) {
    const clean = normalizeSEAKey(value);
    const roleMap = {
        'BOMBER': 'GRAN',
        'GRENADEIRO': 'GRAN',
        'GRANADEIRO': 'GRAN',
        'SNIPER': 'SUP',
        'SUPORTE': 'SUP',
        'SUPPORT': 'RUSH',
        'RUSHER': 'RUSH',
        'RUSH': 'RUSH',
        'RIFLER': '3º H',
        '3 HOMEM': '3º H',
        '3º HOMEM': '3º H',
        'TERCEIRO HOMEM': '3º H'
    };
    return roleMap[clean] || String(value || '').trim().toUpperCase();
}

function parseTSV(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim() !== '');
    if (!lines.length) return { headers: [], rows: [] };
    const headers = lines[0].split('\t').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
        const cells = line.split('\t');
        const obj = {};
        headers.forEach((h, i) => obj[h || `COL_${i + 1}`] = (cells[i] || '').trim());
        return obj;
    });
    return { headers, rows };
}

function shouldConvertSEATeamColumn(header) {
    const h = normalizeSEAKey(header);
    return ['SIGLA', 'TAG', 'TIME', 'TIMES', 'EQUIPE', 'EQUIPES', 'TEAM', 'TEAMS', 'CLUBE', 'ORGANIZACAO', 'ORG'].some(key => h.includes(key));
}

function shouldCleanSEAPlayerColumn(header) {
    const h = normalizeSEAKey(header);
    return ['JOGADOR', 'PLAYER', 'NICK', 'NOME', 'NAME', 'APELIDO'].some(key => h.includes(key)) && !shouldConvertSEATeamColumn(header);
}

function shouldConvertSEAFunctionColumn(header) {
    const h = normalizeSEAKey(header);
    return ['FUNCAO', 'FUNÇÃO', 'ROLE', 'POSICAO', 'POSIÇÃO', 'POSITION'].some(key => h.includes(key));
}

function findSEAHeader(headers, matcher) {
    return (headers || []).find(h => matcher(h)) || null;
}

function isProbablyNumericColumn(header) {
    const h = normalizeSEAKey(header);
    return /(POS|RANK|PONT|PTS|BOOYAH|ABATE|KILL|DANO|DAMAGE|QUEDA|MEDIA|AVG|MVP|AST|ASSIST|VITORIA|VIT)/.test(h);
}

function parseSEANumber(value) {
    const normalized = String(value || '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    return parseFloat(normalized) || 0;
}


function isSEADamageColumn(header) {
    const h = normalizeSEAKey(header);
    return h === 'DANO' || h === 'DAMAGE' || h.includes('DANO') || h.includes('DAMAGE');
}

function isSEABooyahColumn(header) {
    const h = normalizeSEAKey(header);
    return h.includes('BOOYAH') || h === 'BOOYAH' || h === 'BOOYAHS' || h === 'B';
}

function isSEAPositionColumn(header) {
    const h = normalizeSEAKey(header);
    return h === '#' || h === 'POS' || h === 'POSICAO' || h === 'POSICAO GERAL' || h === 'RANK' || h.includes('POSICAO');
}

function formatCompactSEADamage(value) {
    const num = parseSEANumber(value);
    if (num >= 1000) return `${Math.round(num / 1000)}k`;
    return String(num || 0);
}

function getSEAColumnClass(header, tableId = '') {
    const classes = [];
    if (shouldCleanSEAPlayerColumn(header)) classes.push('sea-col-player');
    if (shouldConvertSEATeamColumn(header)) classes.push('sea-col-team');
    if (shouldConvertSEAFunctionColumn(header)) classes.push('sea-col-role');
    if (isSEADamageColumn(header)) classes.push('sea-col-dano');
    if (isSEABooyahColumn(header)) classes.push('sea-col-booyah');
    if (tableId === 'table-sea-classificacao' && isSEAPointsColumn(header)) classes.push('sea-col-points');
    return classes.join(' ');
}

function stripSEAPositionColumns(parsed) {
    const headers = (parsed.headers || []).filter(h => !isSEAPositionColumn(h));
    const rows = (parsed.rows || []).map(row => {
        const cleanRow = {};
        headers.forEach(h => cleanRow[h] = row[h]);
        return cleanRow;
    });
    return { headers, rows };
}

function parseSortNumber(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 0;

    const hasK = raw.includes('k');
    const cleaned = raw
        .replace(/\.(?=\d{3}(\D|$))/g, '')
        .replace(',', '.')
        .replace(/[^\dk.-]/g, '');

    let num = parseFloat(cleaned.replace('k', '')) || 0;
    if (hasK) num *= 1000;
    return num;
}

function refreshSEADynamicRankColumn(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const statusClasses = [
        'sea-row-pool-a', 'sea-row-pool-b', 'sea-row-pool-c', 'sea-row-pool-d',
        'sea-row-qualified', 'sea-row-next', 'sea-row-eliminated',
        'sea-status-pool-a', 'sea-status-pool-b', 'sea-status-pool-c', 'sea-status-pool-d',
        'sea-status-qualified', 'sea-status-next', 'sea-status-eliminated'
    ];

    Array.from(table.querySelectorAll('tbody tr')).forEach((row, index) => {
        const rank = index + 1;
        const firstCell = row.cells[0];

        if (firstCell && firstCell.classList.contains('int-rank-cell')) {
            firstCell.textContent = `${rank}º`;

            if (tableId === 'table-sea-classificacao') {
                const status = getSEAClassificationStatus(rank);
                row.classList.remove(...statusClasses);
                firstCell.classList.remove(...statusClasses);
                row.classList.add(status.rowClass);
                firstCell.classList.add('sea-rank-marker', status.className);
                firstCell.title = status.label;
            }
        }
    });
}

function findSEAAbatesHeader(headers) {
    return (headers || []).find(header => {
        const h = normalizeSEAKey(header);
        return h === 'ABATES' || h === 'KILLS' || h === 'KILL' || h.includes('ABATE') || h.includes('KILL');
    }) || null;
}

function sortSEARowsByAbatesDesc(parsed) {
    const killHeader = findSEAAbatesHeader(parsed.headers);
    if (!killHeader) return parsed;
    return {
        headers: parsed.headers,
        rows: [...parsed.rows].sort((a, b) => parseSEANumber(b[killHeader]) - parseSEANumber(a[killHeader]))
    };
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[char]));
}

function getSEAMobileHeader(header) {
    const h = normalizeSEAKey(header);
    if (!h) return '-';
    if (h === 'POSICAO' || h === 'POSICAO GERAL' || h === 'RANK' || h.includes('POS')) return 'P';
    if (shouldCleanSEAPlayerColumn(header)) return 'J';
    if (shouldConvertSEATeamColumn(header)) return 'E';
    if (shouldConvertSEAFunctionColumn(header)) return 'F';
    if (h.includes('BOOYAH')) return 'B';
    if (h.includes('ABATE') || h.includes('KILL')) return 'K';
    if (h.includes('PONTO') || h === 'PTS') return 'PTS';
    if (h.includes('QUEDA') || h === 'Q') return 'Q';
    if (h.includes('DANO') || h.includes('DAMAGE')) return 'DMG';
    if (h.includes('ASSIST')) return 'AST';
    if (h.includes('MEDIA') || h.includes('AVG')) return 'M';
    if (h.includes('MVP')) return 'MVP';
    if (h.includes('VITORIA') || h.includes('VIT')) return 'V';
    return h.slice(0, 3);
}

function renderSEAHeaderCell(tableId, header, colIndex) {
    const safeHeader = escapeHtml(header || '-');
    const mobileHeader = escapeHtml(getSEAMobileHeader(header));
    const colClass = getSEAColumnClass(header, tableId);
    return `<th class="${colClass}" onclick="sortTable('${tableId}', ${colIndex}, ${isProbablyNumericColumn(header)})"><span class="sea-desktop-only">${safeHeader}</span><span class="sea-mobile-only">${mobileHeader}</span> ↕</th>`;
}

function isSEAKillColumn(header) {
    const h = normalizeSEAKey(header);
    return h === 'ABATES' || h === 'KILLS' || h === 'KILL' || h.includes('ABATE') || h.includes('KILL');
}

function isSEAPointsColumn(header) {
    const h = normalizeSEAKey(header);
    return h === 'PTS' || h === 'PONTOS' || h === 'PONTO' || h.includes('PONTOS');
}

function resolveSEATeamLogo(value) {
    const original = String(value || '').trim();
    const fullName = getSEATeamFullName(original);
    const sigla = getSEATeamSigla(original);
    const candidates = [
        original,
        fullName,
        sigla,
        original.toUpperCase().trim(),
        fullName.toUpperCase().trim(),
        normalizeSEAKey(original),
        normalizeSEAKey(fullName),
        normalizeSEAKey(sigla)
    ].filter(Boolean);

    for (const key of candidates) {
        if (logos[key]) return logos[key];
    }
    return 'escudo.webp';
}

function formatSEAValue(header, value, tableId = '') {
    const text = String(value || '').trim();
    if (shouldConvertSEATeamColumn(header)) {
        const fullName = getSEATeamFullName(text);
        const sigla = getSEATeamSigla(text);
        const logoSrc = resolveSEATeamLogo(text);
        return `<span class="int-team-name sea-team-cell"><img src="${escapeHtml(logoSrc)}" onerror="this.onerror=null;this.src='escudo.webp'" class="team-logo" alt="${escapeHtml(fullName)}"><span class="sea-desktop-only">${escapeHtml(fullName)}</span><span class="sea-mobile-only">${escapeHtml(sigla)}</span></span>`;
    }
    if (shouldCleanSEAPlayerColumn(header)) {
        const playerName = cleanSEAPlayerName(text);
        const playerLenClass = playerName.length >= 10 ? ' sea-player-name-long' : (playerName.length >= 8 ? ' sea-player-name-medium' : '');
        return `<span class="int-player-name${playerLenClass}" title="${escapeHtml(playerName)}">${escapeHtml(playerName)}</span>`;
    }
    if (shouldConvertSEAFunctionColumn(header)) {
        return escapeHtml(getSEAFunctionName(text));
    }
    if (isSEADamageColumn(header)) {
        return escapeHtml(formatCompactSEADamage(text));
    }
    if (tableId === 'table-sea-abates' && isSEAKillColumn(header)) {
        return `<span class="int-kill-value">${escapeHtml(text)}</span>`;
    }
    if (tableId === 'table-sea-classificacao' && isSEAPointsColumn(header)) {
        return `<span class="int-points-value">${escapeHtml(text)}</span>`;
    }
    return escapeHtml(text);
}

function formatOrdinalRank(index) {
    return `${index + 1}º`;
}

function refreshSEAAbatesRankColumn() {
    refreshSEADynamicRankColumn('table-sea-abates');
}

function renderSEATable(tableId, parsed, emptyMessage) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    const normalizedParsed = stripSEAPositionColumns(parsed);
    const hasDynamicRank = tableId === 'table-sea-abates' || tableId === 'table-sea-classificacao';

    if (!normalizedParsed.headers.length || !normalizedParsed.rows.length) {
        thead.innerHTML = '';
        tbody.innerHTML = `<tr><td class="int-loading">${emptyMessage}</td></tr>`;
        return;
    }

    const isClassificationTable = tableId === 'table-sea-classificacao';
    const rankHeader = hasDynamicRank ? '<th>#</th>' : '';

    thead.innerHTML = `<tr>${rankHeader}${normalizedParsed.headers.map((h, i) => {
        const colIndex = hasDynamicRank ? i + 1 : i;
        return renderSEAHeaderCell(tableId, h, colIndex);
    }).join('')}</tr>`;

    tbody.innerHTML = normalizedParsed.rows.map((row, index) => {
        const rank = index + 1;
        const status = isClassificationTable ? getSEAClassificationStatus(rank) : { rowClass: '', className: '', label: '' };
        const rankCellClass = isClassificationTable ? `int-rank-cell sea-rank-marker ${status.className}` : 'int-rank-cell';
        const rankTitle = isClassificationTable ? ` title="${escapeHtml(status.label)}"` : '';
        const rankCell = hasDynamicRank ? `<td class="${rankCellClass}"${rankTitle}>${rank}º</td>` : '';
        const cells = normalizedParsed.headers.map(h => {
            const colClass = getSEAColumnClass(h, tableId);
            return `<td class="${colClass}">${formatSEAValue(h, row[h], tableId)}</td>`;
        }).join('');
        return `<tr class="${status.rowClass}">${rankCell}${cells}</tr>`;
    }).join('');

    if (hasDynamicRank) refreshSEADynamicRankColumn(tableId);
}



function renderSEAAbatesFilters(parsed) {
    const teamSelect = document.getElementById('sea-filter-team');
    const roleSelect = document.getElementById('sea-filter-role');
    if (!teamSelect || !roleSelect || !parsed?.headers?.length) return;

    const playerHeader = findSEAHeader(parsed.headers, shouldCleanSEAPlayerColumn);
    const teamHeader = findSEAHeader(parsed.headers, shouldConvertSEATeamColumn);
    const roleHeader = findSEAHeader(parsed.headers, shouldConvertSEAFunctionColumn);

    const previousTeam = teamSelect.value || 'all';
    const previousRole = roleSelect.value || 'all';

    const teams = [...new Set(parsed.rows
        .map(row => getSEARowTeamName(row, playerHeader, teamHeader))
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const roles = roleHeader
        ? [...new Set(parsed.rows.map(row => getSEAFunctionName(row[roleHeader])).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
        : [];

    teamSelect.innerHTML = '<option value="all">Todos os times</option>' + teams.map(team => `<option value="${escapeHtml(team)}">${escapeHtml(team)}</option>`).join('');
    roleSelect.innerHTML = '<option value="all">Todas as funções</option>' + roles.map(role => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`).join('');

    teamSelect.value = teams.includes(previousTeam) ? previousTeam : 'all';
    roleSelect.value = roles.includes(previousRole) ? previousRole : 'all';

    teamSelect.disabled = !teams.length;
    roleSelect.disabled = !roleHeader;
}

function applySEAAbatesFilters() {
    if (!seaAbatesParsed.headers.length) return;

    const teamValue = document.getElementById('sea-filter-team')?.value || 'all';
    const roleValue = document.getElementById('sea-filter-role')?.value || 'all';
    const playerHeader = findSEAHeader(seaAbatesParsed.headers, shouldCleanSEAPlayerColumn);
    const teamHeader = findSEAHeader(seaAbatesParsed.headers, shouldConvertSEATeamColumn);
    const roleHeader = findSEAHeader(seaAbatesParsed.headers, shouldConvertSEAFunctionColumn);

    const filteredRows = seaAbatesParsed.rows.filter(row => {
        const rowTeam = getSEARowTeamName(row, playerHeader, teamHeader);
        const teamOk = teamValue === 'all' || rowTeam === teamValue;
        const roleOk = roleValue === 'all' || (roleHeader && getSEAFunctionName(row[roleHeader]) === roleValue);
        return teamOk && roleOk;
    });

    const sortedFilteredRows = sortSEARowsByAbatesDesc({ headers: seaAbatesParsed.headers, rows: filteredRows }).rows;
    renderSEATable('table-sea-abates', { headers: seaAbatesParsed.headers, rows: sortedFilteredRows }, 'Nenhum jogador encontrado com esses filtros.');
    const table = document.getElementById('table-sea-abates');
    if (table) table.setAttribute('data-sort-dir', 'desc');
}

function clearSEAAbatesFilters() {
    const teamSelect = document.getElementById('sea-filter-team');
    const roleSelect = document.getElementById('sea-filter-role');
    if (teamSelect) teamSelect.value = 'all';
    if (roleSelect) roleSelect.value = 'all';
    applySEAAbatesFilters();
}

async function fetchSEAData(url) {
    const res = await fetch(`${url}&nocache=${Date.now()}`);
    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
    return parseTSV(await res.text());
}

async function loadSEAData(force = false) {
    ensureSEAPhasePanel();
    if (seaDataLoaded && !force && seaLastLoadedPhase === currentSEAPhase) return;

    const classUpdated = document.getElementById('sea-classificacao-updated');
    const killsUpdated = document.getElementById('sea-abates-updated');
    if (classUpdated) classUpdated.textContent = 'Atualizando...';
    if (killsUpdated) killsUpdated.textContent = 'Atualizando...';

    try {
        const [classificacao, abates] = await Promise.all([
            fetchSEAData(getSEACurrentClassificacaoUrl()),
            fetchSEAData(SEA_ABATES_TSV_URL)
        ]);

        seaClassificacaoParsed = stripSEAPositionColumns(classificacao);
        seaAbatesParsed = sortSEARowsByAbatesDesc(stripSEAPositionColumns(abates));

        renderSEATable('table-sea-classificacao', seaClassificacaoParsed, 'Nenhum dado de classificação encontrado.');
        renderSEAAbatesFilters(seaAbatesParsed);
        applySEAAbatesFilters();

        const now = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        if (classUpdated) classUpdated.textContent = `${getSEAPhaseTitle()} • Atualizado: ${now}`;
        if (killsUpdated) killsUpdated.textContent = `Atualizado: ${now}`;
        seaDataLoaded = true;
        seaLastLoadedPhase = currentSEAPhase;
    } catch (error) {
        console.error('Erro ao carregar FFWS SEA:', error);
        ['table-sea-classificacao', 'table-sea-abates'].forEach(id => {
            const table = document.getElementById(id);
            if (!table) return;
            table.querySelector('thead').innerHTML = '';
            table.querySelector('tbody').innerHTML = '<tr><td class="int-error">Não foi possível carregar os dados da planilha agora. Confira se o link publicado continua ativo.</td></tr>';
        });
        if (classUpdated) classUpdated.textContent = 'Erro ao atualizar';
        if (killsUpdated) killsUpdated.textContent = 'Erro ao atualizar';
    }
}
