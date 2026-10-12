(()=>{'use strict';
const sections=['classificatoria','segunda-fase','final','mvp','equipes','datas','selecoes','stats','notas','comparar'];
const prefixes=['ffws-br-s2','ffws-global-2026'];
const pages=new Map(prefixes.flatMap(prefix=>sections.map(section=>[prefix+'-'+section,'/'+prefix+'/'+section])));
function pageFromPath(path=location.pathname){for(const prefix of prefixes){const match=String(path).match(new RegExp('^/'+prefix+'/([^/]+)(?:/index\\.html|/)?$'));if(match&&sections.includes(match[1]))return prefix+'-'+match[1];}return '';}
function pathForPage(page){return pages.get(page)||'';}
function pageFromLocation(){const hash=location.hash.replace(/^#/,'');return pages.has(hash)?hash:pageFromPath();}
window.CFF_SEASON_ROUTES={pageFromPath,pathForPage,pageFromLocation};
})();
