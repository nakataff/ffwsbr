const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=name=>JSON.parse(fs.readFileSync(path.join(root,'ffws-global-2026',name+'.json'),'utf8'));
const dates=read('dates'),pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(obj,k)).map(k=>[k,obj[k]]));
const photos=new Map(read('jogadores-resumo').players.map(p=>[p.id,p.photo]));
const data={version:1,name:dates.tournament,timeZone:dates.timeZone,championPoint:dates.event.championRushPoint,groups:read('groups').groups,rounds:dates.rounds,teams:read('teams').teams.map(t=>pick(t,['id','name','abbreviation','wikiName','logo'])),players:read('players').players.filter(p=>p.type==='player').map(p=>({...pick(p,['id','name','team','role','type','photo','aliases']),...(photos.get(p.id)?{photo:photos.get(p.id)}:{})}))};
const file=path.join(root,'ffws-global-2026/camp-model.json'),content=JSON.stringify(data)+'\n';
if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==content)throw Error('camp-model.json desatualizado: rode node scripts/build-global-camp-model.cjs');console.log('Modelo Global Series atualizado.')}else{fs.writeFileSync(file,content);console.log('Modelo Global Series gerado: '+Buffer.byteLength(content)+' bytes.');}
