import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {BUILTIN_FRAMES,frameChoices,selectedFrame,frameScaleFor} from '../js/profile-frame-model.mjs';
const require=createRequire(import.meta.url),{editProfile}=require('../functions/admin-profile-editor.js');
const rules=JSON.parse(readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')).rules;
function snap(value){return {val:()=>value??null,exists:()=>value!==undefined&&value!==null,child:path=>snap(path.split('/').reduce((v,k)=>v?.[k],value)),isString:()=>typeof value==='string',isNumber:()=>typeof value==='number'};}
function accepted(node,id,root={},admin=false){return Function('newData','data','root','auth','$uid','return Boolean('+node.frameId['.validate']+')')(snap(id),snap(null),snap(root),{uid:'person',token:{email:admin?'admin@centralfreefire.com.br':'fan@example.com'}},'person');}
test('frames remain separate from the avatar, reject unavailable choices, and bound the overlay size',()=>{
 const options={frames:BUILTIN_FRAMES},catalog={'asset-1':{kind:'frame',enabled:true,title:'Prata',accessRule:'manual'},'asset-2':{kind:'frame',enabled:false},'asset-3':{kind:'avatar',enabled:true}};
 assert.equal(frameChoices(options,catalog).length,2);
 assert.equal(selectedFrame({frameId:'frame-bronze-1'},options,catalog,()=>false).id,'frame-bronze-1');
 assert.equal(selectedFrame({frameId:'asset-1'},options,catalog,()=>false),null);
 assert.equal(selectedFrame({frameId:'asset-1'},options,catalog,()=>true).id,'asset-1');
 assert.equal(selectedFrame({frameId:'asset-3'},options,catalog,()=>true),null);
 for(const value of [undefined,NaN,0,5,'calc(999px)'])assert.equal(frameScaleFor({frameScale:value}),1.35);
 assert.equal(frameScaleFor({frameScale:1.6}),1.6);
});
test('both profile rules enforce frame kind, availability, badge grants, ownership and administrator-only art',()=>{
 for(const node of [rules.userAccounts.$uid.profile,rules.communityProfiles.$uid]){
  assert(accepted(node,''));assert(accepted(node,'frame-bronze-1'));
  for(const item of [{kind:'avatar',enabled:true},{kind:'frame',enabled:false},{kind:'frame',enabled:true,accessRule:'manual'},{kind:'frame',enabled:true,accessRule:'admin'},{kind:'frame',enabled:true,accessRule:'badge',unlockBadge:'asset-5'}])assert.equal(accepted(node,'asset-1',{communityProfileCatalog:{'asset-1':item}}),false);
  assert(accepted(node,'asset-1',{communityProfileCatalog:{'asset-1':{kind:'frame',enabled:true,accessRule:'all'}}}));
  assert(accepted(node,'asset-1',{communityProfileCatalog:{'asset-1':{kind:'frame',enabled:true,accessRule:'manual'}},communityImageOwnership:{person:{'asset-1':{source:'admin'}}}}));
  assert(accepted(node,'asset-1',{communityProfileCatalog:{'asset-1':{kind:'frame',enabled:true,accessRule:'badge',unlockBadge:'asset-5'}},communityBadgeOwnership:{person:{'asset-5':true}}}));
  assert(accepted(node,'asset-1',{communityProfileCatalog:{'asset-1':{kind:'frame',enabled:true,accessRule:'admin'}},communityAccountRoles:{person:{administrator:true}}}));
 }
});
test('production profile saves synchronize and remove a frame without replacing the chosen photo or cover',async()=>{
 let write;const original={name:'Fan',avatarId:'player-mt7-fluxo-w7m',coverId:'asset-2',avatarRingColor:'#FFFFFF',featuredBadgesJson:'[]'};
 const form={values:{displayName:'Fan',motto:'',avatarId:original.avatarId,coverId:original.coverId,frameId:'frame-bronze-1',avatarRingColor:'#FFFFFF',theme:'cyan',stage:'final',teamIds:[]},querySelector:()=>({disabled:false}),dataset:{dirty:'1'}};
 const context=vm.createContext({profile:original,user:{uid:'person'},database:{},lists:{favorites:{}},options:{teams:[]},DEFAULT_RING_COLOR:'#FFFFFF',FormData:class{constructor(form){this.values=form.values;}get(k){return this.values[k]??null;}getAll(k){return this.values[k]||[];}},profileModerationReason:()=>'',toast(){},ref:()=>({}),update:async(_,changes)=>{write=changes;},clearEditVisualDraft(){},syncMember:async()=>{},render(){},updateAccountAccess(){},syncPublicIdentity:async()=>{},message:e=>e.message});
 const source=readFileSync(new URL('../js/public-account.js',import.meta.url),'utf8');vm.runInContext(source.match(/async function saveProfile\(e\)[^\n]+/)[0],context);
 await context.saveProfile({preventDefault(){},currentTarget:form});
 for(const path of ['userAccounts/person/profile','communityProfiles/person']){assert.equal(write[path].frameId,'frame-bronze-1');assert.equal(write[path].avatarId,original.avatarId);assert.equal(write[path].coverId,original.coverId);}
 form.values.frameId='';await context.saveProfile({preventDefault(){},currentTarget:form});assert.equal(write['communityProfiles/person'].frameId,'');assert.equal(write['communityProfiles/person'].avatarRingColor,'#FFFFFF');
});
test('administrator frame assignment grants locked artwork and updates private/public profiles atomically',async()=>{
 const data={userAccounts:{person:{profile:{name:'Fan',createdAt:123,avatarId:'default',coverId:'',teamIdsJson:'[]'}}},communityProfileCatalog:{'asset-1':{kind:'frame',enabled:true,accessRule:'manual'}}};let writes=0;
 const get=path=>path.split('/').reduce((v,k)=>v?.[k],data);
 const db={ref:(path='')=>({get:async()=>({val:()=>get(path),exists:()=>get(path)!==undefined}),update:async changes=>{writes++;for(const [path,value]of Object.entries(changes)){const bits=path.split('/');let n=data;for(const bit of bits.slice(0,-1))n=n[bit]||={};n[bits.at(-1)]=value;}}})};
 await editProfile(db,{uid:'owner',email:'admin@centralfreefire.com.br'},'person',{frameId:'asset-1'});
 assert.equal(writes,1);assert.equal(get('communityProfiles/person/frameId'),'asset-1');assert.equal(get('userAccounts/person/profile/avatarId'),'default');assert.equal(get('communityImageOwnership/person/asset-1/source'),'admin');
 await assert.rejects(editProfile(db,{uid:'owner',email:'admin@centralfreefire.com.br'},'person',{frameId:'https://evil.test/frame'}),{status:400});assert.equal(writes,1);
});
