(()=>{
  'use strict';
  if(window.__CFF_2026_S2_LIVE_PATCH__)return;
  window.__CFF_2026_S2_LIVE_PATCH__=true;

  const LIVE_ROOT='ffwsLive/2026-s2';
  const SEED=[
    {team:'LOS',sourcePosition:1,bonus:50},{team:'LOUD SNICKERS',sourcePosition:2,bonus:42},{team:'FLUXO W7M',sourcePosition:3,bonus:35},{team:'INTZ',sourcePosition:4,bonus:29},
    {team:'TEAM SOLID',sourcePosition:5,bonus:24},{team:'RISE GAMING',sourcePosition:6,bonus:19},{team:'ALPHA7',sourcePosition:7,bonus:15},{team:'RUSH GAMING',sourcePosition:8,bonus:11},
    {team:'INFLUENCE RAGE',sourcePosition:9,bonus:8},{team:'CPT VOX',sourcePosition:10,bonus:5},{team:'AFROGAMES',sourcePosition:11,bonus:2},{team:'SX TET',sourcePosition:12,bonus:0}
  ];
  const num=v=>Number(v)||0;
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
  const pkey=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const vals=v=>Array.isArray(v)?v.filter(Boolean):Object.values(v||{}).filter(Boolean);
  const nativeFetch=window.fetch.bind(window);
  let cache=null,cacheAt=0,pending=null;

  function dbBase(){return String(window.CFF_CONFIG?.firebase?.databaseURL||'').replace(/\/$/,'')}
  async function live(){
    if(cache&&Date.now()-cacheAt<2500)return cache;
    if(pending)return pending;
    const base=dbBase();if(!base)return null;
    pending=nativeFetch(`${base}/${LIVE_ROOT}.json?v=${Date.now()}`,{cache:'no-store'}).then(async r=>{if(!r.ok)return null;cache=await r.json();cacheAt=Date.now();return cache}).catch(()=>null).finally(()=>pending=null);
    return pending;
  }
  function flatten(stage){const out=[];const days=stage?.drops||{};Object.keys(days).sort((a,b)=>num(a)-num(b)).forEach(day=>{const drops=days[day]||{};Object.keys(drops).sort((a,b)=>num(a)-num(b)).forEach(drop=>{const item=drops[drop];if(item)out.push({...item,day:num(item.day||day),drop:num(item.drop||drop)})})});return out}
  function event(item){return{round:item.day,day:item.day,number:item.drop,drop:item.drop,map:item.map||'',results:vals(item.teams).map(r=>({team:r.team||'',position:num(r.position),placementPoints:num(r.placementPoints),kills:num(r.kills),points:num(r.points),booyah:num(r.booyah)}))}}
  function rows(stageKey,events,current=[]){
    const old=new Map(current.map(r=>[norm(r.team),r]));
    const list=SEED.map(seed=>{const prev=old.get(norm(seed.team))||{};return{team:seed.team,position:seed.sourcePosition,points:stageKey==='segundaFase'?seed.bonus:0,booyahs:0,kills:0,placementPoints:0,matches:0,...(stageKey==='segundaFase'?{sourcePosition:seed.sourcePosition,bonus:seed.bonus}:{}),worldQualified:Boolean(prev.worldQualified)}}),map=new Map(list.map(r=>[norm(r.team),r]));
    events.forEach(e=>vals(e.results).forEach(result=>{let r=map.get(norm(result.team));if(!r){r={team:result.team,points:0,booyahs:0,kills:0,placementPoints:0,matches:0};map.set(norm(result.team),r);list.push(r)}r.points+=num(result.points);r.booyahs+=num(result.booyah)||(num(result.position)===1?1:0);r.kills+=num(result.kills);r.placementPoints+=num(result.placementPoints);r.matches++}));
    list.sort((a,b)=>b.points-a.points||b.booyahs-a.booyahs||b.kills-a.kills||String(a.team).localeCompare(String(b.team),'pt-BR'));list.forEach((r,i)=>r.position=i+1);return list;
  }
  function detectChampion(events){const total=new Map(SEED.map(s=>[norm(s.team),0]));for(const e of events){const eligible=new Set([...total].filter(([,p])=>p>=160).map(([k])=>k));const win=vals(e.results).find(r=>num(r.position)===1&&eligible.has(norm(r.team)));if(win)return win.team;vals(e.results).forEach(r=>total.set(norm(r.team),(total.get(norm(r.team))||0)+num(r.points)))}return''}
  function mergeStages(payload,data){
    payload=payload&&typeof payload==='object'?payload:{};
    if(payload.classificatoria)payload.classificatoria.finished=true;
    const second=payload.segundaFase||(payload.segundaFase={finished:false,bonus:[],rounds:[],rows:[]});second.bonus=SEED.map(x=>({team:x.team,sourcePosition:x.sourcePosition,bonus:x.bonus}));
    const secondEvents=flatten(data?.segundaFase).map(event);
    if(secondEvents.length){second.rounds=secondEvents.map(({day,...e})=>e);second.rows=rows('segundaFase',secondEvents,second.rows);second.finished=secondEvents.length>=36}else{const old=new Map((second.rows||[]).map(r=>[norm(r.team),r]));second.rows=SEED.map(s=>{const r=old.get(norm(s.team))||{};const played=num(r.matches)>0;return{...r,team:s.team,sourcePosition:s.sourcePosition,bonus:s.bonus,position:played?r.position:s.sourcePosition,points:played?num(r.points):s.bonus,booyahs:num(r.booyahs),kills:num(r.kills),placementPoints:num(r.placementPoints),matches:num(r.matches)}})}
    const finalEvents=flatten(data?.final).map(event);
    if(finalEvents.length){const fin=payload.final||(payload.final={finished:false,days:[],rows:[]}),byDay=new Map();finalEvents.forEach(e=>{if(!byDay.has(e.day))byDay.set(e.day,[]);byDay.get(e.day).push(({round,...rest})=>rest)});fin.days=[...byDay].sort((a,b)=>a[0]-b[0]).map(([day,matches])=>({day,matches:matches.sort((a,b)=>num(a.drop)-num(b.drop))}));let r=rows('final',finalEvents,fin.rows);const champ=detectChampion(finalEvents);if(champ){const w=r.find(x=>norm(x.team)===norm(champ));r=r.filter(x=>x!==w);if(w)r.unshift(w);r.forEach((x,i)=>x.position=i+1);fin.champion=champ;fin.finished=true}else fin.finished=finalEvents.length>=16;fin.rows=r;fin.championRushPoint=160;fin.matchesPlayed=finalEvents.length;fin.scheduledMaxMatches=16}
    return payload;
  }
  function mergeStats(payload,data){
    payload=payload&&typeof payload==='object'?payload:{players:{}};payload.players=payload.players||{};const agg=new Map();
    ['segundaFase','final'].forEach(stageKey=>flatten(data?.[stageKey]).forEach(drop=>vals(drop.players).forEach(p=>{const k=pkey(p.name);if(!k)return;if(!agg.has(k))agg.set(k,{name:p.name,team:p.team,stages:{},days:new Map()});const a=agg.get(k);a.name=p.name||a.name;a.team=p.team||a.team;if(!a.stages[stageKey])a.stages[stageKey]={kills:0,damage:0,assists:0,matches:0,mvp:0};const s=a.stages[stageKey];s.kills+=num(p.kills);s.damage+=num(p.damage);s.assists+=num(p.assists);s.matches++;s.mvp+=num(p.mvp);const dk=`${stageKey}:${drop.day}`;a.days.set(dk,(a.days.get(dk)||0)+num(p.kills))})));
    const byName=new Map(Object.entries(payload.players).map(([k,p])=>[pkey(p?.name||k),k]));agg.forEach((a,n)=>{const key=byName.get(n)||n,r=payload.players[key]||{name:a.name,team:a.team,kills:0,damage:0,assists:0,matches:0,mvp:0,record:0,stages:{}};r.stages=r.stages||{};Object.entries(a.stages).forEach(([sk,next])=>{const old=r.stages[sk]||{};r.kills=num(r.kills)-num(old.kills)+num(next.kills);r.damage=num(r.damage)-num(old.damage)+num(next.damage);r.assists=num(r.assists)-num(old.assists)+num(next.assists);r.matches=num(r.matches)-num(old.matches)+num(next.matches);r.mvp=num(r.mvp)-num(old.mvp)+num(next.mvp);r.stages[sk]={...next}});r.name=a.name||r.name;r.team=a.team||r.team;r.record=Math.max(num(r.record),0,...a.days.values());payload.players[key]=r});
    const recs=Object.values(payload.players),rank=(field,out)=>{const sorted=recs.filter(r=>num(r[field])>0).sort((a,b)=>num(b[field])-num(a[field])||String(a.name).localeCompare(String(b.name),'pt-BR'));let last=null,pos=0;sorted.forEach((r,i)=>{const v=num(r[field]);if(v!==last){pos=i+1;last=v}r[out]=pos});recs.filter(r=>num(r[field])<=0).forEach(r=>r[out]=null)};rank('kills','rankKills');rank('damage','rankDamage');rank('assists','rankAssists');return payload;
  }
  function rosterMeta(payload,name,team){const list=Array.isArray(payload?.players)?payload.players:[],n=pkey(name),t=norm(team);return list.find(p=>norm(p?.team)===t&&[p?.name,p?.sourceName,...(p?.aliases||[])].some(a=>pkey(a)===n))||list.find(p=>[p?.name,p?.sourceName,...(p?.aliases||[])].some(a=>pkey(a)===n))||null}
  function mergePlayers(payload,data){
    if(!payload||typeof payload!=='object'||!Array.isArray(payload.entries))return payload;
    ['segundaFase','final'].forEach(stageKey=>{const ds=flatten(data?.[stageKey]);if(!ds.length)return;payload.entries=payload.entries.filter(e=>String(e?.stage||'')!==stageKey);ds.forEach(drop=>vals(drop.players).forEach(p=>{const meta=rosterMeta(payload,p.name,p.team);payload.entries.push({stage:stageKey,day:drop.day,round:drop.day,drop:drop.drop,map:drop.map||'',name:meta?.name||p.name,team:meta?.team||p.team,kills:num(p.kills),damage:num(p.damage),assists:num(p.assists),matches:1,mvp:num(p.mvp),roleShort:meta?.roleShort||'',country:meta?.country||'',rookie:Boolean(meta?.rookie)})}))});payload.entries.sort((a,b)=>String(a.stage||'').localeCompare(String(b.stage||''))||num(a.day)-num(b.day)||num(a.drop)-num(b.drop)||String(a.team||'').localeCompare(String(b.team||''),'pt-BR')||String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));return payload;
  }
  function cleanRadarStage(stageKey,data){const events=flatten(data?.[stageKey]).map(event);if(!events.length)return null;const r=rows(stageKey,events,[]);return{finished:stageKey==='segundaFase'?events.length>=36:events.length>=16,rows:r.map(x=>({team:x.team||'',position:num(x.position),points:num(x.points),matches:num(x.matches),booyahs:num(x.booyahs),kills:num(x.kills),placementPoints:num(x.placementPoints)}))}}
  function mergeRadar(payload,data){payload=payload&&typeof payload==='object'?payload:{};const second=cleanRadarStage('segundaFase',data),fin=cleanRadarStage('final',data);if(second)payload.segundaFase=second;if(fin)payload.final=fin;payload.status=fin?.finished?'finished':'live';return payload}
  function responseWith(response,payload){const headers=new Headers(response.headers);headers.set('content-type','application/json; charset=utf-8');return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers})}

  window.fetch=async(...args)=>{
    const response=await nativeFetch(...args);const input=args[0],url=typeof input==='string'?input:(input&&input.url)||'';
    if(!response.ok||!/ffws-br-2026-s2\/(?:stages|player-stats|players|radar-summary)\.json/i.test(url))return response;
    try{const data=await live();if(!data)return response;const payload=await response.clone().json();if(url.includes('stages.json'))return responseWith(response,mergeStages(payload,data));if(url.includes('player-stats.json'))return responseWith(response,mergeStats(payload,data));if(url.includes('players.json'))return responseWith(response,mergePlayers(payload,data));if(url.includes('radar-summary.json'))return responseWith(response,mergeRadar(payload,data));return response}catch(error){console.warn('[CFF] Dados ao vivo indisponíveis:',error);return response}
  };
})();
