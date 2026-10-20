// Pure data and preferences for shareable CFF rankings. No network or account state.
export const FORMATS = Object.freeze({feed:{label:'Feed',width:1218,height:1291},square:{label:'Quadrado',width:1080,height:1080},story:{label:'Stories',width:1080,height:1920},wide:{label:'Horizontal',width:1200,height:630}});
export const THEMES = Object.freeze({cff:'#00c8ff',tournament:'#F23CF2',team:'#2edc94',custom:'#00c8ff'});
const ORIGIN='https://centralfreefire.com.br';
const clean=(v,max=100)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const number=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
export function shareURLFor(tab='tabela',stage='final') {
  const aba=['tabela','mvp','equipes'].includes(tab)?tab:'tabela';
  const etapa=['classificatoria','segundaFase','final',...(aba!=='tabela'?['geral']:[])].includes(stage)?stage:'final';
  return `${ORIGIN}/ffws-br-s2/inicio?aba=${aba}&etapa=${etapa}`;
}
function safeURL(value) {
  try {const u=new URL(value||'/',ORIGIN);if(u.origin===ORIGIN&&['http:','https:'].includes(u.protocol))return u.href;}catch(_){}
  return ORIGIN+'/';
}
export function normalizePayload(input={}) {
  input=input&&typeof input==='object'?input:{};
  const metric=['points','kills','damage','assists'].includes(input.metric)?input.metric:'kills';
  const rows=(Array.isArray(input.rows)?input.rows:[]).slice(0,100).map((r,i)=>({rank:Math.max(1,Math.floor(number(r.rank||r.position)||i+1)),name:clean(r.name||r.team),team:clean(r.team),logo:clean(r.logo,250),photo:clean(r.photo,250),...Object.fromEntries(['points','kills','damage','assists','matches','booyahs'].map(key=>[key,r[key]==null?null:number(r[key])]))})).filter(r=>r.name);
  return {id:clean(input.id||'ranking',100),kind:input.kind==='teams'?'teams':'players',mode:input.mode==='team'&&input.kind==='teams'?'team':'ranking',title:clean(input.title||'Ranking de abates'),event:clean(input.event||'Free Fire'),stage:clean(input.stage),updatedAt:/^\d{4}-\d{2}-\d{2}$/.test(input.updatedAt)?input.updatedAt:'',metric,url:safeURL(input.url),rows};
}
export function teamColor(team) {
  const name=String(team||'').toUpperCase();
  if(name.includes('LOUD'))return '#2edc94'; if(name.includes('FLUXO')||name.includes('W7M'))return '#F23CF2';
  if(name.includes('LOS'))return '#ff8555'; if(name.includes('INTZ'))return '#a78bfa'; if(name.includes('ALPHA'))return '#FFC400';
  return '#00c8ff';
}
export function normalizeOptions(input={},data={rows:[]}) {
  input=input&&typeof input==='object'?input:{};
  const length=data.rows.length,integer=(v,otherwise)=>Number.isInteger(Number(v))?Number(v):otherwise;
  const first=Math.min(Math.max(0,integer(input.first,0)),Math.max(0,length-1));
  let second=Math.min(Math.max(0,integer(input.second,1)),Math.max(0,length-1));if(second===first&&length>1)second=(first+1)%length;
  const theme=Object.hasOwn(THEMES,input.theme)?input.theme:'cff';
  const highlight=integer(input.highlight,-1);
  const rowCount=input.rowCount==='all'&&data.kind==='teams'?'all':[3,5,10].includes(Number(input.rowCount))?Number(input.rowCount):data.kind==='teams'?'all':10;
  const available=Object.keys(STAT_LABELS).filter(key=>statValue(data.rows[first]||{},key)!=null),requested=Array.isArray(input.stats)?input.stats:['kills','matches','average'];
  const stats=[...new Set(requested)].filter(key=>available.includes(key));if(!stats.length)stats.push(...available.slice(0,3));
  return {format:Object.hasOwn(FORMATS,input.format)?input.format:'feed',template:data.mode==='team'?'team':['table','leader','compare'].includes(input.template)&&!(input.template==='compare'&&length<2)?input.template:'table',theme,accent:theme==='custom'&&/^#[a-f\d]{6}$/i.test(input.accent)?input.accent:theme==='team'?teamColor(data.rows[highlight>=0?highlight:first]?.team):THEMES[theme],rowCount,stats,showLogos:input.showLogos!==false,showPhotos:input.showPhotos!==false,showQR:input.showQR===true,highlight:highlight>=0&&highlight<Math.min(rowCount==='all'?length:rowCount,length)?highlight:-1,first,second};
}
export function rememberedOptions(options) {
  const {format,template,theme,accent,rowCount,stats,showLogos,showPhotos,showQR}=options;
  return {format,template,theme,accent,rowCount,stats,showLogos,showPhotos,showQR};
}
export function selectedRows(data,options) {
  if(options.template==='leader'||options.template==='team')return data.rows[options.first]?[data.rows[options.first]]:[];
  if(options.template==='compare')return [data.rows[options.first],data.rows[options.second]].filter(Boolean);
  return data.rows.slice(0,options.rowCount==='all'?data.rows.length:options.rowCount);
}
export const STAT_LABELS=Object.freeze({kills:'ABATES',matches:'QUEDAS',average:'ABATES / QUEDA',assists:'ASSISTÊNCIAS',damage:'DANO',points:'PONTOS',booyahs:'BOOYAHS'});
export const statValue=(row,key)=>key==='average'?(row.matches>0&&row.kills!=null?row.kills/row.matches:null):row[key]??null;
export const statText=(row,key)=>key==='average'&&statValue(row,key)!=null?statValue(row,key).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):formatValue(statValue(row,key));
export const metricLabel=metric=>({points:'PONTOS',kills:'ABATES',damage:'DANO',assists:'ASSISTÊNCIAS'}[metric]||'ABATES');
export const formatValue=value=>value==null?'—':number(value).toLocaleString('pt-BR');
export function dateText(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('/'):'';}
export function captionFor(data,options) {
  const rows=selectedRows(data,options),one=rows[0];
  if(!one)return '';
  const title=options.template==='team'?`${one.name} EM NÚMEROS | ${data.event}`:options.template==='compare'?`${rows.map(r=>r.name).join(' x ')} | ${data.event}`:options.template==='leader'?`${one.name} EM DESTAQUE | ${data.event}`:options.rowCount==='all'?`TABELA COMPLETA | ${data.event}`:`TOP ${rows.length} DE ${metricLabel(data.metric)} | ${data.event}`;
  const facts=options.template==='team'?options.stats.map(key=>`${STAT_LABELS[key]}: ${statText(one,key)}`).join('\n'):options.template==='table'?`${one.rank}º ${one.name}: ${formatValue(one[data.metric])} ${metricLabel(data.metric).toLowerCase()}`:rows.map(r=>`${r.name}${data.kind==='players'&&r.team?' ('+r.team+')':''}: ${formatValue(r[data.metric])} ${metricLabel(data.metric).toLowerCase()} em ${formatValue(r.matches)} quedas`).join('\n');
  return `${title.toLocaleUpperCase('pt-BR')}\n\n${data.stage?data.stage+'\n':''}${facts}${data.updatedAt?'\nDados atualizados em '+dateText(data.updatedAt):''}\n\nConfira os dados na Central Free Fire\n${data.url}\n\n#FreeFire #CentralFreeFire`;
}
export function captionWithLink(text,data){const value=String(text||'').trim();return value.includes(data.url)?value:value+'\n\n'+data.url;}
export function cardFilename(data,options){return 'cff-'+(data.id||'ranking').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z\d-]+/g,'-').replace(/^-|-$/g,'')+'-'+options.template+'-'+options.format+'.png';}
