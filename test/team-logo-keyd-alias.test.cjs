'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const base=path.resolve(__dirname,'..');
const map=JSON.parse(fs.readFileSync(path.join(base,'team-data/logo-map.json'),'utf8'));
const script=fs.readFileSync(path.join(base,'js/team-logo-resolver.min.js'),'utf8');

test('Keyd, Keyd Stars e Vivo Keyd usam o arquivo de escudo existente',async()=>{
  assert.ok(fs.existsSync(path.join(base,'keyd.webp')),'keyd.webp precisa existir');
  assert.equal(map.logos['VIVO KEYD'],'keyd.webp');
  for(const key of ['KEYD','KEYD STARS','VK','VIVO KEYD STARS']){assert.equal(map.logos[key],'keyd.webp');assert.equal(map.aliases[key],undefined,'não alterar os nomes das equipes históricas');}

  const handlers={};
  const window={
    cffCareerTeamIdentity:()=>({logo:'escudo.webp'}),
    cffFindLiveTeamLogo:()=> 'escudo.webp'
  };
  const context={
    window,
    document:{addEventListener:(type,listener)=>{handlers[type]=listener}},
    fetch:async(url)=>{assert.match(String(url),/team-data\/logo-map\.json\?v=/);return{ok:true,json:async()=>map}},
    Promise,
  };
  vm.runInNewContext(script,context,{filename:'js/team-logo-resolver.min.js'});
  await window.cffLoadTeamLogoMap();
  for(const name of ['Keyd','Keyd Stars','Vivo Keyd','VK','Vivo Keyd Stars']){
    assert.equal(window.cffFindTeamLogo(name),'keyd.webp',name);
    assert.equal(window.cffResolveTeamLogo(name,'escudo.webp'),'keyd.webp',name);
  }
  // Escudos específicos da era/organização continuam com precedência.
  window.cffCareerTeamIdentity=()=>({logo:'especial.webp'});
  assert.equal(window.cffResolveTeamLogo('Keyd Stars','escudo.webp'),'especial.webp');
  assert.equal(window.cffResolveTeamLogo('Keyd Stars','logo-manual.webp'),'especial.webp');

  let src='escudo.webp';
  const img={
    tagName:'IMG',
    dataset:{teamLogo:'Keyd Stars'},
    getAttribute:key=>key==='src'?src:null,
    set src(value){src=value}
  };
  handlers.error({target:img});
  assert.equal(src,'keyd.webp','o fallback de imagens deve tentar a logo cadastrada');
});

test('perfil do jogador invalida o cache do resolvedor de escudos',()=>{
  const page=fs.readFileSync(path.join(base,'jogador.html'),'utf8');
  assert.match(page,/team-logo-resolver\.min\.js\?v=20261102-keyd-aliases-v1/);
  assert.match(script,/20261102-keyd-aliases-v1/);
});
