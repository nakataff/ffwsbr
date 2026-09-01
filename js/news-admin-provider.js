(function () {
  'use strict';

  const FALLBACK_IMAGE = 'central free fire.webp';
  const LOCAL_NEWS_URL = 'noticias-painel.json?v=20260806-admin-v2';
  const CACHE_KEY = 'cff_news_cache_admin_v1';
  const CACHE_MAX_AGE = 6 * 60 * 60 * 1000;

  function config() {
    return window.CFF_CONFIG || {};
  }

  function databaseBase() {
    return String(config().firebase && config().firebase.databaseURL || '').replace(/\/$/, '');
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char];
    });
  }

  function slugify(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function parseTSV(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    const src = String(text || '').replace(/^\uFEFF/, '');
    for (let i = 0; i < src.length; i++) {
      const char = src[i];
      const next = src[i + 1];
      if (char === '"') {
        if (quoted && next === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (char === '\t' && !quoted) {
        row.push(cell.trim()); cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') i++;
        row.push(cell.trim());
        if (row.some(function (item) { return String(item).trim() !== ''; })) rows.push(row);
        row = []; cell = '';
      } else {
        cell += char;
      }
    }
    row.push(cell.trim());
    if (row.some(function (item) { return String(item).trim() !== ''; })) rows.push(row);
    return rows;
  }

  function normalizeHeader(value) {
    return String(value || '').trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, '_');
  }

  function driveImage(url) {
    let value = String(url || '').trim().replace(/\r/g, '');
    if (!value) return '';
    if (value.indexOf('drive.google.com') !== -1) {
      const match = value.match(/\/d\/([a-zA-Z0-9_-]+)/) || value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) return 'https://drive.google.com/uc?export=view&id=' + match[1];
    }
    return value;
  }

  function firstField(item, keys) {
    for (const key of keys) {
      const normalized = normalizeHeader(key);
      if (item[normalized] != null && String(item[normalized]).trim()) return String(item[normalized]).trim();
    }
    return '';
  }

  function parseSheetNews(text) {
    const rows = parseTSV(text);
    if (!rows.length) return [];
    const headers = rows[0].map(normalizeHeader);
    const hasHeaders = headers.includes('titulo') || headers.includes('conteudo') || headers.includes('resumo') || headers.includes('link_original');
    return rows.slice(1).map(function (cols, index) {
      const raw = {};
      if (hasHeaders) headers.forEach(function (header, i) { raw[header] = cols[i] || ''; });
      else Object.assign(raw, { imagem: cols[0] || '', titulo: cols[1] || '', link_original: cols[2] || '', destaque: cols[3] || '', conteudo: cols[4] || '' });
      const titulo = firstField(raw, ['titulo', 'title', 'manchete']);
      const id = firstField(raw, ['id', 'slug']) || slugify(titulo || ('noticia-' + (index + 1)));
      return normalizeNews({
        id: id,
        titulo: titulo,
        imagem: driveImage(firstField(raw, ['imagem', 'image', 'foto', 'capa', 'thumb'])),
        resumo: firstField(raw, ['resumo', 'subtitulo', 'descricao', 'description']),
        conteudo: firstField(raw, ['conteudo', 'texto', 'materia', 'matéria', 'noticia', 'notícia', 'body', 'article']),
        data: firstField(raw, ['data', 'date', 'publicado_em']),
        autor: firstField(raw, ['autor', 'author', 'fonte']),
        link_original: firstField(raw, ['link_original', 'link', 'url', 'instagram']),
        destaque: firstField(raw, ['destaque', 'featured']),
        source: 'sheet',
        status: 'published'
      });
    }).filter(function (item) { return item.titulo && item.id; });
  }

  function prepareContentAndImage(content, currentImage) {
    let src = String(content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    let image = driveImage(currentImage || '');
    let handled = false;
    src = src.replace(/\[IMG\s*:\s*([^\]]+)\]/i, function (full, payload) {
      const url = String(payload || '').split('|')[0].trim();
      if (!image) image = driveImage(url);
      handled = true;
      return '\n';
    });
    src = src.replace(/\[(?:P|PARAGRAFO|PARÁGRAFO|BR)\]/gi, '\n');
    src = src.split('\n').map(function (line) { return line.replace(/[ \t]+/g, ' ').trim(); }).filter(Boolean).join('\n');
    return { content: src, image: image, extractedImage: handled };
  }

  function parseLocalNews(data) {
    const list = Array.isArray(data) ? data : Object.values(data || {});
    return list.map(function (item) {
      return normalizeNews(Object.assign({ source: 'local', status: 'published' }, item || {}));
    }).filter(function (item) { return item.titulo && item.id; });
  }

  function booleanValue(value) {
    if (typeof value === 'boolean') return value;
    return ['true', 'sim', 's', '1', 'yes', 'destaque'].includes(String(value || '').trim().toLowerCase());
  }

  function normalizeNews(raw) {
    const titulo = String(raw && raw.titulo || '').trim();
    const id = String(raw && (raw.id || raw.slug) || '').trim() || slugify(titulo);
    const prepared = prepareContentAndImage(raw && raw.conteudo || '', raw && raw.imagem || '');
    return {
      id: id,
      titulo: titulo,
      imagem: prepared.image,
      resumo: String(raw && raw.resumo || '').trim(),
      conteudo: prepared.content,
      data: String(raw && raw.data || '').trim(),
      autor: String(raw && raw.autor || '').trim(),
      link_original: String(raw && (raw.link_original || raw.linkOriginal || raw.link) || '').trim(),
      linkOriginal: String(raw && (raw.link_original || raw.linkOriginal || raw.link) || '').trim(),
      destaque: booleanValue(raw && raw.destaque),
      status: String(raw && raw.status || 'published'),
      createdAt: Number(raw && raw.createdAt || 0),
      updatedAt: Number(raw && raw.updatedAt || 0),
      source: String(raw && raw.source || 'admin'),
      urlInterna: 'noticia.html?id=' + encodeURIComponent(id)
    };
  }

  function objectValues(data) {
    return Object.keys(data || {}).map(function (key) {
      return normalizeNews(Object.assign({ id: key, source: 'admin' }, data[key] || {}));
    }).filter(function (item) { return item.status === 'published' && item.titulo && item.id; });
  }

  function parseNewsTimestamp(value) {
    const text = String(value || '').trim();
    if (!text) return 0;

    let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      const hour = Number(match[4] || 0);
      const minute = Number(match[5] || 0);
      const second = Number(match[6] || 0);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return Date.UTC(year, month - 1, day, hour, minute, second);
      }
    }

    match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const hour = Number(match[4] || 0);
      const minute = Number(match[5] || 0);
      const second = Number(match[6] || 0);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return Date.UTC(year, month - 1, day, hour, minute, second);
      }
    }

    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function newsSortTime(item) {
    return Math.max(
      Number(item && item.updatedAt || 0),
      Number(item && item.createdAt || 0),
      parseNewsTimestamp(item && item.data)
    );
  }

  function mergeNews(localNews, sheetNews, adminNews, hiddenNews) {
    const map = new Map();
    const sheetById = new Map();
    localNews.forEach(function (item) { map.set(item.id, item); });
    sheetNews.forEach(function (item) { map.set(item.id, item); sheetById.set(item.id, item); });
    adminNews.forEach(function (item) {
      const sheetItem = sheetById.get(item.id);
      if (sheetItem) {
        map.set(item.id, Object.assign({}, sheetItem, item, {
          destaque: sheetItem.destaque,
          data: sheetItem.data || item.data
        }));
      } else {
        map.set(item.id, item);
      }
    });
    Object.keys(hiddenNews || {}).forEach(function (id) { if (hiddenNews[id]) map.delete(id); });
    return Array.from(map.values()).sort(function (a, b) {
      return newsSortTime(b) - newsSortTime(a);
    });
  }

  async function getJSON(url) {
    const response = await fetch(url, { cache: 'default' });
    if (!response.ok) throw new Error('Falha ao carregar ' + url);
    return response.json();
  }

  async function getText(url) {
    const response = await fetch(url, { cache: 'default' });
    if (!response.ok) throw new Error('Falha ao carregar ' + url);
    return response.text();
  }

  function loadCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!parsed || !Array.isArray(parsed.items) || Date.now() - Number(parsed.savedAt || 0) > CACHE_MAX_AGE) return [];
      return parsed.items.map(normalizeNews).filter(function (item) { return item.titulo && item.id; });
    } catch (_) {
      return [];
    }
  }

  function saveCache(items) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items: items.slice(0, 100) }));
    } catch (_) {}
  }

  function formatCount(value) {
    const number = Math.max(0, Number(value || 0));
    return number >= 1000000 ? (number / 1000000).toFixed(number >= 10000000 ? 0 : 1).replace('.0', '') + ' mi' :
      number >= 1000 ? (number / 1000).toFixed(number >= 10000 ? 0 : 1).replace('.0', '') + ' mil' : String(number);
  }

  function metricsFor(metrics, id) {
    const item = metrics && metrics[id] || {};
    return { views: Number(item.views || 0), likes: Number(item.likes || 0) };
  }

  function warmHeroImages(items) {
    const count = window.matchMedia && window.matchMedia('(min-width: 901px)').matches ? 3 : 1;
    items.slice(0, count).forEach(function (item) {
      const url = String(item && item.imagem || FALLBACK_IMAGE).trim();
      if (!url || url === FALLBACK_IMAGE) return;
      try {
        const parsed = new URL(url, location.href);
        if (parsed.origin !== location.origin && !document.querySelector('link[data-cff-news-origin="' + parsed.origin.replace(/"/g, '') + '"]')) {
          const preconnect = document.createElement('link');
          preconnect.rel = 'preconnect';
          preconnect.href = parsed.origin;
          preconnect.dataset.cffNewsOrigin = parsed.origin;
          document.head.appendChild(preconnect);
        }
      } catch (_) {}
      if (!Array.from(document.querySelectorAll('link[rel="preload"][as="image"]')).some(function (link) { return link.href === url; })) {
        const preload = document.createElement('link');
        preload.rel = 'preload';
        preload.as = 'image';
        preload.href = url;
        preload.setAttribute('fetchpriority', 'high');
        document.head.appendChild(preload);
      }
    });
  }

  function render(items, metrics) {
    const hero = document.getElementById('news-hero-container');
    const grid = document.getElementById('ultimas-noticias-grid');
    const title = document.getElementById('ultimas-noticias-titulo');
    if (!hero || !items.length) return false;

    /* A notícia mais recente sempre lidera. As duas seguintes priorizam
       o que estiver marcado como destaque; se faltar alguma, completa com
       as notícias mais recentes restantes. */
    const slides = [];
    const seen = new Set();
    if (items[0]) {
      slides.push(items[0]);
      seen.add(items[0].id);
    }
    items.filter(function (item) { return item.destaque && !seen.has(item.id); }).concat(items).forEach(function (item) {
      if (slides.length >= 3 || seen.has(item.id)) return;
      slides.push(item); seen.add(item.id);
    });
    warmHeroImages(slides);

    function heroCard(item, variant, index) {
      const metric = metricsFor(metrics, item.id);
      const isMain = variant === 'main';
      return '<a class="news-feature-card news-feature-' + variant + '" href="' + escapeHTML(item.urlInterna) + '" title="' + escapeHTML(item.titulo) + '">' +
        '<img src="' + escapeHTML(item.imagem || FALLBACK_IMAGE) + '" alt="' + escapeHTML(item.titulo) + '" loading="eager" decoding="async" fetchpriority="high" onerror="this.src=\'' + FALLBACK_IMAGE + '\'">' +
        '<div class="news-feature-overlay"><h2 class="news-feature-title">' + escapeHTML(item.titulo) + '</h2>' +
        (isMain && item.resumo ? '<p>' + escapeHTML(item.resumo) + '</p>' : '') +
        '<div class="news-feature-metrics"><span>👁 ' + formatCount(metric.views) + '</span><span>❤ ' + formatCount(metric.likes) + '</span></div></div></a>';
    }

    const desktopMain = slides[0] ? heroCard(slides[0], 'main', 0) : '';
    const desktopSide = slides.slice(1, 3).map(function (item, index) { return heroCard(item, 'side', index + 1); }).join('');
    const recentTextItems = items.filter(function (item) { return !seen.has(item.id); }).slice(0, 5);
    const desktopRecent = recentTextItems.length ? '<aside class="news-recent-text-panel" aria-label="Notícias recentes">' +
      '<div class="news-recent-text-head"><span>ÚLTIMAS</span><strong>Notícias recentes</strong></div>' +
      '<div class="news-recent-text-list">' + recentTextItems.map(function (item, index) {
        const metric = metricsFor(metrics, item.id);
        return '<a class="news-recent-text-item" href="' + escapeHTML(item.urlInterna) + '" title="' + escapeHTML(item.titulo) + '">' +
          '<span class="news-recent-text-index">' + String(index + 1).padStart(2, '0') + '</span>' +
          '<span class="news-recent-text-copy"><strong>' + escapeHTML(item.titulo) + '</strong>' +
          '<small>👁 ' + formatCount(metric.views) + ' &nbsp; ❤ ' + formatCount(metric.likes) + '</small></span></a>';
      }).join('') + '</div></aside>' : '';
    const mobileSlides = slides.map(function (item, index) {
      const metric = metricsFor(metrics, item.id);
      return '<a class="news-hero-slide ' + (index === 0 ? 'active' : '') + '" href="' + escapeHTML(item.urlInterna) + '">' +
        '<img src="' + escapeHTML(item.imagem || FALLBACK_IMAGE) + '" alt="' + escapeHTML(item.titulo) + '" decoding="async" ' + (index === 0 ? 'fetchpriority="high"' : 'loading="lazy"') + ' onerror="this.src=\'' + FALLBACK_IMAGE + '\'">' +
        '<div class="news-hero-overlay"><h2 class="news-hero-title">' + escapeHTML(item.titulo) + '</h2>' +
        (item.resumo ? '<p style="margin:8px 0 0;color:#d7ecff;font-weight:600;max-width:760px">' + escapeHTML(item.resumo) + '</p>' : '') +
        '<div style="display:flex;gap:12px;margin-top:12px;color:#cfe9ff;font-size:.82rem;font-weight:900"><span>👁 ' + formatCount(metric.views) + '</span><span>❤ ' + formatCount(metric.likes) + '</span></div></div></a>';
    }).join('');

    hero.innerHTML = '<section class="news-feature-desktop news-feature-count-' + slides.length + (desktopRecent ? ' news-feature-with-recent' : ' news-feature-no-recent') + '" aria-label="Notícias principais">' +
      '<div class="news-feature-main-wrap">' + desktopMain + '</div>' +
      (desktopSide ? '<div class="news-feature-side-stack">' + desktopSide + '</div>' : '') +
      desktopRecent +
      '</section>' +
      '<section class="news-hero-carousel news-feature-mobile" id="news-hero-carousel" aria-label="Notícias principais">' +
      '<div class="news-hero-track">' + mobileSlides + '</div>' +
      (slides.length > 1 ? '<button class="news-hero-nav news-hero-prev" type="button" aria-label="Notícia anterior">‹</button><button class="news-hero-nav news-hero-next" type="button" aria-label="Próxima notícia">›</button><div class="news-hero-dots">' + slides.map(function (_, index) { return '<button class="news-hero-dot ' + (index === 0 ? 'active' : '') + '" type="button" aria-label="Ir para notícia ' + (index + 1) + '"></button>'; }).join('') + '</div>' : '') +
      '</section>';

    if (grid) {
      const latestItems = items.filter(function (item) { return !seen.has(item.id); });
      const actions = document.getElementById('ultimas-noticias-actions');
      const moreButton = document.getElementById('ultimas-noticias-carregar-mais');
      let visibleCount = 3;

      grid.style.display = 'grid';
      grid.style.removeProperty('grid-template-columns');
      grid.style.removeProperty('gap');

      function renderLatestNews() {
        const visibleItems = latestItems.slice(0, visibleCount);
        if (title) title.style.display = latestItems.length ? 'block' : 'none';
        grid.style.display = latestItems.length ? 'grid' : 'none';
        grid.innerHTML = visibleItems.map(function (item) {
          const metric = metricsFor(metrics, item.id);
          return '<a class="old-news-card" href="' + escapeHTML(item.urlInterna) + '" style="display:flex;flex-direction:column;height:100%;text-decoration:none;color:inherit">' +
            '<div style="width:100%;height:160px;overflow:hidden;border-bottom:1px solid var(--border)"><img src="' + escapeHTML(item.imagem || FALLBACK_IMAGE) + '" alt="' + escapeHTML(item.titulo) + '" loading="lazy" decoding="async" onerror="this.src=\'' + FALLBACK_IMAGE + '\'" style="width:100%;height:100%;object-fit:cover"></div>' +
            '<div class="old-news-title" style="padding:12px 12px 8px;font-size:.95em;flex-grow:1">' + escapeHTML(item.titulo) + '</div>' +
            '<div style="display:flex;gap:12px;padding:0 12px 12px;color:var(--text-muted);font-size:.78rem;font-weight:900"><span>👁 ' + formatCount(metric.views) + '</span><span>❤ ' + formatCount(metric.likes) + '</span></div></a>';
        }).join('');

        const hasMore = visibleCount < latestItems.length;
        if (actions) actions.style.display = hasMore ? 'flex' : 'none';
        if (moreButton) {
          moreButton.hidden = !hasMore;
          moreButton.textContent = hasMore ? 'Carregar mais notícias ↓' : '';
        }
      }

      if (moreButton) {
        moreButton.onclick = function () {
          visibleCount = Math.min(visibleCount + 3, latestItems.length);
          renderLatestNews();
        };
      }
      renderLatestNews();
    }

    bindCarousel();
    return true;
  }

  function bindCarousel() {
    const root = document.getElementById('news-hero-carousel');
    if (!root || root.dataset.ready === '1') return;
    root.dataset.ready = '1';
    const slides = Array.from(root.querySelectorAll('.news-hero-slide'));
    const dots = Array.from(root.querySelectorAll('.news-hero-dot'));
    const prev = root.querySelector('.news-hero-prev');
    const next = root.querySelector('.news-hero-next');
    let current = 0;
    function show(index) {
      if (!slides.length) return;
      current = (index + slides.length) % slides.length;
      slides.forEach(function (slide, i) { slide.classList.toggle('active', i === current); });
      dots.forEach(function (dot, i) { dot.classList.toggle('active', i === current); });
    }
    if (prev) prev.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); show(current - 1); });
    if (next) next.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); show(current + 1); });
    dots.forEach(function (dot, index) { dot.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); show(index); }); });
    show(0);
  }

  async function loadAllNews() {
    const base = databaseBase();
    const sheetUrl = config().sheets && config().sheets.noticias;
    const tasks = [];
    tasks.push(getJSON(LOCAL_NEWS_URL).then(parseLocalNews).catch(function () { return []; }));
    tasks.push(base ? getJSON(base + '/adminNews.json').then(objectValues).catch(function () { return []; }) : Promise.resolve([]));
    tasks.push(sheetUrl ? getText(sheetUrl + (sheetUrl.includes('?') ? '&' : '?') + 'v=' + Math.floor(Date.now() / 60000)).then(parseSheetNews).catch(function () { return []; }) : Promise.resolve([]));
    tasks.push(base ? getJSON(base + '/newsMetrics.json').catch(function () { return {}; }) : Promise.resolve({}));
    tasks.push(base ? getJSON(base + '/adminHiddenNews.json').catch(function () { return {}; }) : Promise.resolve({}));
    const result = await Promise.all(tasks);
    return { items: mergeNews(result[0], result[2], result[1], result[4]), metrics: result[3] || {} };
  }

  window.CFF_NEWS_PROVIDER = {
    parseTSV: parseTSV,
    parseSheetNews: parseSheetNews,
    normalizeNews: normalizeNews,
    prepareContentAndImage: prepareContentAndImage,
    parseLocalNews: parseLocalNews,
    loadAllNews: loadAllNews,
    loadOne: async function (wanted) {
      const data = await loadAllNews();
      const wantedSlug = slugify(wanted);
      return data.items.find(function (item) {
        return item.id === wanted || slugify(item.id) === wantedSlug || slugify(item.titulo) === wantedSlug;
      }) || null;
    }
  };

  window.loadNoticias = async function () {
    const hero = document.getElementById('news-hero-container');
    const grid = document.getElementById('ultimas-noticias-grid');
    const title = document.getElementById('ultimas-noticias-titulo');
    if (!hero) return;

    const cached = loadCache();
    if (cached.length) render(cached, {});
    else hero.innerHTML = '<section class="news-hero-carousel" aria-label="Carregando notícias"><div style="min-height:220px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-weight:800;text-transform:uppercase;letter-spacing:1px">Carregando notícias...</div></section>';

    try {
      const result = await loadAllNews();
      if (!result.items.length) throw new Error('Nenhuma notícia encontrada.');
      saveCache(result.items);
      window.CFF_NOTICIAS_CACHE = result.items;
      window.cffNoticias = result.items;
      render(result.items, result.metrics);
    } catch (error) {
      if (!cached.length) {
        hero.innerHTML = '<section class="news-hero-carousel" aria-label="Erro ao carregar notícias"><div style="min-height:220px;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;text-align:center;padding:20px;color:var(--text-muted)"><strong style="color:#fff;text-transform:uppercase">Notícias indisponíveis no momento</strong><span style="font-size:.9em">Tente novamente em instantes.</span></div></section>';
        if (grid) grid.innerHTML = '';
        if (title) title.style.display = 'none';
        const actions = document.getElementById('ultimas-noticias-actions');
        if (actions) actions.style.display = 'none';
      }
      console.error(error);
    }
  };
})();
