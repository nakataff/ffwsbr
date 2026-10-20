// Editor local do ranking anual: usa somente os resumos estaticos publicados.
// Sem credenciais, Firebase, gravacao remota ou recalculo para visitantes.
const $=id=>document.getElementById(id);
const YEARS=[2026,2025];
const BANDS=[[1,1],[2,2],[3,3],[4,4],[5,6],[7,8],[9,10],[11,12],[13,18],[19,24]];
const EVENT_LABELS={copa:'Copa FF',s1:'FFWS BR S1',s2:'FFWS BR S2',ewc:'EWC',global:'Global Finals'};
const original=new Map(),drafts=new Map();
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const format=value=>Number(value).toLocaleString('pt-BR',{maximumFractionDigits:2});
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let year=2026,ready=false,busy=false,invalid=false;
function altered(y){
  const old=original.get(y).source,now=drafts.get(y);
  return JSON.stringify([old.basePoints,old.weights])!==JSON.stringify([now.basePoints,now.weights]);
}
function apply(callback){
  callback(drafts.get(year));
  if($('sync').checked)callback(drafts.get(year===2026?2025:2026));
}
function recompute(y){
  const saved=original.get(y).ranking,conf=drafts.get(y);
  const active=saved.events.filter(e=>e.status==='finished');
  const rows=saved.rows.map(row=>{
    const results=row.results.map(r=>({event:r.event,position:r.position,points:conf.basePoints[r.position-1]*conf.weights[r.event]}));
    return {...row,results,total:results.reduce((sum,r)=>sum+r.points,0),oldTotal:row.total,oldRank:row.rank};
  });
  function tie(row){
    return [row.total,row.results.find(r=>r.event==='global')?.position??999,row.results.find(r=>r.event==='ewc')?.position??999,row.results.filter(r=>(r.event==='s1'||r.event==='s2')&&r.position===1).length];
  }
  rows.sort((a,b)=>{
    const x=tie(a),z=tie(b);
    return z[0]-x[0]||x[1]-z[1]||x[2]-z[2]||z[3]-x[3]||a.team.localeCompare(b.team,'pt-BR');
  });
  let last='',rank=0;
  rows.forEach((row,index)=>{const key=JSON.stringify(tie(row));if(key!==last)rank=index+1;row.rank=rank;last=key;});
  return {rows,active};
}
function weights(){
  const conf=drafts.get(year);
  $('weights').innerHTML=Object.entries(EVENT_LABELS).map(([id,name])=>
    '<label class="weight"><strong>'+name+'</strong><span>Peso multiplicador</span><input type="number" min="0" max="100" step="1" aria-label="Peso '+name+'" data-weight="'+id+'" value="'+conf.weights[id]+'"></label>'
  ).join('');
}
function bands(){
  const conf=drafts.get(year);
  $('bands').innerHTML=BANDS.map(([from,to],i)=>{
    const label=from===to?from+'º':from+'º–'+to+'º';
    const base=conf.basePoints[from-1];
    return '<tr><th scope="row">'+label+'</th><td><input type="number" min="0" max="10000" step="1" aria-label="Pontos base '+label+'" data-band="'+i+'" value="'+base+'"></td>'+
      ['copa','s1','ewc','global'].map(id=>'<td data-score="'+i+':'+id+'">'+format(base*conf.weights[id])+'</td>').join('')+'</tr>';
  }).join('');
}
function preview(){
  const {rows,active}=recompute(year),diffCount=rows.filter(r=>r.rank!==r.oldRank).length;
  $('preview-info').textContent=rows.length+' equipes · '+active.length+' torneios concluídos · '+diffCount+' equipes mudam de posição';
  $('preview').innerHTML=rows.slice(0,15).map(r=>{
    const points=r.total-r.oldTotal,delta=points===0?'—':(points>0?'+':'')+format(points);
    const cls=points>0?'up':points<0?'down':'';
    const move=r.rank<r.oldRank?' ↑'+(r.oldRank-r.rank):r.rank>r.oldRank?' ↓'+(r.rank-r.oldRank):'';
    return '<tr><td>'+r.rank+'º</td><td>'+escapeHtml(r.team)+'<small class="'+(r.rank<r.oldRank?'up':r.rank>r.oldRank?'down':'')+'">'+move+'</small></td><td><strong>'+format(r.total)+'</strong></td><td class="'+cls+'">'+delta+'</td></tr>';
  }).join('');
}
function updateButtons(){
  $('download').disabled=!ready||busy||invalid||!altered(year);
  $('download-both').disabled=!ready||busy||invalid||!YEARS.some(altered);
  const changed=YEARS.filter(altered);
  $('download-both').textContent='Baixar anos alterados'+(changed.length?' ('+changed.join(' e ')+')':'');
  if(!invalid&&ready)$('status').textContent=changed.length? 'Prévia local: '+changed.join(' e ')+'. Nada foi publicado.':'Nenhuma alteração pendente. Mude uma pontuação para começar.';
}
function render(){
  if(!ready)return;
  $('year').value=String(year);
  weights();bands();preview();invalid=false;updateButtons();
}
function verify(value,kind){
  const max=kind==='weight'?100:10000;
  return value.trim()!==''&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=max;
}
function recalcVisible(){
  const conf=drafts.get(year);
  for(const td of document.querySelectorAll('[data-score]')){
    const [band,id]=td.dataset.score.split(':'),from=BANDS[Number(band)][0];
    td.textContent=format(conf.basePoints[from-1]*conf.weights[id]);
  }
  preview();invalid=false;updateButtons();
}
function download(y){
  const conf=structuredClone(drafts.get(y));
  if(!altered(y))return false;
  conf.methodVersion=original.get(y).source.methodVersion+1;
  conf.updatedAt=today();
  const blob=new Blob([JSON.stringify(conf,null,2)+'\n'],{type:'application/json;charset=utf-8'});
  const href=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=href;link.download='brasil-'+y+'-source.json';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
  return true;
}
async function boot(){
  try{
    await Promise.all(YEARS.map(async y=>{
      const [a,b]=await Promise.all([
        fetch('/ranking-data/brasil-'+y+'-source.json',{cache:'no-cache'}),
        fetch('/ranking-data/brasil-'+y+'.json',{cache:'no-cache'})
      ]);
      if(!a.ok||!b.ok)throw Error('Falha HTTP ao carregar '+y);
      const source=await a.json(),ranking=await b.json();
      if(source.year!==y||ranking.year!==y||!Array.isArray(source.basePoints)||source.basePoints.length!==24||!ranking.rows?.length)throw Error('Dados inválidos de '+y);
      if(Object.keys(EVENT_LABELS).some(key=>!Number.isInteger(source.weights[key])||source.weights[key]<0))throw Error('Pesos inválidos de '+y);
      original.set(y,{source,ranking});drafts.set(y,structuredClone(source));
    }));
    ready=true;render();
  }catch(err){
    $('status').textContent='Não foi possível iniciar o editor: '+err.message+'. Recarregue a página.';
    $('status').className='bad';
  }
}
$('year').addEventListener('change',event=>{year=Number(event.target.value);render();});
$('sync').addEventListener('change',()=>{if($('sync').checked&&ready){
  // Habilitar a sincronizacao nao altera dados retroativamente.
  $('status').textContent='Sincronização ativada. As próximas edições serão aplicadas aos dois anos.';
}});
$('reset').addEventListener('click',()=>{
  if(!ready)return;
  for(const y of ($('sync').checked?YEARS:[year])){
    const src=original.get(y).source,conf=drafts.get(y);
    conf.basePoints=[...src.basePoints];conf.weights={...src.weights};
  }
  render();
});
document.addEventListener('input',event=>{
  const input=event.target;
  if(!ready||!input.matches('[data-weight],[data-band]'))return;
  const kind=input.hasAttribute('data-weight')?'weight':'band';
  if(!verify(input.value,kind)){
    invalid=true;$('status').className='bad';
    $('status').textContent='Informe números inteiros entre 0 e '+(kind==='weight'?'100':'10.000')+'.';
    $('download').disabled=true;$('download-both').disabled=true;return;
  }
  $('status').className='';
  const value=Number(input.value),id=input.dataset.weight,band=Number(input.dataset.band);
  apply(conf=>{
    if(kind==='weight')conf.weights[id]=value;
    else {const [from,to]=BANDS[band];for(let p=from;p<=to;p++)conf.basePoints[p-1]=value;}
  });
  recalcVisible();
});
$('download').addEventListener('click',()=>{if(!ready||invalid)return;download(year);});
$('download-both').addEventListener('click',()=>{
  if(!ready||invalid)return;
  // Um gesto do usuario para cada arquivo, sem senha de GitHub no navegador.
  const count=YEARS.filter(download).length;
  if(count>1)$('status').textContent='Arquivos preparados. Se apenas um foi baixado, libere downloads múltiplos no navegador ou baixe um ano de cada vez.';
});
boot();
