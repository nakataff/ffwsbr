const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(require.resolve('../js/public-account.js'),'utf8');

// Exercise the production renderer with delayed catalog/permission snapshots.
// Tab widgets are stateful stand-ins so replacing them loses the entered value.
function fixture(tab){
 const dom=new JSDOM('<main id="cff-account-root"></main>',{url:'https://centralfreefire.com.br/conta.html?tab='+tab,runScripts:'outside-only'}),w=dom.window;
 const root=w.document.querySelector('main'),mounted={quiz:0,points:0,inbox:0},stopped={quiz:0,points:0,inbox:0};
 const noop=()=>{},esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 Object.assign(w,{
  tab,user:{uid:'fan'},profile:{name:'Nakata',username:'nakataff',avatarId:'avatar',coverId:'cover',frameId:'frame',favoritePlayer:'mt7'},
  options:{teams:[],players:[]},catalog:{},ownership:{},roles:{},grants:{},database:{},auth:{},
  viewUid:'',viewInstagram:'',viewSlug:'',publicProfile:null,communityStatus:null,instagramLinkState:'checking',
  stopPass:null,stopInbox:null,stopQuiz:null,stopEconomy:null,stopCodeGiftInventory:null,inventoryTab:'gifts',
  registrationReady:true,accountLoadError:null,instagramAnchorHandled:false,
  $:id=>w.document.getElementById(id),esc,profileEmblems:{mount:noop},profileEmblemUid:()=>w.user?.uid||'',
  registrationComplete:()=>true,findOption:(o,id)=>o.players.find(x=>x.id===id),theme:()=> 'cyan',
  hasCover:p=>!!(w.catalog[p.coverId]&&w.ownership[p.coverId]),
  cover:p=>w.hasCover(p)?'<img class="cff-profile-cover-image" src="/cover.webp">':'',
  avatarControl:p=>'<img class="cff-profile-avatar" src="/'+(w.catalog[p.avatarId]&&w.ownership[p.avatarId]?'custom':'default')+'.webp">'+(w.catalog[p.frameId]&&w.ownership[p.frameId]?'<img class="cff-profile-frame-image" src="/frame.webp">':''),
  button:(text,action)=>'<button data-account-action="'+action+'">'+text+'</button>',shareSvg:'',
  profileRoleBadge:()=>'<span class="cff-profile-role">'+(w.roles.administrator?'Administrador':'Membro')+'</span>',
  profileInstagramHtml:()=>'<span data-instagram-link>@nakataff</span>',
  profileBadgeIcons:()=>w.grants.winner?'<span class="cff-profile-badge-icon">Campeão</span>':'',
  teamMarks:()=>w.options.teams.map(x=>'<span class="cff-team-chip">'+x.name+'</span>').join(''),
  instagramHtml:()=>'<div data-account-instagram-connect></div>',
  seasonPassUI:{mountTeaser:noop},profileCheckin:{mount:noop},instagramConnect:{mount:noop},
  hydrateProfileImages:noop,approvedImage:()=>'<img alt="Item da loja" src="/item.webp">',
  mountFavoriteFeed:noop,mountAccountNotifications:noop,
  communityProfileUI:{mount(){const hero=root.querySelector('.cff-profile-hero');if(hero&&!hero.querySelector('[data-community-actions]'))hero.insertAdjacentHTML('beforeend','<div data-community-actions>Cartão para stories</div>');}},
 });
 for(const [kind,mountName]of [['quiz','mountDailyQuiz'],['points','mountEconomy'],['inbox','mountUserInbox']])w[mountName]=host=>{mounted[kind]++;host.innerHTML='<input aria-label="Em andamento"><button>Continuar</button>'+(kind==='points'?'<span data-eco-asset="item"></span>':'');return()=>stopped[kind]++;};
 w.eval(source.match(/^function hero\([^\n]+/m)[0]);
 w.eval(source.match(/^function refreshOwnInstagramBadge\([^\n]+/m)[0]);
 w.eval(source.slice(source.includes('const ownHeroMarkup=')?source.indexOf('const ownHeroMarkup='):source.indexOf('function render(){'),source.indexOf('\nfunction injectAccountAccess')));
 return {w,root,mounted,stopped,close:()=>w.close()};
}

for(const tab of ['quiz','points','inbox'])test(tab+': late profile assets and roles refresh the header without remounting the active tab',()=>{
 const f=fixture(tab),{w,root}=f;
 try{
  w.render();
  assert.match(root.querySelector('.cff-profile-avatar').src,/default.webp$/);
  const panel=root.querySelector('[data-uid="fan"]'),input=panel.querySelector('input');
  input.value='Resposta ou compra em andamento';input.focus();
  // The saved profile arrives before its options, catalog and access grants.
  w.options={teams:[{name:'LOS'},{name:'Fluxo'}],players:[{id:'mt7',name:'MT7'}]};w.render();
  assert.match(root.querySelector('.cff-profile-hero').textContent,/Jogador favorito: MT7/);
  w.catalog={avatar:{},cover:{},frame:{}};w.render();
  w.ownership={avatar:true,cover:true,frame:true};w.render();
  w.roles={administrator:true};w.render();
  w.grants={winner:true};w.render();
  const header=root.querySelector('.cff-profile-hero');
  assert.match(header.querySelector('.cff-profile-avatar').src,/custom.webp$/);
  assert(header.querySelector('.cff-profile-cover-image'));
  assert(header.querySelector('.cff-profile-frame-image'));
  assert.match(header.querySelector('.cff-profile-role').textContent,/Administrador/);
  assert.match(header.textContent,/Campeão/);assert.match(header.textContent,/LOS/);
  assert(header.querySelector('[data-community-actions]'));
  assert.equal(root.querySelector('[data-uid="fan"]'),panel);
  assert.equal(panel.querySelector('input'),input);assert.equal(input.value,'Resposta ou compra em andamento');
  assert.equal(w.document.activeElement,input);
  assert.equal(f.mounted[tab],1);assert.equal(f.stopped[tab],0);
  w.render();assert.equal(root.querySelector('.cff-profile-hero'),header,'unchanged data does not redraw the header');
  if(tab==='points')assert(panel.querySelector('[data-eco-asset] img'),'shop images still hydrate');
  // Later revocations also refresh the header rather than leaving equipped art.
  w.ownership={};w.roles={};w.render();
  assert(!root.querySelector('.cff-profile-cover-image'));assert(!root.querySelector('.cff-profile-frame-image'));
  assert.equal(root.querySelector('.cff-profile-role').textContent,'Membro');
  assert.equal(root.querySelector('[data-uid="fan"]'),panel);
 }finally{f.close();}
});

test('changing the signed-in account replaces the previous account tab instead of preserving its contents',()=>{
 const f=fixture('quiz'),{w,root}=f;
 try{
  w.render();const previous=root.querySelector('[data-account-quiz]');previous.querySelector('input').value='Old answer';
  w.user={uid:'other'};w.profile={name:'Outra pessoa'};w.render();
  assert(!previous.isConnected);assert.equal(root.querySelector('[data-account-quiz]').dataset.uid,'other');
  assert.equal(root.querySelector('input').value,'');assert.match(root.querySelector('h1').textContent,/Outra pessoa/);
  assert.equal(f.mounted.quiz,2);assert.equal(f.stopped.quiz,1);
 }finally{f.close();}
});

test('the verified emblem repaints after header updates without adding subscriptions',async()=>{
 const f=fixture('quiz'),{w,root}=f,reads=[];
 try{
  w.eval(fs.readFileSync(require.resolve('../js/profile-emblems.mjs'),'utf8').replace(/^export /gm,''));
  const portrait=w.avatarControl;w.avatarControl=p=>portrait(p)+'<span data-emblem-uid="fan"></span>';
  w.profileEmblems=w.createEmblemDisplay({root:()=>root,subscribe:(path,next)=>{reads.push(path);w.queueMicrotask(()=>next(path.includes('Assignments')?{emblemId:'verified'}:null));return()=>{};},image:()=>'',hydrate(){}});
  w.render();await new Promise(r=>setTimeout(r,0));
  assert(root.querySelector('[data-emblem-uid] .cff-community-emblem'));
  w.roles={administrator:true};w.render();await new Promise(r=>setTimeout(r,0));
  assert(root.querySelector('[data-emblem-uid] .cff-community-emblem'));
  assert.deepEqual(reads,['communityEmblemCatalog','communityEmblemAssignments/fan']);
 }finally{w.profileEmblems.stop();await new Promise(r=>setTimeout(r,0));f.close();}
});
