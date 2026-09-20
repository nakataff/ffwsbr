const REPORT_ID = '2a4cb120-b9f6-4721-b0cc-2620c018e3c7';
const REPORT_URL_ID = '4bbd7490-84fe-4be2-b753-666f944c16ed';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'CFF_LOOKER_FETCH') return;

  const diagnostics = {
    bridgeVersion: chrome.runtime.getManifest().version,
    round: String(message.round || '').toUpperCase().trim(),
    drop: String(message.drop || '').toUpperCase().trim(),
    tabsFound: 0,
    selectedTabId: null,
    selectedTabUrl: '',
    selectedTabTitle: '',
    executeWorld: 'MAIN'
  };

  (async () => {
    const round = diagnostics.round;
    const drop = diagnostics.drop;

    if (!/^R\d+$/.test(round)) throw new Error('Rodada inválida. Use algo como R16.');
    if (!/^Q\d+$/.test(drop)) throw new Error('Queda inválida. Use algo como Q4.');

    const tabs = await chrome.tabs.query({ url: 'https://datastudio.google.com/*' });
    diagnostics.tabsFound = tabs.length;
    const tab = tabs.find(item => String(item.url || '').includes(REPORT_URL_ID)) || tabs.find(item => String(item.url || '').includes(REPORT_ID)) || tabs[0];
    diagnostics.selectedTabId = tab?.id || null;
    diagnostics.selectedTabUrl = String(tab?.url || '');
    diagnostics.selectedTabTitle = String(tab?.title || '');

    if (!tab?.id) {
      throw new Error('Abra o relatório da Garena no Looker Studio em outra aba e tente novamente.');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      args: [round, drop],
      func: async (roundArg, dropArg) => {
        const reportId = '2a4cb120-b9f6-4721-b0cc-2620c018e3c7';

        const resource = performance
          .getEntriesByType('resource')
          .map(entry => entry.name)
          .find(name => name.includes('/batchedDataV2?'));

        let appVersion = '20260914_0100';
        try {
          if (resource) appVersion = new URL(resource).searchParams.get('appVersion') || appVersion;
        } catch (_) {}

        const endpoints = [
          location.origin + '/batchedDataV2?appVersion=' + encodeURIComponent(appVersion),
          location.origin + '/u/0/batchedDataV2?appVersion=' + encodeURIComponent(appVersion)
        ];

        const t1Payload = {
          dataRequest: [{
            requestContext: {
              reportContext: {
                reportId,
                pageId: 'p_puv4sxyk7d',
                mode: 1,
                componentId: 'cd-k2u4sxyk7d',
                displayType: 'simple-table',
                actionId: 'crossFilters|reportDefault'
              },
              requestMode: 0
            },
            datasetSpec: {
              dataset: [{
                datasourceId: 'e3095371-ed3a-4866-8d84-606219ed299d',
                revisionNumber: 0,
                parameterOverrides: []
              }],
              queryFields: [
                { name: 'qt_jdlcq8b91d', datasetNs: 'd0', tableNs: 't0', resultTransformation: { analyticalFunction: 0, isRelativeToBase: false, bypassCanvasFilters: false }, dataTransformation: { sourceFieldName: '_n1604116824_' } },
                { name: 'qt_s72dcpdhrd', datasetNs: 'd0', tableNs: 't0', resultTransformation: { analyticalFunction: 0, isRelativeToBase: false, bypassCanvasFilters: false }, dataTransformation: { sourceFieldName: '_649865485_', aggregation: 6 } },
                { name: 'qt_wtjcq8b91d', datasetNs: 'd0', tableNs: 't0', resultTransformation: { analyticalFunction: 0, isRelativeToBase: false, bypassCanvasFilters: false }, dataTransformation: { sourceFieldName: '_1887436980_', aggregation: 6 } },
                { name: 'qt_plkcq8b91d', datasetNs: 'd0', tableNs: 't0', resultTransformation: { analyticalFunction: 0, isRelativeToBase: false, bypassCanvasFilters: false }, dataTransformation: { sourceFieldName: '_1272811272_', aggregation: 6 } },
                { name: 'qt_qlkcq8b91d', datasetNs: 'd0', tableNs: 't0', resultTransformation: { analyticalFunction: 0, isRelativeToBase: false, bypassCanvasFilters: false }, dataTransformation: { sourceFieldName: '_78391006_', aggregation: 2 } },
                { name: 'qt_p2epidfh6d', datasetNs: 'd0', tableNs: 't0', resultTransformation: { analyticalFunction: 0, isRelativeToBase: false, bypassCanvasFilters: false }, dataTransformation: { sourceFieldName: '_1273248318_', aggregation: 1 } }
              ],
              sortData: [
                { sortColumn: { name: 'qt_s72dcpdhrd', datasetNs: 'd0', tableNs: 't0', dataTransformation: { sourceFieldName: '_649865485_', aggregation: 6 } }, sortDir: 1 },
                { sortColumn: { name: 'qt_wtjcq8b91d', datasetNs: 'd0', tableNs: 't0', dataTransformation: { sourceFieldName: '_1887436980_', aggregation: 6 } }, sortDir: 1 },
                { sortColumn: { name: 'qt_plkcq8b91d', datasetNs: 'd0', tableNs: 't0', dataTransformation: { sourceFieldName: '_1272811272_', aggregation: 6 } }, sortDir: 1 }
              ],
              includeRowsCount: true,
              relatedDimensionMask: { addDisplay: false, addUniqueId: false, addLatLong: false },
              paginateInfo: { startRow: 1, rowsCount: 100 },
              dsFilterOverrides: [],
              filters: [
                {
                  filterDefinition: {
                    filterExpression: {
                      include: false,
                      conceptType: 0,
                      concept: { ns: 't0', name: 'qt_58vni89xgd' },
                      filterConditionType: 'NU',
                      stringValues: [''],
                      numberValues: [],
                      queryTimeTransformation: { dataTransformation: { sourceFieldName: '_n1604116824_' } }
                    }
                  },
                  dataSubsetNs: { datasetNs: 'd0', tableNs: 't0', contextNs: 'c0' },
                  version: 3
                },
                {
                  filterDefinition: {
                    filterExpression: {
                      include: true,
                      conceptType: 0,
                      concept: { ns: 't0', name: 'qt_dh9njshotd' },
                      filterConditionType: 'EQ',
                      stringValues: ['Fase 2'],
                      numberValues: [],
                      queryTimeTransformation: { dataTransformation: { sourceFieldName: '_2182253_' } }
                    }
                  },
                  dataSubsetNs: { datasetNs: 'd0', tableNs: 't0', contextNs: 'c0' },
                  version: 3
                },
                {
                  filterDefinition: {
                    filterExpression: {
                      include: true,
                      conceptType: 0,
                      concept: { name: 'qt_sf9j14z11d', ns: 't0' },
                      queryTimeTransformation: { dataTransformation: { sourceFieldName: 'calc_6mzkkba45d' } },
                      filterConditionType: 'IN',
                      stringValues: [roundArg]
                    }
                  },
                  dataSubsetNs: { datasetNs: 'd0', tableNs: 't0', contextNs: 'c0' },
                  version: 3,
                  isCanvasFilter: true
                },
                {
                  filterDefinition: {
                    filterExpression: {
                      include: true,
                      conceptType: 0,
                      concept: { name: 'qt_clqd54z11d', ns: 't0' },
                      queryTimeTransformation: { dataTransformation: { sourceFieldName: '_78391006_' } },
                      filterConditionType: 'IN',
                      stringValues: [dropArg]
                    }
                  },
                  dataSubsetNs: { datasetNs: 'd0', tableNs: 't0', contextNs: 'c0' },
                  version: 3,
                  isCanvasFilter: true
                }
              ],
              features: [],
              dateRanges: [],
              contextNsCount: 1,
              dateRangeDimensions: [{
                name: 'qt_mbscq8b91d',
                datasetNs: 'd0',
                tableNs: 't0',
                dataTransformation: { sourceFieldName: '_2122698_' }
              }],
              calculatedField: [],
              needGeocoding: false,
              geoFieldMask: [],
              multipleGeocodeFields: [],
              timezone: 'America/Sao_Paulo'
            },
            role: 'main',
            retryHints: {
              useClientControlledRetry: true,
              isLastRetry: false,
              retryCount: 0,
              originalRequestId: 'cd-k2u4sxyk7d_0_0'
            }
          }]
        };

        const p1Payload = {
          dataRequest: [{
            requestContext: {
              reportContext: {
                reportId,
                pageId: 'p_fckf0lsrgd',
                mode: 1,
                componentId: 'cd-01c6zwsrgd',
                displayType: 'simple-table',
                actionId: 'crossFilters|reportDefault'
              },
              requestMode: 0
            },
            datasetSpec: {
              dataset: [{
                datasourceId: '7602f71a-14a1-469c-86e1-03bee38d5663',
                revisionNumber: 0,
                parameterOverrides: []
              }],
              queryFields: [
                { name: 'qt_b69hpif45d', datasetNs: 'd0', tableNs: 't0', resultTransformation: { analyticalFunction: 0, isRelativeToBase: false, bypassCanvasFilters: false }, dataTransformation: { sourceFieldName: '_1194684632_' } },
                { name: 'qt_skfipif45d', datasetNs: 'd0', tableNs: 't0', resultTransformation: { analyticalFunction: 0, isRelativeToBase: false, bypassCanvasFilters: false }, dataTransformation: { sourceFieldName: '_n1604116824_' } },
                { name: 'qt_mm8hpif45d', datasetNs: 'd0', tableNs: 't0', dataTransformation: { sourceFieldName: '_1954404322_', aggregation: 6 } },
                { name: 'qt_nm8hpif45d', datasetNs: 'd0', tableNs: 't0', dataTransformation: { sourceFieldName: '_2122526_', aggregation: 6 } },
                { name: 'qt_ge9hpif45d', datasetNs: 'd0', tableNs: 't0', dataTransformation: { sourceFieldName: '_959996682_', aggregation: 6 } },
                { name: 'qt_he9hpif45d', datasetNs: 'd0', tableNs: 't0', resultTransformation: { analyticalFunction: 0, isRelativeToBase: false, bypassCanvasFilters: false }, dataTransformation: { sourceFieldName: '_78391006_', aggregation: 2 } },
                { name: 'qt_ie9hpif45d', datasetNs: 'd0', tableNs: 't0', dataTransformation: { sourceFieldName: '_76743_', aggregation: 6 } }
              ],
              sortData: [
                { sortColumn: { name: 'qt_mm8hpif45d', datasetNs: 'd0', tableNs: 't0', dataTransformation: { sourceFieldName: '_1954404322_', aggregation: 6 } }, sortDir: 1 },
                { sortColumn: { name: 'qt_nm8hpif45d', datasetNs: 'd0', tableNs: 't0', dataTransformation: { sourceFieldName: '_2122526_', aggregation: 6 } }, sortDir: 1 }
              ],
              includeRowsCount: true,
              relatedDimensionMask: { addDisplay: false, addUniqueId: false, addLatLong: false },
              paginateInfo: { startRow: 1, rowsCount: 100 },
              dsFilterOverrides: [],
              filters: [
                {
                  filterDefinition: {
                    filterExpression: {
                      include: false,
                      conceptType: 0,
                      concept: { ns: 't0', name: 'qt_j81on6z11d' },
                      filterConditionType: 'NU',
                      stringValues: [''],
                      numberValues: [],
                      queryTimeTransformation: { dataTransformation: { sourceFieldName: '_1194684632_' } }
                    }
                  },
                  dataSubsetNs: { datasetNs: 'd0', tableNs: 't0', contextNs: 'c0' },
                  version: 3
                },
                {
                  filterDefinition: {
                    filterExpression: {
                      include: true,
                      conceptType: 0,
                      concept: { name: 'qt_2zmdl7z11d', ns: 't0' },
                      queryTimeTransformation: { dataTransformation: { sourceFieldName: '_n1841790569_' } },
                      filterConditionType: 'IN',
                      stringValues: [roundArg]
                    }
                  },
                  dataSubsetNs: { datasetNs: 'd0', tableNs: 't0', contextNs: 'c0' },
                  version: 3,
                  isCanvasFilter: true
                },
                {
                  filterDefinition: {
                    filterExpression: {
                      include: true,
                      conceptType: 0,
                      concept: { name: 'qt_nefvv7z11d', ns: 't0' },
                      queryTimeTransformation: { dataTransformation: { sourceFieldName: '_78391006_' } },
                      filterConditionType: 'IN',
                      stringValues: [dropArg]
                    }
                  },
                  dataSubsetNs: { datasetNs: 'd0', tableNs: 't0', contextNs: 'c0' },
                  version: 3,
                  isCanvasFilter: true
                }
              ],
              features: [],
              dateRanges: [],
              contextNsCount: 1,
              dateRangeDimensions: [{
                name: 'qt_qhu3s7z11d',
                datasetNs: 'd0',
                tableNs: 't0',
                dataTransformation: { sourceFieldName: '_2122698_' }
              }],
              calculatedField: [],
              needGeocoding: false,
              geoFieldMask: [],
              multipleGeocodeFields: [],
              timezone: 'America/Sao_Paulo'
            },
            role: 'main',
            retryHints: {
              useClientControlledRetry: true,
              isLastRetry: false,
              retryCount: 0,
              originalRequestId: 'cd-01c6zwsrgd_0_0'
            }
          }]
        };

        const parseBody = text => {
          const clean = String(text || '').replace(/^\s*\)\]\}'\s*/, '').trim();
          if (!clean) throw new Error('O Looker respondeu sem conteúdo.');
          return JSON.parse(clean);
        };

        const postOnce = async (endpointUrl, payload, label) => {
          try {
            const response = await fetch(endpointUrl, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Same-Domain': '1'
              },
              body: JSON.stringify(payload)
            });

            const body = await response.text();
            let json = null;
            let parseError = '';
            if (response.ok) {
              try { json = parseBody(body); }
              catch (error) { parseError = String(error?.message || error); }
            }
            return {
              ok: response.ok && Boolean(json),
              label,
              endpoint: endpointUrl,
              status: response.status,
              statusText: response.statusText,
              bodyLength: body.length,
              parseError,
              bodyStart: response.ok ? '' : body.slice(0, 180),
              json
            };
          } catch (error) {
            return {
              ok: false,
              label,
              endpoint: endpointUrl,
              status: 0,
              statusText: '',
              bodyLength: 0,
              parseError: '',
              bodyStart: '',
              fetchError: String(error?.message || error),
              json: null
            };
          }
        };

        const post = async (payload, label) => {
          const attempts = [];
          for (const endpointUrl of endpoints) {
            const result = await postOnce(endpointUrl, payload, label);
            attempts.push({
              endpoint: result.endpoint,
              ok: result.ok,
              status: result.status,
              statusText: result.statusText,
              bodyLength: result.bodyLength,
              parseError: result.parseError || '',
              fetchError: result.fetchError || '',
              bodyStart: result.bodyStart || ''
            });
            if (result.ok) {
              result.attempts = attempts;
              return result;
            }
          }
          const last = await postOnce(endpoints[endpoints.length - 1], payload, label);
          last.attempts = attempts;
          return last;
        };

        const columnValues = column => {
          if (!column) return [];
          const bucket = column.stringColumn || column.doubleColumn || column.longColumn || column.dateColumn || {};
          return Array.isArray(bucket.values) ? bucket.values : [];
        };

        const compactT1 = json => {
          const table = json?.dataResponse?.[0]?.dataSubset?.[0]?.dataset?.tableDataset;
          if (!table || !Array.isArray(table.column) || table.column.length < 6) {
            throw new Error('T1: resposta recebida, mas a tabela de 6 colunas não foi encontrada.');
          }
          const cols = table.column.map(columnValues);
          const size = Number(table.size || cols[0]?.length || 0);
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
          return rows;
        };

        const compactP1 = json => {
          const table = json?.dataResponse?.[0]?.dataSubset?.[0]?.dataset?.tableDataset;
          if (!table || !Array.isArray(table.column) || table.column.length < 7) {
            throw new Error('P1: resposta recebida, mas a tabela de 7 colunas não foi encontrada.');
          }
          const cols = table.column.map(columnValues);
          const size = Number(table.size || cols[0]?.length || 0);
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
          return rows;
        };

        const [t1Req, p1Req] = await Promise.all([post(t1Payload, 'T1'), post(p1Payload, 'P1')]);
        const pageDiagnostics = {
          href: location.href,
          origin: location.origin,
          readyState: document.readyState,
          appVersion,
          resourceDetected: Boolean(resource),
          endpoints,
          requests: [t1Req, p1Req].map(item => ({
            label: item.label,
            ok: item.ok,
            endpoint: item.endpoint || '',
            status: item.status,
            statusText: item.statusText,
            bodyLength: item.bodyLength,
            parseError: item.parseError || '',
            fetchError: item.fetchError || '',
            bodyStart: item.bodyStart || '',
            attempts: item.attempts || []
          }))
        };

        if (!t1Req.ok || !p1Req.ok) {
          return {
            __cffError: 'A consulta chegou ao Looker, mas T1 ou P1 falhou.',
            __cffDiagnostics: pageDiagnostics
          };
        }

        try {
          const teams = compactT1(t1Req.json);
          const players = compactP1(p1Req.json);
          pageDiagnostics.t1Rows = teams.length;
          pageDiagnostics.p1Rows = players.length;
          pageDiagnostics.t1Columns = t1Req.json?.dataResponse?.[0]?.dataSubset?.[0]?.dataset?.tableDataset?.column?.length || 0;
          pageDiagnostics.p1Columns = p1Req.json?.dataResponse?.[0]?.dataSubset?.[0]?.dataset?.tableDataset?.column?.length || 0;
          return {
            teams,
            players,
            appVersion,
            reportUrl: location.href,
            diagnostics: pageDiagnostics
          };
        } catch (error) {
          return {
            __cffError: String(error?.message || error),
            __cffDiagnostics: pageDiagnostics
          };
        }
      }
    });

    diagnostics.executeResultCount = Array.isArray(results) ? results.length : 0;
    diagnostics.executeResults = Array.isArray(results) ? results.map(item => ({
      frameId: item?.frameId ?? null,
      documentId: item?.documentId || '',
      hasResult: Object.prototype.hasOwnProperty.call(item || {}, 'result'),
      resultType: typeof item?.result
    })) : [];

    const data = results?.[0]?.result;
    if (!data) {
      throw Object.assign(new Error('A aba do Looker executou o script, mas o Chrome devolveu result=undefined.'), { diagnostics });
    }
    if (data.__cffError) {
      throw Object.assign(new Error(data.__cffError), { diagnostics: { ...diagnostics, page: data.__cffDiagnostics || null } });
    }
    if (!Array.isArray(data.teams) || !Array.isArray(data.players)) {
      throw Object.assign(new Error('A aba do Looker não devolveu as listas T1/P1.'), { diagnostics: { ...diagnostics, returnedKeys: Object.keys(data || {}) } });
    }

    return { ok: true, data, diagnostics: { ...diagnostics, page: data.diagnostics || null } };
  })()
    .then(sendResponse)
    .catch(error => sendResponse({
      ok: false,
      error: String(error?.message || error),
      diagnostics: error?.diagnostics || diagnostics
    }));

  return true;
});
