from pathlib import Path
import re

# Worker: combo bonus when the user gets BOTH FFWS team picks right.
path = Path('cloudflare/instagram-community/worker.js')
text = path.read_text(encoding='utf-8')

if 'ffwsPredictionComboPoints' not in text:
    text = text.replace(
        '  ffwsPredictionNearestPoints: 5,\n',
        '  ffwsPredictionNearestPoints: 5,\n  ffwsPredictionComboPoints: 3,\n',
        1,
    )

if 'comboPoints: RULES.ffwsPredictionComboPoints' not in text:
    text = text.replace(
        '    correctPoints: RULES.ffwsPredictionNearestPoints,\n    day: round.round,',
        '    correctPoints: RULES.ffwsPredictionNearestPoints,\n    comboPoints: RULES.ffwsPredictionComboPoints,\n    day: round.round,',
        1,
    )

if 'async function settleAutoCombo' not in text:
    marker = 'async function settleAllAvailable(env, manual, auto) {'
    combo = '''async function settleAutoCombo(env, predictions) {
  const list = Array.isArray(predictions) ? predictions : [];
  const best = list.find(p => p?.metric === 'best');
  const worst = list.find(p => p?.metric === 'worst');
  if (!best || !worst || best.status !== 'settled' || worst.status !== 'settled' || !best.result || !worst.result) return;

  const [bestRows, worstRows] = await Promise.all([
    env.DB.prepare(`SELECT user_key, username, source_id FROM awards WHERE type='prediction_vote' AND award_key LIKE ?1 LIMIT 2500`).bind(`prediction-vote:${best.id}:%`).all(),
    env.DB.prepare(`SELECT user_key, username, source_id FROM awards WHERE type='prediction_vote' AND award_key LIKE ?1 LIMIT 2500`).bind(`prediction-vote:${worst.id}:%`).all(),
  ]);

  const bestAccepted = new Set(best.result.teams || (best.result.option ? [best.result.option] : []));
  const worstAccepted = new Set(worst.result.teams || (worst.result.option ? [worst.result.option] : []));
  const worstByUser = new Map((worstRows.results || []).map(row => [row.user_key, row]));
  const winners = [];

  for (const row of bestRows.results || []) {
    const bestVote = parseVoteSource(best.id, row.source_id);
    if (!bestVote || !bestAccepted.has(bestVote.option)) continue;
    const other = worstByUser.get(row.user_key);
    if (!other) continue;
    const worstVote = parseVoteSource(worst.id, other.source_id);
    if (!worstVote || !worstAccepted.has(worstVote.option)) continue;
    winners.push({ userKey: row.user_key, username: row.username || other.username || 'usuario' });
  }

  const timestamp = Math.max(Number(best.closesAt || 0), Number(worst.closesAt || 0), Date.now());
  for (let i = 0; i < winners.length; i += 25) {
    await Promise.all(winners.slice(i, i + 25).map(row => awardInteraction(env, {
      awardKey: `prediction-combo:${best.day || 'day'}:${row.userKey}`,
      userKey: row.userKey,
      identity: '',
      username: row.username,
      type: 'prediction_combo',
      sourceId: `${best.id}|${worst.id}`,
      points: RULES.ffwsPredictionComboPoints,
      timestamp,
    })));
  }
}

'''
    if marker not in text:
        raise SystemExit('settleAllAvailable marker not found')
    text = text.replace(marker, combo + marker, 1)

pattern = re.compile(
    r'async function settleAllAvailable\(env, manual, auto\) \{.*?\n\}\n\nasync function resolvePrediction',
    re.S,
)
replacement = '''async function settleAllAvailable(env, manual, auto) {
  const jobs = [];
  if (manual?.status === 'settled') jobs.push(settleManualPrediction(env, manual));
  for (const item of auto.pairs || []) {
    const predictions = item.predictions || [];
    for (const prediction of predictions) {
      if (prediction.status === 'settled') jobs.push(settleAutoPrediction(env, prediction));
    }
    if (predictions.length >= 2 && predictions.every(p => p.status === 'settled')) jobs.push(settleAutoCombo(env, predictions));
  }
  await Promise.allSettled(jobs);
}

async function resolvePrediction'''
text, count = pattern.subn(lambda _: replacement, text, count=1)
if count != 1:
    raise SystemExit('settleAllAvailable block not replaced')

text = text.replace(
    "a.type IN ('prediction_vote','prediction_correct','prediction_nearest')",
    "a.type IN ('prediction_vote','prediction_correct','prediction_nearest','prediction_combo')",
)
path.write_text(text, encoding='utf-8')

# Load the new public/community scripts on the relevant pages.
def inject_before_body(file, tags):
    p = Path(file)
    t = p.read_text(encoding='utf-8')
    additions = []
    for marker, tag in tags:
        if marker not in t:
            additions.append(tag)
    if additions:
        if '</body>' not in t:
            raise SystemExit(f'</body> not found in {file}')
        t = t.replace('</body>', '\n' + '\n'.join(additions) + '\n</body>', 1)
    p.write_text(t, encoding='utf-8')

inject_before_body('index.html', [
    ('data-cff-community-promos', '<script defer data-cff-community-promos src="js/community-promos.js?v=20260915-community-promos-v1"></script>'),
])
inject_before_body('interacoes.html', [
    ('data-cff-community-prediction', '<script data-cff-community-prediction src="js/community-prediction.js?v=20260915-prediction-pair-v4"></script>'),
    ('data-cff-community-promos', '<script data-cff-community-promos src="js/community-promos.js?v=20260915-community-promos-v1"></script>'),
])
inject_before_body('admin-sorteio-comunidade.html', [
    ('data-cff-giveaway-priority', '<script data-cff-giveaway-priority src="js/admin-giveaway-priority.js?v=20260915-giveaway-priority-v1"></script>'),
])

# Sorteador: accept lines such as "Nakata 1,5", "Nakata 1,5x" or "Nakata 1,5×".
p = Path('sorteador/index.html')
t = p.read_text(encoding='utf-8')
if 'parsedWeights=new Map()' not in t:
    t = t.replace(
        "let people=[],winners=[],mode='wheel',rot=0,busy=false;",
        "let people=[],winners=[],mode='wheel',rot=0,busy=false,parsedWeights=new Map();",
        1,
    )

parse_pattern = re.compile(r'function parse\(\)\{.*?\}function activeWinners\(\)', re.S)
parse_repl = r'''function parse(){let raw=$('#names').value,sep=$('#sep').value,a;if(sep==='line')a=raw.split(/\r?\n/);else if(sep==='comma')a=raw.split(',');else if(sep==='semicolon')a=raw.split(';');else if(sep==='tab')a=raw.split('\t');else a=/\r?\n/.test(raw)?raw.split(/\r?\n/):/\s+\d+(?:[.,]\d+)?[x×]?\s*$/i.test(raw)?[raw]:raw.includes('\t')?raw.split('\t'):raw.includes(',')?raw.split(','):raw.split(';');parsedWeights=new Map();const out=[],seen=new Set();for(const item of a){let text=String(item||'').trim().replace(/\s+/g,' ');if(!text)continue;let name=text,weight=null;const m=text.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)(?:[x×])?$/i);if(m){const n=Number(String(m[2]).replace(',','.'));if(Number.isFinite(n)&&n>=1&&n<=10){name=m[1].trim();weight=n}}const k=norm(name);if(!name||seen.has(k))continue;seen.add(k);if(weight)parsedWeights.set(k,weight);out.push(name)}return out}function activeWinners()'''
t, count = parse_pattern.subn(lambda _: parse_repl, t, count=1)
if count != 1:
    raise SystemExit('sorter parse block not replaced')
old_weight = "weight:+$('#defaultWeight').value||1"
if old_weight in t:
    t = t.replace(old_weight, "weight:parsedWeights.get(norm(name))||+$('#defaultWeight').value||1", 1)
p.write_text(t, encoding='utf-8')
