(() => {
  'use strict';

  if (window.__CFF_HALL_ALIAS_FETCH_PATCH) return;
  window.__CFF_HALL_ALIAS_FETCH_PATCH = true;

  const nativeFetch = window.fetch.bind(window);
  let aliasResolverPromise = null;

  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/0/g, 'O')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();

  const num = value => Number(value) || 0;

  function buildResolver(aliasJson) {
    const canonicalByNorm = new Map();
    const aliasCandidates = new Map();

    Object.keys(aliasJson || {}).forEach(canonical => {
      const key = norm(canonical);
      if (key && !canonicalByNorm.has(key)) canonicalByNorm.set(key, canonical);
    });

    Object.entries(aliasJson || {}).forEach(([canonical, aliases]) => {
      const canonicalKey = norm(canonical);
      if (!canonicalKey) return;

      [canonical, ...(Array.isArray(aliases) ? aliases : [])].forEach(alias => {
        const aliasKey = norm(alias);
        if (!aliasKey) return;
        if (!aliasCandidates.has(aliasKey)) aliasCandidates.set(aliasKey, new Set());
        aliasCandidates.get(aliasKey).add(canonicalKey);
      });
    });

    return name => {
      const key = norm(name);
      if (!key) return { key, name: String(name || '') };

      // Se esse nome também é um nome canônico real, ele tem prioridade.
      // Isso evita unir casos ambíguos como GUS e GUSZX.
      if (canonicalByNorm.has(key)) {
        return { key, name: canonicalByNorm.get(key) };
      }

      const candidates = aliasCandidates.get(key);
      if (!candidates || candidates.size !== 1) {
        return { key, name: String(name || '') };
      }

      const canonicalKey = [...candidates][0];
      return {
        key: canonicalKey,
        name: canonicalByNorm.get(canonicalKey) || String(name || '')
      };
    };
  }

  async function getAliasResolver() {
    if (!aliasResolverPromise) {
      aliasResolverPromise = nativeFetch('player-aliases.json?v=20260907-hall-alias-v1', { cache: 'default' })
        .then(response => response.ok ? response.json() : {})
        .then(buildResolver)
        .catch(() => name => ({ key: norm(name), name: String(name || '') }));
    }
    return aliasResolverPromise;
  }

  function statsOf(value) {
    return {
      k: num(value?.k ?? value?.kills ?? value?.abates),
      q: num(value?.q ?? value?.quedas ?? value?.matches)
    };
  }

  function mergeEdition(existing, incoming) {
    if (!existing) return { ...(incoming || {}) };
    if (!incoming) return { ...existing };

    const a = statsOf(existing);
    const b = statsOf(incoming);

    // Duplicata idêntica: mantém apenas uma cópia.
    if (a.k === b.k && a.q === b.q) return { ...existing };

    const sources = [existing.source, incoming.source]
      .filter(Boolean)
      .flatMap(value => String(value).split('+'));

    return {
      ...existing,
      ...incoming,
      k: a.k + b.k,
      q: a.q + b.q,
      ...(sources.length ? { source: [...new Set(sources)].join('+') } : {})
    };
  }

  async function mergeHistoricalAliases(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return data;

    const resolveAlias = await getAliasResolver();
    const merged = {};

    Object.entries(data).forEach(([playerName, editions]) => {
      const resolved = resolveAlias(playerName);
      const displayName = resolved.name || playerName;

      if (!merged[displayName]) merged[displayName] = {};

      Object.entries(editions || {}).forEach(([edition, stats]) => {
        merged[displayName][edition] = mergeEdition(merged[displayName][edition], stats);
      });
    });

    return merged;
  }

  function isLbffDataRequest(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      if (!raw) return false;
      const url = new URL(raw, location.href);
      return /\/lbffData\.json$/i.test(url.pathname);
    } catch (_) {
      return false;
    }
  }

  window.fetch = async function patchedFetch(input, init) {
    const response = await nativeFetch(input, init);
    if (!isLbffDataRequest(input) || !response.ok) return response;

    try {
      const json = await response.clone().json();
      const merged = await mergeHistoricalAliases(json);
      return new Response(JSON.stringify(merged), {
        status: response.status,
        statusText: response.statusText,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    } catch (_) {
      return response;
    }
  };
})();
