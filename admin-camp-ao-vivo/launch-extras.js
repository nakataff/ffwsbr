(function(){
  'use strict';
  const $=selector=>document.querySelector(selector);
  const KEY='cff_camp_extra_entries_v1';
  const TYPES={
    position:{name:'Posição da queda',label:'POSIÇÃO'},
    kills:{name:'Abates da queda',label:'ABATES'},
    dropPoints:{name:'Pontuação da queda',label:'PTS QUEDA'},
    placementPoints:{name:'Pontos de colocação',label:'PTS COL.'},
    totalPoints:{name:'Pontuação acumulada',label:'PTS ACUM.'},
    totalKills:{name:'Abates acumulados',label:'ABAT. AC.'},
    initialPoints:{name:'Pontos iniciais',label:'PTS INIC.'}
  };
  const SIZES={
    width:{label:'Largura da caixa',min:45,max:160,base:'fieldWidth',fallback:50},
    height:{label:'Altura da caixa',min:28,max:60,base:'fieldHeight',fallback:32},
    font:{label:'Fonte dos números',min:12,max:26,base:'valueSize',fallback:14},
    label:{label:'Fonte do rótulo',min:8,max:16,base:'labelSize',fallback:9.5}
  };
  const uid=()=>crypto.randomUUID();
  const numeric=value=>value!==null&&value!==undefined&&value!==''&&Number.isInteger(Number(value))?Number(value):null;
  const primary=(prefix,code)=>document.getElementById(prefix+'-'+code);
  const mode=()=>$('#input-mode')?.value||'per-drop';
  const detailed=()=>$('#game-detail-mode')?.value==='detailed';
  const index=()=>Number($('#drop-num')?.value)-1;
  const starting=()=>$('#drop-num')?.value==='starting';
  function owner(){return ($('#tournament-name')?.value||'')+'|'+[...document.querySelectorAll('#teams-inputs-container .team-row')].map(codeFor).sort().join(',')}
  function scope(){
    const state=window.v76TournamentMode?.getState?.()||{};
    return ($('#tournament-name')?.value||'')+'|'+(state.ownerStageId||'')+'|'+(state.editingDayId||'draft-'+(state.draftDayNumber||1))+'|'+$('#drop-num')?.value;
  }
  function codeFor(row){return row.querySelector('input[id^="kills-"],input[id^="pts-"],input[id^="place-"],input[id^="start-"]')?.id.replace(/^(kills|pts|place|start)-/,'')||row.querySelector('input[name="booyah"]')?.value||''}
  function normalizeConfig(value){
    const ids=new Set();
    const fields=(Array.isArray(value?.fields)?value.fields:[]).filter(field=>TYPES[field?.kind]).map(field=>{
      let id=/^[\w-]{1,64}$/.test(field.id||'')?field.id:uid();if(ids.has(id))id=uid();ids.add(id);
      const next={id,kind:field.kind};
      Object.entries(SIZES).forEach(([key,size])=>{next[key]=typeof field[key]==='number'&&Number.isFinite(field[key])?Math.min(size.max,Math.max(size.min,field[key])):null});
      return next;
    });
    return {enabled:value?.enabled===true,fields};
  }
  function normalizeDrafts(value){
    const next=Object.create(null);
    if(value&&typeof value==='object')Object.entries(value).forEach(([key,teams])=>{
      const rows=Object.create(null);
      if(teams&&typeof teams==='object')Object.entries(teams).forEach(([code,state])=>{
        if(!state||typeof state!=='object')return;
        rows[code]={position:numeric(state.position),kills:numeric(state.kills),dropPoints:numeric(state.dropPoints),placementPoints:numeric(state.placementPoints),source:state.source==='kills'?'kills':'points'};
      });
      next[key]=rows;
    });
    return next;
  }
  let config,drafts;
  try{
    const backup=JSON.parse(localStorage.getItem('ffws_autosave')||'null'),cache=JSON.parse(localStorage.getItem(KEY)||'null');
    const fallback=cache?.owner===owner()?cache:null;
    config=normalizeConfig(cache?.config||backup?.config?.cffLaunchExtraFieldsV1);
    drafts=normalizeDrafts(backup?.cffExtraEntriesV1?.drafts||fallback?.drafts);
  }catch(_){config=normalizeConfig(null);drafts=normalizeDrafts(null)}
  const SLOT_FOCUS_KEY='cff_camp_slot_focus_v1';
  const normalizeSlotFocus=value=>({enabled:value?.enabled===true,target:/^(auto|main:(kills|pts|place|pospick|start)|extra:[\w-]+)$/.test(value?.target||'')?value.target:'auto'});
  let slotFocus,focusedSlotKey=null,slotFocusAnchor=null;
  try{const backup=JSON.parse(localStorage.getItem('ffws_autosave')||'null');slotFocus=normalizeSlotFocus(JSON.parse(localStorage.getItem(SLOT_FOCUS_KEY)||'null')||backup?.config?.cffLaunchSlotFocusV1)}
  catch(_){slotFocus=normalizeSlotFocus(null)}
  function saveSlotFocus(){
    try{localStorage.setItem(SLOT_FOCUS_KEY,JSON.stringify(slotFocus))}catch(_){}
    if(window.__CFF_CAMP_READY__)window.autoSave?.(true);
  }
  function slotKey(input){
    if(input?.matches?.('.cff-extra-input'))return 'extra:'+input.closest('.cff-extra-field')?.dataset.cffExtraId;
    const prefix=input?.id?.match(/^(kills|pts|place|pospick|start)-/)?.[1];
    return prefix&&input.matches('input[type="number"],input[type="text"],select')?'main:'+prefix:null;
  }
  function availableSlot(input){return !!slotKey(input)&&!input.disabled&&!input.readOnly&&input.getClientRects().length>0&&getComputedStyle(input).visibility!=='hidden'}
  function slotInputs(){return [...document.querySelectorAll('#teams-inputs-container .team-row input,#teams-inputs-container .team-row select')].filter(availableSlot)}
  function focusSlots(key){return slotInputs().filter(input=>slotKey(input)===key)}
  function focusSlot(input){
    if(!input)return;
    input.focus();try{input.select?.()}catch(_){}
    input.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function rememberSlotFocus(input){
    slotFocusAnchor={input,key:slotKey(input),code:codeFor(input.closest('.team-row')),start:input.selectionStart,end:input.selectionEnd};
  }
  function anchoredSlot(){
    if(!slotFocusAnchor)return null;
    if(slotFocusAnchor.input.isConnected&&availableSlot(slotFocusAnchor.input))return slotFocusAnchor.input;
    return focusSlots(slotFocusAnchor.key).find(input=>codeFor(input.closest('.team-row'))===slotFocusAnchor.code)||null;
  }
  function restoreSlotFocus(){
    if(!slotFocus.enabled||![document.body,document.documentElement].includes(document.activeElement))return;
    const input=anchoredSlot();if(!input)return;
    const {start,end}=slotFocusAnchor;input.focus();
    if(start!==null&&end!==null)try{input.setSelectionRange(start,end)}catch(_){}
  }
  document.addEventListener('pointerdown',event=>{if(!event.target.closest?.('#teams-inputs-container')||!availableSlot(event.target))slotFocusAnchor=null},true);
  function syncSlotFocusUi(){
    const wrap=$('#cff-slot-focus-tools');if(!wrap)return;
    const toggle=$('#cff-slot-focus-enabled'),select=$('#cff-slot-focus-field'),start=$('#cff-slot-focus-start');
    const eligible=slotInputs(),availableKeys=new Set(eligible.map(slotKey));
    const options=new Map([['auto','Campo em que eu clicar']]);
    [...document.querySelectorAll('#teams-inputs-container .team-row input,#teams-inputs-container .team-row select')].filter(input=>slotKey(input)&&input.getClientRects().length>0&&getComputedStyle(input).visibility!=='hidden').forEach(input=>{
      const key=slotKey(input);if(options.has(key))return;
      if(key.startsWith('extra:')){
        const index=config.fields.findIndex(field=>key==='extra:'+field.id),field=config.fields[index];
        if(field)options.set(key,'Extra '+(index+1)+' · '+TYPES[field.kind].name);
      }else{
        const kind=primaryKind(input)||(input.id.startsWith('pospick-')?'position':null);
        options.set(key,(TYPES[kind]?.name||input.closest('.small-cell')?.querySelector('.micro-label')?.textContent||'Campo')+' · principal');
      }
    });
    if(!options.has(slotFocus.target))options.set(slotFocus.target,'Campo indisponível neste modo');
    const signature=JSON.stringify([...options].map(([key,name])=>[key,name,key==='auto'||availableKeys.has(key)]));
    if(select.dataset.signature!==signature){
      select.replaceChildren();options.forEach((name,key)=>{const option=document.createElement('option');option.value=key;option.textContent=name;option.disabled=key!=='auto'&&!availableKeys.has(key);select.appendChild(option)});select.dataset.signature=signature;
    }
    toggle.checked=slotFocus.enabled;select.value=slotFocus.target;select.hidden=start.hidden=!slotFocus.enabled;
    const activeKey=slotFocus.target==='auto'?focusedSlotKey:slotFocus.target;
    start.disabled=!(slotFocus.target==='auto'?eligible.length:availableKeys.has(slotFocus.target));
    wrap.title='Tab: próximo time · Shift+Tab: time anterior · Esc: sair do foco';
    document.querySelectorAll('#teams-inputs-container .cff-slot-focus-target').forEach(input=>{if(!slotFocus.enabled||!availableSlot(input)||slotKey(input)!==activeKey)input.classList.remove('cff-slot-focus-target')});
    if(slotFocus.enabled&&activeKey)focusSlots(activeKey).forEach(input=>input.classList.add('cff-slot-focus-target'));
  }
  function buildSlotFocusUi(){
    const toolbar=$('#v81-launch-view-tools');if(!toolbar||$('#cff-slot-focus-tools'))return;
    const wrap=document.createElement('div');wrap.id='cff-slot-focus-tools';
    wrap.innerHTML='<label class="switch" for="cff-slot-focus-enabled"><input id="cff-slot-focus-enabled" type="checkbox"> Foco nos slots</label><select id="cff-slot-focus-field" aria-label="Campo para focar nos slots"></select><button id="cff-slot-focus-start" type="button" class="btn-mini">Iniciar</button>';
    $('#v81-grid-config-button')?.insertAdjacentElement('afterend',wrap);
    $('#cff-slot-focus-enabled').addEventListener('change',event=>{slotFocus.enabled=event.target.checked;slotFocusAnchor=null;syncSlotFocusUi();saveSlotFocus()});
    $('#cff-slot-focus-field').addEventListener('change',event=>{slotFocus.target=event.target.value;syncSlotFocusUi();saveSlotFocus()});
    $('#cff-slot-focus-start').addEventListener('click',()=>{
      const current=focusedSlotKey?focusSlots(focusedSlotKey):[];
      const inputs=slotFocus.target==='auto'?(current.length?current:slotInputs()):focusSlots(slotFocus.target);
      focusSlot(inputs[0]);
    });
    syncSlotFocusUi();
  }
  document.addEventListener('focusin',event=>{
    if(slotFocus.enabled&&event.target.closest?.('#teams-inputs-container')&&availableSlot(event.target)){rememberSlotFocus(event.target);focusedSlotKey=slotKey(event.target);syncSlotFocusUi()}
    else if(event.target!==document.body)slotFocusAnchor=null;
  });
  document.addEventListener('keydown',event=>{
    if(!slotFocus.enabled||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return;
    const input=event.target===document.body?anchoredSlot():event.target;if(!input?.closest?.('#teams-inputs-container')||!availableSlot(input))return;
    if(event.key==='Escape'){slotFocus.enabled=false;slotFocusAnchor=null;syncSlotFocusUi();saveSlotFocus();return}
    if(event.key!=='Tab')return;
    const key=slotFocus.target==='auto'?slotKey(input):slotFocus.target;
    if(slotKey(input)!==key)return;
    const inputs=focusSlots(key),current=inputs.indexOf(input);if(current<0)return;
    event.preventDefault();focusSlot(inputs[(current+(event.shiftKey?-1:1)+inputs.length)%inputs.length]);
  },true);
  let applying=false,queued=false,handledInput=null;
  function persist(saveCamp=true){
    try{localStorage.setItem(KEY,JSON.stringify({owner:owner(),config,drafts}))}
    catch(_){window.CFF_CAMP?.toast?.('Não foi possível salvar as entradas extra neste navegador.','err')}
    if(saveCamp&&window.__CFF_CAMP_READY__)window.autoSave?.(true);
  }
  function prior(code){
    return {points:window.getPreviousTotalUntil?.(index(),code,true)||0,kills:window.getPreviousKillsUntil?.(index(),code)||0};
  }
  function placePoints(position){return position===null?null:Number(window.getPlacementPoints?.(position)||0)}
  function inferPosition(points,code){
    return points===null?null:numeric(window.getPlacementFromPlacementPoints?.(points,primary('top12',code)?.checked===true));
  }
  function mainState(code){
    const m=mode(),p=prior(code),points=numeric(primary('pts',code)?.value),kills=numeric(primary('kills',code)?.value);
    let position=numeric(primary('place',code)?.value),placementPoints=null,dropPoints=null,k=kills,source='points';
    if(primary('boo',code)?.checked)position=1;
    else if(primary('top12',code)?.checked)position=12;
    if(m==='detail-pos-kills'){
      source='kills';placementPoints=placePoints(position);dropPoints=placementPoints!==null&&k!==null?placementPoints+k:null;
    }else if(m==='detail-points-kills'){
      source='kills';placementPoints=points;position=numeric(primary('pospick',code)?.value)??inferPosition(points,code);dropPoints=points!==null&&k!==null?points+k:null;
    }else{
      dropPoints=points===null?null:points-(['cumulative','detail-cumulative-kills','detail-pos-total'].includes(m)?p.points:0);
      if(k!==null&&['cumulative','per-drop-cumulative-kills','detail-cumulative-kills'].includes(m))k-=p.kills;
      if(position!==null){placementPoints=placePoints(position);if(k===null&&dropPoints!==null)k=dropPoints-placementPoints}
      else if(k!==null&&dropPoints!==null){placementPoints=dropPoints-k;position=inferPosition(placementPoints,code)}
      if(k===null&&dropPoints===null){try{k=numeric(dropsData?.[index()]?.kills?.[code])}catch(_){}}
    }
    return {position,kills:k,dropPoints,placementPoints,source};
  }
  function stateFor(code,key=scope()){return drafts[key]?.[code]||mainState(code)}
  function validPosition(position){return Number.isInteger(position)&&position>=1&&position<=Math.max(12,document.querySelectorAll('#teams-inputs-container .team-row').length)}
  function solve(state,kind,value,code){
    const next={...state},p=prior(code);
    if(kind==='totalKills'){kind='kills';value=value===null?null:value-p.kills}
    if(kind==='totalPoints'){kind='dropPoints';value=value===null?null:value-p.points}
    if(kind==='position'){
      next.position=value;next.placementPoints=validPosition(value)?placePoints(value):null;
      if(next.placementPoints===null){if(next.source==='kills')next.dropPoints=null;else next.kills=null}
      else if(next.source==='kills'&&next.kills!==null)next.dropPoints=next.placementPoints+next.kills;
      else if(next.dropPoints!==null)next.kills=next.dropPoints-next.placementPoints;
      else if(next.kills!==null)next.dropPoints=next.placementPoints+next.kills;
    }else if(kind==='placementPoints'){
      next.placementPoints=value;next.position=inferPosition(value,code);
      next.dropPoints=value!==null&&next.kills!==null?value+next.kills:null;
    }else if(kind==='kills'){
      next.kills=value;next.source='kills';
      if(validPosition(next.position))next.placementPoints=placePoints(next.position);
      else if(value!==null&&next.dropPoints!==null){next.placementPoints=next.dropPoints-value;next.position=inferPosition(next.placementPoints,code)}
      next.dropPoints=value!==null&&next.placementPoints!==null?value+next.placementPoints:null;
    }else if(kind==='dropPoints'){
      next.dropPoints=value;next.source='points';
      if(value===null){next.kills=null;next.placementPoints=placePoints(next.position)}
      else if(validPosition(next.position)){next.placementPoints=placePoints(next.position);next.kills=value-next.placementPoints}
      else if(next.kills!==null){next.placementPoints=value-next.kills;next.position=inferPosition(next.placementPoints,code)}
    }
    return next;
  }
  function invalid(state){
    return (state.position!==null&&!validPosition(state.position))||['kills','dropPoints','placementPoints'].some(key=>state[key]!==null&&state[key]<0)||
      (state.placementPoints!==null&&inferPosition(state.placementPoints,'')===null);
  }
  function valueFor(state,kind,code){
    const p=prior(code);
    if(kind==='totalPoints')return state.dropPoints===null?null:p.points+state.dropPoints;
    if(kind==='totalKills')return state.kills===null?null:p.kills+state.kills;
    if(kind==='initialPoints'){try{return numeric(startingPoints?.[code])??0}catch(_){return 0}}
    return state[kind];
  }
  function syncMain(code,state){
    const m=mode(),p=prior(code);
    const set=(prefix,value)=>{const input=primary(prefix,code);if(input&&input!==document.activeElement&&input.value!==String(value??''))input.value=value??''};
    set('place',state.position);
    set('kills',state.kills===null?null:state.kills+(['detail-cumulative-kills','cumulative','per-drop-cumulative-kills'].includes(m)?p.kills:0));
    set('pts',m==='detail-points-kills'?state.placementPoints:state.dropPoints===null?null:state.dropPoints+(['detail-pos-total','detail-cumulative-kills','cumulative'].includes(m)?p.points:0));
    const picker=primary('pospick',code);if(picker)picker.value=state.position??'';
    const top=primary('top12',code),boo=primary('boo',code);
    if(top)top.checked=state.position===12;
    if(boo){if(state.position===1)document.querySelectorAll('input[name="booyah"]').forEach(input=>input.checked=input===boo);else boo.checked=false}
  }
  function refreshCore(code){
    window.updatePositionPointsCalculationV82?.(code);
    window.updateAllPointInputStates?.();window.refreshPositionLocks?.();window.updatePostPreview?.();window.updateDropFillCounter?.();
  }
  function commitCurrent(){
    if(starting()||!Number.isInteger(index())||index()<0)return;
    try{dropsData[index()]=window.captureCurrentDropFromScreen(dropsData[index()])}catch(error){console.warn('[Entradas extra] captura indisponível',error)}
  }
  function edit(code,kind,raw){
    if(applying)return;
    applying=true;
    try{
      const value=numeric(raw);
      if(kind==='initialPoints'){
        if($('#starting-enabled')?.value!=='yes')return;
        if(value===null||value<0)return;
        const state=stateFor(code);
        try{startingPoints[code]=value}catch(_){return}
        const input=primary('start',code);if(input)input.value=value;
        if(!starting()){
          const key=scope();drafts[key]=drafts[key]||Object.create(null);drafts[key][code]=state;
          syncMain(code,state);refreshCore(code);commitCurrent();
        }
      }else{
        const key=scope();drafts[key]=drafts[key]||Object.create(null);
        drafts[key][code]=solve(stateFor(code,key),kind,value,code);
        syncMain(code,drafts[key][code]);refreshCore(code);commitCurrent();
      }
      renderRows();persist();window.scheduleAutomaticTableUpdate?.();
    }finally{applying=false}
  }
  function primaryKind(input){
    const m=mode();
    if(input.id.startsWith('place-'))return 'position';
    if(input.id.startsWith('start-'))return 'initialPoints';
    if(input.id.startsWith('kills-'))return ['detail-cumulative-kills','cumulative','per-drop-cumulative-kills'].includes(m)?'totalKills':'kills';
    if(input.id.startsWith('pts-'))return m==='detail-points-kills'?'placementPoints':['detail-cumulative-kills','detail-pos-total','cumulative'].includes(m)?'totalPoints':'dropPoints';
    return null;
  }
  function watchPrimary(input){
    const kind=primaryKind(input),code=input.id.replace(/^(kills|pts|place|start)-/,'');
    if(kind&&(config.enabled&&config.fields.length||drafts[scope()]?.[code]))edit(code,kind,input.value);
  }
  function renderRows(){
    const key=scope();
    document.querySelectorAll('#teams-inputs-container .team-row').forEach(row=>{
      const code=codeFor(row);if(!code)return;
      let grid=row.querySelector(':scope>.cff-extra-grid');
      if(!config.enabled||!config.fields.length){grid?.remove();return}
      if(!grid){grid=document.createElement('div');grid.className='cff-extra-grid';row.appendChild(grid)}
      const signature=config.fields.map(field=>field.id+':'+field.kind).join('|');
      if(grid.dataset.signature!==signature){
        grid.replaceChildren();grid.dataset.signature=signature;
        config.fields.forEach(field=>{
          const cell=document.createElement('label');cell.className='cff-extra-field';cell.dataset.cffExtraId=field.id;
          const label=document.createElement('span');label.className='micro-label';label.textContent=TYPES[field.kind].label;
          const input=document.createElement('input');input.type='number';input.min=field.kind==='position'?'1':'0';input.step='1';input.className='cff-extra-input';
          input.dataset.cffExtraKind=field.kind;input.dataset.cffExtraTeam=code;input.setAttribute('aria-label',TYPES[field.kind].name+' de '+code);
          input.title=TYPES[field.kind].name;input.placeholder='—';
          if(field.kind==='position')input.max=Math.max(12,document.querySelectorAll('#teams-inputs-container .team-row').length);
          cell.title=TYPES[field.kind].name;cell.append(label,input);grid.appendChild(cell);
        });
        const warning=document.createElement('span');warning.className='cff-extra-warning';warning.setAttribute('role','status');grid.appendChild(warning);
      }
      const state=stateFor(code,key);
      config.fields.forEach(field=>{
        const cell=[...grid.children].find(cell=>cell.dataset.cffExtraId===field.id),input=cell.querySelector('input');
        Object.keys(SIZES).forEach(size=>{const value=field[size]===null?'var(--cff-launch-'+SIZES[size].base+','+SIZES[size].fallback+'px)':field[size]+'px';const property='--cff-extra-'+size;if(cell.style.getPropertyValue(property)!==value)cell.style.setProperty(property,value)});
        const value=valueFor(state,field.kind,code);
        if(input!==document.activeElement&&input.value!==String(value??''))input.value=value??'';
        input.disabled=(starting()&&field.kind!=='initialPoints')||(field.kind==='initialPoints'&&$('#starting-enabled')?.value!=='yes');
        input.setAttribute('aria-invalid',String(value!==null&&(value<0||field.kind==='position'&&!validPosition(value))));
      });
      const warning=grid.querySelector('.cff-extra-warning'),text=invalid(state)?'Confira os valores: pontos e abates não correspondem à colocação.':'';
      if(warning.textContent!==text)warning.textContent=text;
      warning.hidden=!text;
    });
    buildSlotFocusUi();syncSlotFocusUi();restoreSlotFocus();
  }
  function queueRender(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;renderRows()})}
  function installDataHooks(){
    const capture=window.captureCurrentDropFromScreen;
    window.captureCurrentDropFromScreen=function(){
      const record=capture.apply(this,arguments);if(starting())return record;
      const rows=drafts[scope()];if(!rows)return record;
      Object.entries(rows).forEach(([code,state])=>{
        if(!primary('pts',code)&&!primary('place',code)&&!primary('kills',code))return;
        const place=validPosition(state.position)?state.position:null,hasKills=state.kills!==null&&state.kills>=0;
        record.placements[code]=place;record.top12[code]=place===12;
        record.kills[code]=hasKills?state.kills:null;
        const consistent=!invalid(state)&&state.dropPoints!==null&&state.dropPoints>=0&&(!detailed()||place!==null&&hasKills&&state.dropPoints===placePoints(place)+state.kills);
        record.points[code]=consistent?state.dropPoints:null;
        if(place===1)record.booyah=code;else if(record.booyah===code)record.booyah='';
      });
      return record;
    };
    const load=window.loadDropData;
    window.loadDropData=function(){
      const result=load.apply(this,arguments);
      applying=true;
      try{Object.entries(drafts[scope()]||{}).forEach(([code,state])=>{syncMain(code,state);refreshCore(code)})}finally{applying=false}
      queueRender();return result;
    };
    const handler=window.handleScoreInput;
    window.handleScoreInput=function(input){
      if(!applying&&input&&input!==handledInput)watchPrimary(input);
      const result=handler.apply(this,arguments);queueRender();return result;
    };
    const collect=window.collectBackupData;
    window.collectBackupData=function(){
      const data=collect.apply(this,arguments);data.config=data.config||{};data.config.cffLaunchExtraFieldsV1=JSON.parse(JSON.stringify(config));data.config.cffLaunchSlotFocusV1={...slotFocus};data.cffExtraEntriesV1={drafts:JSON.parse(JSON.stringify(drafts))};return data;
    };
    const importer=window.importBackup;
    window.importBackup=function(){
      let data;try{data=JSON.parse($('#backup-input')?.value||'')}catch(_){}
      const previous={config,drafts,slotFocus};
      if(data?.config){drafts=normalizeDrafts(data.cffExtraEntriesV1?.drafts);focusedSlotKey=null;slotFocusAnchor=null}
      try{const result=importer.apply(this,arguments);renderConfiguration();renderRows();persist();saveSlotFocus();return result}
      catch(error){config=previous.config;drafts=previous.drafts;slotFocus=previous.slotFocus;throw error}
    };
    const clearSlot=window.clearTeamSlot;
    window.clearTeamSlot=function(code){if(drafts[scope()])delete drafts[scope()][code];const result=clearSlot.apply(this,arguments);commitCurrent();renderRows();persist();return result};
    ['v38ClearCurrentDrop','v38ClearAllDrops'].forEach(name=>{
      const clear=window[name];if(typeof clear!=='function')return;
      window[name]=function(){
        const key=scope(),previous=drafts,first=$('#teams-inputs-container .team-row input[type="number"]'),firstRow=$('#teams-inputs-container .team-row'),drop=Number($('#drop-num')?.value);
        drafts=name==='v38ClearAllDrops'?Object.fromEntries(Object.entries(drafts).filter(([entry])=>entry.slice(0,entry.lastIndexOf('|'))!==key.slice(0,key.lastIndexOf('|')))):{...drafts};
        if(name==='v38ClearCurrentDrop')delete drafts[key];
        const result=clear.apply(this,arguments);
        if(first===$('#teams-inputs-container .team-row input[type="number"]'))drafts=previous;
        if(firstRow&&firstRow!==$('#teams-inputs-container .team-row'))window.dispatchEvent(new CustomEvent('cff:camp-drops-cleared',{detail:{all:name==='v38ClearAllDrops',drop}}));
        renderRows();persist();return result;
      };
    });
    const clearPlaces=window.clearAllPlacements;
    window.clearAllPlacements=function(){
      const key=scope();Object.entries(drafts[key]||{}).forEach(([code,state])=>drafts[key][code]=solve(state,'position',null,code));
      const result=clearPlaces.apply(this,arguments);
      applying=true;try{Object.entries(drafts[key]||{}).forEach(([code,state])=>{syncMain(code,state);refreshCore(code)});commitCurrent()}finally{applying=false}
      renderRows();persist();return result;
    };
  }
  function openConfiguration(){window.CFF_CAMP?.openLaunchEditor?.();const group=$('#cff-extra-editor');if(group){group.open=true;group.scrollIntoView({block:'nearest',behavior:'smooth'})}}
  function changeConfig(){renderConfiguration();renderRows();persist()}
  function addField(){config.enabled=true;config.fields.push({id:uid(),kind:'kills',width:null,height:null,font:null,label:null});changeConfig()}
  function renderConfiguration(){
    const toggle=$('#cff-extra-enabled');if(toggle)toggle.checked=config.enabled;
    const editorToggle=$('#cff-extra-editor-enabled');if(editorToggle)editorToggle.checked=config.enabled;
    const list=$('#cff-extra-config-list');if(!list)return;
    const signature=config.fields.map(field=>field.id+':'+field.kind).join('|');
    if(list.dataset.signature===signature)return;
    list.dataset.signature=signature;list.replaceChildren();
    if(!config.fields.length){const note=document.createElement('p');note.textContent='Adicione os campos que quiser acompanhar.';list.appendChild(note)}
    config.fields.forEach((field,index)=>{
      const card=document.createElement('div');card.className='cff-extra-config';
      const heading=document.createElement('div');heading.className='cff-extra-config-heading';
      const label=document.createElement('label');label.textContent='Entrada '+(index+1);label.htmlFor='cff-extra-type-'+field.id;
      const remove=document.createElement('button');remove.type='button';remove.className='btn-mini';remove.textContent='Remover';remove.setAttribute('aria-label','Remover entrada '+(index+1));
      remove.addEventListener('click',()=>{config.fields=config.fields.filter(entry=>entry.id!==field.id);if(!config.fields.length)config.enabled=false;changeConfig()});heading.append(label,remove);card.appendChild(heading);
      const type=document.createElement('select');type.id=label.htmlFor;type.dataset.cffExtraConfig=field.id;
      Object.entries(TYPES).forEach(([value,entry])=>{const option=document.createElement('option');option.value=value;option.textContent=entry.name;type.appendChild(option)});
      type.value=field.kind;type.addEventListener('change',()=>{field.kind=type.value;changeConfig()});card.appendChild(type);
      const sizes=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Tamanho e fonte';sizes.appendChild(summary);
      Object.entries(SIZES).forEach(([key,size])=>{
        const row=document.createElement('label');row.className='cff-editor-control';row.textContent=size.label;
        const output=document.createElement('output');const input=document.createElement('input');input.type='range';input.min=size.min;input.max=size.max;input.step=key==='label'?'.5':'1';input.setAttribute('aria-label',size.label+' da entrada '+(index+1));
        const inherited=Number.parseFloat(getComputedStyle($('#teams-inputs-container')).getPropertyValue('--cff-launch-'+size.base));
        input.value=field[key]??(Number.isFinite(inherited)?inherited:size.fallback);
        output.textContent=field[key]===null?'Padrão':field[key]+' px';
        input.addEventListener('input',()=>{field[key]=Number(input.value);output.textContent=input.value+' px';renderRows();persist(false)});
        input.addEventListener('change',()=>persist());row.append(output,input);sizes.appendChild(row);
      });
      const reset=document.createElement('button');reset.type='button';reset.className='btn-mini';reset.textContent='Usar tamanhos padrão';reset.addEventListener('click',()=>{Object.keys(SIZES).forEach(key=>field[key]=null);list.dataset.signature='';changeConfig()});sizes.appendChild(reset);card.appendChild(sizes);list.appendChild(card);
    });
  }
  function buildUi(){
    const style=document.createElement('style');style.textContent=`
      #v81-launch-view-tools{flex-wrap:wrap;max-width:100%}
      #cff-slot-focus-tools{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-left:5px;max-width:100%}
      #cff-slot-focus-tools>.switch{display:flex;flex-direction:row;align-items:center;gap:5px;margin:0;white-space:nowrap;font-size:.74rem;text-transform:none}
      #cff-slot-focus-tools input{width:14px;height:14px;margin:0;accent-color:#ffaa00}
      #cff-slot-focus-tools>select{width:clamp(150px,17vw,235px);max-width:100%;min-width:0;height:34px;margin:0;padding:5px;font-size:.72rem}
      #cff-slot-focus-tools>.btn-mini{height:34px;margin:0}
      #cff-slot-focus-tools>[hidden]{display:none!important}
      #teams-inputs-container .cff-slot-focus-target{outline:1px solid #ffaa0060;outline-offset:2px}
      #teams-inputs-container .cff-slot-focus-target:focus{outline:2px solid #ffaa00;outline-offset:2px}
      #teams-inputs-container .cff-extra-grid{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px;min-width:0;padding-top:4px;border-top:1px solid #ffffff14}
      #teams-inputs-container .cff-extra-grid .cff-extra-field{display:flex;flex-direction:column;gap:0;flex:0 0 auto;min-width:0;width:max(var(--cff-extra-width),calc(var(--cff-extra-label) * 6.5));max-width:100%;margin:0;color:#9cb2cd;text-transform:none}
      #teams-inputs-container .cff-extra-grid .cff-extra-field>.micro-label{font-size:var(--cff-extra-label)!important;line-height:1.4!important;height:auto!important;min-height:max(22px,calc(var(--cff-extra-label) * 1.5))!important;color:var(--cff-launch-labelColor,#888)!important;white-space:nowrap;margin:0!important}
      #teams-inputs-container .cff-extra-grid .cff-extra-field>input.cff-extra-input{box-sizing:border-box!important;width:var(--cff-extra-width)!important;min-width:0!important;max-width:100%!important;height:var(--cff-extra-height)!important;padding:5px 3px!important;font-size:var(--cff-extra-font)!important;text-align:center;appearance:textfield;border-radius:5px}
      #teams-inputs-container .cff-extra-input::-webkit-inner-spin-button,#teams-inputs-container .cff-extra-input::-webkit-outer-spin-button{appearance:none;margin:0}
      #teams-inputs-container .cff-extra-input[aria-invalid="true"]{border-color:#fa7a88!important;color:#ffa6af!important}
      #teams-inputs-container .cff-extra-input:disabled{opacity:.4}
      #teams-inputs-container .cff-extra-warning{flex:1 0 100%;color:#ffa6af;font-size:.68rem;line-height:1.4}
      #teams-inputs-container .cff-extra-warning[hidden]{display:none}
      #cff-launch-editor .cff-extra-config{padding:10px;border:1px solid #39526b;border-radius:7px;background:#101b29;display:grid;gap:9px}
      #cff-launch-editor .cff-extra-config-heading{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:.75rem;color:#b7d7ef}
      #cff-launch-editor .cff-extra-config-heading label{margin:0;text-transform:none;font-size:inherit}
      #cff-launch-editor .cff-extra-config>select{width:100%;min-width:0;margin:0;font-size:.72rem;padding:7px 4px;height:34px}
      #cff-launch-editor .cff-extra-config>details{display:grid;gap:9px}
      #cff-launch-editor .cff-extra-config>details>summary{font-size:.72rem;padding:2px 0;cursor:pointer;color:#94bddd;margin-bottom:9px}
      #cff-launch-editor .cff-extra-config>details>.cff-editor-control{margin:10px 0}
      #cff-launch-editor #cff-extra-config-list{display:grid;gap:9px}
      #cff-launch-editor #cff-extra-config-list p{margin:0}
      #cff-extra-add{width:100%;text-align:left}
      #cff-extra-option-wrap{display:flex;align-items:center;gap:5px}
      #cff-extra-option-wrap>.switch{flex:1}
    `;document.head.appendChild(style);
    const editor=$('#cff-launch-editor');if(!editor)return;
    const group=document.createElement('details');group.id='cff-extra-editor';
    group.innerHTML='<summary>Entradas extra</summary><div class="cff-editor-fields"><label class="cff-editor-control"><span>Exibir entradas extra</span><input id="cff-extra-editor-enabled" type="checkbox"></label><p>Campos ligados aos valores da queda. Preencha o que já sabe; os demais são calculados quando houver dados suficientes.</p><div id="cff-extra-config-list"></div><button id="cff-extra-add" type="button" class="btn-mini">+ Adicionar entrada</button></div>';
    editor.querySelector('.cff-editor-preview').insertAdjacentElement('afterend',group);
    $('#cff-extra-add').addEventListener('click',addField);
    $('#cff-extra-editor-enabled').addEventListener('change',event=>{config.enabled=event.target.checked;if(config.enabled&&!config.fields.length)addField();else changeConfig()});
    const options=$('#cff-launch-group-entry .cff-launch-options');
    if(options){
      const wrap=document.createElement('div');wrap.id='cff-extra-option-wrap';
      wrap.innerHTML='<label class="switch">Entradas extra <input id="cff-extra-enabled" type="checkbox"></label><button type="button" class="btn-mini" aria-label="Configurar entradas extra">Configurar</button>';options.appendChild(wrap);
      wrap.querySelector('button').addEventListener('click',openConfiguration);
      $('#cff-extra-enabled').addEventListener('change',event=>{config.enabled=event.target.checked;if(config.enabled&&!config.fields.length)addField();else changeConfig();if(config.enabled)openConfiguration()});
    }
    renderConfiguration();
  }
  installDataHooks();buildUi();
  document.addEventListener('input',event=>{
    if(slotFocus.enabled&&event.target.closest?.('#teams-inputs-container')&&availableSlot(event.target)){rememberSlotFocus(event.target);queueMicrotask(restoreSlotFocus)}
    if(applying)return;
    const input=event.target;
    if(input.dataset.cffExtraKind){edit(input.dataset.cffExtraTeam,input.dataset.cffExtraKind,input.value);return}
    if(input.closest?.('#teams-inputs-container')&&primaryKind(input)){
      handledInput=input;watchPrimary(input);queueMicrotask(()=>{handledInput=null});
    }
  },true);
  document.addEventListener('change',event=>{
    const input=event.target;
    if(!applying&&input.closest?.('#teams-inputs-container')&&(input.id.startsWith('boo-')||input.id.startsWith('top12-'))){
      const code=input.id.replace(/^(boo|top12)-/,'');if(config.enabled||drafts[scope()]?.[code]){
        const raw=primary('place',code)?.value||primary('pospick',code)?.value;
        edit(code,'position',raw);
      }
    }
    queueRender();
  });
  new MutationObserver(queueRender).observe($('#teams-inputs-container'),{childList:true,subtree:true});
  applying=true;
  try{Object.entries(drafts[scope()]||{}).forEach(([code,state])=>{syncMain(code,state);refreshCore(code)});commitCurrent();renderRows()}finally{applying=false}
  persist(false);saveSlotFocus();
  window.CFF_CAMP={...(window.CFF_CAMP||{}),extraEntries:{open:openConfiguration,refresh:queueRender}};
})();

