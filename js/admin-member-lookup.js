export function memberReference(input){
 let value=String(input||'').trim();
 if(/^https?:\/\//i.test(value)||value.startsWith('/')){
  const url=new URL(value,'https://centralfreefire.com.br');
  if(!['centralfreefire.com.br','www.centralfreefire.com.br'].includes(url.hostname))throw Error('Use um link de perfil da Central Free Fire.');
  value=url.searchParams.get('slug')||url.searchParams.get('u')||(url.searchParams.get('ig')?'@'+url.searchParams.get('ig'):'')||decodeURIComponent(url.pathname.replace(/^\/perfil\//,'').replace(/\/$/,''));
 }
 if(/^user\d{6,10}$/.test(value))return {kind:'slug',key:value};
 if(/^@[a-z0-9_.]{1,64}$/i.test(value))return {kind:'instagram',key:value.slice(1).toLowerCase().replace(/\./g,',')};
 if(/^[A-Za-z0-9_-]{1,128}$/.test(value))return {kind:'uid',key:value};
 throw Error('Informe o link, código do perfil, @Instagram ou identificador da conta.');
}
export async function resolveMemberUid(input,read){
 const {kind,key}=memberReference(input);
 let uid=key;if(kind==='slug')uid=await read('communityProfileSlugs/'+key);else if(kind==='instagram'){const [central,instagram]=await Promise.all([read('communityUsernames/'+key),read('communityRankingProfiles/'+key)]);if(central&&instagram?.uid&&central!==instagram.uid)throw Error('Este @ corresponde a duas contas. Use o link com o código user... para escolher a pessoa correta.');uid=central||instagram?.uid;}
 if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw Error('Conta não encontrada para este perfil.');
 return uid;
}
