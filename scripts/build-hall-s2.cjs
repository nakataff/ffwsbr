// Publish a tiny, complete S2 snapshot for the Hall da Fama; never fetch Firebase in visitors' browsers.
// Uses the same stage/alias merger and validation as scripts/build-s2-overview.cjs.
// node scripts/build-hall-s2.cjs [--check] [--live=/path/to/export.json]
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {mergeSources,buildSummaries,aggregate}=require('./build-s2-overview.cjs');
const ROOT=path.resolve(__dirname,'..'),BASE='ffws-br-2026-s2/';
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
const source='https://central-free-fire-default-rtdb.firebaseio.com/ffwsLive/2026-s2.json';
async function liveExport(){
  const input=process.argv.find(v=>v.startsWith('--live='));
  if(input)return JSON.parse(fs.readFileSync(input.slice(7),'utf8'));
  const response=await fetch(source,{signal:AbortSignal.timeout(45000),headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('Nao foi possivel consultar dados oficiais de S2 (HTTP '+response.status+')');
  const data=await response.json();
  if(!data?.segundaFase?.drops||!data?.final?.drops)throw Error('Exportacao S2 ausente/incompleta; ranking antigo preservado');
  return data;
}
async function main(){
  const live=await liveExport();
  const players=await mergeSources(read(BASE+'players.json'),live,read(BASE+'player-name-map.json'));
  const summary=read(BASE+'career-summary.json'),snapshot=read(BASE+'inicio-mvp-top10.json');
  const built=buildSummaries({players,live,teams:read(BASE+'teams.json'),summary,dates:read(BASE+'dates.json'),photos:read('player-data/photo-map.json')});
  const fresh=built['inicio-mvp-top10.json'];
  for(const stage of ['classificatoria','segundaFase','final']){
    assert.equal(fresh.coverage[stage],'completo');
    assert.equal(fresh.drops[stage],snapshot.drops[stage],'Contagem de quedas difere do fechamento oficial: '+stage);
  }
  const all=aggregate((players.entries||[]).filter(r=>['classificatoria','segundaFase','final'].includes(r.stage)));
  const old=read(BASE+'player-stats.json').players||{};
  const oldByKey=new Map(Object.entries(old).map(([id,p])=>[norm(p.name)+'|'+norm(p.team),id]));
  const out={};
  for(const row of all){
    if(!row.matches)continue;
    const id=oldByKey.get(norm(row.name)+'|'+norm(row.team))||norm(row.name).toLowerCase();
    if(out[id])throw Error('Identificador de jogador duplicado na S2: '+id);
    out[id]={name:row.name,team:row.team,kills:row.kills,matches:row.matches};
  }
  for(const expected of snapshot.top10.geral||[]){
    const player=Object.values(out).find(p=>norm(p.name)===norm(expected.name)&&norm(p.team)===norm(expected.team));
    assert(player,'Top 10 ausente: '+expected.name);
    assert.equal(player.kills,expected.kills,'Abates divergentes: '+expected.name);
    assert.equal(player.matches,expected.matches,'Quedas divergentes: '+expected.name);
  }
  assert(Object.keys(out).length>=60,'Lista de jogadores incompleta');
  const result={tournament:'WB 2026 S2',updatedAt:snapshot.updatedAt,coverage:'todas as fases',drops:snapshot.drops,players:out};
  const destination=path.join(ROOT,BASE+'hall-player-stats.json'),text=JSON.stringify(result)+'\n';
  if(process.argv.includes('--check')){
    if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==text)throw Error('Resumo do Hall desatualizado');
  }else fs.writeFileSync(destination,text);
  console.log('Hall WB 2026 S2: '+Object.keys(out).length+' jogadores, '+Buffer.byteLength(text)+' bytes, Yago '+Object.values(out).find(x=>norm(x.name)==='YAGO')?.kills+' abates');
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
module.exports={main};
