import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),E=require('../functions/economy.js');
const source=readFileSync(new URL('../js/admin-economy.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'');
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
function runtime(encoder=async()=>image){
 const sqlite=new DatabaseSync(':memory:'),sql={exec(q,...a){let result=[];for(const p of q.split(';').filter(s=>s.trim())){const st=sqlite.prepare(p);result=st.columns().length?st.all(...a):(st.run(...a),[]);}return result;}};E.initEconomy(sql);
 const core=E.createEconomy({sql,transaction:f=>{sqlite.exec('BEGIN');try{const r=f();sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}},db:{get:async()=>null}}),listeners={},messages={textContent:''},root={addEventListener:(type,fn)=>listeners[type]=fn,querySelector:()=>messages,querySelectorAll:()=>[]},calls=[];
 const fields={itemId:'item-game-upload',kind:'game',title:'Passe Premium',price:'100',description:'Passe do mês',assetId:'',imageUrl:'',enabled:'on'},file={name:'upload.png',type:'image/png'},form={elements:{itemPhoto:{files:[file]}},getAttribute:name=>name==='id'?'eco-item':null};
 // Simulate native named-property masking; reading form.id must not route submission.
 Object.defineProperty(form,'id',{get:()=>({tagName:'INPUT',name:'id'})});
 const user={uid:'admin',email:'admin@centralfreefire.com.br'},context={document:{getElementById:id=>id==='eco-admin-root'?root:messages},window:{CFF_CONFIG:{firebase:{}},addEventListener(){}},location:{hash:''},getApps:()=>[{name:'[DEFAULT]'}],getAuth:()=>({currentUser:user}),getDatabase:()=>({}),onAuthStateChanged(){},prepareEconomyPhoto:encoder,FormData:class{get(key){return fields[key]??null;}has(key){return key in fields;}},setInterval(){},URL,Date,crypto:globalThis.crypto,esc:String,economyRequest:async(_auth,op,body)=>{calls.push({op,body});if(op==='dashboard')throw Error('Read-after-save unavailable');return core.adminHandle(user,{operation:op,...body});}};
 runInNewContext(source,context);return {core,sql,form,file,fields,calls,messages,submit:()=>listeners.submit({preventDefault(){},target:form})};
}
const settle=async()=>{for(let n=0;n<8;n++)await new Promise(r=>setTimeout(r,0));};
test('uploaded game reward reaches the backend even when a named control masks form.id',async()=>{
 let encoded;const r=runtime(async file=>{encoded=file;return image;});r.submit();await settle();assert.equal(encoded,r.file);const save=r.calls.find(c=>c.op==='saveItem');assert(save);assert.equal(save.body.item.id,'item-game-upload');assert.equal(save.body.item.title,'Passe Premium');assert.equal(save.body.item.price,100);assert.equal(save.body.item.imageUrl,image);const product=JSON.parse(r.sql.exec('SELECT data FROM eco_items WHERE id=?','item-game-upload')[0].data);assert.equal(product.description,'Passe do mês');assert(product.imageUrl.includes('/economy-media/'));assert.equal(r.sql.exec('SELECT COUNT(*) AS n FROM eco_media')[0].n,1);
});
test('a photo conversion failure is visible beside the form and never creates a reward',async()=>{
 const r=runtime(async()=>{throw Error('Não foi possível abrir a foto.');});r.submit();await settle();assert.equal(r.messages.textContent,'Não foi possível abrir a foto.');assert(!r.calls.some(c=>c.op==='saveItem'));assert.equal(r.fields.title,'Passe Premium');assert.equal(r.sql.exec("SELECT COUNT(*) AS n FROM eco_items WHERE id='item-game-upload'")[0].n,0);
});
