import {watchChatVisibility} from './chat-visibility.mjs?v=20261020-chat-layout-v1';

const launch = document.getElementById('home-chat-launch');
if (launch) {
  const stopWatching = watchChatVisibility(visible => { launch.hidden = !visible; });
  launch.addEventListener('click', async () => {
    launch.disabled = true;
    launch.textContent = 'Abrindo chat…';
    try {
      await import('./global-chat.js?v=20261108-system-unified-v5');
      const chatButton = document.querySelector('#cff-global-chat .cff-chat-launch');
      if (!chatButton) throw Error('Chat indisponível');
      stopWatching();
      launch.remove();
      chatButton.click();
    } catch {
      launch.disabled = false;
      launch.textContent = 'Tentar abrir o chat';
    }
  });
}
