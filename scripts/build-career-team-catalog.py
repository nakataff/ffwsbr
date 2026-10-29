"""Build missing competition teams for the central admin catalogue, offline."""
from pathlib import Path
import hashlib
import json
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]

def key(value):
    return re.sub('[^a-z0-9]', '', unicodedata.normalize('NFD', value).encode('ascii', 'ignore').decode().lower())

def read(path):
    return json.loads((ROOT / path).read_text())

logos = read('team-data/logo-map.json')
logo_map = {key(name): logo for name, logo in logos['logos'].items()}
aliases = {key(name): key(target) for name, target in logos.get('aliases', {}).items()}
teams = []
for row in read('dados laff/times.json'):
    name = row['time'].strip()
    identity = key(name)
    teams.append({'id': identity, 'name': name, 'short': row.get('shortName', ''),
                  'logo': logo_map.get(aliases.get(identity, identity), 'escudo.webp'),
                  'aliases': [name], 'source': 'LAFF 2026 S1'})
teams.sort(key=lambda team: team['id'])
assert len(teams) == 24 and len({team['id'] for team in teams}) == 24
payload = json.dumps(teams, ensure_ascii=False, separators=(',', ':'))
data = {'version': 'laff-2026-s1-' + hashlib.sha256(payload.encode()).hexdigest()[:12],
        'sources': ['dados laff/times.json', 'team-data/logo-map.json'], 'teams': teams}
output = json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n'
path = ROOT / 'functions/career-team-catalog.json'
if '--check' in sys.argv:
    if not path.exists() or path.read_text() != output:
        raise SystemExit('Catálogo desatualizado: execute scripts/build-career-team-catalog.py')
else:
    path.write_text(output)
print(f'Catálogo de equipes: {len(teams)} equipes, {len(output.encode())} bytes')
