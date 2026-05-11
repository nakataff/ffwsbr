// ===============================>===========
// BANCO DE DADOS E LOGOS

// --- CONFIGURAÇÕES DE JOGADORES ---

// --- COMISSÃO TÉCNICA ---
let dbStaff = [];

let dbPassagens = [];
let playerAliases = {};
let playerAliasLookup = {};
let rookiePlayers = new Set();

// 1. Configuração estendida para 10 semanas (2 dias cada)
const wbWeeks = {
    "1": [1, 2],
    "2": [3, 4],
    "3": [5, 6],
    "4": [7, 8],
    "5": [9, 10],
    "6": [11, 12],
    "7": [13, 14],
    "8": [15, 16],
    "9": [17, 18],
    "10": [19, 20]
};

let currentSelectionWeek = "5"; // será sobrescrito automaticamente após carregar os dados

// Mapeamento de Instagram (Exemplo: adicione o @ de cada um aqui)
let dbSocials = {};

let staffPhotos = {
    "LUUUKING": "luuuking.webp",
   /* "Renan_Staff": "renan.webp",
    "PUTSGRILO": "putsgrilo.webp",
    "Jhan": "jhan.webp",
    "Ninja": "ninja.webp",
    "WF9": "wf9.webp",
    "PEDRO": "pedro.webp",
    "JOKER": "joker.webp",
    "VIANA": "viana.webp",
    "Queiroz": "queiroz.webp",
    "FRANK": "frank.webp",
    "Ribas": "ribas.webp",
    "C9": "c9.webp",
    "LIPÃO": "lipao.webp",
    "Jaya": "jaya.webp",
    "Pereira": "pereira.webp",
    "Allan": "allan.webp",
    "Butter": "butter.webp",
    "TH": "th.webp",
    "CORREIA": "correia.webp",
    "VT": "vt.webp",
    "Bryan": "bryan.webp",
    "Abreu": "abreu.webp",
    "King9": "king9.webp",
    "Frois": "frois.webp",
    "K9": "k9.webp",
    "CL7": "cl7.webp",
    "LZZ": "lzz.webp",
    "DOODLES": "doodles.webp"*/
};

let titlesData = {
    coletivos: [],
    individuais: []
};

const playerCaptains = {
    "Bops": true,
    "General!": true,
    "TRAP": true,
    "LYON": true,
    "Cauan7": true,
    "GUS": true,
    "Stark": true,
    "lippe!": true,
    "BLACK02": true,
};

const playerRoles = {
    "Bops": "GRAN", "Giuh": "RUSH", "BuTziN": "RUSH", "MT7": "SUP", "Proxx7": "RUSH",
    "Pitbull": "RUSH", "PETER": "RUSH", "vitinxp": "GRAN", "Motovea": "SUP", "BYTE333": "RUSH",
    "Pão7": "SUP", "Cauã9": "GRAN", "Juca10xL": "RUSH", "Lyon": "RUSH",
    "lippe!": "GRAN", "itzking1": "RUSH", "Razure": "RUSH", "IGOR7": "SUP", "SASKITO": "RUSH",
    "HAK": "RUSH", "NICKZ": "RUSH", "TRAP": "GRAN", "GUAXA": "SUP", "BZP": "RUSH",
    "Sam7": "GRAN", "JNmvp7": "RUSH", "Brisa7": "RUSH", "NEYawp": "SUP", "MitoMvp": "RUSH",
    "BLACK02": "RUSH", "LC777": "SUP", "GUIMERLQ": "RUSH", "PROZIN": "GRAN", "MitinX": "RUSH",
    "Rigby245": "RUSH", "General!": "RUSH", "Raone7": "GRAN", "Yago": "SUP", "mtsexy.": "RUSH",
    "João7": "RUSH", "kauãxp": "RUSH", "GUS": "GRAN", "honeyzL": "SUP", "WHISKY": "SUP",
    "Bahiaz7": "RUSH", "BIELGOD": "RUSH", "Rojão": "GRAN", "ZETSU9": "SUP",
    "Yann7awp": "SUP", "SOARES": "GRAN", "Redxzzz": "RUSH", "Theus": "RUSH", "wLiu": "RUSH",
    "Luan7": "RUSH", "Ericking": "SUP", "Stark": "GRAN", "Draxx7": "RUSH",
    "ITAL0$$": "RUSH", "IguiNmvp": "RUSH", "Naandox": "GRAN", "KaKaZk": "SUP", "Erick11": "RUSH",
    "Lost21": "RUSH", "Cauan7": "GRAN", "Nikeboy": "SUP", "Mala": "RUSH", "Shotzzrx": "RUSH",
    "Keven7!": "RUSH", "WillProdigy": "RUSH", "Destroi7": "GRAN", "YOKO7": "SUP", "Master77": "RUSH", "LucasAWP": "SUP",
    "DRADE.11": "GRAN", "SEU PAI": "RUSH", "WM": "SUP", "nepoIGN": "RUSH"
};

let playerPhotos = {
    "MT7": "mt7.webp","Bops": "bops.webp", "Giuh": "giuh.webp", "BuTziN": "but.webp", "Proxx7": "proxx7.webp",
    "Pitbull": "pitbull.webp", "PETER": "peter.webp", "vitinxp": "vitinxp.webp", "Motovea": "motovea7.webp", "BYTE333": "byte.webp",
    "Pão7": "pao.webp", "Cauã9": "caua.webp", "Juca10xL": "juca.webp", "Lyon": "lyon.webp",
    "lippe!": "lippe.webp", "itzking1": "itzking.webp", "Razure": "razure.webp", "IGOR7": "igor7.webp",
    "HAK": "hak.webp", "NICKZ": "nickz7.webp", "TRAP": "trap.png", "GUAXA": "guaxa.webp", "BZP": "bzp.webp",
    "Sam7": "sam7.webp", "JNmvp7": "jnmvp.webp", "Brisa7": "brisa7.webp", "NEYawp": "neyawp.webp", "MitoMvp": "mitomvp.webp",
    "BLACK02": "black02.webp", "LC777": "lc.webp", "GUIMERLQ": "guime.webp", "PROZIN": "prozin.webp", "MitinX": "mitin.webp",
    "Rigby245": "rigby.webp", "General!": "general.webp", "Raone7": "raone7.webp", "Yago": "yago.webp", "mtsexy.": "mtsexy.webp",
    "João7": "joao.webp", "kauãxp": "xp.webp", "GUS": "gus.webp", "honeyzL": "honey.webp", "WHISKY": "whisky.webp",
    "Bahiaz7": "bahia.webp", "BIELGOD": "bielgod.webp", "Rojão": "silhueta.png", "ZETSU9": "zetsu.webp", "Mts007": "mts007.webp",
    "Yann7awp": "yan7.webp", "SOARES": "soares.webp", "Redxzzz": "redxz.webp", "Theus": "theus.webp", "wLiu": "wliu.webp",
    "Luan7": "luan.webp", "Ericking": "eric.webp", "Stark": "stark.webp", "Draxx7": "drax.webp",
    "ITAL0$$": "italo.webp", "IguiNmvp": "iguin.webp", "Naandox": "nandox.webp", "KaKaZk": "kakazk.webp", "Erick11": "erick11.webp",
    "Lost21": "lost21.webp", "Cauan7": "cauan7.webp", "Nikeboy": "nikeboy.webp", "Mala": "mala.webp", "Shotzzrx": "shotzzrx.webp",
    "Keven7!": "keven.webp", "WillProdigy": "will.webp", "Destroi7": "destroi.webp", "YOKO7": "yoko.webp", "Master77": "master.webp",
    "DRADE.11": "drade.webp", "SEU PAI": "seu pai.webp", "WM": "wm.webp", "nepoIGN": "nepo.webp"
};

// --- NOVOS CAMPEONATOS (Distribuição Automática) ---
// dbCampeonatos é agora carregado dinamicamente via Google Sheets (função loadCampeonatos)

// LOGOS DE LIGAS/TORNEIOS — carregados do Google Sheets
// Chave: nome do torneio (ou parte dele) | Valor: URL da imagem
let leagueLogos = {};

// A variável começa vazia e é preenchida depois
let dbCampeonatos = [];

// CARREGAR CAMPEONATOS VIA GOOGLE SHEETS
// Formato da aba na planilha:
//   Coluna A: Tier       (ex: D-Tier)
//   Coluna B: Data       (ex: 2026-04-23)
//   Coluna C: Torneio    (ex: Liga Marinho Season 4)
//   Coluna D: Equipe     (ex: TEAM SOLID)
//   Coluna E: Posição    (ex: 1st)
// As linhas de um mesmo torneio devem ter o mesmo Tier, Data e Torneio.
// A Posição deve estar em ordem crescente (1st, 2nd, 3rd...).
// Linha 1 = cabeçalho (ignorado). A 1ª linha de dados começa na linha 2.

// CARREGAR CAMPEONATOS VIA GOOGLE SHEETS
async function loadPassagens() {
    // ⚠️ SUBSTITUA PELO SEU LINK TSV DO GOOGLE SHEETS (Aba de Passagens)
    const PASSAGENS_TSV_URL = window.CFF_CONFIG.sheets.passagens;

    try {
        const res = await fetch(`${PASSAGENS_TSV_URL}&nocache=${new Date().getTime()}`);
        const tsvText = await res.text();
        const lines = tsvText.split('\n');

        const tempMap = {};

        // Pula o cabeçalho e processa linha por linha
        lines.slice(1).forEach(line => {
            const data = line.split('\t');
            const jogador = data[0]?.trim().replace(/\r/g, "");
            const equipe = data[1]?.trim().replace(/\r/g, "");
            const cargo = data[2]?.trim().replace(/\r/g, "");

            if (jogador && equipe) {
                if (!tempMap[jogador]) {
                    tempMap[jogador] = { jogador: jogador, passagens: [] };
                }
                tempMap[jogador].passagens.push({ equipe, cargo });
            }
        });

        // Converte o mapa de volta para o formato de Array que o site espera
        dbPassagens = Object.values(tempMap);
        console.log("Histórico de passagens carregado com sucesso!");

    } catch (e) {
        console.error('[loadPassagens] Erro:', e);
    }
}

async function loadStaff() {
    // COLE AQUI O LINK TSV DA SUA ABA DE STAFF (Cuidado para manter o formato tsv)
    const STAFF_TSV_URL = window.CFF_CONFIG.sheets.staff;

    try {
        const res = await fetch(`${STAFF_TSV_URL}&nocache=${new Date().getTime()}`);
        const tsvText = await res.text();
        const lines = tsvText.split('\n');

        // Pula o cabeçalho e mapeia as linhas para o formato do objeto
        dbStaff = lines.slice(1).map(line => {
            const data = line.split('\t');
            return {
                nome: data[0]?.trim().replace(/\r/g, ""),
                equipe: data[1]?.trim().replace(/\r/g, ""),
                cargo: data[2]?.trim().replace(/\r/g, "")
            };
        }).filter(s => s.nome && s.equipe); // Filtra linhas vazias

        console.log("Comissão técnica (Staff) carregada com sucesso!");

    } catch (e) {
        console.error('[loadStaff] Erro ao carregar staff:', e);
    }
}

async function loadTitles() {
    const TSV_URL_COLETIVOS = window.CFF_CONFIG.sheets.recordesColetivos;
    const TSV_URL_INDIVIDUAIS = window.CFF_CONFIG.sheets.recordesIndividuais;

    try {
        // 1. CARREGA OS TÍTULOS COLETIVOS
        const resCol = await fetch(`${TSV_URL_COLETIVOS}&nocache=${new Date().getTime()}`);
        const textCol = await resCol.text();
        const linesCol = textCol.split('\n');

        let rawColetivos = linesCol.slice(1).map(line => {
            const cols = line.split('\t');
            return {
                event: cols[0]?.trim().replace(/\r/g, "") || "",
                type: cols[1]?.trim().replace(/\r/g, "") || "",
                team: cols[2]?.trim().replace(/\r/g, "") || "",
                players: cols[3] ? cols[3].split(',').map(p => p.trim()) : [],
                staff: cols[4] ? cols[4].split(',').map(s => s.trim()) : []
            };
        }).filter(t => t.event !== "");

        // FILTRO MÁGICO: Remove linhas duplicadas da planilha automaticamente
        let vistosCol = new Set();
        titlesData.coletivos = rawColetivos.filter(t => {
            let chave = `${t.event}-${t.type}-${t.team}`.toLowerCase();
            if (vistosCol.has(chave)) return false;
            vistosCol.add(chave);
            return true;
        });

        // 2. CARREGA OS TÍTULOS INDIVIDUAIS
        const resInd = await fetch(`${TSV_URL_INDIVIDUAIS}&nocache=${new Date().getTime()}`);
        const textInd = await resInd.text();
        const linesInd = textInd.split('\n');

        let rawIndividuais = linesInd.slice(1).map(line => {
            const cols = line.split('\t');
            return {
                event: cols[0]?.trim().replace(/\r/g, "") || "",
                type: cols[1]?.trim().replace(/\r/g, "") || "",
                team: cols[2]?.trim().replace(/\r/g, "") || "",
                player: cols[3]?.trim().replace(/\r/g, "") || ""
            };
        }).filter(t => t.event !== "");

        // FILTRO MÁGICO: Remove linhas duplicadas da planilha automaticamente
        let vistosInd = new Set();
        titlesData.individuais = rawIndividuais.filter(t => {
            let chave = `${t.event}-${t.type}-${t.team}-${t.player}`.toLowerCase();
            if (vistosInd.has(chave)) return false;
            vistosInd.add(chave);
            return true;
        });

        console.log("🏆 Títulos carregados e deduplicados com sucesso!");
        renderOutrasEquipesGrid();

    } catch (e) {
        console.error('[loadTitles] Erro ao carregar os títulos:', e);
    }
}

// Função para pegar a cor exata baseada na nota
function getCFFBadgeColor(nota) {
    if (nota >= 10.0) return 'cff-10';
    if (nota >= 9.0)  return 'cff-9';
    if (nota >= 8.0)  return 'cff-8';
    if (nota >= 7.0)  return 'cff-7';
    if (nota >= 6.0)  return 'cff-6';
    if (nota >= 5.0)  return 'cff-5';
    return 'cff-min';
}
// O Cálculo CFF v3
// Hierarquia clara: Kills > Dano > Assists
// Kills usam raiz quadrada — retorno decrescente, diferencia bem 3k de 10k
// Dano split: "convertido" (proporcional aos kills) vs "excedente" (não finalizou — vale pouco)
// Bônus de posição do time: só ativo quando a nota já não está alta (não infla boas partidas)
// Nota 10 é excepcional — requer feito histórico (10+ kills com dano alto)
function calculateCFFNota(kills, dano, assists, mvp, posicaoTime) {

    const contribuiu = kills >= 1 || dano >= 200;

    // Jogador zerou ou quase: nota de 3.0 a 5.9
    if (!contribuiu) {
        if (dano === 0 && assists === 0) return 3.0; // zero absoluto
        let nota = 3.0;
        if (dano > 0 && dano < 200) nota += 0.8 + (dano / 199) * 0.5; // 3.8 ~ 4.3
        nota += assists * 0.15;
        return parseFloat(Math.min(nota, 5.9).toFixed(1));
    }

    // Jogador que contribuiu: base 6.0
    let nota = 6.0;

    // ── KILLS: raiz quadrada — diferencia muito mais kills altos de baixos ──
    // 1k→+0.90 | 3k→+1.56 | 5k→+2.01 | 7k→+2.38 | 10k→+2.85 | 11k→+2.98
    nota += Math.sqrt(kills) * 0.90;

    // ── DANO: split em convertido vs excedente ──
    if (kills === 0) {
        // Sem kill: dano de apoio/pressão pura
        nota += Math.min(Math.sqrt(dano * 0.25) / 55, 0.65);
    } else {
        // Dano esperado por kill (~620): representa eficiência normal
        let danoEsperado   = kills * 620;
        let danoConvertido = Math.min(dano, danoEsperado);
        let danoExcedente  = Math.max(0, dano - danoEsperado);

        // Convertido: peso normal (matou e causou dano proporcional)
        nota += Math.min(Math.sqrt(danoConvertido) / 90, 0.88);
        // Excedente: peso muito baixo (causou pressão mas não finalizou)
        nota += Math.min(Math.sqrt(danoExcedente) / 300, 0.10);
    }

    // ── ASSISTS: suporte, peso baixo ──
    nota += Math.min(assists * 0.08, 0.35);

    // ── MVP ──
    if (mvp) nota += 0.25;

    // ── BÔNUS DE POSIÇÃO DO TIME ──
    // Só aplica quando a nota ainda está abaixo de 7.5 — não infla partidas já boas
    let notaSemBonus = nota;
    if (notaSemBonus < 7.5) {
        if (posicaoTime === 1)       nota += 0.20; // Booyah/1º
        else if (posicaoTime <= 3)   nota += 0.10; // Top 3
        else if (posicaoTime <= 6)   nota += 0.06; // Top 6
    }

    return parseFloat(Math.min(nota, 10.0).toFixed(1));
}

function onPpcffDayFilterChanged() {
    buildDayFilters();
    if (currentPlayerView) {
        renderPlayerCFFRating(currentPlayerView);
    }
}

// --- NOVO BLOCO DE CONTROLE DE CONFRONTOS ---
const mapConfrontos = {
    "ABC": ["1", "8", "11", "14", "17"],
    "BCD": ["2", "5", "12", "15", "18"],
    "CDA": ["3", "6", "9", "16", "19"],
    "DAB": ["4", "7", "10", "13", "20"]
};

let isAvgExpanded = false;
let isTotalExpanded = false;
let isPlayerExpanded = false;

function renderPlayerCFFRating(playerName) {
    let container = document.getElementById('pp-cff-rating-container');
    let title = document.getElementById('pp-cff-title');
    let filterContainer = document.getElementById('pp-cff-filters-container');

    if (!container || !title) return;

    let diasData = [];

    // VARIÁVEIS GLOBAIS (Não são afetadas pelo filtro)
    let globalTotalNotas = 0;
    let globalTotalQuedas = 0;
    let playedAnyDay = false; // Verifica se o cara jogou o camp

    // Varre o banco de quedas diárias do campeonato atual
    for (let d in dbJogadoresQuedas) {
        let quedasDoDia = [];

        for (let q in dbJogadoresQuedas[d]) {
            let dropInfo = (dbQuedas[d] && dbQuedas[d][q]) ? dbQuedas[d][q] : { mapa: 'Desconhecido' };
            let playerDrop = dbJogadoresQuedas[d][q].find(p => checkNameMatch(p.nome, playerName));

            if (playerDrop) {
                playedAnyDay = true;
                // Busca posição do time do jogador nesta queda
                let posicaoTime = 12; // padrão: última posição
                if (dropInfo.resultados) {
                    let teamResult = dropInfo.resultados.find(r =>
                        r.equipe.toUpperCase() === (playerDrop.equipe || '').toUpperCase()
                    );
                    if (teamResult) posicaoTime = teamResult.posicao;
                }

                let nota = calculateCFFNota(playerDrop.kills, playerDrop.dano, playerDrop.assists, playerDrop.mvp, posicaoTime);

                // === SOMA NA MÉDIA GERAL (INDEPENDENTE DO FILTRO) ===
                globalTotalNotas += nota;
                globalTotalQuedas++;

                quedasDoDia.push({
                    queda: q,
                    mapa: dropInfo.mapa,
                    kills: playerDrop.kills,
                    dano: playerDrop.dano,
                    assists: playerDrop.assists,
                    mvp: playerDrop.mvp,
                    nota: nota
                });
            }
        }

        // Finaliza os cálculos do dia e aplica o filtro
        if (quedasDoDia.length > 0) {
            let mediaDrops = quedasDoDia.reduce((sum, q) => sum + q.nota, 0) / quedasDoDia.length;
            let totalKills = quedasDoDia.reduce((sum, q) => sum + q.kills, 0);
            let totalDano = quedasDoDia.reduce((sum, q) => sum + q.dano, 0);
            let totalMvps = quedasDoDia.filter(q => q.mvp).length;

            let notaDia = mediaDrops;

            // Bônus de Lenda do Dia
            if (totalKills >= 12) notaDia += (totalKills - 11) * 0.15;
            if (totalKills >= 20) notaDia += (totalKills - 19) * 0.25;
            if (totalDano >= 10000) notaDia += 0.3;
            if (totalDano >= 15000) notaDia += 0.5;
            if (totalMvps > 0) notaDia += (totalMvps * 0.4);
            if (totalKills >= 30) notaDia = 10.0; // O Dia Histórico

            notaDia = Math.min(Math.max(notaDia, mediaDrops), 10.0);

            // SÓ ADICIONA NO VISUAL SE O DIA PASSAR PELO FILTRO
            if (selectedPpcffDays.length === 0 || selectedPpcffDays.includes(String(d))) {
                diasData.push({
                    dia: Number(d),
                    quedas: quedasDoDia,
                    mediaDia: notaDia.toFixed(1)
                });
            }
        }
    }

    // Se o jogador for Inativo/Histórico, esconde tudo
    if (!playedAnyDay) {
        container.style.display = 'none';
        title.style.display = 'none';
        if (filterContainer) filterContainer.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    title.style.display = 'flex';
    if (filterContainer) filterContainer.style.display = 'flex';

    // Ordena do dia mais recente para o mais antigo no visual
    diasData.sort((a,b) => b.dia - a.dia);

    let html = diasData.map(diaInfo => {
        let badgeDia = getCFFBadgeColor(parseFloat(diaInfo.mediaDia));

        let quedasHtml = diaInfo.quedas.map(q => {
            // Nota que tiramos as contas globais daqui de dentro!
            let notaVisual = Math.max(6.0, q.nota);
            let badgeQueda = getCFFBadgeColor(notaVisual);

            return `
            <tr style="background: rgba(255,255,255,0.02);">
                <td style="text-align:left; color:var(--text-muted); font-weight:bold;">
                    Queda ${q.queda} <br><span style="font-size:0.75em; color:#888;">${q.mapa.toUpperCase()}</span>
                </td>
                <td style="color:#fff;">${q.kills}</td>
                <td>${q.dano}</td>
                <td>${q.assists}</td>
                <td>
                    <div style="display:flex; align-items:center; justify-content:center;">
                        <span class="cff-badge ${badgeQueda}">${notaVisual.toFixed(1)}</span>
                    </div>
                </td>
            </tr>`;
        }).join('');

        return `
        <div style="background: var(--panel-bg); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">
            <div style="display:flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: #0d1220; border-bottom: 1px solid var(--border);">
                <h4 style="margin: 0; color: #fff;">DIA ${diaInfo.dia}</h4>
                <div style="display:flex; align-items:center; gap: 10px;">
                    <span style="font-size: 0.8em; color: var(--text-muted); font-weight: bold; text-transform: uppercase;">Nota do Dia</span>
                    <span class="cff-badge ${badgeDia}" style="font-size: 1.1em;">${diaInfo.mediaDia}</span>
                </div>
            </div>
            <div class="table-container" style="margin-bottom: 0; border: none; border-radius: 0;">
                <table class="cff-table" style="width: 100%; margin: 0;">
                    <thead>
                        <tr>
                            <th style="text-align:left;">PARTIDA</th>
                            <th>KILLS</th>
                            <th>DANO</th>
                            <th>AST</th>
                            <th>NOTA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${quedasHtml}
                    </tbody>
                </table>
            </div>
        </div>`;
    }).join('');

    // CALCULA A MÉDIA GERAL COM AS VARIÁVEIS GLOBAIS ABSOLUTAS
    let mediaGeral = globalTotalQuedas > 0 ? (globalTotalNotas / globalTotalQuedas).toFixed(1) : "0.0";
    let badgeGeral = getCFFBadgeColor(parseFloat(mediaGeral));

    let headerHtml = `
    <div style="display: flex; align-items: center; justify-content: space-between; background: linear-gradient(90deg, #1c1c20 0%, #0d1220 100%); border-left: 4px solid var(--accent); padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid var(--border);">
        <div>
            <div style="font-size: 0.9em; color: #fff; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Média Geral no Campeonato</div>
            <div style="font-size: 0.8em; color: #888; margin-top: 4px;">Análise baseada em ${globalTotalQuedas} quedas disputadas.</div>
        </div>
        <div class="cff-badge ${badgeGeral}" style="font-size: 2.2em; padding: 5px 20px;">${mediaGeral}</div>
    </div>
    `;

    container.innerHTML = headerHtml + html;
}

async function loadCampeonatos() {
    const CAMP_TSV_URL = window.CFF_CONFIG.sheets.campeonatos;

    try {
        const res = await fetch(`${CAMP_TSV_URL}&nocache=${new Date().getTime()}`);
        const tsvText = await res.text();
        const lines = tsvText.split('\n');

        const torneiMap = {};

        lines.slice(1).forEach(line => {
            const cols = line.split('\t');
            const tier    = cols[0]?.trim().replace(/\r/g, '');
            const data    = cols[1]?.trim().replace(/\r/g, '');
            const torneio = cols[2]?.trim().replace(/\r/g, '');
            const equipe  = cols[3]?.trim().replace(/\r/g, '').toUpperCase();
            const place   = cols[4]?.trim().replace(/\r/g, '');

            if (!tier || !data || !torneio || !equipe || !place) return;

            // MÁGICA AQUI: A chave agora é SÓ o nome do torneio em maiúsculo.
            // Isso força o código a juntar tudo que tem o mesmo nome no mesmo card!
            const key = torneio.toUpperCase().trim();

            if (!torneiMap[key]) {
                // O ID recebe a chave nova. Isso garante que o clique no card vai continuar funcionando perfeitamente.
                torneiMap[key] = { id: key, torneio, data, tier, resultados: {} };
            }

            // Adiciona a equipe e a posição dentro do torneio unificado
            torneiMap[key].resultados[equipe] = place;
        });

        dbCampeonatos = Object.values(torneiMap);
        distribuirNovosResultados();

        // Renderiza a aba de torneios logo após carregar
        renderOutrosTorneiosList();

        console.log(`✅ ${dbCampeonatos.length} campeonato(s) carregado(s) via Sheets!`);

    } catch (e) {
        console.error('[loadCampeonatos] Erro:', e);
    }
}

// ABA: OUTROS TORNEIOS (INTEGRADA COM GOOGLE SHEETS)

let currentOtData = null; // Guarda qual torneio está aberto

// --- HISTÓRICO DE RESULTADOS DAS EQUIPES ---
let dbResults = {};
let resultsLoaded = false;

let lbffData = {};
let lbffLoaded = false;

let logos = {
    // === EQUIPES ATUAIS (WB 2026) ===
    'ALPHA7': 'A7 2.png',
    'AXS FUSION': 'AXS BRANCA.png',
    'CIVIS': 'Civis.png',
    'E1 SPORTS': 'E1.png',
    'FLUXO W7M': 'Fluxo 2.png',
    'INFLUENCE RAGE': 'Influence Rage.png',
    'INTZ': 'Intz 1.png',
    'LOOPS': 'Loops 1.png',
    'LOS': 'Los.png',
    'LOUD SNICKERS': 'loud 2.png',
    'ANGELS OUTPLAY': 'Outplay.png',
    'RISE GAMING': 'Rise 1.png',
    'RUSH GAMING': 'Rush.png',
    'TEAM SOLID': 'Team Solid 2.png',
    'VASCO ESPORTS': 'Vasco.png',
    'VIRTUS PRO': 'Virtus Pro.png',

    // === EQUIPES HISTÓRICAS (Retiradas do titlesData) ===
    'VIVO KEYD': 'keyd.webp',
    'B4 ESPORTS': 'b4.webp',
    'SS ESPORTS': 'ss esports.webp',
    'TEAM LIQUID': 'tl.webp',
    'BLACK DRAGONS': 'bd.webp',
    'MAGIC SQUAD': 'magic squad.webp',
    'TSM': 'tsm.webp',
    'SANTOS': 'santos.webp',
    'ALFA 34': 'a34.webp',

    // === BÔNUS PARA O HISTÓRICO DE EQUIPES (dbPassagens) ===
    // (Basta você ter essas imagens salvas na pasta com esses nomes)
    'PAIN GAMING': 'pain.webp', 'CORINTHIANS': 'sccp.webp', 'FLAMENGO': 'fla.webp', 'NETSHOES MINERS': 'miners.webp', 'RED CANIDS': 'red.webp', 'ANTISOCIAL TEAM': 'ast.webp',
    'FURIA': 'furia.webp',
};

const allEditions = ["LBFF 1", "LBFF 3", "LBFF 4", "LBFF 5", "LBFF 6", "LBFF 7", "LBFF 8", "LBFF 9", "WB 2024 F1", "WB 2024 F2", "WB 2025 S1", "WB 2025 S2", "WB 2026 S1"];
let selectedEditions = ["WB 2026 S1"];

const shortNames = {
    'FLUXO W7M': 'FX', 'E1 SPORTS': 'E1', 'AXS FUSION': 'AXS', 'LOOPS': 'LPS',
    'TEAM SOLID': 'TS', 'INFLUENCE RAGE': 'INF', 'VASCO ESPORTS': 'CRVG', 'CIVIS': 'CVS',
    'LOS': 'LOS', 'LOUD SNICKERS': 'LOUD', 'INTZ': 'INTZ', 'RISE GAMING': 'RISE',
    'VIRTUS PRO': 'VP', 'ALPHA7': 'A7', 'RUSH GAMING': 'RUSH', 'ANGELS OUTPLAY': 'ANOP'
};

// Dicionário para "traduzir" o nome da Liquipedia para o nosso Banco
const historicalAliases = {
    "Lost": "Lost21", "NandoX": "Naandox", "But": "BuTziN", "General": "General!",
    "VITINxp": "vitinxp", "PÃO7": "Pão7", "DRAXX7": "Draxx7", "Stark7": "Stark", "GIUH.87": "Giuh",
    "Motovea7": "Motovea", "Nickz7": "NICKZ", "HONEY": "honeyzL", "Cauã": "Cauã9", "PETERxl": "PETER",
    "o Mala": "Mala", "Zetsu9": "ZETSU9", "iguiNmvp": "IguiNmvp", "KakaZk": "KaKaZk", "Prozin10": "PROZIN",
    "Hak": "HAK", "Erick11": "Erick11"
};

function normalizePlayerAliasKey(value) {
    return String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
}

function registerPlayerAlias(canonical, alias) {
    const canon = String(canonical || '').trim();
    const alt = String(alias || '').trim();
    if (!canon || !alt) return;

    const canonKey = normalizePlayerAliasKey(canon);
    const altKey = normalizePlayerAliasKey(alt);
    if (!canonKey || !altKey) return;

    playerAliasLookup[canonKey] = canon;
    playerAliasLookup[altKey] = canon;
}

function rebuildPlayerAliasLookup() {
    playerAliasLookup = {};

    // Mapa antigo: { "apelido antigo": "nome atual" }
    if (typeof historicalAliases !== 'undefined') {
        Object.entries(historicalAliases).forEach(([alias, canonical]) => {
            registerPlayerAlias(canonical, alias);
        });
    }

    // Mapa novo: { "nome atual": ["variação 1", "variação 2"] }
    if (playerAliases && typeof playerAliases === 'object') {
        Object.entries(playerAliases).forEach(([canonical, aliases]) => {
            registerPlayerAlias(canonical, canonical);
            if (Array.isArray(aliases)) {
                aliases.forEach(alias => registerPlayerAlias(canonical, alias));
            } else if (typeof aliases === 'string') {
                aliases.split(',').map(a => a.trim()).filter(Boolean).forEach(alias => registerPlayerAlias(canonical, alias));
            }
        });
    }

    // Garante que todos os jogadores da temporada atual sejam nomes canônicos.
    if (typeof db !== 'undefined' && Array.isArray(db.players)) {
        db.players.forEach(p => registerPlayerAlias(p.jogador, p.jogador));
    }
}

function getCanonicalPlayerName(name) {
    const raw = String(name || '').trim();
    if (!raw) return raw;

    const key = normalizePlayerAliasKey(raw);
    if (!key) return raw;

    if (!playerAliasLookup || !Object.keys(playerAliasLookup).length) {
        rebuildPlayerAliasLookup();
    }

    return playerAliasLookup[key] || historicalAliases[raw] || raw;
}

function getPlayerAliasList(name) {
    const canonical = getCanonicalPlayerName(name);
    const values = new Set([canonical]);

    if (typeof historicalAliases !== 'undefined') {
        Object.entries(historicalAliases).forEach(([alias, canon]) => {
            if (normalizePlayerAliasKey(canon) === normalizePlayerAliasKey(canonical)) values.add(alias);
        });
    }

    const extra = playerAliases?.[canonical];
    if (Array.isArray(extra)) extra.forEach(alias => values.add(alias));
    if (typeof extra === 'string') extra.split(',').map(a => a.trim()).filter(Boolean).forEach(alias => values.add(alias));

    return Array.from(values);
}

function parseRookieFlag(value) {
    const v = String(value || '').trim().toLowerCase();
    return ['true', '1', 'sim', 's', 'yes', 'y', 'x'].includes(v);
}

function isRookiePlayer(name) {
    const raw = String(name || '').trim();
    if (!raw || !rookiePlayers || !rookiePlayers.size) return false;

    const rawKey = normalizePlayerAliasKey(raw);
    if (rookiePlayers.has(rawKey)) return true;

    const canonical = getCanonicalPlayerName(raw);
    const canonicalKey = normalizePlayerAliasKey(canonical);
    if (rookiePlayers.has(canonicalKey)) return true;

    const aliases = getPlayerAliasList(canonical);
    return aliases.some(alias => rookiePlayers.has(normalizePlayerAliasKey(alias)));
}

async function loadRookiePlayers() {
    const rookiesUrl = window.CFF_CONFIG?.sheets?.novatos;
    rookiePlayers = new Set();

    if (!rookiesUrl) {
        console.warn('[loadRookiePlayers] Link da planilha de novatos não configurado.');
        return;
    }

    try {
        const res = await fetch(`${rookiesUrl}&nocache=${Date.now()}`);
        if (!res.ok) throw new Error('Falha ao carregar planilha de novatos');

        const tsvText = await res.text();
        const lines = tsvText.split('\n').map(line => line.replace(/\r/g, '')).filter(line => line.trim());
        if (!lines.length) return;

        const header = lines[0].split('\t').map(h => h.trim().toLowerCase());
        const hasHeader = header.includes('jogador') || header.includes('rookie') || header.includes('novato');
        const jogadorIndex = hasHeader ? Math.max(header.indexOf('jogador'), header.indexOf('player'), 0) : 0;
        let rookieIndex = hasHeader ? Math.max(header.indexOf('rookie'), header.indexOf('novato'), header.indexOf('novatos'), 1) : 1;
        if (rookieIndex < 0) rookieIndex = 1;

        const rows = hasHeader ? lines.slice(1) : lines;
        rows.forEach(line => {
            const cols = line.split('\t');
            const jogador = cols[jogadorIndex]?.trim();
            const rookieValue = cols[rookieIndex]?.trim();
            if (!jogador || !parseRookieFlag(rookieValue)) return;
            rookiePlayers.add(normalizePlayerAliasKey(jogador));
        });

        console.log(`Novatos carregados: ${rookiePlayers.size}`);
    } catch (e) {
        console.error('[loadRookiePlayers] Erro ao carregar novatos:', e);
    }
}

async function loadPlayerAliases() {
    const aliasesUrl = window.CFF_CONFIG?.files?.playerAliases || 'player-aliases.json';

    try {
        const res = await fetch(`${aliasesUrl}?nocache=${Date.now()}`);
        if (!res.ok) throw new Error(`Arquivo ${aliasesUrl} não encontrado`);

        const data = await res.json();
        playerAliases = data && typeof data === 'object' ? data : {};
        rebuildPlayerAliasLookup();
        console.log('Aliases de jogadores carregados com sucesso!');
    } catch (e) {
        // Não quebra o site: usa o mapa antigo historicalAliases.
        console.warn('[loadPlayerAliases] Usando apenas aliases internos:', e.message || e);
        playerAliases = {};
        rebuildPlayerAliasLookup();
    }
}

function buildPlayerAliasesFromPassagens() {
    if (!Array.isArray(dbPassagens) || !dbPassagens.length || !db?.players?.length) return;

    const currentByKey = {};
    db.players.forEach(p => {
        currentByKey[normalizePlayerAliasKey(p.jogador)] = p.jogador;
    });

    dbPassagens.forEach(p => {
        const oldName = String(p.jogador || '').trim();
        const canonical = currentByKey[normalizePlayerAliasKey(oldName)];
        if (!oldName || !canonical || normalizePlayerAliasKey(oldName) === normalizePlayerAliasKey(canonical) && oldName === canonical) return;

        if (!playerAliases[canonical]) playerAliases[canonical] = [];
        if (!playerAliases[canonical].some(alias => normalizePlayerAliasKey(alias) === normalizePlayerAliasKey(oldName))) {
            playerAliases[canonical].push(oldName);
        }
    });

    rebuildPlayerAliasLookup();
}


// Top 100 Histórico (Extraído da Liquipedia)
// histData removido — kills históricas calculadas dinamicamente via lbffData

// Função auxiliar: calcula kills e quedas históricas de um jogador via lbffData
function getHistTotals(playerName) {
    let totalK = 0, totalQ = 0;
    let entry = Object.entries(lbffData).find(([name]) => checkNameMatch(name, playerName));
    if (entry) {
        for (let ed in entry[1]) {
            totalK += entry[1][ed].k || 0;
            totalQ += entry[1][ed].q || 0;
        }
    }
    return { k: totalK, q: totalQ, entry: entry };
}

// BANCO DE DADOS: DESEMPENHO POR QUEDA

const posPoints = {1:12, 2:9, 3:8, 4:7, 5:6, 6:5, 7:4, 8:3, 9:2, 10:1, 11:0, 12:0};

let dbQuedas = {};
let dbJogadoresQuedas = {};

const db = {
    teams: [
        { equipe: 'FLUXO W7M', grupo: 'A' },
        { equipe: 'VIRTUS PRO', grupo: 'D' },
        { equipe: 'LOS', grupo: 'C' },
        { equipe: 'LOUD SNICKERS', grupo: 'C' },
        { equipe: 'ALPHA7', grupo: 'D' },
        { equipe: 'TEAM SOLID', grupo: 'B' },
        { equipe: 'INTZ', grupo: 'C' },
        { equipe: 'E1 SPORTS', grupo: 'A' },
        { equipe: 'AXS FUSION', grupo: 'A' },
        { equipe: 'LOOPS', grupo: 'A' },
        { equipe: 'RISE GAMING', grupo: 'C' },
        { equipe: 'RUSH GAMING', grupo: 'D' },
        { equipe: 'INFLUENCE RAGE', grupo: 'B' },
        { equipe: 'VASCO ESPORTS', grupo: 'B' },
        { equipe: 'ANGELS OUTPLAY', grupo: 'D' },
        { equipe: 'CIVIS', grupo: 'B' }
    ],
    players: [
        { jogador: "BIELGOD", equipe: "VASCO ESPORTS" },
        { jogador: "BLACK02", equipe: "RUSH GAMING" },
        { jogador: "BRUNO7w", equipe: "E1 SPORTS", isEx: true },
        { jogador: "BYTE333", equipe: "TEAM SOLID" },
        { jogador: "BZP", equipe: "LOUD SNICKERS" },
        { jogador: "Bahiaz7", equipe: "VASCO ESPORTS" },
        { jogador: "Bops", equipe: "FLUXO W7M" },
        { jogador: "Brisa7", equipe: "ALPHA7" },
        { jogador: "BuTziN", equipe: "FLUXO W7M" },
        { jogador: "Cauan7", equipe: "VIRTUS PRO" },
        { jogador: "Cauã9", equipe: "E1 SPORTS" },
        { jogador: "DRADE.11", equipe: "ANGELS OUTPLAY" },
        { jogador: "Destroi7", equipe: "CIVIS" },
        { jogador: "Draxx7", equipe: "LOOPS" },
        { jogador: "Erick11", equipe: "RISE GAMING" },
        { jogador: "Ericking", equipe: "LOOPS" },
        { jogador: "Fixa.10", equipe: "ANGELS OUTPLAY", isEx: true },
        { jogador: "GUAXA", equipe: "LOUD SNICKERS" },
        { jogador: "GUIMERLQ", equipe: "RUSH GAMING" },
        { jogador: "GUS", equipe: "INTZ" },
        { jogador: "General!", equipe: "LOS" },
        { jogador: "Giuh", equipe: "FLUXO W7M" },
        { jogador: "HAK", equipe: "LOUD SNICKERS" },
        { jogador: "IGOR7", equipe: "INFLUENCE RAGE" },
        { jogador: "ITAL0$$", equipe: "RISE GAMING" },
        { jogador: "IguiNmvp", equipe: "RISE GAMING" },
        { jogador: "JNmvp7", equipe: "ALPHA7" },
        { jogador: "João7", equipe: "INTZ" },
        { jogador: "Juca10xL", equipe: "E1 SPORTS" },
        { jogador: "KaKaZk", equipe: "RISE GAMING" },
        { jogador: "Keven7!", equipe: "CIVIS" },
        { jogador: "LucasAWP", equipe: "CIVIS" },
        { jogador: "LC777", equipe: "RUSH GAMING" },
        { jogador: "Lost21", equipe: "VIRTUS PRO" },
        { jogador: "Luan7", equipe: "LOOPS" },
        { jogador: "Lyon", equipe: "E1 SPORTS" },
        { jogador: "MT7", equipe: "FLUXO W7M" },
        { jogador: "Mala", equipe: "VIRTUS PRO" },
        { jogador: "Master77", equipe: "CIVIS" },
        { jogador: "MitinX", equipe: "RUSH GAMING" },
        { jogador: "MitoMvp", equipe: "ALPHA7" },
        { jogador: "Motovea", equipe: "TEAM SOLID" },
        { jogador: "Mts007", equipe: "VASCO ESPORTS", isEx: true },
        { jogador: "NEYawp", equipe: "ALPHA7" },
        { jogador: "NICKZ", equipe: "LOUD SNICKERS" },
        { jogador: "Naandox", equipe: "RISE GAMING" },
        { jogador: "Nikeboy", equipe: "VIRTUS PRO" },
        { jogador: "PETER", equipe: "TEAM SOLID" },
        { jogador: "PROZIN", equipe: "RUSH GAMING" },
        { jogador: "Pitbull", equipe: "TEAM SOLID" },
        { jogador: "Proxx7", equipe: "FLUXO W7M" },
        { jogador: "Pão7", equipe: "E1 SPORTS" },
        { jogador: "Raone7", equipe: "LOS" },
        { jogador: "Razure", equipe: "INFLUENCE RAGE" },
        { jogador: "Redxzzz", equipe: "AXS FUSION" },
        { jogador: "Rick9z", equipe: "ANGELS OUTPLAY", isEx: true },
        { jogador: "Rigby245", equipe: "LOS" },
        { jogador: "Rojão", equipe: "VASCO ESPORTS" },
        { jogador: "SEU PAI", equipe: "ANGELS OUTPLAY" },
        { jogador: "SEU TIO", equipe: "ANGELS OUTPLAY", isEx: true },
        { jogador: "SOARES", equipe: "AXS FUSION" },
        { jogador: "Sam7", equipe: "ALPHA7" },
        { jogador: "Shotzzrx", equipe: "VIRTUS PRO" },
        { jogador: "Stark", equipe: "LOOPS" },
        { jogador: "TRAP", equipe: "LOUD SNICKERS" },
        { jogador: "Theus", equipe: "AXS FUSION" },
        { jogador: "WM", equipe: "ANGELS OUTPLAY" },
        { jogador: "WillProdigy", equipe: "CIVIS" },
        { jogador: "YOKO7", equipe: "CIVIS" },
        { jogador: "Yago", equipe: "LOS" },
        { jogador: "Yann7awp", equipe: "AXS FUSION" },
        { jogador: "ZETSU9", equipe: "VASCO ESPORTS" },
        { jogador: "honeyzL", equipe: "INTZ" },
        { jogador: "itzking1", equipe: "INFLUENCE RAGE" },
        { jogador: "kauãxp", equipe: "INTZ" },
        { jogador: "lippe!", equipe: "INFLUENCE RAGE" },
        { jogador: "mtsexy.", equipe: "LOS" },
        { jogador: "nepoIGN", equipe: "ANGELS OUTPLAY" },
        { jogador: "vitinxp", equipe: "TEAM SOLID" },
        { jogador: "wLiu", equipe: "AXS FUSION" }
    ]
};
const agenda = [
    { semana: "7", data: "03 de Maio", grupos: ["A", "B", "C"] },
    { semana: "8", data: "09 de Maio", grupos: ["B", "C", "D"] },
    { semana: "8", data: "10 de Maio", grupos: ["C", "D", "A"] },
    { semana: "9", data: "16 de Maio", grupos: ["A", "B", "C"] },
    { semana: "9", data: "17 de Maio", grupos: ["B", "C", "D"] },
    { semana: "10", data: "23 de Maio", grupos: ["C", "D", "A"] },
    { semana: "10", data: "24 de Maio", grupos: ["D", "A", "B"] }
];

// Controle de visibilidade das tabelas históricas
let isAllTimeExpanded = false;
let isEditionExpanded = false;

function toggleView(type) {
    if (type === 'allTime') {
        isAllTimeExpanded = !isAllTimeExpanded;
        renderHistoricalRanking();
    } else {
        isEditionExpanded = !isEditionExpanded;
        renderEditionRanking();
    }
}

let selectedTeamDays = [];
let selectedPlayerDays = [];
let selectedTpDays = [];
// ADICIONE ESSAS DUAS LINHAS:
let selectedAvgDays = [];
let selectedTotalDays = [];
let selectedTop5Days = [];
let selectedPpcffDays = [];
let currentPlayerView = null;

let currentTeamView = null;
let currentOppGroup = null;
let currentTeamNextMatch = null;
let TOTAL_DIAS = 0;

window.onload = async () => {
    // 0. CARREGA O BANCO DE DADOS EXTERNO (JSON)
    try {
        const response = await fetch('dados.json');
        if (!response.ok) throw new Error("Erro ao carregar dados.json");

const data = await response.json();
        dbQuedas = data.dbQuedas || {};
        dbJogadoresQuedas = data.dbJogadoresQuedas || {};

        // ADICIONE ESTA LINHA EXATAMENTE AQUI:
        TOTAL_DIAS = Object.keys(dbQuedas).length > 0 ? Math.max(...Object.keys(dbQuedas).map(Number)) : 0;

        console.log("Banco de dados JSON carregado com sucesso!");
        await loadPlayerAliases();
        await loadRookiePlayers();
    } catch (error) {
        console.error(error);
        alert("Erro ao carregar o banco de dados de quedas. Você está usando um servidor local?");
    }

    // 1. INICIALIZAÇÃO DA PÁGINA
    navigate('home');

    // 2. PREPARAÇÃO E CÁLCULO DE DADOS (DATABASE)
    distribuirNovosResultados();
    autoCalculateTotals();
    calculatePlayerRanks();
    db.teams.sort((a,b) => b.pontos - a.pontos).forEach((t, i) => t.posGeral = i + 1);

    // 3. RENDERIZAÇÃO DOS COMPONENTES (UI)
    renderHomeStats();
    renderHomeGroups();

    buildDayFilters();
    populateSelects();

    renderFullTeams();
    renderGroupsTables();
    renderTeamsDirectory();

    renderAllPlayers();
    renderPlayerStats();
    // Auto-seleciona a semana mais recente com dados
    const _weeksWithData = Object.keys(wbWeeks).filter(w => {
        const days = wbWeeks[w];
        return db.playerDaily.some(d => days.includes(Number(d.dia)));
    });
    if (_weeksWithData.length > 0) {
        currentSelectionWeek = _weeksWithData[_weeksWithData.length - 1];
    }
    renderSelectionFilters();
    renderSelection();

    renderTop5Stats();
    renderTableAvg();
    renderTableTotal();

    renderIndividualRecords();

    // Carrega dados históricos ANTES de renderizar o Hall da Fama
    await loadLbffData();

    buildEditionFilters();
    renderEditionRanking();
    populateHistSelects();
    renderHistCompare();
    renderHistoricalRanking();

    renderOutrosTorneiosList();
    renderSchedule();
    renderOutrasEquipesGrid();
    loadSEAData();
    buildDesktopTeamNav();
    initSearchListeners();
    buildMultiTeamFilters();
    renderMultiTeamChart();

    // 4. INTEGRAÇÕES EXTERNAS (GOOGLE SHEETS)
    loadLives();
    loadNoticias();
    loadSobre();
    loadSocials();
    loadTeamLogos();
    loadPhotos();
    loadLeagueLogos(); // ← Logos de ligas/torneios via Sheets
    loadCampeonatos();
    loadTitles();
    loadStaff();
    await loadPassagens();
    buildPlayerAliasesFromPassagens();

    // 5. CRONÔMETROS
    updateCountdown();
    setInterval(updateCountdown, 1000);
};

// Fecha o script tag adequadamente

let lastVisitedPage = 'home'; // Memória da última página principal

function navigate(pageId) {
    // Força a página a voltar para o topo instantaneamente
    window.scrollTo(0, 0);

    // Salva a aba atual na memória (ignora se for página de perfil)
    if (!pageId.includes('profile')) {
        lastVisitedPage = pageId;
        // Atualiza o hash na URL sem causar scroll forçado
        history.replaceState(null, '', '#' + pageId);
    }

    // Esconde todas as páginas e tira o destaque dos botões
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // Mostra a página que você clicou
    const pageEl = document.getElementById(pageId);
    if (pageEl) pageEl.classList.add('active');

    // Atualiza estado dos botões do mobile (4 tabs fixas)
    const mobileTabMap = {
        'tabela': 'mob-tab-tabela',
        'mvp': 'mob-tab-mvp',
        'equipes': 'mob-tab-equipes',
        'datas': 'mob-tab-schedule'
    };
    document.querySelectorAll('.nav-mobile-tab').forEach(b => b.classList.remove('active'));
    if (mobileTabMap[pageId]) {
        const activeTab = document.getElementById(mobileTabMap[pageId]);
        if (activeTab) activeTab.classList.add('active');
    }

    // Atualiza estado dos botões da sidebar
    document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    const sbBtn = document.getElementById('sb-' + pageId);
    if (sbBtn) sbBtn.classList.add('active');
}

// Ao carregar, verifica se a URL já tem um hash e navega direto para a página
document.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
        navigate(hash);
    }
});

