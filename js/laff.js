/* =============================================
   LAFF 2026 S1 - Liga Ascensão de Free Fire
   Páginas alimentadas por planilhas + dados-laff.json
   ============================================= */
(function () {
    const CFG = window.CFF_CONFIG || {};
    const LAFF_TEAMS_URL = CFG.sheets?.laffEquipes || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR6Paknya4E3qRT2mLd0fQMIiBKhuGOPebF0pLK9c0Gk5nRnVWNdY4FxMJV42467JLmwNNumXSc4fCC/pub?gid=1173171217&single=true&output=tsv';
    const LAFF_PLAYERS_URL = CFG.sheets?.laffJogadores || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR6Paknya4E3qRT2mLd0fQMIiBKhuGOPebF0pLK9c0Gk5nRnVWNdY4FxMJV42467JLmwNNumXSc4fCC/pub?gid=260123003&single=true&output=tsv';
    const LAFF_RESULTS_URL = CFG.sheets?.laffDados || 'dados-laff.json';

    let laffLoaded = false;
    let laffLoading = null;
    let laffTeams = [];
    let laffPlayers = [];
    let laffTeamIndex = new Map();
    let laffPlayerIndex = new Map();
    let laffResults = { dbQuedas: {}, dbJogadoresQuedas: {} };
    let laffResultsLoaded = false;

    function norm(value) {
        return String(value || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, ' ')
            .trim();
    }

    function key(value) { return norm(value).replace(/\s+/g, ''); }

    function slug(value) {
        return String(value || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '')
            .trim();
    }

    function escape(value) {
        if (typeof escapeHtml === 'function') return escapeHtml(value);
        return String(value || '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
    }

    function jsArg(value) { return JSON.stringify(String(value || '')); }

    function parseTsv(text) {
        const clean = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = clean.split('\n').filter(line => line.trim());
        if (!lines.length) return { headers: [], rows: [] };
        const headers = lines[0].split('\t').map(h => h.trim());
        const rows = lines.slice(1).map(line => {
            const cells = line.split('\t');
            const row = {};
            headers.forEach((h, i) => row[h || `COL_${i + 1}`] = (cells[i] || '').trim());
            return row;
        });
        return { headers, rows };
    }

    async function fetchTextNoCache(url) {
        const sep = String(url || '').includes('?') ? '&' : '?';
        const res = await fetch(`${url}${sep}nocache=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
    }

    function rowValue(row, names) {
        const wanted = names.map(norm);
        const hit = Object.keys(row || {}).find(k => wanted.includes(norm(k)) || wanted.some(w => norm(k).includes(w)));
        return hit ? String(row[hit] || '').trim() : '';
    }

    function getTeamLogo(teamName) {
        const store = (typeof logos !== 'undefined' && logos) ? logos : (window.logos || {});
        const candidates = new Set([teamName, String(teamName || '').toUpperCase(), norm(teamName)]);
        if (typeof getTeamCanonicalName === 'function') {
            const canonical = getTeamCanonicalName(teamName);
            candidates.add(canonical);
            candidates.add(String(canonical || '').toUpperCase());
        }
        if (typeof shortNames !== 'undefined' && shortNames) {
            Object.entries(shortNames).forEach(([full, short]) => {
                if (norm(full) === norm(teamName) || norm(short) === norm(teamName)) {
                    candidates.add(full);
                    candidates.add(short);
                }
            });
        }
        for (const c of candidates) {
            if (c && store[c]) return store[c];
        }
        const found = Object.keys(store || {}).find(k => norm(k) === norm(teamName));
        return found ? store[found] : 'escudo.webp';
    }

    function getPlayerPhoto(playerName) {
        if (typeof playerPhotos === 'undefined' || !playerPhotos) return 'silhueta.png';
        if (playerPhotos[playerName]) return playerPhotos[playerName];
        const found = Object.keys(playerPhotos).find(k => key(k) === key(playerName));
        return found ? playerPhotos[found] : 'silhueta.png';
    }

    function getFlagIcon(country) {
        const raw = String(country || '').trim();
        if (!raw) return '';
        const lower = raw.toLowerCase();
        const map = { brasil: 'br', brazil: 'br', br: 'br' };
        const code = map[lower] || lower;
        if (/^[a-z]{2}$/.test(code)) return `${code}.png`;
        return '';
    }

    function getShortOrigin(origin) {
        const n = norm(origin);
        if (!n) return 'A confirmar';
        if (n.includes('CONVID')) return 'Convidado';
        if (n.includes('QUAL')) return 'Qualificatório';
        if (n.includes('FFWS')) return 'FFWS BR S1';
        return origin;
    }

    function playerMatches(a, b) {
        if (typeof checkNameMatch === 'function') return checkNameMatch(a, b);
        if (typeof cffPlayerNameMatches === 'function') return cffPlayerNameMatches(a, b);
        return key(a) === key(b);
    }

    function teamMatches(a, b) {
        if (typeof sameTeamName === 'function') return sameTeamName(a, b);
        if (typeof cffMercadoTeamMatches === 'function') return cffMercadoTeamMatches(a, b);
        return key(a) === key(b);
    }

    function upsertTeam(rawTeam, data = {}) {
        const name = String(rawTeam || '').trim();
        if (!name) return null;
        const k = key(name);
        const existing = laffTeamIndex.get(k) || { name, grupo: '', origem: '', logo: '', players: [] };
        existing.name = data.name || existing.name || name;
        existing.grupo = data.grupo !== undefined ? data.grupo : existing.grupo;
        existing.origem = data.origem !== undefined ? data.origem : existing.origem;
        existing.logo = getTeamLogo(existing.name);
        laffTeamIndex.set(k, existing);
        return existing;
    }

    function upsertPlayer(playerData) {
        const name = String(playerData?.name || '').trim();
        if (!name) return null;
        const teamName = String(playerData.team || '').trim();
        const team = upsertTeam(teamName, {});
        const pk = key(name);
        const existing = laffPlayerIndex.get(pk) || {};
        const player = {
            ...existing,
            name,
            team: team ? team.name : teamName,
            funcao: playerData.funcao || existing.funcao || '',
            pais: playerData.pais || existing.pais || '',
            status: playerData.status || existing.status || 'Confirmado',
            photo: playerData.photo || existing.photo || getPlayerPhoto(name)
        };
        laffPlayerIndex.set(pk, player);
        if (team && !team.players.some(p => key(p.name) === pk)) team.players.push(player);
        return player;
    }

    function ingestTeams(rows) {
        (rows || []).forEach(row => {
            const teamName = rowValue(row, ['time', 'equipe', 'team', 'nome do time', 'nome']);
            if (!teamName) return;
            upsertTeam(teamName, {
                name: teamName,
                grupo: rowValue(row, ['grupo', 'group']),
                origem: rowValue(row, ['origem', 'classificação', 'classificacao', 'source', 'vaga'])
            });
        });
    }

    function ingestPlayers(rows) {
        (rows || []).forEach(row => {
            const playerName = rowValue(row, ['jogador', 'player', 'nick', 'nome']);
            const teamName = rowValue(row, ['time', 'equipe', 'team', 'organização', 'organizacao']);
            if (!playerName && !teamName) return;
            if (teamName) upsertTeam(teamName, {});
            if (!playerName) return;
            upsertPlayer({
                name: playerName,
                team: teamName,
                funcao: rowValue(row, ['posição', 'posicao', 'função', 'funcao', 'role']),
                pais: rowValue(row, ['país', 'pais', 'country', 'nacionalidade']),
                status: rowValue(row, ['status', 'situação', 'situacao']),
                photo: rowValue(row, ['foto', 'photo', 'imagem', 'url', 'link']) || getPlayerPhoto(playerName)
            });
        });
    }

    function applyMercadoArrivalsToLAFF() {
        if (!Array.isArray(window.mercadoData) && typeof mercadoData === 'undefined') return;
        const rows = Array.isArray(window.mercadoData) ? window.mercadoData : mercadoData;
        if (!Array.isArray(rows)) return;
        rows.forEach(row => {
            const status = norm(row.status);
            const official = ['FECHADO', 'OFICIAL', 'CONFIRMADO', 'CONFIRMADA'].includes(status);
            const dest = String(row.timeDestino || '').trim();
            if (!official || !dest) return;
            const team = getLAFFTeamByName(dest);
            if (!team) return;
            const players = (typeof getMercadoPlayers === 'function') ? getMercadoPlayers(row) : String(row.jogador || '').split(',').map(x => x.trim()).filter(Boolean);
            players.forEach(name => upsertPlayer({
                name,
                team: team.name,
                funcao: row.role || '',
                status: 'Confirmado',
                photo: getPlayerPhoto(name)
            }));
        });
    }

    async function loadLAFFResults() {
        try {
            const text = await fetchTextNoCache(LAFF_RESULTS_URL);
            const json = JSON.parse(text);
            laffResults = {
                dbQuedas: json.dbQuedas || {},
                dbJogadoresQuedas: json.dbJogadoresQuedas || {}
            };
            laffResultsLoaded = true;
        } catch (e) {
            laffResults = { dbQuedas: {}, dbJogadoresQuedas: {} };
            laffResultsLoaded = false;
        }
    }

    function hasLAFFDrops() {
        return Object.values(laffResults.dbQuedas || {}).some(day => Object.keys(day || {}).length);
    }

    function getAllDrops() {
        const drops = [];
        Object.keys(laffResults.dbQuedas || {}).sort((a,b)=>Number(a)-Number(b)).forEach(dia => {
            Object.keys(laffResults.dbQuedas[dia] || {}).sort((a,b)=>Number(a)-Number(b)).forEach(queda => {
                drops.push({ dia, queda, ...(laffResults.dbQuedas[dia][queda] || {}) });
            });
        });
        return drops;
    }

    function getPlacementPoints(pos) {
        const table = { 1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1, 11: 0, 12: 0 };
        return table[Number(pos)] || 0;
    }

    function computeTeamStats() {
        const byTeam = new Map();
        laffTeams.forEach(t => byTeam.set(key(t.name), { team: t.name, logo: t.logo, grupo: t.grupo, origem: t.origem, pontos: 0, kills: 0, booyah: 0, quedas: 0 }));
        getAllDrops().forEach(drop => {
            (drop.resultados || []).forEach(r => {
                const teamName = r.equipe || r.time || r.team || '';
                if (!teamName) return;
                const k = key(teamName);
                const team = getLAFFTeamByName(teamName);
                const stat = byTeam.get(k) || byTeam.get(key(team?.name)) || { team: team?.name || teamName, logo: getTeamLogo(teamName), grupo: team?.grupo || '', origem: team?.origem || '', pontos: 0, kills: 0, booyah: 0, quedas: 0 };
                stat.kills += Number(r.kills || r.abates || 0);
                stat.booyah += Number(r.booyah || 0);
                stat.pontos += Number(r.pontos || r.total || 0) || (Number(r.kills || r.abates || 0) + getPlacementPoints(r.posicao));
                stat.quedas += 1;
                byTeam.set(key(stat.team), stat);
            });
        });
        return [...byTeam.values()].sort((a, b) => b.pontos - a.pontos || b.booyah - a.booyah || b.kills - a.kills || a.team.localeCompare(b.team, 'pt-BR'));
    }

    function computePlayerStats() {
        const byPlayer = new Map();
        Object.values(laffResults.dbJogadoresQuedas || {}).forEach(day => {
            Object.values(day || {}).forEach(players => {
                (players || []).forEach(p => {
                    const name = p.nome || p.jogador || p.player || '';
                    if (!name) return;
                    const pk = key(name);
                    const existing = byPlayer.get(pk) || { name, team: p.equipe || '', kills: 0, dano: 0, assists: 0, mvp: 0, quedas: 0 };
                    existing.kills += Number(p.kills || p.abates || 0);
                    existing.dano += Number(p.dano || p.damage || 0);
                    existing.assists += Number(p.assists || p.assistencias || 0);
                    existing.mvp += Number(p.mvp || 0);
                    existing.quedas += 1;
                    existing.team = p.equipe || existing.team;
                    byPlayer.set(pk, existing);
                });
            });
        });
        return [...byPlayer.values()].sort((a,b)=>b.mvp-a.mvp || b.kills-a.kills || b.dano-a.dano || a.name.localeCompare(b.name,'pt-BR'));
    }

    function getLAFFTeamByName(name) {
        const direct = laffTeamIndex.get(key(name));
        if (direct) return direct;
        return laffTeams.find(t => slug(t.name) === slug(name) || norm(t.name) === norm(name) || teamMatches(t.name, name));
    }

    function getLAFFPlayerByName(name) {
        const direct = laffPlayerIndex.get(key(name));
        if (direct) return direct;
        return laffPlayers.find(p => slug(p.name) === slug(name) || norm(p.name) === norm(name) || playerMatches(p.name, name));
    }

    async function loadLAFFData() {
        if (laffLoaded) {
            renderLAFFPageIfVisible();
            return { teams: laffTeams, players: laffPlayers, results: laffResults };
        }
        if (laffLoading) return laffLoading;

        laffLoading = (async () => {
            laffTeamIndex = new Map();
            laffPlayerIndex = new Map();
            if (typeof loadTeamLogos === 'function' && !window.__cffTeamLogosLoaded) {
                try { await loadTeamLogos(); } catch (e) { console.warn('[LAFF] Logos não carregadas:', e); }
            }
            try { ingestTeams(parseTsv(await fetchTextNoCache(LAFF_TEAMS_URL)).rows || []); } catch (e) { console.warn('[LAFF] Lista de equipes não carregada:', e); }
            try { ingestPlayers(parseTsv(await fetchTextNoCache(LAFF_PLAYERS_URL)).rows || []); } catch (e) { console.warn('[LAFF] Elencos não carregados:', e); }
            try { if (typeof loadMercado === 'function') await loadMercado(); applyMercadoArrivalsToLAFF(); } catch (e) { console.warn('[LAFF] Mercado não aplicado:', e); }
            await loadLAFFResults();

            laffTeams = Array.from(laffTeamIndex.values()).sort((a, b) => {
                const ga = String(a.grupo || '').trim();
                const gb = String(b.grupo || '').trim();
                if (ga && gb && ga !== gb) return ga.localeCompare(gb, 'pt-BR', { numeric: true });
                if (ga && !gb) return -1;
                if (!ga && gb) return 1;
                return a.name.localeCompare(b.name, 'pt-BR', { numeric: true });
            });
            laffPlayers = Array.from(laffPlayerIndex.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
            laffLoaded = true;
            renderLAFFPageIfVisible();
            return { teams: laffTeams, players: laffPlayers, results: laffResults };
        })();
        return laffLoading;
    }

    function laffHero(title, subtitle = '') {
        return `<div class="laff-hero"><div class="laff-hero-main"><img src="laff.webp" onerror="this.onerror=null;this.src='trofeu.webp'" alt="Logo LAFF"><div><div class="laff-kicker">Liga Ascensão de Free Fire</div><h1>${escape(title)}</h1>${subtitle ? `<p>${escape(subtitle)}</p>` : ''}</div></div><div class="laff-hero-badges"><span>2 vagas FFWS BR S2</span><span>12 a 28 de junho</span></div></div>`;
    }

    function renderTeamCard(team) {
        const playersCount = team.players.length;
        const group = String(team.grupo || '').trim();
        const origin = getShortOrigin(team.origem);
        return `<button class="laff-team-card" type="button" onclick="openLAFFTeamProfile(${escape(jsArg(team.name))})"><img src="${escape(team.logo || 'escudo.webp')}" onerror="this.onerror=null;this.src='escudo.webp'" alt="${escape(team.name)}"><div class="laff-team-card-body"><strong>${escape(team.name)}</strong><span>${escape(origin)}</span></div><div class="laff-team-card-meta">${group ? `<small>Grupo ${escape(group)}</small>` : `<small>Grupo em breve</small>`}<small>${playersCount} jogador${playersCount === 1 ? '' : 'es'}</small></div></button>`;
    }

    function renderPlayerCard(player) {
        const team = getLAFFTeamByName(player.team);
        const teamLogo = team?.logo || getTeamLogo(player.team);
        return `<button class="laff-player-card" type="button" onclick="openLAFFPlayerProfile(${escape(jsArg(player.name))})"><img class="laff-player-photo" src="${escape(player.photo || 'silhueta.png')}" onerror="this.onerror=null;this.src='silhueta.png'" alt="${escape(player.name)}"><div class="laff-player-info"><strong>${escape(player.name)}</strong><span><img src="${escape(teamLogo || 'escudo.webp')}" onerror="this.onerror=null;this.src='escudo.webp'" alt=""> ${escape(player.team || 'Equipe a confirmar')}</span><small>${escape(player.funcao || 'Função em breve')}</small></div></button>`;
    }

    function renderTeamsGrid(containerId = 'laff-teams-wrap') {
        const wrap = document.getElementById(containerId);
        if (!wrap) return;
        if (!laffTeams.length) { wrap.innerHTML = `<div class="laff-empty">As equipes serão exibidas aqui conforme forem confirmadas.</div>`; return; }
        const hasGroups = laffTeams.some(t => String(t.grupo || '').trim());
        if (!hasGroups) { wrap.innerHTML = `<div class="laff-teams-grid">${laffTeams.map(renderTeamCard).join('')}</div>`; return; }
        const grouped = laffTeams.reduce((acc, team) => { const group = String(team.grupo || '').trim() || 'Sem grupo'; (acc[group] ||= []).push(team); return acc; }, {});
        wrap.innerHTML = Object.keys(grouped).sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true})).map(group => `<section class="laff-group-block"><h3>${escape(group === 'Sem grupo' ? 'Sem grupo definido' : `Grupo ${group}`)}</h3><div class="laff-teams-grid">${grouped[group].map(renderTeamCard).join('')}</div></section>`).join('');
    }

    function renderLAFFTeams() { renderTeamsGrid('laff-teams-wrap'); }

    function renderLAFFPlayers() {
        const wrap = document.getElementById('laff-players-wrap');
        if (!wrap) return;
        const q = norm(document.getElementById('laff-player-search')?.value || '');
        const rows = q ? laffPlayers.filter(p => norm(`${p.name} ${p.team} ${p.funcao}`).includes(q)) : laffPlayers;
        wrap.innerHTML = rows.length ? rows.map(renderPlayerCard).join('') : `<div class="laff-empty">Nenhum jogador encontrado.</div>`;
    }

    function renderLAFFClassificatoria() {
        const root = document.getElementById('laff-classificatoria-content');
        if (!root) return;
        const stats = computeTeamStats();
        root.innerHTML = `${laffHero('Classificatória', 'Tabela da LAFF 2026 Split 1')}
            <section class="laff-panel"><div class="laff-section-head"><div><h2>Classificação</h2><p>${hasLAFFDrops() ? 'Tabela atualizada conforme as quedas da LAFF.' : 'A classificação será atualizada quando o torneio começar.'}</p></div><span class="laff-updated">${stats.length} equipe(s)</span></div>
            <div class="table-container"><table class="laff-table"><thead><tr><th>#</th><th>Eqp</th><th>PTS</th><th>K</th><th>B!</th><th class="hide-mobile">Origem</th></tr></thead><tbody>${stats.map((s, i) => `<tr onclick="openLAFFTeamProfile(${escape(jsArg(s.team))})"><td>${i + 1}</td><td class="laff-table-team"><img src="${escape(s.logo || 'escudo.webp')}" onerror="this.src='escudo.webp'" alt=""> <span>${escape(s.team)}</span></td><td>${s.pontos}</td><td>${s.kills}</td><td>${s.booyah}</td><td class="hide-mobile">${escape(getShortOrigin(s.origem))}</td></tr>`).join('')}</tbody></table></div></section>`;
    }

    function renderLAFFEquipesPage() {
        const root = document.getElementById('laff-equipes-content');
        if (!root) return;
        root.innerHTML = `${laffHero('Equipes', 'Equipes confirmadas na LAFF')}
            <section class="laff-panel"><div class="laff-section-head"><div><h2>Equipes confirmadas</h2><p>Lista atualizada conforme os anúncios oficiais. Quando o grupo estiver vazio, a equipe aparece em layout único.</p></div><span class="laff-updated">${laffTeams.length} equipe(s)</span></div><div id="laff-teams-wrap"></div></section>
            <section class="laff-panel"><div class="laff-section-head"><div><h2>Jogadores inscritos</h2><p>Elencos serão completados aos poucos conforme novas confirmações.</p></div><input id="laff-player-search" class="laff-search" type="text" placeholder="Buscar jogador ou time..." oninput="renderLAFFPlayers()"></div><div id="laff-players-wrap" class="laff-players-grid"></div></section>`;
        renderTeamsGrid('laff-teams-wrap');
        renderLAFFPlayers();
    }

    function renderLAFFMVP() {
        const root = document.getElementById('laff-mvp-content');
        if (!root) return;
        const stats = computePlayerStats();
        root.innerHTML = `${laffHero('Ranking MVP', 'Ranking de jogadores da LAFF')}
            <section class="laff-panel"><div class="laff-section-head"><div><h2>MVP da LAFF</h2><p>${stats.length ? 'Ranking atualizado com os dados das quedas.' : 'O ranking será atualizado após as primeiras quedas.'}</p></div></div>
            ${stats.length ? `<div class="table-container"><table class="laff-table"><thead><tr><th>#</th><th>J</th><th>K</th><th>MVP</th><th class="hide-mobile">Dano</th><th class="hide-mobile">Equipe</th></tr></thead><tbody>${stats.map((p,i)=>`<tr onclick="openLAFFPlayerProfile(${escape(jsArg(p.name))})"><td>${i+1}</td><td>${escape(p.name)}</td><td>${p.kills}</td><td>${p.mvp}</td><td class="hide-mobile">${p.dano}</td><td class="hide-mobile">${escape(p.team)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="laff-empty">O ranking será exibido aqui quando o torneio começar.</div>`}</section>`;
    }

    function renderLAFFStats() {
        const root = document.getElementById('laff-stats-content');
        if (!root) return;
        const teams = computeTeamStats();
        const players = computePlayerStats();
        const drops = getAllDrops().length;
        root.innerHTML = `${laffHero('Estatísticas gerais', 'Resumo estatístico da LAFF')}
            <section class="laff-panel"><div class="grid-cards laff-stats-grid">
                ${statCard('Equipes', laffTeams.length)}
                ${statCard('Jogadores', laffPlayers.length)}
                ${statCard('Quedas', drops)}
                ${statCard('Vagas', '2', 'FFWS BR S2')}
            </div></section>
            <section class="laff-panel"><div class="laff-section-head"><div><h2>Destaques estatísticos</h2><p>${drops ? 'Líderes atuais do torneio.' : 'Os destaques serão exibidos após as primeiras quedas.'}</p></div></div>
                ${drops ? `<div class="grid-cards laff-stats-grid">${statCard('Líder em pontos', teams[0]?.team || '-')} ${statCard('Líder em kills', players[0]?.name || '-')} ${statCard('Mais booyahs', [...teams].sort((a,b)=>b.booyah-a.booyah)[0]?.team || '-')}</div>` : `<div class="laff-empty">Estatísticas em breve.</div>`}
            </section>`;
    }

    function renderLAFFDatas() {
        const root = document.getElementById('laff-datas-content');
        if (!root) return;
        root.innerHTML = `${laffHero('Datas', 'Calendário da LAFF 2026 Split 1')}
            <section class="laff-panel"><div class="laff-format-grid">
                <div class="laff-format-card"><strong>Início</strong><span>12 de junho</span></div>
                <div class="laff-format-card"><strong>Fim previsto</strong><span>28 de junho</span></div>
                <div class="laff-format-card"><strong>Vagas</strong><span>Top 2 para FFWS BR 2026 S2</span></div>
                <div class="laff-format-card"><strong>Equipes</strong><span>Confirmação gradual</span></div>
            </div></section>`;
    }

    function renderLAFFSelecoes() {
        const root = document.getElementById('laff-selecoes-content');
        if (!root) return;
        root.innerHTML = `${laffHero('Seleções da LAFF', 'Melhores jogadores da competição')}
            <section class="laff-panel"><div class="laff-section-head"><div><h2>Seleção da LAFF</h2><p>A seleção será montada quando houver dados suficientes do torneio.</p></div></div><div class="laff-empty">Seleção em breve.</div></section>`;
    }

    function renderLAFFPageIfVisible() {
        const active = document.querySelector('.page.active')?.id || '';
        if (active === 'laff-2026-s1') { navigate('laff-classificatoria'); return; }
        if (active === 'laff-classificatoria') renderLAFFClassificatoria();
        if (active === 'laff-equipes') renderLAFFEquipesPage();
        if (active === 'laff-mvp') renderLAFFMVP();
        if (active === 'laff-stats') renderLAFFStats();
        if (active === 'laff-datas') renderLAFFDatas();
        if (active === 'laff-selecoes') renderLAFFSelecoes();
    }

    function setHash(value) {
        const s = slug(value);
        if (s && typeof history !== 'undefined') history.replaceState(null, '', '#' + s);
    }

    function statCard(label, value, sub = '') {
        return `<div class="card laff-stat-card"><div class="card-top-border"></div><h3>${escape(label)}</h3><div class="value">${escape(value)}</div>${sub ? `<div class="laff-stat-sub">${escape(sub)}</div>` : ''}</div>`;
    }

    function getHistoricalStats(playerName) {
        const stats = { totalKills: 0, totalMatches: 0, avg: '0.00', bestEdition: null, editions: [], rank: null };
        const data = (typeof lbffData !== 'undefined' && lbffData) ? lbffData : {};
        const entryKey = Object.keys(data).find(name => playerMatches(name, playerName) || key(name) === key(playerName));
        if (!entryKey) return stats;
        const editions = data[entryKey] || {};
        Object.entries(editions).forEach(([edition, row]) => {
            const kills = Number(row.k || row.kills || 0);
            const matches = Number(row.q || row.quedas || row.matches || 0);
            stats.totalKills += kills;
            stats.totalMatches += matches;
            const item = { edition, kills, matches, avg: matches ? (kills / matches).toFixed(2) : '0.00' };
            stats.editions.push(item);
            if (!stats.bestEdition || kills > stats.bestEdition.kills) stats.bestEdition = item;
        });
        stats.avg = stats.totalMatches ? (stats.totalKills / stats.totalMatches).toFixed(2) : '0.00';
        const ranking = Object.keys(data).map(name => {
            const total = Object.values(data[name] || {}).reduce((sum, row) => sum + Number(row.k || 0), 0);
            return { name, total };
        }).sort((a,b)=>b.total-a.total);
        const idx = ranking.findIndex(r => key(r.name) === key(entryKey));
        stats.rank = idx >= 0 ? idx + 1 : null;
        return stats;
    }

    function buildPlayerHistoryCards(player) {
        const hist = getHistoricalStats(player.name);
        if (!hist.totalKills) {
            return `<div class="laff-empty">Histórico estatístico será exibido quando houver dados registrados para este jogador.</div>`;
        }
        return `<div class="grid-cards laff-stats-grid">
            ${statCard('Abates históricos', hist.totalKills)}
            ${statCard('Quedas históricas', hist.totalMatches)}
            ${statCard('Média K/Q', hist.avg)}
            ${statCard('Ranking histórico', hist.rank ? `${hist.rank}º` : '-')}
        </div>
        ${buildPlayerHistoryBreakdown(hist, 'laff')}`;
    }

    function buildPlayerHistoryBreakdown(hist, scope = 'laff') {
        const rows = (hist && Array.isArray(hist.editions)) ? hist.editions : [];
        if (!rows.length) return '';
        const compact = rows.slice(0, 3);
        const id = `${scope}-history-breakdown-${Math.random().toString(36).slice(2, 8)}`;
        return `<div class="cff-history-compact">
            <div class="cff-history-compact-head">
                <div>
                    <strong>LBFF/WB por edição</strong>
                    <span>${rows.length} edição${rows.length === 1 ? '' : 'ões'} registrada${rows.length === 1 ? '' : 's'}</span>
                </div>
                <button class="cff-expand-btn" type="button" onclick="window.cffToggleHistoryBreakdown('${id}', this)">Ver detalhes</button>
            </div>
            <div class="cff-history-mini-list">
                ${compact.map(ed => `<div class="cff-history-mini-pill"><strong>${escape(ed.edition)}</strong><span>${ed.kills} K • ${ed.avg} K/Q</span></div>`).join('')}
            </div>
            <div id="${id}" class="cff-history-breakdown" hidden>
                ${rows.map(ed => `<div class="cff-history-row"><strong>${escape(ed.edition)}</strong><span>${ed.kills} K • ${ed.matches} quedas • média ${ed.avg}</span></div>`).join('')}
            </div>
        </div>`;
    }

    function getLAFFPlayerCurrentStats(playerName) {
        return computePlayerStats().find(p => playerMatches(p.name, playerName) || key(p.name) === key(playerName)) || null;
    }

    function buildLAFFTeammates(player) {
        const team = getLAFFTeamByName(player.team);
        const mates = (team?.players || []).filter(p => !playerMatches(p.name, player.name));
        if (!mates.length) return `<div class="laff-empty">Companheiros de equipe serão exibidos conforme o elenco for confirmado.</div>`;
        return `<div class="laff-players-grid laff-teammates-grid">${mates.map(renderPlayerCard).join('')}</div>`;
    }

    function buildLAFFTeamHistoryFallback(player) {
        const team = getLAFFTeamByName(player.team);
        const logo = team?.logo || getTeamLogo(player.team);
        if (!player.team) return `<div class="laff-empty">Histórico de equipes será atualizado conforme novos registros forem encontrados.</div>`;
        return `<button class="laff-team-history-card" type="button" onclick="openLAFFTeamProfile(${escape(jsArg(player.team))})">
            <img src="${escape(logo || 'escudo.webp')}" onerror="this.onerror=null;this.src='escudo.webp'" alt="${escape(player.team)}">
            <div><strong>${escape(player.team)}</strong><span>ATUAL • LAFF 2026 S1</span></div>
        </button>`;
    }

    function hydrateLAFFPlayerExternalSections(player) {
        const historyWrap = document.getElementById('laff-player-team-history');
        if (historyWrap && typeof renderHistoricoEquipes === 'function') {
            renderHistoricoEquipes(player.name, 'laff-player-team-history');
            const hasCards = historyWrap.textContent.trim() && !/Nenhum|sem histórico/i.test(historyWrap.textContent);
            if (!hasCards || !historyWrap.children.length) historyWrap.innerHTML = buildLAFFTeamHistoryFallback(player);
        } else if (historyWrap) {
            historyWrap.innerHTML = buildLAFFTeamHistoryFallback(player);
        }

        const trophyWrap = document.getElementById('laff-player-trophies');
        if (trophyWrap && typeof renderUnifiedTrophies === 'function') {
            renderUnifiedTrophies(player.name, 'laff-player-trophies');
            if (!trophyWrap.textContent.trim() || /nenhum/i.test(trophyWrap.textContent)) trophyWrap.innerHTML = `<div class="laff-trophy-empty">EM BREVE</div>`;
        } else if (trophyWrap) {
            trophyWrap.innerHTML = `<div class="laff-trophy-empty">EM BREVE</div>`;
        }
    }

    async function openLAFFTeamProfile(name) {
        await loadLAFFData();
        const team = getLAFFTeamByName(name);
        if (!team) { alert('Equipe LAFF não encontrada.'); return; }
        setHash(team.name);
        navigate('laff-team-profile');
        const root = document.getElementById('laff-team-profile-content');
        if (!root) return;
        const group = String(team.grupo || '').trim();
        const teamStats = computeTeamStats().find(s => teamMatches(s.team, team.name));
        const started = hasLAFFDrops() && teamStats && teamStats.quedas > 0;
        root.innerHTML = `<section class="laff-profile-hero"><img class="laff-profile-logo" src="${escape(team.logo || 'escudo.webp')}" onerror="this.onerror=null;this.src='escudo.webp'" alt="${escape(team.name)}"><div><div class="laff-kicker">LAFF 2026 Split 1</div><h1>${escape(team.name)}</h1><p>${escape(getShortOrigin(team.origem))}${group ? ` • Grupo ${escape(group)}` : ''}</p></div></section>
            <section class="laff-panel laff-profile-section"><h2>Jogadores da equipe</h2><div class="laff-players-grid">${team.players.length ? team.players.map(renderPlayerCard).join('') : `<div class="laff-empty">Elenco será exibido conforme os jogadores forem confirmados.</div>`}</div></section>
            <section class="laff-panel laff-profile-section"><h2>Informações da equipe</h2><div class="grid-cards laff-stats-grid">${statCard('Jogadores', team.players.length)}${statCard('Grupo', group || 'Em breve')}${statCard('Origem', getShortOrigin(team.origem))}${statCard('Vaga', 'FFWS BR S2', 'top 2 do torneio')}</div></section>
            ${started ? `<section class="laff-panel laff-profile-section"><h2>Desempenho atual</h2><div class="grid-cards laff-stats-grid">${statCard('Pontos', teamStats.pontos)}${statCard('Abates', teamStats.kills)}${statCard('Booyahs', teamStats.booyah)}${statCard('Quedas', teamStats.quedas)}</div></section>` : ''}
            <section class="laff-panel laff-profile-section"><h2>Galeria de troféus</h2><div class="laff-trophy-empty">EM BREVE</div></section>
            <button class="btn-action laff-main-link" type="button" onclick="navigate('laff-equipes')">Ir para a página da LAFF</button>`;
    }

    async function openLAFFPlayerProfile(name) {
        await loadLAFFData();
        const player = getLAFFPlayerByName(name);
        if (!player) { alert('Jogador LAFF não encontrado.'); return; }
        setHash(player.name);
        navigate('laff-player-profile');
        const root = document.getElementById('laff-player-profile-content');
        if (!root) return;

        const team = getLAFFTeamByName(player.team);
        const teamLogo = team?.logo || getTeamLogo(player.team);
        const hist = getHistoricalStats(player.name);
        const current = getLAFFPlayerCurrentStats(player.name);
        const started = hasLAFFDrops() && current && current.quedas > 0;
        const histSummary = hist.totalKills
            ? `${hist.totalKills} abates históricos em ${hist.totalMatches} quedas registradas de LBFF/WB, com média de ${hist.avg} K/Q.`
            : 'Histórico estatístico será atualizado conforme novos registros forem encontrados.';
        const bestText = hist.bestEdition
            ? ` Melhor edição: ${hist.bestEdition.edition}, com ${hist.bestEdition.kills} abates.`
            : '';

        root.innerHTML = `<section class="laff-profile-hero laff-player-profile-hero laff-player-modern-hero">
                <div class="laff-player-circle-photo-wrap">
                    <img class="laff-player-circle-photo" src="${escape(player.photo || 'silhueta.png')}" onerror="this.onerror=null;this.src='silhueta.png'" alt="${escape(player.name)}">
                    ${teamLogo ? `<button class="laff-player-team-floating" type="button" onclick="openLAFFTeamProfile(${escape(jsArg(player.team))})"><img src="${escape(teamLogo)}" onerror="this.onerror=null;this.src='escudo.webp'" alt="${escape(player.team)}"></button>` : ''}
                </div>
                <div class="laff-player-hero-info">
                    <div class="laff-kicker">Jogador LAFF 2026 Split 1</div>
                    <h1>${escape(player.name)}</h1>
                    <p>${escape(player.funcao || 'Função em breve')} • ${escape(player.status || 'Confirmado')}</p>
                    <button class="btn-action laff-team-mini-link" type="button" onclick="openLAFFTeamProfile(${escape(jsArg(player.team))})"><img src="${escape(teamLogo || 'escudo.webp')}" onerror="this.onerror=null;this.src='escudo.webp'" alt=""> ${escape(player.team || 'Equipe a confirmar')}</button>
                </div>
            </section>

            <section class="laff-panel laff-profile-section"><h2>Resumo histórico</h2><p><strong>${escape(player.name)}</strong> está listado para a disputa da <strong>LAFF 2026 Split 1</strong>${player.team ? ` pela equipe <strong>${escape(player.team)}</strong>` : ''}. ${escape(histSummary + bestText)}</p></section>

            <section class="laff-panel laff-profile-section"><h2>Elenco atual</h2><p class="laff-section-subtitle">Companheiros de equipe confirmados para a LAFF.</p>${buildLAFFTeammates(player)}</section>

            ${started ? `<section class="laff-panel laff-profile-section"><h2>Desempenho atual</h2><div class="grid-cards laff-stats-grid">${statCard('Abates', current.kills)}${statCard('MVP', current.mvp)}${statCard('Dano', current.dano)}${statCard('Quedas', current.quedas)}</div></section>` : ''}

            <section class="laff-panel laff-profile-section"><h2>Desempenho histórico</h2>${buildPlayerHistoryCards(player)}</section>

            <section class="laff-panel laff-profile-section"><h2>Histórico de equipes</h2><div id="laff-player-team-history" class="laff-team-history-wrap"></div></section>

            ${started ? `<section class="laff-panel laff-profile-section"><h2>Notas CFF</h2><div class="laff-empty">As notas CFF da LAFF serão atualizadas conforme as quedas forem processadas.</div></section>` : ''}

            <section class="laff-panel laff-profile-section"><h2>Galeria de troféus</h2><div id="laff-player-trophies" class="laff-trophies-wrap"><div class="laff-trophy-empty">EM BREVE</div></div></section>`;

        hydrateLAFFPlayerExternalSections(player);
    }

    function resolveHashLoaded(hash) {
        const clean = String(hash || '').replace(/^#/, '').trim();
        if (!clean) return false;
        const team = laffTeams.find(t => slug(t.name) === slug(clean));
        if (team) { openLAFFTeamProfile(team.name); return true; }
        const player = laffPlayers.find(p => slug(p.name) === slug(clean));
        if (player) { openLAFFPlayerProfile(player.name); return true; }
        return false;
    }

    function patchNavigationAndSearch() {
        if (window.__laffPatched) return;
        window.__laffPatched = true;
        const originalNavigate = window.navigate;
        window.navigate = function(pageId) {
            const out = typeof originalNavigate === 'function' ? originalNavigate(pageId) : null;
            if (String(pageId || '').startsWith('laff-')) loadLAFFData().then(renderLAFFPageIfVisible).catch(()=>{});
            return out;
        };

        const originalTeamPool = window.navBuildTeamSearchPool;
        window.navBuildTeamSearchPool = function () {
            const base = typeof originalTeamPool === 'function' ? originalTeamPool() : [];
            const laff = laffTeams.map(t => {
                const simpleName = String(t.name || '').replace(/\b(gaming|esports?|team|clube|club|fc)\b/ig, ' ').replace(/\s+/g, ' ').trim();
                return {
                    type: 'laff-team',
                    name: t.name,
                    title: t.name,
                    sub: 'Equipe LAFF 2026 S1',
                    img: t.logo || getTeamLogo(t.name),
                    priority: 10,
                    haystack: `${t.name} ${simpleName} ${t.origem || ''} ${t.grupo || ''} laff liga ascensao free fire`.toLowerCase()
                };
            });
            return base.concat(laff);
        };
        const originalPlayerPool = window.navBuildPlayerSearchPool;
        window.navBuildPlayerSearchPool = function () {
            const base = typeof originalPlayerPool === 'function' ? originalPlayerPool() : [];
            const laff = laffPlayers.map(p => ({
                type: 'laff-player',
                name: p.name,
                title: p.name,
                sub: `${p.team || 'LAFF'} • Jogador LAFF`,
                img: p.photo || getPlayerPhoto(p.name),
                priority: 4,
                haystack: `${p.name} ${p.team || ''} ${p.funcao || ''} jogador laff liga ascensao free fire`.toLowerCase()
            }));
            return base.concat(laff);
        };
        const originalSelect = window.selectSearchResult;
        window.selectSearchResult = function (type, name) {
            if (type === 'laff-team') { if (typeof window.navCloseSearchUI === 'function') window.navCloseSearchUI(); return openLAFFTeamProfile(name); }
            if (type === 'laff-player') { if (typeof window.navCloseSearchUI === 'function') window.navCloseSearchUI(); return openLAFFPlayerProfile(name); }
            return typeof originalSelect === 'function' ? originalSelect(type, name) : null;
        };
        const originalResolve = window.cffResolveHashRoute;
        window.cffResolveHashRoute = function (hash) {
            const clean = String(hash || '').replace(/^#/, '').trim();
            if (laffLoaded && resolveHashLoaded(clean)) return true;
            const handled = typeof originalResolve === 'function' ? originalResolve(hash) : false;
            if (handled) return true;
            loadLAFFData().then(() => resolveHashLoaded(clean)).catch(() => {});
            return false;
        };
    }

    window.cffToggleHistoryBreakdown = window.cffToggleHistoryBreakdown || function (id, btn) {
        const el = document.getElementById(id);
        if (!el) return;
        const willOpen = el.hasAttribute('hidden');
        if (willOpen) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
        if (btn) btn.textContent = willOpen ? 'Ocultar detalhes' : 'Ver detalhes';
    };

    window.loadLAFFData = loadLAFFData;
    window.renderLAFFTeams = renderLAFFTeams;
    window.renderLAFFPlayers = renderLAFFPlayers;
    window.renderLAFFPageIfVisible = renderLAFFPageIfVisible;
    window.openLAFFTeamProfile = openLAFFTeamProfile;
    window.openLAFFPlayerProfile = openLAFFPlayerProfile;
    window.getLAFFTeams = () => laffTeams;
    window.getLAFFPlayers = () => laffPlayers;

    document.addEventListener('DOMContentLoaded', () => {
        patchNavigationAndSearch();
        loadLAFFData().then(() => {
            const hash = window.location.hash.replace('#', '').trim();
            if (hash && typeof window.cffResolveHashRoute === 'function') window.cffResolveHashRoute(hash);
            renderLAFFPageIfVisible();
        }).catch(err => console.warn('[LAFF] Falha geral:', err));
    });
})();
