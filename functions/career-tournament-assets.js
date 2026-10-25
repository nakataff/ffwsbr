'use strict';
// One small document, independent of the people/roster directory.
module.exports=function({sql,rows,key,text,fail,now}){
 let cached;
 function read(force=false){if(!force&&cached&&now()-cached.at<60000)return cached.value;const row=rows("SELECT data FROM career_tournament_assets WHERE id='logos'")[0];const value=row?JSON.parse(row.data):{revision:0,entries:[]};cached={at:now(),value};return value;}
 function publicRead(){const value=read();return {ok:true,version:value.revision,entries:value.entries.map(({id,name,aliases,logo})=>({id,name,aliases,logo}))};}
 function save(identity,b){const old=read(true);if(b.revision!==old.revision)throw fail(409,'Os logos foram atualizados. Reabra o gerenciador antes de salvar.');
  const name=text(b.name,100),id=text(b.id,120);if(name.length<3||!key(name)||!id||!/^[-a-z0-9]+$/.test(id))throw fail(400,'Escolha uma competição válida.');
  const aliases=[...new Set([name,...(Array.isArray(b.aliases)?b.aliases:[])].map(n=>text(n,100)).filter(Boolean))];if(aliases.length>20)throw fail(400,'Use até 20 nomes equivalentes.');
  const same=old.entries.find(e=>e.id===id);let logo=String(b.logo||'').trim();if(logo.length>94000)throw fail(400,'Escolha uma imagem menor.');
  if(logo){let valid=/^data:image\/(webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(logo)||/^\/?[A-Za-z0-9_ %().\/-]+\.(webp|png|jpe?g)(?:\?[A-Za-z0-9_=&%.-]+)?$/i.test(logo)&&!logo.startsWith('//')&&!logo.split('/').includes('..');
   if(/^https:\/\//i.test(logo)){try{const url=new URL(logo);valid=!!url.hostname&&!url.username&&!url.password;}catch{valid=false;}}
   if(!valid)throw fail(400,'Use imagem PNG/WebP, caminho do site ou link HTTPS.');
   for(const e of old.entries)if(e.id!==id&&[e.name,...e.aliases].some(n=>aliases.some(a=>key(a)===key(n))))throw fail(409,'Um desses nomes já pertence a outra competição.');
   if(!same&&old.entries.length>=300)throw fail(400,'O gerenciador aceita até 300 logos personalizados.');
   if(logo.startsWith('data:')){const imageId=crypto.randomUUID();sql.exec('INSERT INTO career_team_logos VALUES(?,?)',imageId,logo);logo='https://cff-camp-notifications.nakataffb4.workers.dev/careers/logo/'+imageId;}
  }
  const entries=old.entries.filter(e=>e.id!==id);if(logo)entries.push({id,name,aliases,logo,updatedAt:now(),updatedBy:identity.uid});
  const next={revision:old.revision+1,entries};sql.exec("INSERT OR REPLACE INTO career_tournament_assets VALUES('logos',?)",JSON.stringify(next));cached=null;
  return {ok:true,...publicRead(),revision:next.revision};
 }
 return {publicRead,save};
};
