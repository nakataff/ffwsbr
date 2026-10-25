const fs=require('node:fs');
const assert=require('node:assert/strict');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
function syntheticFixture(){
 const uid='alice',profile={name:'Matheus',username:'alice',gender:'masculino',createdAt:Date.now()-1000,motto:'',avatarId:'default',avatarRingColor:'#FFFFFF',theme:'cyan',mainTeam:'',favoritePlayer:'',teamIdsJson:'[]',featuredBadgesJson:'[]',coverId:'',public:true};
 const {gender,createdAt,...publicProfile}=profile;
 return{uid,root:{userAccounts:{[uid]:{profile}},communityProfiles:{[uid]:publicProfile},communityUsernames:{alice:uid},communityProfileCatalog:{freeAvatar:{kind:'avatar',enabled:true,accessRule:'all'},lockedAvatar:{kind:'avatar',enabled:true,accessRule:'admin'},freeCover:{kind:'cover',enabled:true,accessRule:'all'}}}};
}
async function main(){
 if(!process.env.FIREBASE_DATABASE_EMULATOR_HOST)throw Error('Only run against the local emulator');
 const {root,uid}=process.env.PROFILE_DIAGNOSTIC_FIXTURE?JSON.parse(fs.readFileSync(process.env.PROFILE_DIAGNOSTIC_FIXTURE,'utf8')):syntheticFixture();
 const env=await initializeTestEnvironment({projectId:'demo-profile-save',database:{host:'127.0.0.1',port:19000,rules:fs.readFileSync('database.rules.json','utf8')}});
 try{
  await env.withSecurityRulesDisabled(ctx=>ctx.database().ref().set(root));
  const profile=root.userAccounts[uid].profile;
  const next={...profile,name:'Novo apelido',motto:String(profile.motto||''),avatarId:profile.avatarId||'default',avatarRingColor:profile.avatarRingColor||'#FFFFFF',theme:profile.theme||'cyan',mainTeam:profile.mainTeam||'',favoritePlayer:profile.favoritePlayer||'',teamIdsJson:profile.teamIdsJson||'[]',featuredBadgesJson:profile.featuredBadgesJson||'[]',coverId:profile.coverId||'',public:true};
  const visible={...(next.username?{username:next.username}:{}),...Object.fromEntries(['name','motto','avatarId','avatarRingColor','theme','mainTeam','favoritePlayer','teamIdsJson','featuredBadgesJson','coverId','public'].map(k=>[k,next[k]])),communityStyle:next.communityStyle||''};
  const db=env.authenticatedContext(uid,{email:'member@example.com'}).database();
  const updates={['userAccounts/'+uid+'/profile']:next,['communityProfiles/'+uid]:visible,['userAccounts/'+uid+'/preferences/stage']:'classificatoria'};
  try{await db.ref().update(updates);assert.equal((await db.ref('userAccounts/'+uid+'/profile/name').get()).val(),'Novo apelido');assert.equal((await db.ref('communityProfiles/'+uid+'/name').get()).val(),'Novo apelido');console.log('Complete profile save: PASS');}catch{
   console.log('Complete profile save: DENIED');
   for(const [key,value] of Object.entries(updates)){
    await env.withSecurityRulesDisabled(ctx=>ctx.database().ref().set(root));
    try{await db.ref(key).set(value);console.log(key.endsWith('/stage')?'Preferences stage: PASS':key.startsWith('userAccounts')?'Private profile: PASS':'Public profile: PASS');}catch{console.log(key.endsWith('/stage')?'Preferences stage: DENIED':key.startsWith('userAccounts')?'Private profile: DENIED':'Public profile: DENIED');}
   }
   
   for(const [field,value] of Object.entries(visible)){
    await env.withSecurityRulesDisabled(ctx=>ctx.database().ref().set(root));
    try{await db.ref('communityProfiles/'+uid+'/'+field).set(value);console.log('Public field '+field+': PASS');}catch{console.log('Public field '+field+': DENIED');}
   }
process.exitCode=1;
  }
  if(!process.exitCode){
   for(const style of ['', 'level-novato','level-participante','level-veterano','level-elite','level-lenda'])await db.ref().update({['userAccounts/'+uid+'/profile/communityStyle']:style,['communityProfiles/'+uid+'/communityStyle']:style});
   await assert.rejects(db.ref().update({['userAccounts/'+uid+'/profile/communityStyle']:'admin',['communityProfiles/'+uid+'/communityStyle']:'admin'}));
   await assert.rejects(env.authenticatedContext('other',{email:'other@example.com'}).database().ref().update(updates));
   if(!process.env.PROFILE_DIAGNOSTIC_FIXTURE){
    await db.ref().update({['userAccounts/'+uid+'/profile/avatarId']:'freeAvatar',['communityProfiles/'+uid+'/avatarId']:'freeAvatar',['userAccounts/'+uid+'/profile/coverId']:'freeCover',['communityProfiles/'+uid+'/coverId']:'freeCover'});
    await assert.rejects(db.ref().update({['userAccounts/'+uid+'/profile/avatarId']:'lockedAvatar',['communityProfiles/'+uid+'/avatarId']:'lockedAvatar'}));
   }
   if(!process.env.PROFILE_DIAGNOSTIC_FIXTURE){
    await env.withSecurityRulesDisabled(ctx=>ctx.database().ref().update({['communityProfileCatalog/freeFrame']:{kind:'frame',enabled:true,accessRule:'all'},['communityProfileCatalog/lockedFrame']:{kind:'frame',enabled:true,accessRule:'manual'},['communityProfileCatalog/winner']:{kind:'badge',enabled:true},['communityMembers/'+uid]:{name:'Alice',joinedAt:Date.now()}}));
    const frameChanges=id=>({['userAccounts/'+uid+'/profile/frameId']:id,['communityProfiles/'+uid+'/frameId']:id});
    await db.ref().update(frameChanges('freeFrame'));await db.ref().update(frameChanges(''));
    await assert.rejects(db.ref().update(frameChanges('lockedFrame')));
    await assert.rejects(db.ref().update(frameChanges('freeAvatar')));
    await assert.rejects(env.authenticatedContext('other',{email:'other@example.com'}).database().ref().update(frameChanges('freeFrame')));
    const at=Date.now(),grant={badgeId:'winner',reason:'Premiação rápida',week:'2026-10-16',grantedAt:at,status:'active'},gift={assetId:'winner',kind:'badge',message:'Parabéns!',grantedAt:at},award={['communityBadgeGrants/'+uid+'/grant-quick-test']:grant,['communityBadgeOwnership/'+uid+'/winner']:true,['communityGifts/'+uid+'/gift-quick-test']:gift};
    await assert.rejects(db.ref().update(award));
    await env.authenticatedContext('admin',{email:'admin@centralfreefire.com.br'}).database().ref().update(award);
    assert.equal((await db.ref('communityBadgeOwnership/'+uid+'/winner').get()).val(),true);
    assert.equal((await db.ref('communityGifts/'+uid+'/gift-quick-test/assetId').get()).val(),'winner');
    assert.equal((await db.ref('userAccounts/'+uid+'/profile/avatarId').get()).val(),'freeAvatar');
    assert.equal((await db.ref('userAccounts/'+uid+'/profile/coverId').get()).val(),'freeCover');
    console.log('Direct frame changes and atomic administrator badge gifts: PASS');
   }
   console.log('Known styles, empty style, image access and owner isolation: PASS');
  }
 }finally{await env.cleanup();}
}
main().catch(()=>{console.error('Emulator regression could not finish');process.exitCode=1;});
