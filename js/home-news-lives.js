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
        const response = await fetch('resultados.json');
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

async function loadTeamLogos() {
    // Substitua o GID pelo da aba onde estão as logos (Ex: Equipe na Coluna A, Link na Coluna B)
    const LOGOS_TSV_URL = window.CFF_CONFIG.sheets.logosEquipes;

    try {
        const res = await fetch(`${LOGOS_TSV_URL}&nocache=${new Date().getTime()}`);
        const tsvText = await res.text();
        const lines = tsvText.split('\n');

        lines.slice(1).forEach(line => {
            const data = line.split('\t');
            const nomeEquipe = data[0]?.trim();
            const urlLogo = data[1]?.trim().replace(/\r/g, "");

            if (nomeEquipe && urlLogo) {
                // Se o time já existe no objeto, ele substitui o nome do arquivo pelo link da planilha
                // Se não existe, ele cria um novo. Também cria chaves normalizadas para bater com FFWS SEA.
                logos[nomeEquipe] = urlLogo;
                logos[nomeEquipe.toUpperCase().trim()] = urlLogo;
                if (typeof normalizeSEAKey === 'function') {
                    logos[normalizeSEAKey(nomeEquipe)] = urlLogo;
                }
            }
        });
        console.log("Logos atualizadas via Sheets!");

        // Após carregar as logos, precisamos atualizar as tabelas da Home para as imagens aparecerem
        renderHomeStats();
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
        const logoSrc = logos[nome] || 'escudo.webp';
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
    await loadResults(); // <--- Carrega o arquivo ao clicar na equipe
    currentOutraEquipe = nome;
    document.getElementById('oep-name').innerText = nome;
    document.getElementById('oep-logo').src = logos[nome] || 'escudo.webp';

    // Reseta filtros
    const yearEl = document.getElementById('oep-filter-year');
    const tierEl = document.getElementById('oep-filter-tier');
    if (yearEl) yearEl.value = 'all';
    if (tierEl) tierEl.value = 'all';

    // Títulos coletivos
    const titulos = (titlesData.coletivos || []).filter(t => t.team.toUpperCase() === nome.toUpperCase());
    const titulosSection = document.getElementById('oep-titulos-section');
    const titulosContainer = document.getElementById('oep-titulos-container');
    if (titulos.length > 0) {
        titulosSection.style.display = 'block';
        titulosContainer.innerHTML = titulos.map(t => {
            let tournamentImg = resolveLeagueLogo(t.event);
            const hasTournamentPage = !!findTournamentInDB(t.event);
            const clickAttr = hasTournamentPage ? `onclick="navigateToTournament('${t.event.replace(/'/g, "\\'")}')" style="cursor:pointer;" title="Ver página do torneio"` : '';
            const linkIcon = hasTournamentPage ? `<div style="font-size:0.55em; color:var(--accent); margin-top:3px;">🔗 Ver Torneio</div>` : '';
            return `<div class="trophy-card border-campeao" ${clickAttr}>
                <img src="${tournamentImg}" class="trophy-img" onerror="this.src='trofeu.webp'">
                <div style="font-weight:bold; font-size:0.75em; color:#fff; text-align:center;">${t.event}</div>
                <div style="color:var(--accent); font-size:0.65em; font-weight:bold; text-align:center;">${t.type}</div>
                ${linkIcon}
                <div class="trophy-team">
                    <img src="${logos[t.team] || 'escudo.webp'}" style="width:14px; height:14px; object-fit:contain;" onerror="this.src='escudo.webp'">
                    ${t.team}
                </div>
            </div>`;
        }).join('');
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

    let results = (dbResults[nome] || []).slice();

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
        const hasTournamentPage = !!findTournamentInDB(r.torneio);
        const torneioCell = hasTournamentPage
            ? `<span onclick="navigateToTournament('${r.torneio.replace(/'/g, "\\'")}')" style="cursor:pointer; color: var(--accent); text-decoration: underline; text-decoration-style: dotted;" title="Ver página do torneio">${r.torneio} 🔗</span>`
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
    if (!eventName || !dbCampeonatos || dbCampeonatos.length === 0) return null;
    const upper = eventName.toUpperCase().trim();
    return dbCampeonatos.find(t => {
        const tUpper = t.torneio.toUpperCase().trim();
        return tUpper === upper || tUpper.includes(upper) || upper.includes(tUpper);
    }) || null;
}

function navigateToTournament(eventName) {
    const t = findTournamentInDB(eventName);
    if (!t) return;
    // Fecha modal de resultados se estiver aberto
    const modal = document.getElementById('results-modal');
    if (modal && modal.classList.contains('active')) {
        modal.classList.remove('active');
    }
    navigate('outros-torneios');
    renderOutrosTorneiosList();
    // Pequeno delay para garantir que a tela carregou antes de abrir o torneio
    setTimeout(() => openOtherTournament(t.id), 80);
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

    } catch (e) {
        console.error('[loadPhotos] Erro ao carregar fotos:', e);
    }
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

function ensureHomeConfrontationSummaryButton() {
    // Evita criar dois botões na Home.
    // Prioridade: reaproveitar qualquer botão antigo já existente no HTML.
    const oldInlineButtons = Array.from(document.querySelectorAll('button, a')).filter(el => {
        const txt = (el.textContent || '').trim().toLowerCase();
        const onclick = el.getAttribute('onclick') || '';
        return txt.includes('resumo do confronto') || onclick.includes('openHomeConfrontoResumoModal') || onclick.includes('openHomeConfrontationSummary');
    });

    // Remove o botão pequeno que versões antigas inseriam logo abaixo dos grupos.
    const injectedBtn = document.getElementById('btn-home-confrontation-summary');
    if (injectedBtn && oldInlineButtons.length > 1) {
        injectedBtn.remove();
    }

    const existing = oldInlineButtons.find(el => el.id !== 'btn-home-confrontation-summary') || document.getElementById('home-confrontation-main-btn');
    if (existing) {
        existing.id = 'home-confrontation-main-btn';
        existing.classList.add('home-confrontation-summary-btn');
        existing.removeAttribute('onclick');
        existing.onclick = openHomeConfrontationSummary;
        existing.innerHTML = '📊 VER RESUMO DO CONFRONTO';
        return;
    }

    // Se não existir botão nenhum no HTML, cria apenas UM botão no lugar correto: abaixo do botão de live.
    const liveBtn = document.getElementById('home-live-btn');
    const groupsEl = document.getElementById('home-next-groups');
    const anchor = liveBtn || groupsEl;
    if (!anchor || document.getElementById('home-confrontation-main-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'home-confrontation-main-btn';
    btn.type = 'button';
    btn.className = 'home-confrontation-summary-btn';
    btn.innerHTML = '📊 VER RESUMO DO CONFRONTO';
    btn.onclick = openHomeConfrontationSummary;
    anchor.insertAdjacentElement('afterend', btn);
}

function openHomeConfrontationSummary() {
    ensureHomeConfrontationSummaryModal();

    const modal = document.getElementById('home-confrontation-modal');
    const title = document.getElementById('home-confrontation-title');
    const body = document.getElementById('home-confrontation-body');
    const match = getNextHomeConfrontationMatch();
    const teams = getHomeConfrontationTeams(match);
    const teamNames = teams.map(t => t.equipe);

    if (!match || !teamNames.length) {
        title.textContent = 'Resumo do confronto';
        body.innerHTML = '<div class="home-confrontation-empty">Não foi possível encontrar o próximo confronto.</div>';
        modal.classList.add('active');
        return;
    }

    const groupsText = match.grupos.join(' x ');
    const confrontationDays = getHomeConfrontationDays(match.grupos);
    const teamStats = getHomeConfrontationTeamStats(teamNames, match.grupos).slice(0, 5);
    const playerStats = getHomeConfrontationPlayerStats(teamNames, match.grupos).slice(0, 5);
    const analysis = buildHomeConfrontationText(teamStats, playerStats, groupsText, confrontationDays);

    title.textContent = `Resumo do confronto — Grupos ${groupsText}`;

    const playerRows = playerStats.map((p, index) => `
        <tr>
            <td>${index + 1}º</td>
            <td class="home-summary-name">${cffHomeEscapeHTML(p.jogador)}<small>${cffHomeEscapeHTML(p.equipe)}</small></td>
            <td>${p.quedas}</td>
            <td>${p.abates}</td>
            <td>${formatHomeCompactNumber(p.dano)}</td>
        </tr>`).join('');

    const teamRows = teamStats.map((t, index) => `
        <tr>
            <td>${index + 1}º</td>
            <td class="home-summary-team-cell">
                <img src="${cffHomeEscapeHTML((typeof logos !== 'undefined' && logos[t.equipe]) ? logos[t.equipe] : 'escudo.webp')}" onerror="this.onerror=null;this.src='escudo.webp'" alt="${cffHomeEscapeHTML(t.equipe)}">
                <span>${cffHomeEscapeHTML(typeof shortNames !== 'undefined' && shortNames[t.equipe] ? shortNames[t.equipe] : t.equipe)}</span>
            </td>
            <td>${t.quedas}</td>
            <td>${t.pontos}</td>
            <td>${t.abates}</td>
            <td>${t.booyah}</td>
        </tr>`).join('');

    body.innerHTML = `
        <div class="home-confrontation-subtitle">${cffHomeEscapeHTML(match.data)} • Grupos ${cffHomeEscapeHTML(groupsText)} • ${confrontationDays.length} dia(s) usado(s) no recorte</div>
        <div class="home-confrontation-analysis">${cffHomeEscapeHTML(analysis)}</div>
        <div class="home-confrontation-grid">
            <div class="home-confrontation-block">
                <h3>🔥 5 melhores jogadores</h3>
                <div class="table-container home-summary-table-wrap">
                    <table class="home-summary-table">
                        <thead><tr><th>#</th><th data-short="J">Jogador</th><th data-short="Q">Quedas</th><th data-short="K">Abates</th><th data-short="D">Dano</th></tr></thead>
                        <tbody>${playerRows || '<tr><td colspan="5">Sem dados.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
            <div class="home-confrontation-block">
                <h3>🏆 5 melhores times</h3>
                <div class="table-container home-summary-table-wrap">
                    <table class="home-summary-table">
                        <thead><tr><th>#</th><th data-short="E">Time</th><th data-short="Q">Quedas</th><th data-short="PTS">PTS</th><th data-short="K">Abates</th><th data-short="B">Booyah</th></tr></thead>
                        <tbody>${teamRows || '<tr><td colspan="6">Sem dados.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        </div>`;

    modal.classList.add('active');
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

// Também tenta de novo depois, porque a Home monta partes via JS.
setTimeout(function () {
    if (typeof ensureHomeConfrontationSummaryButton === 'function') {
        ensureHomeConfrontationSummaryButton();
    }
}, 1200);
