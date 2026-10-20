(() => {
  'use strict';
  if(window.__cffShareRankings)return;window.__cffShareRankings=true;
  const targets={'home-ranking-teams':{title:'Classificação',metric:'points',kind:'teams'},'home-ranking-kills':{title:'Ranking de abates',metric:'kills',kind:'players'},'home-ranking-damage':{title:'Ranking de dano',metric:'damage',kind:'players'},'home-ranking-assists':{title:'Ranking de assistências',metric:'assists',kind:'players'}};
  const text=node=>String(node?.textContent||'').replace(/\s+/g,' ').trim();
  const value=node=>{const s=text(node);return s&&s!=='—'?Number(s.replace(/\./g,'').replace(',','.')):null;};
  function capture(widget){
    const meta=targets[widget.id],event=document.querySelector('[data-home-rankings-event]')?.dataset.homeRankingsEvent||'Free Fire';
    const rows=[...widget.querySelectorAll('tbody tr')].map((tr,i)=>{
      const link=tr.querySelector('.home-rank-main a'),nums=tr.querySelectorAll('.home-rank-number'),image=tr.querySelector('.home-rank-media img');
      const url=new URL(link?.getAttribute('href')||'/',location.origin),team=url.searchParams.get('time')||text(tr.querySelector('.home-rank-main small'));
      const metric=value(nums[0]);if(metric===null||!Number.isFinite(metric))return null;
      const row={rank:value(tr.querySelector('.home-rank-pos'))||i+1,name:meta.kind==='teams'?team:text(tr.querySelector('.home-rank-main b')),team,[meta.metric]:metric};
      if(meta.kind==='teams'){row.kills=value(nums[1]);row.logo=image?.getAttribute('src')||'';}else{row.matches=value(nums[1]);row.photo=image?.getAttribute('src')||'';}
      return row.name?row:null;
    }).filter(Boolean);
    return {id:widget.id,title:meta.title,event,kind:meta.kind,metric:meta.metric,stage:meta.kind==='teams'?text(widget.querySelector('h3')).replace(/^.*Top\s*6\s*/i,'').trim():'Geral',url:'https://centralfreefire.com.br/index.html#home',rows};
  }
  function boot(){Object.keys(targets).forEach(id=>{
    const widget=document.getElementById(id);if(!widget||widget.querySelector('.cff-ranking-share-trigger'))return;
    const button=document.createElement('button');button.type='button';button.className='cff-ranking-share-trigger';button.textContent='↗ Card';button.setAttribute('aria-label','Criar card compartilhável: '+targets[id].title.toLocaleUpperCase('pt-BR'));
    button.addEventListener('click',async()=>{button.disabled=true;try{const data=capture(widget);const {openRankingCard}=await import('/js/ranking-share-cards.mjs?v=20261020-cards-v2');await openRankingCard(data);}catch(error){let note=widget.querySelector('[data-card-error]');if(!note){note=document.createElement('p');note.dataset.cardError='';note.setAttribute('role','status');widget.append(note);}note.textContent=error.message||'Não foi possível criar o card.';}finally{button.disabled=false;}});widget.append(button);
  });}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
