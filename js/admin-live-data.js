import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { getDatabase, ref, get, update, remove, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';

const ADMIN_EMAIL = 'admin@centralfreefire.com.br';
const ROOT = 'ffwsLive/2026-s2';
const config = window.CFF_CONFIG && window.CFF_CONFIG.firebase;
if (!config) throw new Error('Configuração do Firebase não encontrada.');

const app = getApps().length ? getApp() : initializeApp(config);
const auth = getAuth(app);
const database = getDatabase(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

const $ = (selector) => document.querySelector(selector);
const el = {
  login: $('#live-login'), dashboard: $('#live-dashboard'), password: $('#live-password'), loginBtn: $('#live-login-btn'), loginMsg: $('#live-login-message'), logout: $('#live-logout'),
  stage: $('#live-stage'), day: $('#live-day'), drop: $('#live-drop'), next: $('#live-next'), map: $('#live-map'), customMapWrap: $('#live-custom-map-wrap'), customMap: $('#live-custom-map'),
  teamsFile: $('#live-teams-file'), playersFile: $('#live-players-file'), teamsStatus: $('#live-teams-status'), playersStatus: $('#live-players-status'),
  validate: $('#live-validate'), publish: $('#live-publish'), message: $('#live-message'), preview: $('#live-preview'), refresh: $('#live-refresh'), count: $('#live-count'), updated: $('#live-updated'), list: $('#live-drop-list'), stageHelp: $('#live-stage-help')
};

const SECOND_PHASE_BONUS = Object.freeze({
  'LOS': 50, 'LOUD SNICKERS': 42, 'FLUXO W7M': 35, 'INTZ': 29, 'TEAM SOLID': 24, 'RISE GAMING': 19,
  'ALPHA7': 15, 'RUSH GAMING': 11, 'INFLUENCE RAGE': 8, 'CPT VOX': 5, 'AFROGAMES': 2, 'SX TET': 0
});
const STAGES = Object.freeze({
  segundaFase: { label: 'Segunda Fase', days: 6, dropsByDay: {1:6,2:6,3:6,4:6,5:6,6:6} },
  final: { label: 'Final', days: 2, dropsByDay: {1:6,2:10}, championPoint: 160 }
});

let stageData = {};
let teamText = '';
let playerText = '';
let teamFileName = '';
let playerFileName = '';
let rosterNames = new Set();

function norm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}
function clean(value) { return String(value == null ? '' : value).replace(/^\uFEFF/, '').trim(); }
function numberValue(value) {
  const raw = clean(value).replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const num = Number(raw.replace(/[^\d.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
}
function canonicalTeam(value) {
  const key = norm(value);
  const aliases = {
    LOS:'LOS', LOUD:'LOUD SNICKERS', LOUDSNICKERS:'LOUD SNICKERS', FX:'FLUXO W7M', FLUXO:'FLUXO W7M', FLUXOW7M:'FLUXO W7M', W7M:'FLUXO W7M',
    INTZ:'INTZ', TS:'TEAM SOLID', TEAMSOLID:'TEAM SOLID', SOLID:'TEAM SOLID', RISE:'RISE GAMING', RISEGAMING:'RISE GAMING', A7:'ALPHA7', ALPHA7:'ALPHA7',
    RSHM:'RUSH GAMING', RUSH:'RUSH GAMING', RUSHGAMING:'RUSH GAMING', INF:'INFLUENCE RAGE', IR:'INFLUENCE RAGE', INFLUENCERAGE:'INFLUENCE RAGE',
    CPT:'CPT VOX', CPTVOX:'CPT VOX', AFG:'AFROGAMES', AFRO:'AFROGAMES', AFROGAMES:'AFROGAMES', SXT:'SX TET', SXTET:'SX TET'
  };
  return aliases[key] || clean(value).toUpperCase();
}
function splitDelimitedLine(line, delimiter) {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) { out.push(current); current = ''; }
    else current += ch;
  }
  out.push(current);
  return out.map(clean);
}
function parseRows(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').filter(line => line.trim());
  if (!lines.length) return [];
  const sample = lines.slice(0, 4).join('\n');
  const tabs = (sample.match(/\t/g) || []).length;
  const semis = (sample.match(/;/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  const delimiter = tabs >= semis && tabs >= commas ? '\t' : (semis >= commas ? ';' : ',');
  return lines.map(line => splitDelimitedLine(line, delimiter));
}
function parseTeams(text) {
  const rows = parseRows(text);
  const parsed = [];
  for (const cols of rows) {
    if (!cols.length) continue;
    const team = canonicalTeam(cols[0]);
    if (!team || /EQUIPE|TEAM/.test(norm(cols[0]))) continue;
    const points = numberValue(cols[1]);
    const booyah = numberValue(cols[2]);
    const kills = numberValue(cols[3]);
    let position = Math.trunc(numberValue(cols[6]));
    if (!(position >= 1 && position <= 12)) {
      const candidates = [cols[4], cols[5], cols[7], cols[8]];
      position = candidates.map(numberValue).map(Math.trunc).find(v => v >= 1 && v <= 12) || 0;
    }
    parsed.push({ team, points, booyah: booyah > 0 ? 1 : 0, kills, position, placementPoints: Math.max(0, points - kills) });
  }
  const unique = new Map(parsed.map(row => [norm(row.team), row]));
  return [...unique.values()];
}
function parsePlayers(text) {
  const rows = parseRows(text);
  const parsed = [];
  for (const cols of rows) {
    const name = clean(cols[0]);
    if (!name || /JOGADOR|PLAYER/.test(norm(name))) continue;
    const team = canonicalTeam(cols[1]);
    if (!team) continue;
    parsed.push({
      name,
      team,
      kills: numberValue(cols[2]),
      assists: numberValue(cols[3]),
      damage: numberValue(cols[4]),
      survival: numberValue(cols[5]),
      revives: numberValue(cols[6]),
      mvp: numberValue(cols[10])
    });
  }
  return parsed;
}
function stageConfig() { return STAGES[el.stage.value] || STAGES.segundaFase; }
function stagePath() { return `${ROOT}/${el.stage.value}`; }
function currentMap() { return el.map.value === 'Outro' ? clean(el.customMap.value) : clean(el.map.value); }
function setMessage(text, type = '') {
  el.message.textContent = text || '';
  el.message.className = `live-message${type ? ' ' + type : ''}`;
}
function setLoginMessage(text, type = '') {
  el.loginMsg.textContent = text || '';
  el.loginMsg.className = `live-message${type ? ' ' + type : ''}`;
}
function formatTime(value) {
  const n = Number(value || 0);
  if (!n) return '—';
  try { return new Date(n).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); }
  catch (_) { return '—'; }
}
function objectValues(value) { return Array.isArray(value) ? value.filter(Boolean) : Object.values(value || {}).filter(Boolean); }
function flattenDrops(data = stageData) {
  const drops = [];
  const days = data && data.drops || {};
  Object.keys(days).sort((a,b)=>Number(a)-Number(b)).forEach(day => {
    const dayDrops = days[day] || {};
    Object.keys(dayDrops).sort((a,b)=>Number(a)-Number(b)).forEach(drop => {
      const item = dayDrops[drop];
      if (item) drops.push({ ...item, day:Number(item.day || day), drop:Number(item.drop || drop) });
    });
  });
  return drops;
}
function nextDrop(data = stageData) {
  const cfg = stageConfig();
  const existing = new Set(flattenDrops(data).map(item => `${item.day}:${item.drop}`));
  for (let day = 1; day <= cfg.days; day++) {
    const max = Number(cfg.dropsByDay[day] || 0);
    for (let drop = 1; drop <= max; drop++) if (!existing.has(`${day}:${drop}`)) return { day, drop };
  }
  return null;
}
function applyNextDrop(force = false) {
  const next = nextDrop();
  if (next) {
    el.next.value = `Dia ${next.day} • Queda ${next.drop}`;
    if (force || !el.day.value || !el.drop.value) { el.day.value = next.day; el.drop.value = next.drop; }
  } else el.next.value = 'Etapa completa';
}
function renderStatus() {
  const drops = flattenDrops();
  el.count.textContent = String(drops.length);
  el.updated.textContent = formatTime(stageData && stageData.updatedAt);
  const cfg = stageConfig();
  el.stageHelp.textContent = el.stage.value === 'final'
    ? 'Final: Dia 1 com 6 quedas e Dia 2 com até 10. Champion Rush em 160 pontos.'
    : 'Segunda Fase: 6 dias × 6 quedas. O bônus inicial da Classificatória é preservado automaticamente.';
  if (!drops.length) el.list.innerHTML = '<div class="live-note">Nenhuma queda salva ainda.</div>';
  else el.list.innerHTML = drops.slice().reverse().map(item => `<div class="live-drop"><div><strong>Dia ${item.day} • Q${item.drop}</strong><small> • ${escapeHtml(item.map || 'Sem mapa')}</small></div><div class="live-actions" style="margin:0"><button class="live-btn ghost" style="padding:6px 8px" data-edit-drop="${item.day}:${item.drop}" type="button">Editar</button><button class="live-btn danger" style="padding:6px 8px" data-delete-drop="${item.day}:${item.drop}" type="button">Excluir</button></div></div>`).join('');
  applyNextDrop(true);
}
function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
async function loadStage() {
  setMessage('Carregando dados da etapa…');
  try {
    const snap = await get(ref(database, stagePath()));
    stageData = snap.val() || {};
    renderStatus();
    setMessage('Dados carregados.', 'ok');
  } catch (error) {
    console.error(error);
    stageData = {};
    renderStatus();
    setMessage('Não foi possível ler a base ao vivo. Se esta é a primeira vez, publique as novas regras do Firebase.', 'error');
  }
}
async function loadRoster() {
  try {
    const response = await fetch(`ffws-br-2026-s2/teams.json?v=${Date.now()}`, { cache:'no-store' });
    const json = await response.json();
    rosterNames = new Set((json.teams || []).flatMap(team => team.players || []).map(norm));
  } catch (_) { rosterNames = new Set(); }
}
async function readFile(input, kind) {
  const file = input.files && input.files[0];
  if (!file) return;
  const text = await file.text();
  if (kind === 'teams') { teamText = text; teamFileName = file.name; el.teamsStatus.textContent = `${file.name} carregado`; el.teamsStatus.className = 'live-file-ok'; }
  else { playerText = text; playerFileName = file.name; el.playersStatus.textContent = `${file.name} carregado`; el.playersStatus.className = 'live-file-ok'; }
}
function validatePayload() {
  const cfg = stageConfig();
  const day = Math.trunc(Number(el.day.value || 0));
  const drop = Math.trunc(Number(el.drop.value || 0));
  const maxDrops = Number(cfg.dropsByDay[day] || 0);
  const map = currentMap();
  if (!(day >= 1 && day <= cfg.days)) throw new Error(`Dia inválido para ${cfg.label}.`);
  if (!(drop >= 1 && drop <= maxDrops)) throw new Error(`Queda inválida. O Dia ${day} aceita até ${maxDrops} quedas.`);
  if (!map) throw new Error('Selecione o mapa desta queda.');
  if (!teamText || !playerText) throw new Error('Envie os dois arquivos: T1 e P1.');

  const teams = parseTeams(teamText);
  const players = parsePlayers(playerText);
  if (teams.length !== 12) throw new Error(`O T1 retornou ${teams.length} equipes. Para esta etapa são esperadas 12.`);
  if (!players.length) throw new Error('Nenhum jogador foi reconhecido no P1.');
  const positions = teams.map(row => row.position).filter(v => v >= 1 && v <= 12);
  if (new Set(positions).size !== 12) throw new Error('Não consegui identificar as posições 1º a 12º no T1. Confira se a coluna de posição/Média Posição está presente.');

  const allowed = new Set(Object.keys(SECOND_PHASE_BONUS).map(norm));
  const unexpected = teams.filter(row => !allowed.has(norm(row.team))).map(row => row.team);
  if (unexpected.length) throw new Error(`Equipe não reconhecida nesta WB: ${unexpected.join(', ')}.`);

  const teamKills = new Map(teams.map(row => [norm(row.team), Number(row.kills || 0)]));
  const playerKills = new Map();
  players.forEach(row => playerKills.set(norm(row.team), (playerKills.get(norm(row.team)) || 0) + Number(row.kills || 0)));
  const mismatches = teams.filter(row => (teamKills.get(norm(row.team)) || 0) !== (playerKills.get(norm(row.team)) || 0))
    .map(row => `${row.team}: T=${teamKills.get(norm(row.team)) || 0} / P=${playerKills.get(norm(row.team)) || 0}`);
  if (mismatches.length) throw new Error(`Abates do T1 e P1 não batem: ${mismatches.join(' • ')}`);

  const unknownPlayers = rosterNames.size ? players.filter(row => !rosterNames.has(norm(row.name))).map(row => row.name) : [];
  const payload = {
    stage: el.stage.value,
    day,
    drop,
    map,
    teams: teams.sort((a,b) => a.position - b.position),
    players,
    source: { teams: teamFileName || 'T1', players: playerFileName || 'P1' },
    updatedAt: Date.now()
  };
  return { payload, unknownPlayers };
}
function showValidation(result) {
  const { payload, unknownPlayers } = result;
  const totalKills = payload.teams.reduce((sum,row)=>sum+Number(row.kills||0),0);
  const totalDamage = payload.players.reduce((sum,row)=>sum+Number(row.damage||0),0);
  el.preview.textContent = [
    `OK • ${stageConfig().label} • Dia ${payload.day} • Queda ${payload.drop} • ${payload.map}`,
    `${payload.teams.length} equipes • ${payload.players.length} jogadores • ${totalKills} abates • ${Math.round(totalDamage).toLocaleString('pt-BR')} dano`,
    unknownPlayers.length ? `ATENÇÃO: jogadores fora do roster atual: ${unknownPlayers.join(', ')}` : 'Roster: todos os jogadores reconhecidos.',
    '',
    ...payload.teams.map(row => `${String(row.position).padStart(2,'0')}º ${row.team.padEnd(16)} ${String(row.points).padStart(3)} pts • ${String(row.kills).padStart(2)} K`)
  ].join('\n');
  el.preview.classList.remove('live-hidden');
  setMessage('T1 + P1 validados. Pode publicar.', 'ok');
}
async function publish() {
  let result;
  try { result = validatePayload(); showValidation(result); }
  catch (error) { setMessage(error.message || String(error), 'error'); return; }
  const { payload } = result;
  const keyRef = ref(database, `${stagePath()}/drops/${payload.day}/${payload.drop}`);
  try {
    const current = await get(keyRef);
    if (current.exists() && !confirm(`Dia ${payload.day} • Queda ${payload.drop} já existe. Substituir esta queda?`)) return;
    el.publish.disabled = true;
    setMessage('Publicando queda no Firebase…');
    const updates = {};
    updates[`${stagePath()}/drops/${payload.day}/${payload.drop}`] = payload;
    updates[`${stagePath()}/updatedAt`] = serverTimestamp();
    updates[`${stagePath()}/formatVersion`] = 1;
    updates[`${stagePath()}/label`] = stageConfig().label;
    if (el.stage.value === 'segundaFase') updates[`${stagePath()}/bonus`] = SECOND_PHASE_BONUS;
    if (el.stage.value === 'final') updates[`${stagePath()}/championPoint`] = 160;
    await update(ref(database), updates);
    setMessage(`Publicado: Dia ${payload.day} • Queda ${payload.drop} • ${payload.map}. O site já pode consumir esta queda.`, 'ok');
    teamText = ''; playerText = ''; teamFileName = ''; playerFileName = '';
    el.teamsFile.value = ''; el.playersFile.value = '';
    el.teamsStatus.textContent = 'Nenhum arquivo selecionado'; el.teamsStatus.className = '';
    el.playersStatus.textContent = 'Nenhum arquivo selecionado'; el.playersStatus.className = '';
    el.preview.classList.add('live-hidden');
    await loadStage();
  } catch (error) {
    console.error(error);
    setMessage('Falha ao publicar. Confira se as regras ffwsLive do Firebase já foram implantadas.', 'error');
  } finally { el.publish.disabled = false; }
}

el.loginBtn.addEventListener('click', async () => {
  const password = el.password.value;
  if (!password) return setLoginMessage('Digite a senha.', 'error');
  el.loginBtn.disabled = true;
  try { await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password); el.password.value = ''; }
  catch (_) { setLoginMessage('Senha inválida ou acesso indisponível.', 'error'); }
  finally { el.loginBtn.disabled = false; }
});
el.password.addEventListener('keydown', event => { if (event.key === 'Enter') el.loginBtn.click(); });
el.logout.addEventListener('click', () => signOut(auth));
el.stage.addEventListener('change', () => { el.day.value = 1; el.drop.value = 1; loadStage(); });
el.map.addEventListener('change', () => el.customMapWrap.classList.toggle('live-hidden', el.map.value !== 'Outro'));
el.teamsFile.addEventListener('change', () => readFile(el.teamsFile, 'teams'));
el.playersFile.addEventListener('change', () => readFile(el.playersFile, 'players'));
el.validate.addEventListener('click', () => { try { showValidation(validatePayload()); } catch (error) { setMessage(error.message || String(error), 'error'); } });
el.publish.addEventListener('click', publish);
el.refresh.addEventListener('click', loadStage);
el.list.addEventListener('click', async event => {
  const edit = event.target.closest('[data-edit-drop]');
  const del = event.target.closest('[data-delete-drop]');
  const token = (edit && edit.dataset.editDrop) || (del && del.dataset.deleteDrop);
  if (!token) return;
  const [day, drop] = token.split(':').map(Number);
  if (edit) {
    const item = stageData?.drops?.[day]?.[drop] || stageData?.drops?.[String(day)]?.[String(drop)];
    el.day.value = day; el.drop.value = drop;
    const known = ['Bermuda','Kalahari','Purgatório','Nova Terra','Solara'];
    if (item && known.includes(item.map)) { el.map.value = item.map; el.customMapWrap.classList.add('live-hidden'); }
    else if (item && item.map) { el.map.value = 'Outro'; el.customMap.value = item.map; el.customMapWrap.classList.remove('live-hidden'); }
    setMessage(`Editando Dia ${day} • Queda ${drop}. Envie T1 e P1 corrigidos e publique para substituir.`, 'ok');
  }
  if (del) {
    if (!confirm(`Excluir Dia ${day} • Queda ${drop}? Todas as páginas deixarão de contar esta queda.`)) return;
    try { await remove(ref(database, `${stagePath()}/drops/${day}/${drop}`)); await update(ref(database, stagePath()), { updatedAt: serverTimestamp() }); await loadStage(); setMessage(`Dia ${day} • Queda ${drop} excluída.`, 'ok'); }
    catch (error) { console.error(error); setMessage('Não foi possível excluir a queda.', 'error'); }
  }
});

onAuthStateChanged(auth, async user => {
  const allowed = Boolean(user && String(user.email || '').toLowerCase() === ADMIN_EMAIL);
  el.login.classList.toggle('live-hidden', allowed);
  el.dashboard.classList.toggle('live-hidden', !allowed);
  el.logout.hidden = !allowed;
  if (allowed) { setLoginMessage(''); await Promise.all([loadRoster(), loadStage()]); }
});
