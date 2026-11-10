import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expiresForWeek,storeStoryPreview,purgeExpiredStoryPreviews,previewLink,getSignedStoryPreview,STORY_PREVIEW_SCHEMA} from '../story-previews.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const start=Date.parse('2026-10-25T16:00:00Z'),expiry=Date.parse('2026-10-27T03:00:00Z');
const original='https://scontent.cdninstagram.com/path/story.jpg';
const key='story:ig_a:123';
const bytes=Uint8Array.from([...new TextEncoder().encode('RIFF'),20,0,0,0,...new TextEncoder().encode('WEBPVP8 '),0,0,0,0,0,0,0,0]);
function mock(){const rows=new Map(),calls=[];return {rows,calls,db:{prepare(sql){calls.push(sql);return {bind(...values){return {async run(){if(sql.startsWith('INSERT'))rows.set(values[0],{image_b64:values[1],mime:values[2],expires_at:values[3]});if(sql.startsWith('DELETE'))for(const [k,v]of rows)if(v.expires_at<=values[0])rows.delete(k);return {success:true}},async first(){const row=rows.get(values[0]);return row&&row.expires_at>values[1]?row:null}}}}}}};}
test('weekly storage expires Tuesday midnight Brasilia, never Monday or earlier',()=>{
 assert.equal(expiresForWeek('2026-10-19'),expiry);
 assert.equal(expiresForWeek('2026-10-26'),Date.parse('2026-11-03T03:00:00Z'));
 assert.equal(expiresForWeek('bad'),0);
 assert(STORY_PREVIEW_SCHEMA.some(v=>v.includes('idx_story_thumbnails_expiry')));
});
test('only approved, recent and correctly resized WebP images can be stored',async()=>{
 const f=mock(),row={mention_key:key,week_key:'2026-10-19',event_at:start-5000,status:'approved',media_url:original};
 let resized=0;
 const load=async(url,options)=>{resized++;assert.equal(url,original);assert.equal(options.cf.image.width,288);assert.equal(options.cf.image.format,'webp');return new Response(bytes,{headers:{'content-type':'image/webp'}})};
 assert.equal(await storeStoryPreview({DB:f.db},row,{fetchImage:load,now:start}),true);
 assert.equal(f.rows.get(key).expires_at,expiry);assert.equal(resized,1);
 assert.equal(await storeStoryPreview({DB:f.db},{...row,status:'rejected'},{fetchImage:load,now:start}),false);
 assert.equal(await storeStoryPreview({DB:f.db},{...row,media_url:'https://untrusted.site/test.jpg'},{fetchImage:load,now:start}),false);
 assert.equal(await storeStoryPreview({DB:f.db},{...row,event_at:start-86400001},{fetchImage:load,now:start}),false);
 assert.equal(await storeStoryPreview({DB:f.db},row,{fetchImage:load,now:expiry}),false);
 assert.equal(resized,1);
});
test('reject oversized, non-WebP and inaccessible images rather than saving originals',async()=>{
 const f=mock(),row={mention_key:key,week_key:'2026-10-19',event_at:start,status:'approved',media_url:original};
 for(const payload of [new Uint8Array(36865),new TextEncoder().encode('<html>not an image</html>')]){
  const type=payload.length>10000?'image/webp':'text/html';
  assert.equal(await storeStoryPreview({DB:f.db},row,{fetchImage:async()=>new Response(payload,{headers:{'content-type':type}}),now:start}),false);
 }
 assert.equal(f.rows.size,0);
});
test('signed photo URLs cannot be forged, survive Instagram expiration, and are deleted Tuesday',async()=>{
 const f=mock(),secret='very-long-private-instagram-webhook-secret';
 const row={mention_key:key,week_key:'2026-10-19',event_at:start,status:'approved',media_url:original};
 await storeStoryPreview({DB:f.db},row,{fetchImage:async()=>new Response(bytes,{headers:{'content-type':'image/webp'}}),now:start});
 const signed=await previewLink(key,expiry,secret,start+10000);assert(signed.startsWith('/api/admin/story-preview?'));
 const u=new URL(signed,'https://example.test');
 const ok=await getSignedStoryPreview(null,{DB:f.db,META_APP_SECRET:secret},u,{now:start+11000});
 assert.equal(ok.status,200);assert.equal(ok.headers.get('cache-control'),'private, no-store');
 assert.deepEqual(new Uint8Array(await ok.arrayBuffer()),bytes);
 u.searchParams.set('sig','f'.repeat(64));assert.equal((await getSignedStoryPreview(null,{DB:f.db,META_APP_SECRET:secret},u,{now:start+11000})).status,403);
 assert.equal(f.rows.size,1);await purgeExpiredStoryPreviews(f.db,expiry-1);assert.equal(f.rows.size,1);
 await purgeExpiredStoryPreviews(f.db,expiry);assert.equal(f.rows.size,0);
});


test('Images binding converts Instagram JPEG into a real small WebP without cf.image assumptions',async()=>{
 const f=mock(),now=start;
 const row={mention_key:key,week_key:'2026-10-19',event_at:now,status:'approved',media_url:original};
 const source=Uint8Array.from([255,216,255,224,2,3,4,5,6,7,8,9]);
 const options=[],transform=[];
 const env={DB:f.db,IMAGES:{input(raw){
  assert.deepEqual(new Uint8Array(raw),source);
  return {transform(spec){
   transform.push(spec);
   return {async output(spec){
    options.push(spec);
    return {response(){return new Response(bytes,{headers:{'content-type':'image/webp'}})}};
   }};
  }};
 }}};
 const report={};
 const saved=await storeStoryPreview(env,row,{now,report,fetchImage:async(url,init)=>{
  assert.equal(url,original);
  assert.equal(init.redirect,'manual');
  assert.equal(init.cf,undefined,'raw bytes must not depend on URL Image Resizing');
  return new Response(source,{headers:{'content-type':'image/jpeg'}});
 }});
 assert.equal(saved,true);assert.equal(report.reason,'saved');
 assert.equal(f.rows.get(key).mime,'image/webp');
 assert.equal(transform[0].width,240);
 assert.equal(transform[0].height,427);
 assert.equal(options[0].format,'image/webp');
 assert.equal(options[0].quality,30);
});
test('retry diagnostics distinguish missing source, CDN failure, unsafe redirect and oversized results',async()=>{
 const f=mock(),row={mention_key:key,week_key:'2026-10-19',event_at:start,status:'approved',media_url:original};
 const report={};
 const output=Uint8Array.from([...new TextEncoder().encode('RIFF'),20,0,0,0,...new TextEncoder().encode('WEBPVP8 '),...new Uint8Array(40000)]);
 let conversions=0;
 const env={DB:f.db,IMAGES:{input:()=>({transform:()=>({output:async()=>({response:()=>{
  conversions++;
  return new Response(output,{headers:{'content-type':'image/webp'}});
 }})})})}};
 assert.equal(await storeStoryPreview(env,row,{now:start,report,fetchImage:async()=>new Response(bytes,{headers:{'content-type':'image/jpeg'}})}),false);
 assert.equal(report.reason,'thumbnail_too_large');assert.equal(conversions,2);
 assert.equal(f.rows.size,0);
 const noSource={};
 assert.equal(await storeStoryPreview(env,{...row,media_url:''},{now:start,report:noSource}),false);
 assert.equal(noSource.reason,'missing_media_url');
 const untrusted={};
 assert.equal(await storeStoryPreview(env,row,{now:start,report:untrusted,fetchImage:async()=>new Response(null,{status:302,headers:{location:'https://evil.example/secret'}})}),false);
 assert.equal(untrusted.reason,'unsafe_redirect');
 const notFound={};
 assert.equal(await storeStoryPreview(env,row,{now:start,report:notFound,fetchImage:async()=>new Response(null,{status:403})}),false);
 assert.equal(notFound.reason,'source_http_403');
});
test('admin retry endpoint is authenticated, accepts only eight approved story IDs and never scans D1',()=>{
 const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 assert(worker.includes("'/api/admin/story-previews/retry'"));
 const handler=worker.slice(worker.indexOf('async function retryAdminStoryPreviews('),worker.indexOf('async function getAdminStories('));
 assert(handler.includes('verifyAdminFirebaseToken(request,env)'));
 assert(handler.includes('keys.length>8'));
 assert(handler.includes('storeStoryPreview(env,row,{now,report})'));
 assert(!handler.includes('SELECT * FROM story_reviews'),'must fetch only selected ids');
});
