(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/0/g,'O').replace(/[^a-z0-9]/gi,'').toUpperCase();
const num=value=>Number(value)||0;
const compare=(a,b)=>String(a).localeCompare(String(b),'pt-BR',{sensitivity:'base',numeric:true});
const yearOf=edition=>{const s=String(edition||'');const y=s.match(/\b20\d{2}\b/);if(y)return Number(y[0]);const m=s.match(/^LBFF\s+(\d+)/i);const n=m?Number(m[1]):0;return n<=3&&n>0?2020:n<=6&&n>0?2021:n<=8&&n>0?2022:n===9?2023:0;};
const orderEdition=edition=>{const y=yearOf(edition);const m=String(edition).match(/^LBFF\s+(\d+)/i);if(m)return 201900+Number(m[1]);const t=String(edition).match(/\b([SF])\s*(\d+)\b/i);return y*100+(/F/i.test(t?.[1]||'')?10:30)+Number(t?.[2]||0);};
const fieldDefs=Object.freeze([
 {key:'name',label:'Jogador',width:23},{key:'team',label:'Equipe',width:25},
 {key:'kills',label:'Abates',width:12},{key:'matches',label:'Quedas',width:12},
 {key:'avg',label:'Média',width:13},{key:'edition',label:'Edição',width:18},
 {key:'year',label:'Ano',width:12},{key:'position',label:'Posição no torneio',width:22}
]);
const state={ready:false,bootPromise:null,rows:[],players:new Map(),editions:[],maxMatches:new Map(),evoMetric:'avg',evoMin:true,evoSearch:'',evoPage:0,evoSize:10,chosen:new Set(),filteredName:'',chosenEditions:new Set(),fields:fieldDefs.map(f=>({...f,active:true})),sort:'player-asc',layout:'single',placements:{},exportBusy:false};
const numFmt=value=>num(value).toLocaleString('pt-BR');
const avgFmt=value=>num(value).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
function setNote(id,message,error=false){const el=$(id);if(el){el.textContent=message;el.classList.toggle('is-error',error);}}
function buildRows(hall){
 const rows=[],players=new Map(),maxMatches=new Map();
 for(const [edition,list] of hall.editionRows){
  let high=0;
  for(const r of list||[]){
   if(!r.q&&!r.k)continue;
   const key=String(r.key||norm(r.name)),data={
    key,name:String(r.name||r.currentName||''),team:String(r.team||''),
    edition,year:yearOf(edition),order:orderEdition(edition),
    kills:num(r.k),matches:num(r.q),avg:num(r.q)?num(r.k)/num(r.q):0
   };
   if(!data.name)continue;
   rows.push(data);
   if(!players.has(key))players.set(key,data.name);
   high=Math.max(high,data.matches);
  }
  maxMatches.set(edition,high);
 }
 state.rows=rows;
 state.players=players;
 state.maxMatches=maxMatches;
 state.editions=[...new Set(rows.map(r=>r.edition))].sort((a,b)=>orderEdition(a)-orderEdition(b)||compare(a,b));
 state.chosenEditions=new Set(state.editions);
}
function progressionRows(metric=state.evoMetric,required=state.evoMin,search=state.evoSearch){
 const grouped=new Map();
 for(const row of state.rows){const list=grouped.get(row.key)||[];list.push(row);grouped.set(row.key,list);}
 const out=[],filter=norm(search);
 for(const list of grouped.values()){
  list.sort((a,b)=>a.order-b.order||compare(a.edition,b.edition));
  if(list.length<2)continue;
  let best=null;
  for(let i=1;i<list.length;i++){
   const before=list[i-1],after=list[i];
   if(required){
    const beforeRequired=Math.ceil(num(state.maxMatches.get(before.edition))/2);
    const afterRequired=Math.ceil(num(state.maxMatches.get(after.edition))/2);
    if(!beforeRequired||!afterRequired||before.matches<beforeRequired||after.matches<afterRequired)continue;
   }
   const difference=after[metric]-before[metric];
   if(difference<=0)continue;
   const result={key:after.key,name:after.name,before,after,difference,percent:before[metric]>0?difference/before[metric]*100:null};
   if(!best||difference>best.difference||difference===best.difference&&after.order>best.after.order)best=result;
  }
  if(best&&(!filter||[best.name,best.before.team,best.after.team,best.before.edition,best.after.edition].some(s=>norm(s).includes(filter))))out.push(best);
 }
 out.sort((a,b)=>b.difference-a.difference||b.after[metric]-a.after[metric]||compare(a.name,b.name));
 return out;
}
function renderEvolution(){
 const root=$('hall-evolution-results'),mobile=$('hall-evolution-mobile');
 if(!root||!mobile||!state.ready)return;
 const rows=progressionRows(),pages=Math.max(1,Math.ceil(rows.length/state.evoSize));
 state.evoPage=Math.max(0,Math.min(state.evoPage,pages-1));
 const start=state.evoPage*state.evoSize,shown=rows.slice(start,start+state.evoSize);
 const metric=state.evoMetric,fmt=metric==='avg'?avgFmt:numFmt;
 root.innerHTML=shown.map((r,i)=>{
  const change=fmt(r.difference),percent=r.percent!==null?' ('+avgFmt(r.percent)+'%)':'';
  return '<tr><td>'+(start+i+1)+'</td><td class="hall-evo-name">'+esc(r.name)+'<small>'+esc(r.before.team||'Equipe não registrada')+' → '+esc(r.after.team||'Equipe não registrada')+'</small></td>'+
   '<td class="hall-evo-editions">'+esc(r.before.edition)+' → '+esc(r.after.edition)+'</td><td>'+fmt(r.before[metric])+'</td><td>'+fmt(r.after[metric])+'</td>'+
   '<td class="hall-evo-change">+'+change+'<small>'+esc(percent)+'</small></td></tr>';
 }).join('')||'<tr><td colspan="6" class="hall-tool-empty">Nenhuma evolução encontrada com estes filtros.</td></tr>';
 mobile.innerHTML=shown.map((r,i)=>'<article class="hall-evo-mobile-card"><div class="hall-evo-mobile-head"><span>#'+(start+i+1)+' · '+esc(r.name)+'</span><strong>+'+fmt(r.difference)+'</strong></div>'+
  '<p>'+esc(r.before.edition)+' → '+esc(r.after.edition)+'</p><small>'+esc(r.before.team||'Equipe não registrada')+' → '+esc(r.after.team||'Equipe não registrada')+'</small>'+
  '<div class="hall-evo-mobile-metrics"><span>Antes: '+fmt(r.before[metric])+'</span><span>Depois: '+fmt(r.after[metric])+'</span></div></article>').join('')||'<p class="hall-tool-empty">Nenhuma evolução encontrada com estes filtros.</p>';
 $('hall-evolution-info').textContent=rows.length?'Top '+(start+1)+'–'+Math.min(start+state.evoSize,rows.length)+' de '+rows.length+' jogadores':'Nenhum jogador encontrado';
 $('hall-evolution-prev').disabled=state.evoPage===0;
 $('hall-evolution-next').disabled=state.evoPage>=pages-1;
 $('hall-evolution-metric').value=state.evoMetric;
 $('hall-evolution-min').checked=state.evoMin;
}
function visiblePlayerChoices(){
 const search=norm(state.filteredName);
 return [...state.players].filter(([key,name])=>!search||norm(name).includes(search)||key.includes(search)).sort((a,b)=>compare(a[1],b[1]));
}
function renderPeople(){
 if(!state.ready)return;
 const list=visiblePlayerChoices(),show=list.slice(0,12);
 $('hall-export-people').innerHTML=show.map(([key,name])=>'<label class="hall-export-person"><input type="checkbox" data-hall-person="'+esc(key)+'" '+(state.chosen.has(key)?'checked':'')+'><span>'+esc(name)+'</span></label>').join('')||'<p class="hall-tool-empty">Nenhum jogador encontrado.</p>';
 $('hall-export-people-more').textContent=list.length>show.length?'Exibindo 12 de '+list.length+' encontrados. Refine a busca para localizar outros.':'';
 const names=[...state.chosen].map(key=>[key,state.players.get(key)]).filter(pair=>pair[1]).sort((a,b)=>compare(a[1],b[1]));
 $('hall-export-selected-count').textContent=names.length+' jogador(es) selecionado(s)';
 $('hall-export-selected').innerHTML=names.slice(0,36).map(([key,name])=>'<button type="button" class="hall-export-chip" data-hall-remove="'+esc(key)+'" title="Remover '+esc(name)+'">'+esc(name)+' <span aria-hidden="true">×</span></button>').join('')+
  (names.length>36?'<span class="hall-export-chip-more">+'+(names.length-36)+' selecionados. Use a busca para encontrar e desmarcar.</span>':'');
 $('hall-export-download').disabled=state.exportBusy||!state.chosen.size;
 $('hall-export-csv').disabled=state.exportBusy||!state.chosen.size;
}
function renderFields(){
 $('hall-export-fields').innerHTML=state.fields.map((field,i)=>'<div class="hall-export-field-row"><label><input type="checkbox" data-hall-field="'+field.key+'" '+(field.active?'checked':'')+'><span>'+esc(field.label)+'</span></label>'+
 '<div><button type="button" title="Subir coluna" aria-label="Mover '+esc(field.label)+' para cima" data-hall-move="'+field.key+'" data-step="-1" '+(i===0?'disabled':'')+'>↑</button>'+
 '<button type="button" title="Descer coluna" aria-label="Mover '+esc(field.label)+' para baixo" data-hall-move="'+field.key+'" data-step="1" '+(i===state.fields.length-1?'disabled':'')+'>↓</button></div></div>').join('');
}
function renderEditions(){
 $('hall-export-editions').innerHTML=state.editions.map(ed=>'<label><input type="checkbox" data-hall-edition="'+esc(ed)+'" '+(state.chosenEditions.has(ed)?'checked':'')+'> '+esc(ed)+'</label>').join('');
 $('hall-export-editions-count').textContent=state.chosenEditions.size+' de '+state.editions.length+' edições';
}
function rankFor(row){
 const map=state.placements[row.edition]||{};
 let place=map[norm(row.team)];
 if(!place&&norm(row.team)==='LOUD')place=map.LOUDSNICKERS;
 if(!place&&norm(row.team)==='FLUXO')place=map.FLUXOW7M;
 return Number.isInteger(place)&&place>0?place:null;
}
function recordValue(row,key){
 return key==='position'?rankFor(row):key==='name'?row.name:key==='team'?row.team:key==='kills'?row.kills:key==='matches'?row.matches:key==='avg'?Math.round(row.avg*10000)/10000:key==='edition'?row.edition:key==='year'?row.year||null:null;
}
function sortedRows(){
 const rows=state.rows.filter(row=>state.chosen.has(row.key)&&state.chosenEditions.has(row.edition));
 const sort=state.sort;
 rows.sort((a,b)=>{
  if(sort==='player-asc')return compare(a.name,b.name)||a.order-b.order;
  if(sort==='player-desc')return compare(b.name,a.name)||a.order-b.order;
  if(sort==='edition-asc')return a.order-b.order||compare(a.name,b.name);
  if(sort==='edition-desc')return b.order-a.order||compare(a.name,b.name);
  if(sort==='kills-desc')return b.kills-a.kills||compare(a.name,b.name);
  if(sort==='matches-desc')return b.matches-a.matches||compare(a.name,b.name);
  if(sort==='avg-desc')return b.avg-a.avg||compare(a.name,b.name);
  return compare(a.name,b.name)||a.order-b.order;
 });
 return rows;
}
function pickedFields(){return state.fields.filter(field=>field.active);}
function renderPreview(){
 if(!state.ready)return;
 const cols=pickedFields(),rows=sortedRows(),head=$('hall-export-preview-head'),body=$('hall-export-preview-body');
 head.innerHTML=cols.map(c=>'<th>'+esc(c.label)+'</th>').join('');
 body.innerHTML=rows.slice(0,5).map(row=>'<tr>'+cols.map(c=>{
  const v=recordValue(row,c.key);
  return '<td>'+esc(v===null?'—':c.key==='avg'?avgFmt(v):v)+'</td>';
 }).join('')+'</tr>').join('')||'<tr><td class="hall-tool-empty" colspan="'+Math.max(1,cols.length)+'">Selecione jogadores e edições para visualizar a planilha.</td></tr>';
 const note=rows.length+' linha(s) · '+cols.length+' coluna(s) · '+state.chosen.size+' jogador(es)';
 $('hall-export-preview-info').textContent=note+(cols.length?'. Prévia das primeiras cinco linhas.':'. Marque pelo menos uma coluna.');
 $('hall-export-download').disabled=state.exportBusy||!rows.length||!cols.length;
 $('hall-export-csv').disabled=state.exportBusy||!rows.length||!cols.length;
}
const xml=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
function sheetName(raw,used){
 const base=String(raw||'Dados').replace(/[\\\/?*:[\]]/g,' ').trim().slice(0,31)||'Dados';
 let candidate=base,n=2;
 while(used.has(candidate.toLowerCase())){const end=' ('+(n++)+')';candidate=base.slice(0,31-end.length)+end;}
 used.add(candidate.toLowerCase());return candidate;
}
function workbookGroups(records,layout=state.layout){
 const groups=[],used=new Set();
 const add=(label,rows)=>groups.push({name:sheetName(label,used),rows});
 if(layout==='single')add('Dados',records);
 else if(layout==='chunks'){for(let i=0;i<records.length;i+=100)add('Dados '+(Math.floor(i/100)+1),records.slice(i,i+100));}
 else{
  const map=new Map();
  for(const r of records){
   const label=layout==='player'?r.name:layout==='edition'?r.edition:layout==='year'?(r.year||'Sem ano').toString():'Dados';
   if(!map.has(label))map.set(label,[]);
   map.get(label).push(r);
  }
  for(const [label,rows] of map)add(label,rows);
 }
 return groups;
}
const encoder=new TextEncoder();
const bytes=s=>encoder.encode(s);
const u16=(v,n)=>v.setUint16(n.offset,n.value,true);
const colName=index=>{let s='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
function worksheetXml(rows,fields){
 const widths=fields.map(field=>Math.min(34,Math.max(field.width,...rows.slice(0,120).map(r=>String(recordValue(r,field.key)??'').length+2))));
 const heading='<row r="1" ht="29" customHeight="1">'+fields.map((f,i)=>'<c r="'+colName(i)+'1" t="inlineStr" s="1"><is><t>'+xml(f.label)+'</t></is></c>').join('')+'</row>';
 const data=rows.map((row,i)=>{
  const r=i+2,alternate=i%2===1;
  const cells=fields.map((field,index)=>{
   const ref=colName(index)+r,value=recordValue(row,field.key);
   const numeric=value!==null&&typeof value==='number'&&Number.isFinite(value);
   const style=field.key==='avg'?(alternate?4:3):(alternate?2:0);
   if(value===null||value==='')return '<c r="'+ref+'" s="'+style+'"/>';
   return numeric?'<c r="'+ref+'" t="n" s="'+style+'"><v>'+value+'</v></c>':
    '<c r="'+ref+'" t="inlineStr" s="'+style+'"><is><t>'+xml(value)+'</t></is></c>';
  }).join('');
  return '<row r="'+r+'">'+cells+'</row>';
 }).join('');
 const cols=widths.map((n,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+n+'" customWidth="1"/>').join('');
 const end=colName(fields.length-1)+(rows.length+1);
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
 '<dimension ref="A1:'+end+'"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
 '<sheetFormatPr defaultRowHeight="17"/><cols>'+cols+'</cols><sheetData>'+heading+data+'</sheetData>'+
 '<autoFilter ref="A1:'+end+'"/></worksheet>';
}
const stylesXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
 '<fonts count="2"><font><sz val="10"/><color rgb="FF20324B"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts>'+
 '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+
 '<fill><patternFill patternType="solid"><fgColor rgb="FF006DB2"/><bgColor indexed="64"/></patternFill></fill>'+
 '<fill><patternFill patternType="solid"><fgColor rgb="FFEDF6FC"/><bgColor indexed="64"/></patternFill></fill></fills>'+
 '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
 '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
 '<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
 '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'+
 '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>'+
 '<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'+
 '<xf numFmtId="2" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyNumberFormat="1"/></cellXfs></styleSheet>';
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let v=n;for(let i=0;i<8;i++)v=(v&1)?(0xEDB88320^(v>>>1)):(v>>>1);t[n]=v>>>0;}return t;})();
function checksum(data){let v=0xFFFFFFFF;for(const b of data)v=crcTable[(v^b)&255]^(v>>>8);return(v^0xFFFFFFFF)>>>0;}
function zipStored(entries){
 if(entries.length>65535)throw Error('Muitas abas/arquivos para o Excel.');
 let length=0;const parts=[],central=[];
 const dt=new Date(),time=(dt.getHours()<<11)|(dt.getMinutes()<<5)|Math.floor(dt.getSeconds()/2),date=((dt.getFullYear()-1980)<<9)|((dt.getMonth()+1)<<5)|dt.getDate();
 for(const [name,data] of entries){
  const filename=bytes(name),body=typeof data==='string'?bytes(data):data,size=body.length,crc=checksum(body),offset=length;
  const local=new Uint8Array(30+filename.length),v=new DataView(local.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);
  v.setUint16(10,time,true);v.setUint16(12,date,true);v.setUint32(14,crc,true);v.setUint32(18,size,true);v.setUint32(22,size,true);
  v.setUint16(26,filename.length,true);local.set(filename,30);
  parts.push(local,body);length+=local.length+size;
  const head=new Uint8Array(46+filename.length),c=new DataView(head.buffer);
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);
  c.setUint16(12,time,true);c.setUint16(14,date,true);c.setUint32(16,crc,true);c.setUint32(20,size,true);c.setUint32(24,size,true);
  c.setUint16(28,filename.length,true);c.setUint32(42,offset,true);head.set(filename,46);central.push(head);
 }
 const centSize=central.reduce((v,p)=>v+p.length,0),eocd=new Uint8Array(22),e=new DataView(eocd.buffer);
 e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);
 e.setUint32(12,centSize,true);e.setUint32(16,length,true);
 return new Blob([...parts,...central,eocd],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function xlsxBlob(records,fields,layout){
 const groups=workbookGroups(records,layout);
 if(!groups.length||!fields.length)throw Error('Selecione jogadores e colunas.');
 const sheets=groups.map((g,i)=>'<sheet name="'+xml(g.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('');
 const workbook='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'+sheets+'</sheets></workbook>';
 const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+groups.map((g,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+
 '<Relationship Id="rId'+(groups.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
 const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
 '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
 '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
 groups.map((g,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>';
 const rootRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
 '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
 const entries=[['[Content_Types].xml',types],['_rels/.rels',rootRels],['xl/workbook.xml',workbook],['xl/_rels/workbook.xml.rels',rels],['xl/styles.xml',stylesXml]];
 groups.forEach((g,i)=>entries.push(['xl/worksheets/sheet'+(i+1)+'.xml',worksheetXml(g.rows,fields)]));
 return {blob:zipStored(entries),sheets:groups.length,rows:records.length};
}
function csvBlob(records,fields){
 const clean=value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const lines=[fields.map(f=>clean(f.label)).join(';')];
 for(const r of records)lines.push(fields.map(f=>clean(recordValue(r,f.key)??'')).join(';'));
 return new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
}
function download(blob,name){
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function exportFile(type){
 if(state.exportBusy)return;
 const rows=sortedRows(),fields=pickedFields();
 if(!rows.length||!fields.length){setNote('hall-export-status','Escolha pelo menos um jogador, uma edição e uma coluna.',true);return;}
 state.exportBusy=true;renderPreview();
 try{
  if(type==='xlsx'){
   const output=xlsxBlob(rows,fields,state.layout);
   download(output.blob,'central-free-fire-jogadores.xlsx');
   setNote('hall-export-status','Planilha gerada: '+output.rows+' linhas em '+output.sheets+' aba(s).');
  }else{
   download(csvBlob(rows,fields),'central-free-fire-jogadores.csv');
   setNote('hall-export-status','CSV gerado: '+rows.length+' linhas. A divisão por abas está disponível no Excel (.xlsx).');
  }
 }catch(error){setNote('hall-export-status','Erro ao preparar a planilha: '+(error.message||error),true);}
 finally{state.exportBusy=false;renderPreview();}
}
function initEvents(){
 $('hall-evolution-search').addEventListener('input',e=>{state.evoSearch=e.target.value;state.evoPage=0;renderEvolution();});
 $('hall-evolution-metric').addEventListener('change',e=>{state.evoMetric=e.target.value;state.evoPage=0;renderEvolution();});
 $('hall-evolution-min').addEventListener('change',e=>{state.evoMin=e.target.checked;state.evoPage=0;renderEvolution();});
 $('hall-evolution-prev').addEventListener('click',()=>{state.evoPage--;renderEvolution();});
 $('hall-evolution-next').addEventListener('click',()=>{state.evoPage++;renderEvolution();});
 $('hall-export-search').addEventListener('input',e=>{state.filteredName=e.target.value;renderPeople();});
 $('hall-export-people').addEventListener('change',e=>{const key=e.target?.dataset?.hallPerson;if(!key)return;if(e.target.checked)state.chosen.add(key);else state.chosen.delete(key);renderPeople();renderPreview();});
 $('hall-export-selected').addEventListener('click',e=>{const key=e.target.closest('[data-hall-remove]')?.dataset.hallRemove;if(key){state.chosen.delete(key);renderPeople();renderPreview();}});
 $('hall-export-add-visible').addEventListener('click',()=>{for(const [key] of visiblePlayerChoices().slice(0,12))state.chosen.add(key);renderPeople();renderPreview();});
 $('hall-export-all-players').addEventListener('click',()=>{for(const key of state.players.keys())state.chosen.add(key);renderPeople();renderPreview();});
 $('hall-export-clear').addEventListener('click',()=>{state.chosen.clear();renderPeople();renderPreview();});
 $('hall-export-fields').addEventListener('change',e=>{const key=e.target?.dataset?.hallField;if(!key)return;const field=state.fields.find(f=>f.key===key);if(field){field.active=e.target.checked;renderFields();renderPreview();}});
 $('hall-export-fields').addEventListener('click',e=>{const btn=e.target.closest('[data-hall-move]');if(!btn)return;const index=state.fields.findIndex(f=>f.key===btn.dataset.hallMove),target=index+Number(btn.dataset.step);if(index<0||target<0||target>=state.fields.length)return;[state.fields[index],state.fields[target]]=[state.fields[target],state.fields[index]];renderFields();renderPreview();});
 $('hall-export-editions').addEventListener('change',e=>{const ed=e.target?.dataset?.hallEdition;if(!ed)return;if(e.target.checked)state.chosenEditions.add(ed);else state.chosenEditions.delete(ed);renderEditions();renderPreview();});
 $('hall-export-editions-all').addEventListener('click',()=>{state.chosenEditions=new Set(state.editions);renderEditions();renderPreview();});
 $('hall-export-editions-none').addEventListener('click',()=>{state.chosenEditions.clear();renderEditions();renderPreview();});
 $('hall-export-sort').addEventListener('change',e=>{state.sort=e.target.value;renderPreview();});
 $('hall-export-layout').addEventListener('change',e=>{state.layout=e.target.value;renderPreview();});
 $('hall-export-download').addEventListener('click',()=>exportFile('xlsx'));
 $('hall-export-csv').addEventListener('click',()=>exportFile('csv'));
}
async function boot(){
 if(state.ready)return state;
 if(state.bootPromise)return state.bootPromise;
 if(!$('hall-evolution-results')||!$('hall-export-people'))return null;
 state.bootPromise=(async()=>{
  const hall=await window.cffHallLiteBoot();
  if(!hall?.ready)throw Error('O histórico de jogadores ainda não está disponível.');
  buildRows(hall);
  initEvents();
  state.ready=true;
  renderEvolution();renderPeople();renderFields();renderEditions();renderPreview();
  try{
   const response=await fetch('ranking-data/hall-edition-placements.json?v=20261124-v1',{cache:'default'});
   if(response.ok){const data=await response.json();if(data?.schema===1&&data.positions)state.placements=data.positions;}
  }catch(error){console.warn('[Hall export] Posições finais indisponíveis',error);}
  renderPreview();
  return state;
 })().catch(error=>{
  setNote('hall-evolution-info','Erro ao carregar evoluções: '+(error.message||error),true);
  setNote('hall-export-status','Erro ao carregar exportador: '+(error.message||error),true);
  throw error;
 }).finally(()=>{state.bootPromise=null;});
 return state.bootPromise;
}
window.CFFHallTools={boot,progressionRows,sortedRows,workbookGroups,xlsxBlob,csvBlob,recordValue,yearOf,orderEdition,renderPreview,_state:state};
})();