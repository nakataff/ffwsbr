const fs=require('node:fs');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
async function main(){
 if(!process.env.FIREBASE_DATABASE_EMULATOR_HOST)throw Error('Only run against the local emulator');
 const {root,uid}=JSON.parse(fs.readFileSync(process.env.PROFILE_DIAGNOSTIC_FIXTURE,'utf8'));
 const env=await initializeTestEnvironment({projectId:'demo-profile-save',database:{host:'127.0.0.1',port:19000,rules:fs.readFileSync('database.rules.json','utf8')}});
 try{
  await env.withSecurityRulesDisabled(ctx=>ctx.database().ref().set(root));
  const profile=root.userAccounts[uid].profile;
  const next={...profile,name:profile.name,motto:String(profile.motto||''),avatarId:profile.avatarId||'default',avatarRingColor:profile.avatarRingColor||'#FFFFFF',theme:profile.theme||'cyan',mainTeam:profile.mainTeam||'',favoritePlayer:profile.favoritePlayer||'',teamIdsJson:profile.teamIdsJson||'[]',featuredBadgesJson:profile.featuredBadgesJson||'[]',coverId:profile.coverId||'',public:true};
  const visible={...(next.username?{username:next.username}:{}),...Object.fromEntries(['name','motto','avatarId','avatarRingColor','theme','mainTeam','favoritePlayer','teamIdsJson','featuredBadgesJson','coverId','public'].map(k=>[k,next[k]])),communityStyle:next.communityStyle||''};
  const db=env.authenticatedContext(uid,{email:'member@example.com'}).database();
  const updates={['userAccounts/'+uid+'/profile']:next,['communityProfiles/'+uid]:visible,['userAccounts/'+uid+'/preferences/stage']:'classificatoria'};
  try{await db.ref().update(updates);console.log('Complete profile save: PASS');}catch{
   console.log('Complete profile save: DENIED');
   for(const [key,value] of Object.entries(updates)){
    await env.withSecurityRulesDisabled(ctx=>ctx.database().ref().set(root));
    try{await db.ref(key).set(value);console.log(key.endsWith('/stage')?'Preferences stage: PASS':key.startsWith('userAccounts')?'Private profile: PASS':'Public profile: PASS');}catch{console.log(key.endsWith('/stage')?'Preferences stage: DENIED':key.startsWith('userAccounts')?'Private profile: DENIED':'Public profile: DENIED');}
   }
   process.exitCode=1;
  }
 }finally{await env.cleanup();}
}
main().catch(()=>{console.error('Emulator regression could not finish');process.exitCode=1;});
