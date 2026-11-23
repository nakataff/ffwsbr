import {DEFAULTS,normalize} from './home-promos-model.mjs?v=20261123-admin-v1';
export function createPromoStore({read,transaction}){
 return {
  async load(){return normalize(await read()||structuredClone(DEFAULTS));},
  async save(draft){
   const clean=normalize(draft),expected=clean.revision;
   const result=await transaction(current=>{
    if(Number(current?.revision||0)!==expected)return;
    return {...clean,revision:expected+1,updatedAt:{'.sv':'timestamp'}};
   });
   if(!result.committed)throw Error('Os cards foram alterados em outra aba. Use Recarregar antes de publicar.');
   return normalize(result.value);
  }
 };
}
