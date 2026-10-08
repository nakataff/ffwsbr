(() => {
  'use strict';
  const keys = ['projects','projectCompanies','projectNetworks','projectFields'];
  const statuses = {todo:'A fazer',doing:'Em andamento',info:'Falta informação',approval:'Aguardando aprovação',done:'Concluído',rejected:'Recusado'};
  const escape = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const stamp = () => new Date().toISOString();
  const identifier = () => crypto.randomUUID();
  function str(value,max=10000) { if(typeof value!=='string'||value.length>max)throw Error('Texto de projeto inválido');return value; }
  function url(value) { if(!value)return '';const u=new URL(/^[a-z][a-z\d+.-]*:/i.test(value)?value:'https://'+value);if(!['https:','http:'].includes(u.protocol)||!u.hostname||u.username||u.password)throw Error('Use um link http ou https.');return u.href; }
  function normalise(data) {
    const list = (key,parse) => {
      const rows=data[key]??[];if(!Array.isArray(rows)||rows.length>10000)throw Error('Lista de projetos inválida');
      const ids=new Set();return rows.map(row=>{const id=str(row.id,150);if(!id||ids.has(id))throw Error('ID de projeto inválido');ids.add(id);return {id,...parse(row)};});
    };
    const dates = row => ({updatedAt:str(row.updatedAt||'',50),completedAt:str(row.completedAt||'',50)});
    const projects=list('projects',r=>({name:str(r.name,160),description:str(r.description||'',1000),...dates(r)}));
    const projectIds=new Set(projects.map(r=>r.id));
    const projectCompanies=list('projectCompanies',r=>({projectId:str(r.projectId,150),name:str(r.name,160),...dates(r)}));
    const companyIds=new Set(projectCompanies.map(r=>r.id));
    const projectNetworks=list('projectNetworks',r=>{if(!statuses[r.status])throw Error('Status de projeto inválido');return {companyId:str(r.companyId,150),name:str(r.name,80),status:r.status,url:url(str(r.url||'',2000)),note:str(r.note||'',4000),...dates(r)};});
    const networkIds=new Set(projectNetworks.map(r=>r.id));
    const projectFields=list('projectFields',r=>({networkId:str(r.networkId,150),label:str(r.label,80),original:str(r.original??r.text),text:str(r.text),done:!!r.done,...dates(r)}));
    if(projectCompanies.some(r=>!projectIds.has(r.projectId))||projectNetworks.some(r=>!companyIds.has(r.companyId))||projectFields.some(r=>!networkIds.has(r.networkId)))throw Error('Referência de projeto inválida');
    return {projects,projectCompanies,projectNetworks,projectFields};
  }
  function seed(state) {
    keys.forEach(k=>state[k]??=[]);
    const source=window.CFF_TASKS_PROJECTS_SEED;
    if(!source||state.projects.some(p=>p.id===source.id))return false;
    const at=stamp();state.projects.push({id:source.id,name:source.name,description:source.description,updatedAt:at,completedAt:''});
    for(const c of source.companies){const companyId=source.id+'-'+c.id;state.projectCompanies.push({id:companyId,projectId:source.id,name:c.name,updatedAt:at,completedAt:''});
      for(const n of c.networks){const networkId=companyId+'-'+slug(n.name);state.projectNetworks.push({id:networkId,companyId,name:n.name,status:'todo',url:'',note:'',updatedAt:at,completedAt:''});
        n.fields.forEach((f,i)=>state.projectFields.push({id:networkId+'-'+i,networkId,label:f.label,original:f.text,text:f.text,done:false,updatedAt:at,completedAt:''}));}
    }
    return true;
  }
  function mount(api) {
    const root=document.getElementById('projects-view');if(!root)return;
    const $=id=>document.getElementById(id);
    let projectId=api.getState().projects[0]?.id||'',companyId='',view='tasks',search='',status='',platform='',pending=false,timer=null;
    const expanded=new Set(),visitedCompanies=new Set();
    const state=()=>api.getState();
    const fields=id=>state().projectFields.filter(f=>f.networkId===id);
    const networks=id=>state().projectNetworks.filter(n=>n.companyId===id);
    const companies=()=>state().projectCompanies.filter(c=>c.projectId===projectId);
    const related=()=>{const ids=new Set(companies().map(c=>c.id));return state().projectNetworks.filter(n=>ids.has(n.companyId));};
    const matches=n=>(!status||status==='pending'&&n.status!=='done'||n.status===status)&&(!platform||n.name===platform)&&(!search||[n.name,...fields(n.id).map(f=>f.text),state().projectCompanies.find(c=>c.id===n.companyId)?.name].join(' ').toLocaleLowerCase('pt-BR').includes(search));
    let quickTimer=null;
    const history=window.CFF_TASKS_PROJECT_HISTORY.create({getState:state,keys,validate:normalise,
      onUpdate:info=>{$('project-undo').disabled=!info.undo;$('project-redo').disabled=!info.redo;$('project-undo').title=info.last?'Desfazer nesta sessão: '+info.last:'Nenhuma alteração para desfazer nesta sessão';$('project-action-notice').hidden=true;},
      onApplied:result=>{if(result.applied){clearTimeout(timer);api.save();pickProject();render();api.toast(result.conflicts?'Algumas alterações já mudaram em outro dispositivo.':result.direction==='undo'?'Alteração desfeita':'Alteração refeita');}else if(result.conflicts)api.toast('Essa alteração já mudou em outro dispositivo.');}
    });
    function undo(){const result=history.undo();if(!result.applied&&result.conflicts)api.toast('Não foi possível desfazer: há alterações mais recentes relacionadas.');}
    function persist(immediate=false,label='Alteração no projeto'){
      const active=document.activeElement,group=active?.dataset.fieldText?'text:'+active.dataset.fieldText:active?.dataset.networkNote?'note:'+active.dataset.networkNote:'';
      history.record(group.startsWith('text:')?'Editar texto':group.startsWith('note:')?'Editar observações':label,group);
      clearTimeout(timer);if(immediate)api.save();else timer=setTimeout(()=>api.save(),300);
    }
    function updateNetwork(id,patch){const n=state().projectNetworks.find(n=>n.id===id);if(!n)return;Object.assign(n,patch,{updatedAt:stamp()});persist();}
    function setStatus(id,value){const n=state().projectNetworks.find(n=>n.id===id);if(!n||!statuses[value])return;
      n.status=value;n.updatedAt=stamp();n.completedAt=value==='done'?n.updatedAt:'';
      if(value==='done')fields(id).forEach(f=>{f.done=true;f.completedAt=n.updatedAt;f.updatedAt=n.updatedAt;});
      persist(true,'Alterar andamento');render();
    }
    function toggleField(id,done){const f=state().projectFields.find(f=>f.id===id);if(!f)return;f.done=done;f.updatedAt=stamp();f.completedAt=done?f.updatedAt:'';
      const n=state().projectNetworks.find(n=>n.id===f.networkId),fs=fields(f.networkId);
      if(n){n.status=fs.every(x=>x.done)?'done':fs.some(x=>x.done)?'doing':'todo';n.completedAt=n.status==='done'?f.updatedAt:'';n.updatedAt=f.updatedAt;}
      persist(true,'Marcar campo');render();
    }
    function quickComplete(id){const n=state().projectNetworks.find(n=>n.id===id);if(!n)return;
      if(n.status==='done'){fields(id).forEach(f=>{f.done=false;f.completedAt='';f.updatedAt=stamp();});setStatus(id,'todo');api.toast('Rede reaberta');return;}
      const name=n.name;setStatus(id,'done');clearTimeout(quickTimer);$('project-action-notice-text').textContent=name+' concluído.';$('project-action-notice').hidden=false;quickTimer=setTimeout(()=>$('project-action-notice').hidden=true,8000);
    }
    async function copyText(text){
      try{await navigator.clipboard.writeText(text);api.toast('Texto copiado');}
      catch{const a=document.createElement('textarea');a.value=text;a.style.cssText='position:fixed;top:0;opacity:0';document.body.append(a);a.select();const ok=document.execCommand('copy');a.remove();api.toast(ok?'Texto copiado':'Não foi possível copiar. Selecione o texto.');}
    }
    function progress(ns){return `${ns.filter(n=>n.status==='done').length}/${ns.length}`;}
    function renderSummary(){const ns=related(),done=ns.filter(n=>n.status==='done').length,ids=new Set(ns.map(n=>n.id)),fs=state().projectFields.filter(f=>ids.has(f.networkId));
      $('projects-summary').innerHTML=`<div><strong>${done}<span> / ${ns.length}</span></strong><small>redes concluídas</small></div><div><strong>${ns.filter(n=>n.status!=='done').length}</strong><small>redes pendentes</small></div><div><strong>${fs.filter(f=>f.done).length}<span> / ${fs.length}</span></strong><small>campos atualizados</small></div><div class="project-total-progress"><span>${ns.length?Math.round(done/ns.length*100):0}% concluído</span><progress value="${done}" max="${ns.length||1}"></progress></div>`;
      $('project-pending-summary').innerHTML=['todo','doing','info','approval','rejected'].map(s=>`<button type="button" class="project-pending-chip status-${s}" data-pending-status="${s}" aria-pressed="${status===s}">${statuses[s]} <strong>${ns.filter(n=>n.status===s).length}</strong></button>`).join('');
    }
    function renderNavigation(){const cs=companies().filter(c=>c.id===companyId||networks(c.id).some(matches)||!networks(c.id).length&&!search&&!status&&!platform);
      if(!cs.some(c=>c.id===companyId))companyId=cs[0]?.id||'';
      $('project-company-select').innerHTML=cs.map(c=>`<option value="${escape(c.id)}">${escape(c.name)} · ${progress(networks(c.id))}</option>`).join('');$('project-company-select').value=companyId;
      $('project-company-list').innerHTML=cs.map(c=>{const ns=networks(c.id);return `<button class="project-company ${c.id===companyId?'selected':''}" data-company="${escape(c.id)}" aria-pressed="${c.id===companyId}"><span>${escape(c.name)}</span><small>${progress(ns)} redes concluídas</small><progress value="${ns.filter(n=>n.status==='done').length}" max="${ns.length||1}"></progress></button>`;}).join('')||'<p class="hint">Nenhuma empresa neste filtro.</p>';
    }
    function fieldHtml(f){return `<div class="project-field" data-field-id="${escape(f.id)}"><div class="project-field-head"><label class="project-field-check"><input type="checkbox" data-field-done="${escape(f.id)}" ${f.done?'checked':''}><span>${escape(f.label)}</span></label><button class="small-btn" data-copy-field="${escape(f.id)}">Copiar</button></div><label class="sr-only" for="project-text-${escape(f.id)}">${escape(f.label)} — texto editável</label><textarea id="project-text-${escape(f.id)}" data-field-text="${escape(f.id)}" maxlength="10000" rows="${Math.min(9,Math.max(2,f.text.split('\n').length+1))}">${escape(f.text)}</textarea><div class="project-field-meta"><span data-counter="${escape(f.id)}">${Array.from(f.text).length} caracteres</span><span data-field-edit="${escape(f.id)}">${f.text!==f.original?'Texto ajustado':'Texto recebido'}</span></div><details class="project-original"><summary>Ver texto original</summary><p>${escape(f.original)}</p></details></div>`;}
    function networkHtml(n,index){const fs=fields(n.id),open=expanded.has(n.id);const at=n.completedAt||n.updatedAt;
      return `<article class="project-network" data-network="${escape(n.id)}"><div class="project-network-header"><button type="button" class="project-quick-complete ${n.status==='done'?'is-done':''}" data-quick-complete="${escape(n.id)}" aria-pressed="${n.status==='done'}" aria-label="${n.status==='done'?'Reabrir':'Concluir'} ${escape(n.name)}" title="${n.status==='done'?'Reabrir pendência':'Concluir rede'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-8"/></svg></button><button class="project-network-toggle" aria-expanded="${open}" aria-controls="project-network-${escape(n.id)}" data-expand="${escape(n.id)}"><span class="project-network-symbol">${escape(n.name.slice(0,2))}</span><span><strong>${escape(n.name)}</strong><small>${fs.filter(f=>f.done).length}/${fs.length} campos atualizados</small></span><span class="project-chevron">${open?'−':'+'}</span></button><label class="project-status-wrap"><span class="sr-only">Status de ${escape(n.name)}</span><select class="project-status status-${escape(n.status)}" data-project-status="${escape(n.id)}">${Object.entries(statuses).map(([k,v])=>`<option value="${k}" ${n.status===k?'selected':''}>${v}</option>`).join('')}</select></label></div><div class="project-network-body" id="project-network-${escape(n.id)}" ${open?'':'hidden'}><div class="project-network-tools"><label class="field">Link da rede social<input data-network-url="${escape(n.id)}" value="${escape(n.url)}" maxlength="2000" placeholder="https://…" type="text" inputmode="url"></label><div class="project-link-actions">${n.url?`<a class="small-btn" href="${escape(n.url)}" target="_blank" rel="noopener noreferrer">Abrir rede ↗</a><button class="small-btn" data-copy-url="${escape(n.id)}">Copiar link</button>`:''}<button class="small-btn" data-copy-network="${escape(n.id)}">Copiar textos da rede</button></div></div><div class="project-fields">${fs.map(fieldHtml).join('')}</div><button type="button" class="small-btn project-add-field" data-add-field="${escape(n.id)}">+ Campo</button><label class="field project-note">${n.status==='info'?'O que falta?':n.status==='rejected'?'Motivo da recusa':'Observações'}<textarea data-network-note="${escape(n.id)}" maxlength="4000" rows="2" placeholder="Pendência, aprovação ou orientação…">${escape(n.note)}</textarea></label><p class="project-last-update">${n.completedAt?'Concluído':'Última atualização'}: ${at?escape(new Date(at).toLocaleString('pt-BR')):'—'}</p></div></article>`;
    }
    function renderContent(){const c=companies().find(c=>c.id===companyId);if(!c){$('project-company-content').innerHTML='<div class="project-empty"><h3>Nenhum resultado</h3><p>Mude os filtros ou adicione uma empresa.</p></div>';return;}
      const ns=networks(c.id).filter(matches);
      if(!visitedCompanies.has(c.id)){if(!ns.some(n=>expanded.has(n.id))&&ns.length)expanded.add(ns[0].id);visitedCompanies.add(c.id);}
      $('project-company-content').innerHTML=`<div class="project-company-heading"><div><p class="project-eyebrow">EMPRESA</p><h2>${escape(c.name)}</h2><p>${progress(networks(c.id))} redes concluídas</p></div><div><button class="small-btn" data-copy-company="${escape(c.id)}">Copiar empresa</button><button class="small-btn" id="project-add-network">+ Rede</button></div></div>${ns.map(networkHtml).join('')||(networks(c.id).length?'<p class="hint">Nenhuma rede desta empresa corresponde aos filtros.</p>':'<p class="hint">Adicione uma rede social para começar.</p>')}`;
    }
    function render(){const y=window.scrollY,active=document.activeElement;const selector=active?.dataset.projectStatus?`[data-project-status="${CSS.escape(active.dataset.projectStatus)}"]`:active?.dataset.quickComplete?`[data-quick-complete="${CSS.escape(active.dataset.quickComplete)}"]`:active?.dataset.fieldDone?`[data-field-done="${CSS.escape(active.dataset.fieldDone)}"]`:null;renderSummary();renderNavigation();renderContent();pending=false;if(selector)root.querySelector(selector)?.focus({preventScroll:true});window.scrollTo({top:y,left:window.scrollX,behavior:'instant'});}
    function refresh(){if(!root.contains(document.activeElement)||!document.activeElement.matches('input,textarea'))render();else pending=true;}
    function pickProject(){const ps=state().projects;if(!ps.some(p=>p.id===projectId))projectId=ps[0]?.id||'';
      $('project-select').innerHTML=ps.map(p=>`<option value="${escape(p.id)}">${escape(p.name)}</option>`).join('');$('project-select').value=projectId;
      $('project-description').textContent=ps.find(p=>p.id===projectId)?.description||'';
      const names=[...new Set(related().map(n=>n.name))].sort();$('project-platform-filter').innerHTML='<option value="">Todas as redes</option>'+names.map(n=>`<option>${escape(n)}</option>`).join('');if(!names.includes(platform))platform='';$('project-platform-filter').value=platform;
    }
    function switchView(next){view=next;document.querySelectorAll('[data-workspace-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.workspaceView===view)));$('tasks-view').hidden=view!=='tasks';root.hidden=view!=='projects';$('new-card').hidden=view!=='tasks';$('manage-columns').hidden=view!=='tasks';if(view==='projects'){pickProject();render();}}
    const dialog=$('project-add-dialog'),form=$('project-add-form');let addKind='',addNetworkId='';
    function add(kind){addKind=kind;$('project-add-title').textContent={project:'Novo projeto',company:'Nova empresa',network:'Nova rede social',field:'Novo campo'}[kind];$('project-add-name').value='';$('project-add-extra').value='';$('project-add-extra-label').hidden=kind!=='project';dialog.showModal();$('project-add-name').focus();}
    form.addEventListener('submit',e=>{e.preventDefault();const name=$('project-add-name').value.trim();if(!name)return;const at=stamp(),id=identifier();
      if(addKind==='project'){state().projects.push({id,name,description:$('project-add-extra').value.trim(),updatedAt:at,completedAt:''});projectId=id;companyId='';}
      if(addKind==='company'&&projectId){state().projectCompanies.push({id,projectId,name,updatedAt:at,completedAt:''});companyId=id;}
      if(addKind==='network'&&companyId){state().projectNetworks.push({id,companyId,name,status:'todo',url:'',note:'',updatedAt:at,completedAt:''});state().projectFields.push({id:id+'-description',networkId:id,label:'Descrição',original:'',text:'',done:false,updatedAt:at,completedAt:''});expanded.add(id);}
      if(addKind==='field'&&addNetworkId){state().projectFields.push({id,networkId:addNetworkId,label:name,original:'',text:'',done:false,updatedAt:at,completedAt:''});const n=state().projectNetworks.find(n=>n.id===addNetworkId);if(n?.status==='done'){n.status='doing';n.completedAt='';n.updatedAt=at;}expanded.add(addNetworkId);}
      search='';status='';platform='';$('project-search').value='';$('project-status-filter').value='';persist(true,'Adicionar '+{project:'projeto',company:'empresa',network:'rede',field:'campo'}[addKind]);dialog.close();pickProject();render();api.toast('Adicionado ao projeto');
    });
    $('project-add-close').addEventListener('click',()=>dialog.close());$('project-add-cancel').addEventListener('click',()=>dialog.close());
    document.querySelectorAll('[data-workspace-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.workspaceView)));
    $('project-select').addEventListener('change',e=>{projectId=e.target.value;companyId='';platform='';pickProject();render();});
    $('project-new').addEventListener('click',()=>add('project'));$('project-add-company').addEventListener('click',()=>add('company'));
    $('project-search').addEventListener('input',e=>{search=e.target.value.trim().toLocaleLowerCase('pt-BR');render();});
    $('project-status-filter').addEventListener('change',e=>{status=e.target.value;render();});$('project-platform-filter').addEventListener('change',e=>{platform=e.target.value;render();});
    $('project-company-select').addEventListener('change',e=>{companyId=e.target.value;renderContent();renderNavigation();});
    root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
      if(b.dataset.quickComplete)quickComplete(b.dataset.quickComplete);
      if(b.dataset.pendingStatus){status=status===b.dataset.pendingStatus?'':b.dataset.pendingStatus;$('project-status-filter').value=status;render();}
      if(b.dataset.company){companyId=b.dataset.company;render();}
      if(b.dataset.expand){expanded.has(b.dataset.expand)?expanded.delete(b.dataset.expand):expanded.add(b.dataset.expand);const body=$('project-network-'+b.dataset.expand);body.hidden=!expanded.has(b.dataset.expand);b.setAttribute('aria-expanded',String(!body.hidden));b.querySelector('.project-chevron').textContent=body.hidden?'+':'−';}
      if(b.dataset.copyField)copyText(state().projectFields.find(f=>f.id===b.dataset.copyField)?.text||'');
      if(b.dataset.copyNetwork)copyText(fields(b.dataset.copyNetwork).map(f=>`${f.label}\n${f.text}`).join('\n\n'));
      if(b.dataset.copyCompany)copyText(networks(b.dataset.copyCompany).map(n=>`${n.name}\n\n${fields(n.id).map(f=>`${f.label}\n${f.text}`).join('\n\n')}`).join('\n\n────────\n\n'));
      if(b.dataset.copyUrl)copyText(state().projectNetworks.find(n=>n.id===b.dataset.copyUrl)?.url||'');
      if(b.id==='project-add-network')add('network');
      if(b.dataset.addField){addNetworkId=b.dataset.addField;add('field');}
    });
    root.addEventListener('change',e=>{const t=e.target;if(t.dataset.projectStatus)setStatus(t.dataset.projectStatus,t.value);if(t.dataset.fieldDone)toggleField(t.dataset.fieldDone,t.checked);});
    root.addEventListener('input',e=>{const t=e.target;
      if(t.dataset.fieldText){const f=state().projectFields.find(f=>f.id===t.dataset.fieldText);if(!f)return;f.text=t.value;f.updatedAt=stamp();if(f.done){f.done=false;f.completedAt='';t.closest('.project-field').querySelector('input[type=checkbox]').checked=false;const n=state().projectNetworks.find(n=>n.id===f.networkId);if(n?.status==='done'){n.status='doing';n.completedAt='';n.updatedAt=f.updatedAt;pending=true;}}
        root.querySelector(`[data-counter="${CSS.escape(f.id)}"]`).textContent=Array.from(f.text).length+' caracteres';root.querySelector(`[data-field-edit="${CSS.escape(f.id)}"]`).textContent=f.text!==f.original?'Texto ajustado':'Texto recebido';
        const card=t.closest('.project-network'),fs=fields(f.networkId),n=state().projectNetworks.find(n=>n.id===f.networkId);
        card.querySelector('.project-network-toggle small').textContent=fs.filter(f=>f.done).length+'/'+fs.length+' campos atualizados';
        if(n){n.updatedAt=f.updatedAt;const select=card.querySelector('.project-status');select.value=n.status;select.className='project-status status-'+n.status;}
        persist();renderSummary();}
      if(t.dataset.networkNote)updateNetwork(t.dataset.networkNote,{note:t.value});
      if(t.dataset.networkUrl)t.setCustomValidity('');
    });
    root.addEventListener('focusout',e=>{const t=e.target;
      if(t.dataset.networkUrl){try{const value=url(t.value.trim());updateNetwork(t.dataset.networkUrl,{url:value});t.value=value;
        const actions=t.closest('.project-network-tools').querySelector('.project-link-actions');actions.querySelectorAll('a,[data-copy-url]').forEach(x=>x.remove());
        if(value){const a=document.createElement('a');a.className='small-btn';a.href=value;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Abrir rede ↗';const b=document.createElement('button');b.className='small-btn';b.type='button';b.dataset.copyUrl=t.dataset.networkUrl;b.textContent='Copiar link';actions.prepend(a,b);}
      }catch(error){t.setCustomValidity(error.message);t.reportValidity();return;}}
      setTimeout(()=>{if(pending&&!root.contains(document.activeElement))refresh();},0);
    });
    $('project-undo').addEventListener('click',undo);
    $('project-redo').addEventListener('click',()=>{const result=history.redo();if(!result.applied&&result.conflicts)api.toast('Não foi possível refazer: há alterações mais recentes relacionadas.');});
    $('project-quick-undo').addEventListener('click',undo);
    document.addEventListener('keydown',e=>{
      if(view!=='projects'||!(e.ctrlKey||e.metaKey)||e.altKey||e.target.closest('input,textarea,[contenteditable="true"]')||document.querySelector('dialog[open]'))return;
      if(e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)history.redo();else undo();}
      else if(e.key.toLowerCase()==='y'){e.preventDefault();history.redo();}
    });
    const reportDialog=$('project-report-dialog');
    function reportData(){return window.CFF_TASKS_PROJECT_REPORTS.report({state:state(),projectId,companyId,scope:$('project-report-scope').value,matches,filters:{search,status,platform}});}
    function reportPreview(){const data=reportData(),includeTexts=$('project-report-texts').checked,format=$('project-report-format').value;
      $('project-report-preview').value=format==='json'?JSON.stringify(data,null,2):window.CFF_TASKS_PROJECT_REPORTS.text(data,includeTexts);
      $('project-report-count').textContent=`${data.summary.companies} empresas · ${data.summary.networks} redes · ${data.summary.fields} campos${format==='xlsx'?' · Abas: Resumo, Redes e Campos':''}`;
    }
    $('project-report-open').addEventListener('click',()=>{reportPreview();reportDialog.showModal();});
    $('project-report-close').addEventListener('click',()=>reportDialog.close());
    ['project-report-scope','project-report-format','project-report-texts'].forEach(id=>$(id).addEventListener('change',reportPreview));
    $('project-report-copy').addEventListener('click',()=>copyText(window.CFF_TASKS_PROJECT_REPORTS.text(reportData(),$('project-report-texts').checked)));
    $('project-report-download').addEventListener('click',()=>{
      const data=reportData(),format=$('project-report-format').value,includeTexts=$('project-report-texts').checked;
      const blob=format==='xlsx'?window.CFF_TASKS_PROJECT_REPORTS.workbook(data,includeTexts):new Blob([format==='json'?JSON.stringify(data,null,2):window.CFF_TASKS_PROJECT_REPORTS.text(data,includeTexts)],{type:format==='json'?'application/json;charset=utf-8':'text/plain;charset=utf-8'});
      const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=`relatorio-${slug(data.project?.name||'projeto')}-${data.scope}-${data.generatedAt.slice(0,10)}.${{text:'txt',json:'json',xlsx:'xlsx'}[format]}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1500);api.toast('Relatório gerado');
    });
    window.addEventListener('pagehide',()=>{if(timer){clearTimeout(timer);api.save();}});
    pickProject();render();
    return {refresh:()=>{history.sync();pickProject();refresh();},switchView};
  }
  let baseline=null;
  function seedBaseline(key,id){if(!baseline){baseline={};seed(baseline);}return baseline[key]?.find(row=>row.id===id);}
  window.CFF_TASKS_PROJECTS = {keys,normalise,seed,seedBaseline,mount};
})();
