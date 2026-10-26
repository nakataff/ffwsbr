// Optional yearly competitions only. Loaded by the Hall module, no database or polling.
// Data is requested at most once, when the picker is opened or an extra is selected.
(()=>{
'use strict';
const VERSION='20261026-copa-hall-v1';
let data=null,pending=null,error=false;
const families=new Set(['league']);
const labels={league:'LBFF / FFWS Brasil',copa:'Copa FF',ewc:'EWC',global:'Global Series'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function notify(){document.dispatchEvent(new CustomEvent('cff:hall-year-competitions'));}
async function load(){
 if(data)return data;if(pending)return pending;error=false;render();
 pending=fetch('ranking-data/hall-extra-events.json?v='+VERSION,{cache:'default'}).then(async r=>{if(!r.ok)throw Error('Extras indisponíveis');const value=await r.json();if(value.schema!==1||!Array.isArray(value.events))throw Error('Catálogo inválido');data=value;return value;}).catch(()=>{error=true;return null;}).finally(()=>{pending=null;render();notify();});render();return pending;
}
function events(year){return (data?.events||[]).filter(e=>e.year===Number(year)&&families.has(e.family)&&e.rows.length&&e.coverage!=='unavailable');}
function rows(year){return events(year).flatMap(e=>e.rows.map(r=>({key:r[0],name:r[1],team:r[2],k:r[3],q:r[4],ed:e.name,year:e.year,partial:e.coverage==='partial'})));}
function selectedLabel(){return [...families].map(f=>labels[f]).join(' + ')||'Nenhuma';}
function render(year=window.CFF_HALL_YEAR?.year?.()){
 const picker=document.getElementById('hall-year-competitions');if(!picker)return;
 const title=document.getElementById('hall-year-competitions-label');if(title)title.textContent=selectedLabel();
 picker.querySelectorAll('[data-hall-family]').forEach(input=>{const family=input.dataset.hallFamily;input.checked=families.has(family);const available=(data?.events||[]).some(e=>e.year===Number(year)&&e.family===family&&e.rows.length&&e.coverage!=='unavailable');input.disabled=family!=='league'&&!!data&&!available&&!input.checked;let status=input.parentElement.querySelector('small');if(!status){status=document.createElement('small');input.parentElement.append(status);}status.textContent=family==='league'?'padrão':!data?'ver disponibilidade':available?((data.events||[]).some(e=>e.year===Number(year)&&e.family===family&&e.coverage==='partial')?'parcial':'disponível'):'sem dados em '+year;});
 const box=document.getElementById('hall-year-coverage');if(!box)return;
 let text='Somente as competições com dados individuais cadastrados entram na soma. Outros anos e torneios podem estar ausentes.';
 if(pending)text+=' Carregando catálogo de outras competições…';
 if(error)text+=' Não foi possível carregar outras competições. Os dados de LBFF/FFWS Brasil continuam disponíveis.';
 if(data){const included=events(year);text+=' Extras incluídos em '+year+': '+(included.map(e=>e.name+(e.coverage==='partial'?' (parcial)':'')).join(', ')||'nenhum')+'.';
  const absent=[...families].filter(f=>f!=='league'&&!included.some(e=>e.family===f));if(absent.length)text+=' Sem dados neste ano: '+absent.map(f=>labels[f]).join(', ')+'.';
  if(included.some(e=>e.coverage==='partial'))text+=' Copa FF 2026: Geral com 100 linhas exportadas; faltam jogadores. Os totais deste recorte podem estar incompletos.';
 }
 box.innerHTML=esc(text)+(error?' <button type="button" id="hall-year-extra-retry" class="btn-action">Tentar carregar extras</button>':'');
 document.getElementById('hall-year-extra-retry')?.addEventListener('click',load);
 const note=document.querySelector('.hall-year-summary-note');if(note)note.textContent='Líder em abates de cada ano nas competições selecionadas ('+selectedLabel()+'). Clique para ver os números por competição. Dados parciais podem alterar os totais.';
}
function install(){const picker=document.getElementById('hall-year-competitions');if(!picker||picker.dataset.ready)return;picker.dataset.ready='1';picker.addEventListener('toggle',()=>{if(picker.open)load();});picker.querySelectorAll('[data-hall-family]').forEach(input=>input.addEventListener('change',()=>{const f=input.dataset.hallFamily;if(!Object.hasOwn(labels,f))return;input.checked?families.add(f):families.delete(f);notify();render();if(f!=='league'&&!data)load();}));render();}
window.CFF_HALL_YEAR_EXTRAS={install,load,render,rows,events,league:()=>families.has('league'),label:selectedLabel};
})();
