(() => {
 'use strict';
 const host=document.querySelector('#home [data-home-supporters]');
 if(!host||window.__cffSupportersReady)return;window.__cffSupportersReady=true;
 let pending,started=false;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(entries){const rows=(Array.isArray(entries)?entries:[]).filter(r=>typeof r.name==='string'&&r.name.trim()).slice(0,6),list=host.querySelector('[data-supporters-list]'),empty=host.querySelector('[data-supporters-empty]');if(!rows.length)return;list.innerHTML=rows.map(row=>`<li class="home-supporter"><span class="home-supporter-heart" aria-hidden="true">♡</span><span class="home-supporter-name">${esc(row.name)}</span></li>`).join('');list.hidden=false;empty.hidden=true;}
 function load(){if(started||!document.getElementById('home')?.classList.contains('active'))return pending;started=true;pending=fetch('https://cff-camp-notifications.nakataffb4.workers.dev/careers/supporters',{signal:AbortSignal.timeout(6000)}).then(response=>{if(!response.ok)throw Error('Apoios indisponíveis');return response.json();}).then(data=>render(data.entries)).catch(()=>{});return pending;}
 if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){load();if(started)observer.disconnect();}},{rootMargin:'150px'});observer.observe(host);}else{load();window.addEventListener('hashchange',load);window.addEventListener('cff:pretty-route',load);}
})();
