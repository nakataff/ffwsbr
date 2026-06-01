/* Central Free Fire - resolvedor PNG -> WebP
 * Mantém compatibilidade com referências antigas como E1.png, silhueta.png e Fluxo 2.png.
 * Se o WebP falhar, tenta o PNG original antes do fallback do próprio componente.
 */
(function () {
    'use strict';

    const DEFAULT_MAP = {
  "A7 2.png": "A7 2.webp",
  "AXS BRANCA.png": "AXS BRANCA.webp",
  "Civis.png": "Civis.webp",
  "E1.png": "E1.webp",
  "Fluxo 2.png": "Fluxo 2.webp",
  "Free_Fire_World_Series_Brazil_icon_allmode.png": "Free_Fire_World_Series_Brazil_icon_allmode.webp",
  "Influence Rage.png": "Influence Rage.webp",
  "Intz 1.png": "Intz 1.webp",
  "Loops 1.png": "Loops 1.webp",
  "Los.png": "Los.webp",
  "MX.png": "MX.webp",
  "Outplay.png": "Outplay.webp",
  "Rise 1.png": "Rise 1.webp",
  "Rush.png": "Rush.webp",
  "Team Solid 2.png": "Team Solid 2.webp",
  "Vasco.png": "Vasco.webp",
  "Virtus Pro.png": "Virtus Pro.webp",
  "bops.png": "bops.webp",
  "br.png": "br.webp",
  "cpt.png": "cpt.webp",
  "instagram.png": "instagram.webp",
  "loud 2.png": "loud 2.webp",
  "mt7.png": "mt7.webp",
  "silhueta.png": "silhueta.webp",
  "trap.png": "trap.webp"
};
    let imageMap = Object.assign({}, DEFAULT_MAP);
    const MAP_URL = 'image-webp-map.json?v=20260601-webp-v1';

    function normalizePath(value) {
        if (!value || typeof value !== 'string') return '';
        const clean = value.split('#')[0].split('?')[0];
        try { return decodeURIComponent(clean); } catch (e) { return clean; }
    }

    function fileNameOf(value) {
        const clean = normalizePath(value).split('\\').join('/');
        return clean.slice(clean.lastIndexOf('/') + 1);
    }

    function withSamePrefix(original, mappedName) {
        const clean = normalizePath(original).split('\\').join('/');
        const slash = clean.lastIndexOf('/');
        return slash >= 0 ? clean.slice(0, slash + 1) + mappedName : mappedName;
    }

    function resolveImageSrc(src) {
        if (!src || typeof src !== 'string') return src;
        if (/^(data:|blob:|https?:)/i.test(src)) return src;
        const fileName = fileNameOf(src);
        const mapped = imageMap[fileName];
        return mapped ? withSamePrefix(src, mapped) : src;
    }

    function applyToImage(img) {
        if (!img || img.__cffWebpApplied) return;
        img.__cffWebpApplied = true;
        const current = img.getAttribute('src');
        const next = resolveImageSrc(current);
        if (next && current && next !== current) {
            img.dataset.cffOriginalPng = normalizePath(current);
            img.setAttribute('src', next);
        }
    }

    function applyAll(root) {
        const scope = root && root.querySelectorAll ? root : document;
        if (scope.matches && scope.matches('img')) applyToImage(scope);
        scope.querySelectorAll('img').forEach(applyToImage);
    }

    document.addEventListener('error', function (event) {
        const img = event.target;
        if (!img || img.tagName !== 'IMG') return;
        const original = img.dataset && img.dataset.cffOriginalPng;
        if (original && img.getAttribute('src') !== original) {
            img.dataset.cffOriginalPng = '';
            img.src = original;
        }
    }, true);

    if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(function (mutations) {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach(function (node) {
                    if (node && node.nodeType === 1) applyAll(node);
                });
                if (mutation.type === 'attributes' && mutation.target && mutation.target.tagName === 'IMG') {
                    mutation.target.__cffWebpApplied = false;
                    applyToImage(mutation.target);
                }
            }
        }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    }

    fetch(MAP_URL, { cache: 'force-cache' })
        .then(function (response) { return response.ok ? response.json() : null; })
        .then(function (payload) {
            if (payload && payload.map && typeof payload.map === 'object') {
                imageMap = Object.assign({}, DEFAULT_MAP, payload.map);
                applyAll(document);
            }
        })
        .catch(function () { /* mantém DEFAULT_MAP */ });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { applyAll(document); });
    } else {
        applyAll(document);
    }

    window.CFF_IMAGE_WEBP_MAP = imageMap;
    window.cffResolveImageSrc = resolveImageSrc;
})();
