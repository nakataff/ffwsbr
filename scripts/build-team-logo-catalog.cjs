// Offline index: the admin never scans GitHub or tournament datasets at runtime.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
function build(){
 const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8')),entries=new Map(),map=read('team-data/logo-map.json'),aliases=read('team-aliases.json');
 function add(name,image,source,other=[]){
  if(!name||!image||/(?:^|\/)(?:escudo|silhueta)\.webp(?:\?|$)/i.test(image))return;
  let src=String(image).trim();if(/^https:\/\//i.test(src)){try{const u=new URL(src);if(u.username||u.password)return;}catch{return;}}
  else{src=decodeURI(src).replace(/^\//,'');if(src.includes('..')||!fs.existsSync(path.join(root,src))||!fs.statSync(path.join(root,src)).isFile()||! /\.(webp|png|jpe?g)$/i.test(src))return;src='/'+src;}
  let item=entries.get(src);if(!item){item={name:String(name),path:src,aliases:[],sources:[]};entries.set(src,item);}
  for(const value of [name,...other,...(aliases[name]||[]),...Object.entries(map.aliases||{}).filter(([,target])=>target===name).map(([alias])=>alias)])if(value&&value!==item.name&&!item.aliases.includes(value))item.aliases.push(value);
  if(!item.sources.includes(source))item.sources.push(source);
 }
 for(const [file,label]of [['teams.json','Cadastro de equipes'],['ffws-br-2026-s2/teams.json','FFWS BR 2026 S2'],['ffws-br-2026-s1/teams.json','FFWS BR 2026 S1'],['ffws-br-2025-s2/teams.json','FFWS BR 2025 S2'],['ffws-global-2026/teams.json','FFWS Global 2026']])for(const team of read(file).teams||[])add(team.name,team.logo,label,[...(team.aliases||[]),team.abbreviation]);
 for(const [name,src]of Object.entries(map.logos||{}))add(name,src,'Banco de escudos');
 for(const team of read('team-data/historical-teams.json').teams||[])add(team.name,team.logo,'Equipes históricas',team.aliases);
 for(const team of read('tier-constructor/assets-index.json').assets||[])if(team.type==='team')add(team.name,team.image,team.subtitle||'Banco de equipes',team.aliases);
 const logos=[...entries.values()].sort((a,b)=>Number(a.path.startsWith('https:'))-Number(b.path.startsWith('https:'))||a.name.localeCompare(b.name,'pt-BR')||a.path.localeCompare(b.path));
 return {schema:1,description:'Escudos já referenciados pelos dados do site. Gerado offline por scripts/build-team-logo-catalog.cjs.',logos};
}
if(require.main===module){const result=build(),dest=path.join(root,'data/team-logo-catalog.json'),content=JSON.stringify(result)+'\n';if(process.argv.includes('--check')){if(fs.readFileSync(dest,'utf8')!==content)throw Error('Regenere data/team-logo-catalog.json');}else fs.writeFileSync(dest,content);console.log(`${result.logos.length} escudos · ${Buffer.byteLength(content)} bytes`);}
module.exports={build};
