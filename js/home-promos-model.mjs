export const PATH='homePromotions';
export const MAX_CARDS=8;
const whatsapp='https://api.whatsapp.com/send/?app_absent=0&phone=5521994480776&text=Oi%2C%20quero%20saber%20a%20tabela%20de%20pre%C3%A7os%20de%20divulga%C3%A7%C3%A3o%20no%20Instagram%20%40nakataff&type=phone_number';
export const DEFAULTS={revision:0,interval:6,cards:[
 {id:'instagram',kicker:'Divulgação no Instagram',title:'Divulgue no @nakataff',action:'Consultar valores',href:whatsapp,color:'#c7a3d6',tint:'#1c1729',image:'',enabled:true},
 {id:'support',kicker:'Apoio ao projeto',title:'Apoie a Central Free Fire',action:'Contribuir via LivePix',href:'https://livepix.gg/nakataff',color:'#9ad8c3',tint:'#132c29',image:'',enabled:true},
 {id:'space-blue',kicker:'Espaço disponível',title:'Divulgue aqui',action:'Anunciar meu projeto',href:whatsapp,color:'#94c4dd',tint:'#142430',image:'',enabled:true},
 {id:'space-gold',kicker:'Marcas e campeonatos',title:'Divulgue aqui',action:'Conhecer os espaços',href:whatsapp,color:'#d7c39a',tint:'#2b261b',image:'',enabled:true}
]};
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function url(value){try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
export function imageUrl(value){return /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(value)&&value.length<=180000?value:url(value);}
export function normalize(input){
 if(!input||!Array.isArray(input.cards)||input.cards.length<1||input.cards.length>MAX_CARDS)throw Error('Use de 1 a 8 cards.');
 const ids=new Set();
 const cards=input.cards.map(card=>{
  if(!/^[a-z0-9-]{1,40}$/.test(card.id)||ids.has(card.id))throw Error('Identificador de card inválido ou repetido.');ids.add(card.id);
  const out={id:card.id};
  for(const [key,max] of [['kicker',48],['title',60],['action',40]]){const text=String(card[key]??'').trim();if(!text||text.length>max)throw Error('Confira o texto do card (título até 60 caracteres).');out[key]=text;}
  out.href=url(card.href);if(out.href.length>1000)throw Error('O link deve ter até 1000 caracteres.');if(!out.href)throw Error('Informe um link HTTPS válido.');
  for(const key of ['color','tint']){if(!/^#[a-f0-9]{6}$/i.test(card[key]))throw Error('Escolha uma cor válida.');out[key]=card[key];}
  out.image=card.image?imageUrl(card.image):'';if(card.image&&!out.image)throw Error('Use uma imagem HTTPS ou envie um arquivo pelo painel.');
  if(typeof card.enabled!=='boolean')throw Error('Confira a visibilidade do card.');out.enabled=card.enabled;return out;
 });
 const interval=Number(input.interval);if(!Number.isInteger(interval)||interval<4||interval>30)throw Error('O intervalo deve ser entre 4 e 30 segundos.');
 return {revision:Number.isSafeInteger(input.revision)&&input.revision>=0?input.revision:0,interval,cards};
}
export function cardHtml(card){
 const support=card.id==='support';
 return `<a class="home-promo-card${support?' home-promo-support':''}${card.image?' has-art':''}" href="${esc(card.href)}" target="_blank" rel="noopener noreferrer" data-promo-label="${esc(card.title)}" aria-label="${esc(card.title+' — '+card.action)}" style="--promo-color:${card.color};--promo-tint:${card.tint}" ${support?'data-home-support-card data-support-link':''}>
 ${card.image?`<img class="home-promo-art" src="${esc(card.image)}" alt="${esc(card.title)}" width="1200" height="400" loading="lazy" decoding="async">`:`<small>${support?'<span class="home-support-icon" aria-hidden="true">♡</span>':''}${esc(card.kicker)}</small><h2>${esc(card.title)}</h2><span class="home-promo-action">${esc(card.action)}</span>`}</a>`;
}
export function renderCards(host,config){
 const enabled=config.cards.filter(card=>card.enabled);host.hidden=!enabled.length;
 host.dataset.interval=config.interval;
 host.querySelector('.home-promo-track').innerHTML=enabled.map(cardHtml).join('');
 host.dispatchEvent(new host.ownerDocument.defaultView.Event('cff:promos-updated'));
}
