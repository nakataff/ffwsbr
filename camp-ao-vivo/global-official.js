(function(){
'use strict';
const storage=window.CFF_PUBLIC_STORAGE;let working=false,lastUpdate=0,model=null,template=null,originalLogo=null;
const row=document.createElement('section');row.className='cff-camp-public-live';row.innerHTML='<div><strong>Global Finals 2026 · tabela oficial</strong><small id="cff-global-official-status">Acompanhe os resultados publicados pelo administrador. Alterações aqui são apenas locais.</small></div><button type="button" id="cff-global-official-load" class="cff-camp-btn is-primary">Puxar Mundial oficial</button><label><input type="checkbox" id="cff-global-official-follow"> Acompanhar atualizações (substitui edições locais)</label>';
const command=document.querySelector('.cff-camp-command');if(!command)return;command.after(row);
const style=document.createElement('style');style.textContent='.cff-camp-public-live small{display:block;margin-top:5px}.cff-camp-public-live label{display:flex;align-items:center;gap:8px;color:#b4cce2;font-size:12px}.cff-camp-public-live input{width:auto}';document.head.appendChild(style);
const status=document.getElementById('cff-global-official-status'),button=document.getElementById('cff-global-official-load'),follow=document.getElementById('cff-global-official-follow');
async function json(url){const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw Error('Não foi possível ler a tabela oficial.');return r.json()}
async function update(manual=false){if(working||document.hidden&&!manual)return;working=true;button.disabled=true;
 try{
 const base=String(window.CFF_CONFIG?.firebase?.databaseURL||'').replace(/\/$/,'');if(!base)throw Error('Configuração indisponível.');const summary=await json(base+'/ffwsLive/global-2026/home.json');
 if(!summary?.roundKey)throw Error('Ainda não há resultados do Mundial publicados.');if(!manual&&lastUpdate===summary.updatedAt)return;
 if(!model){[model,template]=await Promise.all([json('/ffws-global-2026/camp-model.json?v=20261104-global-home-v1'),json('/camp-ao-vivo/base.json')]);await import('/js/global-camp-core.js?v=20261104-global-home-v1')}
 const record=await json(base+'/ffwsLive/global-2026/rounds/'+encodeURIComponent(summary.roundKey)+'.json');if(!record)throw Error('Rodada oficial não encontrada.');const C=window.CFF_GLOBAL_CAMP_CORE,valid=C.validate(record,model);
 if(manual&&!confirm('Carregar a rodada oficial mais recente do Mundial? Seu campeonato atual ficará em um backup local.')){follow.checked=false;return;}
 if(manual)storage.setItem('cff_camp_before_global_official_v1',JSON.stringify(window.collectBackupData(true)));
 const backup=C.backup(template,model,summary.roundKey,{[summary.roundKey]:valid},true);
 // Only local editor state is replaced. This module has no write API or admin publisher.
 const previousLogo=originalLogo||(originalLogo=window.getLogo);const officialLogo=function(name){const t=document.getElementById('tournament-name')?.value===backup.config.tournamentName&&C.team(model,name);return t?'/'+t.logo.replace(/^\//,''):previousLogo?.apply(this,arguments)};officialLogo.__cffCampPatched=true;officialLogo.__cffCampOriginal=previousLogo;window.getLogo=officialLogo;try{getLogo=officialLogo}catch(_){}
 await window.CFF_CAMP.applyBackupText(JSON.stringify(backup),'Mundial oficial',false);lastUpdate=summary.updatedAt;status.textContent='Tabela oficial carregada · '+summary.date.split('-').reverse().join('/')+' · '+valid.drops.length+' quedas. Atualizações não publicam alterações no site.';
 }catch(e){status.textContent=e.message;follow.checked=false}finally{working=false;button.disabled=false}
}
button.addEventListener('click',()=>update(true));follow.addEventListener('change',()=>{if(follow.checked)update(true)});setInterval(()=>{if(follow.checked)update()},120000);
})();
