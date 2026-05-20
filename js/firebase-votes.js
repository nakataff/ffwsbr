import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js";
import {
  getDatabase,
  ref,
  onValue,
  off,
  set
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const firebaseConfig = window.CFF_CONFIG.firebase;

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);
const auth = getAuth(app);

window.firebaseApp = app;

let currentUser = null;
let authReadyPromise = null;
let currentDayVotesRef = null;

function safeFirebaseKey(value) {
  return String(value || "")
    .trim()
    .replace(/[\s.#$/\[\]]/g, "_")
    .slice(0, 100);
}

function waitForAuth() {
  if (authReadyPromise) return authReadyPromise;

  authReadyPromise = new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        resolve(user);
        return;
      }

      try {
        const result = await signInAnonymously(auth);
        currentUser = result.user;
        resolve(result.user);
      } catch (error) {
        console.error("Erro ao autenticar anonimamente no Firebase:", error);
        resolve(null);
      }
    });
  });

  return authReadyPromise;
}

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

      if (currentUser && uid === currentUser.uid) {
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

// Curtidas / descurtidas do mercado
window.fbVote = async function(key, newDir, previousDir) {
  const user = await waitForAuth();

  if (!user) {
    console.warn("Usuário anônimo não autenticado. Voto não enviado.");
    return;
  }

  const safeKey = safeFirebaseKey(key);
  const voteRef = ref(database, `mercadoUserVotes/${safeKey}/${user.uid}`);

  // newDir pode ser "up", "down" ou null
  if (newDir === "up" || newDir === "down") {
    await set(voteRef, newDir);
  } else {
    await set(voteRef, null);
  }
};

window.fbLoadVotes = async function() {
  await waitForAuth();

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
  });
};

// Votação do melhor time do dia
window.fbDayVote = async function(matchKey, newTeamKey, previousTeamKey) {
  const user = await waitForAuth();

  if (!user) {
    console.warn("Usuário anônimo não autenticado. Voto do dia não enviado.");
    return;
  }

  const safeMatchKey = safeFirebaseKey(matchKey);
  const voteRef = ref(database, `dayUserVotes/${safeMatchKey}/${user.uid}`);

  if (newTeamKey) {
    await set(voteRef, String(newTeamKey).slice(0, 80));
  } else {
    await set(voteRef, null);
  }
};

window.fbLoadDayVotes = async function(matchKey) {
  if (!matchKey) return;

  await waitForAuth();

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
  });
};

waitForAuth().then(() => {
  if (window.currentDayVoteMatchKey && typeof window.fbLoadDayVotes === "function") {
    window.fbLoadDayVotes(window.currentDayVoteMatchKey);
  }

  console.log("Firebase conectado com votos seguros por usuário anônimo!");
});
