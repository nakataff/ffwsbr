/* Shared calculations for team profiles. Bonuses are excluded from points/round. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CFF_TEAM_PROFILE_MODEL=api})(typeof window==='object'?window:globalThis,()=>{
'use strict';
const n=v=>Number(v)||0;
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const stageNames={classificatoria:'Classificatória',segundaFase:'Segunda fase',final:'Final'};
function rowTotals(rows){return(rows||[]).reduce((a,r)=>({points:a.points+n(r.points??r.pontos)-n(r.bonus),kills:a.kills+n(r.kills??r.abates),booyahs:a.booyahs+n(r.booyahs??r.booyah),matches:a.matches+n(r.matches??r.quedas)}),{points:0,kills:0,booyahs:0,matches:0})}
function rates(t){return{points:t.matches?t.points/t.matches:null,kills:t.matches?t.kills/t.matches:null,booyahs:t.matches?t.booyahs/t.matches*100:null}}
function campaign(stages,name){const own=[],league=[],rounds=[];for(const key of Object.keys(stageNames)){const rows=(stages?.[key]?.rows||[]).filter(r=>n(r.matches??r.quedas)>0),row=rows.find(r=>norm(r.team||r.equipe||r.name)===norm(name));if(row){own.push(row);league.push(...rows);rounds.push({...row,id:key,label:stageNames[key],champion:key==='final'&&norm(stages.final?.champion||stages.final?.confirmedChampion)===norm(name)})}}const totals=rowTotals(own);return{totals,rates:rates(totals),benchmark:rates(rowTotals(league)),rounds}}
function titles(items){const unique=new Map();for(const t of items||[])unique.set(norm(t.event)+'|'+String(t.date||'').slice(0,4),t);return [...unique.values()].sort((a,b)=>(Number(Boolean(b.featured))-Number(Boolean(a.featured)))||(weight(b)-weight(a))||String(b.date||'').localeCompare(String(a.date||'')))}
function weight(t){return({'S-Tier':4,'A-Tier':3,'B-Tier':2,'C-Tier':1})[t.tier]||0}
function year(t){return String(t.date||'').match(/\d{4}/)?.[0]||'Sem data'}
return{norm,campaign,rowTotals,rates,titles,year};
});
