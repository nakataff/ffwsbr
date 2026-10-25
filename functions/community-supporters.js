'use strict';
// A bounded, single-row list. No wallet, donation API or user-directory reads.
module.exports=function({sql,rows,text,fail,now,day}){
 let cached;
 const ordered=entries=>[...entries].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt||a.id.localeCompare(b.id));
 function read(force=false){if(!force&&cached&&now()-cached.at<60000)return cached.value;const row=rows("SELECT data FROM community_supporters WHERE id='list'")[0],value=row?JSON.parse(row.data):{revision:0,entries:[]};cached={at:now(),value};return value;}
 function list(){const data=read();return {ok:true,revision:data.revision,entries:ordered(data.entries)};}
 function publicRead(){const data=read();return {ok:true,version:data.revision,entries:ordered(data.entries.filter(r=>r.visible)).slice(0,6).map(({id,name,date})=>({id,name,date}))};}
 function save(identity,b){const old=read(true);if(b.revision!==old.revision)throw fail(409,'A lista mudou. Atualize antes de salvar.');const entry=b.entry||{},id=text(entry.id,50),previous=id?old.entries.find(r=>r.id===id):null;
  if(id&&!previous)throw fail(404,'Apoiador não encontrado.');if(!previous&&old.entries.length>=300)throw fail(400,'A lista aceita até 300 registros. Edite um cadastro existente.');
  const name=String(entry.name||'').trim(),date=String(entry.date||'');if(name.length<2||name.length>60||/[\u0000-\u001f\u007f]/.test(name))throw fail(400,'Informe um nome público ou @ entre 2 e 60 caracteres.');
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date>day(now()))throw fail(400,'Informe a data do apoio, até hoje.');
  if(typeof entry.visible!=='boolean')throw fail(400,'Confira se o apoio deve aparecer no site.');
  const nextEntry={id:previous?.id||crypto.randomUUID(),name,date,visible:entry.visible,createdAt:previous?.createdAt||now(),updatedAt:now(),updatedBy:identity.uid};
  const next={revision:old.revision+1,entries:[...old.entries.filter(r=>r.id!==id),nextEntry]};sql.exec("INSERT OR REPLACE INTO community_supporters VALUES('list',?)",JSON.stringify(next));cached=null;return {ok:true,revision:next.revision,entry:nextEntry};
 }
 return {list,publicRead,save};
};
