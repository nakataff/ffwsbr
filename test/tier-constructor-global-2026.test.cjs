'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const json=rel=>JSON.parse(read(rel));
test('Mundial 2026 no Tier Constructor usa as 24 equipes oficiais com logos locais válidas',()=>{
 const teams=json('ffws-global-2026/teams.json').teams;
 const groups=json('ffws-global-2026/groups.json').groups;
 const index=json('tier-constructor/assets-index.json');
 const preset=index.presets.find(p=>p.id==='ffws-global-2026');
 assert.ok(preset,'preset Mundial 2026 ausente');
 assert.equal(teams.length,24);
 assert.equal(preset.assetIds.length,24);
 assert.equal(new Set(preset.assetIds).size,24);
 const ids=Object.values(groups).flat();
 assert.equal(ids.length,24);
 assert.equal(new Set(ids).size,24);
 const byId=new Map(teams.map(team=>[team.id,team]));
 const byAsset=new Map(index.assets.map(asset=>[asset.id,asset]));
 assert.equal(byAsset.size,index.assets.length,'IDs de imagens devem ser únicos');
 for(const [group,groupIds] of Object.entries(groups)){
  assert.equal(groupIds.length,6);
  for(const id of groupIds){
   const team=byId.get(id),assetId='team:ffws-global-2026-'+id;
   assert.ok(team,'time do grupo não está no cadastro oficial: '+id);
   assert.ok(preset.assetIds.includes(assetId),assetId+' não está no preset');
   const asset=byAsset.get(assetId);
   assert.equal(asset?.type,'team');
   assert.equal(asset?.name,team.name);
   assert.equal(asset?.image,team.logo);
   assert.match(asset?.subtitle||'',new RegExp('Grupo '+group+'$'));
   assert.ok(fs.existsSync(path.join(root,team.logo)),'logo indisponível: '+team.logo);
  }
 }
 assert.equal(index.counts.teams,index.assets.filter(a=>a.type==='team').length);
 assert.equal(index.counts.players,index.assets.filter(a=>a.type==='player').length);
});
test('preset novo preserva projetos existentes e abre com tiers vazias',()=>{
 const index=json('tier-constructor/assets-index.json'),preset=index.presets.find(p=>p.id==='ffws-global-2026');
 for(const legacy of ['wb-2026-s1','wb-2026-s2','ewc-2026'])assert.ok(index.presets.some(p=>p.id===legacy));
 assert.deepEqual(preset.rows.map(r=>r.name),['S','A','B','C','D']);
 assert.ok(preset.rows.every(r=>!r.images),'não pré-classificar times');
 assert.match(preset.caption,/2026/);
 const html=read('tier-constructor.html'),js=read('js/tier-constructor.js');
 assert.match(html,/data-tier-preset="ffws-global-2026"/);
 assert.match(html,/tier-constructor\.js\?v=20261102-(?:world-2026|workspace|nameplates|text-scroll)-v1/);
 assert.match(js,/assets-index\.json\?v=20261102-world-2026-v1/);
 assert.match(js,/function loadTierPreset\(presetId/);
 assert.match(js,/assetIds \|\| \[\]/);
});
