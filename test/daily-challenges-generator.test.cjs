const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {generate}=require('../scripts/build-daily-challenges.cjs'),{validateQuestion}=require('../functions/economy-quiz');
test('private deployment bank uses registered four-player rosters, real local photos and validated career clues',()=>{
 const bank=generate(),other=generate();assert.equal(bank.version,other.version);assert(bank.questions.length>100);assert.equal(new Set(bank.questions.map(q=>q.id)).size,bank.questions.length);
 for(const q of bank.questions){validateQuestion(q);if(q.kind==='lineup'){assert.equal(q.answers.length,4);assert.equal(q.options.length,8);assert.match(q.prompt,/cadastro de inscrição/);}if(q.kind==='player')assert(fs.existsSync(q.imagePath));if(q.kind==='career')assert(q.clues.length>=3);}
 for(const kind of ['player','lineup','career'])assert(bank.questions.some(q=>q.kind===kind));
 const placeholder=require('../functions/daily-challenges-seed');assert.equal(placeholder.questions.length,0,'only a blank placeholder belongs in the repository');
 assert.match(JSON.parse(fs.readFileSync('cloudflare/camp-notifications/package.json','utf8')).scripts.predeploy,/build-daily-challenges/);
});
