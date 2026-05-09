import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js";
  import { getDatabase, ref, runTransaction, onValue, off } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

  const firebaseConfig = window.CFF_CONFIG.firebase;

  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
  const database = getDatabase(app);
  window.firebaseApp = app;

  // ✅ Define a função que voteMercado() chama
  window.fbVote = function(key, newDir, previousDir) {
    const safeKey = key.replace(/[\s.#$/\[\]]/g, '_');
    const votesRef = ref(database, `mercadoVotes/${safeKey}`);

    runTransaction(votesRef, (current) => {
      const data = current || { up: 0, down: 0 };

      // Remove voto anterior se existia
      if (previousDir === 'up')   data.up   = Math.max(0, (data.up   || 0) - 1);
      if (previousDir === 'down') data.down = Math.max(0, (data.down || 0) - 1);

      // Adiciona voto novo (null = toggle off, não adiciona nada)
      if (newDir === 'up')   data.up   = (data.up   || 0) + 1;
      if (newDir === 'down') data.down = (data.down || 0) + 1;

      return data;
    });
  };

  // ✅ Carrega votos do Firebase ao iniciar (substitui os do sessionStorage)
window.fbLoadVotes = function() {
    const votesRef = ref(database, 'mercadoVotes');
    
    // onValue em vez de onlyOnce para atualizar em tempo real se alguém votar!
    onValue(votesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const localVotes = JSON.parse(sessionStorage.getItem('mercadoVotes') || '{}');

      // Pega todos os nomes reais que vieram da sua planilha TSV
      const realNames = typeof mercadoData !== 'undefined' ? mercadoData.map(d => d.jogador) : [];

      Object.entries(data).forEach(([safeKey, counts]) => {
        // Acha o nome original comparando a versão "limpa" (safeKey) com os nomes reais da planilha
        const originalKey = realNames.find(name =>
          name.replace(/[\s.#$/\[\]]/g, '_') === safeKey
        ) || safeKey;

        // Pega o "voted" local para manter o botão colorido corretamente para quem votou
        const localVoted = localVotes[originalKey]?.voted || null;

        // Sobrescreve a variável global com os dados reais do Firebase
        mercadoVotes[originalKey] = {
          up: counts.up || 0,
          down: counts.down || 0,
          voted: localVoted 
        };
      });

      // Renderiza a tela novamente agora com os dados globais corretos
      if (typeof renderMercado === 'function') {
          renderMercado();
      }
    });
  };



  // ✅ Votação do dia na página inicial
  let currentDayVotesRef = null;

  window.fbDayVote = function(matchKey, newTeamKey, previousTeamKey) {
    const votesRef = ref(database, `dayVotes/${matchKey}/teams`);

    runTransaction(votesRef, (current) => {
      const data = current || {};

      if (previousTeamKey) {
        data[previousTeamKey] = Math.max(0, (data[previousTeamKey] || 0) - 1);
      }

      if (newTeamKey) {
        data[newTeamKey] = (data[newTeamKey] || 0) + 1;
      }

      return data;
    });
  };

  window.fbLoadDayVotes = function(matchKey) {
    if (!matchKey) return;

    if (currentDayVotesRef) {
      off(currentDayVotesRef);
    }

    currentDayVotesRef = ref(database, `dayVotes/${matchKey}/teams`);
    onValue(currentDayVotesRef, (snapshot) => {
      const counts = snapshot.val() || {};
      if (typeof window.applyDayVoteCounts === 'function') {
        window.applyDayVoteCounts(matchKey, counts);
      }
    });
  };

  if (window.currentDayVoteMatchKey && typeof window.fbLoadDayVotes === 'function') {
    window.fbLoadDayVotes(window.currentDayVoteMatchKey);
  }

  console.log("Firebase conectado com votos do mercado e votação do dia!");
