(function(){
  'use strict';
  const style=document.createElement('style');
  style.textContent=`
    .cff-public-wiki-only,.wiki-import-section,.code-actions-grid,#v41-simple-code,#v43-wiki-scope-box,#champion-output-gear,#champion-output-settings{display:none!important}
    .setup-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;align-items:start;gap:12px!important}
    .setup-grid>.form-group{min-width:0;width:auto;box-sizing:border-box}
    .setup-grid input,.setup-grid select{min-width:0!important;width:100%;max-width:100%;box-sizing:border-box}
    .setup-grid .form-group>label{font-size:.76rem}.setup-grid .hint,.setup-grid .v23-final-type-note{font-size:.73rem;line-height:1.45}
    @media(max-width:1000px){.setup-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
    @media(max-width:600px){.setup-grid{grid-template-columns:minmax(0,1fr)!important}}
  `;document.head.appendChild(style);
  function setText(el,text){if(el&&el.textContent!==text)el.textContent=text;}
  function polish(){
    setText(document.getElementById('v41-mode-help'),document.body.classList.contains('v41-simple-mode')?'Times, lançamento de quedas e tabela.':document.body.classList.contains('v41-tournament-mode')?'Elenco, dias e classificação geral.':'Configuração, lançamento de quedas, tabelas e backups.');
    for(const id of ['game-detail-mode','match-key','matchlist-id','default-abbr','match-extra']){
      document.getElementById(id)?.closest('.form-group')?.classList.add('cff-public-wiki-only');
    }
    document.querySelectorAll('.match-bg-config').forEach(el=>el.classList.add('cff-public-wiki-only'));
    document.getElementById('v90-tournament-wiki-key')?.closest('.v76-box')?.classList.add('cff-public-wiki-only');
    const help=document.getElementById('final-mode-help');
    setText(help,document.getElementById('final-mode')?.value==='champion'?'Após atingir a pontuação mínima, o time precisa vencer uma queda para ser campeão.':'O campeão é definido pela pontuação total e pelos critérios de desempate.');
    setText(document.getElementById('tournament-days')?.closest('.form-group')?.querySelector('.hint'),'Defina quantos dias o campeonato terá. Você pode acompanhar a tabela do dia e a geral.');
    setText(document.getElementById('starting-enabled')?.closest('.form-group')?.querySelector('label'),'Bônus iniciais');
    document.querySelectorAll('.hint,.v76-status').forEach(el=>{
      if(el.children.length>0&&!el.matches('.hint'))return;
      const text=el.textContent;
      if(text.includes('Isso não entra no código Wiki do dia.'))setText(el,'Exemplo: 1º–12º classificados e 13º–14º rebaixados. Personalize as marcações na tabela geral.');
    });
    const warning=document.querySelector('#map-warning span');
    if(warning&&/wiki/i.test(warning.textContent))setText(warning,'⚠️ Selecione o mapa desta queda, se quiser exibi-lo na tabela.');
    document.getElementById('drop-opt-simple-kills-row')?.setAttribute('title','Exibe e soma os abates na tabela.');
  }
  let timer=0;
  const schedule=()=>{if(timer)return;timer=setTimeout(()=>{timer=0;polish();},80);};
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',schedule,{passive:true});polish();
})();
