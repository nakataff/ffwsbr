(()=>{
  'use strict';
  if(window.__CFF_LIVE_PREVIEW_REDIRECT__)return;
  window.__CFF_LIVE_PREVIEW_REDIRECT__=true;
  const PROD='ffwsLive/2026-s2';
  const baseFetch=window.fetch.bind(window);
  const preview=()=>{try{const q=new URLSearchParams(location.search);return q.get('cffLiveTest')==='1'||q.get('liveTest')==='1'||localStorage.getItem('cff_ffws_live_preview')==='test'}catch(_){return false}};
  window.fetch=(...args)=>{
    if(!preview())return baseFetch(...args);
    const input=args[0],url=typeof input==='string'?input:(input&&input.url)||'';
    const db=String(window.CFF_CONFIG?.firebase?.databaseURL||'').replace(/\/$/,'');
    const prod=`${db}/${PROD}.json`;
    if(db&&(url===prod||url.startsWith(prod+'?'))){
      return Promise.resolve(new Response('null',{status:200,headers:{'content-type':'application/json; charset=utf-8','x-cff-live-preview':'isolated'}}));
    }
    return baseFetch(...args);
  };
})();
