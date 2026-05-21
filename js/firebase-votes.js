import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js";
import {
  getDatabase,
  ref,
  onValue,
  off,
  set
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

const firebaseConfig = window.CFF_CONFIG.firebase;

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (error) { console.warn("Analytics não iniciado:", error); }
const database = getDatabase(app);

window.firebaseApp = app;

let currentDayVotesRef = null;

function safeFirebaseKey(value) {
  return String(value || "")
    .trim()
    .replace(/[\s.#$/\[\]]/g, "_")
    .slice(0, 100);
}

function getClientVoteId() {
  const storageKey = "cff_vote_client_id";
  let id = localStorage.getItem(storageKey);

  if (!id) {
    if (window.crypto && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = "vote_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12);
    }
    localStorage.setItem(storageKey, id);
  }

  return safeFirebaseKey(id);
}

const clientVoteId = getClientVoteId();

function getMercadoOriginalKeyFromSafeKey(safeKey) {
  const realNames = typeof mercadoData !== "undefined"
    ? mercadoData.map(d => d.jogador)
    : [];

  return realNames.find(name => safeFirebaseKey(name) === safeKey) || safeKey;
}

function countMercadoVotes(data) {
  const result = {};

  Object.entries(data || {}).forEach(([safeKey, users]) => {
    const originalKey = getMercadoOriginalKeyFromSafeKey(safeKey);

    result[originalKey] = {
      up: 0,
      down: 0,
      voted: null
    };

    Object.entries(users || {}).forEach(([uid, vote]) => {
      if (vote === "up") result[originalKey].up += 1;
      if (vote === "down") result[originalKey].down += 1;

      if (uid === clientVoteId) {
        result[originalKey].voted = vote;
      }
    });
  });

  return result;
}

function countDayVotes(data) {
  const counts = {};

  Object.values(data || {}).forEach((teamKey) => {
    if (!teamKey) return;
    counts[teamKey] = (counts[teamKey] || 0) + 1;
  });

  return counts;
}

// Curtidas / descurtidas do mercado — sem login, usa um ID salvo no navegador.
window.fbVote = async function(key, newDir, previousDir) {
  try {
    const safeKey = safeFirebaseKey(key);
    const voteRef = ref(database, `mercadoUserVotes/${safeKey}/${clientVoteId}`);

    // newDir pode ser "up", "down" ou null
    if (newDir === "up" || newDir === "down") {
      await set(voteRef, newDir);
    } else {
      await set(voteRef, null);
    }
  } catch (error) {
    console.error("Erro ao enviar voto do mercado no Firebase:", error);
  }
};

window.fbLoadVotes = async function() {
  const votesRef = ref(database, "mercadoUserVotes");

  onValue(votesRef, (snapshot) => {
    const data = snapshot.val() || {};
    const countedVotes = countMercadoVotes(data);

    Object.keys(mercadoVotes || {}).forEach((key) => {
      if (!countedVotes[key]) {
        countedVotes[key] = {
          up: 0,
          down: 0,
          voted: null
        };
      }
    });

    window.mercadoVotes = countedVotes;

    if (typeof mercadoVotes !== "undefined") {
      Object.keys(mercadoVotes).forEach(k => delete mercadoVotes[k]);
      Object.assign(mercadoVotes, countedVotes);
    }

    if (typeof renderMercado === "function") {
      renderMercado();
    }
  }, (error) => {
    console.error("Erro ao ler votos do mercado no Firebase:", error);
  });
};

// Votação do melhor time do dia — sem login, usa um ID salvo no navegador.
window.fbDayVote = async function(matchKey, newTeamKey, previousTeamKey) {
  try {
    const safeMatchKey = safeFirebaseKey(matchKey);
    const voteRef = ref(database, `dayUserVotes/${safeMatchKey}/${clientVoteId}`);

    if (newTeamKey) {
      await set(voteRef, String(newTeamKey).slice(0, 80));
    } else {
      await set(voteRef, null);
    }
  } catch (error) {
    console.error("Erro ao enviar voto do dia no Firebase:", error);
  }
};

window.fbLoadDayVotes = async function(matchKey) {
  if (!matchKey) return;

  const safeMatchKey = safeFirebaseKey(matchKey);

  if (currentDayVotesRef) {
    off(currentDayVotesRef);
  }

  currentDayVotesRef = ref(database, `dayUserVotes/${safeMatchKey}`);

  onValue(currentDayVotesRef, (snapshot) => {
    const data = snapshot.val() || {};
    const counts = countDayVotes(data);

    if (typeof window.applyDayVoteCounts === "function") {
      window.applyDayVoteCounts(matchKey, counts);
    }
  }, (error) => {
    console.error("Erro ao ler votos do dia no Firebase:", error);
  });
};

if (window.currentDayVoteMatchKey && typeof window.fbLoadDayVotes === "function") {
  window.fbLoadDayVotes(window.currentDayVoteMatchKey);
}

console.log("Firebase conectado: votos públicos sem login.");
