const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const rules=JSON.parse(fs.readFileSync('database.rules.json','utf8')).rules;
const source=fs.readFileSync('js/public-account.js','utf8');
const auth={uid:'alice',token:{email:'alice@example.com'}};
function snapshot(tree,path=[]){
 const value=path.reduce((v,k)=>v?.[k],tree)??null;
 return {val:()=>value,exists:()=>value!==null,child:k=>{assert.equal(typeof k,'string');return snapshot(tree,[...path,...k.split('/')]);},parent:()=>snapshot(tree,path.slice(0,-1)),hasChildren:keys=>keys.every(k=>value?.[k]!=null),isString:()=>typeof value==='string',isNumber:()=>typeof value==='number',isBoolean:()=>typeof value==='boolean'};
}
function evaluate(expr,tree,path,old={}){
 return typeof expr==='boolean'?expr:Function('auth','$uid','newData','data','root','now','return Boolean('+expr.replaceAll('.matches(','.match(')+')')(
  auth,'alice',snapshot(tree,path),snapshot(old,path),snapshot(tree),Date.now());
}
function validate(node,tree,path,old){
 assert.equal(evaluate(node['.validate']??true,tree,path,old),true,path.join('/'));
 for(const key of Object.keys(snapshot(tree,path).val()||{})){
  const rule=node[key]||node.$other;
  assert(rule,'Unknown field '+key);
  assert.equal(evaluate(rule['.validate']??true,tree,[...path,key],old),true,path.join('/')+'/'+key);
 }
}
const base={name:'Matheus',username:'lukinha_45',gender:'masculino',createdAt:123,motto:'',avatarId:'default',avatarRingColor:'#FFFFFF',theme:'cyan',mainTeam:'',favoritePlayer:'',teamIdsJson:'[]',featuredBadgesJson:'[]',coverId:'',public:true};
test('changing a nickname preserves inherited artwork and passes private/public rules atomically',async()=>{
 let changes;const toasts=[];
 const context=vm.createContext({profile:{...base},editVisualDraft:null,user:{uid:'alice'},database:{},lists:{favorites:{}},options:{teams:[]},DEFAULT_RING_COLOR:'#FFFFFF',FormData:class{constructor(form){this.values=form.values;}get(k){return this.values[k]??null;}getAll(k){return this.values[k]||[];}},profileModerationReason:()=>'',toast:x=>toasts.push(x),ref:()=>({}),update:async(_,data)=>{changes=data;},syncMember:async()=>{},clearEditVisualDraft:()=>{},render:()=>{},updateAccountAccess:()=>{},syncPublicIdentity:async()=>{},message:()=>'',avatarId:()=> 'restricted-art'});
 vm.runInContext(source.match(/function ensureEditVisualDraft\(\)[^\n]+/)[0],context);
 const draft=vm.runInContext('ensureEditVisualDraft()',context);
 assert.equal(draft.avatarId,'default');
 const submit={disabled:false},form={values:{displayName:'LukinhA',motto:'',avatarId:draft.avatarId,coverId:draft.coverId,avatarRingColor:'#FFFFFF',theme:'cyan',stage:'final',teamIds:[]},querySelector:()=>submit,dataset:{dirty:'1'}};
 vm.runInContext(source.match(/async function saveProfile\(e\)[^\n]+/)[0],context);
 await context.saveProfile({preventDefault(){},currentTarget:form});
 assert.equal(changes['userAccounts/alice/profile'].name,'LukinhA');
 assert.equal(changes['communityProfiles/alice'].avatarId,'default');
 const tree={communityUsernames:{lukinha_45:'alice'},communityProfileCatalog:{'restricted-art':{kind:'avatar',enabled:true,accessRule:'admin'}},userAccounts:{alice:{profile:changes['userAccounts/alice/profile'],preferences:{stage:changes['userAccounts/alice/preferences/stage']}}},communityProfiles:{alice:changes['communityProfiles/alice']}};
 validate(rules.userAccounts.$uid.profile,tree,['userAccounts','alice','profile']);
 validate(rules.communityProfiles.$uid,tree,['communityProfiles','alice']);
 validate(rules.userAccounts.$uid.preferences,tree,['userAccounts','alice','preferences']);
 assert.equal(submit.disabled,false);assert.equal(form.dataset.dirty,'');assert.deepEqual(toasts,['Perfil salvo.']);
 form.dataset.dirty='1';form.values.displayName='Ainda editando';
 context.update=async()=>{throw Object.assign(new Error('Denied'),{code:'PERMISSION_DENIED'});};
 context.render=()=>assert.fail('A failed save must not replace the edited form');
 await context.saveProfile({preventDefault(){},currentTarget:form});
 assert.equal(form.dataset.dirty,'1');assert.equal(form.values.displayName,'Ainda editando');
 assert.equal(context.profile.name,'LukinhA');assert.equal(submit.disabled,false);
 assert.equal(toasts.at(-1),'O perfil não foi salvo porque uma alteração foi recusada. Suas edições continuam no formulário.');
});
for(const field of ['avatarId','coverId']){
 test(field+': public artwork without an unlockBadge field is allowed',()=>{
  for(const access of [undefined,'all','badge'])for(const node of [rules.userAccounts.$uid.profile,rules.communityProfiles.$uid]){
   const item={kind:field==='avatarId'?'avatar':'cover',enabled:true,...(access?{accessRule:access}:{})};
   const tree={communityProfileCatalog:{art:item},candidate:'art'};
   assert.equal(evaluate(node[field]['.validate'],tree,['candidate']),true);
  }
 });
 test(field+': restricted, disabled and wrong-kind artwork stays protected',()=>{
  for(const node of [rules.userAccounts.$uid.profile,rules.communityProfiles.$uid]){
   const kind=field==='avatarId'?'avatar':'cover';
   for(const item of [{kind,enabled:false},{kind:kind==='avatar'?'cover':'avatar',enabled:true},{kind,enabled:true,accessRule:'admin'},{kind,enabled:true,accessRule:'badge',unlockBadge:'winner'},{kind,enabled:true,accessRule:'gift'}]){
    assert.equal(evaluate(node[field]['.validate'],{communityProfileCatalog:{art:item},candidate:'art'},['candidate']),false);
   }
   const tree={communityProfileCatalog:{art:{kind,enabled:true,accessRule:'badge',unlockBadge:'winner'}},communityBadgeOwnership:{alice:{winner:true}},candidate:'art'};
   assert.equal(evaluate(node[field]['.validate'],tree,['candidate']),true);
   tree.communityBadgeOwnership={};tree.communityImageOwnership={alice:{art:{grantedAt:123}}};
   assert.equal(evaluate(node[field]['.validate'],tree,['candidate']),true);
   tree.communityProfileCatalog.art.accessRule='admin';tree.communityImageOwnership={};tree.communityAccountRoles={alice:{administrator:true}};
   assert.equal(evaluate(node[field]['.validate'],tree,['candidate']),true);
  }
 });
}
test('both edit entry points preserve stored avatar IDs and denied saves keep the form',()=>{
 assert(!source.includes('avatarId:avatarId(),coverId:String(profile.coverId'));
 assert(source.includes("avatarId:String(profile.avatarId||'default'),coverId:String(profile.coverId||'')"));
 assert(!source.includes('As permissões da área pessoal ainda estão sendo configuradas'));
 assert(source.includes('Suas edições continuam no formulário.'));
 assert.equal(evaluate(rules.userAccounts.$uid['.write'],{},[]),true);
 assert.equal(Function('auth','$uid','return '+rules.userAccounts.$uid['.write'])({...auth,uid:'bob'},'alice'),false);
});
