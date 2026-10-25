const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {generate}=require('../scripts/build-daily-challenges.cjs'),{validateQuestion}=require('../functions/economy-quiz');
test('private deployment bank uses registered four-player rosters, real local photos and validated career clues',()=>{
 const bank=generate(),other=generate();assert.equal(bank.version,other.version);assert(bank.questions.length>100);assert.equal(new Set(bank.questions.map(q=>q.id)).size,bank.questions.length);
 for(const q of bank.questions){validateQuestion(q);if(q.kind==='lineup'){assert.equal(q.answers.length,4);assert.equal(q.options.length,8);assert.match(q.prompt,/cadastro de inscrição/);}if(q.kind==='player')assert(fs.existsSync(q.imagePath));if(q.kind==='career')assert(q.clues.length>=3);}
 for(const kind of ['player','lineup','career'])assert(bank.questions.some(q=>q.kind===kind));
 const placeholder=require('../functions/daily-challenges-seed');assert.equal(placeholder.questions.length,0,'only a blank placeholder belongs in the repository');
 assert.match(JSON.parse(fs.readFileSync('cloudflare/camp-notifications/package.json','utf8')).scripts.predeploy,/build-daily-challenges/);
});
test('deployment bundles compact portraits for every generated photo challenge without exposing the private bank',async()=>{
 const {buildPhotos}=require('../scripts/build-daily-challenge-photos.cjs'),bank=generate(),photos=await buildPhotos(bank);
 const paths=[...new Set(bank.questions.filter(q=>q.kind==='player').map(q=>q.imagePath))];assert.equal(Object.keys(photos).length,paths.length);
 let total=0;for(const path of paths){assert.match(photos[path],/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/);const bytes=Buffer.from(photos[path].split(',')[1],'base64');assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');assert(bytes.length<64*1024);total+=bytes.length;}
 assert(total<1024*1024);assert.deepEqual(require('../functions/daily-challenges-seed').photos,{});
});
