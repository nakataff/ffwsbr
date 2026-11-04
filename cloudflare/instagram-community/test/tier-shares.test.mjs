import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {gzipSync} from 'node:zlib';
import {TIER_SHARE_SCHEMA, TIER_SHARE_LIFETIME_MS, TIER_SHARE_MAX_ENCODED, createTierShare, getTierShare, purgeExpiredTierShares} from '../tier-shares.js';

function fixture() {
  const sqlite=new DatabaseSync(':memory:');
  for(const ddl of TIER_SHARE_SCHEMA) sqlite.exec(ddl);
  const db={
    prepare(query){
      return {bind(...params){
        return {
          async run(){const result=sqlite.prepare(query).run(...params);return {meta:{changes:Number(result.changes)}};},
          async first(){return sqlite.prepare(query).get(...params)||null;}
        };
      }};
    }
  };
  return {DB:db,sqlite,close(){sqlite.close();}};
}
function payload(data={version:1,state:{rows:[],images:{},bank:[],caption:'Meus times'}}){
  return 'r.'+Buffer.from(JSON.stringify(data)).toString('base64url');
}
function post(body,origin='https://centralfreefire.com.br',ip='192.0.2.1'){
  return new Request('https://cff-instagram-community.nakataffb4.workers.dev/api/tier-share',{
    method:'POST',headers:{'Origin':origin,'Content-Type':'application/json','CF-Connecting-IP':ip},
    body:JSON.stringify({payload:body})
  });
}
const get=id=>new Request('https://cff-instagram-community.nakataffb4.workers.dev/api/tier-share/'+id);
test('cria URL compartilhável de somente 12 caracteres e salva o projeto sem exigir conta',async()=>{
  const f=fixture();
  try{
    const original=payload();
    const response=await createTierShare(post(original),f);
    assert.equal(response.status,201);
    const created=await response.json();
    assert.equal(created.ok,true);
    assert.match(created.id,/^[A-Za-z0-9_-]{12}$/);
    assert(created.expiresAt>Date.now()+3600000);
    const download=await getTierShare(get(created.id),f,created.id);
    assert.equal(download.status,200);
    const loaded=await download.json();
    assert.equal(loaded.payload,original);
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM tier_share_links').get().n,1);
    assert.equal((await getTierShare(get('ABCDEF123456'),f,'ABCDEF123456')).status,404);
  }finally{f.close();}
});
test('links não aceitam origem de outros sites, payload inválido ou código inventado',async()=>{
 const f=fixture();
 try{
  assert.equal((await createTierShare(post(payload(),'https://example.org'),f)).status,403);
  assert.equal((await createTierShare(post('r.not-a-real-project'),f)).status,413);
  assert.equal((await createTierShare(post(payload({version:5,state:{rows:[],images:{}}})),f)).status,413);
  assert.equal((await getTierShare(get('invalid'),f,'invalid')).status,400);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM tier_share_links').get().n,0);
 }finally{f.close();}
});
test('suporta gzip e rejeita bombas de descompressão antes de armazenar',async()=>{
 const f=fixture();
 try{
  const data={version:1,state:{rows:[],images:{},caption:'tier teste'}};
  const compressed='g.'+gzipSync(JSON.stringify(data)).toString('base64url');
  const response=await createTierShare(post(compressed,'https://centralfreefire.com.br','192.0.2.2'),f);
  assert.equal(response.status,201);
  const bomb='g.'+gzipSync(JSON.stringify({version:1,state:{rows:[],images:{},caption:'X'.repeat(2_100_000)}})).toString('base64url');
  const rejected=await createTierShare(post(bomb,'https://centralfreefire.com.br','192.0.2.2'),f);
  assert.equal(rejected.status,413);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM tier_share_links').get().n,1);
 }finally{f.close();}
});
test('limite diário reduz spam, links expiram após um ano e limpeza remove os vencidos',async()=>{
 const f=fixture(),originalNow=Date.now,base=Date.parse('2026-11-04T12:00:00Z');
 try{
  Date.now=()=>base;
  for(let i=0;i<60;i++){
    const r=await createTierShare(post(payload(),'https://centralfreefire.com.br','192.0.2.3'),f);
    assert.equal(r.status,201);
  }
  assert.equal((await createTierShare(post(payload(),'https://centralfreefire.com.br','192.0.2.3'),f)).status,429);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM tier_share_links').get().n,60);
  const first=f.sqlite.prepare('SELECT id FROM tier_share_links ORDER BY created_at LIMIT 1').get().id;
  Date.now=()=>base+TIER_SHARE_LIFETIME_MS+1;
  assert.equal((await getTierShare(get(first),f,first)).status,404);
  await purgeExpiredTierShares(f.DB);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM tier_share_links').get().n,0);
 }finally{Date.now=originalNow;f.close();}
});
test('o teto do payload respeita o limite de 2MB do D1',()=>{
 assert(TIER_SHARE_MAX_ENCODED<2_000_000);
});
