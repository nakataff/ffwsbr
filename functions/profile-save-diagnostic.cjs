// Read-only diagnostic. Never logs account contents or writes to Firebase.
const fs=require('node:fs');
const {initializeApp,applicationDefault,deleteApp}=require('firebase-admin/app');
const {getDatabase}=require('firebase-admin/database');
const handle=String(process.env.PROFILE_DIAGNOSTIC_USERNAME||'');
if(!/^[a-z0-9_]{3,24}$/.test(handle))throw Error('Provide a valid profile username');
const app=initializeApp({credential:applicationDefault(),databaseURL:'https://central-free-fire-default-rtdb.firebaseio.com'});
function snapshot(tree,path=[]){const value=path.reduce((v,k)=>v?.[k],tree)??null;return{val:()=>value,exists:()=>value!==null,child:k=>{if(typeof k!=='string')throw Error('Invalid child path');return snapshot(tree,[...path,...k.split('/')]);},parent:()=>snapshot(tree,path.slice(0,-1)),hasChildren:keys=>keys.every(k=>value?.[k]!=null),isString:()=>typeof value==='string',isNumber:()=>typeof value==='number',isBoolean:()=>typeof value==='boolean'};}
async function main(){
 const db=getDatabase(app),read=async path=>(await db.ref(path).get()).val();
 let uid=await read('communityUsernames/'+handle);
 if(!uid){const profiles=(await db.ref('communityProfiles').orderByChild('username').equalTo(handle).limitToFirst(2).get()).val()||{};if(Object.keys(profiles).length===1)uid=Object.keys(profiles)[0];}
 if(!uid||!/^[-A-Za-z0-9_]{1,128}$/.test(uid))throw Error('Profile not uniquely indexed');
 const paths=['userAccounts/'+uid+'/profile','userAccounts/'+uid+'/preferences','communityProfiles/'+uid,'communityProfileCatalog','communityProfileDefaults','communityImageOwnership/'+uid,'communityBadgeOwnership/'+uid,'communityAccountRoles/'+uid,'communityUsernames/'+handle];
 const values=await Promise.all(paths.map(read)),root={};
 paths.forEach((path,i)=>{const keys=path.split('/');let node=root;for(const k of keys.slice(0,-1))node=node[k]??={};node[keys.at(-1)]=values[i];});
 const profile=values[0];if(profile?.username!==handle)throw Error('Account username does not match requested profile');
 if(process.env.PROFILE_DIAGNOSTIC_FIXTURE)fs.writeFileSync(process.env.PROFILE_DIAGNOSTIC_FIXTURE,JSON.stringify({root,uid}),{mode:0o600});
 const oldRoot=structuredClone(root);
 const rules=JSON.parse(fs.readFileSync('database.rules.json','utf8')).rules;
 const token=await app.options.credential.getAccessToken();
 const response=await fetch('https://central-free-fire-default-rtdb.firebaseio.com/.settings/rules.json',{headers:{Authorization:'Bearer '+token.access_token}});
 if(response.ok){const live=(await response.json()).rules;const differences=[];const walk=(a,b,path=[])=>{if(typeof a!=='object'||a===null){if(a!==b)differences.push(path.join('/'));return;}for(const key of Object.keys(a))walk(a[key],b?.[key],[...path,key]);};walk(rules,live);console.log(JSON.stringify({liveRuleDifferences:differences}));}else console.log(JSON.stringify({liveRulesReadStatus:response.status}));

 const failures=(node,path)=>{const fail=[];const check=(expr,p,label)=>{try{const ok=typeof expr==='boolean'?expr:Function('auth','$uid','newData','data','root','now','return Boolean('+expr.replaceAll('.matches(','.match(')+')')({uid,token:{email:'member@example.com'}},uid,snapshot(root,p),snapshot(oldRoot,p),snapshot(root),Date.now());if(!ok)fail.push(label);}catch{fail.push(label);}};check(node['.validate']??true,path,'required-fields');for(const key of Object.keys(snapshot(root,path).val()||{}))check((node[key]||node.$other)?.['.validate']??false,[...path,key],key);return fail;};
 console.log(JSON.stringify({privateFailures:failures(rules.userAccounts.$uid.profile,['userAccounts',uid,'profile']),publicFailures:failures(rules.communityProfiles.$uid,['communityProfiles',uid]),preferenceFailures:failures(rules.userAccounts.$uid.preferences,['userAccounts',uid,'preferences']),usernameClaimMatches:values[8]===uid}));
 // Check every selectable custom image against both profile validators without changing saved data.
 const rejected=[];for(const [id,item] of Object.entries(values[3]||{})){
  if(!item.enabled||!['avatar','cover'].includes(item.kind))continue;
  const access=item.accessRule||(item.unlockBadge?'badge':'all');
  const available=values[5]?.[id]||access==='admin'&&values[7]?.administrator===true||['all','badge'].includes(access)&&(!item.unlockBadge||values[6]?.[item.unlockBadge]===true);
  if(!available)continue;const field=item.kind==='avatar'?'avatarId':'coverId';
  const before=profile[field];profile[field]=id;
  const fail=failures(rules.userAccounts.$uid.profile,['userAccounts',uid,'profile']).filter(x=>x===field);profile[field]=before;
  if(fail.length)rejected.push({id,field});
 }
 console.log(JSON.stringify({selectableImageFailures:rejected}));
}
main().then(()=>deleteApp(app)).catch(error=>{const known=['Profile not uniquely indexed','Account username does not match requested profile'];console.error(known.includes(error.message)?error.message:'Read-only profile diagnostic could not finish ('+String(error.code||error.name||'unknown')+')');process.exitCode=1;deleteApp(app);});
