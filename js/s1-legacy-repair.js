(() => {
  'use strict';

  const S1_PAGES = new Set([
    'tabela',
    'mvp',
    'final',
    'equipes',
    'datas',
    'selecao-da-semana',
    'stats',
    'notas-cff',
    'comparar-1v1'
  ]);

  const repairState = new Map();
  let legacyPromise = null;

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  function getActiveS1Page() {
    const hash = String(location.hash || '').replace(/^#/, '');
    if (S1_PAGES.has(hash)) return hash;
    const active = document.querySelector('.page.active')?.id || '';
    return S1_PAGES.has(active) ? active : '';
  }

  async function ensureLegacyReady() {
    if (!legacyPromise) {
      legacyPromise = (async () => {
        const deadline = Date.now() + 15000;
        while (typeof window.cffEnsureLegacy !== 'function' && Date.now() < deadline) {
          await delay(50);
        }
        if (typeof window.cffEnsureLegacy !== 'function') {
          throw new Error('cffEnsureLegacy indisponível');
        }

        await window.cffEnsureLegacy();

        if (window.cffCoreReady && typeof window.cffCoreReady.then === 'function') {
          await Promise.race([window.cffCoreReady, delay(15000)]);
        }

        return true;
      })().catch(error => {
        legacyPromise = null;
        throw error;
      });
    }
    return legacyPromise;
  }

  function prepareLegacyFilters() {
    try { window.buildDayFilters?.(); } catch (_) {}
    try { window.populateSelects?.(); } catch (_) {}
    try { window.buildExtraMultiSelectFilters?.(); } catch (_) {}
  }

  function renderPage(page) {
    try {
      prepareLegacyFilters();

      switch (page) {
        case 'tabela':
          window.renderFullTeams?.();
          window.renderGroupsTables?.();
          break;
        case 'mvp':
          window.renderAllPlayers?.();
          break;
        case 'final':
          window.renderFinalPossibilities?.();
          break;
        case 'equipes':
          window.renderTeamsDirectory?.();
          break;
        case 'datas':
          window.renderSchedule?.();
          break;
        case 'selecao-da-semana':
          window.renderSelection?.();
          break;
        case 'stats':
          window.cffSyncStatsStageControls?.();
          window.renderTop5Stats?.();
          window.renderTableAvg?.();
          window.renderTableTotal?.();
          window.renderCFFStats?.();
          window.renderPlayerStats?.();
          window.buildMultiTeamFilters?.();
          window.renderMultiTeamChart?.();
          break;
        case 'notas-cff':
          window.renderNotasCFFPage?.();
          break;
        case 'comparar-1v1':
          window.renderCompareTeams?.();
          window.renderComparePlayers?.();
          break;
      }
    } catch (_) {}
  }

  async function repairPage(page) {
    page = String(page || getActiveS1Page()).trim();
    if (!S1_PAGES.has(page)) return;

    if (repairState.has(page)) return repairState.get(page);

    const task = (async () => {
      try {
        await ensureLegacyReady();
        renderPage(page);
        setTimeout(() => renderPage(page), 120);
        setTimeout(() => renderPage(page), 650);
        setTimeout(() => {
          if (page === 'stats') {
            try { window.buildMultiTeamFilters?.(); } catch (_) {}
            try { window.renderMultiTeamChart?.(); } catch (_) {}
          }
        }, 1100);
      } finally {
        setTimeout(() => repairState.delete(page), 300);
      }
    })().catch(() => {});

    repairState.set(page, task);
    return task;
  }

  function wrapFunction(name) {
    const base = window[name];
    if (typeof base !== 'function' || base.__cffS1RepairWrapped) return;

    const wrapped = function(page, ...args) {
      const result = base.call(this, page, ...args);
      if (S1_PAGES.has(String(page || '').trim())) {
        repairPage(page);
      }
      return result;
    };

    wrapped.__cffS1RepairWrapped = true;
    wrapped.__cffS1RepairBase = base;
    window[name] = wrapped;
  }

  function installWrappers() {
    wrapFunction('navigate');
    wrapFunction('navigateAndClose');
    wrapFunction('mobileTabClick');
  }

  function bootRepair() {
    installWrappers();
    repairPage(getActiveS1Page());
  }

  document.addEventListener('cff:modules-loaded', () => {
    setTimeout(bootRepair, 0);
  });

  window.addEventListener('hashchange', () => {
    setTimeout(bootRepair, 0);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootRepair, { once: true });
  } else {
    bootRepair();
  }

  let attempts = 0;
  const watchdog = setInterval(() => {
    attempts += 1;
    installWrappers();
    const page = getActiveS1Page();
    if (page) repairPage(page);
    if (attempts >= 40) clearInterval(watchdog);
  }, 250);

  window.cffRepairS1Page = repairPage;
})();
