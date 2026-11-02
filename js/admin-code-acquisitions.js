import {economyRequest,escapeEconomy as esc,loadEconomyStyle} from './economy-client.mjs?v=20261015-code-returns-v1';

const formatDate=value=>value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}):'—';
const paymentLabel=value=>value==='voucher'?'Vale Codiguinho':'CFF Coins';
const statusLabel=value=>({pending:'Entrega pendente',done:'Entregue',returning:'Devolução em andamento',returned:'Devolvido'})[value]||'A verificar';
// Neutralize spreadsheet formula injection before quoting each CSV field.
const csvField=value=>{
  let text=String(value??'');
  if(/^[\s\uFEFF]*[=+\-@]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
};
function downloadCsv(entries){
  const header=['Data da aquisição (Brasília)','Usuário','Nome','UID','Prêmio','Codiguinho','Pagamento','Recibo','Situação','Abertura no site (Brasília)','Divulgação pública (Brasília)','Devolvido em (Brasília)'];
  const lines=[header,...entries.map(d=>[formatDate(d.acquiredAt),d.username,d.name,d.uid,d.title,d.code,paymentLabel(d.payment),d.receiptId,statusLabel(d.status),formatDate(d.openedAt),formatDate(d.publicAt),formatDate(d.returnedAt)])];
  const blob=new Blob(['\uFEFF'+lines.map(r=>r.map(csvField).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='central-codiguinhos-resgates.csv';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
}

export function mountAdminCodeAcquisitions(host,{auth}){
  loadEconomyStyle();
  let live=true,busy=false,page=null,loaded=false,offset=0,latestQuery=null;
  const uid=auth.currentUser?.uid;
  const valid=()=>live&&host.isConnected&&auth.currentUser?.uid===uid&&auth.currentUser?.email==='admin@centralfreefire.com.br';
  host.innerHTML=`<section class="eco-code-audit" aria-label="Histórico automático de codiguinhos">
    <div class="eco-code-audit-head"><div><span>RELATÓRIO AUTOMÁTICO · ACESSO ADMINISTRATIVO</span><h3>Quem pegou cada codiguinho?</h3><p>Compras com CFF Coins e trocas por Vale Codiguinho. Registra a aquisição no site, não confirma uso na Garena. Os códigos são privados e aparecem apenas para a administração.</p></div></div>
    <form data-code-audit-filters class="eco-code-audit-filters">
      <label>Pesquisar usuário, prêmio ou código<input name="query" type="search" maxlength="70" placeholder="@usuário, nome, código ou UID"></label>
      <label>Forma de pagamento<select name="source"><option value="all">Moedas e vales</option><option value="coins">CFF Coins</option><option value="voucher">Vale Codiguinho</option></select></label>
      <label>Desde<input name="from" type="date"></label>
      <label>Até<input name="to" type="date"></label>
      <button type="submit">Buscar</button>
      <button type="button" data-code-audit-refresh>Atualizar</button>
      <button type="button" data-code-audit-csv>Exportar CSV filtrado</button>
    </form>
    <div data-code-audit-summary class="eco-code-audit-summary">Abra esta aba para carregar o histórico.</div>
    <p data-code-audit-status role="status" aria-live="polite"></p>
    <div data-code-audit-results class="eco-code-audit-results"></div>
    <div class="eco-code-audit-paging"><button type="button" data-code-audit-previous>Anterior</button><span data-code-audit-page></span><button type="button" data-code-audit-next>Próxima</button></div>
    <p class="codes-help-note">A data de abertura indica que a pessoa visualizou o código na Central. Depois de 3 minutos, ele pode ser divulgado publicamente. Nenhuma dessas informações comprova o resgate dentro do Free Fire.</p>
  </section>`;
  const $=sel=>host.querySelector(sel);
  const filters=$('[data-code-audit-filters]');
  const criteria=()=>Object.fromEntries(new FormData(filters).entries());
  const status=message=>{$('[data-code-audit-status]').textContent=message;};
  function availability(){
    host.querySelectorAll('button,input,select').forEach(el=>el.disabled=busy);
    $('[data-code-audit-previous]').disabled=busy||!page?.offset;
    $('[data-code-audit-next]').disabled=busy||!page?.hasMore;
  }
  function render(){
    if(!page)return;
    $('[data-code-audit-summary]').textContent=`${page.total} aquisições · ${page.coins} com moedas · ${page.vouchers} com vale`;
    $('[data-code-audit-page]').textContent=`${page.total?page.offset+1:0}–${page.offset+page.entries.length} de ${page.total}`;
    $('[data-code-audit-results]').innerHTML=page.entries.length?page.entries.map(d=>{
      const user=d.username?'@'+d.username:(d.name||d.uid);
      const stamps=[d.openedAt?'Aberto no site: '+formatDate(d.openedAt):'Ainda sem abertura registrada',d.publicAt?'Divulgado: '+formatDate(d.publicAt):'Não divulgado',d.returnedAt?'Devolvido: '+formatDate(d.returnedAt):''].filter(Boolean).join(' · ');
      return `<article class="eco-code-audit-row">
        <div class="eco-code-audit-row-meta"><strong>${esc(d.title)}</strong><span>${esc(user)}</span><small>${esc(formatDate(d.acquiredAt))} · ${esc(paymentLabel(d.payment))}</small><small>${esc(statusLabel(d.status))} · ${esc(stamps)}</small></div>
        <div class="eco-code-audit-row-code"><details><summary>Ver codiguinho</summary><code>${esc(d.code||'Código não disponível no estoque')}</code></details><small>Recibo ${esc(d.receiptId.slice(0,8))}</small></div>
      </article>`;
    }).join(''):'<p class="codes-help-note">Nenhum resgate encontrado para esses filtros.</p>';
    availability();
  }
  async function load(nextOffset=0,options=criteria()){
    if(!valid()||busy)return;
    busy=true;availability();status('Consultando histórico privado…');
    try{
      const result=await economyRequest(auth,'codeAcquisitions',{...options,offset:nextOffset},true);
      if(!valid())return;
      page=result;offset=nextOffset;latestQuery=options;loaded=true;
      render();status('');
    }catch(error){if(valid())status(error.message||'Falha ao carregar histórico.');}
    finally{busy=false;if(valid())availability();}
  }
  async function exportFiltered(){
    if(!valid()||busy)return;
    const query=criteria();busy=true;availability();status('Preparando CSV privado…');
    try{
      const entries=[];let cursor=0,more=true;
      while(more){
        const result=await economyRequest(auth,'codeAcquisitions',{...query,offset:cursor},true);
        if(!valid())return;
        entries.push(...result.entries);cursor+=result.entries.length;more=result.hasMore&&entries.length<5000;
        if(result.hasMore&&entries.length>=5000)throw new Error('Mais de 5.000 registros. Refine o período para exportar em partes.');
        if(more&&result.entries.length===0)throw new Error('A paginação do relatório foi interrompida. Tente novamente.');
      }
      downloadCsv(entries);status(`CSV criado com ${entries.length} resgates. Guarde esse arquivo com cuidado: ele inclui códigos e contas.`);
    }catch(error){if(valid())status(error.message||'Falha ao exportar CSV.');}
    finally{busy=false;if(valid())availability();}
  }
  filters.addEventListener('submit',event=>{event.preventDefault();load(0);});
  host.addEventListener('click',event=>{
    if(event.target.closest('[data-code-audit-refresh]'))load(page?.offset||0);
    else if(event.target.closest('[data-code-audit-csv]'))exportFiltered();
    else if(event.target.closest('[data-code-audit-next]')&&page?.hasMore)load(offset+30,latestQuery);
    else if(event.target.closest('[data-code-audit-previous]')&&offset>0)load(Math.max(0,offset-30),latestQuery);
  });
  const activated=event=>{if(event.detail==='reports'&&!loaded)load(0);};
  window.addEventListener('cff:codes-tab',activated);
  if(!host.closest('[data-codes-panel]')?.hidden)load(0);
  else if(sessionStorage.getItem('cff-codes-admin-tab')==='reports')load(0);
  return()=>{live=false;window.removeEventListener('cff:codes-tab',activated);host.replaceChildren();};
}

export async function bootAdminCodeAcquisitions(){
  const host=document.getElementById('eco-code-acquisitions-root');if(!host)return;
  const [appModule,authModule]=await Promise.all([import('https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js')]);
  const app=appModule.getApps().find(a=>a.name==='[DEFAULT]')||appModule.initializeApp(window.CFF_CONFIG.firebase),auth=authModule.getAuth(app);
  let stop=null;
  authModule.onAuthStateChanged(auth,user=>{
    stop?.();stop=null;
    if(user?.email==='admin@centralfreefire.com.br')stop=mountAdminCodeAcquisitions(host,{auth});
    else host.replaceChildren();
  });
}
