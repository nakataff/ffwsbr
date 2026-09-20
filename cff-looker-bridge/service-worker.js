const REPORT_ID = '2a4cb120-b9f6-4721-b0cc-2620c018e3c7';
const PAGE_T1 = 'p_puv4sxyk7d';
const PAGE_P1 = 'p_fckf0lsrgd';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function parseLookerText(text) {
  const clean = String(text || '').replace(/^\s*\)\]\}'\s*/, '').trim();
  if (!clean) throw new Error('Resposta vazia do Looker.');
  return JSON.parse(clean);
}

function columnValues(column) {
  if (!column) return [];
  const bucket = column.stringColumn || column.doubleColumn || column.longColumn || column.dateColumn || {};
  return Array.isArray(bucket.values) ? bucket.values : [];
}

function tableCandidates(json) {
  const out = [];
  const responses = Array.isArray(json?.dataResponse) ? json.dataResponse : [];
  responses.forEach((response, responseIndex) => {
    const subsets = Array.isArray(response?.dataSubset) ? response.dataSubset : [];
    subsets.forEach((subset, subsetIndex) => {
      const table = subset?.dataset?.tableDataset;
      if (table && Array.isArray(table.column)) {
        out.push({ responseIndex, subsetIndex, table });
      }
    });
  });
  return out;
}

function compactT1(json, diagnostics) {
  const candidates = tableCandidates(json);
  let picked = null;

  for (const candidate of candidates) {
    const table = candidate.table;
    if (table.column.length < 6) continue;
    const cols = table.column.map(columnValues);
    const size = Number(table.size || cols[0]?.length || 0);
    if (size !== 12) continue;

    const positions = cols[5]?.map(value => Number(value)) || [];
    const validPositions = positions.length === 12 &&
      new Set(positions.filter(value => value >= 1 && value <= 12)).size === 12;

    if (validPositions) {
      picked = { ...candidate, cols, size };
      break;
    }

    if (!picked && table.column.length === 6) picked = { ...candidate, cols, size };
  }

  if (!picked) {
    throw new Error('T1 capturada, mas nenhuma tabela compatível com 12 equipes foi encontrada no batch.');
  }

  const { cols, size } = picked;
  const rows = [];
  for (let i = 0; i < size; i++) {
    rows.push({
      team: String(cols[0]?.[i] ?? ''),
      points: Number(cols[1]?.[i] ?? 0),
      booyah: Number(cols[2]?.[i] ?? 0),
      kills: Number(cols[3]?.[i] ?? 0),
      matches: Number(cols[4]?.[i] ?? 0),
      position: Number(cols[5]?.[i] ?? 0)
    });
  }

  if (diagnostics) {
    diagnostics.t1ResponseIndex = picked.responseIndex;
    diagnostics.t1SubsetIndex = picked.subsetIndex;
    diagnostics.t1Columns = picked.table.column.length;
    diagnostics.t1Size = size;
    diagnostics.t1Positions = rows.map(row => row.position);
    diagnostics.t1Teams = rows.map(row => row.team);
  }
  return rows;
}

function compactP1(json, diagnostics) {
  const candidates = tableCandidates(json);
  let picked = null;

  for (const candidate of candidates) {
    const table = candidate.table;
    if (table.column.length < 7) continue;
    const cols = table.column.map(columnValues);
    const size = Number(table.size || cols[0]?.length || 0);
    if (size < 40) continue;

    if (table.column.length === 7) {
      picked = { ...candidate, cols, size };
      break;
    }
    if (!picked) picked = { ...candidate, cols, size };
  }

  if (!picked) {
    throw new Error('P1 capturada, mas nenhuma tabela compatível com jogadores foi encontrada no batch.');
  }

  const { cols, size } = picked;
  const rows = [];
  for (let i = 0; i < size; i++) {
    rows.push({
      name: String(cols[0]?.[i] ?? ''),
      team: String(cols[1]?.[i] ?? ''),
      kills: Number(cols[2]?.[i] ?? 0),
      damage: Number(cols[3]?.[i] ?? 0),
      assists: Number(cols[4]?.[i] ?? 0),
      matches: Number(cols[5]?.[i] ?? 0),
      mvp: Number(cols[6]?.[i] ?? 0)
    });
  }

  if (diagnostics) {
    diagnostics.p1ResponseIndex = picked.responseIndex;
    diagnostics.p1SubsetIndex = picked.subsetIndex;
    diagnostics.p1Columns = picked.table.column.length;
    diagnostics.p1Size = size;
  }
  return rows;
}

async function waitForTabComplete(tabId, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return tab;
    await sleep(250);
  }
  throw new Error('A página do Looker demorou demais para carregar.');
}

async function readCapturedResult(tabId, kind) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: kindArg => {
      const data = window.__CFF_LOOKER_RESULTS__?.[kindArg];
      return data ? {
        kind: data.kind,
        text: data.text,
        status: data.status,
        capturedAt: data.capturedAt,
        pageUrl: data.pageUrl,
        round: data.round,
        drop: data.drop
      } : null;
    },
    args: [kind]
  });
  return result?.result || null;
}

async function capturePage(kind, pageId, round, drop, diagnostics) {
  const url = 'https://datastudio.google.com/u/0/reporting/' + REPORT_ID + '/page/' + pageId +
    '#cffRound=' + encodeURIComponent(round) + '&cffDrop=' + encodeURIComponent(drop);

  const tab = await chrome.tabs.create({ url, active: false });
  const item = {
    kind,
    pageId,
    tabId: tab.id,
    requestedUrl: url,
    finalUrl: '',
    status: 0,
    captured: false,
    bodyLength: 0,
    elapsedMs: 0
  };
  diagnostics.pages.push(item);
  const started = Date.now();

  try {
    const ready = await waitForTabComplete(tab.id);
    item.finalUrl = String(ready.url || '');

    const deadline = Date.now() + 18000;
    while (Date.now() < deadline) {
      const captured = await readCapturedResult(tab.id, kind);
      if (captured) {
        item.status = Number(captured.status || 0);
        item.captured = true;
        item.bodyLength = String(captured.text || '').length;
        item.elapsedMs = Date.now() - started;
        item.round = captured.round;
        item.drop = captured.drop;
        if (item.status < 200 || item.status >= 300) {
          throw new Error(kind + ' do próprio Looker respondeu HTTP ' + item.status + '.');
        }
        return parseLookerText(captured.text);
      }
      await sleep(350);
    }

    item.elapsedMs = Date.now() - started;
    throw new Error(kind + ': o Looker abriu a página, mas a requisição da tabela não foi capturada.');
  } finally {
    try { await chrome.tabs.remove(tab.id); } catch (_) {}
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'CFF_LOOKER_FETCH') return;

  const diagnostics = {
    bridgeVersion: chrome.runtime.getManifest().version,
    mode: 'capture-real-request',
    round: String(message.round || '').toUpperCase().trim(),
    drop: String(message.drop || '').toUpperCase().trim(),
    pages: []
  };

  (async () => {
    const round = diagnostics.round;
    const drop = diagnostics.drop;

    if (!/^R\d+$/.test(round)) throw new Error('Rodada inválida. Use algo como R16.');
    if (!/^Q\d+$/.test(drop)) throw new Error('Queda inválida. Use algo como Q4.');

    const [t1Json, p1Json] = await Promise.all([
      capturePage('T1', PAGE_T1, round, drop, diagnostics),
      capturePage('P1', PAGE_P1, round, drop, diagnostics)
    ]);

    const teams = compactT1(t1Json, diagnostics);
    const players = compactP1(p1Json, diagnostics);

    diagnostics.t1Rows = teams.length;
    diagnostics.p1Rows = players.length;

    return {
      ok: true,
      data: {
        teams,
        players,
        diagnostics
      },
      diagnostics
    };
  })()
    .then(sendResponse)
    .catch(error => sendResponse({
      ok: false,
      error: String(error?.message || error),
      diagnostics
    }));

  return true;
});
