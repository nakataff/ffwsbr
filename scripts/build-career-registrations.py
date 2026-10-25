"""Build a small server-only index from complete WB Brasil registration lists.

Adding the next complete edition to wb-registration-sources.json advances the
current roster. Draft/incomplete lists never imply that absent people left.
"""
from pathlib import Path
import hashlib
import json
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
def key(value):
    return re.sub('[^a-z0-9]', '', unicodedata.normalize('NFD', str(value)).encode('ascii', 'ignore').decode().lower())
def read(path):
    return json.loads((ROOT / path).read_text())

config = read('player-data/wb-registration-sources.json')
seed = read('functions/career-seed.json')
people = {p['id']: p for p in seed['people']}
lookup = {}
for p in seed['people']:
    for name in [p['id'], p['name'], *p.get('aliases', [])]:
        lookup.setdefault(key(name), set()).add(p['id'])
def person_id(raw_id, p):
    for name in [raw_id.split('__')[0], p.get('name', ''), *p.get('aliases', [])]:
        matches = lookup.get(key(name), set())
        if len(matches) == 1:
            return next(iter(matches))
    raise ValueError('Registration not matched unambiguously: ' + str(p))

teams = {}
for t in seed['teams']:
    for alias in [t['id'], t['name'], *t.get('aliases', [])]:
        teams[key(alias)] = t

def team_info(name):
    t = teams.get(key(name))
    if not t:
        raise ValueError('Unknown registration team: ' + name)
    return {'teamId': t['id'], 'teamName': t['name'], 'logo': t['logo']}

def edition_order(name):
    m = re.fullmatch(r'WB (\d{4}) S([12])', name)
    if not m:
        raise ValueError('Use a WB Brasil season identifier: ' + name)
    return (int(m[1]), int(m[2]))

complete = sorted([e for e in config['editions'] if e.get('complete')], key=lambda e: edition_order(e['edition']))
if not complete:
    raise ValueError('No complete registration list')
last = complete[-1]
previous, current = {}, {}
# Earlier known participation establishes scope; international/unknown people and
# staff absent from a player-only list are never automatically released.
for pid, editions in read('player-data/edition-teams.json')['players'].items():
    for edition, name in editions.items():
        if pid in people and people[pid]['kind'] == 'player' and re.match(r'^(LBFF|WB) ', edition):
            t = teams.get(key(name))
            if t:
                previous[pid] = {**team_info(t['name']), 'edition': edition}
for source in complete:
    raw = read(source['path'])['players']
    raw = raw.items() if isinstance(raw, dict) else [(p.get('id', p['name']), p) for p in raw]
    entries = {}
    for raw_id, p in raw:
        if not isinstance(p, dict):
            raise ValueError('A complete list needs team metadata, not names only')
        pid = person_id(str(raw_id), p)
        if pid in entries:
            raise ValueError('Duplicate player in registration list: ' + pid)
        left = bool(p.get('left')) or key(p.get('rosterStatus', '')) in ['saiu', 'fora', 'desligado']
        entries[pid] = {**team_info(p['team']), 'edition': source['edition'], 'left': left,
                       'status': 'substitute' if key(p.get('rosterStatus', '')) == 'reserva' else 'active',
                       'role': 'player'}
    if not entries:
        raise ValueError('A complete list cannot be empty')
    if source is last:
        current = entries
    else:
        previous.update(entries)

payload = {'series': config['series'], 'edition': last['edition'], 'complete': True,
           'legacyOverrideEdition': config['legacyOverrideEdition'],
           'previous': previous, 'entries': current}
payload['version'] = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]
path = ROOT / 'functions/career-registrations.json'
path.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f"{payload['edition']}: {len(current)} registrations, {len(previous)} previous players; {path.stat().st_size} bytes (server only)")
