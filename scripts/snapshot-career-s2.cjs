// Reuse the site's tournament calculations once, offline, from an exported live JSON.
// node scripts/snapshot-career-s2.cjs /path/to/ffwsLive-2026-s2.json
const fs=require('node:fs'),vm=require('node:vm');
const input=process.argv[2];if(!input)throw Error('Informe o JSON exportado de ffwsLive/2026-s2.');
const live=JSON.parse(fs.readFileSync(input)),base=JSON.parse(fs.readFileSync('ffws-br-2026-s2/stages.json'));
const context={window:{},document:{},location:{search:''},localStorage:{getItem:()=>null},URLSearchParams,Response,Headers,console};
context.window.fetch=async url=>new Response(JSON.stringify(String(url).includes('firebaseio')?live:base));
context.window.CFF_CONFIG={firebase:{databaseURL:'https://snapshot.firebaseio.com'}};
vm.createContext(context);vm.runInContext(fs.readFileSync('js/ffws-live-provider.js','utf8'),context);
(async()=>{
 const data=await(await context.window.fetch('ffws-br-2026-s2/stages.json')).json();
 if(!data.final?.rows?.some(r=>r.matches>0)||!data.segundaFase?.rows?.some(r=>r.matches>0))throw Error('Exportação incompleta: final/segunda fase sem quedas.');
 for(const id of ['classificatoria','segundaFase','final']){
  const s=data[id];delete s.rounds;delete s.days;delete s.bonus;
 }
 data.source='ffwsLive/2026-s2 · js/ffws-live-provider.js';
 fs.writeFileSync('ffws-br-2026-s2/career-summary.json',JSON.stringify(data)+'\n');
 console.log('Resumo estático:',data.updatedAt,data.segundaFase.rows.length,'equipes; sem consulta por visitante');
})();
