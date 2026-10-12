(() => {
  'use strict';
  const board = document.getElementById('home-global-classified');
  const rail = document.querySelector('.home-left-rail');
  const center = document.querySelector('.home-center-column');
  if (!board || !rail || !center) return;
  const mobile = window.matchMedia('(max-width: 900px)');
  const place = () => {
    if (mobile.matches) rail.insertBefore(board, rail.firstElementChild);
    else center.insertBefore(board, center.firstElementChild);
  };
  place();
  mobile.addEventListener('change', place);
})();
