const {test}=require('node:test'),assert=require('node:assert/strict');
const {readProfile,editProfile}=require('../admin-profile-editor');
const admin={uid:'admin',email:'admin@centralfreefire.com.br',email_verified:true};
function database(){
 const data={userAccounts:{person:{profile:{name:'Antes',createdAt:123,motto:'Lema',avatarId:'default',coverId:'',avatarRingColor:'#64D8FF',theme:'cyan',mainTeam:'',favoritePlayer:'',teamIdsJson:'[]',featuredBadgesJson:'[]',public:true},community:{session:'private'},preferences:{stage:'final'}}},communityInstagramLinks:{person:{username:'fan'}},communityRankingProfiles:{fan:{uid:'person',username:'fan',avatarId:'default',administrator:false}},communityProfileCatalog:{'asset-1':{kind:'avatar',enabled:true,accessRule:'manual'}}};
 const get=path=>path.split('/').reduce((v,k)=>v?.[k],data)??null;let writes=0;
 return {data,get,get writes(){return writes;},ref(path=''){return {async get(){const value=get(path);return {val:()=>value,exists:()=>value!==null};},async update(changes){writes++;for(const [path,value]of Object.entries(changes)){const keys=path.split('/');let target=data;for(const k of keys.slice(0,-1))target=target[k]||=( {} );target[keys.at(-1)]=value;}}};}};
}
test('admin authority is validated server-side; cosmetic seal and UID spoof cannot grant access',async()=>{
 const db=database();for(const identity of [{uid:'person',email:'fan@test',email_verified:true,administrator:true},{uid:'person',email:'fan@test',admin:true}]){
  await assert.rejects(readProfile(db,identity,'person'),{status:403});await assert.rejects(editProfile(db,identity,'person',{name:'Changed'}),{status:403});
 }await assert.rejects(editProfile(db,admin,'../admin',{name:'Changed'}),{status:400});assert.equal(db.writes,0);
});
test('admin editor synchronizes public profile and ranking without changing private account data',async()=>{
 const db=database(),result=await readProfile(db,admin,'person');assert.equal(result.profile.createdAt,undefined);assert.equal(result.profile.session,undefined);
 await editProfile(db,admin,'person',{name:'Depois',motto:'Novo lema',avatarId:'asset-1',teamIdsJson:'["team-fluxo-w7m"]',mainTeam:'team-fluxo-w7m',favoritePlayer:'player-mt7-fluxo-w7m'});
 assert.equal(db.get('userAccounts/person/profile/createdAt'),123);assert.equal(db.get('userAccounts/person/community/session'),'private');assert.equal(db.get('userAccounts/person/preferences/stage'),'final');assert.equal(db.get('communityProfiles/person/name'),'Depois');assert.equal(db.get('communityMembers/person/name'),'Depois');assert.equal(db.get('communityRankingProfiles/fan/avatarId'),'asset-1');assert.equal(db.get('communityRankingProfiles/fan/administrator'),false);assert.equal(db.get('communityImageOwnership/person/asset-1/source'),'admin');assert.equal(db.writes,1);
});
test('rejects invalid fields, unknown assets, invalid favorites and oversized motto before writing',async()=>{
 for(const profile of [{administrator:true},{createdAt:0},{name:''},{motto:'x'.repeat(81)},{avatarId:'https://evil.test/a'},{avatarId:'asset-99'},{avatarRingColor:'red'},{theme:'unknown'},{teamIdsJson:'null'},{teamIdsJson:'["team-fluxo-w7m","team-fluxo-w7m"]'},{teamIdsJson:'["evil"]'},{mainTeam:'team-fluxo-w7m'},{favoritePlayer:'evil'}]){const db=database();await assert.rejects(editProfile(db,admin,'person',profile),{status:400});assert.equal(db.writes,0);}
});
test('admin-only art stays restricted to administrator profiles',async()=>{const db=database();db.data.communityProfileCatalog['asset-2']={kind:'avatar',enabled:true,accessRule:'admin'};await assert.rejects(editProfile(db,admin,'person',{avatarId:'asset-2'}),{status:400});assert.equal(db.writes,0);});

test('existing password administrator can edit without an email verification flag',async()=>{const db=database();await editProfile(db,{...admin,email_verified:false},'person',{name:'Administrador corrigiu'});assert.equal(db.get('communityProfiles/person/name'),'Administrador corrigiu');});

test('saving an unindexed minimal Google profile creates a complete member and public profile',async()=>{
 const db=database();db.data.userAccounts.person.profile={name:'Inicial',createdAt:123};delete db.data.communityInstagramLinks;delete db.data.communityRankingProfiles;
 await editProfile(db,admin,'person',{name:'Publicado'});
 assert.deepEqual(db.get('communityMembers/person'),{name:'Publicado',instagram:'',joinedAt:123});
 const publicProfile=db.get('communityProfiles/person');for(const field of ['name','motto','avatarId','theme','mainTeam','favoritePlayer','teamIdsJson','featuredBadgesJson','coverId','public'])assert(Object.hasOwn(publicProfile,field),field);
 assert.equal(publicProfile.public,true);assert.equal(db.get('userAccounts/person/profile/createdAt'),123);assert.equal(db.get('userAccounts/person/community/session'),'private');assert.equal(db.writes,1);
});
test('existing member keeps original joined date and Instagram while name changes',async()=>{
 const db=database();db.data.communityMembers={person:{name:'Antes',instagram:'already_verified',joinedAt:456}};
 await editProfile(db,admin,'person',{name:'Depois'});
 assert.deepEqual(db.get('communityMembers/person'),{name:'Depois',instagram:'already_verified',joinedAt:456});
});
