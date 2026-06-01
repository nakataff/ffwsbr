/* =============================================
   PERFIS FFWS SEA - jogadores e equipes
   ============================================= */
(function () {
    const SEA_COUNTRIES_URL = 'dados sea/jogadores_paises.tsv';
    const SEA_PHOTOS_URL = window.CFF_CONFIG?.sheets?.fotosJogadores || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR6Paknya4E3qRT2mLd0fQMIiBKhuGOPebF0pLK9c0Gk5nRnVWNdY4FxMJV42467JLmwNNumXSc4fCC/pub?gid=775988627&single=true&output=tsv';
    const SEA_KILLS_JSON_URL = window.CFF_CONFIG?.sheets?.seaAbatesJson || 'ffws-sea-abates.json';
    const SEA_KILLS_TSV_URL = window.CFF_CONFIG?.sheets?.seaAbates || '';

    const SEA_FLAG_EMOJI = {
        'TAILÂNDIA': '🇹🇭', 'TAILANDIA': '🇹🇭',
        'VIETNÃ': '🇻🇳', 'VIETNA': '🇻🇳', 'VIETNAM': '🇻🇳',
        'INDONÉSIA': '🇮🇩', 'INDONESIA': '🇮🇩',
        'MALÁSIA': '🇲🇾', 'MALASIA': '🇲🇾', 'MALAYSIA': '🇲🇾',
        'FILIPINAS': '🇵🇭', 'PHILIPPINES': '🇵🇭',
        'SINGAPURA': '🇸🇬', 'SINGAPORE': '🇸🇬',
        'CAMBOJA': '🇰🇭', 'CAMBODIA': '🇰🇭',
        'LAOS': '🇱🇦',
        'MIANMAR': '🇲🇲', 'MYANMAR': '🇲🇲'
    };

    const SEA_COUNTRY_CODES = {
        'TAILÂNDIA': 'th', 'TAILANDIA': 'th', 'THAILAND': 'th', 'TH': 'th',
        'VIETNÃ': 'vn', 'VIETNA': 'vn', 'VIETNAM': 'vn', 'VN': 'vn',
        'INDONÉSIA': 'id', 'INDONESIA': 'id', 'ID': 'id',
        'MALÁSIA': 'my', 'MALASIA': 'my', 'MALAYSIA': 'my', 'MY': 'my',
        'FILIPINAS': 'ph', 'PHILIPPINES': 'ph', 'PH': 'ph',
        'SINGAPURA': 'sg', 'SINGAPORE': 'sg', 'SG': 'sg',
        'CAMBOJA': 'kh', 'CAMBODIA': 'kh', 'KH': 'kh',
        'LAOS': 'la', 'LA': 'la',
        'MIANMAR': 'mm', 'MYANMAR': 'mm', 'MM': 'mm'
    };

    const SEA_NATIONALITIES = {
        'TAILÂNDIA': 'tailandês', 'TAILANDIA': 'tailandês', 'THAILAND': 'tailandês', 'TH': 'tailandês',
        'VIETNÃ': 'vietnamita', 'VIETNA': 'vietnamita', 'VIETNAM': 'vietnamita', 'VN': 'vietnamita',
        'INDONÉSIA': 'indonésio', 'INDONESIA': 'indonésio', 'ID': 'indonésio',
        'MALÁSIA': 'malaio', 'MALASIA': 'malaio', 'MALAYSIA': 'malaio', 'MY': 'malaio',
        'FILIPINAS': 'filipino', 'PHILIPPINES': 'filipino', 'PH': 'filipino',
        'SINGAPURA': 'singapurense', 'SINGAPORE': 'singapurense', 'SG': 'singapurense',
        'CAMBOJA': 'cambojano', 'CAMBODIA': 'cambojano', 'KH': 'cambojano',
        'LAOS': 'laosiano', 'LA': 'laosiano',
        'MIANMAR': 'birmanês', 'MYANMAR': 'birmanês', 'MM': 'birmanês'
    };

    let seaProfileLoaded = false;
    let seaProfileLoading = null;
    let seaRows = [];
    let seaPhotoRows = [];
    let seaCountries = new Map();
    let seaPlayerIndex = new Map();
    let seaTeamIndex = new Map();

    function norm(value) {
        return String(value || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, ' ')
            .trim();
    }

    function seaSlug(value) {
        return String(value || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '')
            .trim();
    }

    function getSEATeamAliasesForFullName(fullName) {
        const full = String(fullName || '').trim();
        const aliases = new Set([full]);
        const normalizedFull = norm(full);

        if (typeof getSEATeamSigla === 'function') aliases.add(getSEATeamSigla(full));

        try {
            if (typeof SEA_TEAM_NAME_MAP !== 'undefined') {
                Object.entries(SEA_TEAM_NAME_MAP).forEach(([alias, mapped]) => {
                    if (norm(mapped) === normalizedFull || norm(alias) === normalizedFull) aliases.add(alias);
                });
            }
        } catch (e) {}

        try {
            if (typeof SEA_TEAM_SIGLA_MAP !== 'undefined') {
                Object.entries(SEA_TEAM_SIGLA_MAP).forEach(([alias, sigla]) => {
                    if (norm(sigla) === norm(getSEATeamSigla(full)) || norm(alias) === normalizedFull) aliases.add(alias);
                });
            }
        } catch (e) {}

        return Array.from(aliases).filter(Boolean);
    }

    function getPreferredSEATeamSlug(teamName) {
        const aliases = getSEATeamAliasesForFullName(teamName)
            .map(a => String(a || '').trim())
            .filter(Boolean)
            .sort((a, b) => {
                const aShort = a.length <= 3 ? 1 : 0;
                const bShort = b.length <= 3 ? 1 : 0;
                if (aShort !== bShort) return aShort - bShort;
                return a.length - b.length;
            });
        return seaSlug(aliases[0] || teamName);
    }

    function setSEATeamHash(teamName) {
        if (typeof history === 'undefined') return;
        const slug = getPreferredSEATeamSlug(teamName);
        if (slug) history.replaceState(null, '', '#' + slug);
    }

    function findSEATeamNameBySlug(hash) {
        const target = seaSlug(hash);
        if (!target) return '';

        for (const team of seaTeamIndex.values()) {
            const aliases = getSEATeamAliasesForFullName(team.name);
            if (aliases.some(a => seaSlug(a) === target)) return team.name;
            if (seaSlug(team.name) === target || seaSlug(team.sigla) === target) return team.name;
        }

        try {
            if (typeof SEA_TEAM_NAME_MAP !== 'undefined') {
                for (const [alias, mapped] of Object.entries(SEA_TEAM_NAME_MAP)) {
                    if (seaSlug(alias) === target || seaSlug(mapped) === target) return mapped;
                }
            }
        } catch (e) {}

        return '';
    }

    function keyPlayer(value) {
        return norm(value).replace(/\s+/g, '');
    }

    function escape(value) {
        if (typeof escapeHtml === 'function') return escapeHtml(value);
        return String(value || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    }

    function jsArg(value) {
        return JSON.stringify(String(value || ''));
    }

    function parseTsvLocal(text) {
        if (typeof parseTSV === 'function') return parseTSV(text);
        const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
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
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        return res.text();
    }

    async function fetchJsonNoCache(url) {
        const sep = String(url || '').includes('?') ? '&' : '?';
        const res = await fetch(`${url}${sep}nocache=${Date.now()}`);
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        return res.json();
    }

    function findHeader(headers, tests) {
        const list = Array.isArray(tests) ? tests : [tests];
        return (headers || []).find(h => list.some(test => norm(h).includes(test))) || null;
    }

    function cleanSeaPlayer(raw) {
        if (typeof cleanSEAPlayerName === 'function') return cleanSEAPlayerName(raw);
        const text = String(raw || '').trim();
        return text.includes('.') ? text.split('.').pop().trim() : text;
    }

    function getSeaTeamFromPlayer(raw) {
        if (typeof getSEAPlayerTeamFullName === 'function') return getSEAPlayerTeamFullName(raw);
        const tag = String(raw || '').split('.')[0] || '';
        return tag;
    }

    function getSeaTeamSigla(raw) {
        if (typeof getSEATeamSigla === 'function') return getSEATeamSigla(raw);
        return String(raw || '').split('.')[0] || raw;
    }

    function getSeaTeamFull(raw) {
        if (typeof getSEATeamFullName === 'function') return getSEATeamFullName(raw);
        return String(raw || '');
    }

    function getSeaTeamLogo(raw) {
        if (typeof resolveSEATeamLogo === 'function') return resolveSEATeamLogo(raw);
        const full = getSeaTeamFull(raw);
        const sigla = getSeaTeamSigla(raw);
        const store = (typeof logos !== 'undefined' && logos) ? logos : (window.logos || {});
        return (store[full] || store[String(full || '').toUpperCase()] || store[sigla] || store[String(sigla || '').toUpperCase()] || store[raw] || 'escudo.webp');
    }

    function parseNum(value) {
        if (typeof parseSEANumber === 'function') return parseSEANumber(value);
        return parseFloat(String(value || '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
    }

    function formatCompact(value) {
        const n = Number(value) || 0;
        if (Math.abs(n) >= 1000000) return `${Math.round(n / 100000) / 10}M`;
        if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`;
        return String(Math.round(n));
    }

    function countryCode(country) {
        return SEA_COUNTRY_CODES[norm(country)] || '';
    }

    function countryFlag(country) {
        const k = norm(country);
        return SEA_FLAG_EMOJI[k] || '🌐';
    }

    function countryFlagHtml(country) {
        const code = countryCode(country);
        if (code) {
            return `<img class="sea-country-flag" src="dados sea/flags/${code}.svg" onerror="this.onerror=null;this.replaceWith(document.createTextNode('${countryFlag(country)}'))" alt="">`;
        }
        return `<span class="sea-country-flag-emoji">${countryFlag(country)}</span>`;
    }

    function countryNationality(country) {
        return SEA_NATIONALITIES[norm(country)] || String(country || '-').toLowerCase();
    }

    function rowValue(row, names) {
        const wanted = names.map(norm);
        const key = Object.keys(row || {}).find(k => wanted.includes(norm(k)) || wanted.some(w => norm(k).includes(w)));
        return key ? row[key] : '';
    }

    function photoFromSheet(rawName, cleanName) {
        const rawKey = keyPlayer(rawName);
        const cleanKey = keyPlayer(cleanName);
        let best = null;
        for (const row of seaPhotoRows) {
            const name = rowValue(row, ['JOGADOR', 'PLAYER', 'NOME', 'NICK']);
            if (!name) continue;
            const nameKey = keyPlayer(name);
            if (nameKey !== rawKey && nameKey !== cleanKey) continue;
            const status = norm(rowValue(row, ['STATUS', 'SITUAÇÃO', 'SITUACAO', 'TIPO', 'CATEGORIA']));
            if (status.includes('ATIVO SEA')) best = row;
            else if (!best && status.includes('INATIVO SEA')) best = row;
            else if (!best) best = row;
        }
        if (!best) return '';
        return rowValue(best, ['FOTO', 'IMAGEM', 'URL', 'PHOTO', 'LINK']);
    }

    function statusFromSheet(rawName, cleanName, hasGames) {
        const rawKey = keyPlayer(rawName);
        const cleanKey = keyPlayer(cleanName);
        for (const row of seaPhotoRows) {
            const name = rowValue(row, ['JOGADOR', 'PLAYER', 'NOME', 'NICK']);
            if (!name) continue;
            const nameKey = keyPlayer(name);
            if (nameKey !== rawKey && nameKey !== cleanKey) continue;
            const status = norm(rowValue(row, ['STATUS', 'SITUAÇÃO', 'SITUACAO', 'TIPO', 'CATEGORIA']));
            if (status.includes('INATIVO SEA')) return 'inativo';
            if (status.includes('ATIVO SEA')) return 'ativo';
        }
        return hasGames ? 'ativo' : 'inativo';
    }

    function playerPosition(rawName) {
        const stats = seaPlayerIndex.get(keyPlayer(rawName));
        return stats?.funcao || '-';
    }

    function makeEmptyStats(rawName) {
        const cleanName = cleanSeaPlayer(rawName);
        const team = getSeaTeamFromPlayer(rawName);
        const country = seaCountries.get(keyPlayer(rawName)) || seaCountries.get(keyPlayer(cleanName)) || '-';
        return {
            rawName,
            cleanName,
            displayName: cleanName || rawName,
            team,
            teamSigla: getSeaTeamSigla(team || rawName),
            country,
            funcao: '-',
            kills: 0,
            dano: 0,
            assistencias: 0,
            quedas: 0,
            mvp: 0,
            stages: new Set()
        };
    }

    function addPlayerStats(rawName, row, stageTitle = '') {
        if (!rawName) return;
        const k = keyPlayer(rawName);
        const cleanName = cleanSeaPlayer(rawName);
        const country = seaCountries.get(k) || seaCountries.get(keyPlayer(cleanName)) || '-';
        const team = getSeaTeamFromPlayer(rawName) || row?.Equipe || row?.Time || '';
        const current = seaPlayerIndex.get(k) || makeEmptyStats(rawName);
        current.rawName = rawName;
        current.cleanName = cleanName;
        current.displayName = cleanName || rawName;
        current.team = getSeaTeamFull(team || rawName);
        current.teamSigla = getSeaTeamSigla(team || rawName);
        current.country = country || current.country || '-';
        current.funcao = row?.funcao || row?.Função || row?.FUNÇÃO || row?.Funcao || current.funcao || '-';
        current.kills += parseNum(row?.abates ?? row?.Abates ?? row?.KILLS ?? row?.Kills ?? row?.K ?? row?.ABATES);
        current.dano += parseNum(row?.dano ?? row?.Dano ?? row?.DAMAGE ?? row?.Damage ?? row?.DMG ?? row?.DANO);
        current.assistencias += parseNum(row?.assistencias ?? row?.Assistências ?? row?.Assistencias ?? row?.ASSISTÊNCIAS ?? row?.AST ?? row?.A);
        current.quedas += parseNum(row?.quedas ?? row?.Quedas ?? row?.Q ?? row?.MAPAS ?? row?.Maps);
        current.mvp += parseNum(row?.mvp ?? row?.MVP ?? row?.Mvp);
        if (stageTitle) current.stages.add(stageTitle);
        seaPlayerIndex.set(k, current);
    }

    function buildTeams() {
        seaTeamIndex = new Map();

        // Primeiro cria jogadores que só aparecem no TSV de países.
        seaCountries.forEach((country, playerKey) => {
            const rawName = window.__seaCountryRawNames?.get(playerKey) || '';
            if (rawName && !seaPlayerIndex.has(playerKey)) seaPlayerIndex.set(playerKey, makeEmptyStats(rawName));
        });

        seaPlayerIndex.forEach(player => {
            const team = getSeaTeamFull(player.team || player.rawName || '');
            if (!team) return;
            const teamKey = norm(team);
            if (!seaTeamIndex.has(teamKey)) {
                seaTeamIndex.set(teamKey, {
                    name: team,
                    sigla: getSeaTeamSigla(team),
                    logo: getSeaTeamLogo(team),
                    players: [],
                    kills: 0,
                    dano: 0,
                    assistencias: 0,
                    quedas: 0,
                    mvp: 0
                });
            }
            const t = seaTeamIndex.get(teamKey);
            t.players.push(player);
            t.kills += player.kills;
            t.dano += player.dano;
            t.assistencias += player.assistencias;
            t.quedas += player.quedas;
            t.mvp += player.mvp;
        });

        seaTeamIndex.forEach(team => {
            team.players.sort((a, b) => (b.quedas - a.quedas) || (b.kills - a.kills) || a.displayName.localeCompare(b.displayName));
        });
    }

    function parseSeaJson(data) {
        (data?.stages || []).forEach(stage => {
            (stage.rows || []).forEach(row => {
                addPlayerStats(row.jogador || row.Jogador || row.player || row.Player, row, stage.title || stage.key || '');
            });
        });
    }

    function parseSeaTsv(parsed) {
        const headers = parsed.headers || [];
        const hPlayer = headers.find(h => /JOGADOR|PLAYER|NICK/i.test(h)) || headers[0];
        const hRole = headers.find(h => /FUN|FUNC|ROLE|POSIÇÃO|POSICAO/i.test(h));
        const hKills = headers.find(h => /ABATE|KILL|^K$/i.test(h));
        const hDamage = headers.find(h => /DANO|DAMAGE|DMG/i.test(h));
        const hAssist = headers.find(h => /ASSIST|AST|^A$/i.test(h));
        const hGames = headers.find(h => /QUEDA|MAPA|MAPS|^Q$/i.test(h));
        const hMvp = headers.find(h => /MVP/i.test(h));
        (parsed.rows || []).forEach(row => {
            const raw = row[hPlayer];
            addPlayerStats(raw, {
                funcao: hRole ? row[hRole] : '',
                abates: hKills ? row[hKills] : 0,
                dano: hDamage ? row[hDamage] : 0,
                assistencias: hAssist ? row[hAssist] : 0,
                quedas: hGames ? row[hGames] : 0,
                mvp: hMvp ? row[hMvp] : 0
            }, 'Fase 1');
        });
    }

    async function loadSEAProfilesData() {
        if (seaProfileLoaded) return;
        if (seaProfileLoading) return seaProfileLoading;

        seaProfileLoading = (async () => {
            try {
                window.__seaCountryRawNames = new Map();
                const countriesParsed = parseTsvLocal(await fetchTextNoCache(SEA_COUNTRIES_URL));
                const playerHeader = findHeader(countriesParsed.headers, ['JOGADOR', 'PLAYER', 'NOME']) || countriesParsed.headers[0];
                const countryHeader = findHeader(countriesParsed.headers, ['PAIS', 'PAÍS', 'COUNTRY']) || countriesParsed.headers[1];
                (countriesParsed.rows || []).forEach(row => {
                    const raw = String(row[playerHeader] || '').trim();
                    const country = String(row[countryHeader] || '').trim() || '-';
                    if (!raw) return;
                    seaCountries.set(keyPlayer(raw), country);
                    seaCountries.set(keyPlayer(cleanSeaPlayer(raw)), country);
                    window.__seaCountryRawNames.set(keyPlayer(raw), raw);
                });
            } catch (err) {
                console.warn('[SEA Profiles] Países não carregados:', err);
            }

            try {
                const photosParsed = parseTsvLocal(await fetchTextNoCache(SEA_PHOTOS_URL));
                seaPhotoRows = photosParsed.rows || [];
            } catch (err) {
                console.warn('[SEA Profiles] Fotos SEA não carregadas:', err);
            }

            try {
                parseSeaJson(await fetchJsonNoCache(SEA_KILLS_JSON_URL));
            } catch (err) {
                console.warn('[SEA Profiles] JSON de abates SEA não carregado:', err);
            }

            try {
                if (SEA_KILLS_TSV_URL) parseSeaTsv(parseTsvLocal(await fetchTextNoCache(SEA_KILLS_TSV_URL)));
            } catch (err) {
                console.warn('[SEA Profiles] TSV de abates SEA não carregado:', err);
            }

            buildTeams();
            seaProfileLoaded = true;
        })();

        return seaProfileLoading;
    }

    function statCard(label, value, sub = '') {
        return `<div class="card sea-profile-stat"><div class="card-top-border"></div><h3>${escape(label)}</h3><div class="value">${escape(value)}</div>${sub ? `<div class="sea-stat-sub">${escape(sub)}</div>` : ''}</div>`;
    }

    function renderPlayerHero(player) {
        const status = statusFromSheet(player.rawName, player.cleanName, player.quedas > 0);
        const photo = photoFromSheet(player.rawName, player.cleanName) || 'silhueta.webp';
        const teamName = player.team || '-';
        return `
            <section class="sea-profile-hero">
                <div class="sea-player-photo-ring ${status === 'inativo' ? 'is-inactive' : 'is-active'}">
                    <img src="${escape(photo)}" onerror="this.onerror=null;this.src='silhueta.webp'" alt="${escape(player.displayName)}">
                </div>
                <h1>${escape(player.displayName)}</h1>
                <div class="sea-profile-country">${countryFlagHtml(player.country)} <span>${escape(player.country || '-')}</span></div>
                <div class="sea-profile-position">${escape(player.funcao || '-')}</div>
                <button class="btn-action sea-team-link" onclick="openSEATeamProfile(${escape(jsArg(teamName))})">
                    ${escape(teamName)}
                </button>
            </section>`;
    }

    function renderSeaTrophies() {
        return `<div class="sea-trophy-empty">EM BREVE</div>`;
    }

    async function openSEAPlayerProfile(name) {
        await loadSEAProfilesData();
        const key = keyPlayer(name);
        const player = seaPlayerIndex.get(key) || Array.from(seaPlayerIndex.values()).find(p => keyPlayer(p.cleanName) === key || keyPlayer(p.displayName) === key);
        if (!player) {
            alert('Jogador SEA não encontrado.');
            return;
        }

        navigate('sea-player-profile');

        const rootEl = document.getElementById('sea-player-profile-content');
        if (!rootEl) return;
        const q = player.quedas || 0;
        const avg = (n) => q ? (Number(n || 0) / q).toFixed(2) : '0.00';

        rootEl.innerHTML = `
            ${renderPlayerHero(player)}
            <section class="sea-profile-section">
                <h2>Resumo histórico</h2>
                <p><strong>${escape(player.displayName)}</strong> é um jogador ${escape(countryNationality(player.country))} que atua atualmente pela equipe <strong>${escape(player.team || '-')}</strong>.</p>
            </section>
            <section class="sea-profile-section">
                <h2>Desempenho atual</h2>
                <div class="grid-cards sea-profile-grid">
                    ${statCard('Kills', player.kills)}
                    ${statCard('Dano', formatCompact(player.dano))}
                    ${statCard('Assistências', player.assistencias)}
                    ${statCard('Quedas', player.quedas)}
                    ${statCard('MVP', player.mvp)}
                </div>
            </section>
            <section class="sea-profile-section">
                <h2>Desempenho atual (média)</h2>
                <div class="grid-cards sea-profile-grid">
                    ${statCard('Kills', avg(player.kills), 'por queda')}
                    ${statCard('Dano', formatCompact(player.dano / (q || 1)), 'por queda')}
                    ${statCard('Assistências', avg(player.assistencias), 'por queda')}
                    ${statCard('Quedas', q ? '1.00' : '0.00', 'por partida registrada')}
                    ${statCard('MVP', avg(player.mvp), 'por queda')}
                </div>
            </section>
            <section class="sea-profile-section sea-trophies-section">
                <h2>Galeria de Troféus</h2>
                ${renderSeaTrophies()}
            </section>`;
    }

    function renderSeaTeamPlayers(team) {
        const active = team.players.filter(p => statusFromSheet(p.rawName, p.cleanName, p.quedas > 0) === 'ativo');
        const inactive = team.players.filter(p => statusFromSheet(p.rawName, p.cleanName, p.quedas > 0) !== 'ativo');
        const renderList = (players, empty) => players.length ? players.map(p => {
            const photo = photoFromSheet(p.rawName, p.cleanName) || 'silhueta.webp';
            return `
                <button class="sea-roster-card" onclick="openSEAPlayerProfile(${escape(jsArg(p.rawName))})">
                    <img src="${escape(photo)}" onerror="this.onerror=null;this.src='silhueta.webp'" alt="${escape(p.displayName)}">
                    <span>${escape(p.displayName)}</span>
                    <small>${countryFlagHtml(p.country)} ${escape(p.funcao || '-')}</small>
                </button>`;
        }).join('') : `<div class="sea-empty-small">${escape(empty)}</div>`;

        return `
            <div class="sea-roster-block">
                <h3>ATIVOS</h3>
                <div class="sea-roster-grid">${renderList(active, 'Nenhum jogador ativo registrado.')}</div>
            </div>
            <div class="sea-roster-block">
                <h3>INATIVOS</h3>
                <div class="sea-roster-grid">${renderList(inactive, 'Nenhum jogador inativo registrado.')}</div>
            </div>`;
    }

    async function openSEATeamProfile(name) {
        if (typeof loadTeamLogos === 'function' && !window.__cffTeamLogosLoaded) {
            try { await loadTeamLogos(); } catch (e) { console.warn('[SEA Profiles] Falha ao recarregar logos:', e); }
        }
        await loadSEAProfilesData();
        const full = getSeaTeamFull(name);
        const teamKey = norm(full);
        const team = seaTeamIndex.get(teamKey) || seaTeamIndex.get(norm(name)) || Array.from(seaTeamIndex.values()).find(t => norm(t.sigla) === norm(name));
        if (!team) {
            alert('Equipe SEA não encontrada.');
            return;
        }

        setSEATeamHash(team.name);
        navigate('sea-team-profile');

        const rootEl = document.getElementById('sea-team-profile-content');
        if (!rootEl) return;
        team.logo = getSeaTeamLogo(team.name || name);
        const q = team.quedas || 0;
        const avg = (n) => q ? (Number(n || 0) / q).toFixed(2) : '0.00';

        rootEl.innerHTML = `
            <section class="sea-team-profile-hero">
                <img src="${escape(team.logo || 'escudo.webp')}" onerror="this.onerror=null;this.src='escudo.webp'" alt="${escape(team.name)}">
                <h1>${escape(team.name)}</h1>
                <div class="sea-profile-position">FFWS SEA 2026 S1</div>
                <button class="btn-action sea-team-link" type="button" onclick="navigate('ffws-sea-2026-s1')">Ir para a página da FFWS SEA</button>
            </section>
            <section class="sea-profile-section">
                <h2>Equipe</h2>
                <p><strong>${escape(team.name)}</strong> disputa a FFWS SEA 2026 S1. No desempenho atual, soma <strong>${escape(team.kills)}</strong> kills, <strong>${escape(formatCompact(team.dano))}</strong> de dano, <strong>${escape(team.assistencias)}</strong> assistências e <strong>${escape(team.mvp)}</strong> MVP.</p>
            </section>
            <section class="sea-profile-section">
                <h2>Jogadores</h2>
                ${renderSeaTeamPlayers(team)}
            </section>
            <section class="sea-profile-section">
                <h2>Desempenho atual</h2>
                <div class="grid-cards sea-profile-grid">
                    ${statCard('Kills', team.kills)}
                    ${statCard('Dano', formatCompact(team.dano))}
                    ${statCard('Assistências', team.assistencias)}
                    ${statCard('Quedas', team.quedas)}
                    ${statCard('MVP', team.mvp)}
                </div>
            </section>
            <section class="sea-profile-section">
                <h2>Desempenho atual (média)</h2>
                <div class="grid-cards sea-profile-grid">
                    ${statCard('Kills', avg(team.kills), 'por queda de jogador')}
                    ${statCard('Dano', formatCompact(team.dano / (q || 1)), 'por queda de jogador')}
                    ${statCard('Assistências', avg(team.assistencias), 'por queda de jogador')}
                    ${statCard('Quedas', q ? '1.00' : '0.00', 'por registro')}
                    ${statCard('MVP', avg(team.mvp), 'por queda de jogador')}
                </div>
            </section>
            <section class="sea-profile-section sea-trophies-section">
                <h2>Galeria de Troféus</h2>
                ${renderSeaTrophies()}
            </section>`;
    }

    function patchSearchPools() {
        if (window.__seaProfilesSearchPatched) return;
        window.__seaProfilesSearchPatched = true;

        const originalPeoplePool = window.navBuildPeopleSearchPool;
        window.navBuildPeopleSearchPool = function () {
            const base = typeof originalPeoplePool === 'function' ? originalPeoplePool() : [];
            const seaPeople = Array.from(seaPlayerIndex.values()).map(p => ({
                type: 'sea-player',
                name: p.cleanName || p.displayName || p.rawName,
                originalName: p.cleanName,
                title: p.displayName,
                sub: `${p.team || '-'} • FFWS SEA`,
                img: photoFromSheet(p.rawName, p.cleanName) || 'silhueta.webp',
                priority: 4,
                haystack: `${p.rawName} ${p.cleanName} ${p.team} ${p.country} jogador sea ffws sea`.toLowerCase()
            }));
            return base.concat(seaPeople);
        };

        const originalTeamPool = window.navBuildTeamSearchPool;
        window.navBuildTeamSearchPool = function () {
            const base = typeof originalTeamPool === 'function' ? originalTeamPool() : [];
            const seaTeams = Array.from(seaTeamIndex.values()).map(t => ({
                type: 'sea-team',
                name: t.name,
                title: t.name,
                sub: 'Equipe FFWS SEA',
                img: getSeaTeamLogo(t.name) || t.logo || 'escudo.webp',
                priority: 4,
                haystack: `${t.name} ${t.sigla} equipe time ffws sea`.toLowerCase()
            }));
            return base.concat(seaTeams);
        };

        const originalSelect = window.selectSearchResult;
        window.selectSearchResult = function (type, name) {
            if (type === 'sea-player') {
                if (typeof window.navCloseSearchUI === 'function') window.navCloseSearchUI();
                return openSEAPlayerProfile(name);
            }
            if (type === 'sea-team') {
                if (typeof window.navCloseSearchUI === 'function') window.navCloseSearchUI();
                return openSEATeamProfile(name);
            }
            return typeof originalSelect === 'function' ? originalSelect(type, name) : null;
        };
    }

    window.loadSEAProfilesData = loadSEAProfilesData;
    window.openSEAPlayerProfile = openSEAPlayerProfile;
    window.openSEATeamProfile = openSEATeamProfile;
    window.getSEAProfilePlayers = () => Array.from(seaPlayerIndex.values());
    window.getSEAProfileTeams = () => Array.from(seaTeamIndex.values());
    window.cffResolveSEAHashRoute = function(hash) {
        const clean = String(hash || '').replace(/^#/, '').trim();
        const directTeam = findSEATeamNameBySlug(clean);
        if (directTeam) {
            loadSEAProfilesData()
                .then(() => openSEATeamProfile(directTeam))
                .catch(err => console.warn('[SEA Profiles] Falha ao abrir hash SEA:', err));
            return true;
        }
        return false;
    };

    document.addEventListener('DOMContentLoaded', () => {
        loadSEAProfilesData()
            .then(() => {
                patchSearchPools();
                const hash = window.location.hash.replace('#', '').trim();
                if (hash && typeof window.cffResolveHashRoute === 'function') window.cffResolveHashRoute(hash);
            })
            .catch(err => console.warn('[SEA Profiles] Falha geral:', err));
    });
})();