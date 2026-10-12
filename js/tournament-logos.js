/* The same official World Series logo is used for every global edition. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.cffResolveTournamentLogo=api.resolve})(typeof window==='object'?window:globalThis,()=>{
'use strict';
const GLOBAL_LOGO='/ffws-global-2026/Free_Fire_World_Series_2021_icon_allmode.png';
function isGlobal(event){const value=String(event||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();if(!/\b(?:FFWS|FREE FIRE WORLD SERIES|WORLD SERIES)\b/.test(value))return false;if(/\b(?:GLOBAL|WORLD FINALS|MUNDIAL|SINGAPORE|SENTOSA|BANGKOK)\b/.test(value))return true;if(/\b(?:BRASIL|BRAZIL|BR|SEA|LATAM|INDIA|MENA|NEPAL|PAKISTAN|PAQUISTAO|USA|BANGLADESH|AFRICA|EUROPE|AMERICAS|REGIONAL)\b/.test(value))return false;return /\b(?:FFWS|FREE FIRE WORLD SERIES|WORLD SERIES)\s+20\d{2}\b/.test(value)}
function resolve(event,current='trofeu.webp'){return isGlobal(event)?GLOBAL_LOGO:current}
return{GLOBAL_LOGO,isGlobal,resolve};
});
