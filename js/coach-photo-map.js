// Fotos leves e estáticas da comissão, sem consultas ao banco de dados.
(()=>{'use strict';
const files={butter:'butter',correia:'correia',frois:'frois',kimbruno:'kim_bruno',putsgrilo:'putsgrilo',vt:'vt',wf:'wf',wf9:'wf',abreu:'abreu',ninja:'ninja',pereira:'pereira',frank7:'frank7',frank:'frank7',jaya:'jaya',joker:'joker',jokercoach:'joker',queiroz:'queiroz',ribas:'ribas',lipao:'lipao',bryanking:'bryanking',bryan:'bryanking'};
const key=s=>String(s||'').normalize('NFD').toLowerCase().replace(/[^a-z0-9]/g,'');
window.cffCoachPhoto=(name,fallback='silhueta.webp')=>files[key(name)]?'/assets/coaches/'+files[key(name)]+'.webp':fallback;
})();
