(()=>{
  if(document.getElementById('live-test-mode'))return;
  const stage=document.getElementById('live-stage');
  if(!stage)return;
  const row=stage.closest('.live-row');
  const wrap=document.createElement('div');
  wrap.className='live-warning';
  wrap.style.marginTop='0';
  wrap.innerHTML=`<label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer"><input id="live-test-mode" type="checkbox" style="margin-top:3px;transform:scale(1.15)"><span><strong style="display:block;color:#fff;margin-bottom:3px">Modo teste</strong><small style="color:#ffe183;line-height:1.45">Aceita equipes antigas como CIVIS/LOOPS e salva em uma área isolada do Firebase. Não altera nenhuma página pública.</small></span></label>`;
  row.insertAdjacentElement('afterend',wrap);
})();
