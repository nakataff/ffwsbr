'use strict';
const categories=['Live','Stories','Feed','Carrossel','Vídeo','Template','Outros'];
const fail=(status,message)=>Object.assign(Error(message),{status});
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id);
function text(value,max,required=false,trim=true){if(typeof value!=='string'||value.length>max)throw fail(400,'Texto inválido ou acima do limite.');const v=trim?value.trim():value;if(required&&!v)throw fail(400,'Preencha o nome da arte.');return v;}
function url(value){const v=text(value,2048,true);let u;try{u=new URL(v);}catch{throw fail(400,'Use um link completo com https://.');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw fail(400,'Link inválido. Use http ou https, sem credenciais.');return u.href;}
function normalize(v){
 if(!v||!validId(v.id))throw fail(400,'Arte inválida.');
 if(!categories.includes(v.category))throw fail(400,'Escolha um tipo de arte.');
 if(typeof v.favorite!=='boolean')throw fail(400,'Favorito inválido.');
 if(!Array.isArray(v.keywords)||v.keywords.length>20||!Array.isArray(v.links)||!v.links.length||v.links.length>12||!Array.isArray(v.captions)||v.captions.length>8)throw fail(400,'Use até 20 palavras-chave, 12 links e 8 legendas.');
 return {id:v.id,name:text(v.name,160,true),category:v.category,project:text(v.project||'',80),format:text(v.format||'',80),favorite:v.favorite,keywords:[...new Set(v.keywords.map(k=>text(k,40,true)))],links:v.links.map((l,i)=>({label:text(l?.label||'Link '+(i+1),80,true),url:url(l?.url)})),captions:v.captions.map((c,i)=>({label:text(c?.label||'Copy '+(i+1),60,true),text:text(c?.text,10000,false,false)})),notes:text(v.notes||'',3000)};
}
const terms=v=>[v.name,v.category,v.project,v.format,...v.keywords,...v.links.map(l=>l.label),...v.captions.map(c=>c.label),v.notes].join(' ');
const summary=v=>({id:v.id,revision:v.revision,updatedAt:v.updatedAt,name:v.name,category:v.category,project:v.project,format:v.format,favorite:v.favorite,keywords:v.keywords,primaryUrl:v.links[0].url,primaryLabel:v.links[0].label,linkCount:v.links.length,captionCount:v.captions.length,captionLabel:v.captions[0]?.label||''});
function create({sql,transaction,now=Date.now}){
 const rows=(q,...args)=>sql.exec(q,...args).toArray();
 sql.exec(`CREATE TABLE IF NOT EXISTS task_locator(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,updated_at INTEGER NOT NULL,favorite INTEGER NOT NULL,category TEXT NOT NULL,summary TEXT NOT NULL,data TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS task_locator_recent ON task_locator(favorite DESC,updated_at DESC,id);
 CREATE INDEX IF NOT EXISTS task_locator_category ON task_locator(category,favorite DESC,updated_at DESC,id);
 CREATE VIRTUAL TABLE IF NOT EXISTS task_locator_search USING fts5(terms,tokenize='unicode61 remove_diacritics 2');`);
 const get=id=>{if(!validId(id))throw fail(400,'Arte inválida.');return rows('SELECT rowid,data FROM task_locator WHERE id=?',id)[0];};
 const check=(revision,old)=>{if(!Number.isSafeInteger(revision)||revision<0||revision!==(old?.revision||0))throw fail(409,'Esta arte mudou em outro aparelho. Atualize antes de salvar.');};
 function save(b){const v=normalize(b.item);return transaction(()=>{
  const row=get(v.id),old=row?JSON.parse(row.data):null;
  if(old&&JSON.stringify(normalize(old))===JSON.stringify(v))return {ok:true,item:old};
  check(b.revision,old);
  if(!old&&rows('SELECT COUNT(*) AS n FROM task_locator')[0].n>=1000)throw fail(413,'O Localizador chegou a 1.000 artes. Exclua as que não usa mais.');
  const item={...v,revision:(old?.revision||0)+1,updatedAt:Math.max(now(),(old?.updatedAt||0)+1)};
  if(old)sql.exec('UPDATE task_locator SET revision=?,updated_at=?,favorite=?,category=?,summary=?,data=? WHERE id=?',item.revision,item.updatedAt,Number(item.favorite),item.category,JSON.stringify(summary(item)),JSON.stringify(item),item.id);
  else sql.exec('INSERT INTO task_locator(id,revision,updated_at,favorite,category,summary,data) VALUES(?,?,?,?,?,?,?)',item.id,item.revision,item.updatedAt,Number(item.favorite),item.category,JSON.stringify(summary(item)),JSON.stringify(item));
  if(!old||terms(old)!==terms(item)){const rowid=row?.rowid??get(item.id).rowid;if(old)sql.exec('DELETE FROM task_locator_search WHERE rowid=?',rowid);sql.exec('INSERT INTO task_locator_search(rowid,terms) VALUES(?,?)',rowid,terms(item));}
  return {ok:true,item};
 });}
 function list(b){
  const query=text(b.query||'',160),category=text(b.category||'',30);if(category&&!categories.includes(category))throw fail(400,'Tipo inválido.');if(b.favorites!==undefined&&typeof b.favorites!=='boolean')throw fail(400,'Filtro inválido.');
  const where=[],args=[],tokens=(query.match(/[\p{L}\p{N}]+/gu)||[]).slice(0,8);
  if(query&&!tokens.length)return {ok:true,items:[],next:null};
  if(tokens.length){where.push('rowid IN (SELECT rowid FROM task_locator_search WHERE task_locator_search MATCH ?)');args.push(tokens.map(t=>'"'+t+'"*').join(' AND '));}
  if(category){where.push('category=?');args.push(category);}if(b.favorites){where.push('favorite=1');}
  if(b.cursor){const c=b.cursor;if(!validId(c.id)||![0,1].includes(c.favorite)||!Number.isSafeInteger(c.at)||c.at<0)throw fail(400,'Página inválida.');where.push('(favorite<? OR (favorite=? AND (updated_at<? OR (updated_at=? AND id>?))))');args.push(c.favorite,c.favorite,c.at,c.at,c.id);}
  const found=rows('SELECT id,favorite,updated_at,summary FROM task_locator'+(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY favorite DESC,updated_at DESC,id LIMIT 25',...args),page=found.slice(0,24),last=page.at(-1);
  return {ok:true,items:page.map(r=>JSON.parse(r.summary)),next:found.length>24?{id:last.id,favorite:last.favorite,at:last.updated_at}:null};
 }
 function handle(op,b){
  if(op==='locatorList')return list(b);
  if(op==='locatorSave')return save(b);
  if(op==='locatorGet'){const row=get(b.id);if(!row)throw fail(404,'Arte não encontrada.');return {ok:true,item:JSON.parse(row.data)};}
  if(op==='locatorFavorite'){if(typeof b.favorite!=='boolean')throw fail(400,'Favorito inválido.');return transaction(()=>{const row=get(b.id);if(!row)throw fail(404,'Arte não encontrada.');const old=JSON.parse(row.data);if(old.favorite===b.favorite)return {ok:true,item:old};check(b.revision,old);const item={...old,favorite:b.favorite,revision:old.revision+1,updatedAt:Math.max(now(),old.updatedAt+1)};sql.exec('UPDATE task_locator SET favorite=?,revision=?,updated_at=?,summary=?,data=? WHERE id=?',Number(item.favorite),item.revision,item.updatedAt,JSON.stringify(summary(item)),JSON.stringify(item),item.id);return {ok:true,item};});}
  if(op==='locatorDelete')return transaction(()=>{const row=get(b.id);if(!row)return {ok:true};check(b.revision,JSON.parse(row.data));sql.exec('DELETE FROM task_locator_search WHERE rowid=?',row.rowid);sql.exec('DELETE FROM task_locator WHERE id=?',b.id);return {ok:true};});
  throw fail(400,'Operação inválida.');
 }
 return {handle};
}
module.exports={create,categories};
