const KEY='cff-account-welcome-dismissed-v1',SESSION='cff-account-welcome-seen-v1',HOUR=3600000;
export function eligibleWelcome({signedIn,path,search='',dismissedAt=0,seen=false,now=Date.now()}){return !signedIn&&!seen&&!/^\/admin|\/404\.html$/.test(path)&&!(path==='/conta.html'&&!/[?&](ig|u|slug)=/.test(search))&&(!dismissedAt||now-dismissedAt>=HOUR);}
export function createAccountWelcome({signedIn,login,storage={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)},session={getItem:k=>sessionStorage.getItem(k),setItem:(k,v)=>sessionStorage.setItem(k,v)}}){
 let timer=null,dialog=null,focusBefore=null;
 const read=(source,key)=>{try{return source.getItem(key)||'';}catch{return '';}};
 const write=(source,key,value)=>{try{source.setItem(key,value);return true;}catch{return false;}};
 function close(dismiss=true){clearTimeout(timer);timer=null;if(dismiss){const at=String(Date.now());write(storage,KEY,at);write(session,SESSION,at);}if(dialog){const d=dialog;dialog=null;d.close();d.remove();if(focusBefore?.isConnected)focusBefore.focus();}}
 function cancel(){close(false);}
 function schedule(){clearTimeout(timer);if(!eligibleWelcome({signedIn:signedIn(),path:location.pathname,search:location.search,dismissedAt:Number(read(storage,KEY)),seen:Date.now()-Number(read(session,SESSION)||0)<HOUR}))return;
  timer=setTimeout(()=>{timer=null;if(signedIn()||document.visibilityState==='hidden'||document.querySelector('dialog[open]')||!write(session,SESSION,String(Date.now())))return;
   focusBefore=document.activeElement;dialog=document.createElement('dialog');dialog.className='cff-account-welcome';dialog.setAttribute('aria-labelledby','cff-welcome-title');
   dialog.innerHTML='<button type="button" class="cff-welcome-close" data-welcome-close aria-label="Fechar convite">×</button><span class="cff-welcome-brand">CENTRAL FREE FIRE</span><h2 id="cff-welcome-title">Sua torcida merece<br>um perfil.</h2><p>Crie sua conta para acompanhar seus times, guardar favoritos e mostrar suas conquistas.</p><ul><li>Seu perfil com foto, capa e insígnias</li><li>Ranking e palpites da comunidade</li><li>Resultados dos torneios em um só lugar</li></ul><button type="button" class="cff-account-button primary" data-welcome-login>Criar conta com Google</button><button type="button" class="cff-welcome-later" data-welcome-close>Agora não</button><small>Já tem conta? Entre com o mesmo Google.</small>';
   dialog.querySelectorAll('[data-welcome-close]').forEach(b=>b.onclick=()=>close());dialog.querySelector('[data-welcome-login]').onclick=()=>{close(false);login();};dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();});document.body.append(dialog);dialog.showModal();
  },2500);
 }
 return{schedule,cancel};
}
