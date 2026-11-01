// One cached public request on load or an explicit refresh. No ranking/auth reads.
(()=>{
 'use strict';
 const root=document.querySelector('[data-public-codes]');if(!root)return;
 const list=root.querySelector('[data-public-code-list]'),status=root.querySelector('[data-public-code-status]'),refresh=root.querySelector('[data-public-code-refresh]');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let busy=false;
 async function load(){if(busy)return;busy=true;refresh.disabled=true;status.textContent='Conferindo códigos divulgados…';
  try{const response=await fetch('https://cff-camp-notifications.nakataffb4.workers.dev/community/codes',{signal:AbortSignal.timeout(15000)}),data=await response.json();if(!response.ok||data.ok!==true||!Array.isArray(data.entries))throw Error('Não foi possível carregar os códigos agora.');
   list.innerHTML=data.entries.map((p,i)=>`<article class="cff-public-code"${i>2?' hidden':''}><div><span>DIVULGADO APÓS 3 MINUTOS</span><h3>${esc(p.title)}</h3><small>${esc(new Date(p.at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · Brasília</small></div><label>Código público<input readonly value="${esc(p.code)}" aria-label="Codiguinho ${esc(p.title)}"></label><button type="button" data-public-code-copy>Copiar</button><p>Testem: este código pode já ter sido resgatado. Venda proibida.</p></article>`).join('')+(data.entries.length>3?'<button type="button" data-public-code-more>Ver mais '+(data.entries.length-3)+' códigos</button>':'')||'<p>Nenhum codiguinho divulgado por esse sistema ainda.</p>';
   status.textContent='Últimos 20 códigos. Divulgação não garante que ainda funcionem; o resultado depende do resgate na Garena.';
  }catch(e){status.textContent=e.message;}finally{busy=false;refresh.disabled=false;}
 }
 refresh.addEventListener('click',load);list.addEventListener('click',async e=>{const more=e.target.closest('[data-public-code-more]');if(more){list.querySelectorAll('article[hidden]').forEach(n=>n.hidden=false);more.remove();return;}const b=e.target.closest('[data-public-code-copy]');if(!b)return;const input=b.closest('article').querySelector('input');try{await navigator.clipboard.writeText(input.value);b.textContent='Copiado';}catch{input.focus();input.select();status.textContent='Selecione o código e copie manualmente.';}});load();
})();
