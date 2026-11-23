import {PATH,normalize,renderCards} from './home-promos-model.mjs?v=20261123-admin-v1';
const host=document.getElementById('home-promos'),database=window.CFF_CONFIG?.firebase?.databaseURL;
const KEY='cff-home-promotions-v1',TTL=5*60*1000;
if(host&&database){
 let cached;
 try{cached=JSON.parse(sessionStorage.getItem(KEY)||'null');if(cached?.value)renderCards(host,normalize(cached.value));}catch{}
 if(!cached||Date.now()-cached.at>=TTL){
  fetch(database.replace(/\/$/,'')+'/'+PATH+'.json',{signal:AbortSignal.timeout(6000)}).then(response=>{if(!response.ok)throw Error();return response.json();}).then(value=>{
   if(value){const config=normalize(value);renderCards(host,config);try{sessionStorage.setItem(KEY,JSON.stringify({at:Date.now(),value:config}));}catch{}}
   else try{sessionStorage.setItem(KEY,JSON.stringify({at:Date.now(),value:null}));}catch{}
  }).catch(()=>{}); // The static four-card strip remains usable during an outage.
 }
}
