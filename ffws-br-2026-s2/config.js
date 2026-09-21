(()=>{
  const liveVersion='20260920-s2-static-v1';
  const LIVE_ROOT='ffwsLive/2026-s2';

  const SECOND_PHASE_SEED = Object.freeze([
    Object.freeze({ team: 'LOS', sourcePosition: 1, bonus: 50 }),
    Object.freeze({ team: 'LOUD SNICKERS', sourcePosition: 2, bonus: 42 }),
    Object.freeze({ team: 'FLUXO W7M', sourcePosition: 3, bonus: 35 }),
    Object.freeze({ team: 'INTZ', sourcePosition: 4, bonus: 29 }),
    Object.freeze({ team: 'TEAM SOLID', sourcePosition: 5, bonus: 24 }),
    Object.freeze({ team: 'RISE GAMING', sourcePosition: 6, bonus: 19 }),
    Object.freeze({ team: 'ALPHA7', sourcePosition: 7, bonus: 15 }),
    Object.freeze({ team: 'RUSH GAMING', sourcePosition: 8, bonus: 11 }),
    Object.freeze({ team: 'INFLUENCE RAGE', sourcePosition: 9, bonus: 8 }),
    Object.freeze({ team: 'CPT VOX', sourcePosition: 10, bonus: 5 }),
    Object.freeze({ team: 'AFROGAMES', sourcePosition: 11, bonus: 2 }),
    Object.freeze({ team: 'SX TET', sourcePosition: 12, bonus: 0 })
  ]);

  const num=v=>Number(v)||0;
  const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
  const playerKey=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const values=v=>Array.isArray(v)?v.filter(Boolean):Object.values(v||{}).filter(Boolean);
  let playerNameMapPromise=null;
  function loadPlayerNameRows(nativeFetch){
    if(playerNameMapPromise)return playerNameMapPromise;
    playerNameMapPromise=nativeFetch('ffws-br-2026-s2/player-name-map.json?v=20260921-player-aliases-v1',{cache:'default'})
      .then(r=>r.ok?r.json():null)
      .then(data=>Array.isArray(data?.rows)?data.rows:[])
      .catch(()=>[]);
    return playerNameMapPromise;
  }
  function canonicalLivePlayer(rows,name,team){
    const n=playerKey(name),t=normalize(team),list=Array.isArray(rows)?rows:[];
    const matches=row=>[row?.canonicalName,row?.sourceName,...(Array.isArray(row?.aliases)?row.aliases:[])].some(value=>playerKey(value)===n);
    return list.find(row=>normalize(row?.team)===t&&matches(row))||list.find(matches)||null;
  }
  const jsonResponse=(response,payload)=>{const headers=new Headers(response.headers);headers.set('content-type','application/json; charset=utf-8');return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers})};

  function injectSecondPhasePolish() {
    if (document.getElementById('cff-s2-second-phase-polish')) return;
    const style = document.createElement('style');
    style.id = 'cff-s2-second-phase-polish';
    style.textContent = `
      #ffws-br-s2-segunda-fase .ffws-s2-row-world{box-shadow:inset 4px 0 #ffc226!important;background:linear-gradient(90deg,rgba(255,194,38,.13),rgba(255,194,38,.035))!important}
      #ffws-br-s2-segunda-fase .ffws-s2-row-world td:first-child{color:#ffd45a!important}
      #ffws-br-s2-segunda-fase .ffws-s2-row-final{box-shadow:none!important;background:rgba(255,255,255,.012)!important}
      #ffws-br-s2-segunda-fase .ffws-s2-legend .world i{background:#ffc226!important}
      #ffws-br-s2-segunda-fase .ffws-s2-legend .final i{background:#465469!important}

      @media(max-width:760px){
        #ffws-br-s2-segunda-fase .ffws-s2-table{min-width:455px!important;table-layout:fixed}
        #ffws-br-s2-segunda-fase .ffws-s2-table th:nth-child(1),#ffws-br-s2-segunda-fase .ffws-s2-table td:nth-child(1){width:38px;padding-left:4px!important;padding-right:4px!important}
        #ffws-br-s2-segunda-fase .ffws-s2-table th:nth-child(2),#ffws-br-s2-segunda-fase .ffws-s2-table td:nth-child(2){width:118px;min-width:118px!important;padding-left:5px!important;padding-right:5px!important}
        #ffws-br-s2-segunda-fase .ffws-s2-table th:nth-child(3),#ffws-br-s2-segunda-fase .ffws-s2-table td:nth-child(3){width:68px;padding-left:4px!important;padding-right:4px!important}
        #ffws-br-s2-segunda-fase .ffws-s2-table th:nth-child(4),#ffws-br-s2-segunda-fase .ffws-s2-table td:nth-child(4){width:58px;padding-left:4px!important;padding-right:4px!important}
        #ffws-br-s2-segunda-fase .ffws-s2-table th:nth-child(5),#ffws-br-s2-segunda-fase .ffws-s2-table td:nth-child(5),#ffws-br-s2-segunda-fase .ffws-s2-table th:nth-child(6),#ffws-br-s2-segunda-fase .ffws-s2-table td:nth-child(6),#ffws-br-s2-segunda-fase .ffws-s2-table th:nth-child(8),#ffws-br-s2-segunda-fase .ffws-s2-table td:nth-child(8){width:50px;padding-left:4px!important;padding-right:4px!important}
        #ffws-br-s2-segunda-fase .ffws-s2-table td.team-col .ffws-s2-team-cell{gap:5px;min-width:0}
        #ffws-br-s2-segunda-fase .ffws-s2-table td.team-col .ffws-s2-team-cell img{width:20px!important;height:20px!important;flex:0 0 20px}
        #ffws-br-s2-segunda-fase .ffws-s2-table td.team-col .ffws-s2-team-name{display:block!important;flex:1 1 auto;min-width:0;overflow:visible}
        #ffws-br-s2-segunda-fase .ffws-s2-table td.team-col .ffws-s2-team-name strong{display:block;max-width:none!important;overflow:visible!important;text-overflow:clip!important;white-space:nowrap;font-size:.75rem}
        #ffws-br-s2-segunda-fase .ffws-s2-table td.team-col .ffws-s2-team-name .ffws-s2-mobile{display:inline!important;white-space:nowrap}
      }
      @media(max-width:470px){#ffws-br-s2-segunda-fase .ffws-s2-table th,#ffws-br-s2-segunda-fase .ffws-s2-table td{font-size:.78rem}}
    `;
    document.head.appendChild(style);
  }

  injectSecondPhasePolish();

  window.FFWS_BR_2026_S2_CONFIG = Object.freeze({
    teamsUrl: 'ffws-br-2026-s2/teams.json?v=20260902-wliu-sx-v31',
    stagesUrl: `ffws-br-2026-s2/stages.json?v=${liveVersion}`,
    playersUrl: `ffws-br-2026-s2/players.json?v=${liveVersion}`,
    datesUrl: 'ffws-br-2026-s2/dates.json?v=20260913-classificatoria-final-v2',
    secondPhaseSeed: SECOND_PHASE_SEED,
    layout: {
      classificatoria: {
        participantsTitle: 'Times Participantes',
        classificationTitle: 'Classificação Final',
        format: {
          kicker: 'WB 2026 S2',
          title: 'Formato da Classificatória',
          description: '14 equipes • 14 rodadas • duas equipes ficaram de folga por rodada • os 12 melhores avançaram para a Segunda Fase • os dois últimos foram rebaixados.',
          legends: [
            { className: 'br-legend-final', range: '1º ao 12º', label: 'classificados para a Segunda Fase' },
            { className: 'br-legend-relegated', range: '13º ao 14º', label: 'rebaixados diretamente' }
          ],
          details: {
            summary: 'Ver detalhes do novo formato',
            intro: '<strong>Segunda Fase:</strong> 12 equipes, seis rodadas e bônus de pontuação baseado na Classificatória.',
            items: [
              'O 1º e o 2º colocados da Segunda Fase garantem vaga no Mundial.',
              'As 12 equipes disputam a Final em dois dias.',
              'A Final será jogada no formato <strong>Champion Rush</strong>, com linha de chegada em <strong>160 pontos</strong>.',
              'Caso o campeão já esteja entre os dois classificados, a vaga será repassada ao próximo melhor colocado da Final.'
            ]
          }
        },
        defaultMaps: [
          { value: 'Bermuda', label: 'Bermuda' },
          { value: 'Kalahari', label: 'Kalahari' },
          { value: 'Purgatory', label: 'Purgatório' },
          { value: 'Nexterra', label: 'Nova Terra' },
          { value: 'Solara', label: 'Solara' }
        ],
        zones: [
          { from: 1, to: 12, rowClass: 'br-row-final', cellClass: 'br-status-final', title: 'Classificado' },
          { from: 13, to: 14, rowClass: 'br-row-relegated', cellClass: 'br-status-relegated', title: 'Rebaixado' }
        ]
      }
    }
  });

  function liveDbBase(){return String(window.CFF_CONFIG?.firebase?.databaseURL||'').replace(/\/$/,'')}
  let liveCache=null,liveCacheAt=0,livePromise=null;
  async function loadLive(nativeFetch){
    const now=Date.now();
    if(liveCache&&now-liveCacheAt<2500)return liveCache;
    if(livePromise)return livePromise;
    const base=liveDbBase();
    if(!base)return null;
    livePromise=nativeFetch(`${base}/${LIVE_ROOT}.json?v=${now}`,{cache:'no-store'}).then(async r=>{
      if(!r.ok)return null;
      const data=await r.json();liveCache=data||null;liveCacheAt=Date.now();return liveCache;
    }).catch(()=>null).finally(()=>{livePromise=null});
    return livePromise;
  }
  function flattenDrops(stage){
    const out=[];
    const days=stage?.drops||{};
    Object.keys(days).sort((a,b)=>num(a)-num(b)).forEach(day=>{
      const drops=days[day]||{};
      Object.keys(drops).sort((a,b)=>num(a)-num(b)).forEach(drop=>{
        const item=drops[drop];if(item)out.push({...item,day:num(item.day||day),drop:num(item.drop||drop)});
      });
    });
    return out;
  }
  function toEvent(item){
    return {round:num(item.day),day:num(item.day),number:num(item.drop),drop:num(item.drop),map:item.map||'',results:values(item.teams).map(r=>({team:r.team||'',position:num(r.position),placementPoints:num(r.placementPoints),kills:num(r.kills),points:num(r.points),booyah:num(r.booyah)}))};
  }
  function baseRows(stageKey,currentRows){
    const old=new Map((currentRows||[]).map(r=>[normalize(r.team),r]));
    return SECOND_PHASE_SEED.map(seed=>{
      const prev=old.get(normalize(seed.team))||{};
      return {team:seed.team,position:seed.sourcePosition,points:stageKey==='segundaFase'?seed.bonus:0,booyahs:0,kills:0,placementPoints:0,matches:0,...(stageKey==='segundaFase'?{sourcePosition:seed.sourcePosition,bonus:seed.bonus}:{}),worldQualified:Boolean(prev.worldQualified)};
    });
  }
  function computeRows(stageKey,events,currentRows){
    const rows=baseRows(stageKey,currentRows),map=new Map(rows.map(r=>[normalize(r.team),r]));
    events.forEach(event=>values(event.results).forEach(result=>{
      let row=map.get(normalize(result.team));
      if(!row){row={team:result.team,position:null,points:0,booyahs:0,kills:0,placementPoints:0,matches:0};map.set(normalize(result.team),row);rows.push(row)}
      row.points+=num(result.points);row.booyahs+=num(result.booyah)||(num(result.position)===1?1:0);row.kills+=num(result.kills);row.placementPoints+=num(result.placementPoints);row.matches+=1;
    }));
    rows.sort((a,b)=>b.points-a.points||b.booyahs-a.booyahs||b.kills-a.kills||String(a.team).localeCompare(String(b.team),'pt-BR'));
    rows.forEach((r,i)=>r.position=i+1);
    return rows;
  }
  function detectChampion(events){
    const totals=new Map(SECOND_PHASE_SEED.map(x=>[normalize(x.team),0]));
    for(const event of events){
      const eligible=new Set([...totals].filter(([,pts])=>pts>=160).map(([key])=>key));
      const winner=values(event.results).find(r=>num(r.position)===1&&eligible.has(normalize(r.team)));
      if(winner)return winner.team;
      values(event.results).forEach(r=>totals.set(normalize(r.team),(totals.get(normalize(r.team))||0)+num(r.points)));
    }
    return '';
  }
  function mergeStages(payload,live){
    if(!payload||typeof payload!=='object')return payload;
    if(payload.classificatoria&&typeof payload.classificatoria==='object')payload.classificatoria.finished=true;
    if(!payload.segundaFase||typeof payload.segundaFase!=='object')payload.segundaFase={finished:false,bonus:[],rounds:[],rows:[]};
    payload.segundaFase.bonus=SECOND_PHASE_SEED.map(item=>({team:item.team,sourcePosition:item.sourcePosition,bonus:item.bonus}));

    const secondEvents=flattenDrops(live?.segundaFase).map(toEvent);
    if(secondEvents.length){
      payload.segundaFase.rounds=secondEvents.map(({day,...event})=>event);
      payload.segundaFase.rows=computeRows('segundaFase',secondEvents,payload.segundaFase.rows);
      payload.segundaFase.finished=secondEvents.length>=36;
    }else{
      const existingRows=Array.isArray(payload.segundaFase.rows)?payload.segundaFase.rows:[];
      const existingByTeam=new Map(existingRows.map(row=>[normalize(row?.team),row]));
      payload.segundaFase.rows=SECOND_PHASE_SEED.map(item=>{const current=existingByTeam.get(normalize(item.team))||{};const hasMatches=num(current.matches)>0;return {...current,team:item.team,sourcePosition:item.sourcePosition,bonus:item.bonus,position:hasMatches?current.position:item.sourcePosition,points:hasMatches?num(current.points):item.bonus,booyahs:num(current.booyahs),kills:num(current.kills),placementPoints:num(current.placementPoints),matches:num(current.matches)}});
    }

    const finalEvents=flattenDrops(live?.final).map(toEvent);
    if(finalEvents.length){
      if(!payload.final||typeof payload.final!=='object')payload.final={finished:false,days:[],rows:[]};
      const byDay=new Map();
      finalEvents.forEach(event=>{if(!byDay.has(event.day))byDay.set(event.day,[]);byDay.get(event.day).push(({round,...rest})=>rest)});
      payload.final.days=[...byDay].sort((a,b)=>a[0]-b[0]).map(([day,matches])=>({day,matches:matches.sort((a,b)=>num(a.drop)-num(b.drop))}));
      let rows=computeRows('final',finalEvents,payload.final.rows);
      const champion=detectChampion(finalEvents);
      if(champion){const winner=rows.find(r=>normalize(r.team)===normalize(champion));rows=rows.filter(r=>r!==winner);if(winner)rows.unshift(winner);rows.forEach((r,i)=>r.position=i+1);payload.final.champion=champion;payload.final.finished=true}
      else payload.final.finished=finalEvents.length>=16;
      payload.final.rows=rows;payload.final.championRushPoint=160;payload.final.matchesPlayed=finalEvents.length;payload.final.scheduledMaxMatches=16;
    }
    if(live?.segundaFase?.updatedAt||live?.final?.updatedAt)payload.updatedAt=new Date(Math.max(num(live?.segundaFase?.updatedAt),num(live?.final?.updatedAt))).toISOString().slice(0,10);
    return payload;
  }
  function livePlayerAggregates(live,nameRows=[]){
    const out=new Map();
    ['segundaFase','final'].forEach(stageKey=>{
      flattenDrops(live?.[stageKey]).forEach(drop=>values(drop.players).forEach(p=>{
        const meta=canonicalLivePlayer(nameRows,p.name,p.team),canonicalName=meta?.canonicalName||p.name,canonicalTeam=meta?.team||p.team;
        const key=playerKey(canonicalName);if(!key)return;
        if(!out.has(key))out.set(key,{name:canonicalName,team:canonicalTeam,stages:{},days:new Map()});
        const row=out.get(key);row.name=canonicalName||row.name;row.team=canonicalTeam||row.team;
        if(!row.stages[stageKey])row.stages[stageKey]={kills:0,damage:0,assists:0,matches:0,mvp:0};
        const s=row.stages[stageKey];s.kills+=num(p.kills);s.damage+=num(p.damage);s.assists+=num(p.assists);s.matches+=1;s.mvp+=num(p.mvp);
        const dk=`${stageKey}:${drop.day}`;row.days.set(dk,(row.days.get(dk)||0)+num(p.kills));
      }));
    });
    return out;
  }
  async function mergePlayerStats(payload,live,nativeFetch){
    if(!payload||typeof payload!=='object')payload={tournament:'WB 2026 S2',players:{}};
    if(!payload.players||typeof payload.players!=='object')payload.players={};
    const nameRows=await loadPlayerNameRows(nativeFetch);
    const liveAgg=livePlayerAggregates(live,nameRows);
    const keyByNorm=new Map(Object.entries(payload.players).map(([key,p])=>[playerKey(p?.name||key),key]));
    liveAgg.forEach((agg,normKey)=>{
      const key=keyByNorm.get(normKey)||normKey;
      const current=payload.players[key]||{name:agg.name,team:agg.team,kills:0,damage:0,assists:0,matches:0,mvp:0,record:0,stages:{}};
      if(!current.stages||typeof current.stages!=='object')current.stages={};
      ['segundaFase','final'].forEach(stageKey=>{
        const next=agg.stages[stageKey];if(!next)return;
        const old=current.stages[stageKey]||{};
        current.kills=num(current.kills)-num(old.kills)+num(next.kills);
        current.damage=num(current.damage)-num(old.damage)+num(next.damage);
        current.assists=num(current.assists)-num(old.assists)+num(next.assists);
        current.matches=num(current.matches)-num(old.matches)+num(next.matches);
        current.mvp=num(current.mvp)-num(old.mvp)+num(next.mvp);
        current.stages[stageKey]={...next};
      });
      current.name=agg.name||current.name;current.team=agg.team||current.team;current.record=Math.max(num(current.record),0,...agg.days.values());
      payload.players[key]=current;
    });
    const records=Object.values(payload.players);
    const rankField=(field,rankName)=>{const sorted=records.filter(r=>num(r[field])>0).sort((a,b)=>num(b[field])-num(a[field])||String(a.name).localeCompare(String(b.name),'pt-BR'));let last=null,rank=0;sorted.forEach((r,i)=>{const v=num(r[field]);if(v!==last){rank=i+1;last=v}r[rankName]=rank});records.filter(r=>num(r[field])<=0).forEach(r=>r[rankName]=null)};
    rankField('kills','rankKills');rankField('damage','rankDamage');rankField('assists','rankAssists');
    return payload;
  }
  function mergeHome(payload,live,stats){
    if(!payload||typeof payload!=='object')payload={};
    const records=Object.values(stats?.players||{});
    const sorted=(field)=>records.filter(r=>num(r[field])>0).sort((a,b)=>num(b[field])-num(a[field])||String(a.name).localeCompare(String(b.name),'pt-BR')).slice(0,6).map(r=>({player:r.name,name:r.name,team:r.team,kills:num(r.kills),damage:num(r.damage),assists:num(r.assists),matches:num(r.matches),mvp:num(r.mvp)}));
    payload.rankings={...(payload.rankings||{}),kills:sorted('kills'),damage:sorted('damage'),assists:sorted('assists')};payload.players=payload.rankings.kills;
    const stageHolder={segundaFase:{rows:[]},classificatoria:{},final:{}};mergeStages(stageHolder,live);payload.teams=(stageHolder.segundaFase.rows||[]).slice(0,6).map(r=>({...r}));payload.stage='segundaFase';payload.status=stageHolder.segundaFase.finished?'finished':'live';payload.matchesCompleted=flattenDrops(live?.segundaFase).length;payload.daysCompleted=new Set(flattenDrops(live?.segundaFase).map(d=>d.day)).size;
    return payload;
  }

  if(!window.__CFF_2026_S2_LIVE_PATCH__){
    window.__CFF_2026_S2_LIVE_PATCH__=true;
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async(...args)=>{
      const response=await nativeFetch(...args);const input=args[0];const requestUrl=typeof input==='string'?input:(input&&input.url)||'';
      const relevant=/ffws-br-2026-s2\/(?:stages|player-stats|home-results)\.json/i.test(requestUrl);
      if(!relevant||!response.ok)return response;
      try{
        const payload=await response.clone().json();const live=await loadLive(nativeFetch);if(!live)return response;
        if(requestUrl.includes('stages.json'))return jsonResponse(response,mergeStages(payload,live));
        if(requestUrl.includes('player-stats.json'))return jsonResponse(response,await mergePlayerStats(payload,live,nativeFetch));
        if(requestUrl.includes('home-results.json')){
          let stats={players:{}};
          try{const r=await nativeFetch(`ffws-br-2026-s2/player-stats.json?v=20260920-player-stats-base-v1`,{cache:'default'});if(r.ok)stats=await mergePlayerStats(await r.json(),live,nativeFetch)}catch(_){}
          return jsonResponse(response,mergeHome(payload,live,stats));
        }
        return response;
      }catch(error){console.warn('[CFF] Falha ao aplicar dados ao vivo da WB 2026 S2:',error);return response}
    };
  }

  if (document.querySelector('script[data-cff-s2-player-evolution]')) return;
  const script = document.createElement('script');
  script.src = 'js/s2-player-evolution.min.js?v=20260905-s2-player-evolution-v2';
  script.async = true;
  script.dataset.cffS2PlayerEvolution = '1';
  document.head.appendChild(script);
})();