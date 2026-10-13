const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
async function main(){
 if(!process.env.FIREBASE_DATABASE_EMULATOR_HOST)throw Error('Only run against the local emulator');
 const env=await initializeTestEnvironment({projectId:'demo-global-chat',database:{host:'127.0.0.1',port:19000,rules:fs.readFileSync('database.rules.json','utf8')}});
 try{
  await env.withSecurityRulesDisabled(ctx=>ctx.database().ref().set({communityAccountRoles:{mod:{roleId:'moderator'},cosmetic:{roleId:'administrator',administrator:true}},globalChat:{messages:{'1791910000000-0123456789abcdef':{uid:'alice',name:'Alice',avatarId:'default',roleId:'member',text:'Olá',at:1791910000000}},restrictions:{alice:{blocked:true,reason:'Teste',by:'mod',at:1791910000000}},limits:{alice:{lastAt:1791910000000,textKey:'ola'}}}}));
  const anonymous=env.unauthenticatedContext().database(),alice=env.authenticatedContext('alice',{email:'alice@example.test'}).database(),other=env.authenticatedContext('other',{email:'other@example.test'}).database(),mod=env.authenticatedContext('mod',{email:'mod@example.test'}).database(),cosmetic=env.authenticatedContext('cosmetic',{email:'cosmetic@example.test'}).database(),admin=env.authenticatedContext('admin',{email:'admin@centralfreefire.com.br'}).database();
  await assertSucceeds(anonymous.ref('globalChat/messages').orderByKey().limitToLast(100).once('value'));
  await assertFails(anonymous.ref('globalChat/messages').once('value'));
  await assertFails(anonymous.ref('globalChat/messages').limitToLast(101).once('value'));
  await assertSucceeds(alice.ref('globalChat/restrictions/alice').once('value'));
  await assertFails(anonymous.ref('globalChat/restrictions/alice').once('value'));
  await assertFails(other.ref('globalChat/restrictions/alice').once('value'));
  await assertSucceeds(mod.ref('globalChat/restrictions').once('value'));
  await assertSucceeds(admin.ref('globalChat/restrictions').once('value'));
  await assertFails(cosmetic.ref('globalChat/restrictions').once('value'));
  for(const db of [alice,mod,admin]){await assertFails(db.ref('globalChat/messages/fake').set({text:'fake'}));await assertFails(db.ref('globalChat/messages/1791910000000-0123456789abcdef').remove());await assertFails(db.ref('globalChat/restrictions/alice').remove());await assertFails(db.ref('globalChat/limits/alice').once('value'));await assertFails(db.ref('globalChat/limits/alice').set({lastAt:0}));}
  await assertFails(alice.ref('communityAccountRoles/alice/roleId').set('moderator'));
  console.log('Global chat: bounded public history, private restrictions, and server-only writes passed.');
 }finally{await env.cleanup();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
