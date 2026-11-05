const fs=require('node:fs');
const assert=require('node:assert/strict');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
async function main(){
 if(!process.env.FIREBASE_DATABASE_EMULATOR_HOST)throw Error('Only run against the local emulator');
 const env=await initializeTestEnvironment({projectId:'demo-profile-save',database:{host:'127.0.0.1',port:19000,rules:fs.readFileSync('database.rules.json','utf8')}});
 const id='1793490000000-news-test';
 const base={id,title:'Notícia de teste',excerpt:'',category:'Resultados',date:'2026-10-31',cover:'',status:'draft',revision:1,liveRevision:0,sortKey:'2026-10-31_'+id,body:''};
 const meta=article=>Object.fromEntries(Object.entries(article).filter(([key])=>key!=='body'));
 const changes=(article,mode)=>({
  ['drafts/'+id]:article,['adminIndex/'+id]:meta(article),
  ...(mode==='published'?{['publicIndex/'+id]:meta(article),['articles/'+id]:article}:{}),
  ...(mode==='archived'?{['publicIndex/'+id]:null,['articles/'+id]:null}:{})
 });
 try{
  await env.withSecurityRulesDisabled(ctx=>ctx.database().ref().update({'serverSecurity/adminUid':'admin',nakaGamingNews:null}));
  const owner=env.authenticatedContext('admin',{email:'admin@centralfreefire.com.br'}).database();
  const anon=env.unauthenticatedContext().database();
  const visitor=env.authenticatedContext('visitor',{email:'visitor@example.com'}).database();
  await owner.ref('nakaGamingNews').update(changes(base,'draft'));
  await assertFails(anon.ref('nakaGamingNews/drafts').get());
  await assertFails(visitor.ref('nakaGamingNews/drafts/'+id).get());
  await assertFails(anon.ref('nakaGamingNews').get());
  await assertFails(visitor.ref('nakaGamingNews').update(changes({...base,revision:2},'draft')));
  assert.equal((await anon.ref('nakaGamingNews/publicIndex').get()).val(),null);
  const published={...base,status:'published',revision:2,liveRevision:2,body:'Texto que está no ar.'};
  await owner.ref('nakaGamingNews').update(changes(published,'published'));
  assert.equal((await anon.ref('nakaGamingNews/articles/'+id+'/body').get()).val(),published.body);
  assert.equal((await anon.ref('nakaGamingNews/publicIndex/'+id+'/body').get()).val(),null);
  await assertFails(owner.ref('nakaGamingNews/publicIndex/'+id).set(published));
  const edited={...published,title:'Título privado',body:'Rascunho novo.',status:'draft',revision:3};
  await owner.ref('nakaGamingNews').update(changes(edited,'draft'));
  assert.equal((await anon.ref('nakaGamingNews/articles/'+id+'/title').get()).val(),published.title);
  await assertFails(owner.ref('nakaGamingNews').update(changes({...published,title:'Conflito',revision:3,liveRevision:3},'published')));
  assert.equal((await anon.ref('nakaGamingNews/articles/'+id+'/title').get()).val(),published.title);
  const archived={...edited,status:'archived',revision:4,liveRevision:0};
  await owner.ref('nakaGamingNews').update(changes(archived,'archived'));
  assert.equal((await anon.ref('nakaGamingNews/articles/'+id).get()).val(),null);
  assert.equal((await owner.ref('nakaGamingNews/drafts/'+id+'/body').get()).val(),edited.body);
  const restored={...archived,status:'published',revision:5,liveRevision:5};
  await owner.ref('nakaGamingNews').update(changes(restored,'published'));
  assert.equal((await anon.ref('nakaGamingNews/articles/'+id+'/body').get()).val(),edited.body);
  await assertFails(anon.ref('nakaGamingNews').update(changes({...restored,revision:6,liveRevision:6},'published')));
  console.log('Naka news: owner access, drafts, atomic publication, revisions, metadata, archive and restore PASS');
 }finally{await env.cleanup();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
