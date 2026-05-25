/* =============================================
   LAFF 2026 S1 - Liga Ascensão de Free Fire
   ============================================= */
(function () {
    const LAFF_TEAMS_URL = window.CFF_CONFIG?.sheets?.laffEquipes || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR6Paknya4E3qRT2mLd0fQMIiBKhuGOPebF0pLK9c0Gk5nRnVWNdY4FxMJV42467JLmwNNumXSc4fCC/pub?gid=1173171217&single=true&output=tsv';
    const LAFF_PLAYERS_URL = window.CFF_CONFIG?.sheets?.laffJogadores || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR6Paknya4E3qRT2mLd0fQMIiBKhuGOPebF0pLK9c0Gk5nRnVWNdY4FxMJV42467JLmwNNumXSc4fCC/pub?gid=260123003&single=true&output=tsv';

    let laffLoaded = false;
    let laffLoading = null;
    let laffTeams = [];
    let laffPlayers = [];
    let laffTeamIndex = new Map();
    let laffPlayerIndex = new Map();
    let currentLAFFTab = 'equipes';

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
        return String(value || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
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

    function getShortOrigin(origin) {
        const n = norm(origin);
        if (!n) return 'A confirmar';
        if (n.includes('CONVID')) return 'Convidado';
        if (n.includes('QUAL')) return 'Qualificatório';
        if (n.includes('FFWS')) return 'FFWS BR S1';
        return origin;
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
            const team = upsertTeam(teamName || rowValue(row, ['origem']), {});
            if (!playerName) return;

            const player = {
                name: playerName,
                team: team ? team.name : teamName,
                funcao: rowValue(row, ['posição', 'posicao', 'função', 'funcao', 'role']),
                pais: rowValue(row, ['país', 'pais', 'country', 'nacionalidade']),
                status: rowValue(row, ['status', 'situação', 'situacao']),
                photo: rowValue(row, ['foto', 'photo', 'imagem', 'url', 'link']) || getPlayerPhoto(playerName)
            };

            const pk = key(player.name);
            laffPlayerIndex.set(pk, player);
            if (team && !team.players.some(p => key(p.name) === pk)) team.players.push(player);
        });
    }

    async function loadLAFFData() {
        if (laffLoaded) {
            renderLAFFPageIfVisible();
            return { teams: laffTeams, players: laffPlayers };
        }
        if (laffLoading) return laffLoading;

        laffLoading = (async () => {
            laffTeamIndex = new Map();
            laffPlayerIndex = new Map();

            if (typeof loadTeamLogos === 'function' && !window.__cffTeamLogosLoaded) {
                try { await loadTeamLogos(); } catch (e) { console.warn('[LAFF] Logos não carregadas:', e); }
            }

            try {
                const teamsParsed = parseTsv(await fetchTextNoCache(LAFF_TEAMS_URL));
                ingestTeams(teamsParsed.rows || []);
            } catch (e) {
                console.warn('[LAFF] Lista de equipes não carregada:', e);
            }

            try {
                const playersParsed = parseTsv(await fetchTextNoCache(LAFF_PLAYERS_URL));
                ingestPlayers(playersParsed.rows || []);
            } catch (e) {
                console.warn('[LAFF] Elencos não carregados:', e);
            }

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
            return { teams: laffTeams, players: laffPlayers };
        })();

        return laffLoading;
    }

    function getLAFFTeamByName(name) {
        const direct = laffTeamIndex.get(key(name));
        if (direct) return direct;
        return laffTeams.find(t => slug(t.name) === slug(name) || norm(t.name) === norm(name));
    }

    function getLAFFPlayerByName(name) {
        const direct = laffPlayerIndex.get(key(name));
        if (direct) return direct;
        return laffPlayers.find(p => slug(p.name) === slug(name) || norm(p.name) === norm(name));
    }

    function renderTeamCard(team) {
        const playersCount = team.players.length;
        const group = String(team.grupo || '').trim();
        const origin = getShortOrigin(team.origem);
        return `
            <button class="laff-team-card" type="button" onclick="openLAFFTeamProfile(${escape(jsArg(team.name))})">
                <img src="${escape(team.logo || 'escudo.webp')}" onerror="this.onerror=null;this.src='escudo.webp'" alt="${escape(team.name)}">
                <div class="laff-team-card-body">
                    <strong>${escape(team.name)}</strong>
                    <span>${escape(origin)}</span>
                </div>
                <div class="laff-team-card-meta">
                    ${group ? `<small>Grupo ${escape(group)}</small>` : `<small>Grupo em breve</small>`}
                    <small>${playersCount} jogador${playersCount === 1 ? '' : 'es'}</small>
                </div>
            </button>`;
    }

    function renderLAFFTeams() {
        const wrap = document.getElementById('laff-teams-wrap');
        const updated = document.getElementById('laff-teams-updated');
        if (!wrap) return;
        if (updated) updated.textContent = `${laffTeams.length} equipe(s)`;

        if (!laffTeams.length) {
            wrap.innerHTML = `<div class="laff-empty">As equipes serão exibidas aqui conforme forem confirmadas.</div>`;
            return;
        }

        const hasGroups = laffTeams.some(t => String(t.grupo || '').trim());
        if (!hasGroups) {
            wrap.innerHTML = `<div class="laff-teams-grid">${laffTeams.map(renderTeamCard).join('')}</div>`;
            return;
        }

        const grouped = laffTeams.reduce((acc, team) => {
            const group = String(team.grupo || '').trim() || 'Sem grupo';
            if (!acc[group]) acc[group] = [];
            acc[group].push(team);
            return acc;
        }, {});

        wrap.innerHTML = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })).map(group => `
            <section class="laff-group-block">
                <h3>${escape(group === 'Sem grupo' ? 'Sem grupo definido' : `Grupo ${group}`)}</h3>
                <div class="laff-teams-grid">${grouped[group].map(renderTeamCard).join('')}</div>
            </section>`).join('');
    }

    function renderPlayerCard(player) {
        const team = getLAFFTeamByName(player.team);
        const teamLogo = team?.logo || getTeamLogo(player.team);
        return `
            <button class="laff-player-card" type="button" onclick="openLAFFPlayerProfile(${escape(jsArg(player.name))})">
                <img class="laff-player-photo" src="${escape(player.photo || 'silhueta.png')}" onerror="this.onerror=null;this.src='silhueta.png'" alt="${escape(player.name)}">
                <div class="laff-player-info">
                    <strong>${escape(player.name)}</strong>
                    <span><img src="${escape(teamLogo || 'escudo.webp')}" onerror="this.onerror=null;this.src='escudo.webp'" alt=""> ${escape(player.team || 'Equipe a confirmar')}</span>
                    <small>${escape(player.funcao || 'Função em breve')}</small>
                </div>
            </button>`;
    }

    function renderLAFFPlayers() {
        const wrap = document.getElementById('laff-players-wrap');
        if (!wrap) return;
        const q = norm(document.getElementById('laff-player-search')?.value || '');
        const rows = q ? laffPlayers.filter(p => norm(`${p.name} ${p.team} ${p.funcao}`).includes(q)) : laffPlayers;

        if (!rows.length) {
            wrap.innerHTML = `<div class="laff-empty">Nenhum jogador encontrado.</div>`;
            return;
        }
        wrap.innerHTML = rows.map(renderPlayerCard).join('');
    }

    function renderLAFFPageIfVisible() {
        const page = document.getElementById('laff-2026-s1');
        if (!page || !page.classList.contains('active')) return;
        renderLAFFTeams();
        renderLAFFPlayers();
    }

    function setLAFFTab(tab) {
        currentLAFFTab = tab || 'equipes';
        document.querySelectorAll('.laff-tab').forEach(btn => btn.classList.toggle('active', btn.textContent.toLowerCase().includes(currentLAFFTab === 'equipes' ? 'equipes' : currentLAFFTab === 'jogadores' ? 'jogadores' : 'formato')));
        document.querySelectorAll('[data-laff-tab-panel]').forEach(panel => {
            panel.style.display = panel.getAttribute('data-laff-tab-panel') === currentLAFFTab ? '' : 'none';
        });
        loadLAFFData().then(() => {
            if (currentLAFFTab === 'equipes') renderLAFFTeams();
            if (currentLAFFTab === 'jogadores') renderLAFFPlayers();
        });
    }

    function setHash(value) {
        const s = slug(value);
        if (s && typeof history !== 'undefined') history.replaceState(null, '', '#' + s);
    }

    function statCard(label, value, sub = '') {
        return `<div class="card laff-stat-card"><div class="card-top-border"></div><h3>${escape(label)}</h3><div class="value">${escape(value)}</div>${sub ? `<div class="laff-stat-sub">${escape(sub)}</div>` : ''}</div>`;
    }

    async function openLAFFTeamProfile(name) {
        await loadLAFFData();
        const team = getLAFFTeamByName(name);
        if (!team) {
            alert('Equipe LAFF não encontrada.');
            return;
        }
        setHash(team.name);
        navigate('laff-team-profile');
        const root = document.getElementById('laff-team-profile-content');
        if (!root) return;
        const group = String(team.grupo || '').trim();
        root.innerHTML = `
            <section class="laff-profile-hero">
                <img class="laff-profile-logo" src="${escape(team.logo || 'escudo.webp')}" onerror="this.onerror=null;this.src='escudo.webp'" alt="${escape(team.name)}">
                <div>
                    <div class="laff-kicker">LAFF 2026 Split 1</div>
                    <h1>${escape(team.name)}</h1>
                    <p>${escape(getShortOrigin(team.origem))}${group ? ` • Grupo ${escape(group)}` : ''}</p>
                </div>
            </section>
            <section class="laff-panel laff-profile-section">
                <h2>Jogadores da equipe</h2>
                <div class="laff-players-grid">${team.players.length ? team.players.map(renderPlayerCard).join('') : `<div class="laff-empty">Elenco será exibido conforme os jogadores forem confirmados.</div>`}</div>
            </section>
            <section class="laff-panel laff-profile-section">
                <h2>Desempenho atual</h2>
                <div class="grid-cards laff-stats-grid">
                    ${statCard('Jogadores', team.players.length)}
                    ${statCard('Grupo', group || 'Em breve')}
                    ${statCard('Origem', getShortOrigin(team.origem))}
                    ${statCard('Vaga', 'FFWS BR S2', 'top 2 do torneio')}
                </div>
            </section>
            <section class="laff-panel laff-profile-section">
                <h2>Galeria de troféus</h2>
                <div class="laff-trophy-empty">EM BREVE</div>
            </section>
            <button class="btn-action laff-main-link" type="button" onclick="navigate('laff-2026-s1')">Ir para a página da LAFF</button>`;
    }

    async function openLAFFPlayerProfile(name) {
        await loadLAFFData();
        const player = getLAFFPlayerByName(name);
        if (!player) {
            alert('Jogador LAFF não encontrado.');
            return;
        }
        setHash(player.name);
        navigate('laff-player-profile');
        const root = document.getElementById('laff-player-profile-content');
        if (!root) return;
        const team = getLAFFTeamByName(player.team);
        const teamLogo = team?.logo || getTeamLogo(player.team);
        root.innerHTML = `
            <section class="laff-profile-hero laff-player-profile-hero">
                <img class="laff-profile-player-photo" src="${escape(player.photo || 'silhueta.png')}" onerror="this.onerror=null;this.src='silhueta.png'" alt="${escape(player.name)}">
                <div>
                    <div class="laff-kicker">Jogador LAFF 2026 Split 1</div>
                    <h1>${escape(player.name)}</h1>
                    <p>${escape(player.funcao || 'Função em breve')}</p>
                    <button class="btn-action laff-team-mini-link" type="button" onclick="openLAFFTeamProfile(${escape(jsArg(player.team))})">
                        <img src="${escape(teamLogo || 'escudo.webp')}" onerror="this.onerror=null;this.src='escudo.webp'" alt=""> ${escape(player.team || 'Equipe a confirmar')}
                    </button>
                </div>
            </section>
            <section class="laff-panel laff-profile-section">
                <h2>Resumo histórico</h2>
                <p><strong>${escape(player.name)}</strong> está listado para a disputa da <strong>LAFF 2026 Split 1</strong>${player.team ? ` pela equipe <strong>${escape(player.team)}</strong>` : ''}.</p>
            </section>
            <section class="laff-panel laff-profile-section">
                <h2>Dados do jogador</h2>
                <div class="grid-cards laff-stats-grid">
                    ${statCard('Equipe', player.team || 'Em breve')}
                    ${statCard('Função', player.funcao || 'Em breve')}
                    ${statCard('País', player.pais || 'Em breve')}
                    ${statCard('Status', player.status || 'Confirmado')}
                </div>
            </section>`;
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

    function patchSearchAndHash() {
        if (window.__laffPatched) return;
        window.__laffPatched = true;

        const originalTeamPool = window.navBuildTeamSearchPool;
        window.navBuildTeamSearchPool = function () {
            const base = typeof originalTeamPool === 'function' ? originalTeamPool() : [];
            const laff = laffTeams.map(t => ({
                type: 'laff-team',
                name: t.name,
                title: t.name,
                sub: 'Equipe LAFF 2026 S1',
                img: t.logo || getTeamLogo(t.name),
                priority: 4,
                haystack: `${t.name} ${t.grupo || ''} ${t.origem || ''} laff liga ascensao free fire`.toLowerCase()
            }));
            return base.concat(laff);
        };

        const originalPeoplePool = window.navBuildPeopleSearchPool;
        window.navBuildPeopleSearchPool = function () {
            const base = typeof originalPeoplePool === 'function' ? originalPeoplePool() : [];
            const laff = laffPlayers.map(p => ({
                type: 'laff-player',
                name: p.name,
                originalName: p.name,
                title: p.name,
                sub: `${p.team || 'LAFF'} • LAFF 2026 S1`,
                img: p.photo || getPlayerPhoto(p.name),
                priority: 4,
                haystack: `${p.name} ${p.team || ''} ${p.funcao || ''} jogador laff liga ascensao free fire`.toLowerCase()
            }));
            return base.concat(laff);
        };

        const originalSelect = window.selectSearchResult;
        window.selectSearchResult = function (type, name) {
            if (type === 'laff-team') {
                if (typeof window.navCloseSearchUI === 'function') window.navCloseSearchUI();
                return openLAFFTeamProfile(name);
            }
            if (type === 'laff-player') {
                if (typeof window.navCloseSearchUI === 'function') window.navCloseSearchUI();
                return openLAFFPlayerProfile(name);
            }
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

    window.loadLAFFData = loadLAFFData;
    window.renderLAFFTeams = renderLAFFTeams;
    window.renderLAFFPlayers = renderLAFFPlayers;
    window.setLAFFTab = setLAFFTab;
    window.openLAFFTeamProfile = openLAFFTeamProfile;
    window.openLAFFPlayerProfile = openLAFFPlayerProfile;
    window.getLAFFTeams = () => laffTeams;
    window.getLAFFPlayers = () => laffPlayers;

    document.addEventListener('DOMContentLoaded', () => {
        patchSearchAndHash();
        loadLAFFData().then(() => {
            const hash = window.location.hash.replace('#', '').trim();
            if (hash && typeof window.cffResolveHashRoute === 'function') window.cffResolveHashRoute(hash);
        }).catch(err => console.warn('[LAFF] Falha geral:', err));
    });
})();
