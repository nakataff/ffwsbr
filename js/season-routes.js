(()=>{'use strict';
const sections=['classificatoria','segunda-fase','final','mvp','equipes','datas','selecoes','stats','notas','comparar'];
const pages=new Map(sections.map(section=>['ffws-br-s2-'+section,'/ffws-br-s2/'+section]));
function pageFromPath(path=location.pathname){const match=String(path).match(/^\/ffws-br-s2\/([^/]+)(?:\/index\.html|\/)?$/);return match&&sections.includes(match[1])?'ffws-br-s2-'+match[1]:'';}
function pathForPage(page){return pages.get(page)||'';}
function pageFromLocation(){const hash=location.hash.replace(/^#/,'');return pages.has(hash)?hash:pageFromPath();}
window.CFF_SEASON_ROUTES={pageFromPath,pathForPage,pageFromLocation};
})();