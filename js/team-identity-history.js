// One pure identity model shared by the server and public/admin interfaces.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CFFTeamIdentityHistory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_PERIODS=24,TYPES={origin:'Identidade anterior',rename:'Mudança de nome',logo:'Mudança de escudo',sponsorship:'Patrocínio',merger:'Fusão',absorption:'Absorção',other:'Outra mudança'};
 const today=stamp=>new Date((stamp??Date.now())-10800000).toISOString().slice(0,10);
 const validDate=value=>/^20\d{2}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
 function contextDate(value){const raw=String(value||'').trim();if(validDate(raw))return raw;if(/^20\d{2}$/.test(raw))return raw+'-12-31';if(/^20\d{2}-(0[1-9]|1[0-2])$/.test(raw))return raw+'-01';return '';}
 function select(team={},at){const date=contextDate(at)||today(),history=Array.isArray(team.identityHistory)?team.identityHistory:[];if(!history.length)return team;let period=history[0];for(const item of history.slice(1))if(item.from&&item.from<=date)period=item;return {...team,name:period.name||team.name,logo:period.logo||team.logo,short:period.short||'',currentName:team.currentName||team.name,pageName:team.pageName||team.name,identityPeriod:period.from||'',identityAt:date};}
 function normalize(input){
  if(!Array.isArray(input)||input.length>MAX_PERIODS)throw Error('Use até 24 períodos de identidade.');if(!input.length)return [];
  const clean=(value,max)=>String(value??'').trim().slice(0,max),seen=new Set();
  const rows=input.map((row,index)=>{if(!row||typeof row!=='object')throw Error('Confira os períodos da equipe.');const from=clean(row.from,20),name=clean(row.name,100),type=index?clean(row.type,20)||'rename':'origin';
   if(index===0&&from)throw Error('A identidade anterior deve ficar sem data inicial.');if(index&&(!validDate(from)||seen.has(from)))throw Error('Use datas válidas e diferentes para cada mudança.');if(name.length<2)throw Error('Informe o nome usado em cada período.');if(!TYPES[type])throw Error('Confira o tipo da mudança.');seen.add(from);
   const sourceUrl=clean(row.sourceUrl,1500);if(sourceUrl){let url;try{url=new URL(sourceUrl);}catch{}if(!url||url.protocol!=='https:'||url.username||url.password)throw Error('Use um link HTTPS válido para a fonte.');}
   return {from,name,logo:clean(row.logo,95000)||'escudo.webp',short:clean(row.short,12),type,relatedTeam:clean(row.relatedTeam,100),note:clean(row.note,300),sourceUrl};
  });return [rows[0],...rows.slice(1).sort((a,b)=>a.from.localeCompare(b.from))];
 }
 return {MAX_PERIODS,TYPES,today,validDate,contextDate,select,normalize};
});
