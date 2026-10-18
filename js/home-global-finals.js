(() => {
  'use strict';
  const board = document.getElementById('home-global-classified');
  const rail = document.querySelector('.home-left-rail');
  const center = document.querySelector('.home-center-column');
  if (!board || !rail || !center) return;
  const mobile = window.matchMedia('(max-width: 900px)');
  const place = () => {
    const target = mobile.matches ? rail : center;
    const support = document.querySelector('#home .home-support');
    target.insertBefore(board, target.firstElementChild);
    if (support) target.insertBefore(support, board);
  };
  place();
  mobile.addEventListener('change', place);
  const countdown = board.querySelector('.home-global-countdown');
  if (!countdown) return;
  const start = Date.parse(countdown.dataset.start);
  if (!Number.isFinite(start)) return;
  const units = ['days', 'hours', 'minutes', 'seconds'];
  const numbers = units.map(unit => countdown.querySelector(`[data-countdown-unit="${unit}"]`));
  let timer;
  function tick() {
    if (document.hidden) return;
    const total = Math.max(0, Math.ceil((start - Date.now()) / 1000));
    const values = [Math.floor(total / 86400), Math.floor(total % 86400 / 3600), Math.floor(total % 3600 / 60), total % 60];
    numbers.forEach((node, i) => {const value=String(values[i]).padStart(2,'0');if(node && node.textContent!==value)node.textContent=value;});
    if (!total) {
      countdown.classList.add('has-started');
      countdown.querySelector('#home-global-countdown-label').textContent='CHEGOU A ESTREIA';
      clearInterval(timer);
    }
  }
  function resume() {clearInterval(timer);tick();if(!document.hidden && Date.now()<start)timer=setInterval(()=>{if(board.closest('.page')?.classList.contains('active'))tick();},1000);}
  document.addEventListener('visibilitychange',resume);
  window.addEventListener('hashchange',tick);
  window.addEventListener('cff:pretty-route',tick);
  resume();
})();
