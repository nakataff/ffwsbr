const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const share=fs.readFileSync('js/global-stats-share.js','utf8');
const css=fs.readFileSync('css/global-stats-share.css','utf8');
const markupMarker='window.CFFGlobalStatsShare={mount,open};';

function setup(){
 const window={};
 assert(share.includes(markupMarker));
 vm.runInNewContext(share.replace(markupMarker,
  'window.__probe={fromContext,state,searchSharePlayers,playerSearchSelectedValue,setContext:x=>context=x,setSource:x=>currentSource=x};'+markupMarker),
  {window,location:{origin:'https://centralfreefire.com.br'},URL,Intl,console});
 return window.__probe;
}

test('galeria apresenta seis modelos, com imagens locais e carrossel no mobile',()=>{
 const options=['team','player','top','record','compare','comparePlayer'];
 for(const type of options)assert(share.includes("id:'"+type+"',title:"),'modelo ausente: '+type);
 assert(share.includes('/home-assets/teams/global/loud.webp'));
 for(const player of ['fx-butzin','bru-joena','los-rigby','loud-trap','lyon-gamezking'])
  assert(share.includes('photos/480/'+player+'.webp'),player);
 assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-auto-columns:100%/);
 assert.match(css,/scroll-snap-type:x mandatory/);
 assert.match(share,/data-gallery-next/);
 assert.match(share,/data-gallery-prev/);
});

test('Resumo do recorte tem só uma ação; filtros exibem ícone sem legenda',()=>{
 assert(share.includes("shareButton('o resumo do recorte',()=>open({kind:'summary'}),true)"));
 assert(!share.includes("root.querySelectorAll('#anchor-s2-resumo .ffws-global-stat-card')"));
 assert(share.includes("shareButton('o recorte da página',()=>open({kind:'summary'}),true)"));
});

test('comparar jogadores usa atletas distintos, times e números do recorte',()=>{
 const api=setup();
 api.setContext({
  summary:{drops:8,kills:71},events:[{date:'2026-11-08'}],
  filters:{stage:'classificatoria',days:[],maps:[]},teams:[],
  players:[
   {name:'Trap',team:'LOUD',kills:14,damage:5400,assists:8,matches:8},
   {name:'Gamezking',team:'LYON',kills:17,damage:6100,assists:6,matches:8}
  ]
 });
 api.setSource(null);
 api.state.kind='comparePlayer';
 api.state.playerA='Trap|LOUD';
 api.state.playerB='Gamezking|LYON';
 const card=api.fromContext();
 assert.equal(card.title,'COMPARATIVO DE JOGADORES');
 assert.equal(card.twoPlayers.length,2);
 assert.equal(card.twoPlayers[0].name,'Trap');
 assert.equal(card.twoPlayers[1].name,'Gamezking');
 assert.equal(card.twoPlayers[0].kills,14);
 assert.equal(card.twoPlayers[1].damage,6100);
 assert(card.main.includes('14')&&card.main.includes('17'));
 api.state.playerB='Trap|LOUD';
 assert.equal(api.fromContext(),null);
});

test('busca local encontra nome ou time sem diferenciar acentos e caixa',()=>{
 const api=setup();
 api.setContext({players:[
  {name:'BuTziN',team:'FLUXO W7M',kills:20},
  {name:'Trap',team:'LOUD',kills:18},
  {name:'Gamezking',team:'LYON',kills:12},
  {name:'RIGBY',team:'LOS',kills:10}
 ]});
 assert.equal(api.searchSharePlayers('fluxo')[0].name,'BuTziN');
 assert.equal(api.searchSharePlayers('louD')[0].name,'Trap');
 assert.equal(api.searchSharePlayers('GÀMEZ')[0].name,'Gamezking');
 assert.equal(api.searchSharePlayers('los')[0].name,'RIGBY');
 assert.equal(api.searchSharePlayers('não existe').length,0);
 assert.equal(api.searchSharePlayers('LYON','Gamezking|LYON').length,0);
 assert.equal(api.playerSearchSelectedValue('Trap',api.searchSharePlayers('')),'Trap|LOUD');
});
test('campo de jogador e os dois campos da comparação têm pesquisa, sem seletor longo visível',()=>{
 for(const field of ['player','playerA','playerB']){
  assert(share.includes('data-share-player-search="'+field+'"'),field);
  assert(share.includes('data-share-field="'+field+'" class="cff-share-player-native" hidden'),field);
 }
 assert(share.includes('setupPlayerSearch(modal)'));
 assert(css.includes('input[type=search]'));
 assert(css.includes('max-height:268px'));
});
test('vitrine ocupa o espaço logo abaixo de Ir para, mesmo com reinserção dinâmica',()=>{
 const global=fs.readFileSync('ffws-global-2026/global.js','utf8');
 const nav='$'+'{s2StatsStickyNavHtml(events.length, playerEntries.length)}';
 const slot='id="cff-stats-share-gallery-slot"';
 const summary='$'+'{summaryBlock}';
 const index=global.indexOf(nav);
 assert(index>=0);
 assert(global.indexOf(slot,index)>index);
 assert(global.indexOf(slot,index)<global.indexOf(summary,index));
 assert(share.includes('if(slot)slot.replaceWith(gallery)'));
 assert(css.includes('.ffws-global-shell>.cff-share-gallery{order:-10}'));
});
