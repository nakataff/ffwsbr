(()=>{
  'use strict';
  const $=id=>document.getElementById(id),num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
  const pad=(v,w)=>String(v)+'\t'.repeat(Math.max(1,Math.ceil((w-String(v).length)/4)));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  let options={ffwsWorlds:false,showLegend:false};
  function restore(data){options={ffwsWorlds:data?.config?.cffFinalWikiV1?.ffwsWorlds===true,showLegend:data?.config?.cffFinalWikiV1?.showLegend===true};syncOptions()}
  function syncOptions(){if($('cff-final-ffws-rule'))$('cff-final-ffws-rule').checked=options.ffwsWorlds;if($('cff-final-worlds-legend'))$('cff-final-worlds-legend').checked=options.showLegend}
  function phaseOf(data){const p=data.config?.cffTournamentPhasesV1;return p?.phases?.find(x=>x.id===p.activeId)}
  function isMultiFinal(data){
    const p=phaseOf(data);if(p&&!/final/i.test(p.name))return false;
    if(!p&&data.config?.tournamentType==='groups')return false;
    return Math.max(Number(p?.days)||0,Number(data.config?.tournamentDays)||1,data.tournamentModeV1?.days?.length||0)>1;
  }
  function dayEntries(data){
    const m=data.tournamentModeV1||{},editing=m.days?.find(d=>d.id===m.editingDayId),number=editing?.number||Number(m.draftDayNumber)||1;
    if(!m.enabled)return[{number:1,snapshot:data,local:false}];
    const saved=(m.days||[]).filter(d=>d.id!==m.editingDayId&&d.number!==number).map(d=>{
      if(!d.editorSnapshot)throw new Error('O Dia '+d.number+' não possui as quedas detalhadas. Importe o backup completo desse dia antes de gerar a final.');
      return{number:d.number,snapshot:d.editorSnapshot,local:true,date:d.date};
    });
    return [...saved,{number,snapshot:data,local:saved.length>0||number>1}].sort((a,b)=>a.number-b.number);
  }
  function mapDate(entry,index){
    const s=entry.snapshot,c=s.config||{},drop=s.drops[index];
    if(c.autoTime===false)return String(drop?.date||c.date||'');
    const settings=c.daySettings||[];let setting,offset=index;
    if(entry.local)setting=settings.find(d=>Number(d.day)===entry.number)||settings[0];
    else{let cursor=0;for(const d of settings){const count=Number(d.count)||0;if(index<cursor+count){setting=d;offset=index-cursor;break}cursor+=count}}
    const raw=String(setting?.start||c.date||entry.date||''),parts=raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})(.*)$/);
    const date=setting?.date||parts?.[1]||raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0]||'',time=setting?.time||parts?.[2]||'';
    if(!date||!time)return String(drop?.date||'');
    const stamp=new Date(date+'T'+time+':00Z');if(!Number.isFinite(stamp.getTime()))return '';
    stamp.setUTCMinutes(stamp.getUTCMinutes()+offset*(Number(c.autoInterval)||30));
    const fuso=setting?.fuso||parts?.[3]?.match(/Abbr\/([^}]+)/)?.[1]||c.defaultAbbr||'BRT';
    return stamp.toISOString().slice(0,16).replace('T',' ')+(c.appendDefaultAbbr===false?'':' {{Abbr/'+fuso+'}}');
  }
  function score(drop,code,detailed){
    let points=num(drop.points?.[code]),kills=num(drop.kills?.[code]),place=drop.booyah===code?1:num(drop.placements?.[code]);
    if(detailed&&typeof resolveDetailedWikiScoreV36==='function'){
      const r=resolveDetailedWikiScoreV36(drop,code);points=num(r.points);kills=num(r.kills);place=num(r.placement);
    }
    if(detailed){
      if(place===null&&points!==null&&kills!==null)place=num(getPlacementFromPlacementPoints(points-kills,!!drop.top12?.[code]));
      if(kills===null&&points!==null&&place!==null){const inferred=points-getPlacementPoints(place);if(inferred>=0)kills=inferred}
      if(points===null&&kills!==null&&place!==null)points=getPlacementPoints(place)+kills;
    }
    return{points,kills,place,valid:place!==null&&kills!==null&&place>=1&&place<=12};
  }
  function model(data){
    const c=data.config||{},entries=dayEntries(data),m=data.tournamentModeV1||{},codes=[...new Set([...(m.enabled?m.rosterCodes||[]:[]),...(data.selectedTeams||[]),...entries.flatMap(e=>e.snapshot.selectedTeams||[])])];
    const detailed=c.detailMode==='detailed',champion=c.finalMode==='champion'||(c.finalMode!=='classic'&&c.championEnabled!==false),cp=Number(c.cp)||160;
    const bonusEntry=entries.find(e=>e.snapshot.config?.startingEnabled),hasBonus=!!bonusEntry;
    const rows=codes.map(code=>({code,total:hasBonus?(num(bonusEntry.snapshot.startingPoints?.[code])||0):0,starting:hasBonus?(num(bonusEntry.snapshot.startingPoints?.[code])||0):0,matches:0,booyahs:0,placement:0,kills:0,lastPlace:Infinity,lastPoints:-Infinity,unknownKills:false,unknownPlacement:false}));
    const byCode=new Map(rows.map(r=>[r.code,r])),maps=[];let winner=null,winnerMatch=0;
    for(const entry of entries){
      let drops=entry.snapshot.drops||[],last=-1;
      drops.forEach((d,i)=>{if(codes.some(code=>score(d,code,detailed).points!==null))last=i});
      // The unlimited editor keeps an empty next slot; it is not a played map.
      const unlimited=entry.snapshot.config?.v68ChampionRushUnlimited||(champion&&phaseOf(data)?.unlimited&&entry.number>1);
      if(last>=0&&unlimited)drops=drops.slice(0,last+1);
      // A reopened fixed Day 1 can retain the unlimited editor's empty next slot.
      const fixedFirst=Number(phaseOf(data)?.firstDrops)||Number(entry.snapshot.config?.quedas)||0;
      if(entry.local&&entry.number===1&&fixedFirst>0)drops=drops.slice(0,Math.max(fixedFirst,last+1));
      for(let i=0;i<drops.length;i++){
        const d=drops[i],scores=new Map(codes.map(code=>[code,score(d,code,detailed)])),before=byCode.get(d.booyah)?.total||0;
        const played=[...scores.values()].some(s=>s.points!==null);
        if(champion&&!winner&&d.booyah&&scores.get(d.booyah)?.valid&&before>=cp){winner=d.booyah;winnerMatch=maps.length+1}
        maps.push({drop:d,date:mapDate(entry,i),scores,played});
        scores.forEach((s,code)=>{if(s.points===null)return;const r=byCode.get(code);r.total+=s.points;r.matches++;r.lastPlace=s.place??Infinity;r.lastPoints=s.points;if(s.place===1)r.booyahs++;
          if(!detailed)return;if(s.kills!==null){r.kills+=s.kills;r.placement+=s.points-s.kills}else{r.unknownKills=true;if(s.place!==null)r.placement+=getPlacementPoints(s.place);else r.unknownPlacement=true}
        });
        if(winner)break;
      }
      if(winner)break;
    }
    const order=c.tiebreakOrder||['booyah','kills','lastdrop'],key={booyah:'booyahs',kills:'kills',placementPoints:'placement',placement:'placement',lastdrop:'lastPlace'};
    const names=new Map(String(data.teams||'').split('\n').map(line=>{const [name,code]=line.split(',').map(v=>v.trim());return[code,name]}));
    rows.sort((a,b)=>{
      let d=b.total-a.total;if(d)return d;
      const manual=c.tieManualPriority||{},ap=Number(manual[a.code])||0,bp=Number(manual[b.code])||0;if(ap||bp)return bp-ap;
      if(c.tiebreakAutoEnabled!==false)for(const k of order){const name=key[k]||k;d=name==='lastPlace'?a.lastPlace-b.lastPlace:(b[name]||0)-(a[name]||0);if(!Number.isNaN(d)&&d)return d;if(name==='lastPlace'){d=b.lastPoints-a.lastPoints;if(!Number.isNaN(d)&&d)return d}}
      return String(names.get(a.code)||a.code).localeCompare(String(names.get(b.code)||b.code),'pt-BR');
    });
    const natural=[...rows].sort((a,b)=>b.total-a.total);if(winner){const i=rows.findIndex(r=>r.code===winner);rows.unshift(...rows.splice(i,1))}
    const hasScores=rows.some(r=>r.matches>0),p=phaseOf(data),days=Number(p?.days)||Number(c.tournamentDays)||1;
    const scheduledFull=!m.enabled||(entries.length===1&&(c.daySettings||[]).length>=days&&(c.daySettings||[]).reduce((n,d)=>n+(Number(d.count)||0),0)<=maps.length);
    const finished=!!winner||(!champion&&(entries.at(-1).number>=days||scheduledFull)&&maps.length>0&&maps.every(x=>codes.every(code=>x.scores.get(code).points!==null)));
    const already=code=>['loud','loudsnickers','los'].includes(norm(code))||['loud','loudsnickers','los'].includes(norm(names.get(code)));
    const eligible=hasScores?rows.find(r=>!already(r.code)&&r.matches>0)?.code:null;
    return{data,rows,natural,maps,detailed,champion,cp,winner,winnerMatch,hasScores,hasBonus,finished,eligible,already};
  }
  function backgrounds(m){
    const cfg=m.data.config||{},rules=cfg.bgEnabled?(cfg.bgRules||[]).map(r=>({pos:r.pos,bg:r.bg})):[];
    if(!options.ffwsWorlds)return rules.filter(r=>r.pos&&r.bg).map(r=>r.pos+'='+r.bg).join(',');
    const values=new Map();for(const rule of rules)for(const part of String(rule.pos||'').split(',')){const [a,b]=part.split('-').map(Number);for(let i=a;i<=(b||a)&&i<=m.rows.length;i++)values.set(i,rule.bg)}
    m.rows.forEach((r,i)=>{if(m.already(r.code)||(m.finished&&r.code===m.eligible))values.set(i+1,'up');if(m.winner===r.code)values.set(i+1,'trophy')});
    return [...values].filter(([,v])=>v).map(([i,v])=>i+'='+v).join(',');
  }
  function build(data){
    const m=model(data),bg=backgrounds(m),title=m.champion?'Champion Rush':'Final',cfg=data.config||{};
    const rounds=[['Match Played',r=>r.matches],['[[File:Free Fire Booyah! allmode.png|55px]]',r=>r.booyahs]];
    if(m.detailed)rounds.push(['Place Points',r=>r.unknownPlacement?null:r.placement],['Kill Points',r=>r.unknownKills?null:r.kills]);else rounds.push(['Points',r=>r.total-r.starting]);
    if(m.hasBonus)rounds.push(['Headstart Points',r=>r.starting]);
    let overview=`{{FfaStandings|title=${title} Standings Overview|import=false|tiebreakers=["manual","points"]${bg?'|bg='+bg:''}\n`;
    rounds.forEach(([label],i)=>overview+=`|round${i+1}={{Round|title=${pad(label,64)}|started=${m.hasScores?'true':'false'}|finished=${m.finished?'true':'false'}}}\n`);
    m.rows.forEach((r,i)=>{const vals=rounds.map(([,get])=>get(r)),correction=r.total-vals.reduce((n,x)=>n+(x??0),0);overview+=`|{{TeamOpponent|${pad(r.code,36)}|${vals.map((v,j)=>'r'+(j+1)+'='+(v??'')).join('\t|')}\t|startingpoints=${correction}\t|tiebreaker=${m.rows.length-i}}}\n`});overview+='}}';
    let match=`|R1M1={{Match|finished=${m.finished?'true':'false'}${m.champion?'|matchpoint='+m.cp:''}${bg?'|bg='+bg:''}|showgamedetails=${m.detailed?'true':'false'}\n    |p_kill=1 |p1=12 |p2=9 |p3=8 |p4=7 |p5=6 |p6=5 |p7=4 |p8=3 |p9=2 |p10=1 |p11=0 |p12=0\n    |twitch=|youtube=${data.tournamentModeV1?.config?.wikiYoutube||''}\n`;
    const extra=String(cfg.matchExtra||'').trim().replace(/^\|/,'');if(extra)match+='    |'+extra.replace(/(?:^|\|)bg=[^|]*/g,'').replace(/^\|/,'')+'\n';
    if(m.winner)match+=`    |comment='''Note:''' {{Team|${m.winner}}} won through Champion Rush after Booyah at Match ${m.winnerMatch}.${options.ffwsWorlds&&m.eligible?' {{Team|'+m.eligible+'}} qualified for the World Championship as the highest-placed team other than LOUD and LOS.':''}\n`;
    m.maps.forEach((x,i)=>{const d=x.drop,map=typeof normalizeWikiMapName==='function'?normalizeWikiMapName(d.map||''):d.map||'';match+=`    |map${i+1}={{Map|date=${x.date}|finished=${x.played?'true':'false'}|map=${pad(map,16)}${d.mvp?'|mvp='+d.mvp:''}${d.mvppoint?'|mvppoint='+d.mvppoint:''}|vod=${d.vod||''}}}\n`});
    m.rows.forEach((r,i)=>{
      const tied=m.hasScores&&m.rows.some(o=>o.code!==r.code&&o.total===r.total),shifted=m.winner&&m.natural.findIndex(o=>o.code===r.code)!==i;
      const placement=m.winner===r.code||shifted||tied?'|placement='+(i+1):'';
      match+=`\n    |opponent${i+1}={{TeamOpponent|${r.code}${m.hasBonus&&r.starting?'|startingpoints='+r.starting:''}${placement}\n`;
      const parts=m.maps.map((x,j)=>{const s=x.scores.get(r.code);return`m${j+1}={{MS|${m.detailed?(s.valid?s.place+'|'+s.kills:(s.place!==null&&x.drop.unknownKills?.[r.code]?s.place+'| ':' | ')):'p='+(s.points??'  ')}}}`});
      for(let j=0;j<parts.length;j+=6)match+='        |'+parts.slice(j,j+6).join('\t|')+'\n';match+='        }}\n';
    });match+='}}\n';
    const id=typeof getOrCreateMatchlistId==='function'?getOrCreateMatchlistId():cfg.matchlistId||'finals';
    return `{{box|start}}{{Tabs dynamic|name1=Overview Standings|icon1=matchpagelink|name2=Detailed Standings|icon2=standings|hide-showall=true|This=2}}<!--\nOverview\n-->{{Tabs dynamic/tab|1}}\n${overview}\n<!--\nDetailed\n-->{{Tabs dynamic/tab|2}}\n{{Bracket|Bracket/2|id=${id}\n|R1M1header=${title}\n${match}}}\n{{Tabs dynamic/end}}\n{{box|end}}`;
  }
  function output(text){for(const id of ['output-code','v41-simple-output'])if($(id))$(id).value=text;const field=$('output-code');field?.focus();field?.select();try{document.execCommand('copy')}catch(_){}return text}
  const collect=window.collectBackupData;
  restore(window.__CFF_CAMP_INITIAL_BACKUP__||collect(true));
  window.collectBackupData=function(){const data=collect.apply(this,arguments);data.config.cffFinalWikiV1={...options};return data};try{collectBackupData=window.collectBackupData}catch(_){}
  const importBackupOriginal=window.importBackup;
  window.importBackup=function(){let data;try{data=JSON.parse($('backup-input').value)}catch(_){}const result=importBackupOriginal.apply(this,arguments);if(data)restore(data);return result};try{importBackup=window.importBackup}catch(_){}
  const originalGenerate=window.generateLiquipedia;
  window.generateLiquipedia=function(){
    const data=window.collectBackupData(true),cfg=data.config||{},traditional=cfg.finalMode==='champion'&&cfg.championOutputMode==='traditional',scoped=cfg.finalMode==='classic'&&['full','fragment'].includes(cfg.v43WikiScope?.mode);
    if(!isMultiFinal(data)||traditional||scoped)return originalGenerate.apply(this,arguments);
    try{const text=output(build(data));window.CFF_CAMP?.toast?.('Final completa gerada: Overview + Detailed.');return text}catch(e){window.CFF_CAMP?.toast?.(e.message,'err');return false}
  };try{generateLiquipedia=window.generateLiquipedia}catch(_){}
  const ui=document.createElement('section');ui.id='cff-final-wiki-settings';ui.innerHTML='<h3>Código Wiki da final</h3><p>Finais de mais de um dia usam Overview + Detailed, com todos os dias salvos e o dia aberto.</p><label><input id="cff-final-ffws-rule" type="checkbox">Aplicar regra FFWS BR — vaga no Mundial</label><p>Classifica o melhor colocado da final além de LOUD e LOS, respeitando o campeão do Champion Rush. Antes do fim, a indicação é provisória.</p><label><input id="cff-final-worlds-legend" type="checkbox">Exibir legenda da vaga na tabela geral</label><output id="cff-final-worlds-status"></output><button id="cff-final-wiki-day" class="btn-mini" type="button">Gerar apenas o bloco do dia</button>';
  $('cff-admin-rule-settings').before(ui);syncOptions();
  ui.addEventListener('change',()=>{options.ffwsWorlds=$('cff-final-ffws-rule').checked;options.showLegend=$('cff-final-worlds-legend').checked;window.autoSave?.(true);updateRule()});
  $('cff-final-wiki-day').addEventListener('click',()=>originalGenerate());
  function updateRule(){
    const data=options.ffwsWorlds?window.collectBackupData(true):null,enabled=options.ffwsWorlds&&isMultiFinal(data);let m;
    if(enabled)try{m=model(data)}catch(_){}
    const text=m?.eligible?(m.finished?'Vaga no Mundial: ':'Vaga provisória: ')+m.eligible.toUpperCase():'Aguardando resultados da final.';
    if($('cff-final-worlds-status'))$('cff-final-worlds-status').textContent=enabled?text:'';
    const overall=document.body.classList.contains('v76-overall-view');
    document.querySelectorAll('.cff-final-worlds-marker').forEach(el=>{if(!enabled||!overall)el.remove()});
    if(enabled&&overall&&m){document.querySelectorAll('#summary-tbody tr[data-team-code]').forEach(row=>{
      const code=row.dataset.teamCode,on=m.already(code)||code===m.eligible;let mark=row.querySelector('.cff-final-worlds-marker');
      if(!on){mark?.remove();return}if(!mark){mark=document.createElement('span');mark.className='cff-final-worlds-marker';mark.textContent=' ✈';row.querySelector('.td-team')?.append(mark)}mark.title=m.already(code)?'Vaga no Mundial garantida':text;
    })}
    let legend=$('cff-final-worlds-summary');if(enabled&&overall&&options.showLegend){if(!legend){legend=document.createElement('div');legend.id='cff-final-worlds-summary';$('table-print-area').append(legend)}legend.textContent='✈ LOUD e LOS classificadas • '+text}else legend?.remove();
  }
  const style=document.createElement('style');style.textContent='#cff-final-wiki-settings{padding:14px;border:1px solid #294054;border-radius:10px;margin-bottom:14px}#cff-final-wiki-settings h3{font-size:.85rem;margin:0 0 8px}#cff-final-wiki-settings p{font-size:.75rem;color:#9cb5ca;line-height:1.5}#cff-final-wiki-settings label{flex-direction:row!important;align-items:center;margin:10px 0}#cff-final-worlds-status{display:block;color:#ffd15a;font-size:.78rem;margin:10px 0}#cff-final-worlds-summary{color:#ffd15a;padding:10px;font-size:.8rem}.cff-final-worlds-marker{color:#ffd15a;font-weight:900}';document.head.append(style);
  window.CFF_FINAL_WIKI={model,build,isMultiFinal,getOptions:()=>({...options})};
  let refresh=0;const scheduleRule=()=>{if(!refresh)refresh=requestAnimationFrame(()=>{refresh=0;updateRule()})};
  if($('summary-tbody'))new MutationObserver(scheduleRule).observe($('summary-tbody'),{childList:true});
  setInterval(updateRule,1500);window.addEventListener('v76:tournament-state',scheduleRule);updateRule();
})();
